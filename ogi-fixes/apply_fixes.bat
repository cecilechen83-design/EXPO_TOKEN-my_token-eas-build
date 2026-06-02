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

:: ===== 集成万国拉美查税助手 =====
echo 正在集成拉美查税助手...

:: 复制侧边栏（已添加"拉美查税"菜单项）
copy /Y "%~dp0components\web-sidebar.tsx" "E:\ogi-logistics\components\web-sidebar.tsx"
echo [3/4] web-sidebar.tsx 已更新（已添加拉美查税菜单）

:: 复制税率数据库
copy /Y "%~dp0lib\tariff-data.ts" "E:\ogi-logistics\lib\tariff-data.ts"
echo [4/5] lib\tariff-data.ts 已复制

:: 复制查税页面
copy /Y "%~dp0app\tariff.tsx" "E:\ogi-logistics\app\tariff.tsx"
echo [5/5] app\tariff.tsx 已复制

echo.
echo ✓ 全部修复完成！
echo.
echo 提示：重启开发服务器后即可在侧边栏看到"拉美查税"菜单项。
pause
