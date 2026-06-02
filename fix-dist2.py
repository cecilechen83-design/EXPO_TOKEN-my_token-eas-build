#!/usr/bin/env python3
"""找到 dist/ 里两个错误的精确上下文，然后直接替换"""
import os, re, shutil
from datetime import datetime

DIST = "/opt/ogi-logistics"
ts = datetime.now().strftime("%Y%m%d_%H%M%S")
PASS = "\033[32m✅\033[0m"; FAIL = "\033[31m❌\033[0m"; INFO = "\033[36mℹ \033[0m"

TARGETS = {
    "OPENAI_API_KEY is not configured": None,
    "Storage proxy credentials missing": None,
}

# 扫描所有 JS 文件
print("扫描 dist/ ...")
for root, dirs, files in os.walk(DIST):
    dirs[:] = [d for d in dirs if d not in ("node_modules", ".git", "app", "hooks", "components", "lib")]
    for fname in files:
        if not fname.endswith(".js"): continue
        path = os.path.join(root, fname)
        try:
            with open(path, encoding="utf-8", errors="replace") as f:
                content = f.read()
        except: continue
        for kw in TARGETS:
            if kw in content and TARGETS[kw] is None:
                TARGETS[kw] = (path, content)
                print(f"  找到 [{kw[:30]}...] 在: {path}")

print()

# ── Fix 1: OPENAI_API_KEY ──────────────────────────────────
kw1 = "OPENAI_API_KEY is not configured"
if TARGETS[kw1]:
    path, content = TARGETS[kw1]
    idx = content.index(kw1)
    # 显示上下文（前后各 300 字符）
    ctx = content[max(0,idx-300):idx+100]
    print(f"【OPENAI上下文】\n{repr(ctx)}\n")

    bak = path + f".bak.{ts}"
    shutil.copy2(path, bak)

    LOCAL_AI = """(function(inq,rls){var items=Array.isArray(inq)?inq:(inq.items||[]);var total=0;var out=items.map(function(item){var country=(item.country||item.destinationCountry||"").toLowerCase();var weight=parseFloat(item.weight)||0;var volume=parseFloat(item.volume)||0;var chargeable=Math.max(weight,volume*167);var matched=rls.filter(function(r){var rc=(r.destinationCountry||r.country||r.method||"").toLowerCase();if(rc&&country&&!rc.includes(country)&&!country.includes(rc))return false;var wMin=parseFloat(r.weightMin||0);var wMax=parseFloat(r.weightMax||999999);if(chargeable>0&&(chargeable<wMin||chargeable>wMax))return false;return true;});var rec=null;if(matched.length>0){var best=matched.reduce(function(a,b){return(a.unitPrice||0)<=(b.unitPrice||0)?a:b;});var price=(best.unitPrice||0)*Math.max(chargeable,1);total+=price;rec={transportMethod:best.transportMethod||best.method||"标准运输",totalPrice:price.toFixed(2),currency:best.currency||"RMB",transitTime:best.transitTime||"",reason:"本地规则匹配"+matched.length+"条"};}return{name:item.name,country:item.country,aiQuote:rec?{recommendation:rec,matchedRules:matched.slice(0,3).map(function(r){return{transportMethod:r.transportMethod||r.method||"",currency:r.currency||"RMB",calculatedPrice:((r.unitPrice||0)*Math.max(chargeable,1)).toFixed(2),calculation:r.unitPrice+"x"+chargeable.toFixed(1)+"kg"};}),analysis:"本地规则匹配",warnings:[]}:{analysis:"无匹配规则",warnings:["请检查价格表"],matchedRules:[]}};});return{success:true,currency:"RMB",totalRecommendedPrice:total.toFixed(2),items:out,source:"local"};})(inquiry,rules)"""

    # 替换整个 throw new Error(...) 语句
    # 用正则找到包含这个字符串的整条语句
    new_content = re.sub(
        r'throw\s+new\s+Error\s*\(\s*["`\']OPENAI_API_KEY is not configured["`\']\s*\)',
        'return ' + LOCAL_AI,
        content
    )
    if new_content == content:
        # 备用：直接字符串替换（包括引号变体）
        for q in ['"', "'", '`']:
            old = f'throw new Error({q}OPENAI_API_KEY is not configured{q})'
            if old in content:
                new_content = content.replace(old, 'return ' + LOCAL_AI, 1)
                break

    if new_content != content:
        with open(path, "w", encoding="utf-8") as f: f.write(new_content)
        print(f"  {PASS} OPENAI_API_KEY 兜底已写入: {path}")
    else:
        print(f"  {FAIL} OPENAI 替换失败，精确字符串:")
        print(f"    {repr(content[idx-50:idx+60])}")
