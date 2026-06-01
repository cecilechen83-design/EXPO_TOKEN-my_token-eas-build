#!/usr/bin/env python3
"""
fix-ai-parse.py — 修复 AI 解析价格表提取 0 条规则问题
1. 增强 extractRulesFromSheets：识别更多列名格式 + 宽表格式（多列=多运输方式）
2. AI 解析端点：aiParsePriceTable 返回 0 条时降级到本地提取
3. 读取 ai-quote-service.ts 诊断 AI 服务配置
"""
import os, re, shutil, subprocess
from datetime import datetime

ROUTE = "/opt/ogi-logistics/server/quote-request-routes.ts"
AI_SVC = "/opt/ogi-logistics/server/ai-quote-service.ts"
PASS = "\033[32m✅\033[0m"; FAIL = "\033[31m❌\033[0m"
INFO = "\033[36mℹ \033[0m"; WARN = "\033[33m⚠ \033[0m"

print("\n" + "="*60)
print("  AI 解析价格表 修复脚本")
print("="*60)

# ── 诊断 ai-quote-service.ts ─────────────────────────────────
print(f"\n{INFO} 检查 ai-quote-service.ts ...")
if os.path.exists(AI_SVC):
    with open(AI_SVC) as f:
        ai_src = f.read()
    has_api_key = any(k in ai_src for k in ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "process.env", "apiKey"])
    has_ai_call = any(k in ai_src for k in ["anthropic", "openai", "claude", "gpt", "fetch(", "axios"])
    print(f"  {'✅' if has_api_key else '❌'} API Key 引用: {'有' if has_api_key else '没有'}")
    print(f"  {'✅' if has_ai_call else '❌'} AI API 调用: {'有' if has_ai_call else '没有'}")
    # 显示前 60 行
    print(f"\n--- ai-quote-service.ts 前 80 行 ---")
    for i, l in enumerate(ai_src.split("\n")[:80], 1):
        print(f"L{i:3d}: {l}")
else:
    print(f"  {FAIL} 文件不存在: {AI_SVC}")
    ai_src = ""

# ── 备份 route 文件 ──────────────────────────────────────────
print(f"\n{INFO} 备份 quote-request-routes.ts ...")
ts = datetime.now().strftime("%Y%m%d_%H%M%S")
backup = ROUTE + f".bak.{ts}"
shutil.copy2(ROUTE, backup)
print(f"  {PASS} 备份: {backup}")

with open(ROUTE) as f:
    src = f.read()

applied = []; failed = []

def patch(label, content, old, new):
    if old not in content:
        print(f"  {FAIL} [{label}] 未找到目标代码")
        failed.append(label)
        return content
    result = content.replace(old, new, 1)
    print(f"  {PASS} [{label}]")
    applied.append(label)
    return result

# ════════════════════════════════════════════════════════════
print(f"\n【1】增强 extractRulesFromSheets 函数")
# ════════════════════════════════════════════════════════════

