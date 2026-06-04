#!/usr/bin/env python3
"""
修复报价计算逻辑：
- 空运/快递：计费重 = max(实重, 体积重=体积×167)，单价 RMB/kg
- 海运整柜/拼柜：计费基准 = 体积(m³)，单价 RMB/m³
- 小包/铁路/卡车：默认按重量
同时返回完整计算过程供前端展示。
"""
import os, sys, re, shutil
from datetime import datetime

ROUTES_FILE = "/opt/ogi-logistics/server/quote-request-routes.ts"
if not os.path.exists(ROUTES_FILE):
    print("❌ 找不到:", ROUTES_FILE); sys.exit(1)

ts = datetime.now().strftime("%Y%m%d_%H%M%S")
shutil.copy2(ROUTES_FILE, ROUTES_FILE + f".bak3.{ts}")

with open(ROUTES_FILE, encoding="utf-8") as f:
    src = f.read()

# ── 找到现有 /api/price-table/calculate 端点并替换 ─────────
CALC_START = 'app.post("/api/price-table/calculate"'
if CALC_START not in src:
    print("❌ 未找到 calculate 端点，请先运行 fix-pricetable-routes.py")
    sys.exit(1)

# 找端点起止位置
start_idx = src.index(CALC_START)
# 往前找到行首
block_start = src.rfind('\n', 0, start_idx) + 1
# 找到 handler 结束：匹配 }); 但要计数大括号
depth = 0
i = start_idx
in_string = False
string_char = ''
found_end = -1
while i < len(src):
    ch = src[i]
    if in_string:
        if ch == '\\': i += 1
        elif ch == string_char: in_string = False
    else:
        if ch in ('"', "'", '`'): in_string = True; string_char = ch
        elif ch == '{': depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                # 找到结束的 });
                end_candidate = src.find(');', i)
                if end_candidate != -1 and src[i:end_candidate+2].strip().startswith('}'):
                    found_end = end_candidate + 2
                    break
    i += 1

if found_end == -1:
    print("❌ 未能定位 calculate 端点的结束位置"); sys.exit(1)

print(f"✅ 找到 calculate 端点: 第 {src[:block_start].count(chr(10))+1} 行 → 第 {src[:found_end].count(chr(10))+1} 行")

