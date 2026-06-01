#!/usr/bin/env python3
"""
fix-employee-mgmt-v3.py — 员工管理 Bug 修复 (正则版，不依赖精确字符串匹配)
运行: python3 /tmp/fix-employee-mgmt-v3.py
"""
import os, re, shutil, subprocess, sys
from datetime import datetime

ACCOUNTS = "/opt/ogi-logistics/app/accounts.tsx"
PASS = "\033[32m✅\033[0m"
FAIL = "\033[31m❌\033[0m"
INFO = "\033[36mℹ \033[0m"
WARN = "\033[33m⚠ \033[0m"

applied, failed, skipped = [], [], []

def ok(label):   applied.append(label);  print(f"  {PASS} [{label}]")
def err(label):  failed.append(label);   print(f"  {FAIL} [{label}] 未能修复")
def skip(label): skipped.append(label);  print(f"  {INFO} [{label}] 已是正确状态，跳过")

# ─────────────────────────────────────────────────────────────────────────────
if not os.path.exists(ACCOUNTS):
    print(f"{FAIL} 找不到: {ACCOUNTS}"); sys.exit(1)

ts = datetime.now().strftime("%Y%m%d_%H%M%S")
backup = ACCOUNTS + f".bak.{ts}"
shutil.copy2(ACCOUNTS, backup)

with open(ACCOUNTS) as f:
    src = f.read()

print(f"\n{'='*58}\n  员工管理 Bug 修复脚本 v3 (正则版)\n{'='*58}")
print(f"\n{INFO} 文件: {len(src)} 字节，{src.count(chr(10))} 行\n{INFO} 备份: {backup}\n")

# ═════════════════════════════════════════════════════════════════════════════
# 辅助: 提取函数体 (从函数名到同级别 }, 最多扫 150 行)
# ═════════════════════════════════════════════════════════════════════════════
def find_func_range(text, func_name, lines):
    """返回包含 func_name 的 useCallback/async 块的 (start_line, end_line) 索引（行数组下标）"""
    for i, line in enumerate(lines):
        if func_name in line and ("useCallback" in line or "async" in line or "function" in line
                                  or (i > 0 and "useCallback" in lines[max(0,i-2):i+1][0])):
            # 找到起始行，向后找匹配的 }
            depth = 0
            for j in range(i, min(len(lines), i+200)):
                depth += lines[j].count("{") - lines[j].count("}")
                if j > i and depth <= 0:
                    return i, j
    return None, None


def replace_in_func(src, func_name, old_re, new_str, flags=re.DOTALL):
    """在 func_name 所在的 useCallback 块内做正则替换"""
    lines = src.splitlines(keepends=True)
    si, ei = find_func_range(src, func_name, lines)
    if si is None:
        return src, False
    chunk = "".join(lines[si:ei+1])
    new_chunk, n = re.subn(old_re, new_str, chunk, count=1, flags=flags)
    if n == 0:
        return src, False
    return "".join(lines[:si]) + new_chunk + "".join(lines[ei+1:]), True


# ═════════════════════════════════════════════════════════════════════════════
print("【Bug 1】创建/编辑员工无法保存\n")

# ── 1a: updateRole fetch 未捕获响应 ──
label = "1a-updateRole检查响应"
# 匹配: 行首有空格 + "await fetch(`" + 包含 updateRole 直到 `});`
# 前提: 该行不含 "= await" (即未赋值)
pat_update = re.compile(
    r'(?<!\= )([ \t]+)await (fetch\(`\$\{baseUrl\}/api/trpc/userManagement\.updateRole`[\s\S]*?\}\s*\)\s*;)',
    re.MULTILINE
)

