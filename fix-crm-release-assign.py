#!/usr/bin/env python3
"""
fix-crm-release-assign.py
1. 捞取/释放按钮: 替换 window.confirm → 内嵌 _confirm 弹窗
2. 我的客源卡片: 添加"放回公海"按钮
3. 批量导入: 增加"分配归属"销售员选择器, 传 assignTo 到 importLeads
"""
import os, re, shutil, sys
from datetime import datetime

CRM = "/opt/ogi-logistics/app/crm.tsx"
PASS = "\033[32m✅\033[0m"
FAIL = "\033[31m❌\033[0m"
INFO = "\033[36mℹ \033[0m"

if not os.path.exists(CRM):
    print(f"{FAIL} 找不到: {CRM}"); sys.exit(1)

backup = CRM + f".bak.{datetime.now().strftime('%Y%m%d_%H%M%S')}"
shutil.copy2(CRM, backup)
with open(CRM) as f:
    src = f.read()

print(f"\n{'='*58}\n  CRM 修复: 放回公海 + 批量导入归属\n{'='*58}")
print(f"{INFO} 备份: {backup}\n")

applied = []

def patch(label, src, old, new):
    if old in src:
        print(f"  {PASS} {label}")
        applied.append(label)
        return src.replace(old, new, 1)
    print(f"  {FAIL} {label} — 未找到目标代码")
    return src

# ══════════════════════════════════════════════════════════════
print("【1】添加内嵌 _confirm/_alert 状态\n")

NOTIFY_STATE = """  // 内嵌确认/通知弹窗 (替代 window.confirm)
  const [_notify, _setNotify] = useState<{msg: string; onOk?: () => void; isConfirm?: boolean; okLabel?: string} | null>(null);
  const _customAlert = (msg: string) => _setNotify({ msg });
  const _confirm = (msg: string, onOk: () => void, okLabel = "确认") => _setNotify({ msg, onOk, isConfirm: true, okLabel });
"""

src = patch(
    "1a-添加_notify状态",
    src,
    "  // 弹窗状态\n  const [showRegister",
    NOTIFY_STATE + "  // 弹窗状态\n  const [showRegister"
)

# ══════════════════════════════════════════════════════════════
print("\n【2】替换 handleClaim 中的 window.confirm\n")

src = patch(
    "2-handleClaim替换window.confirm",
    src,
    """  const handleClaim = (lead: CrmLead) => {
    if (Platform.OS === "web") {
      if (window.confirm(`确定要从公海捞取「${lead.companyName}」吗？\\n捞取后将获得60天开发保护期。`)) {
        crm.claimLead(lead.id).then((result) => {
          if (result.success) {
            showAlert("成功", result.message);
            loadData();
          } else {
            showAlert("失败", result.message);
          }
        });
      }
    } else {
      Alert.alert(
        "确认捞取",
        `确定要从公海捞取「${lead.companyName}」吗？\\n捞取后将获得60天开发保护期。`,
        [
          { text: "取消", style: "cancel" },
          {
            text: "确认捞取",
            onPress: async () => {
              const result = await crm.claimLead(lead.id);
              if (result.success) {
                showAlert("成功", result.message);
                loadData();
              } else {
                showAlert("失败", result.message);
              }
            },
          },
        ]
      );
    }
  };""",
    """  const handleClaim = (lead: CrmLead) => {
    _confirm(
      `确定要从公海捞取「${lead.companyName}」吗？捞取后将获得60天开发保护期。`,
      async () => {
        const result = await crm.claimLead(lead.id);
        if (result.success) { showAlert("成功", result.message); loadData(); }
        else showAlert("失败", result.message);
      },
      "确认捞取"
    );
  };"""
)

# ══════════════════════════════════════════════════════════════
print("\n【3】替换 handleRelease 中的 window.confirm\n")