NEW_CALC = r'''app.post("/api/price-table/calculate", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    if (!db) return res.status(500).json({ success: false, message: "数据库未连接" });

    const { country, channel, weight, volume, qty, category, tableId } = req.body || {};
    if (!country || !channel) return res.status(400).json({ success: false, message: "请提供目的国和渠道" });
    const w = parseFloat(weight) || 0;
    const v = parseFloat(volume) || 0;
    if (w <= 0 && v <= 0) return res.status(400).json({ success: false, message: "请提供重量或体积" });

    // ── 渠道计费方式判断 ──────────────────────────────────────
    const chLower = (channel || "").toLowerCase();
    const isAir     = chLower.includes("空运");
    const isSea     = chLower.includes("海运");
    const isExpress = chLower.includes("快递");
    const isSmall   = chLower.includes("小包");

    // 空运/快递：计费重 = max(实重, 体积重)
    // 海运：计费基准 = 体积(m³)
    // 其余（小包/铁路/卡车）：按实重
    const volumetricWeight = v * 167;  // 1m³ = 167kg（航空换算）
    let billingBase: number;
    let billingUnit: string;
    let billingSteps: string[];

    if (isAir || isExpress) {
      billingBase = Math.max(w, volumetricWeight);
      billingUnit = "kg";
      billingSteps = [
        `① 实际重量: ${w} kg`,
        `② 体积重量: ${v} m³ × 167 = ${volumetricWeight.toFixed(2)} kg`,
        `③ 计费重量: max(${w}, ${volumetricWeight.toFixed(2)}) = ${billingBase.toFixed(2)} kg`,
      ];
    } else if (isSea) {
      billingBase = v;
      billingUnit = "m³";
      billingSteps = [
        `① 计费基准: 体积 ${v} m³（海运按体积计费）`,
        `② 实际重量 ${w} kg 仅供参考`,
      ];
    } else {
      // 小包/铁路/卡车 默认按重量
      billingBase = w;
      billingUnit = "kg";
      billingSteps = [
        `① 计费基准: 重量 ${w} kg`,
      ];
    }

    // ── 查找匹配报价表 ────────────────────────────────────────
    let tableRow: any = null;
    if (tableId) {
      const [r1]: any = await db.execute("SELECT * FROM price_tables WHERE id=?", [tableId]);
      if (Array.isArray(r1) && r1.length > 0) tableRow = r1[0];
    }
    if (!tableRow) {
      const [r2]: any = await db.execute(
        "SELECT * FROM price_tables WHERE country=? AND channel=? AND aiParseStatus='done' ORDER BY isCurrent DESC, createdAt DESC LIMIT 1",
        [country, channel]
      );
      if (Array.isArray(r2) && r2.length > 0) tableRow = r2[0];
    }
    if (!tableRow) {
      const [r3]: any = await db.execute(
        "SELECT * FROM price_tables WHERE channel=? AND aiParseStatus='done' ORDER BY isCurrent DESC, createdAt DESC",
        [channel]
      );
      if (Array.isArray(r3)) {
        const cl = country.toLowerCase();
        tableRow = (r3 as any[]).find((r: any) => {
          const rc = (r.country || "").toLowerCase();
          return rc && (rc.includes(cl) || cl.includes(rc));
        });
      }
    }
    if (!tableRow) {
      return res.json({
        success: false,
        message: `未找到 ${country}·${channel} 的已解析报价表`,
        debugSteps: billingSteps,
      });
    }

    const currency = tableRow.currency || "RMB";

    // ── 加载解析规则 ──────────────────────────────────────────
    const [ptRows]: any = await db.execute("SELECT parsedRules FROM price_tables WHERE id=?", [tableRow.id]);
    let parsedRules: any[] = [];
    if (Array.isArray(ptRows) && ptRows[0]?.parsedRules) {
      try {
        const raw = ptRows[0].parsedRules;
        parsedRules = typeof raw === "string" ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []);
      } catch (_) {}
    }
    if (parsedRules.length === 0) {
      return res.json({
        success: false,
        message: "报价表尚未AI解析完成，无法计算",
        tableInfo: { id: tableRow.id, fileName: tableRow.fileName, country: tableRow.country, channel: tableRow.channel, currency },
        debugSteps: billingSteps,
      });
    }

    // ── 规则匹配（考虑品类 + 重量/体积区间） ─────────────────
    const cl = country.toLowerCase();
    const catLower = (category || "").toLowerCase();

    // 先按国家筛选
    let countryRules = parsedRules.filter((r: any) => {
      const rc = (r.destinationCountry || r.country || "").toLowerCase();
      if (!rc) return true; // 没有国家限制的规则全部保留
      return rc.includes(cl) || cl.includes(rc);
    });

    // 再按品类筛选（如有）
    let categoryRules = catLower
      ? countryRules.filter((r: any) => {
          const rcat = (r.category || r.productType || r.goodsType || "").toLowerCase();
          return !rcat || rcat.includes(catLower) || catLower.includes(rcat);
        })
      : countryRules;
    if (categoryRules.length === 0) categoryRules = countryRules; // 品类无匹配时退回全部

    // 再按区间筛选（重量区间 或 体积区间）
    let rangeRules = categoryRules.filter((r: any) => {
      // 尝试体积区间
      const vMin = parseFloat(r.volumeMin || r.minVolume || 0);
      const vMax = parseFloat(r.volumeMax || r.maxVolume || 999999);
      if (isSea && vMax < 999999) {
        return v >= vMin && v <= vMax;
      }
      // 重量区间
      const wMin = parseFloat(r.weightMin || r.minWeight || 0);
      const wMax = parseFloat(r.weightMax || r.maxWeight || 999999);
      return billingBase >= wMin && billingBase <= wMax;
    });
    if (rangeRules.length === 0) rangeRules = categoryRules;

    // 取单价最低的规则
    const sorted = rangeRules.sort((a: any, b: any) => (parseFloat(a.unitPrice) || 0) - (parseFloat(b.unitPrice) || 0));
    const best = sorted[0];

    if (!best) {
      return res.json({
        success: false,
        message: `已找到报价表但无匹配规则（${billingUnit === "m³" ? "体积" : "计费重"} ${billingBase.toFixed(2)}${billingUnit}，目的国 ${country}）`,
        tableInfo: { id: tableRow.id, fileName: tableRow.fileName, country: tableRow.country, channel: tableRow.channel, currency },
        debugSteps: [...billingSteps, `④ 规则总数: ${parsedRules.length}，按国家筛选后: ${countryRules.length}，区间筛选后: 0`],
      });
    }

    const unitPrice = parseFloat(best.unitPrice || 0);
    const freightBase = unitPrice * billingBase;

    // 完整公式说明
    billingSteps.push(
      `④ 匹配规则: ${best.category || best.productType || "通用"} | 单价 ${unitPrice} ${currency}/${billingUnit}`,
      `⑤ 基础运费: ${billingBase.toFixed(2)} ${billingUnit} × ${unitPrice} ${currency}/${billingUnit} = ${freightBase.toFixed(2)} ${currency}`,
    );
    const freightFormula = billingSteps[billingSteps.length - 1];

    // ── 识别附加费 ────────────────────────────────────────────
    const surcharges: any[] = [];
    parsedRules.filter((r: any) => {
      const n = (r.name || r.type || r.feeName || "").toLowerCase();
      return n.includes("附加") || n.includes("surcharge") || n.includes("超大件") || n.includes("远程") || n.includes("燃油") || n.includes("fuel");
    }).slice(0, 5).forEach((sr: any) => {
      const amt = parseFloat(sr.unitPrice || sr.amount || 0);
      if (amt > 0) surcharges.push({
        name: sr.name || sr.feeName || "附加费",
        amount: amt,
        formula: `固定 ${amt} ${currency}`,
      });
    });
    if (surcharges.length > 0) {
      billingSteps.push(`⑥ 附加费: ${surcharges.map(s => `${s.name}=${s.amount}`).join(", ")}`);
    }

    const totalPrice = freightBase + surcharges.reduce((s: number, x: any) => s + (x.amount || 0), 0);
    billingSteps.push(`⑦ 合计: ${totalPrice.toFixed(2)} ${currency}`);

    return res.json({
      success: true,
      tableInfo: {
        id: tableRow.id, fileName: tableRow.fileName,
        country: tableRow.country, channel: tableRow.channel, currency,
      },
      billingMethod: isSea ? "volume" : "weight",
      billingMethodLabel: isSea ? "体积计费（海运）" : isAir ? "重量计费（空运）" : isExpress ? "重量计费（快递）" : "重量计费",
      weight: w, volume: v,
      chargeableWeight: billingBase,
      billingUnit,
      unitPrice,
      freightBase,
      freightFormula,
      debugSteps: billingSteps,
      surcharges,
      totalPrice,
      currency,
      matchedRule: {
        category: best.category || best.productType || "通用",
        unitPrice: best.unitPrice,
        weightMin: best.weightMin || best.minWeight,
        weightMax: best.weightMax || best.maxWeight,
      },
    });
  } catch (err: any) {
    console.error("[calculate]", err);
    return res.status(500).json({ success: false, message: String(err.message || err) });
  }
});'''

