#!/usr/bin/env python3
"""
reparse-price-table.py — 直接从数据库读出价格表数据，本地提取规则，写回 DB
无需通过 API，绕过 curl/认证问题
"""
import subprocess, json, os, sys

PASS = "\033[32m✅\033[0m"; FAIL = "\033[31m❌\033[0m"
INFO = "\033[36mℹ \033[0m"

print("\n" + "="*55)
print("  价格表本地重新解析 & 写回数据库")
print("="*55)

# Node.js 脚本：读取价格表 → extractRulesFromSheets → 写回
node_code = r"""
const { createConnection } = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// 读取 .env 中的 DATABASE_URL
function loadEnv() {
  const envPath = '/opt/ogi-logistics/.env';
  if (!fs.existsSync(envPath)) return {};
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  const env = {};
  for (const line of lines) {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

// ── extractRulesFromSheets（与修复后的路由文件一致） ──
function isPriceHeader(h) {
  const hL = h.toLowerCase();
  return ["单价","价格","price","rate","usd","rmb","运费","费率","计费","报价",
          "含税","费用","cost","charge","freight","海运","空运","铁路","专线",
          "拼箱","整柜","散货","快递","快线","经济","标准","优先",
          "/kg","/cbm","per kg","每公斤","每方"].some(kw => hL.includes(kw));
}
function isMethodHeader(h) {
  const hL = h.toLowerCase();
  return ["运输方式","渠道","method","channel","专线","线路","方案","运输",
          "产品","服务","route","service","transport","物流","航线"].some(kw => hL.includes(kw));
}
function isCountryHeader(h) {
  const hL = h.toLowerCase();
  return ["目的国","国家","country","destination","目的地","收货国",
          "地区","区域","region","发往","到达"].some(kw => hL.includes(kw));
}
function isNumericPriceCol(rows, colIdx) {
  let numCount = 0, total = 0;
  for (const row of rows) {
    const v = parseFloat(String(row[colIdx] || '').replace(/[^\d.]/g, ''));
    if (!isNaN(v)) { total++; if (v > 0 && v < 1000000) numCount++; }
  }
  return total >= 2 && numCount / Math.max(total, 1) >= 0.5;
}

function extractRulesFromSheets(sheets) {
  const rules = [];
  for (const sheet of sheets) {
    if (!sheet.headers || !sheet.rows || sheet.rows.length === 0) continue;
    const headers = sheet.headers.map(h => (h || '').trim());
    const headersL = headers.map(h => h.toLowerCase());
    const sheetCountry = sheet.name || '';

    const countryIdx = headersL.findIndex(isCountryHeader);
    const methodIdx  = headersL.findIndex(isMethodHeader);
    const priceIdx   = headersL.findIndex((h, i) => isPriceHeader(h) && isNumericPriceCol(sheet.rows, i));
    const weightMinIdx = headersL.findIndex(h => ["重量下限","最小重量","min kg","最小"].some(k => h.includes(k)));
    const weightMaxIdx = headersL.findIndex(h => ["重量上限","最大重量","max kg","最大"].some(k => h.includes(k)));
    const weightRangeIdx = headersL.findIndex(h => ["重量段","重量范围","区间","weight range","wt"].some(k => h.includes(k)));
    const categoryIdx = headersL.findIndex(h => ["品类","货物类型","category","货类","品名"].some(k => h.includes(k)));
    const minChargeIdx = headersL.findIndex(h => ["最低收费","起步价","minimum","最低费"].some(k => h.includes(k)));
    const unitIdx = headersL.findIndex(h => ["计费单位","计价单位","unit"].some(k => h.includes(k)));
    const transitIdx = headersL.findIndex(h => ["时效","天数","transit","运输时间"].some(k => h.includes(k)));

    // 宽表检测
    const widePriceCols = [];
    if (methodIdx < 0 || priceIdx < 0) {
      for (let ci = 0; ci < headers.length; ci++) {
        if ([countryIdx,weightMinIdx,weightMaxIdx,weightRangeIdx,categoryIdx,minChargeIdx].includes(ci)) continue;
        const h = headers[ci];
        if ((isPriceHeader(h) || isMethodHeader(h)) && isNumericPriceCol(sheet.rows, ci)) {
          widePriceCols.push({ idx: ci, method: h });
        }
      }
    }
    const isWideFormat = widePriceCols.length >= 2;

    console.log(`  Sheet: "${sheet.name}" | ${sheet.rows.length} 行 | 宽表:${isWideFormat} | 价格列:${priceIdx} | 运输列:${methodIdx} | 国家列:${countryIdx} | 宽表价格列数:${widePriceCols.length}`);

    for (const row of sheet.rows) {
      if (!row || row.every(c => !String(c).trim())) continue;

      let wMin = 0, wMax = 999999;
      if (weightMinIdx >= 0 && row[weightMinIdx]) wMin = parseFloat(String(row[weightMinIdx]).replace(/[^\d.]/g,'')) || 0;
      if (weightMaxIdx >= 0 && row[weightMaxIdx]) wMax = parseFloat(String(row[weightMaxIdx]).replace(/[^\d.]/g,'')) || 999999;
      if (weightRangeIdx >= 0 && row[weightRangeIdx]) {
        const rs = String(row[weightRangeIdx]);
        const m = rs.match(/(\d+(?:\.\d+)?)\s*[-~到至]\s*(\d+(?:\.\d+)?)/);
        if (m) { wMin = parseFloat(m[1]); wMax = parseFloat(m[2]); }
      }

      const country = (countryIdx >= 0 && row[countryIdx]) ? String(row[countryIdx]) : sheetCountry;
      const category = (categoryIdx >= 0 && row[categoryIdx]) ? String(row[categoryIdx]) : '';
      const minCharge = (minChargeIdx >= 0 && row[minChargeIdx]) ? parseFloat(String(row[minChargeIdx]).replace(/[^\d.]/g,'')) || 0 : 0;
      const pricingUnit = (unitIdx >= 0 && row[unitIdx]) ? String(row[unitIdx]) : '';
      const transitTime = (transitIdx >= 0 && row[transitIdx]) ? String(row[transitIdx]) : '';

      if (isWideFormat) {
        for (const col of widePriceCols) {
          const pv = parseFloat(String(row[col.idx] || '').replace(/[^\d.]/g,''));
          if (!isNaN(pv) && pv > 0) {
            rules.push({ country, method: col.method, unitPrice: pv, weightMin: wMin, weightMax: wMax,
              category, minCharge, pricingUnit, transitTime,
              destinationCountry: country, transportMethod: col.method, currency: 'RMB',
              route: `${sheetCountry}-${col.method}` });
          }
        }
      } else {
        const method = (methodIdx >= 0 && row[methodIdx]) ? String(row[methodIdx]) : '';
        let pv = (priceIdx >= 0 && row[priceIdx]) ? parseFloat(String(row[priceIdx]).replace(/[^\d.]/g,'')) : NaN;
        if (isNaN(pv) || pv <= 0) {
          for (let ci = 0; ci < row.length; ci++) {
            if ([countryIdx,methodIdx,weightMinIdx,weightMaxIdx,weightRangeIdx,categoryIdx].includes(ci)) continue;
            const v = parseFloat(String(row[ci]||'').replace(/[^\d.]/g,''));
            if (!isNaN(v) && v > 0 && v < 1000000) { pv = v; break; }
          }
        }
        if (!isNaN(pv) && pv > 0) {
          rules.push({ country, method, unitPrice: pv, weightMin: wMin, weightMax: wMax,
            category, minCharge, pricingUnit, transitTime,
            destinationCountry: country, transportMethod: method, currency: 'RMB',
            route: sheetCountry ? `${sheetCountry}-${method||'标准'}` : method });
        }
      }
    }
  }
  return rules;
}

async function main() {
  const env = loadEnv();
  const dbUrl = env.DATABASE_URL || '';
  if (!dbUrl) { console.log('ERROR: DATABASE_URL 未配置'); process.exit(1); }

  // 解析 mysql://user:pass@host:port/db
  const m = dbUrl.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (!m) { console.log('ERROR: DATABASE_URL 格式无法解析:', dbUrl.slice(0,30)); process.exit(1); }
  const [,user,password,host,port,database] = m;

  const conn = await createConnection({ host, port: parseInt(port), user, password, database });
  console.log('DB 已连接');

  // 获取当前价格表
  const [rows] = await conn.execute('SELECT * FROM price_tables WHERE isCurrent=1 ORDER BY id DESC LIMIT 1');
  if (!rows.length) { console.log('未找到当前价格表'); await conn.end(); process.exit(0); }
  const pt = rows[0];
  console.log(`价格表 ID=${pt.id} | 文件: ${pt.fileName} | AI状态: ${pt.aiParseStatus} | 当前规则数: ${pt.aiRuleCount}`);
  console.log(`rulesJson 长度: ${pt.rulesJson ? pt.rulesJson.length : 0}`);

  if (!pt.rulesJson) { console.log('rulesJson 为空，无法解析'); await conn.end(); process.exit(0); }

  let sheets;
  try {
    sheets = JSON.parse(pt.rulesJson);
  } catch(e) { console.log('rulesJson 解析失败:', e.message); await conn.end(); process.exit(1); }

  if (!Array.isArray(sheets)) { console.log('rulesJson 不是数组格式，类型:', typeof sheets); await conn.end(); process.exit(1); }
  console.log(`共 ${sheets.length} 个 Sheet`);
  if (sheets.length > 0) {
    console.log('第一个 Sheet 名:', sheets[0].name, '| headers:', JSON.stringify(sheets[0].headers));
    if (sheets[0].rows && sheets[0].rows.length > 0) console.log('第一行:', JSON.stringify(sheets[0].rows[0]));
  }

  console.log('\n开始提取规则...');
  const rules = extractRulesFromSheets(sheets);
  console.log(`\n提取到 ${rules.length} 条规则`);
  if (rules.length > 0) {
    console.log('前3条:', JSON.stringify(rules.slice(0,3), null, 2));
  }

  // 写回数据库
  await conn.execute(
    'UPDATE price_tables SET aiParseStatus=?, aiParsedRules=?, aiRuleCount=?, aiParseError=NULL WHERE id=?',
    ['parsed', JSON.stringify(rules), rules.length, pt.id]
  );
  console.log(`\n已更新数据库：aiParseStatus=parsed, aiRuleCount=${rules.length}`);

  await conn.end();
  process.exit(0);
}

main().catch(e => { console.log('ERROR:', e.message); process.exit(1); });
"""

