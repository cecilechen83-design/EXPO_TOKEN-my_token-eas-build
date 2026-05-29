#!/usr/bin/env python3
"""
fix-employee-mgmt.py  —  Fix 4 bugs in accounts.tsx (员工管理)
Run on server: python3 /tmp/fix-employee-mgmt.py
"""
import os, re, shutil, subprocess
from datetime import datetime

ACCOUNTS = "/opt/ogi-logistics/app/accounts.tsx"
SYSTEM   = "/opt/ogi-logistics/app/system.tsx"
PASS = "\033[32m✅\033[0m"
FAIL = "\033[31m❌\033[0m"
INFO = "\033[36mℹ \033[0m"
WARN = "\033[33m⚠ \033[0m"

applied = []
failed  = []

def patch(label, content, old, new):
    if old not in content:
        print(f"  {FAIL} [{label}] 未找到目标代码（可能已修复或版本不同）")
        failed.append(label)
        return content
    count = content.count(old)
    if count > 1:
        print(f"  {WARN} [{label}] 找到 {count} 处匹配，仅替换第一处")
    result = content.replace(old, new, 1)
    print(f"  {PASS} [{label}] 已修复")
    applied.append(label)
    return result

# ── Step 0: check TRPC delete endpoint ───────────────────────────────────────
print("\n" + "="*58)
print("  员工管理 Bug 修复脚本")
print("="*58)
print(f"\n{INFO} 检查 userManagement.delete 端点...")
delete_endpoint = "userManagement.delete"
delete_exists = False
for root, dirs, files in os.walk("/opt/ogi-logistics/server"):
    dirs[:] = [d for d in dirs if d != "node_modules"]
    for fname in files:
        if fname.endswith((".ts", ".tsx")):
            fpath = os.path.join(root, fname)
            try:
                txt = open(fpath).read()
                if "userManagement" in txt and ".delete" in txt:
                    print(f"  {PASS} 找到 delete 端点: {fpath}")
                    delete_exists = True
                    break
            except:
                pass
    if delete_exists:
        break
if not delete_exists:
    print(f"  {WARN} 未找到 userManagement.delete — 删除按钮将调用 updateRole(status=deleted) 或跳过")

# ── Step 1: backup ────────────────────────────────────────────────────────────
print(f"\n{INFO} 备份 accounts.tsx ...")
ts = datetime.now().strftime("%Y%m%d_%H%M%S")
backup = ACCOUNTS + f".bak.{ts}"
shutil.copy2(ACCOUNTS, backup)
print(f"  {PASS} 备份: {backup}")

# ── Step 2: read ─────────────────────────────────────────────────────────────
with open(ACCOUNTS) as f:
    src = f.read()

print(f"\n{INFO} 读取完成 ({len(src)} 字节, ~{src.count(chr(10))} 行)")

# ═══════════════════════════════════════════════════════════════════════════════
print("\n【1】修复: 新建员工无法保存 (TRPC 响应未检查)")
# ── 1a: fix update call in handleAddAccount ──────────────────────────────────
src = patch(
    "1a-更新员工(updateRole)检查响应",
    src,
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
)

# ── 1b: fix create call in handleAddAccount ───────────────────────────────────
src = patch(
    "1b-新建员工(create)检查响应",
    src,
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
)

# ═══════════════════════════════════════════════════════════════════════════════
print("\n【2】修复: 新增岗位后无法手动选择所属部门")
# ── 2a: add formDepartment state ──────────────────────────────────────────────
src = patch(
    "2a-添加formDepartment状态",
    src,
    '  const [formRole, setFormRole] = useState<UserRole>("sales");\n  const [formPhone',
    '  const [formRole, setFormRole] = useState<UserRole>("sales");\n  const [formDepartment, setFormDepartment] = useState<Department>(ROLE_DEPARTMENT["sales"] as Department);\n  const [formPhone'
)

# ── 2b: role chips also sync department ──────────────────────────────────────
src = patch(
    "2b-选角色时同步部门默认值",
    src,
    '                    onPress={() => setFormRole(r)}',
    '                    onPress={() => { setFormRole(r); setFormDepartment(ROLE_DEPARTMENT[r] as Department); }}'
)

# ── 2c: replace read-only dept text with selectable chips ────────────────────
src = patch(
    "2c-部门只读文本→可选择",
    src,
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
)

# ── 2d: reset formDepartment in modal open (header + button) ──────────────────
src = patch(
    "2d-新建时重置formDepartment",
    src,
    'setEditingAccount(null); setFormName(""); setFormRole("sales"); setFormPhone(""); setFormEmail(""); setShowAddModal(true);',
    'setEditingAccount(null); setFormName(""); setFormRole("sales"); setFormDepartment(ROLE_DEPARTMENT["sales"] as Department); setFormPhone(""); setFormEmail(""); setShowAddModal(true);'
)

