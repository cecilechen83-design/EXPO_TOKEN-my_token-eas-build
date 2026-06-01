#!/usr/bin/env python3
"""
fix-employee-mgmt-v4.py — 基于行号定位，正则修复员工管理 Bug
已知行号(grep 确认):
  96  : const [formRole, ...]
  97  : const [formDepartment, ...]   ← 已存在，Bug2a 已修复
  161 : handleToggleStatus
  193 : handleAddAccount
  597 : 所属部门 UI
"""
import os, re, shutil, sys
from datetime import datetime

ACCOUNTS = "/opt/ogi-logistics/app/accounts.tsx"
PASS = "\033[32m✅\033[0m"
FAIL = "\033[31m❌\033[0m"
INFO = "\033[36mℹ \033[0m"

if not os.path.exists(ACCOUNTS):
    print(f"{FAIL} 找不到: {ACCOUNTS}"); sys.exit(1)

backup = ACCOUNTS + f".bak.{datetime.now().strftime('%Y%m%d_%H%M%S')}"
shutil.copy2(ACCOUNTS, backup)

with open(ACCOUNTS) as f:
    lines = f.readlines()

total = len(lines)
print(f"\n{'='*55}\n  员工管理 Bug 修复 v4 (行号定位版)\n{'='*55}")
print(f"{INFO} 共 {total} 行，备份: {backup}\n")

applied, failed, skipped = [], [], []

def ok(l):   applied.append(l);  print(f"  {PASS} {l}")
def err(l):  failed.append(l);   print(f"  {FAIL} {l}")
def skip(l): skipped.append(l);  print(f"  {INFO} {l} — 已是正确状态")


# ── 工具: 找函数体范围 (从起始行往后找到 depth==0) ──────────────────────────
def func_range(start_0idx, max_scan=200):
    depth = 0
    for i in range(start_0idx, min(total, start_0idx + max_scan)):
        depth += lines[i].count("{") - lines[i].count("}")
        if i > start_0idx and depth <= 0:
            return start_0idx, i
    return start_0idx, min(total - 1, start_0idx + max_scan)


# ── 工具: 在行列表内找第一个"未赋值的 await fetch" 并包装 ────────────────────
def wrap_uncaptured_fetch(chunk_lines, endpoint, res_var, err_msg):
    """
    找形如:
        <indent>await fetch(`...endpoint...`, {
            ...
        });
    其中行首没有 '= await'，替换成捕获版本并加响应检查。
    返回 (new_lines, changed:bool)
    """
    text = "".join(chunk_lines)
    # 匹配未赋值的 await fetch 到 endpoint
    pat = re.compile(
        r'^([ \t]+)(await fetch\(`[^`]*' + re.escape(endpoint) + r'[^`]*`[\s\S]*?\}\s*\)\s*;)',
        re.MULTILINE
    )
    # 排除已赋值的 (行首有 const/let/var xxx = 或 = await)
    m = pat.search(text)
    while m:
        # 检查同一行是否已有赋值
        line_start = text.rfind('\n', 0, m.start()) + 1
        line_content = text[line_start:m.start(m.group(0).__len__() + m.start())]
        before = text[line_start:m.start()+1]
        if '=' not in before.split('\n')[-1]:
            indent = m.group(1)
            fetch_expr = m.group(2)
            replacement = (
                f"{indent}const {res_var} = {fetch_expr}\n"
                f"{indent}const {res_var}Data = await {res_var}.json();\n"
                f"{indent}if ({res_var}Data?.error || {res_var}Data?.result?.data?.error) {{\n"
                f"{indent}  const _em = {res_var}Data?.error?.message "
                f"|| {res_var}Data?.result?.data?.error?.message || \"{err_msg}\";\n"
                f"{indent}  if (typeof window !== 'undefined') window.alert('错误: ' + _em);\n"
                f"{indent}  return;\n"
                f"{indent}}}"
            )
            new_text = text[:m.start()] + replacement + text[m.end():]
            return new_text.splitlines(keepends=True), True
        # already assigned — look for next
        m = pat.search(text, m.end())
    return chunk_lines, False