node_file = "/tmp/_reparse_pt.js"
with open(node_file, "w") as f:
    f.write(node_code)

print(f"\n{INFO} 运行 Node.js 解析脚本...")
proc = subprocess.Popen(
    ["node", node_file],
    cwd="/opt/ogi-logistics",
    stdout=subprocess.PIPE, stderr=subprocess.PIPE
)
out, err = proc.communicate(timeout=30)
print(out.decode("utf-8", errors="replace"))
if err:
    stderr_str = err.decode("utf-8", errors="replace")
    # 过滤掉不重要的 warning
    for line in stderr_str.split("\n"):
        if line.strip() and "ExperimentalWarning" not in line and "DeprecationWarning" not in line:
            print("ERR:", line)

if proc.returncode != 0:
    print(f"\n{FAIL} 脚本执行失败 (退出码 {proc.returncode})")
    # 尝试用 mysql2/promise 安装检查
    print(f"\n{INFO} 检查 mysql2 模块...")
    r2 = subprocess.Popen(["node", "-e", "require('mysql2/promise'); console.log('OK')"],
        cwd="/opt/ogi-logistics", stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    o2, e2 = r2.communicate(timeout=10)
    print(o2.decode() or e2.decode()[:200])
else:
    print(f"\n{PASS} 完成！请刷新前端页面，AI 规则数应已更新")

os.unlink(node_file)
print("="*55 + "\n")