src = patch(
    "3-handleRelease替换window.confirm",
    src,
    """  // 释放到公海
  const handleRelease = (lead: CrmLead) => {
    if (Platform.OS === "web") {
      if (window.confirm(`确定要将「${lead.companyName}」释放到公海池吗？`)) {
        crm.releaseLead(lead.id, "主动释放").then((result) => {
          if (result.success) {
            setShowDetail(null);
            showAlert("成功", result.message);
            loadData();
          } else {
            showAlert("失败", result.message);
          }
        });
      }
    } else {
      Alert.alert(
        "释放到公海",
        `确定要将「${lead.companyName}」释放到公海池吗？`,
        [
          { text: "取消", style: "cancel" },
          {
            text: "确认释放",
            style: "destructive",
            onPress: async () => {
              const result = await crm.releaseLead(lead.id, "主动释放");
              if (result.success) {
                setShowDetail(null);
                showAlert("成功", result.message);
                loadData();
              } else {
                showAlert("失败", result.message);
              }
            },
          },
        ]
      );
    }
  };""",
    """  // 释放到公海
  const handleRelease = (lead: CrmLead) => {
    _confirm(
      `确定要将「${lead.companyName}」释放到公海池吗？释放后其他人可捞取此客户。`,
      async () => {
        const result = await crm.releaseLead(lead.id, "主动释放");
        if (result.success) { setShowDetail(null); showAlert("成功", result.message); loadData(); }
        else showAlert("失败", result.message);
      },
      "确认释放"
    );
  };"""
)

# ══════════════════════════════════════════════════════════════
print("\n【4】我的客源卡片添加"放回公海"按钮\n")

src = patch(
    "4-卡片放回公海按钮",
    src,
    """        {isPool && (
          <TouchableOpacity
            style={[s.claimBtn, { backgroundColor: colors.primary }]}
            activeOpacity={0.7}
            onPress={() => handleClaim(item)}
          >
            <Text style={s.claimBtnText}>捞取此客户</Text>
          </TouchableOpacity>
        )}""",
    """        {isPool && (
          <TouchableOpacity
            style={[s.claimBtn, { backgroundColor: colors.primary }]}
            activeOpacity={0.7}
            onPress={() => handleClaim(item)}
          >
            <Text style={s.claimBtnText}>捞取此客户</Text>
          </TouchableOpacity>
        )}
        {!isPool && activeTab === "my_leads" && (
          <TouchableOpacity
            style={[s.claimBtn, { backgroundColor: "#6B7280" }]}
            activeOpacity={0.7}
            onPress={() => handleRelease(item)}
          >
            <Text style={s.claimBtnText}>放回公海</Text>
          </TouchableOpacity>
        )}"""
)

# ══════════════════════════════════════════════════════════════
print("\n【5】批量导入添加"分配归属"选择器\n")

# 5a: 添加 importAssignStaffId state
src = patch(
    "5a-importAssignStaffId状态",
    src,
    "  const [importResult, setImportResult] = useState<{ successCount?: number; failedCount?: number; errors?: string[] } | null>(null);",
    """  const [importResult, setImportResult] = useState<{ successCount?: number; failedCount?: number; errors?: string[] } | null>(null);
  const [importAssignStaffId, setImportAssignStaffId] = useState<number | null>(null);"""
)

# 5b: 在 importLeads 调用里加 assignTo
src = patch(
    "5b-importLeads传assignTo",
    src,
    """      const result = await crm.importLeads({
        data: importParsedData,
        fileName: importFileName || `CRM客户导入_${new Date().toLocaleDateString()}.xlsx`,
      });""",
    """      const result = await crm.importLeads({
        data: importParsedData,
        fileName: importFileName || `CRM客户导入_${new Date().toLocaleDateString()}.xlsx`,
        ...(importAssignStaffId ? { assignTo: importAssignStaffId } : {}),
      });"""
)

