#!/usr/bin/env python3
"""
fix-employee-mgmt-v5.py
彻底替换 window.confirm / window.alert → React 状态弹窗
修复禁用 / 启用 / 删除完全无反应的问题
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
    src = f.read()

print(f"\n{'='*58}\n  员工管理 Bug 修复 v5 (替换 window 弹窗)\n{'='*58}")
print(f"{INFO} 备份: {backup}\n")

applied = []

def patch(label, src, old, new):
    if old in src:
        print(f"  {PASS} {label}")
        applied.append(label)
        return src.replace(old, new, 1)
    print(f"  {FAIL} {label} — 未找到目标代码")
    return src

# ── 1. 在 useState 声明区添加弹窗状态 ────────────────────────────────────────
NOTIFY_STATE = '''  // 内嵌通知/确认弹窗状态 (替代 window.alert / window.confirm)
  const [_notify, _setNotify] = React.useState<{msg: string; onOk?: () => void; isConfirm?: boolean} | null>(null);
  const _alert = (msg: string) => _setNotify({ msg });
  const _confirm = (msg: string, onOk: () => void) => _setNotify({ msg, onOk, isConfirm: true });
'''

# 找 loading state 声明插入位置
src = patch(
    "1-添加_notify状态",
    src,
    "  const [loading, setLoading]",
    NOTIFY_STATE + "  const [loading, setLoading]"
)

# ── 2. 在 return JSX 顶部插入弹窗组件 ────────────────────────────────────────
NOTIFY_MODAL = '''      {/* 内嵌通知弹窗 */}
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
                style={{ paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8, backgroundColor: _notify.isConfirm ? "#e53e3e" : "#3b82f6" }}
              >
                <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>{_notify.isConfirm ? "确认" : "确定"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
'''

src = patch(
    "2-插入内嵌弹窗组件",
    src,
    "    <ScreenContainer edges={[\"top\", \"left\", \"right\"]}>\n      {/* Header */}",
    "    <ScreenContainer edges={[\"top\", \"left\", \"right\"]}>\n" + NOTIFY_MODAL + "      {/* Header */"
)

# ── 3. 替换 handleToggleStatus 里的 window.alert ─────────────────────────────
src = patch(
    "3a-handleToggleStatus错误提示",
    src,
    'if (Platform.OS === "web") window.alert("错误: " + errMsg); else Alert.alert("错误", errMsg);\n          return;\n        }\n        await loadDbUsers();\n      } catch (err: any) {\n        const msg = `操作失败: ${err.message}`;\n        if (Platform.OS === "web") alert(msg); else Alert.alert("错误", msg);',
    '_alert("错误: " + errMsg);\n          return;\n        }\n        await loadDbUsers();\n        _alert(newStatus === "disabled" ? "已禁用" : "已启用");\n      } catch (err: any) {\n        const msg = `操作失败: ${err instanceof Error ? err.message : String(err)}`;\n        _alert(msg);'
)

# ── 4. 替换 handleDeleteAccount 里的 window.confirm / window.alert ────────────
src = patch(
    "3b-handleDeleteAccount确认弹窗",
    src,
    '''    if (Platform.OS === "web") {
      if (!window.confirm(confirmMsg)) return;
    } else {
      await new Promise<void>((resolve, reject) => {
        Alert.alert("确认删除", confirmMsg, [
          { text: "取消", style: "cancel", onPress: () => reject(new Error("cancelled")) },
          { text: "删除", style: "destructive", onPress: () => resolve() },
        ]);
      }).catch(() => { return; });
    }''',
    '''    await new Promise<void>((resolve) => {
      _confirm(confirmMsg, resolve);
    });'''
)

src = patch(
    "3c-handleDeleteAccount错误提示",
    src,
    'if (Platform.OS === "web") window.alert("错误: " + errMsg); else Alert.alert("错误", errMsg);\n          return;\n        }\n        await loadDbUsers();\n      } catch (err: any) {\n        if (err.message === "cancelled") return;\n        const msg = `删除失败: ${err.message}`;\n        if (Platform.OS === "web") window.alert(msg); else Alert.alert("错误", msg);',
    '_alert("错误: " + errMsg);\n          return;\n        }\n        await loadDbUsers();\n        _alert("已删除");\n      } catch (err: any) {\n        const msg = `删除失败: ${err instanceof Error ? err.message : String(err)}`;\n        _alert(msg);'
)

# ── 5. 替换 handleAddAccount 里的 window.alert 错误提示 ───────────────────────
src = patch(
    "4a-handleAddAccount-update错误",
    src,
    'if (Platform.OS === "web") window.alert("错误: " + errMsg); else Alert.alert("错误", errMsg);\n            return;\n          }\n        } else {\n          // Create new DB user',
    '_alert("错误: " + errMsg);\n            return;\n          }\n        } else {\n          // Create new DB user'
)

src = patch(
    "4b-handleAddAccount-create错误",
    src,
    'if (Platform.OS === "web") window.alert("错误: " + errMsg); else Alert.alert("错误", errMsg);\n            return;\n          }\n        }\n        // Reload from DB',
    '_alert("错误: " + errMsg);\n            return;\n          }\n        }\n        // Reload from DB'
)

src = patch(
    "4c-handleAddAccount-保存成功",
    src,
    "if (typeof window !== 'undefined') window.alert('保存成功'); ",
    "_alert('保存成功'); "
)

src = patch(
    "4d-handleAddAccount-catch",
    src,
    "if (Platform.OS === \"web\") alert(msg); else Alert.alert(\"错误\", msg);\n      }\n    } else {\n      // Local mode",
    "_alert(msg);\n      }\n    } else {\n      // Local mode"
)

# ── 6. 确保顶部有 React import（用于 React.useState）────────────────────────
if "import React" not in src and "import * as React" not in src:
    # 检查是否已用解构 import { useState }
    if "import { " in src and "useState" in src:
        # 在第一个 import 行前加 React 导入
        src = patch(
            "5-添加React导入",
            src,
            'import { ',
            'import React from "react";\nimport { '
        )
    # else React 可能已经全局可用

# ── 写回 ─────────────────────────────────────────────────────────────────────
with open(ACCOUNTS, "w") as f:
    f.write(src)
print(f"\n{PASS} 已写入: {ACCOUNTS}")
print(f"  共应用 {len(applied)} 项修复\n")

os.system("pm2 restart all --update-env 2>&1 | tail -3")
print(f"\n  请刷新页面测试禁用/启用/删除按钮。\n{'='*58}\n")
