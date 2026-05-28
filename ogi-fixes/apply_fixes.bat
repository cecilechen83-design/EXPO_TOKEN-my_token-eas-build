@echo off
chcp 65001 > nul
echo 正在自动修复代码...

:: ===== 修复 crm.tsx：批量上传权限判断 =====
powershell -Command "(Get-Content 'E:\ogi-logistics\app\crm.tsx' -Encoding UTF8) -replace 'user\?\.role === \"cs_supervisor\" \|\| user\?\.role === \"ceo\"', 'user?.appRole === \"cs_supervisor\" || user?.appRole === \"ceo\"' | Set-Content 'E:\ogi-logistics\app\crm.tsx' -Encoding UTF8"
echo [1/3] crm.tsx 权限修复完成

:: ===== 修复 system.tsx：删除硬编码默认密码（初始 state）=====
powershell -Command "(Get-Content 'E:\ogi-logistics\app\system.tsx' -Encoding UTF8) -replace 'password: \"123456\", departmentId: null as number \| null, positionId: null as number \| null', 'password: \"\", departmentId: null as number | null, positionId: null as number | null' | Set-Content 'E:\ogi-logistics\app\system.tsx' -Encoding UTF8"
echo [2/3] system.tsx 初始密码修复完成

:: ===== 修复 system.tsx：删除硬编码默认密码（重置 state）=====
powershell -Command "(Get-Content 'E:\ogi-logistics\app\system.tsx' -Encoding UTF8) -replace 'password: \"123456\", departmentId: null, positionId: null', 'password: \"\", departmentId: null, positionId: null' | Set-Content 'E:\ogi-logistics\app\system.tsx' -Encoding UTF8"
echo [3/3] system.tsx 重置密码修复完成

echo.
echo ✓ 全部修复完成！
pause