# 5c: 在导入表单里（"开始导入"按钮前）插入销售员选择器
src = patch(
    "5c-导入表单销售员选择器",
    src,
    """          <TouchableOpacity style={[s.importBtn, { backgroundColor: colors.primary }]} onPress={handleImportSubmit} disabled={importing}>""",
    """          {/* 分配归属（可选） */}
          {salesStaff.length > 0 && (
            <View style={{ marginBottom: 12 }}>
              <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 6 }}>分配归属（可选，不选则进入公海）</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <TouchableOpacity
                  style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginRight: 8,
                    backgroundColor: importAssignStaffId === null ? colors.primary : colors.surface,
                    borderWidth: 1, borderColor: importAssignStaffId === null ? colors.primary : colors.border }}
                  onPress={() => setImportAssignStaffId(null)}
                >
                  <Text style={{ color: importAssignStaffId === null ? "#fff" : colors.muted, fontSize: 13 }}>不指定</Text>
                </TouchableOpacity>
                {salesStaff.map(st => (
                  <TouchableOpacity
                    key={st.id}
                    style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginRight: 8,
                      backgroundColor: importAssignStaffId === st.id ? colors.primary : colors.surface,
                      borderWidth: 1, borderColor: importAssignStaffId === st.id ? colors.primary : colors.border }}
                    onPress={() => setImportAssignStaffId(st.id)}
                  >
                    <Text style={{ color: importAssignStaffId === st.id ? "#fff" : colors.foreground, fontSize: 13 }}>{st.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
          <TouchableOpacity style={[s.importBtn, { backgroundColor: colors.primary }]} onPress={handleImportSubmit} disabled={importing}>"""
)

# 5d: 重置时也清空 importAssignStaffId
src = patch(
    "5d-重置导入时清空assignStaffId",
    src,
    """  const resetImport = () => {
    setImportParsedData([]);
    setImportFileName("");
    setImportResult(null);
  };""",
    """  const resetImport = () => {
    setImportParsedData([]);
    setImportFileName("");
    setImportResult(null);
    setImportAssignStaffId(null);
  };"""
)

# ══════════════════════════════════════════════════════════════
print("\n【6】在 JSX 中插入内嵌弹窗组件\n")

NOTIFY_MODAL = """          {/* 内嵌确认/通知弹窗 */}
          {_notify && (
            <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 9999, alignItems: "center", justifyContent: "center" }}>
              <View style={{ backgroundColor: "#fff", borderRadius: 14, padding: 24, maxWidth: 340, width: "90%", shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 20, elevation: 12 }}>
                <Text style={{ fontSize: 15, color: "#1a1a1a", marginBottom: 20, lineHeight: 23 }}>{_notify.msg}</Text>
                <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10 }}>
                  {_notify.isConfirm && (
                    <TouchableOpacity onPress={() => _setNotify(null)} style={{ paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: "#e5e7eb" }}>
                      <Text style={{ color: "#6b7280", fontSize: 14 }}>取消</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => { const cb = _notify?.onOk; _setNotify(null); cb && cb(); }}
                    style={{ paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8, backgroundColor: _notify.isConfirm ? "#dc2626" : "#3b82f6" }}
                  >
                    <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>{_notify.okLabel || (_notify.isConfirm ? "确认" : "确定")}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
"""

# 找 <ScreenContainer 插入位置
m = re.search(r'<ScreenContainer[^>]*>\s*\n', src)
if m:
    insert_pos = m.end()
    src = src[:insert_pos] + NOTIFY_MODAL + src[insert_pos:]
    print(f"  {PASS} 6-插入内嵌弹窗组件")
    applied.append("6-弹窗组件")
else:
    # 尝试找 content 变量里的 ScreenContainer
    m2 = re.search(r'(const content = \([^)]*\n\s*<ScreenContainer[^\n]*\n)', src, re.DOTALL)
    if m2:
        old_sc = m2.group(0)
        lines_sc = old_sc.split('\n')
        # Insert after second line (the ScreenContainer line)
        new_sc = '\n'.join(lines_sc[:2]) + '\n' + NOTIFY_MODAL + '\n'.join(lines_sc[2:])
        src = src.replace(old_sc, new_sc, 1)
        print(f"  {PASS} 6-插入内嵌弹窗组件(content变量)")
        applied.append("6-弹窗组件")
    else:
        print(f"  {FAIL} 6-未找到ScreenContainer")

# ══════════════════════════════════════════════════════════════
with open(CRM, "w") as f:
    f.write(src)

print(f"\n{'='*58}")
print(f"  共应用 {len(applied)} 项修复")
print(f"{PASS} 已写入: {CRM}\n")

os.system("pm2 restart all --update-env 2>&1 | tail -3")
print(f"""
  验证内容:
    1. 公海池 → 点"捞取此客户" → 应出现内嵌确认弹窗
    2. 我的客源 → 每个客户卡片底部应有"放回公海"按钮
    3. 批量导入 → 上传文件后出现业务员选择器（不选=进公海）
{'='*58}
""")