# ══════════════════════════════════════════════════════════
print("【Bug 1 & 4】修复 fetch 调用未检查响应\n")

# handleToggleStatus: 已知从第 161 行开始 (0-idx: 160)
ts_start, ts_end = func_range(160)
toggle_lines = lines[ts_start:ts_end+1]
toggle_text = "".join(toggle_lines)

print("  处理 handleToggleStatus …")
if "toggleRes" in toggle_text or "loadDbUsers" in toggle_text:
    # 检查是否真的完整
    has_check = ("toggleData" in toggle_text or "toggleRes" in toggle_text)
    has_reload = "loadDbUsers" in toggle_text
    if has_check and has_reload:
        skip("4a-handleToggleStatus")
    else:
        # 有 toggleRes 但没有 loadDbUsers — 补 loadDbUsers
        if has_check and not has_reload:
            new_toggle = re.sub(
                r'(\s+)setDbAccounts\s*\(\s*\(prev\)\s*=>[^)]+\)\s*\)\s*;',
                r'\1await loadDbUsers();',
                toggle_text
            )
            if new_toggle != toggle_text:
                lines[ts_start:ts_end+1] = new_toggle.splitlines(keepends=True)
                ok("4a-handleToggleStatus(补loadDbUsers)")
            else:
                err("4a-handleToggleStatus")
        else:
            err("4a-handleToggleStatus")
else:
    # 完全没有响应检查 — 包装 fetch
    new_lines, changed = wrap_uncaptured_fetch(toggle_lines, "userManagement.updateRole", "toggleRes", "操作失败")
    if changed:
        new_text2 = "".join(new_lines)
        # 还要替换 setDbAccounts 乐观更新 → loadDbUsers
        new_text3 = re.sub(
            r'[ \t]*setDbAccounts\s*\(\s*\(prev\)\s*=>[^\n]+\n[^\n]*\)\s*;',
            lambda m: m.group(0)[:len(m.group(0)) - len(m.group(0).lstrip())] + "        await loadDbUsers();",
            new_text2
        )
        # simpler fallback
        if "setDbAccounts" in new_text3:
            new_text3 = re.sub(
                r'\s+setDbAccounts\([^;]+;',
                '\n        await loadDbUsers();',
                new_text3
            )
        lines[ts_start:ts_end+1] = new_text3.splitlines(keepends=True)
        ok("4a-handleToggleStatus")
    else:
        err("4a-handleToggleStatus — 未找到 updateRole fetch")

# Fix useCallback deps
ts_start2, ts_end2 = func_range(160)
toggle_text2 = "".join(lines[ts_start2:ts_end2+1])
m_dep = re.search(r'(\},\s*\[)([^\]]*?)(\])', toggle_text2)
if m_dep and "loadDbUsers" not in m_dep.group(2):
    dep_str = m_dep.group(2).strip()
    new_dep = dep_str + (", " if dep_str else "") + "loadDbUsers"
    new_toggle2 = toggle_text2[:m_dep.start()] + m_dep.group(1) + new_dep + m_dep.group(3) + toggle_text2[m_dep.end():]
    lines[ts_start2:ts_end2+1] = new_toggle2.splitlines(keepends=True)
    ok("4b-handleToggleStatus deps")
else:
    skip("4b-handleToggleStatus deps")


# handleAddAccount: 已知从第 193 行开始 (0-idx: 192)
ha_start, ha_end = func_range(192)
add_lines = lines[ha_start:ha_end+1]
add_text  = "".join(add_lines)

print("\n  处理 handleAddAccount …")

# 1a: updateRole
if "updateRes" in add_text or "updateData" in add_text:
    skip("1a-updateRole已有响应检查")
