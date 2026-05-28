@echo off
chcp 65001 > nul
echo 正在自动修复代码...

:: ===== 修复 system.tsx：清除硬编码默认密码（初始 state）=====
powershell -Command "(Get-Content 'E:\ogi-logistics\app\system.tsx' -Encoding UTF8) -replace 'password: \"123456\", departmentId: null as number \| null, positionId: null as number \| null', 'password: \"\", departmentId: null as number | null, positionId: null as number | null' | Set-Content 'E:\ogi-logistics\app\system.tsx' -Encoding UTF8"
echo [1/2] system.tsx 初始密码已清除

:: ===== 修复 system.tsx：清除硬编码默认密码（重置 state）=====
powershell -Command "(Get-Content 'E:\ogi-logistics\app\system.tsx' -Encoding UTF8) -replace 'password: \"123456\", departmentId: null, positionId: null', 'password: \"\", departmentId: null, positionId: null' | Set-Content 'E:\ogi-logistics\app\system.tsx' -Encoding UTF8"
echo [2/2] system.tsx 重置密码已清除

echo.
echo ✓ 全部修复完成！
pause
