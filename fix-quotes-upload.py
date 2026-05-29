#!/usr/bin/env python3
"""
fix-quotes-upload.py  —  诊断并修复 /quotes 报价产品模块的文件上传问题
运行: python3 /tmp/fix-quotes-upload.py
"""
import os, re, shutil, subprocess
from datetime import datetime

QUOTES = "/opt/ogi-logistics/app/quotes.tsx"
PASS = "\033[32m✅\033[0m"
FAIL = "\033[31m❌\033[0m"
INFO = "\033[36mℹ \033[0m"
WARN = "\033[33m⚠ \033[0m"

print("\n" + "="*60)
print("  报价产品(quotes.tsx) 上传修复脚本")
print("="*60)

if not os.path.exists(QUOTES):
    print(f"\n{FAIL} 文件不存在: {QUOTES}")
    print("  请确认服务器路径是否正确")
    import sys; sys.exit(1)

# ── 读文件 ────────────────────────────────────────────────────
with open(QUOTES) as f:
    src = f.read()
lines = src.split("\n")
print(f"\n{INFO} 读取完成: {len(lines)} 行, {len(src)} 字节")

# ── 诊断 ──────────────────────────────────────────────────────
print(f"\n【诊断】文件上传相关代码")
upload_lines = []
for i, line in enumerate(lines):
    if any(kw in line for kw in [
        "input.click()", "createElement(\"input\")", "type = \"file\"",
        "arrayBuffer", "uploadPrice", "handleUpload", "file.name",
        "document.body.append", "FileReader", "input.accept",
        "上传", "upload", ".xls", ".csv", ".pdf"
    ]):
        upload_lines.append((i+1, line.rstrip()))

print(f"  找到 {len(upload_lines)} 行相关代码:")
for lno, ltext in upload_lines:
    print(f"  L{lno:4d}: {ltext[:120]}")

# ── 检测具体问题 ──────────────────────────────────────────────
print(f"\n【检查】已知问题模式")

issues = []

# Issue 1: input.click() 未挂载到 DOM
click_without_append = bool(
    re.search(r'input\.click\(\)', src) and
    not re.search(r'document\.body\.appendChild\(input\)', src)
)
if click_without_append:
    print(f"  {FAIL} 发现: input.click() 调用但未挂载到 DOM — 部分浏览器文件选择框不会弹出")
    issues.append("dom_mount")
else:
    print(f"  {PASS} input.click() DOM 挂载: 正常")

# Issue 2: onchange 而非 addEventListener
uses_onchange = bool(re.search(r'input\.onchange\s*=', src))
if uses_onchange:
    print(f"  {WARN} 使用 input.onchange = — Safari 偶有兼容性问题，建议 addEventListener")
    issues.append("onchange")
else:
    print(f"  {PASS} 事件绑定方式: 正常")

# Issue 3: 无 API 上传调用（只有本地预览，没有保存到服务端）
has_api_call = bool(re.search(r'api\.|fetch\(|axios\.|uploadPrice|/api/', src))
if not has_api_call:
    print(f"  {FAIL} 未找到 API 上传调用 — 文件只本地解析，没有保存到服务器")
    issues.append("no_api")
else:
    print(f"  {PASS} API 上传调用: 找到")

# Issue 4: 检查是否只有 Excel 解析但没有提交按钮
has_confirm_upload = bool(re.search(r'confirmUpload|handleConfirmUpload|确认上传|生效', src))
if not has_confirm_upload:
    print(f"  {WARN} 未找到[确认上传]逻辑 — 可能只有本地预览，缺少提交到服务器的步骤")
    issues.append("no_confirm")
else:
    print(f"  {PASS} 确认上传逻辑: 找到")

# ── 打印关键函数代码（供确认） ─────────────────────────────────
print(f"\n【关键代码】文件上传函数内容")
in_upload_fn = False
brace_depth = 0
fn_lines = []
for i, line in enumerate(lines):
    if re.search(r'(handleFileUpload|handleUpload|uploadPrice|onFileUpload)\s*=', line) and 'useCallback' in line or \
       re.search(r'const\s+(handleFileUpload|handleUpload|uploadPrice)\s*=', line):
        in_upload_fn = True
        brace_depth = 0
        fn_lines = [(i+1, line)]
        continue
    if in_upload_fn:
        fn_lines.append((i+1, line))
        brace_depth += line.count('{') - line.count('}')
        if brace_depth <= 0 and len(fn_lines) > 3:
            break