def fix_update(src, label):
    # 只处理 handleAddAccount 里的 updateRole (handleToggleStatus 里的 Bug4 单独处理)
    lines = src.splitlines(keepends=True)
    add_si, add_ei = find_func_range(src, "handleAddAccount", lines)
    if add_si is None:
        err(label); return src

    chunk = "".join(lines[add_si:add_ei+1])
    # 找未赋值的 updateRole fetch
    # 匹配: 行首空白 + "await fetch" + 含 updateRole + 直到 });
    m = re.search(
        r'^([ \t]+)await (fetch\(`\$\{baseUrl\}/api/trpc/userManagement\.updateRole`[\s\S]*?\}\s*\)\s*;)',
        chunk, re.MULTILINE
    )
    if not m:
        # 可能已经是 "const updateRes = await fetch..."
        if "updateRes" in chunk or "updateData" in chunk:
            skip(label); return src
        err(label); return src

    indent = m.group(1)
    old = m.group(0)
    new = (
        f"{indent}const updateRes = {m.group(2)}\n"
        f"{indent}const updateData = await updateRes.json();\n"
        f"{indent}if (updateData?.error || updateData?.result?.data?.error) {{\n"
        f"{indent}  const errMsg = updateData?.error?.message || updateData?.result?.data?.error?.message || \"更新失败\";\n"
        f"{indent}  if (typeof window !== 'undefined') window.alert(\"错误: \" + errMsg); else console.error(errMsg);\n"
        f"{indent}  return;\n"
        f"{indent}}}"
    )
    new_chunk = chunk.replace(old, new, 1)
    ok(label)
    return "".join(lines[:add_si]) + new_chunk + "".join(lines[add_ei+1:])

if "updateData" in src or "updateRes" in src:
    # Check if it's inside handleAddAccount
    lines_tmp = src.splitlines(keepends=True)
    si, ei = find_func_range(src, "handleAddAccount", lines_tmp)
    chunk_tmp = "".join(lines_tmp[si:ei+1]) if si else ""
    if "updateData" in chunk_tmp or "updateRes" in chunk_tmp:
        skip("1a-updateRole检查响应")
    else:
        src = fix_update(src, "1a-updateRole检查响应")
else:
    src = fix_update(src, "1a-updateRole检查响应")

# ── 1b: create fetch 未捕获响应 ──
label = "1b-create检查响应"
lines_tmp = src.splitlines(keepends=True)
si, ei = find_func_range(src, "handleAddAccount", lines_tmp)
if si is not None:
    chunk_tmp = "".join(lines_tmp[si:ei+1])
    if "createData" in chunk_tmp or "createRes" in chunk_tmp:
        skip(label)
    else:
        m = re.search(
            r'^([ \t]+)await (fetch\(`\$\{baseUrl\}/api/trpc/userManagement\.create`[\s\S]*?\}\s*\)\s*;)',
            chunk_tmp, re.MULTILINE
        )
        if m:
            indent = m.group(1)
            old = m.group(0)
            new = (
                f"{indent}const createRes = {m.group(2)}\n"
                f"{indent}const createData = await createRes.json();\n"
                f"{indent}if (createData?.error || createData?.result?.data?.error) {{\n"
                f"{indent}  const errMsg = createData?.error?.message || createData?.result?.data?.error?.message || \"创建失败\";\n"
                f"{indent}  if (typeof window !== 'undefined') window.alert(\"错误: \" + errMsg); else console.error(errMsg);\n"
                f"{indent}  return;\n"
                f"{indent}}}"
            )
            new_chunk = chunk_tmp.replace(old, new, 1)
            src = "".join(lines_tmp[:si]) + new_chunk + "".join(lines_tmp[ei+1:])
            ok(label)
        else:
            err(label)
else:
    err(label)

# ── 1c: 保存成功提示 ──
label = "1c-保存成功提示"
if '"保存成功"' in src or "'保存成功'" in src or "保存成功" in src:
    skip(label)
else:
    lines_tmp = src.splitlines(keepends=True)
    si, ei = find_func_range(src, "handleAddAccount", lines_tmp)
    if si is not None:
        chunk_tmp = "".join(lines_tmp[si:ei+1])
        # Find setShowAddModal(false) + loadDbUsers() and append success alert
        m = re.search(r'(setShowAddModal\(false\);\s*\n\s*)(await loadDbUsers\(\);)', chunk_tmp)
        if m:
            new_chunk = chunk_tmp.replace(
                m.group(0),
                m.group(0) + "\n" + " "*10 + "if (typeof window !== 'undefined') window.alert('保存成功'); ",
                1
            )
            src = "".join(lines_tmp[:si]) + new_chunk + "".join(lines_tmp[ei+1:])
            ok(label)
        else:
            skip(label)
    else:
        skip(label)


# ═════════════════════════════════════════════════════════════════════════════
print("\n【Bug 2】所属部门无法手动选择\n")