else:
    print(f"  {FAIL} 未找到 OPENAI_API_KEY 错误文件")

# ── Fix 2: Storage proxy ───────────────────────────────────
kw2 = "Storage proxy credentials missing"
if TARGETS[kw2]:
    path, content = TARGETS[kw2]
    idx = content.index(kw2)
    ctx = content[max(0,idx-300):idx+100]
    print(f"\n【Storage上下文】\n{repr(ctx)}\n")

    bak = path + f".bak.{ts}"
    if not os.path.exists(bak): shutil.copy2(path, bak)

    LOCAL_STORE = """(function(key2,data2){var _p=require("path");var _f=require("fs");var dir=_p.join(__dirname,"..","uploads");try{_f.mkdirSync(dir,{recursive:true});}catch(e){}var safe=String(key2||Date.now()).replace(/[^a-zA-Z0-9._-]/g,"_");var fp=_p.join(dir,safe);var buf=Buffer.isBuffer(data2)?data2:Buffer.from(String(data2),"base64");_f.writeFileSync(fp,buf);var base=process.env.SERVER_BASE_URL||"http://localhost:3000";return base+"/uploads/"+safe;})(key,data)"""

    new_content = re.sub(
        r'throw\s+new\s+Error\s*\(\s*["`\']Storage proxy credentials missing[^"`\']*["`\']\s*\)',
        LOCAL_STORE,
        content
    )
    if new_content == content:
        for q in ['"', "'", '`']:
            old_start = f'throw new Error({q}Storage proxy credentials missing'
            if old_start in content:
                end_idx = content.index(old_start)
                close = content.index(')', end_idx)
                old = content[end_idx:close+1]
                new_content = content.replace(old, LOCAL_STORE, 1)
                break

    if new_content != content:
        with open(path, "w", encoding="utf-8") as f: f.write(new_content)
        print(f"  {PASS} Storage 兜底已写入: {path}")
        # 同时加 /uploads 静态路由
        os.makedirs("/opt/ogi-logistics/uploads", exist_ok=True)
        # 找 index.js 加 static 路由
        idx_js = os.path.join(DIST, "dist", "index.js")
        if os.path.exists(idx_js):
            with open(idx_js) as f: idx_content = f.read()
            if "/uploads" not in idx_content:
                new_idx = re.sub(
                    r'(app\.listen\()',
                    'app.use("/uploads",require("express").static(require("path").join(__dirname,"..","uploads")));\n\\1',
                    idx_content, count=1
                )
                if new_idx != idx_content:
                    with open(idx_js, "w") as f: f.write(new_idx)
                    print(f"  {PASS} /uploads 静态路由已添加")
    else:
        print(f"  {FAIL} Storage 替换失败")
        print(f"    {repr(content[idx-50:idx+80])}")
else:
    print(f"  {FAIL} 未找到 Storage 错误文件")

# ── 重启并测试 ────────────────────────────────────────────
print(f"\n{INFO} 重启 PM2...")
os.system("pm2 restart all --update-env 2>&1 | tail -3")

import time, urllib.request
time.sleep(5)
try:
    r = urllib.request.urlopen("http://localhost:3000/api/quote-stats", timeout=8)
    print(f"  {PASS} 服务正常 HTTP {r.status}")
except Exception as e:
    print(f"  {FAIL} 服务异常: {e}")

print("完成\n")