# 替换旧的 calculate 端点
src = src[:block_start] + NEW_CALC + "\n" + src[found_end:]
print("✅ calculate 端点已更新")

with open(ROUTES_FILE, "w", encoding="utf-8") as f:
    f.write(src)

# ── 编译 ─────────────────────────────────────────────────────
print("\n⚙️  编译...")
ret = os.system("cd /opt/ogi-logistics && npm run build 2>&1 | tail -8")
if ret != 0:
    print("❌ 编译失败"); sys.exit(1)
print("✅ 编译成功")

os.system("pm2 restart ogi-logistics-api --update-env 2>&1 | tail -2")
import time; time.sleep(4)

# ── 验证 ─────────────────────────────────────────────────────
import urllib.request, json

def test_calc(country, channel, weight, volume, category=""):
    data = json.dumps({"country": country, "channel": channel, "weight": weight, "volume": volume, "category": category}).encode()
    req = urllib.request.Request("http://localhost:3000/api/price-table/calculate",
                                 data=data, headers={"Content-Type": "application/json"}, method="POST")
    try:
        r = urllib.request.urlopen(req, timeout=8)
        d = json.loads(r.read())
        if d.get("success"):
            print(f"\n✅ [{country}·{channel}] {d.get('billingMethodLabel')}")
            for step in d.get("debugSteps", []):
                print(f"   {step}")
        else:
            print(f"\n⚠️  [{country}·{channel}] {d.get('message')}")
            for step in d.get("debugSteps", []):
                print(f"   {step}")
    except Exception as e:
        print(f"\n❌ [{country}·{channel}] {e}")

print("\n⚙️  计算逻辑验证...")
test_calc("阿根廷", "空运", 100, 0.5)
test_calc("阿根廷", "海运拼柜", 500, 2.0)

print("\n" + "="*60)
print("✅ 完成！")