NEW_EXTRACT = '''// 辅助：从原始 Sheet 数据中提取结构化规则（支持标准列格式 + 宽表格式）
function extractRulesFromSheets(sheets: any[]): any[] {
  const rules: any[] = [];

  // 判断某字符串是否为"价格类"列名
  function isPriceHeader(h: string): boolean {
    const hL = h.toLowerCase();
    return ["单价","价格","price","rate","usd","rmb","运费","费率","计费","报价",
            "含税","费用","cost","charge","freight","海运","空运","铁路","专线",
            "拼箱","整柜","散货","快递","快线","经济","标准","优先",
            "/kg","/cbm","per kg","每公斤","每方"].some(kw => hL.includes(kw));
  }
  // 判断是否为运输方式/线路列名
  function isMethodHeader(h: string): boolean {
    const hL = h.toLowerCase();
    return ["运输方式","渠道","method","channel","专线","线路","方案","运输",
            "产品","服务","route","service","transport","物流","航线"].some(kw => hL.includes(kw));
  }
  // 判断是否为目的国列名
  function isCountryHeader(h: string): boolean {
    const hL = h.toLowerCase();
    return ["目的国","国家","country","destination","目的地","收货国",
            "地区","区域","region","发往","到达"].some(kw => hL.includes(kw));
  }
  // 判断某列是否为"数值型价格列"（列中大多数值都是正数）
  function isNumericPriceCol(rows: any[][], colIdx: number): boolean {
    let numCount = 0, total = 0;
    for (const row of rows) {
      const v = parseFloat(String(row[colIdx] || "").replace(/[^\\d.]/g, ""));
      if (!isNaN(v)) { total++; if (v > 0 && v < 1000000) numCount++; }
    }
    return total >= 2 && numCount / Math.max(total, 1) >= 0.5;
  }

  for (const sheet of sheets) {
    if (!sheet.headers || !sheet.rows || sheet.rows.length === 0) continue;
    const headers: string[] = sheet.headers.map((h: any) => (h || "").trim());
    const headersL = headers.map((h: string) => h.toLowerCase());
    const sheetCountry = sheet.name || "";

    // ── 定位标准列 ──
    const countryIdx = headersL.findIndex(isCountryHeader);
    const methodIdx  = headersL.findIndex(isMethodHeader);
    const priceIdx   = headersL.findIndex((h: string) => isPriceHeader(h) && isNumericPriceCol(sheet.rows, headersL.indexOf(h)));
    const weightMinIdx = headersL.findIndex((h: string) => ["重量下限","最小重量","min kg","最小"].some(k => h.includes(k)));
    const weightMaxIdx = headersL.findIndex((h: string) => ["重量上限","最大重量","max kg","最大"].some(k => h.includes(k)));
    const weightRangeIdx = headersL.findIndex((h: string) => ["重量段","重量范围","区间","weight range","wt range","wt."].some(k => h.includes(k)));
    const categoryIdx = headersL.findIndex((h: string) => ["品类","货物类型","category","货类","品名"].some(k => h.includes(k)));
    const minChargeIdx = headersL.findIndex((h: string) => ["最低收费","起步价","minimum","最低费"].some(k => h.includes(k)));
    const unitIdx = headersL.findIndex((h: string) => ["计费单位","计价单位","计价方式","unit"].some(k => h.includes(k)));
    const transitIdx = headersL.findIndex((h: string) => ["时效","天数","transit","运输时间"].some(k => h.includes(k)));

    // ── 检测宽表格式：多个价格列，每列代表一个运输方式 ──
    // 条件：找不到 method 列，但存在多个数值列，且列名包含运输方式关键字
    const widePriceCols: { idx: number; method: string }[] = [];
    if (methodIdx < 0 || priceIdx < 0) {
      for (let ci = 0; ci < headers.length; ci++) {
        if (ci === countryIdx || ci === weightMinIdx || ci === weightMaxIdx ||
            ci === weightRangeIdx || ci === categoryIdx || ci === minChargeIdx) continue;
        const h = headers[ci];
        if ((isPriceHeader(h) || isMethodHeader(h)) && isNumericPriceCol(sheet.rows, ci)) {
          widePriceCols.push({ idx: ci, method: h });
        }
      }
    }

    const isWideFormat = widePriceCols.length >= 2;

    for (const row of sheet.rows) {
      if (!row || row.every((c: any) => !String(c).trim())) continue;

      // ── 解析重量范围 ──
      let wMin = 0, wMax = 999999;
      if (weightMinIdx >= 0 && row[weightMinIdx]) {
        wMin = parseFloat(String(row[weightMinIdx]).replace(/[^\\d.]/g, "")) || 0;
      }
      if (weightMaxIdx >= 0 && row[weightMaxIdx]) {
        wMax = parseFloat(String(row[weightMaxIdx]).replace(/[^\\d.]/g, "")) || 999999;
      }
      if (weightRangeIdx >= 0 && row[weightRangeIdx]) {
        const rangeStr = String(row[weightRangeIdx]);
        const m = rangeStr.match(/(\\d+(?:\\.\\d+)?)\\s*[-~到至]\\s*(\\d+(?:\\.\\d+)?)/);
        if (m) { wMin = parseFloat(m[1]); wMax = parseFloat(m[2]); }
        else {
          const above = rangeStr.match(/(\\d+(?:\\.\\d+)?)\\s*(kg|公斤)?\\s*以上/i);
          if (above) wMin = parseFloat(above[1]);
          const below = rangeStr.match(/(\\d+(?:\\.\\d+)?)\\s*(kg|公斤)?\\s*以下/i);
          if (below) wMax = parseFloat(below[1]);
          // 只有下限数字（如 "45CBM+"）
          if (!m && !above && !below) {
            const single = rangeStr.match(/(\\d+(?:\\.\\d+)?)/);
            if (single) wMin = parseFloat(single[1]);
          }
        }
      }

      const country = (countryIdx >= 0 && row[countryIdx]) ? String(row[countryIdx]) : sheetCountry;
      const category = (categoryIdx >= 0 && row[categoryIdx]) ? String(row[categoryIdx]) : "";
      const minCharge = (minChargeIdx >= 0 && row[minChargeIdx]) ?
        parseFloat(String(row[minChargeIdx]).replace(/[^\\d.]/g, "")) || 0 : 0;
      const pricingUnit = (unitIdx >= 0 && row[unitIdx]) ? String(row[unitIdx]) : "";
      const transitTime = (transitIdx >= 0 && row[transitIdx]) ? String(row[transitIdx]) : "";

      if (isWideFormat) {
        // 宽表：每个价格列生成一条规则
        for (const col of widePriceCols) {
          const priceVal = parseFloat(String(row[col.idx] || "").replace(/[^\\d.]/g, ""));
          if (!isNaN(priceVal) && priceVal > 0) {
            rules.push({
              country, method: col.method, unitPrice: priceVal,
              weightMin: wMin, weightMax: wMax, category, minCharge,
              pricingUnit, transitTime,
              destinationCountry: country, transportMethod: col.method,
              currency: "RMB", route: `${sheetCountry}-${col.method}`,
            });
          }
        }
      } else {
        // 标准格式：单一价格列
        const method = (methodIdx >= 0 && row[methodIdx]) ? String(row[methodIdx]) : "";
        let priceVal = (priceIdx >= 0 && row[priceIdx]) ?
          parseFloat(String(row[priceIdx]).replace(/[^\\d.]/g, "")) : NaN;
        // 兜底：扫描所有列找第一个正数
        if (isNaN(priceVal) || priceVal <= 0) {
          for (let ci = 0; ci < row.length; ci++) {
            if ([countryIdx, methodIdx, weightMinIdx, weightMaxIdx, weightRangeIdx, categoryIdx].includes(ci)) continue;
            const v = parseFloat(String(row[ci] || "").replace(/[^\\d.]/g, ""));
            if (!isNaN(v) && v > 0 && v < 1000000) { priceVal = v; break; }
          }
        }
        if (!isNaN(priceVal) && priceVal > 0) {
          rules.push({
            country, method, unitPrice: priceVal,
            weightMin: wMin, weightMax: wMax, category, minCharge,
            pricingUnit, transitTime,
            destinationCountry: country, transportMethod: method,
            currency: "RMB", route: sheetCountry ? `${sheetCountry}-${method || "标准"}` : method,
          });
        }
      }
    }
  }
  return rules;
}'''

