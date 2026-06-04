#!/usr/bin/env python3
"""
修复 /api/price-table/countries 和 /api/price-table/channels 端点500错误。
原因：Express 里 GET /api/price-table/:id 在前，把 "countries"/"channels" 当 id 处理。
修复方案：将这两个路由注入到 :id 路由之前。
"""
import os, sys, re, shutil
from datetime import datetime

ROUTES_FILE = "/opt/ogi-logistics/server/quote-request-routes.ts"
if not os.path.exists(ROUTES_FILE):
    print("❌ 找不到:", ROUTES_FILE)
    sys.exit(1)

ts = datetime.now().strftime("%Y%m%d_%H%M%S")
shutil.copy2(ROUTES_FILE, ROUTES_FILE + f".bak2.{ts}")

with open(ROUTES_FILE, encoding="utf-8") as f:
    src = f.read()

# ── 先检查哪些路由已存在 ────────────────────────────────────
has_countries = "/api/price-table/countries" in src
has_channels  = "/api/price-table/channels"  in src
has_set_curr  = "/api/price-table/:id/set-current" in src
has_calculate = "/api/price-table/calculate" in src

print(f"countries路由: {'✅已有' if has_countries else '❌缺少'}")
print(f"channels路由:  {'✅已有' if has_channels else '❌缺少'}")
print(f"set-current:   {'✅已有' if has_set_curr else '❌缺少'}")
print(f"calculate:     {'✅已有' if has_calculate else '❌缺少'}")

# ── 检测是否有 :id 路由在前面造成冲突 ────────────────────────
# 找第一个 app.get("/api/price-table/:id" 或类似的捕获路由
id_route_patterns = [
    r'app\.get\(["\`]/api/price-table/:id',
    r'app\.get\(["\`]/api/price-tables/:id',
    r'router\.get\(["\`]/api/price-table/:id',
]
id_route_pos = -1
for pat in id_route_patterns:
    m = re.search(pat, src)
    if m:
        id_route_pos = m.start()
        print(f"⚠️  发现 :id GET路由位于第 {src[:id_route_pos].count(chr(10))+1} 行")
        break