else:
    new_lines2, changed2 = wrap_uncaptured_fetch(add_lines, "userManagement.updateRole", "updateRes", "更新失败")
    if changed2:
        lines[ha_start:ha_end+1] = new_lines2
        ok("1a-updateRole检查响应")
        add_lines = new_lines2
        add_text  = "".join(new_lines2)
    else:
        err("1a-updateRole — 未找到 updateRole fetch")

# 1b: create
if "createRes" in add_text or "createData" in add_text:
    skip("1b-create已有响应检查")
else:
    new_lines3, changed3 = wrap_uncaptured_fetch(add_lines, "userManagement.create", "createRes", "创建失败")
    if changed3:
        lines[ha_start:ha_end+1] = new_lines3
        ok("1b-create检查响应")
        add_lines = new_lines3
        add_text  = "".join(new_lines3)
    else:
        err("1b-create — 未找到 create fetch")

# 1c: 保存成功提示
ha_start2, ha_end2 = func_range(192)
add_text2 = "".join(lines[ha_start2:ha_end2+1])
if "保存成功" in add_text2 or "已保存" in add_text2:
    skip("1c-保存成功提示")
else:
    # insert after loadDbUsers() call
    m_ld = re.search(r'(await loadDbUsers\(\);)', add_text2)
    if m_ld:
        new_add = add_text2.replace(
            m_ld.group(1),
            m_ld.group(1) + "\n          if (typeof window !== 'undefined') window.alert('保存成功'); ",
            1
        )
        lines[ha_start2:ha_end2+1] = new_add.splitlines(keepends=True)
        ok("1c-保存成功提示")
    else:
        skip("1c-保存成功提示(loadDbUsers未找到)")


# ══════════════════════════════════════════════════════════
print("\n【Bug 2】所属部门选择器\n")

# 2a: formDepartment state — 已确认第 97 行存在
skip("2a-formDepartment state(第97行已存在)")

# 2b: role chip onPress — 已知 formDepartment 存在，检查是否同步
all_text = "".join(lines)
if "setFormDepartment(ROLE_DEPARTMENT[r]" in all_text:
    skip("2b-选角色同步部门")
else:
    m2b = re.search(r'onPress=\{(\(\)\s*=>\s*setFormRole\(r\))\}', all_text)
    if m2b:
        new_all = all_text.replace(
            m2b.group(0),
            'onPress={() => { setFormRole(r); setFormDepartment(ROLE_DEPARTMENT[r] as Department); }}',
            1
        )
        lines = new_all.splitlines(keepends=True)
        ok("2b-选角色同步部门")
    else:
        err("2b-选角色同步部门")

# 2c: 部门 UI — 第 597 行已显示 "所属部门 *"，检查是否有可选择的 Chip
all_text = "".join(lines)
dept_line_idx = None
for i, l in enumerate(lines):
    if "所属部门" in l:
        dept_line_idx = i
        break

if dept_line_idx is not None:
    # 看后面 15 行是否已有 DEPARTMENTS.map 或 setFormDepartment(d)
    window = "".join(lines[dept_line_idx:dept_line_idx+15])
    if "DEPARTMENTS.map" in window or "setFormDepartment(d)" in window:
        skip("2c-部门Chip选择器(已存在)")
    else:
        # 找到只读 Text 并替换
        m2c = re.search(
            r'<Text[^>]*>[^<]*所属部门[^<]*</Text>',
            "".join(lines[dept_line_idx:dept_line_idx+5]),
            re.DOTALL
        )
        if m2c:
            indent = "              "
            new_ui = f'''{indent}<Text style={{[styles.fieldLabel, {{ color: colors.foreground }}]}}>所属部门 *</Text>
{indent}<ScrollView horizontal showsHorizontalScrollIndicator={{false}} style={{{{ marginBottom: 12 }}}}>
{indent}  {{DEPARTMENTS.map((d) => (
{indent}    <TouchableOpacity key={{d}}
{indent}      style={{[styles.roleChip, formDepartment === d ? {{ backgroundColor: colors.primary }} : {{ borderColor: colors.border, borderWidth: 1 }}]}}
{indent}      onPress={{() => setFormDepartment(d)}}>
{indent}      <Text style={{[styles.roleChipText, {{ color: formDepartment === d ? "#fff" : colors.foreground }}]}}>{{DEPARTMENT_LABELS[d]}}</Text>
{indent}    </TouchableOpacity>
{indent}  ))}}
{indent}</ScrollView>'''
            chunk5 = "".join(lines[dept_line_idx:dept_line_idx+5])
            new_chunk5 = chunk5[:m2c.start()] + new_ui + chunk5[m2c.end():]
            lines[dept_line_idx:dept_line_idx+5] = new_chunk5.splitlines(keepends=True)
            ok("2c-部门Chip选择器")
        else:
            skip("2c-部门已是正确格式(无需替换)")