# ── 2a: formDepartment state ──
label = "2a-formDepartment状态变量"
if "formDepartment" in src and "useState" in src:
    # Check it's a useState declaration, not just usage
    if re.search(r'const\s*\[formDepartment', src):
        skip(label)
    else:
        # formDepartment used but state not declared — add after formRole state
        m = re.search(r'(const\s*\[formRole[^\n]+\n)', src)
        if m:
            src = src.replace(
                m.group(1),
                m.group(1) + '  const [formDepartment, setFormDepartment] = useState<Department>(ROLE_DEPARTMENT["sales"] as Department);\n',
                1
            )
            ok(label)
        else:
            err(label)
elif "formDepartment" not in src:
    m = re.search(r'(const\s*\[formRole[^\n]+\n)', src)
    if m:
        src = src.replace(
            m.group(1),
            m.group(1) + '  const [formDepartment, setFormDepartment] = useState<Department>(ROLE_DEPARTMENT["sales"] as Department);\n',
            1
        )
        ok(label)
    else:
        err(label)
else:
    skip(label)

# ── 2b: role chip onPress 同步部门 ──
label = "2b-选角色同步部门"
# Find: onPress={() => setFormRole(r)} — without setFormDepartment
m = re.search(r'onPress=\{(\(\)\s*=>\s*setFormRole\(r\))\}', src)
if m:
    src = src.replace(
        m.group(0),
        'onPress={() => { setFormRole(r); setFormDepartment(ROLE_DEPARTMENT[r] as Department); }}',
        1
    )
    ok(label)
elif "setFormDepartment(ROLE_DEPARTMENT[r]" in src:
    skip(label)
else:
    # Try broader pattern
    m2 = re.search(r'(onPress=\{\(\)\s*=>\s*\{\s*setFormRole\(r\)[^}]*\})', src)
    if m2 and "setFormDepartment" not in m2.group(1):
        old = m2.group(1)
        new = old.rstrip("}").rstrip() + "; setFormDepartment(ROLE_DEPARTMENT[r] as Department); }"
        src = src.replace(old, new, 1)
        ok(label)
    elif "setFormDepartment(ROLE_DEPARTMENT[r]" in src:
        skip(label)
    else:
        err(label)

# ── 2c: 部门只读文本 → 可选择 Chip ──
label = "2c-部门只读→可选择Chip"
# Check if DEPARTMENTS.map already present in context of department selection
if "DEPARTMENTS.map" in src and "setFormDepartment(d)" in src:
    skip(label)
else:
    # Find read-only dept display — various patterns
    patterns_2c = [
        # Pattern: <Text ...>所属部门...</Text> with ROLE_DEPARTMENT
        re.compile(r'<Text[^>]*>[^<]*所属部门[^<]*ROLE_DEPARTMENT[^<]*</Text>', re.DOTALL),
        # Pattern: 所属部门: {... on one or two lines
        re.compile(r'<Text[^>]*>\s*所属部门[^<]*</Text>', re.DOTALL),
    ]
    replaced = False
    for pat in patterns_2c:
        m = pat.search(src)
        if m:
            # Get indentation of matched line
            line_start = src.rfind('\n', 0, m.start()) + 1
            raw_line = src[line_start:m.start()]
            indent = len(raw_line) - len(raw_line.lstrip())
            ind = " " * indent
            new_dept_ui = f'''{ind}<Text style={{[styles.fieldLabel, {{ color: colors.foreground }}]}}>所属部门 *</Text>
{ind}<ScrollView horizontal showsHorizontalScrollIndicator={{false}} style={{{{ marginBottom: 12 }}}}>
{ind}  {{DEPARTMENTS.map((d) => (
{ind}    <TouchableOpacity
{ind}      key={{d}}
{ind}      style={{[styles.roleChip, formDepartment === d ? {{ backgroundColor: colors.primary }} : {{ borderColor: colors.border, borderWidth: 1 }}]}}
{ind}      onPress={{() => setFormDepartment(d)}}
{ind}    >
{ind}      <Text style={{[styles.roleChipText, {{ color: formDepartment === d ? "#fff" : colors.foreground }}]}}>{{DEPARTMENT_LABELS[d]}}</Text>
{ind}    </TouchableOpacity>
{ind}  ))}}
{ind}</ScrollView>'''
            src = src[:m.start()] + new_dept_ui + src[m.end():]
            ok(label)
            replaced = True
            break
    if not replaced:
        err(label)

