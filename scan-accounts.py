#!/usr/bin/env python3
"""
scan-accounts.py — 提取 accounts.tsx 关键代码段
运行: python3 /tmp/scan-accounts.py > /tmp/accounts-scan.txt
然后将 /tmp/accounts-scan.txt 内容发给开发者
"""
import os, re

ACCOUNTS = "/opt/ogi-logistics/app/accounts.tsx"

if not os.path.exists(ACCOUNTS):
    print(f"❌ 找不到文件: {ACCOUNTS}")
    raise SystemExit(1)

with open(ACCOUNTS) as f:
    lines = f.readlines()

src = "".join(lines)
total = len(lines)
print(f"=== accounts.tsx 共 {total} 行 ===\n")

def show_around(keyword, context=25, label=None):
    for i, line in enumerate(lines):
        if keyword in line:
            start = max(0, i - 3)
            end = min(total, i + context)
            lbl = label or keyword
            print(f"\n--- [{lbl}] 找到于第 {i+1} 行 ---")
            for j in range(start, end):
                print(f"{j+1:4d}| {lines[j]}", end="")
            print()
            break
    else:
        print(f"\n--- [{label or keyword}] 未找到 ---")

# 1. useState 区域 (formRole / formPhone / formName)
show_around("formRole", context=20, label="formRole-state")

# 2. handleAddAccount 函数体
show_around("handleAddAccount", context=80, label="handleAddAccount")

# 3. handleToggleStatus 函数体
show_around("handleToggleStatus", context=50, label="handleToggleStatus")

# 4. handleDeleteAccount 函数体
show_around("handleDeleteAccount", context=50, label="handleDeleteAccount")

# 5. 部门显示区域
show_around("所属部门", context=20, label="部门UI")
show_around("ROLE_DEPARTMENT", context=10, label="ROLE_DEPARTMENT-usage")
show_around("DEPARTMENTS.map", context=15, label="DEPARTMENTS.map")
show_around("formDepartment", context=10, label="formDepartment")

# 6. 卡片操作按钮区域
show_around("handleDeleteAccount(item)", context=15, label="delete-button")
show_around("handleToggleStatus(item)", context=15, label="toggle-button")

# 7. openEdit 函数
show_around("openEdit", context=25, label="openEdit")

# 8. setFormRole / setFormPhone resets
show_around('setFormRole("sales")', context=5, label="reset-formRole")
show_around("setFormRole('sales')", context=5, label="reset-formRole-sq")

print("\n=== 扫描完成 ===")
