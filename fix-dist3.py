#!/usr/bin/env python3
"""
修复编译后的 dist/ JS 文件中的两个错误:
1. OPENAI_API_KEY is not configured → 本地规则匹配兜底
2. Storage proxy credentials missing → 本地文件存储兜底
"""
import os, re, shutil, subprocess
from datetime import datetime

# 查找 PM2 运行的实际目录
def find_pm2_app_dir():
    """通过 pm2 list 找到实际运行的应用目录"""
    try:
        result = subprocess.run(["pm2", "list", "--no-ansi"],
                              capture_output=False, timeout=5)
        # PM2 在错误中通常会打印应用路径
    except: pass

    # 尝试几个常见位置
    candidates = [
        "/opt/ogi-logistics",
        "/root/ogi-logistics",
        "/home/*/ogi-logistics",
        os.path.expanduser("~/ogi-logistics"),
    ]

    for base in candidates:
        if os.path.exists(base):
            return base
    return None

DIST = find_pm2_app_dir()
if not DIST:
    print("❌ 无法找到 ogi-logistics 目录")
    import sys; sys.exit(1)

print(f"✅ 使用目录: {DIST}")
ts = datetime.now().strftime("%Y%m%d_%H%M%S")
PASS = "✅"; FAIL = "❌"; INFO = "ℹ "

TARGETS = {
    "OPENAI_API_KEY is not configured": None,
    "Storage proxy credentials missing": None,
}

# 扫描所有 JS 文件
print("\n扫描 JS 文件...")
file_count = 0
for root, dirs, files in os.walk(DIST):
    # 跳过某些目录
    dirs[:] = [d for d in dirs if d not in ("node_modules", ".git", "app", "hooks", "components", "lib", ".next")]
    for fname in files:
        if not fname.endswith(".js"): continue
        file_count += 1
        path = os.path.join(root, fname)
        try:
            with open(path, encoding="utf-8", errors="replace") as f:
                content = f.read()
        except: continue

        for kw in TARGETS:
            if kw in content and TARGETS[kw] is None:
                TARGETS[kw] = (path, content)
                print(f"  {PASS} 找到 [{kw[:40]}...] 在: {path}")

print(f"  扫描了 {file_count} 个 JS 文件")

if not TARGETS["OPENAI_API_KEY is not configured"] and not TARGETS["Storage proxy credentials missing"]:
    print(f"\n{FAIL} 两个错误都未找到。")
    print("   可能原因：")
    print("   1. 编译的 JS 与预期格式不同")
    print("   2. 需要重新编译 TypeScript 源代码")
    print(f"\n尝试重新编译...")
    ret = os.system(f"cd {DIST} && npm run build 2>&1 | tail -10")
    if ret == 0:
        print(f"  {PASS} 编译成功！重新扫描...")
        TARGETS = {
            "OPENAI_API_KEY is not configured": None,
            "Storage proxy credentials missing": None,
        }
        for root, dirs, files in os.walk(DIST):
            dirs[:] = [d for d in dirs if d not in ("node_modules", ".git")]
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
                        print(f"  {PASS} 找到: {path}")
    else:
        print(f"  {FAIL} 编译失败")
        import sys; sys.exit(1)

print()

