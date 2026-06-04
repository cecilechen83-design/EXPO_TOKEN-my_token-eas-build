#!/usr/bin/env python3
"""
fix-system-org.py
1. 部门卡片添加删除按钮
2. 岗位卡片添加删除按钮 + 显示所属部门名称
3. 添加 handleDeleteDept / handleDeletePos 处理函数
4. 所有弹窗用内嵌 _notify 状态替代 Alert.alert / window.confirm
"""
import os, re, shutil, sys
from datetime import datetime

SYSTEM = "/opt/ogi-logistics/app/system.tsx"
PASS = "\033[32m✅\033[0m"
FAIL = "\033[31m❌\033[0m"
INFO = "\033[36mℹ \033[0m"

if not os.path.exists(SYSTEM):
    print(f"{FAIL} 找不到: {SYSTEM}"); sys.exit(1)

backup = SYSTEM + f".bak.{datetime.now().strftime('%Y%m%d_%H%M%S')}"
shutil.copy2(SYSTEM, backup)

with open(SYSTEM) as f:
    src = f.read()

print(f"\n{'='*58}\n  组织架构 Bug 修复 (system.tsx)\n{'='*58}")
print(f"{INFO} 备份: {backup}\n")

applied = []

def patch(label, src, old, new):
    if old in src:
        print(f"  {PASS} {label}")
        applied.append(label)
        return src.replace(old, new, 1)
    print(f"  {FAIL} {label} — 未找到目标代码")
    return src

# ── 1. 在 state 区域添加 _notify 状态 ────────────────────────────────────────
NOTIFY_STATE = """  // 内嵌通知/确认弹窗
  const [_notify, _setNotify] = React.useState<{msg: string; onOk?: () => void; isConfirm?: boolean} | null>(null);
  const _alert = (msg: string) => _setNotify({ msg });
  const _confirm = (msg: string, onOk: () => void) => _setNotify({ msg, onOk, isConfirm: true });
"""
src = patch(
    "1-添加_notify状态",
    src,
    "  // Department state\n  const [depts, setDepts]",
    NOTIFY_STATE + "  // Department state\n  const [depts, setDepts]"
)

# ── 2. 添加 handleDeleteDept / handleDeletePos ────────────────────────────────
DELETE_HANDLERS = """
  const handleDeleteDept = (dept: Department) => {
    _confirm(`确认删除部门"${dept.name}"？删除后无法恢复。`, async () => {
      try {
        const json = await apiCall(`/api/system/departments/${dept.id}`, { method: "DELETE" });
        if (json.success) { loadDepartments(); _alert("部门已删除"); }
        else _alert("错误: " + (json.message || "删除失败"));
      } catch { _alert("删除失败，请重试"); }
    });
  };

  const handleDeletePos = (pos: Position) => {
    _confirm(`确认删除岗位"${pos.name}"？删除后无法恢复。`, async () => {
      try {
        const json = await apiCall(`/api/system/positions/${pos.id}`, { method: "DELETE" });
        if (json.success) { loadPositions(); _alert("岗位已删除"); }
        else _alert("错误: " + (json.message || "删除失败"));
      } catch { _alert("删除失败，请重试"); }
    });
  };

"""
src = patch(
    "2-添加handleDeleteDept/Pos",
    src,
    "  const handleCreateStaff = async () => {",
    DELETE_HANDLERS + "  const handleCreateStaff = async () => {"
)

# ── 3. 部门卡片添加删除按钮 ───────────────────────────────────────────────────
src = patch(
    "3-部门卡片删除按钮",
    src,
    """          <View style={s.listCardHeader}>
            <Text style={[s.listCardTitle, { color: colors.foreground }]}>{dept.name}</Text>
            <Text style={[s.badge, { backgroundColor: colors.primary + "15", color: colors.primary }]}>{dept.code}</Text>
          </View>
          {dept.description && <Text style={[s.listCardDesc, { color: colors.muted }]}>{dept.description}</Text>}
          {dept.managerName && <Text style={[s.listCardMeta, { color: colors.muted }]}>负责人: {dept.managerName}</Text>}
        </View>""",
    """          <View style={s.listCardHeader}>
            <Text style={[s.listCardTitle, { color: colors.foreground }]}>{dept.name}</Text>
            <Text style={[s.badge, { backgroundColor: colors.primary + "15", color: colors.primary }]}>{dept.code}</Text>
            <TouchableOpacity
              onPress={() => handleDeleteDept(dept)}
              style={{ marginLeft: "auto", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: "#fee2e2" }}
            >
              <Text style={{ color: "#dc2626", fontSize: 12, fontWeight: "600" }}>删除</Text>
            </TouchableOpacity>
          </View>
          {dept.description && <Text style={[s.listCardDesc, { color: colors.muted }]}>{dept.description}</Text>}
          {dept.managerName && <Text style={[s.listCardMeta, { color: colors.muted }]}>负责人: {dept.managerName}</Text>}
        </View>"""
)

