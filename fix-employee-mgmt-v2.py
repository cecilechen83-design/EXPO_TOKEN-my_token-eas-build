#!/usr/bin/env python3
"""
fix-employee-mgmt-v2.py — 员工管理 4 个 Bug 修复 (健壮版)
运行方式: python3 /tmp/fix-employee-mgmt-v2.py

修复内容:
  Bug 1 — 创建/编辑员工无法保存 (API 响应未检查, 没有成功/失败提示)
  Bug 2 — 所属部门无法手动选择 (只读文本, 无选择器)
  Bug 3 — 删除按钮无反应 (handleDeleteAccount 函数未定义或缺失)
  Bug 4 — 启用/禁用无反应 (handleToggleStatus 未重载 DB, 未检查响应)
"""
import os, re, shutil, subprocess
from datetime import datetime

ACCOUNTS = "/opt/ogi-logistics/app/accounts.tsx"
PASS = "\033[32m✅\033[0m"
FAIL = "\033[31m❌\033[0m"
INFO = "\033[36mℹ \033[0m"
WARN = "\033[33m⚠ \033[0m"

applied = []
failed  = []
skipped = []

# ─────────────────────────────────────────────────────────────────────────────
def patch(label, content, old, new, required=True):
    """Replace first occurrence of old→new; log result."""
    if old in content:
        count = content.count(old)
        if count > 1:
            print(f"  {WARN} [{label}] {count} 处匹配，仅替换第一处")
        result = content.replace(old, new, 1)
        print(f"  {PASS} [{label}] 已修复")
        applied.append(label)
        return result
    else:
        if required:
            print(f"  {FAIL} [{label}] 未找到目标代码 (可能已修复或版本差异)")
            failed.append(label)
        else:
            print(f"  {INFO} [{label}] 跳过 (目标代码不存在, 可能已处理)")
            skipped.append(label)
        return content


def patch_any(label, content, pairs, required=True):
    """Try multiple (old, new) pairs in order; apply first that matches."""
    for old, new in pairs:
        if old in content:
            count = content.count(old)
            if count > 1:
                print(f"  {WARN} [{label}] {count} 处匹配，仅替换第一处")
            result = content.replace(old, new, 1)
            print(f"  {PASS} [{label}] 已修复")
            applied.append(label)
            return result
    if required:
        print(f"  {FAIL} [{label}] 所有候选模式均未找到")
        failed.append(label)
    else:
        print(f"  {INFO} [{label}] 跳过 (所有候选模式均不存在)")
        skipped.append(label)
    return content


def ensure_present(label, content, marker, insert_before, code):
    """Insert code before marker only if code is NOT already present."""
    if code.strip()[:40] in content:
        print(f"  {INFO} [{label}] 已存在，跳过")
        skipped.append(label)
        return content
    if marker not in content:
        print(f"  {FAIL} [{label}] 未找到插入锚点")
        failed.append(label)
        return content
    result = content.replace(marker, code + marker, 1)
    print(f"  {PASS} [{label}] 已插入")
    applied.append(label)
    return result

# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("  员工管理 Bug 修复脚本 v2")
print("="*60)

if not os.path.exists(ACCOUNTS):
    print(f"\n{FAIL} 找不到文件: {ACCOUNTS}")
    raise SystemExit(1)

# Backup
ts = datetime.now().strftime("%Y%m%d_%H%M%S")
backup = ACCOUNTS + f".bak.{ts}"
shutil.copy2(ACCOUNTS, backup)
print(f"\n{PASS} 已备份: {backup}")

with open(ACCOUNTS) as f:
    src = f.read()
print(f"{INFO} 读取完成 ({len(src)} 字节, ~{src.count(chr(10))} 行)\n")

# ═════════════════════════════════════════════════════════════════════════════
print("【Bug 1】修复: 创建/编辑员工无法保存 (API 响应未检查)")

