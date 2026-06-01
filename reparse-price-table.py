#!/usr/bin/env python3
"""reparse-price-table.py v2 — 跳过目录Sheet + 修正DB列名"""
import subprocess, json, os

PASS = "\033[32m✅\033[0m"; FAIL = "\033[31m❌\033[0m"; INFO = "\033[36mℹ \033[0m"

print("\n" + "="*55 + "\n  价格表本地重新解析 v2\n" + "="*55)

node_code = r"""
const { createConnection } = require('mysql2/promise');
const fs = require('fs');

function loadEnv() {
  const lines = fs.readFileSync('/opt/ogi-logistics/.env','utf8').split('\n');
  const env = {};
  for (const l of lines) { const m=l.match(/^([^=]+)=(.*)/); if(m) env[m[1].trim()]=m[2].trim().replace(/^["']|["']$/g,''); }
  return env;
}

// ── 辅助函数 ──────────────────────────────────────────────────
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
  const vals = [];
  for (const row of rows) {
    const v = parseFloat(String(row[colIdx]||'').replace(/[^\d.]/g,''));
    if (!isNaN(v) && v > 0 && v < 1000000) vals.push(v);
  }
  if (vals.length < 2) return false;
  // 排除序号列：如果值是连续整数 1,2,3... 则不是价格列
  const sorted = [...vals].sort((a,b)=>a-b);
  const isSequential = sorted.every((v,i) => i===0 || v - sorted[i-1] <= 1.5);
  const hasLargeValue = vals.some(v => v >= 5); // 价格通常 >= 5
  if (isSequential && !hasLargeValue) return false;
  return vals.length / rows.length >= 0.4;
}
// 判断是否为目录/说明Sheet（跳过）
function isIndexSheet(name) {
  const n = (name||'').toLowerCase();
  return ["目录","说明","index","contents","cover","封面","目次","版本","readme","sheet","概述","费用说明"].some(p=>n.includes(p));
}

function extractRulesFromSheets(sheets) {
  const rules = [];
  for (const sheet of sheets) {
    if (!sheet.headers || !sheet.rows || sheet.rows.length===0) continue;
    if (isIndexSheet(sheet.name)) { console.log(`  ⏭  跳过: "${sheet.name}"`); continue; }

    const headers = sheet.headers.map(h=>(h||'').trim());
    const headersL = headers.map(h=>h.toLowerCase());
    const sheetCountry = sheet.name||'';

    const countryIdx   = headersL.findIndex(isCountryHeader);
    const methodIdx    = headersL.findIndex(isMethodHeader);
    const priceIdx     = headersL.findIndex((h,i)=>isPriceHeader(h)&&isNumericPriceCol(sheet.rows,i));
    const weightMinIdx = headersL.findIndex(h=>["重量下限","最小重量","min kg","起始重"].some(k=>h.includes(k)));
    const weightMaxIdx = headersL.findIndex(h=>["重量上限","最大重量","max kg","截止重"].some(k=>h.includes(k)));
    const weightRangeIdx = headersL.findIndex(h=>["重量段","重量范围","区间","wt range","计费重","重量"].some(k=>h.includes(k)));
    const categoryIdx  = headersL.findIndex(h=>["品类","货物类型","category","货类","品名"].some(k=>h.includes(k)));
    const minChargeIdx = headersL.findIndex(h=>["最低收费","起步价","minimum","最低费","起步"].some(k=>h.includes(k)));
    const unitIdx      = headersL.findIndex(h=>["计费单位","计价单位","unit"].some(k=>h.includes(k)));
    const transitIdx   = headersL.findIndex(h=>["时效","天数","transit","运输时间"].some(k=>h.includes(k)));

    // 宽表检测（多个价格列）
    const widePriceCols = [];
    if (methodIdx<0 || priceIdx<0) {
      for (let ci=0; ci<headers.length; ci++) {
        if ([countryIdx,weightMinIdx,weightMaxIdx,weightRangeIdx,categoryIdx,minChargeIdx].includes(ci)) continue;
        const h = headers[ci];
        if ((isPriceHeader(h)||isMethodHeader(h)) && isNumericPriceCol(sheet.rows,ci)) {
          widePriceCols.push({idx:ci, method:h});
        }
      }
    }
    const isWideFormat = widePriceCols.length>=2;

    console.log(`  Sheet: "${sheet.name}" | ${sheet.rows.length}行 | 宽表:${isWideFormat} | 价格列:${priceIdx} | 运输列:${methodIdx} | 宽表列数:${widePriceCols.length}`);
    if (sheet.rows.length>0) console.log(`    headers: ${JSON.stringify(headers.slice(0,8))}`);
    if (sheet.rows.length>0) console.log(`    row[0]: ${JSON.stringify(sheet.rows[0].slice(0,8))}`);

    for (const row of sheet.rows) {
      if (!row||row.every(c=>!String(c).trim())) continue;

      let wMin=0, wMax=999999;
      if (weightMinIdx>=0&&row[weightMinIdx]) wMin=parseFloat(String(row[weightMinIdx]).replace(/[^\d.]/g,''))||0;
      if (weightMaxIdx>=0&&row[weightMaxIdx]) wMax=parseFloat(String(row[weightMaxIdx]).replace(/[^\d.]/g,''))||999999;
      if (weightRangeIdx>=0&&row[weightRangeIdx]) {
        const rs=String(row[weightRangeIdx]);
        const m=rs.match(/(\d+(?:\.\d+)?)\s*[-~到至]\s*(\d+(?:\.\d+)?)/);
        if (m){wMin=parseFloat(m[1]);wMax=parseFloat(m[2]);}
        else {
          const a=rs.match(/(\d+(?:\.\d+)?)\s*(kg)?\s*以上/i); if(a) wMin=parseFloat(a[1]);
          const b=rs.match(/(\d+(?:\.\d+)?)\s*(kg)?\s*以下/i); if(b) wMax=parseFloat(b[1]);
        }
      }

      const country=(countryIdx>=0&&row[countryIdx])?String(row[countryIdx]):sheetCountry;
      const category=(categoryIdx>=0&&row[categoryIdx])?String(row[categoryIdx]):'';
      const minCharge=(minChargeIdx>=0&&row[minChargeIdx])?parseFloat(String(row[minChargeIdx]).replace(/[^\d.]/g,''))||0:0;
      const pricingUnit=(unitIdx>=0&&row[unitIdx])?String(row[unitIdx]):'';
      const transitTime=(transitIdx>=0&&row[transitIdx])?String(row[transitIdx]):'';

      if (isWideFormat) {
        for (const col of widePriceCols) {
          const pv=parseFloat(String(row[col.idx]||'').replace(/[^\d.]/g,''));
          if (!isNaN(pv)&&pv>0) {
            rules.push({country,method:col.method,unitPrice:pv,weightMin:wMin,weightMax:wMax,
              category,minCharge,pricingUnit,transitTime,destinationCountry:country,
              transportMethod:col.method,currency:'RMB',route:`${sheetCountry}-${col.method}`});
          }
        }
      } else {
        const method=(methodIdx>=0&&row[methodIdx])?String(row[methodIdx]):'';
        let pv=(priceIdx>=0&&row[priceIdx])?parseFloat(String(row[priceIdx]).replace(/[^\d.]/g,'')):NaN;
        if (isNaN(pv)||pv<=0) {
          for (let ci=0;ci<row.length;ci++) {
            if ([countryIdx,methodIdx,weightMinIdx,weightMaxIdx,weightRangeIdx,categoryIdx].includes(ci)) continue;
            const v=parseFloat(String(row[ci]||'').replace(/[^\d.]/g,''));
            if (!isNaN(v)&&v>=5&&v<1000000){pv=v;break;} // >=5 避免序号干扰
          }
        }
        if (!isNaN(pv)&&pv>0) {
          rules.push({country,method,unitPrice:pv,weightMin:wMin,weightMax:wMax,
            category,minCharge,pricingUnit,transitTime,destinationCountry:country,
            transportMethod:method,currency:'RMB',route:sheetCountry?(sheetCountry+(method?'-'+method:'')):method});
        }
      }
    }
  }
  return rules;
}

async function main(){
  const env=loadEnv();
  const dbUrl=env.DATABASE_URL||'';
  const m=dbUrl.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if(!m){console.log('DATABASE_URL 无法解析');process.exit(1);}
  const [,user,password,host,port,database]=m;
  const conn=await createConnection({host,port:parseInt(port),user,password,database});
  console.log('DB 已连接');

  // 查看 price_tables 实际列名
  const [cols]=await conn.execute('DESCRIBE price_tables');
  const colNames=cols.map(c=>c.Field);
  console.log('price_tables 列:', colNames.join(', '));

  const [rows]=await conn.execute('SELECT * FROM price_tables WHERE isCurrent=1 ORDER BY id DESC LIMIT 1');
  if(!rows.length){console.log('无当前价格表');await conn.end();process.exit(0);}
  const pt=rows[0];
  console.log(`ID=${pt.id} | ${pt.fileName} | AI状态: ${pt.aiParseStatus} | rulesJson: ${pt.rulesJson?pt.rulesJson.length:0}字节`);

  const sheets=JSON.parse(pt.rulesJson||'[]');
  console.log(`\n共 ${sheets.length} 个 Sheet，开始提取...\n`);

  const rules=extractRulesFromSheets(sheets);
  console.log(`\n提取到 ${rules.length} 条规则`);
  if(rules.length>0) {
    // 显示有意义的规则示例（单价>=5）
    const goodRules=rules.filter(r=>r.unitPrice>=5);
    console.log(`有效规则(unitPrice>=5): ${goodRules.length} 条`);
    if(goodRules.length>0) console.log('示例:', JSON.stringify(goodRules.slice(0,3),null,2));
  }

  // 动态构建 UPDATE，只更新实际存在的列
  const hasAiRuleCount = colNames.includes('aiRuleCount');
  const hasRuleCount   = colNames.includes('ruleCount');

  let updateSql = 'UPDATE price_tables SET aiParseStatus=?, aiParsedRules=?, aiParseError=NULL';
  const params = ['parsed', JSON.stringify(rules)];
  if (hasAiRuleCount) { updateSql += ', aiRuleCount=?'; params.push(rules.length); }
  if (hasRuleCount && !hasAiRuleCount) { updateSql += ', ruleCount=?'; params.push(rules.length); }
  updateSql += ' WHERE id=?';
  params.push(pt.id);

  await conn.execute(updateSql, params);
  console.log(`\n✅ 数据库已更新 — aiParseStatus=parsed, 规则数=${rules.length}`);
  await conn.end();
  process.exit(0);
}
main().catch(e=>{console.log('ERROR:',e.message);process.exit(1);});
"""

node_file = "/opt/ogi-logistics/_reparse_pt.js"
with open(node_file, "w") as f:
    f.write(node_code)

proc = subprocess.Popen(
    ["node", "_reparse_pt.js"],
    cwd="/opt/ogi-logistics",
    stdout=subprocess.PIPE, stderr=subprocess.PIPE
)
out, err = proc.communicate(timeout=30)
print(out.decode("utf-8", errors="replace"))
for line in err.decode("utf-8", errors="replace").split("\n"):
    if line.strip() and "ExperimentalWarning" not in line and "DeprecationWarning" not in line:
        print("ERR:", line)

try: os.unlink(node_file)
except: pass

if proc.returncode == 0:
    print(f"\n{PASS} 完成！请在前端刷新页面，AI 规则数应已更新")
else:
    print(f"\n{FAIL} 失败 (退出码 {proc.returncode})")
print("="*55 + "\n")