# ── 4. 岗位卡片添加部门名称 + 删除按钮 ───────────────────────────────────────
src = patch(
    "4-岗位卡片部门名+删除按钮",
    src,
    """          <View style={s.listCardHeader}>
            <Text style={[s.listCardTitle, { color: colors.foreground }]}>{pos.name}</Text>
            <Text style={[s.badge, { backgroundColor: colors.success + "15", color: colors.success }]}>{pos.code}</Text>
          </View>
          {pos.description && <Text style={[s.listCardDesc, { color: colors.muted }]}>{pos.description}</Text>}
          <Text style={[s.listCardMeta, { color: colors.muted }]}>等级: {pos.level}</Text>
        </View>""",
    """          <View style={s.listCardHeader}>
            <Text style={[s.listCardTitle, { color: colors.foreground }]}>{pos.name}</Text>
            <Text style={[s.badge, { backgroundColor: colors.success + "15", color: colors.success }]}>{pos.code}</Text>
            <TouchableOpacity
              onPress={() => handleDeletePos(pos)}
              style={{ marginLeft: "auto", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: "#fee2e2" }}
            >
              <Text style={{ color: "#dc2626", fontSize: 12, fontWeight: "600" }}>删除</Text>
            </TouchableOpacity>
          </View>
          {pos.departmentId && depts.find(d => d.id === pos.departmentId) && (
            <Text style={[s.listCardMeta, { color: colors.primary }]}>
              所属部门: {depts.find(d => d.id === pos.departmentId)?.name}
            </Text>
          )}
          {pos.description && <Text style={[s.listCardDesc, { color: colors.muted }]}>{pos.description}</Text>}
          <Text style={[s.listCardMeta, { color: colors.muted }]}>等级: {pos.level}</Text>
        </View>"""
)

# ── 5. 在 JSX return 里插入内嵌弹窗 ─────────────────────────────────────────
NOTIFY_MODAL = """      {/* 内嵌通知/确认弹窗 */}
      {_notify && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 9999, alignItems: "center", justifyContent: "center" }}>
          <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 24, maxWidth: 340, width: "90%", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 16, elevation: 10 }}>
            <Text style={{ fontSize: 15, color: "#222", marginBottom: 20, lineHeight: 22 }}>{_notify.msg}</Text>
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10 }}>
              {_notify.isConfirm && (
                <TouchableOpacity onPress={() => _setNotify(null)} style={{ paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: "#ddd" }}>
                  <Text style={{ color: "#555", fontSize: 14 }}>取消</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => { const cb = _notify?.onOk; _setNotify(null); cb && cb(); }}
                style={{ paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8, backgroundColor: _notify.isConfirm ? "#dc2626" : "#3b82f6" }}
              >
                <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>{_notify.isConfirm ? "确认删除" : "确定"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
"""

# 找 ScreenContainer 的第一行插入弹窗
m = re.search(r'(<ScreenContainer[^>]*>)', src)
if m:
    # Find the next newline after <ScreenContainer...>
    pos = src.find('\n', m.end()) + 1
    src = src[:pos] + NOTIFY_MODAL + src[pos:]
    print(f"  {PASS} 5-插入内嵌弹窗组件")
    applied.append("5-内嵌弹窗")
else:
    print(f"  {FAIL} 5-未找到ScreenContainer插入点")

# ── 6. 确保 React 可用 ────────────────────────────────────────────────────────
if "import React" not in src and "import * as React" not in src:
    if "React.useState" in src:
        # 已经用了 React.useState 但没有 import React
        src = re.sub(r'^(import \{)', 'import React from "react";\n\\1', src, count=1, flags=re.MULTILINE)
        print(f"  {PASS} 6-添加React导入")
        applied.append("6-React导入")

# ── 写回 ──────────────────────────────────────────────────────────────────────
with open(SYSTEM, "w") as f:
    f.write(src)

print(f"\n  共应用 {len(applied)} 项修复")
print(f"{PASS} 已写入: {SYSTEM}\n")

os.system("pm2 restart all --update-env 2>&1 | tail -3")
print(f"\n  请刷新页面，在组织架构 → 部门/岗位列表验证删除按钮。\n{'='*58}\n")