# 1a — updateRole in handleAddAccount (update path)
src = patch_any(
    "1a-updateRole检查响应",
    src,
    [
        # Pattern A: original (no response check)
        (
            '''          await fetch(`${baseUrl}/api/trpc/userManagement.updateRole`, {
            method: "POST",
            headers,
            credentials: "include",
            body: JSON.stringify({ json: {
              id: editingAccount.dbId,
              appRole: formRole,
              department: ROLE_DEPARTMENT[formRole],
              name: formName.trim(),
              phone: formPhone.trim() || undefined,
              email: formEmail.trim() || undefined,
            } }),
          });''',
            '''          const updateRes = await fetch(`${baseUrl}/api/trpc/userManagement.updateRole`, {
            method: "POST",
            headers,
            credentials: "include",
            body: JSON.stringify({ json: {
              id: editingAccount.dbId,
              appRole: formRole,
              department: formDepartment || ROLE_DEPARTMENT[formRole],
              name: formName.trim(),
              phone: formPhone.trim() || undefined,
              email: formEmail.trim() || undefined,
            } }),
          });
          const updateData = await updateRes.json();
          if (updateData?.error || updateData?.result?.data?.error) {
            const errMsg = updateData?.error?.message || updateData?.result?.data?.error?.message || "更新失败";
            if (Platform.OS === "web") window.alert("错误: " + errMsg); else Alert.alert("错误", errMsg);
            return;
          }'''
        ),
        # Pattern B: already uses formDepartment but no response check
        (
            '''          await fetch(`${baseUrl}/api/trpc/userManagement.updateRole`, {
            method: "POST",
            headers,
            credentials: "include",
            body: JSON.stringify({ json: {
              id: editingAccount.dbId,
              appRole: formRole,
              department: formDepartment || ROLE_DEPARTMENT[formRole],
              name: formName.trim(),
              phone: formPhone.trim() || undefined,
              email: formEmail.trim() || undefined,
            } }),
          });''',
            '''          const updateRes = await fetch(`${baseUrl}/api/trpc/userManagement.updateRole`, {
            method: "POST",
            headers,
            credentials: "include",
            body: JSON.stringify({ json: {
              id: editingAccount.dbId,
              appRole: formRole,
              department: formDepartment || ROLE_DEPARTMENT[formRole],
              name: formName.trim(),
              phone: formPhone.trim() || undefined,
              email: formEmail.trim() || undefined,
            } }),
          });
          const updateData = await updateRes.json();
          if (updateData?.error || updateData?.result?.data?.error) {
            const errMsg = updateData?.error?.message || updateData?.result?.data?.error?.message || "更新失败";
            if (Platform.OS === "web") window.alert("错误: " + errMsg); else Alert.alert("错误", errMsg);
            return;
          }'''
        ),
    ]
)

