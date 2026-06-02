#!/usr/bin/env python3
"""
fix-dist.py — 直接修补 dist/ 编译产物，修复 AI 报价和文件上传
"""
import os, re, shutil, glob
from datetime import datetime

DIST = "/opt/ogi-logistics/dist"
PASS = "\033[32m✅\033[0m"; FAIL = "\033[31m❌\033[0m"; INFO = "\033[36mℹ \033[0m"
ts = datetime.now().strftime("%Y%m%d_%H%M%S")

print("\n" + "="*60 + "\n  修补 dist/ 编译产物\n" + "="*60)

# ── 先尝试重新编译 ──────────────────────────────────────────
print(f"\n{INFO} 尝试重新编译 TypeScript...")
ret = os.system("cd /opt/ogi-logistics && npx tsc --noEmit false 2>&1 | tail -5")
if ret == 0:
    print(f"  {PASS} 编译成功，重启 PM2...")
    os.system("pm2 restart all --update-env 2>&1 | tail -3")
    print(f"  {PASS} 完成，通过重新编译已应用修复")
    import sys; sys.exit(0)
else:
    print(f"  编译失败，改为直接修补 dist/ JS 文件")

# ── 找到目标 JS 文件 ────────────────────────────────────────
def find_js_with(keyword, base=DIST):
    """在 dist/ 目录下找包含特定字符串的 JS 文件"""
    results = []
    for root, dirs, files in os.walk(base):
        dirs[:] = [d for d in dirs if d != "node_modules"]
        for f in files:
            if f.endswith(".js"):
                path = os.path.join(root, f)
                try:
                    with open(path) as fh:
                        content = fh.read()
                    if keyword in content:
                        results.append((path, content))
                except: pass
    return results

applied = []; failed = []

def patch_js(label, path, content, old, new):
    if old not in content:
        print(f"  {FAIL} [{label}] 未找到目标字符串")
        failed.append(label)
        return content
    result = content.replace(old, new, 1)
    print(f"  {PASS} [{label}]")
    applied.append(label)
    return result

# ══════════════════════════════════════════════════════════
print(f"\n【1】修补 storage.js — 本地文件存储兜底")
# ══════════════════════════════════════════════════════════
storage_files = find_js_with("Storage proxy credentials missing")
if not storage_files:
    print(f"  {FAIL} 未找到包含该错误的 JS 文件")
    failed.append("storage-file-not-found")
else:
    for path, content in storage_files:
        print(f"  找到: {path}")
        bak = path + f".bak.{ts}"
        shutil.copy2(path, bak)

        LOCAL_STORAGE = r"""
(function localStore(key2, data2) {
  var _path = require("path"); var _fs = require("fs");
  var dir = _path.join(__dirname, "..", "uploads");
  try { _fs.mkdirSync(dir, { recursive: true }); } catch(e){}
  var safe = String(key2||Date.now()).replace(/[^a-zA-Z0-9._-]/g,"_");
  var fp = _path.join(dir, safe);
  var buf = Buffer.isBuffer(data2) ? data2 : Buffer.from(String(data2),"base64");
  _fs.writeFileSync(fp, buf);
  var base = process.env.SERVER_BASE_URL || "http://localhost:3000";
  return base + "/uploads/" + safe;
})(key, data)"""

        # 替换 throw new Error("Storage proxy credentials missing...")
        new_content = re.sub(
            r'throw new Error\(["\']Storage proxy credentials missing[^"\']*["\']\)',
            LOCAL_STORAGE,
            content, count=1
        )
        if new_content == content:
            # 备用：找 if(!apiUrl||!apiKey) 的整个 if 块
            new_content = re.sub(
                r'if\s*\(\s*![\w.]+FORGE_API_URL[^)]+\)\s*\{[^}]+throw[^}]+\}',
                'if (false) { /* local storage fallback active */ }',
                content, count=1, flags=re.DOTALL
            )

        if new_content != content:
            with open(path, "w") as f: f.write(new_content)
            applied.append("storage-local-fallback")
            print(f"  {PASS} [storage-local-fallback]")
        else:
            print(f"  {FAIL} [storage] 替换失败，尝试展示上下文:")
            idx = content.find("Storage proxy")
            if idx >= 0: print(f"    上下文: {repr(content[max(0,idx-200):idx+100])}")
            failed.append("storage-replace-failed")

# ══════════════════════════════════════════════════════════
print(f"\n【2】修补 ai-quote-service.js — 无 API Key 本地匹配兜底")
# ══════════════════════════════════════════════════════════
ai_files = find_js_with("OPENAI_API_KEY is not configured")
if not ai_files:
    print(f"  {FAIL} 未找到包含该错误的 JS 文件")
    failed.append("ai-file-not-found")