if fn_lines:
    for lno, ltext in fn_lines[:60]:
        print(f"  L{lno:4d}: {ltext}")
else:
    print(f"  {WARN} 未找到上传函数，下面显示包含 'upload' 的前 20 行函数定义:")
    count = 0
    for i, line in enumerate(lines):
        if 'upload' in line.lower() and ('const ' in line or 'function ' in line or 'async' in line):
            print(f"  L{i+1:4d}: {line}")
            count += 1
            if count >= 20: break

# ── 应用修复 ──────────────────────────────────────────────────
if not issues:
    print(f"\n{PASS} 未发现已知问题，代码结构正常")
    print(f"  如果上传仍失败，请检查 API 响应（打开浏览器 F12 → Network 查看请求）")
else:
    print(f"\n【修复】应用 {len(issues)} 项修复")
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup = QUOTES + f".bak.{ts}"
    shutil.copy2(QUOTES, backup)
    print(f"  {PASS} 已备份: {backup}")

    patched = src

    # Fix 1: input.click() DOM 挂载
    if "dom_mount" in issues:
        # 找到所有 input.click() 前面的代码块，添加 body.appendChild
        # 在 input.accept = ... 行之后、input.onchange = 之前插入 appendChild
        # 在 input.click() 后面或 input.onchange 末尾添加 removeChild

        # Pattern: document.createElement("input") ... input.click()
        # Fix: 在 input.type = "file" 行后添加 document.body.appendChild
        #      在 input.click() 前确认已 append
        patched = re.sub(
            r'(input\.accept\s*=\s*[^\n]+\n)',
            r'\1    input.style.cssText = "position:fixed;top:-100px;left:-100px;opacity:0;";\n    document.body.appendChild(input);\n',
            patched,
            count=0  # fix all occurrences
        )

        # 在 onchange 处理完后 removeChild
        # 在第一行取到 file 后加 removeChild
        patched = re.sub(
            r'(input\.onchange\s*=\s*async\s*\([^)]*\)\s*=>\s*\{[^\n]*\n\s*)(const file)',
            r'\1document.body.removeChild(input);\n      const file',
            patched
        )
        # 备用: addEventListener 方式
        patched = re.sub(
            r"(input\.addEventListener\('change',\s*async\s*\([^)]*\)\s*=>\s*\{[^\n]*\n\s*)(const file)",
            r'\1document.body.removeChild(input);\n      const file',
            patched
        )
        print(f"  {PASS} 修复: input.click() — 已添加 DOM 挂载/卸载")

    # Fix 2: onchange → addEventListener (可选，降低优先级)
    if "onchange" in issues:
        # 只在 input.onchange 上加注释说明，不强制改写（改写风险大）
        print(f"  {WARN} input.onchange 兼容性问题：已记录，如 Safari 出现问题可手动改为 addEventListener")

    # 写回
    if patched != src:
        with open(QUOTES, "w") as f:
            f.write(patched)
        print(f"\n{PASS} 已写入: {QUOTES}")

        # PM2 重启
        print(f"\n{INFO} 重启 PM2...")
        ret = os.system("pm2 restart all --update-env 2>&1 | tail -5")
        if ret == 0:
            print(f"  {PASS} PM2 重启完成")
    else:
        print(f"\n{WARN} 代码未发生变化（可能模式不匹配），请查看上面的诊断信息")

# ── 额外：检查 API 路由 ──────────────────────────────────────
print(f"\n【API】检查 /api/price-table 路由...")
for root, dirs, files in os.walk("/opt/ogi-logistics/server"):
    dirs[:] = [d for d in dirs if d not in ["node_modules", ".git"]]
    for fname in files:
        if fname.endswith((".ts", ".js")):
            fpath = os.path.join(root, fname)
            try:
                txt = open(fpath).read()
                if "price-table" in txt or "priceTable" in txt or "uploadPrice" in txt:
                    print(f"  找到: {fpath}")
                    # 显示关键行
                    for j, l in enumerate(txt.split("\n")):
                        if any(kw in l for kw in ["price-table", "uploadPrice", "router.post", "router.put"]):
                            print(f"    L{j+1}: {l.rstrip()[:100]}")
            except:
                pass

print("\n" + "="*60 + "\n")