# 1b — create call in handleAddAccount
src = patch_any(
    "1b-create检查响应",
    src,
    [
        # Pattern A: original with ROLE_DEPARTMENT
        (
            '''          await fetch(`${baseUrl}/api/trpc/userManagement.create`, {
            method: "POST",
            headers,
            credentials: "include",
            body: JSON.stringify({ json: {
              openId,
              name: formName.trim(),
              email: formEmail.trim() || undefined,
              phone: formPhone.trim() || undefined,
              appRole: formRole,
              department: ROLE_DEPARTMENT[formRole],
            } }),
          });''',
            '''          const createRes = await fetch(`${baseUrl}/api/trpc/userManagement.create`, {
            method: "POST",
            headers,
            credentials: "include",
            body: JSON.stringify({ json: {
              openId,
              name: formName.trim(),
              email: formEmail.trim() || undefined,
              phone: formPhone.trim() || undefined,
              appRole: formRole,
              department: formDepartment || ROLE_DEPARTMENT[formRole],
            } }),
          });
          const createData = await createRes.json();
          if (createData?.error || createData?.result?.data?.error) {
            const errMsg = createData?.error?.message || createData?.result?.data?.error?.message || "创建失败";
            if (Platform.OS === "web") window.alert("错误: " + errMsg); else Alert.alert("错误", errMsg);
            return;
          }'''
        ),
        # Pattern B: already uses formDepartment but no response check
        (
            '''          await fetch(`${baseUrl}/api/trpc/userManagement.create`, {
            method: "POST",
            headers,
            credentials: "include",
            body: JSON.stringify({ json: {
              openId,
              name: formName.trim(),
              email: formEmail.trim() || undefined,
              phone: formPhone.trim() || undefined,
              appRole: formRole,
              department: formDepartment || ROLE_DEPARTMENT[formRole],
            } }),
          });''',
            '''          const createRes = await fetch(`${baseUrl}/api/trpc/userManagement.create`, {
            method: "POST",
            headers,
            credentials: "include",
            body: JSON.stringify({ json: {
              openId,
              name: formName.trim(),
              email: formEmail.trim() || undefined,
              phone: formPhone.trim() || undefined,
              appRole: formRole,
              department: formDepartment || ROLE_DEPARTMENT[formRole],
            } }),
          });
          const createData = await createRes.json();
          if (createData?.error || createData?.result?.data?.error) {
            const errMsg = createData?.error?.message || createData?.result?.data?.error?.message || "创建失败";
            if (Platform.OS === "web") window.alert("错误: " + errMsg); else Alert.alert("错误", errMsg);
            return;
          }'''
        ),
    ]
)

# 1c — add success alert after setShowAddModal(false) / loadDbUsers()
# Only add if neither createData nor a success alert is already present
if 'window.alert("保存成功")' not in src and '"保存成功"' not in src:
    src = patch_any(
        "1c-保存成功提示",
        src,
        [
            (
                'setShowAddModal(false);\n          await loadDbUsers();',
                'setShowAddModal(false);\n          await loadDbUsers();\n          if (Platform.OS === "web") window.alert("保存成功"); else Alert.alert("成功", "已保存");'
            ),
            (
                'setShowAddModal(false);\n        await loadDbUsers();',
                'setShowAddModal(false);\n        await loadDbUsers();\n          if (Platform.OS === "web") window.alert("保存成功"); else Alert.alert("成功", "已保存");'
            ),
        ],
        required=False
    )

# ═════════════════════════════════════════════════════════════════════════════
print("\n【Bug 2】修复: 所属部门无法手动选择")

# 2a — add formDepartment state variable
src = patch_any(
    "2a-formDepartment状态变量",
    src,
    [
        (
            '  const [formRole, setFormRole] = useState<UserRole>("sales");\n  const [formPhone',
            '  const [formRole, setFormRole] = useState<UserRole>("sales");\n  const [formDepartment, setFormDepartment] = useState<Department>(ROLE_DEPARTMENT["sales"] as Department);\n  const [formPhone'
        ),
        (
            "  const [formRole, setFormRole] = useState<UserRole>('sales');\n  const [formPhone",
            "  const [formRole, setFormRole] = useState<UserRole>('sales');\n  const [formDepartment, setFormDepartment] = useState<Department>(ROLE_DEPARTMENT['sales'] as Department);\n  const [formPhone"
        ),
    ]
)

# 2b — role chips sync department default
src = patch_any(
    "2b-选角色同步部门默认值",
    src,
    [
        (
            '                    onPress={() => setFormRole(r)}',
            '                    onPress={() => { setFormRole(r); setFormDepartment(ROLE_DEPARTMENT[r] as Department); }}'
        ),
    ]
)