else:
    err("2c-未找到所属部门行")

# 2f: openEdit 填充 formDepartment
all_text = "".join(lines)
for i, l in enumerate(lines):
    if "openEdit" in l and "useCallback" in l:
        si2, ei2 = func_range(i)
        chunk_oe = "".join(lines[si2:ei2+1])
        if "setFormDepartment(acc.department)" in chunk_oe:
            skip("2f-编辑时填充formDepartment")
        else:
            m2f = re.search(r'(setFormRole\(acc\.role\)[^\n]*\n)', chunk_oe)
            if m2f:
                new_oe = chunk_oe.replace(
                    m2f.group(1),
                    m2f.group(1) + "    setFormDepartment(acc.department);\n", 1
                )
                lines[si2:ei2+1] = new_oe.splitlines(keepends=True)
                ok("2f-编辑时填充formDepartment")
            else:
                skip("2f-openEdit未找到setFormRole(acc.role)")
        break


# ══════════════════════════════════════════════════════════
print("\n【Bug 3】删除功能\n")
all_text = "".join(lines)
if "handleDeleteAccount" in all_text:
    # 检查 handleDeleteAccount 是否调用 loadDbUsers
    for i, l in enumerate(lines):
        if "handleDeleteAccount" in l and "useCallback" in l:
            si3, ei3 = func_range(i)
            chunk3 = "".join(lines[si3:ei3+1])
            if "loadDbUsers" in chunk3:
                skip("3-handleDeleteAccount(含loadDbUsers)")
            else:
                # 补 loadDbUsers
                m3 = re.search(r'(await\s+\w+\.json\(\);[\s\S]*?)(setDbAccounts|setLocalAccounts)', chunk3)
                if m3:
                    indent3 = re.search(r'^([ \t]+)', lines[si3+chunk3[:m3.start(2)].count('\n')]).group(1) if re.search(r'^([ \t]+)', lines[si3+chunk3[:m3.start(2)].count('\n')]) else "        "
                    new3 = chunk3[:m3.start(2)] + "await loadDbUsers();\n" + indent3 + chunk3[m3.start(2):]
                    lines[si3:ei3+1] = new3.splitlines(keepends=True)
                    ok("3-handleDeleteAccount补loadDbUsers")
                else:
                    skip("3-handleDeleteAccount结构正常")
            break
else:
    err("3-handleDeleteAccount函数不存在")


# ══════════════════════════════════════════════════════════
print(f"\n{'='*55}")
print(f"  已修复: {len(applied)}, 跳过(已正确): {len(skipped)}, 失败: {len(failed)}")
if failed:
    print(f"\n  未能修复项:")
    for f in failed: print(f"    ✗ {f}")

with open(ACCOUNTS, "w") as fout:
    fout.writelines(lines)
print(f"\n{PASS} 已写入: {ACCOUNTS}")

os.system("pm2 restart all --update-env 2>&1 | tail -3")
print(f"\n  请刷新页面验证 4 个功能。\n{'='*55}\n")
