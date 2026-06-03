#!/usr/bin/env python3
"""
修复 quote-request-routes.ts 中的报价计算端点。
添加/修复以下端点：
  GET  /api/price-table/list       → 原始SQL查询所有报价表
  GET  /api/price-table/countries  → 可用国家列表
  GET  /api/price-table/channels   → 可用渠道列表
  POST /api/price-table/:id/set-current → 设置当前报价表
  POST /api/price-table/:id/set-meta    → 更新元数据
  POST /api/price-table/calculate  → 计算报价（完整实现）
"""
import subprocess, os, sys, re, shutil
from datetime import datetime

# ── 1. 找到项目目录 ────────────────────────────────────────────
ROUTES_FILE = "/opt/ogi-logistics/server/quote-request-routes.ts"
if not os.path.exists(ROUTES_FILE):
    print("❌ 找不到文件:", ROUTES_FILE)
    sys.exit(1)

ts = datetime.now().strftime("%Y%m%d_%H%M%S")
bak = ROUTES_FILE + f".bak.{ts}"
shutil.copy2(ROUTES_FILE, bak)
print(f"✅ 已备份: {bak}")

with open(ROUTES_FILE, encoding="utf-8") as f:
    src = f.read()

print(f"📄 文件大小: {len(src)} 字节")

# ── 2. 定义需要注入的端点代码块 ──────────────────────────────