# 2c — replace read-only department text with selectable chips
src = patch_any(
    "2c-部门只读→可选择",
    src,
    [
        # Pattern A: original read-only text
        (
            '              <Text style={[styles.fieldLabel, { color: colors.muted }]}>\n                所属部门: {DEPARTMENT_LABELS[ROLE_DEPARTMENT[formRole]]}\n              </Text>',
            '''              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>所属部门 *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {DEPARTMENTS.map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.roleChip, formDepartment === d ? { backgroundColor: colors.primary } : { borderColor: colors.border, borderWidth: 1 }]}
                    onPress={() => setFormDepartment(d)}
                  >
                    <Text style={[styles.roleChipText, { color: formDepartment === d ? "#fff" : colors.foreground }]}>{DEPARTMENT_LABELS[d]}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>'''
        ),
        # Pattern B: slightly different spacing
        (
            '              <Text style={[styles.fieldLabel, { color: colors.muted }]}>\n                所属部门: {DEPARTMENT_LABELS[ROLE_DEPARTMENT[formRole]]}\n              </Text>\n',
            '''              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>所属部门 *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {DEPARTMENTS.map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.roleChip, formDepartment === d ? { backgroundColor: colors.primary } : { borderColor: colors.border, borderWidth: 1 }]}
                    onPress={() => setFormDepartment(d)}
                  >
                    <Text style={[styles.roleChipText, { color: formDepartment === d ? "#fff" : colors.foreground }]}>{DEPARTMENT_LABELS[d]}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
'''
        ),
    ]
)

# 2d — reset formDepartment when opening "new account" modal
src = patch_any(
    "2d-新建时重置formDepartment",
    src,
    [
        (
            'setEditingAccount(null); setFormName(""); setFormRole("sales"); setFormPhone(""); setFormEmail(""); setShowAddModal(true);',
            'setEditingAccount(null); setFormName(""); setFormRole("sales"); setFormDepartment(ROLE_DEPARTMENT["sales"] as Department); setFormPhone(""); setFormEmail(""); setShowAddModal(true);'
        ),
        (
            "setEditingAccount(null); setFormName(''); setFormRole('sales'); setFormPhone(''); setFormEmail(''); setShowAddModal(true);",
            "setEditingAccount(null); setFormName(''); setFormRole('sales'); setFormDepartment(ROLE_DEPARTMENT['sales'] as Department); setFormPhone(''); setFormEmail(''); setShowAddModal(true);"
        ),
    ]
)

# 2e — reset formDepartment after form submit
src = patch_any(
    "2e-提交后重置formDepartment",
    src,
    [
        (
            'setFormName(""); setFormRole("sales"); setFormPhone(""); setFormEmail("");',
            'setFormName(""); setFormRole("sales"); setFormDepartment(ROLE_DEPARTMENT["sales"] as Department); setFormPhone(""); setFormEmail("");'
        ),
        (
            "setFormName(''); setFormRole('sales'); setFormPhone(''); setFormEmail('');",
            "setFormName(''); setFormRole('sales'); setFormDepartment(ROLE_DEPARTMENT['sales'] as Department); setFormPhone(''); setFormEmail('');"
        ),
    ]
)

# 2f — fill formDepartment when opening edit modal
src = patch_any(
    "2f-编辑时填充formDepartment",
    src,
    [
        (
            '    setFormName(acc.name);\n    setFormRole(acc.role);\n    setFormPhone',
            '    setFormName(acc.name);\n    setFormRole(acc.role);\n    setFormDepartment(acc.department);\n    setFormPhone'
        ),
        (
            '    setFormName(acc.name)\n    setFormRole(acc.role)\n    setFormPhone',
            '    setFormName(acc.name)\n    setFormRole(acc.role)\n    setFormDepartment(acc.department)\n    setFormPhone'
        ),
    ]
)

# ═════════════════════════════════════════════════════════════════════════════
print("\n【Bug 3】修复: 删除按钮无反应 (handler 函数缺失)")