src = patch(
    "1-增强extractRulesFromSheets",
    src,
    '''// 辅助：从原始 Sheet 数据中提取结构化规则
function extractRulesFromSheets(sheets: any[]): any[] {
  const rules: any[] = [];
  for (const sheet of sheets) {
    if (!sheet.headers || !sheet.rows) continue;
    const headers = sheet.headers.map((h: string) => (h || "").toLowerCase().trim());
    // 尝试识别关键列索引
    const countryIdx = headers.findIndex((h: string) => h.includes("目的国") || h.includes("国家") || h.includes("country") || h.includes("destination"));
    const methodIdx = headers.findIndex((h: string) => h.includes("运输方式") || h.includes("渠道") || h.includes("method") || h.includes("channel") || h.includes("专线"));
    const priceIdx = headers.findIndex((h: string) => h.includes("单价") || h.includes("价格") || h.includes("price") || h.includes("rate") || h.includes("usd") || h.includes("rmb"));
    const weightMinIdx = headers.findIndex((h: string) => h.includes("重量下限") || h.includes("最小重量") || h.includes("min"));
    const weightMaxIdx = headers.findIndex((h: string) => h.includes("重量上限") || h.includes("最大重量") || h.includes("max"));
    const categoryIdx = headers.findIndex((h: string) => h.includes("品类") || h.includes("货物类型") || h.includes("category"));
    const minChargeIdx = headers.findIndex((h: string) => h.includes("最低收费") || h.includes("起步价") || h.includes("minimum"));

    // 如果找不到关键列，尝试用 Sheet 名称作为国家
    const sheetCountry = sheet.name || "";

    for (const row of sheet.rows) {
      const rule: any = {};
      if (countryIdx >= 0 && row[countryIdx]) {
        rule.country = row[countryIdx];
      } else if (sheetCountry) {
        rule.country = sheetCountry;
      }
      if (methodIdx >= 0 && row[methodIdx]) {
        rule.method = row[methodIdx];
      }
      if (priceIdx >= 0 && row[priceIdx]) {
        const priceVal = parseFloat(String(row[priceIdx]).replace(/[^\\d.]/g, ""));
        if (!isNaN(priceVal) && priceVal > 0) {
          rule.unitPrice = priceVal;
        }
      }
      if (weightMinIdx >= 0 && row[weightMinIdx]) {
        rule.weightMin = parseFloat(String(row[weightMinIdx]).replace(/[^\\d.]/g, "")) || 0;
      }
      if (weightMaxIdx >= 0 && row[weightMaxIdx]) {
        rule.weightMax = parseFloat(String(row[weightMaxIdx]).replace(/[^\\d.]/g, "")) || 999999;
      }
      if (categoryIdx >= 0 && row[categoryIdx]) {
        rule.category = row[categoryIdx];
      }
      if (minChargeIdx >= 0 && row[minChargeIdx]) {
        rule.minCharge = parseFloat(String(row[minChargeIdx]).replace(/[^\\d.]/g, "")) || 0;
      }
      // 只添加有有效价格的规则
      if (rule.unitPrice && rule.unitPrice > 0) {
        rules.push(rule);
      }
    }
  }
  return rules;
}''',
    NEW_EXTRACT
)