# ── 定义需要前置的路由 ────────────────────────────────────────
EARLY_ROUTES = '''
// [前置路由] 必须在 :id 路由之前，否则 Express 会把路径段当 id 处理
app.get("/api/price-table/countries", async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    if (!db) return res.status(500).json({ success: false, message: "数据库未连接" });
    const [rows]: any = await db.execute(
      "SELECT DISTINCT country FROM price_tables WHERE country IS NOT NULL AND country <> '' ORDER BY country"
    );
    const countries = (Array.isArray(rows) ? rows : []).map((r: any) => r.country || "").filter(Boolean);
    return res.json({ success: true, countries });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: String(err.message || err) });
  }
});

app.get("/api/price-table/channels", async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    if (!db) return res.status(500).json({ success: false, message: "数据库未连接" });
    const [rows]: any = await db.execute(
      "SELECT DISTINCT channel FROM price_tables WHERE channel IS NOT NULL AND channel <> '' ORDER BY channel"
    );
    const channels = (Array.isArray(rows) ? rows : []).map((r: any) => r.channel || "").filter(Boolean);
    return res.json({ success: true, channels });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: String(err.message || err) });
  }
});

app.post("/api/price-table/:id/set-current", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    if (!db) return res.status(500).json({ success: false, message: "数据库未连接" });
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ success: false, message: "无效ID" });
    await db.execute("UPDATE price_tables SET isCurrent = 0");
    await db.execute("UPDATE price_tables SET isCurrent = 1 WHERE id = ?", [id]);
    return res.json({ success: true, message: "已设为当前报价表" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: String(err.message || err) });
  }
});

app.post("/api/price-table/calculate", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    if (!db) return res.status(500).json({ success: false, message: "数据库未连接" });
    const { country, channel, weight, volume, qty, category, tableId } = req.body || {};
    if (!country || !channel) return res.status(400).json({ success: false, message: "请提供目的国和渠道" });
    const w = parseFloat(weight) || 0;
    const v = parseFloat(volume) || 0;
    if (w <= 0) return res.status(400).json({ success: false, message: "请提供有效重量" });
    const chargeableWeight = Math.max(w, v * 167);

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
      // 模糊匹配：渠道精确，国家包含
      const [r3]: any = await db.execute(
        "SELECT * FROM price_tables WHERE channel=? AND aiParseStatus='done' ORDER BY isCurrent DESC, createdAt DESC",
        [channel]
      );
      if (Array.isArray(r3)) {
        const cl = country.toLowerCase();
        tableRow = r3.find((r: any) => {
          const rc = (r.country || "").toLowerCase();
          return rc && (rc.includes(cl) || cl.includes(rc));
        });
      }
    }
    if (!tableRow) {
      return res.json({ success: false, message: `未找到 ${country}·${channel} 的已解析报价表，请先上传并AI解析` });
    }

    // 加载 parsedRules
    const [ptRows]: any = await db.execute("SELECT parsedRules FROM price_tables WHERE id=?", [tableRow.id]);
    let parsedRules: any[] = [];
    if (Array.isArray(ptRows) && ptRows[0]) {
      try {
        const raw = ptRows[0].parsedRules;
        if (raw) {
          parsedRules = typeof raw === "string" ? JSON.parse(raw) : raw;
          if (!Array.isArray(parsedRules)) parsedRules = [];
        }
      } catch (_) { parsedRules = []; }
    }
    if (parsedRules.length === 0) {
      return res.json({ success: false, message: "该报价表尚未完成AI解析，无法计算", tableInfo: { id: tableRow.id, fileName: tableRow.fileName, country: tableRow.country, channel: tableRow.channel, currency: tableRow.currency || "RMB" } });
    }

    const currency = tableRow.currency || "RMB";
    const cl = country.toLowerCase();
    const matched = parsedRules.filter((r: any) => {
      const rc = (r.destinationCountry || r.country || "").toLowerCase();
      if (rc && !rc.includes(cl) && !cl.includes(rc)) return false;
      const wMin = parseFloat(r.weightMin || r.minWeight || 0);
      const wMax = parseFloat(r.weightMax || r.maxWeight || 999999);
      if (chargeableWeight < wMin || chargeableWeight > wMax) return false;
      return true;
    });

    const sorted = matched.sort((a: any, b: any) => (parseFloat(a.unitPrice) || 0) - (parseFloat(b.unitPrice) || 0));
    const best = sorted[0];
    if (!best) {
      return res.json({ success: false, message: `报价表已找到但无匹配规则（计费重 ${chargeableWeight.toFixed(1)}kg）`, tableInfo: { id: tableRow.id, fileName: tableRow.fileName, country: tableRow.country, channel: tableRow.channel, currency } });
    }

    const unitPrice = parseFloat(best.unitPrice || 0);
    const freightBase = unitPrice * chargeableWeight;
    const freightFormula = `计费重 ${chargeableWeight.toFixed(1)}kg × 单价 ${unitPrice} ${currency}/kg = ${freightBase.toFixed(2)} ${currency}`;

    const surcharges: any[] = [];
    parsedRules.filter((r: any) => {
      const n = (r.name || r.type || r.feeName || "").toLowerCase();
      return n.includes("附加") || n.includes("surcharge") || n.includes("超大件") || n.includes("远程") || n.includes("fuel");
    }).slice(0, 5).forEach((sr: any) => {
      const amt = parseFloat(sr.unitPrice || sr.amount || 0);
      if (amt > 0) surcharges.push({ name: sr.name || sr.feeName || "附加费", amount: amt, formula: `固定 ${amt} ${currency}` });
    });

    const totalPrice = freightBase + surcharges.reduce((s: number, x: any) => s + x.amount, 0);
    return res.json({
      success: true,
      tableInfo: { id: tableRow.id, fileName: tableRow.fileName, country: tableRow.country, channel: tableRow.channel, currency },
      chargeableWeight, weight: w, volume: v, unitPrice, freightBase, freightFormula, surcharges, totalPrice, currency,
    });
  } catch (err: any) {
    console.error("[calculate]", err);
    return res.status(500).json({ success: false, message: String(err.message || err) });
  }
});
// [前置路由结束]

'''

# ── 删除旧的重复定义（如有） ──────────────────────────────────
# 删除上次注入的 countries / channels 块（如果在 :id 路由之后）
patterns_to_remove = [
    # 注入的完整块
    r'// 报价表资料库 API（自动生成.*?// 报价表资料库 API 结束\n',
]
for pat in patterns_to_remove:
    new_src = re.sub(pat, '', src, flags=re.DOTALL)
    if new_src != src:
        print(f"  已移除旧注入块（{len(src)-len(new_src)} 字节）")
        src = new_src