DELETE_HANDLER = '''
  const handleDeleteAccount = useCallback(async (acc: DisplayAccount) => {
    const confirmMsg = `确认删除账号 "${acc.name}"？此操作不可撤销。`;
    if (Platform.OS === "web") {
      if (!window.confirm(confirmMsg)) return;
    } else {
      let cancelled = false;
      await new Promise<void>((resolve) => {
        Alert.alert("确认删除", confirmMsg, [
          { text: "取消", style: "cancel", onPress: () => { cancelled = true; resolve(); } },
          { text: "删除", style: "destructive", onPress: () => resolve() },
        ]);
      });
      if (cancelled) return;
    }
    if (isDbMode && acc.dbId) {
      try {
        const baseUrl = getApiBaseUrl();
        const token = await Auth.getSessionToken();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch(`${baseUrl}/api/trpc/userManagement.updateRole`, {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({ json: { id: acc.dbId, status: "deleted" } }),
        });
        const data = await res.json();
        if (data?.error || data?.result?.data?.error) {
          const errMsg = data?.error?.message || data?.result?.data?.error?.message || "删除失败";
          if (Platform.OS === "web") window.alert("错误: " + errMsg); else Alert.alert("错误", errMsg);
          return;
        }
        await loadDbUsers();
        if (Platform.OS === "web") window.alert("已删除"); else Alert.alert("成功", "已删除");
      } catch (err: any) {
        const msg = `删除失败: ${err?.message || String(err)}`;
        if (Platform.OS === "web") window.alert(msg); else Alert.alert("错误", msg);
      }
    } else {
      setLocalAccounts((prev) => prev.filter((a) => a.id !== acc.id));
    }
  }, [isDbMode, loadDbUsers]);

'''

# Ensure handleDeleteAccount is present (insert before openEdit if missing)
src = ensure_present(
    "3a-handleDeleteAccount函数",
    src,
    '  const openEdit = useCallback((acc: DisplayAccount) => {',
    '  const openEdit = useCallback((acc: DisplayAccount) => {',
    DELETE_HANDLER
)

# 3b — add delete button in the card actions row (only if not already there)
if 'handleDeleteAccount(item)' not in src:
    src = patch_any(
        "3b-卡片删除按钮",
        src,
        [
            # Pattern A: after the toggle status button (the full button block)
            (
                '''                            <TouchableOpacity
                              style={[styles.actionBtn, { backgroundColor: item.status === "active" ? colors.error + "10" : colors.success + "10" }]}
                              onPress={() => handleToggleStatus(item)}
                            >
                              <Text style={[styles.actionText, { color: item.status === "active" ? colors.error : colors.success }]}>
                                {item.status === "active" ? "禁用" : "启用"}
                              </Text>
                            </TouchableOpacity>''',
                '''                            <TouchableOpacity
                              style={[styles.actionBtn, { backgroundColor: item.status === "active" ? colors.error + "10" : colors.success + "10" }]}
                              onPress={() => handleToggleStatus(item)}
                            >
                              <Text style={[styles.actionText, { color: item.status === "active" ? colors.error : colors.success }]}>
                                {item.status === "active" ? "禁用" : "启用"}
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.actionBtn, { backgroundColor: colors.error + "15" }]}
                              onPress={() => handleDeleteAccount(item)}
                            >
                              <Text style={[styles.actionText, { color: colors.error }]}>删除</Text>
                            </TouchableOpacity>'''
                ),
            # Pattern B: single-line onPress style
            (
                'onPress={() => handleToggleStatus(item)}',
                'onPress={() => handleToggleStatus(item)}'  # placeholder — handled below
            ),
        ],
        required=False
    )
else:
    print(f"  {INFO} [3b-卡片删除按钮] 按钮已存在，跳过")
    skipped.append("3b-卡片删除按钮")

# ═════════════════════════════════════════════════════════════════════════════
print("\n【Bug 4】修复: 启用/禁用无反应 (handleToggleStatus 未检查响应/未重载)")