# ── Fix 1: OPENAI_API_KEY ──────────────────────────────────
kw1 = "OPENAI_API_KEY is not configured"
if TARGETS[kw1]:
    path, content = TARGETS[kw1]
    idx = content.index(kw1)
    ctx = content[max(0,idx-200):idx+150]
    print(f"【错误1: OPENAI 上下文】")
    print(f"{repr(ctx)}\n")

    bak = path + f".bak.{ts}"
    shutil.copy2(path, bak)
    print(f"  备份: {bak}")

    # 本地 AI 匹配函数（单行，最小化）
    LOCAL_AI = "(function(inq,rls){var items=Array.isArray(inq)?inq:(inq.items||[]);var total=0;var out=items.map(function(item){var country=(item.country||item.destinationCountry||'').toLowerCase();var weight=parseFloat(item.weight)||0;var volume=parseFloat(item.volume)||0;var chargeable=Math.max(weight,volume*167);var matched=rls.filter(function(r){var rc=(r.destinationCountry||r.country||r.method||'').toLowerCase();if(rc&&country&&!rc.includes(country)&&!country.includes(rc))return false;var wMin=parseFloat(r.weightMin||0);var wMax=parseFloat(r.weightMax||999999);if(chargeable>0&&(chargeable<wMin||chargeable>wMax))return false;return true;});var rec=null;if(matched.length>0){var best=matched.reduce(function(a,b){return(a.unitPrice||0)<=(b.unitPrice||0)?a:b;});var price=(best.unitPrice||0)*Math.max(chargeable,1);total+=price;rec={transportMethod:best.transportMethod||best.method||'标准运输',totalPrice:price.toFixed(2),currency:best.currency||'RMB',transitTime:best.transitTime||'',reason:'本地规则匹配'+matched.length+'条'};}return{name:item.name,country:item.country,aiQuote:rec?{recommendation:rec,matchedRules:matched.slice(0,3).map(function(r){return{transportMethod:r.transportMethod||r.method||'',currency:r.currency||'RMB',calculatedPrice:((r.unitPrice||0)*Math.max(chargeable,1)).toFixed(2),calculation:r.unitPrice+'x'+chargeable.toFixed(1)+'kg'};}),analysis:'本地规则匹配',warnings:[]}:{analysis:'无匹配规则',warnings:['请检查价格表'],matchedRules:[]}};});return{success:true,currency:'RMB',totalRecommendedPrice:total.toFixed(2),items:out,source:'local'};})(inquiry,rules)"

    new_content = re.sub(
        r'throw\s+new\s+Error\s*\(\s*["`\']?OPENAI_API_KEY is not configured["`\']?\s*\)',
        f'return {LOCAL_AI}',
        content, flags=re.DOTALL | re.MULTILINE
    )

    if new_content == content:
        # 备用: 更宽松的替换
        for q in ['"', "'", '`']:
            old = f'throw new Error({q}OPENAI_API_KEY is not configured{q})'
            if old in content:
                new_content = content.replace(old, f'return {LOCAL_AI}', 1)
                print(f"  使用备用匹配")
                break

    if new_content != content:
        with open(path, "w", encoding="utf-8") as f: f.write(new_content)
        print(f"  {PASS} OPENAI 兜底已应用")
    else:
        print(f"  {FAIL} 替换失败，上下文: {repr(content[idx-50:idx+60])}")
else:
    print(f"  {FAIL} 未找到 OPENAI_API_KEY 错误")

# ── Fix 2: Storage proxy ───────────────────────────────────
kw2 = "Storage proxy credentials missing"
if TARGETS[kw2]:
    path, content = TARGETS[kw2]
    idx = content.index(kw2)
    ctx = content[max(0,idx-200):idx+150]
    print(f"\n【错误2: Storage 上下文】")
    print(f"{repr(ctx)}\n")

    bak = path + f".bak.{ts}"
    if not os.path.exists(bak): shutil.copy2(path, bak)
    print(f"  备份: {bak}")

    # 本地文件存储函数（单行）
    LOCAL_STORE = "(function(k,d){var p=require('path');var f=require('fs');var dir=p.join(__dirname,'..','uploads');try{f.mkdirSync(dir,{recursive:true});}catch(e){}var safe=String(k||Date.now()).replace(/[^a-zA-Z0-9._-]/g,'_');var fp=p.join(dir,safe);var buf=Buffer.isBuffer(d)?d:Buffer.from(String(d),'base64');f.writeFileSync(fp,buf);var base=process.env.SERVER_BASE_URL||'http://localhost:3000';return base+'/uploads/'+safe;})(key,data)"

    new_content = re.sub(
        r'throw\s+new\s+Error\s*\(\s*["`\']?Storage proxy credentials missing[^`"\']*["`\']?\s*\)',
        LOCAL_STORE,
        content, flags=re.DOTALL | re.MULTILINE
    )

    if new_content == content:
        # 备用: 更宽松的替换
        for q in ['"', "'", '`']:
            start_str = f'throw new Error({q}Storage proxy credentials'
            if start_str in content:
                start_idx = content.index(start_str)
                close_idx = content.index(')', start_idx)
                old = content[start_idx:close_idx+1]
                new_content = content.replace(old, LOCAL_STORE, 1)
                print(f"  使用备用匹配")
                break

    if new_content != content:
        with open(path, "w", encoding="utf-8") as f: f.write(new_content)
        print(f"  {PASS} Storage 兜底已应用")

        # 确保 /uploads 目录
        uploads_dir = os.path.join(DIST, "uploads")
        os.makedirs(uploads_dir, exist_ok=True)
        print(f"  {PASS} /uploads 目录已创建")
    else:
        print(f"  {FAIL} 替换失败")
else:
    print(f"  {FAIL} 未找到 Storage 错误")

# ── 重启 PM2 ────────────────────────────────────────────
print(f"\n{INFO} 重启 PM2...")
ret1 = os.system("pm2 restart all --update-env 2>&1 | grep -E '(restarting|started|online|error)'")

import time; time.sleep(5)
print(f"\n{INFO} 验证服务...")
try:
    import urllib.request
    r = urllib.request.urlopen("http://localhost:3000/api/quote-stats", timeout=8)
    print(f"  {PASS} 服务正常 HTTP {r.status}")
except Exception as e:
    print(f"  {FAIL} 服务异常: {e}")

print("="*60 + "\n")
