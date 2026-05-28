@echo off
chcp 65001 > nul
echo 正在提取需要修复的文件...

set ROOT=E:\ogi-logistics
set OUT=E:\ogi-fix-files

mkdir "%OUT%" 2>nul
mkdir "%OUT%\app" 2>nul
mkdir "%OUT%\app\oauth" 2>nul
mkdir "%OUT%\app\tabs" 2>nul
mkdir "%OUT%\server" 2>nul
mkdir "%OUT%\server\_core" 2>nul
mkdir "%OUT%\lib" 2>nul
mkdir "%OUT%\lib\_core" 2>nul
mkdir "%OUT%\hooks" 2>nul
mkdir "%OUT%\components" 2>nul

:: 安全问题文件
copy "%ROOT%\app\system.tsx"              "%OUT%\app\system.tsx"
copy "%ROOT%\app\oauth\callback.tsx"      "%OUT%\app\oauth\callback.tsx"
copy "%ROOT%\server\auth.ts"              "%OUT%\server\auth.ts"
copy "%ROOT%\server\_core\oauth.ts"       "%OUT%\server\_core\oauth.ts"
copy "%ROOT%\lib\_core\auth.ts"           "%OUT%\lib\_core\auth.ts"
copy "%ROOT%\server\hualei.ts"            "%OUT%\server\hualei.ts"
copy "%ROOT%\hooks\use-auth.ts"           "%OUT%\hooks\use-auth.ts"

:: 功能 Bug 文件（登录状态）
copy "%ROOT%\lib\_core\api.ts"            "%OUT%\lib\_core\api.ts"
copy "%ROOT%\app\_layout.tsx"             "%OUT%\app\_layout.tsx"
copy "%ROOT%\app\(tabs)\_layout.tsx"      "%OUT%\app\tabs\_layout.tsx"

:: 功能 Bug 文件（报价模块）
copy "%ROOT%\app\quote-manage.tsx"        "%OUT%\app\quote-manage.tsx"
copy "%ROOT%\app\quote-inquiry.tsx"       "%OUT%\app\quote-inquiry.tsx"

:: 功能 Bug 文件（客户管理）
copy "%ROOT%\app\crm.tsx"                 "%OUT%\app\crm.tsx"
copy "%ROOT%\components\excel-import-modal.tsx" "%OUT%\components\excel-import-modal.tsx"

:: 数据库 Schema（了解结构用）
copy "%ROOT%\drizzle\schema.ts"           "%OUT%\drizzle_schema.ts"

echo.
echo ✓ 完成！文件已提取到 E:\ogi-fix-files\
echo 请把 E:\ogi-fix-files 文件夹里的所有文件上传给 Claude。
pause