src = patch_any(
    "4a-handleToggleStatus检查响应+重载",
    src,
    [
        # Pattern A: original — no response check, uses setDbAccounts
        (
            '''        await fetch(`${baseUrl}/api/trpc/userManagement.updateRole`, {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({ json: { id: acc.dbId, status: newStatus } }),
        });
        setDbAccounts((prev) => prev.map((a) =>
          a.id === acc.id ? { ...a, status: newStatus } : a
        ));''',
            '''        const toggleRes = await fetch(`${baseUrl}/api/trpc/userManagement.updateRole`, {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({ json: { id: acc.dbId, status: newStatus } }),
        });
        const toggleData = await toggleRes.json();
        if (toggleData?.error || toggleData?.result?.data?.error) {
          const errMsg = toggleData?.error?.message || toggleData?.result?.data?.error?.message || "操作失败";
          if (Platform.OS === "web") window.alert("错误: " + errMsg); else Alert.alert("错误", errMsg);
          return;
        }
        await loadDbUsers();'''
        ),
        # Pattern B: already has toggleRes but setDbAccounts (no loadDbUsers)
        (
            '''        const toggleRes = await fetch(`${baseUrl}/api/trpc/userManagement.updateRole`, {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({ json: { id: acc.dbId, status: newStatus } }),
        });
        setDbAccounts((prev) => prev.map((a) =>
          a.id === acc.id ? { ...a, status: newStatus } : a
        ));''',
            '''        const toggleRes = await fetch(`${baseUrl}/api/trpc/userManagement.updateRole`, {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({ json: { id: acc.dbId, status: newStatus } }),
        });
        const toggleData = await toggleRes.json();
        if (toggleData?.error || toggleData?.result?.data?.error) {
          const errMsg = toggleData?.error?.message || toggleData?.result?.data?.error?.message || "操作失败";
          if (Platform.OS === "web") window.alert("错误: " + errMsg); else Alert.alert("错误", errMsg);
          return;
        }
        await loadDbUsers();'''
        ),
    ]
)

# 4b — fix useCallback deps for handleToggleStatus
src = patch_any(
    "4b-handleToggleStatus依赖loadDbUsers",
    src,
    [
        # Various patterns for the closing of handleToggleStatus useCallback
        (
            '  }, [isDbMode]);\n\n  const openEdit',
            '  }, [isDbMode, loadDbUsers]);\n\n  const openEdit'
        ),
        (
            '  }, [isDbMode]);\n\n  const handleDeleteAccount',
            '  }, [isDbMode, loadDbUsers]);\n\n  const handleDeleteAccount'
        ),
        (
            '  }, [isDbMode]);\n\n  const handleAdd',
            '  }, [isDbMode, loadDbUsers]);\n\n  const handleAdd'
        ),
    ],
    required=False
)

# ═════════════════════════════════════════════════════════════════════════════
print("\n" + "="*60)
total = len(applied) + len(failed) + len(skipped)
print(f"\n  已修复: {len(applied)}/{total}")
if skipped:
    print(f"  已跳过: {len(skipped)} 项 (代码已是正确状态)")
if failed:
    print(f"\n  {WARN} {len(failed)} 项未能匹配:")
    for f in failed:
        print(f"    - {f}")
    print("\n  建议: 检查 accounts.tsx 对应位置并手动修改，或联系开发者提供最新代码片段。")

# Write back
with open(ACCOUNTS, "w") as f:
    f.write(src)
print(f"\n{PASS} 已写入: {ACCOUNTS}")
print(f"{INFO} 备份位置: {backup}")

# PM2 restart
print(f"\n{INFO} 重启 PM2 服务...")
try:
    r = subprocess.run(
        ["pm2", "restart", "all", "--update-env"],
        capture_output=True, text=True, timeout=30
    )
    if r.returncode == 0:
        print(f"  {PASS} PM2 重启成功")
        print("\n  ✅ 完成! 请刷新页面测试以下功能:")
        print("     1. 新建员工 → 应显示保存成功提示")
        print("     2. 表单中所属部门 → 应出现可点击的部门选择器")
        print("     3. 删除按钮 → 应弹出确认对话框后删除")
        print("     4. 启用/禁用 → 应即时生效并刷新列表")
    else:
        print(f"  {WARN} PM2 输出: {r.stderr.strip() or r.stdout.strip()}")
except FileNotFoundError:
    print(f"  {WARN} pm2 未找到，请手动重启: pm2 restart all")
except Exception as e:
    print(f"  {FAIL} PM2 重启失败: {e}")

print("="*60 + "\n")