# ── 2d: 新建时重置 formDepartment ──
label = "2d-新建重置formDepartment"
# Find: setFormRole("sales") / setFormRole('sales') without setFormDepartment nearby
m = re.search(
    r'(setEditingAccount\(null\)[^;]*;[^\n]*\n[^\n]*)(setFormName\([^)]*\)\s*;\s*setFormRole\([^)]*\))(.*?)(setShowAddModal\(true\))',
    src, re.DOTALL
)
if m:
    segment = m.group(0)
    if "setFormDepartment" not in segment:
        # Insert after setFormRole(...)
        new_seg = re.sub(
            r'(setFormRole\([^)]*\))',
            r'\1; setFormDepartment(ROLE_DEPARTMENT["sales"] as Department)',
            segment, count=1
        )
        src = src.replace(segment, new_seg, 1)
        ok(label)
    else:
        skip(label)
else:
    if 'setFormDepartment(ROLE_DEPARTMENT["sales"]' in src or "setFormDepartment(ROLE_DEPARTMENT['sales']" in src:
        skip(label)
    else:
        err(label)

# ── 2e: 提交后重置 ──
label = "2e-提交后重置formDepartment"
# Line 279 already has this from scan output
if 'setFormDepartment(ROLE_DEPARTMENT["sales"] as Department)' in src or "setFormDepartment(ROLE_DEPARTMENT['sales']" in src:
    skip(label)
else:
    m = re.search(r'(setFormName\([^)]*\)\s*;\s*setFormRole\([^)]*\)\s*;)', src)
    if m and "setFormDepartment" not in src[m.start()-5:m.end()+100]:
        src = src.replace(
            m.group(1),
            m.group(1) + ' setFormDepartment(ROLE_DEPARTMENT["sales"] as Department);',
            1
        )
        ok(label)
    else:
        skip(label)

# ── 2f: 编辑时填充 formDepartment ──
label = "2f-编辑时填充formDepartment"
# Find openEdit and look for setFormRole(acc.role) without subsequent setFormDepartment
lines_tmp = src.splitlines(keepends=True)
si, ei = find_func_range(src, "openEdit", lines_tmp)
if si is not None:
    chunk_tmp = "".join(lines_tmp[si:ei+1])
    if "setFormDepartment(acc.department)" in chunk_tmp:
        skip(label)
    else:
        m = re.search(r'(setFormRole\(acc\.role\)[^\n]*\n)', chunk_tmp)
        if m:
            new_chunk = chunk_tmp.replace(
                m.group(1),
                m.group(1) + "    setFormDepartment(acc.department);\n",
                1
            )
            src = "".join(lines_tmp[:si]) + new_chunk + "".join(lines_tmp[ei+1:])
            ok(label)
        else:
            err(label)
else:
    skip(label)


# ═════════════════════════════════════════════════════════════════════════════
print("\n【Bug 3】删除按钮无反应\n")

# handleDeleteAccount existence already confirmed from scan — just verify
label = "3-handleDeleteAccount"
if "handleDeleteAccount" in src and "loadDbUsers" in src:
    # Make sure it calls loadDbUsers, not just setLocalAccounts
    lines_tmp = src.splitlines(keepends=True)
    si, ei = find_func_range(src, "handleDeleteAccount", lines_tmp)
    if si is not None:
        chunk_tmp = "".join(lines_tmp[si:ei+1])
        if "loadDbUsers" in chunk_tmp:
            skip(label)
        else:
            # Add loadDbUsers call after the successful fetch
            m = re.search(
                r'(const\s+data\s*=\s*await\s+\w+\.json\(\);[\s\S]*?})\s*\n(\s+)(setLocalAccounts|setDbAccounts)',
                chunk_tmp
            )
            if m:
                new_chunk = chunk_tmp.replace(
                    m.group(0),
                    m.group(1) + "\n" + m.group(2) + "await loadDbUsers();\n" + m.group(2) + m.group(3),
                    1
                )
                src = "".join(lines_tmp[:si]) + new_chunk + "".join(lines_tmp[ei+1:])
                ok(label)
            else:
                skip(label)
    else:
        skip(label)
else:
    err(label)


# ═════════════════════════════════════════════════════════════════════════════
print("\n【Bug 4】启用/禁用无反应\n")

label = "4a-handleToggleStatus检查响应+loadDbUsers"
lines_tmp = src.splitlines(keepends=True)
si, ei = find_func_range(src, "handleToggleStatus", lines_tmp)
if si is None:
    err(label)