NEW_ENDPOINTS = r'''
// ═══════════════════════════════════════════════════════════
// 报价表资料库 API（自动生成，勿手动修改此注释块起止标记）
// ═══════════════════════════════════════════════════════════

// 获取所有报价表列表（原始SQL，含元数据）
app.get("/api/price-table/list", async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    if (!db) return res.status(500).json({ success: false, message: "数据库未连接" });
    const [rows]: any = await db.execute(
      `SELECT id, version, fileName, country, channel, currency, validFrom, validTo,
       ruleCount, isCurrent, aiParseStatus, uploadedByName, createdAt
       FROM price_tables ORDER BY createdAt DESC`
    );
    res.json({ success: true, priceTables: Array.isArray(rows) ? rows : [] });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 获取有报价表的国家列表
app.get("/api/price-table/countries", async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    if (!db) return res.status(500).json({ success: false, message: "数据库未连接" });
    const [rows]: any = await db.execute(
      `SELECT DISTINCT country FROM price_tables WHERE country IS NOT NULL AND country != '' ORDER BY country`
    );
    const countries = (Array.isArray(rows) ? rows : []).map((r: any) => r.country).filter(Boolean);
    res.json({ success: true, countries });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 获取有报价表的渠道列表
app.get("/api/price-table/channels", async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    if (!db) return res.status(500).json({ success: false, message: "数据库未连接" });
    const [rows]: any = await db.execute(
      `SELECT DISTINCT channel FROM price_tables WHERE channel IS NOT NULL AND channel != '' ORDER BY channel`
    );
    const channels = (Array.isArray(rows) ? rows : []).map((r: any) => r.channel).filter(Boolean);
    res.json({ success: true, channels });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 设置报价表为当前使用
app.post("/api/price-table/:id/set-current", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    if (!db) return res.status(500).json({ success: false, message: "数据库未连接" });
    const id = parseInt(req.params.id);
    await db.execute(`UPDATE price_tables SET isCurrent = 0`);
    await db.execute(`UPDATE price_tables SET isCurrent = 1 WHERE id = ?`, [id]);
    res.json({ success: true, message: "已设为当前报价表" });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 更新报价表元数据
app.post("/api/price-table/:id/set-meta", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    if (!db) return res.status(500).json({ success: false, message: "数据库未连接" });
    const id = parseInt(req.params.id);
    const { country, channel, currency, validFrom, validTo } = req.body;
    await db.execute(
      `UPDATE price_tables SET country=?, channel=?, currency=?, validFrom=?, validTo=? WHERE id=?`,
      [country || "", channel || "", currency || "RMB", validFrom || null, validTo || null, id]
    );
    res.json({ success: true, message: "元数据已更新" });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 报价计算：根据国家+渠道找报价表，计算运费及附加费
app.post("/api/price-table/calculate", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    if (!db) return res.status(500).json({ success: false, message: "数据库未连接" });

    const { country, channel, weight, volume, qty, category, tableId } = req.body;
    if (!country || !channel) return res.status(400).json({ success: false, message: "请提供目的国和渠道" });
    if (!weight || parseFloat(weight) <= 0) return res.status(400).json({ success: false, message: "请提供有效重量" });

    const w = parseFloat(weight) || 0;
    const v = parseFloat(volume) || 0;
    const chargeableWeight = Math.max(w, v * 167);

    // 查找匹配的报价表（优先精确匹配，其次isCurrent）
    let tableRow: any = null;
    if (tableId) {
      const [rows]: any = await db.execute(`SELECT * FROM price_tables WHERE id=?`, [tableId]);
      if (Array.isArray(rows) && rows.length > 0) tableRow = rows[0];
    }
    if (!tableRow) {
      const [rows]: any = await db.execute(
        `SELECT * FROM price_tables WHERE country=? AND channel=? AND aiParseStatus='done' ORDER BY isCurrent DESC, createdAt DESC LIMIT 1`,
        [country, channel]
      );
      if (Array.isArray(rows) && rows.length > 0) tableRow = rows[0];
    }
    if (!tableRow) {
      // 模糊匹配国家（包含匹配）
      const [allRows]: any = await db.execute(
        `SELECT * FROM price_tables WHERE channel=? AND aiParseStatus='done' ORDER BY isCurrent DESC, createdAt DESC`,
        [channel]
      );
      if (Array.isArray(allRows)) {
        const countryLower = country.toLowerCase();
        tableRow = allRows.find((r: any) => {
          const rc = (r.country || "").toLowerCase();
          return rc.includes(countryLower) || countryLower.includes(rc);
        });
      }
    }
    if (!tableRow) {
      return res.json({ success: false, message: `未找到 ${country} · ${channel} 的报价表，请先上传并AI解析` });
    }

    // 加载已解析的价格规则
    const [ptRows]: any = await db.execute(
      `SELECT parsedRules FROM price_tables WHERE id=?`,
      [tableRow.id]
    );
    let parsedRules: any[] = [];
    if (Array.isArray(ptRows) && ptRows[0]?.parsedRules) {
      try {
        const raw = ptRows[0].parsedRules;
        parsedRules = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (!Array.isArray(parsedRules)) parsedRules = [];
      } catch (_) { parsedRules = []; }
    }

    if (parsedRules.length === 0) {
      return res.json({ success: false, message: "该报价表尚未完成AI解析，无法计算" });
    }

    const currency = tableRow.currency || "RMB";
    const countryLower = country.toLowerCase();
    const categoryLower = (category || "").toLowerCase();

    // 匹配规则
    const matched = parsedRules.filter((r: any) => {
      const rc = (r.destinationCountry || r.country || "").toLowerCase();
      if (rc && !rc.includes(countryLower) && !countryLower.includes(rc)) return false;
      const wMin = parseFloat(r.weightMin || r.minWeight || 0);
      const wMax = parseFloat(r.weightMax || r.maxWeight || 999999);
      if (chargeableWeight < wMin || chargeableWeight > wMax) return false;
      return true;
    });

    // 按单价排序取最低价规则
    const sortedMatches = matched.sort((a: any, b: any) => (a.unitPrice || 0) - (b.unitPrice || 0));
    const bestRule = sortedMatches[0];

    if (!bestRule) {
      return res.json({
        success: false,
        message: `已找到报价表但无匹配规则（重量 ${chargeableWeight.toFixed(1)}kg，目的国 ${country}）`,
        tableInfo: { id: tableRow.id, fileName: tableRow.fileName, country: tableRow.country, channel: tableRow.channel, currency },
      });
    }

    const unitPrice = parseFloat(bestRule.unitPrice || 0);
    const freightBase = unitPrice * chargeableWeight;
    const freightFormula = `计费重 ${chargeableWeight.toFixed(1)}kg × 单价 ${unitPrice.toFixed(4)} ${currency}/kg = ${freightBase.toFixed(2)} ${currency}`;

    // 识别附加费
    const surcharges: { name: string; amount: number; formula: string }[] = [];
    const surchargeRules = parsedRules.filter((r: any) => {
      const name = (r.name || r.type || r.feeName || "").toLowerCase();
      return name.includes("附加") || name.includes("surcharge") || name.includes("超大件") || name.includes("远程") || name.includes("fuel");
    });
    for (const sr of surchargeRules.slice(0, 5)) {
      const amt = parseFloat(sr.unitPrice || sr.amount || 0);
      if (amt > 0) {
        const name = sr.name || sr.feeName || "附加费";
        surcharges.push({ name, amount: amt, formula: `固定 ${amt} ${currency}` });
      }
    }

    const totalSurcharges = surcharges.reduce((s, x) => s + x.amount, 0);
    const totalPrice = freightBase + totalSurcharges;

    res.json({
      success: true,
      tableInfo: { id: tableRow.id, fileName: tableRow.fileName, country: tableRow.country, channel: tableRow.channel, currency },
      chargeableWeight,
      weight: w, volume: v,
      unitPrice,
      freightBase,
      freightFormula,
      surcharges,
      totalPrice,
      currency,
      matchedRule: bestRule,
      allMatches: sortedMatches.length,
    });
  } catch (err: any) {
    console.error("[calculate]", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// 报价表资料库 API 结束
// ═══════════════════════════════════════════════════════════
'''