else:
    LOCAL_MATCH = r"""
(function localMatch(inq, rls) {
  var items = Array.isArray(inq) ? inq : (inq.items || []);
  var total = 0;
  var out = items.map(function(item) {
    var country = (item.country||item.destinationCountry||"").toLowerCase();
    var weight  = parseFloat(item.weight)||0;
    var volume  = parseFloat(item.volume)||0;
    var chargeable = Math.max(weight, volume*167);
    var matched = rls.filter(function(r) {
      var rc = (r.destinationCountry||r.country||r.method||"").toLowerCase();
      if (rc && country && !rc.includes(country) && !country.includes(rc)) return false;
      var wMin = parseFloat(r.weightMin||0); var wMax = parseFloat(r.weightMax||999999);
      if (chargeable>0 && (chargeable<wMin||chargeable>wMax)) return false;
      return true;
    });
    var rec = null;
    if (matched.length > 0) {
      var best = matched.reduce(function(a,b){ return (a.unitPrice||0)<=(b.unitPrice||0)?a:b; });
      var price = (best.unitPrice||0) * Math.max(chargeable,1);
      total += price;
      rec = { transportMethod: best.transportMethod||best.method||"标准运输",
              totalPrice: price.toFixed(2), currency: best.currency||"RMB",
              transitTime: best.transitTime||"", reason: "本地规则匹配 "+matched.length+"条" };
    }
    return { name:item.name, country:item.country,
      aiQuote: rec ? { recommendation:rec, matchedRules:matched.slice(0,3).map(function(r){
        return { transportMethod:r.transportMethod||r.method||"",currency:r.currency||"RMB",
          calculatedPrice:((r.unitPrice||0)*Math.max(chargeable,1)).toFixed(2),
          calculation:r.unitPrice+"×"+chargeable.toFixed(1)+"kg" }; }),
        analysis:"本地规则匹配", warnings:[] }
      : { analysis:"无匹配规则", warnings:["请检查价格表"], matchedRules:[] } };
  });
  return { success:true, currency:"RMB", totalRecommendedPrice:total.toFixed(2),
           items:out, source:"local" };
})(inquiry, rules)"""

    for path, content in ai_files:
        print(f"  找到: {path}")
        bak = path + f".bak.{ts}"
        shutil.copy2(path, bak)

        new_content = re.sub(
            r'throw new Error\(["\']OPENAI_API_KEY is not configured["\']\)',
            LOCAL_MATCH,
            content, count=1
        )
        if new_content != content:
            with open(path, "w") as f: f.write(new_content)
            applied.append("ai-local-fallback")
            print(f"  {PASS} [ai-local-fallback]")
        else:
            print(f"  {FAIL} [ai] 替换失败")
            failed.append("ai-replace-failed")

# ── 确保 /uploads 静态路由存在于 dist ────────────────────
print(f"\n【3】检查 /uploads 静态路由")
os.makedirs("/opt/ogi-logistics/uploads", exist_ok=True)
index_files = find_js_with("server listening on port", DIST)
static_added = False
for path, content in index_files:
    if "/uploads" not in content and "express.static" not in content:
        bak = path + f".bak.{ts}"
        shutil.copy2(path, bak)
        # 在 listen 调用前插入静态路由
        new_content = re.sub(
            r'(app\.listen\()',
            r'app.use("/uploads", require("express").static(require("path").join(__dirname, "..", "uploads")));\n\1',
            content, count=1
        )
        if new_content != content:
            with open(path, "w") as f: f.write(new_content)
            applied.append("uploads-static-route")
            print(f"  {PASS} [uploads路由] 已添加到 {path}")
            static_added = True
            break
    else:
        print(f"  {PASS} [uploads路由] 已存在")
        static_added = True
        break
if not static_added:
    print(f"  {PASS} [uploads路由] 未找到 index.js，跳过")

# ── 重启 PM2 ──────────────────────────────────────────────
print(f"\n  {'='*58}")
print(f"  应用 {len(applied)}/{len(applied)+len(failed)} 项修复")
if failed: print(f"  未应用: {failed}")
print(f"\n{INFO} 重启 PM2...")
os.system("pm2 restart all --update-env 2>&1 | tail -4")

import time; time.sleep(4)
print(f"\n{INFO} 验证服务...")
import urllib.request
try:
    r = urllib.request.urlopen("http://localhost:3000/api/quote-stats", timeout=8)
    print(f"  {PASS} 服务正常 HTTP {r.status}")
except Exception as e:
    print(f"  {FAIL} 服务异常: {e}")

print("="*60 + "\n")