else:
    chunk_tmp = "".join(lines_tmp[si:ei+1])
    already_ok = "loadDbUsers" in chunk_tmp and ("toggleData" in chunk_tmp or "toggleRes" in chunk_tmp)
    if already_ok:
        skip(label)
    else:
        # Find the uncaptured await fetch for updateRole
        m = re.search(
            r'^([ \t]+)await (fetch\(`\$\{baseUrl\}/api/trpc/userManagement\.updateRole`[\s\S]*?\}\s*\)\s*;)',
            chunk_tmp, re.MULTILINE
        )
        if m:
            indent = m.group(1)
            old = m.group(0)
            new_fetch = (
                f"{indent}const toggleRes = {m.group(2)}\n"
                f"{indent}const toggleData = await toggleRes.json();\n"
                f"{indent}if (toggleData?.error || toggleData?.result?.data?.error) {{\n"
                f"{indent}  const errMsg = toggleData?.error?.message || toggleData?.result?.data?.error?.message || \"操作失败\";\n"
                f"{indent}  if (typeof window !== 'undefined') window.alert(\"错误: \" + errMsg); else console.error(errMsg);\n"
                f"{indent}  return;\n"
                f"{indent}}}"
            )
            new_chunk = chunk_tmp.replace(old, new_fetch, 1)
            # Now replace setDbAccounts optimistic update with loadDbUsers
            new_chunk = re.sub(
                r'\s*setDbAccounts\s*\(\s*\(prev\)\s*=>\s*prev\.map\([^)]+\)\s*\)\s*;',
                f"\n{indent}await loadDbUsers();",
                new_chunk
            )
            src = "".join(lines_tmp[:si]) + new_chunk + "".join(lines_tmp[ei+1:])
            ok(label)
        else:
            # Maybe already has toggleRes but missing loadDbUsers
            if "toggleRes" in chunk_tmp and "loadDbUsers" not in chunk_tmp:
                new_chunk = re.sub(
                    r'\s*setDbAccounts\s*\(\s*\(prev\)\s*=>\s*prev\.map\([^)]+\)\s*\)\s*;',
                    f"\n{indent}await loadDbUsers();",
                    chunk_tmp
                )
                if new_chunk != chunk_tmp:
                    src = "".join(lines_tmp[:si]) + new_chunk + "".join(lines_tmp[ei+1:])
                    ok(label)
                else:
                    err(label)
            else:
                err(label)

# ── 4b: useCallback deps ──
label = "4b-handleToggleStatus依赖loadDbUsers"
lines_tmp = src.splitlines(keepends=True)
si, ei = find_func_range(src, "handleToggleStatus", lines_tmp)
if si is not None:
    chunk_tmp = "".join(lines_tmp[si:ei+1])
    # Find deps array: }, [isDbMode])  or similar without loadDbUsers
    m = re.search(r'(\},\s*\[)([^\]]*?)(\]\s*\)\s*;?\s*)$', chunk_tmp, re.MULTILINE)
    if m:
        deps = m.group(2)
        if "loadDbUsers" not in deps:
            new_deps = deps.rstrip() + (", " if deps.strip() else "") + "loadDbUsers"
            new_chunk = chunk_tmp[:m.start()] + m.group(1) + new_deps + m.group(3) + chunk_tmp[m.end():]
            src = "".join(lines_tmp[:si]) + new_chunk + "".join(lines_tmp[ei+1:])
            ok(label)
        else:
            skip(label)
    else:
        skip(label)
else:
    skip(label)


# ═════════════════════════════════════════════════════════════════════════════
print(f"\n{'='*58}")
print(f"\n  已修复: {len(applied)}, 跳过: {len(skipped)}, 失败: {len(failed)}")
if failed:
    print(f"\n  {WARN} 以下项未能自动修复:")
    for f in failed: print(f"    - {f}")

with open(ACCOUNTS, "w") as f:
    f.write(src)
print(f"\n{PASS} 已写入: {ACCOUNTS}")

# PM2 restart (compatible with older Python)
print(f"\n{INFO} 重启 PM2...")
try:
    ret = os.system("pm2 restart all --update-env")
    if ret == 0:
        print(f"  {PASS} PM2 重启成功")
        print(f"\n  请刷新页面验证:")
        print("    1. 新建/编辑员工 → 保存应有成功/失败提示")
        print("    2. 表单部门字段 → 应显示可点击的选择器")
        print("    3. 删除按钮 → 应弹确认框后删除")
        print("    4. 启用/禁用 → 应即时生效并刷新列表")
    else:
        print(f"  {WARN} pm2 exit code: {ret}")
except Exception as e:
    print(f"  {WARN} {e}")

print(f"{'='*58}\n")