# ── 2e: reset in handleAddAccount end ────────────────────────────────────────
src = patch(
    "2e-提交后重置formDepartment",
    src,
    'setFormName(""); setFormRole("sales"); setFormPhone(""); setFormEmail("");',
    'setFormName(""); setFormRole("sales"); setFormDepartment(ROLE_DEPARTMENT["sales"] as Department); setFormPhone(""); setFormEmail("");'
)

# ── 2f: openEdit fills formDepartment ────────────────────────────────────────
src = patch(
    "2f-编辑时填充formDepartment",
    src,
    '    setFormName(acc.name);\n    setFormRole(acc.role);\n    setFormPhone',
    '    setFormName(acc.name);\n    setFormRole(acc.role);\n    setFormDepartment(acc.department);\n    setFormPhone'
)

# ═══════════════════════════════════════════════════════════════════════════════
print("\n【3】修复: 删除按钮无反应 (添加删除功能)")
# ── 3a: add handleDeleteAccount after openEdit ───────────────────────────────
delete_handler = '''
  const handleDeleteAccount = useCallback(async (acc: DisplayAccount) => {
    const confirmMsg = `确认删除账号 "${acc.name}"？此操作不可撤销。`;
    if (Platform.OS === "web") {
      if (!window.confirm(confirmMsg)) return;
    } else {
      await new Promise<void>((resolve, reject) => {
        Alert.alert("确认删除", confirmMsg, [
          { text: "取消", style: "cancel", onPress: () => reject(new Error("cancelled")) },
          { text: "删除", style: "destructive", onPress: () => resolve() },
        ]);
      }).catch(() => { return; });
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
      } catch (err: any) {
        if (err.message === "cancelled") return;
        const msg = `删除失败: ${err.message}`;
        if (Platform.OS === "web") window.alert(msg); else Alert.alert("错误", msg);
      }
    } else {
      setLocalAccounts((prev) => prev.filter((a) => a.id !== acc.id));
    }
  }, [isDbMode, loadDbUsers]);

'''

src = patch(
    "3a-添加handleDeleteAccount",
    src,
    '  const openEdit = useCallback((acc: DisplayAccount) => {',
    delete_handler + '  const openEdit = useCallback((acc: DisplayAccount) => {'
)

# ── 3b: add delete button in card actions ─────────────────────────────────────
src = patch(
    "3b-添加删除按钮",
    src,
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
)

# ═══════════════════════════════════════════════════════════════════════════════
print("\n【4】修复: 禁用后无法启用 (handleToggleStatus 响应检查 + reload)")
src = patch(
    "4-handleToggleStatus重载DB",
    src,
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
)

# also fix the missing loadDbUsers dep in handleToggleStatus
src = patch(
    "4b-handleToggleStatus依赖loadDbUsers",
    src,
    '  }, [isDbMode]);',
    '  }, [isDbMode, loadDbUsers]);'
)

# ═══════════════════════════════════════════════════════════════════════════════
print("\n" + "="*58)
if failed:
    print(f"\n  {WARN} {len(failed)} 项未应用 (代码片段不匹配):")
    for f in failed:
        print(f"    - {f}")
    print("\n  已修复项仍会写入。检查备份文件比对差异。")

print(f"\n  ✅ 已应用 {len(applied)}/{len(applied)+len(failed)} 项修复")

# ── write back ────────────────────────────────────────────────────────────────
with open(ACCOUNTS, "w") as f:
    f.write(src)
print(f"\n{PASS} 已写入: {ACCOUNTS}")

# ── check system.tsx for context on Bug2 ──────────────────────────────────────
print(f"\n{INFO} 检查 system.tsx 岗位/部门管理相关代码...")
if os.path.exists(SYSTEM):
    with open(SYSTEM) as f:
        sys_src = f.read()
    # find role/department related sections
    lines = sys_src.split("\n")
    for i, line in enumerate(lines):
        if any(kw in line for kw in ["岗位", "department", "ROLE_DEPARTMENT", "删除", "handleDelete", "position"]):
            start = max(0, i-1)
            end   = min(len(lines), i+3)
            print(f"  L{i+1}: {line.rstrip()}")
    print(f"\n  system.tsx 总行数: {len(lines)}")
else:
    print(f"  {WARN} 未找到 system.tsx")

# ── PM2 restart ───────────────────────────────────────────────────────────────
print(f"\n{INFO} 重启 PM2 服务...")
try:
    r = subprocess.run(
        ["pm2", "restart", "all", "--update-env"],
        capture_output=True, text=True, timeout=30
    )
    if r.returncode == 0:
        print(f"  {PASS} PM2 重启成功")
    else:
        print(f"  {WARN} PM2 输出: {r.stderr.strip() or r.stdout.strip()}")
except Exception as e:
    print(f"  {FAIL} PM2 重启失败: {e}")

print(f"\n  完成! 备份文件: {backup}")
print("="*58 + "\n")