# ── 3. 检查是否已存在（避免重复注入） ────────────────────────
MARKER_START = '// 报价表资料库 API（自动生成'
MARKER_END = '// 报价表资料库 API 结束'

if MARKER_START in src:
    print("⚠️  检测到已有注入代码，正在更新...")
    # 删除旧的代码块
    start_idx = src.find(MARKER_START)
    # 找到包含marker的注释行的开头（往前找 // 开始）
    block_start = src.rfind('\n', 0, start_idx) + 1
    # 向前扩展到注释块开始（// ═══）
    if '// ═══' in src[max(0,block_start-200):block_start+10]:
        block_start = src.rfind('// ═══', 0, start_idx)
    end_idx = src.find(MARKER_END, start_idx)
    if end_idx != -1:
        end_idx = src.find('\n', end_idx + len(MARKER_END))
        # 往后延伸到注释行结束
        end_idx2 = src.find('// ═══', end_idx)
        if end_idx2 != -1 and end_idx2 - end_idx < 200:
            end_idx = src.find('\n', end_idx2) + 1
        src = src[:block_start] + src[end_idx:]
    print("  旧代码已删除")

# ── 4. 找到合适的注入位置（在最后一个 app.XXX 路由之前） ──────
# 策略：在 "export default" 或 "// ─── 结束 ───" 或 文件末尾前注入

inject_markers = [
    "export default router",
    "export default app",
    "// ─── end",
    "// ─── 结束",
    "module.exports",
]

inject_pos = -1
for marker in inject_markers:
    idx = src.rfind(marker)
    if idx != -1:
        inject_pos = idx
        break

# 如果没找到 export，找最后一个 app.get/post 之后的位置
if inject_pos == -1:
    last_app = max(src.rfind("app.get("), src.rfind("app.post("), src.rfind("app.put("))
    if last_app != -1:
        # 找这个路由结束的位置（找下一个 app. 或文件末尾）
        inject_pos = src.find("\n\n", last_app)
        if inject_pos == -1:
            inject_pos = len(src)
        else:
            inject_pos += 2

if inject_pos == -1:
    inject_pos = len(src)

src = src[:inject_pos] + "\n" + NEW_ENDPOINTS + "\n" + src[inject_pos:]
print(f"✅ 新端点已注入（位置: {inject_pos}）")

# ── 5. 写入文件 ───────────────────────────────────────────────
with open(ROUTES_FILE, "w", encoding="utf-8") as f:
    f.write(src)
print(f"✅ 文件已更新: {ROUTES_FILE}")

# ── 6. 确保数据库有 parsedRules 列（可能已有） ────────────────
print("\n⚙️  检查数据库列...")
DB_CHECK = """mysql -u ogi_user -pOGI_Logistics_2026! ogi_logistics -e "
ALTER TABLE price_tables ADD COLUMN IF NOT EXISTS parsedRules LONGTEXT NULL;
" 2>&1 | grep -v "Warning:" | grep -v "^$" || echo "列检查完成"
"""
os.system(DB_CHECK)

# 如果 IF NOT EXISTS 不支持，则用另一种方式
os.system("""mysql -u ogi_user -pOGI_Logistics_2026! ogi_logistics -e "
SELECT COUNT(*) FROM information_schema.COLUMNS
WHERE TABLE_NAME='price_tables' AND COLUMN_NAME='parsedRules' AND TABLE_SCHEMA='ogi_logistics'
;" 2>&1 | grep -v "Warning:"
""")

# ── 7. 编译 TypeScript ────────────────────────────────────────
print("\n⚙️  编译 TypeScript...")
ret = os.system("cd /opt/ogi-logistics && npm run build 2>&1 | tail -20")
if ret != 0:
    print("❌ 编译失败！请检查错误信息")
    sys.exit(1)
print("✅ 编译成功")

# ── 8. 重启 PM2 ───────────────────────────────────────────────
print("\n⚙️  重启服务...")
os.system("pm2 restart ogi-logistics-api --update-env 2>&1 | grep -E '(restart|online|error|started)' || pm2 restart all --update-env")

import time; time.sleep(4)

# ── 9. 验证 ───────────────────────────────────────────────────
print("\n⚙️  验证端点...")
import urllib.request, json
try:
    r = urllib.request.urlopen("http://localhost:3000/api/price-table/list", timeout=6)
    data = json.loads(r.read())
    print(f"✅ /api/price-table/list → 报价表数量: {len(data.get('priceTables', []))}")
except Exception as e:
    print(f"❌ /api/price-table/list 访问失败: {e}")

try:
    r = urllib.request.urlopen("http://localhost:3000/api/price-table/countries", timeout=6)
    data = json.loads(r.read())
    print(f"✅ /api/price-table/countries → {data.get('countries', [])}")
except Exception as e:
    print(f"❌ /api/price-table/countries 失败: {e}")

print("\n" + "="*60)
print("✅ 服务端报价模块端点修复完成！")
print("="*60)