# ════════════════════════════════════════════════════════════
print(f"\n【2】AI 解析端点：aiParsePriceTable 返回 0 条时降级本地提取")
# ════════════════════════════════════════════════════════════

src = patch(
    "2-AI解析降级兜底",
    src,
    '''      // 后台执行解析
      try {
        const rules = await aiParsePriceTable(sheets);
        await db.update(priceTables).set({
          aiParseStatus: "parsed",
          aiParsedRules: JSON.stringify(rules),
          aiParseError: null,
        } as any).where(eq(priceTables.id, pt.id));
        await logAction("price_table", "ai_parse", `AI 解析价格表 V${pt.version} 完成，提取 ${rules.length} 条规则`);
      } catch (parseErr: any) {
        await db.update(priceTables).set({
          aiParseStatus: "failed",
          aiParseError: parseErr.message || "解析失败",
        } as any).where(eq(priceTables.id, pt.id));
        await logAction("price_table", "ai_parse_error", `AI 解析价格表 V${pt.version} 失败: ${parseErr.message}`);
      }''',
    '''      // 后台执行解析
      (async () => {
        try {
          let rules: AiPriceRule[] = [];
          let parseSource = "ai";
          try {
            rules = await aiParsePriceTable(sheets);
          } catch (aiErr: any) {
            await logAction("price_table", "ai_parse_warn", `AI 服务异常，降级本地提取: ${aiErr.message}`);
          }
          // AI 返回 0 条或未配置时，降级到本地规则提取
          if (!rules || rules.length === 0) {
            rules = extractRulesFromSheets(sheets) as AiPriceRule[];
            parseSource = "local";
          }
          await db.update(priceTables).set({
            aiParseStatus: "parsed",
            aiParsedRules: JSON.stringify(rules),
            aiRuleCount: rules.length,
            aiParseError: null,
          } as any).where(eq(priceTables.id, pt.id));
          await logAction("price_table", "ai_parse", `价格表 V${pt.version} 解析完成 [${parseSource}]，提取 ${rules.length} 条规则`);
        } catch (parseErr: any) {
          await db.update(priceTables).set({
            aiParseStatus: "failed",
            aiParseError: parseErr.message || "解析失败",
          } as any).where(eq(priceTables.id, pt.id));
          await logAction("price_table", "ai_parse_error", `解析价格表 V${pt.version} 失败: ${parseErr.message}`);
        }
      })();'''
)

# ════════════════════════════════════════════════════════════
print(f"\n【3】同步修复 matchPriceRules：支持新字段名")
# ════════════════════════════════════════════════════════════
src = patch(
    "3-matchPriceRules支持新字段",
    src,
    '    const ruleCountry = rule.country || rule["目的国"] || "";',
    '    const ruleCountry = rule.country || rule.destinationCountry || rule["目的国"] || "";'
)
src = patch(
    "3b-matchPriceRules方式字段",
    src,
    '    const method = rule.method || rule["运输方式"] || "标准";',
    '    const method = rule.method || rule.transportMethod || rule["运输方式"] || "标准";'
)

# ── 写回 ─────────────────────────────────────────────────────
print(f"\n{'='*60}")
print(f"  应用 {len(applied)}/{len(applied)+len(failed)} 项修复")
if failed:
    print(f"  {WARN} 未应用: {failed}")

with open(ROUTE, "w") as f:
    f.write(src)
print(f"  {PASS} 已写入: {ROUTE}")

# ── PM2 重启 ──────────────────────────────────────────────────
print(f"\n{INFO} 重启 PM2...")
ret = os.system("pm2 restart all --update-env 2>&1 | tail -8")
print(f"  {'✅ 重启完成' if ret == 0 else '❌ 重启失败，请手动运行 pm2 restart all'}")

# ── 验证：重新触发 AI 解析 ─────────────────────────────────
print(f"\n{INFO} 验证：调用 /api/price-table/ai-parse 重新解析...")
ret2 = os.system("""curl -s -X POST http://localhost:3000/api/price-table/ai-parse \
  -H 'Content-Type: application/json' -d '{}' | python3 -c "import sys,json; d=json.load(sys.stdin); print('  响应:', d)" 2>/dev/null || echo "  curl 失败" """)

print(f"\n  等待 5 秒后查询解析结果...")
import time; time.sleep(6)

ret3 = os.system("""curl -s http://localhost:3000/api/price-table/ai-status \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('  AI状态:', d.get('status'), '| 规则数:', d.get('ruleCount'), '| 错误:', d.get('error'))" 2>/dev/null || echo "  查询失败" """)

print(f"\n  备份: {backup}")
print("="*60 + "\n")