# ── 也删除可能残留的单独路由定义 ────────────────────────────
for route in ['"/api/price-table/countries"', '"/api/price-table/channels"', '"/api/price-table/:id/set-current"', '"/api/price-table/calculate"']:
    if route in src:
        # 找到该路由的 app.get/post 调用，删除整个函数块
        idx = src.find(route)
        start = src.rfind('\napp.', 0, idx)
        if start == -1: start = src.rfind('\nrouter.', 0, idx)
        if start != -1:
            # 找结束：下一个 app. 或 router.
            end = len(src)
            for m in re.finditer(r'\napp\.\w+\(|'\nrouter\.\w+\(', src[start+1:]):
                end = start + 1 + m.start()
                break
            block = src[start:end]
            print(f"  删除旧路由: {route} ({len(block)} chars)")
            src = src[:start] + src[end:]

# ── 重新注入到正确位置（所有 :id 路由之前） ─────────────────
# 找第一个 app.get/post 含 :id 的位置作为注入点
id_match = re.search(r'\napp\.(get|post|put|delete)\(["\`]/api/price-table/:', src)
if id_match:
    inject_at = id_match.start()
    print(f"  注入位置：:id路由之前（第 {src[:inject_at].count(chr(10))+1} 行）")
else:
    # 找 /api/price-table/list 之后
    list_idx = src.find('"/api/price-table/list"')
    if list_idx != -1:
        inject_at = src.find('\n', list_idx)
        # 往后找到该路由块结束
        next_app = re.search(r'\napp\.', src[inject_at+1:])
        if next_app:
            inject_at = inject_at + 1 + next_app.start()
    else:
        inject_at = len(src)

# 找到该位置所在行的开头
line_start = src.rfind('\n', 0, inject_at) + 1
src = src[:line_start] + EARLY_ROUTES + src[line_start:]
print(f"✅ 路由已注入到位置 {line_start}")

with open(ROUTES_FILE, "w", encoding="utf-8") as f:
    f.write(src)
print("✅ 文件已写入")

# ── 编译 ─────────────────────────────────────────────────────
print("\n⚙️  编译 TypeScript...")
ret = os.system("cd /opt/ogi-logistics && npm run build 2>&1 | tail -10")
if ret != 0:
    print("❌ 编译失败！")
    sys.exit(1)
print("✅ 编译成功")

# ── 重启 ────────────────────────────────────────────────────
os.system("pm2 restart ogi-logistics-api --update-env 2>&1 | tail -3")
import time; time.sleep(4)

# ── 验证 ────────────────────────────────────────────────────
import urllib.request, json
for ep, method in [
    ("http://localhost:3000/api/price-table/list", "GET"),
    ("http://localhost:3000/api/price-table/countries", "GET"),
    ("http://localhost:3000/api/price-table/channels", "GET"),
]:
    try:
        r = urllib.request.urlopen(ep, timeout=6)
        d = json.loads(r.read())
        if "priceTables" in d: print(f"✅ {ep.split('/')[-1]} → {len(d['priceTables'])} 条")
        elif "countries" in d: print(f"✅ countries → {d['countries']}")
        elif "channels"  in d: print(f"✅ channels  → {d['channels']}")
        else: print(f"✅ {ep} → {d}")
    except Exception as e:
        print(f"❌ {ep.split('/')[-1]} 失败: {e}")

# 测试 calculate
try:
    data = json.dumps({"country": "巴西", "channel": "海运拼柜", "weight": 100, "volume": 0.5}).encode()
    req = urllib.request.Request("http://localhost:3000/api/price-table/calculate", data=data,
                                 headers={"Content-Type": "application/json"}, method="POST")
    r = urllib.request.urlopen(req, timeout=8)
    d = json.loads(r.read())
    if d.get("success"):
        print(f"✅ calculate → {d.get('currency')} {d.get('totalPrice'):.2f} (公式: {d.get('freightFormula','')[:50]})")
    else:
        print(f"⚠️  calculate: {d.get('message')}")
except Exception as e:
    print(f"❌ calculate 失败: {e}")

print("\n" + "="*60)
print("修复完成！")
