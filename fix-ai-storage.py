#!/usr/bin/env python3
"""
fix-ai-storage.py — 全自动修复两个问题:
1. OPENAI_API_KEY 未配置 → AI 自动报价改用本地 matchPriceRules 兜底
2. BUILT_IN_FORGE 存储未配置 → 上传报价单改为本地文件系统存储
"""
import os, re, shutil, subprocess
from datetime import datetime

SERVER = "/opt/ogi-logistics/server"
AI_SVC  = f"{SERVER}/ai-quote-service.ts"
STORAGE = f"{SERVER}/storage.ts"
ROUTES  = f"{SERVER}/quote-request-routes.ts"
PASS = "\033[32m✅\033[0m"; FAIL = "\033[31m❌\033[0m"
INFO = "\033[36mℹ \033[0m"; WARN = "\033[33m⚠ \033[0m"

ts = datetime.now().strftime("%Y%m%d_%H%M%S")
applied = []; failed = []

def patch(label, path, old, new):
    with open(path) as f: content = f.read()
    if old not in content:
        print(f"  {FAIL} [{label}] 未找到目标代码")
        failed.append(label)
        return
    result = content.replace(old, new, 1)
    with open(path, "w") as f: f.write(result)
    print(f"  {PASS} [{label}]")
    applied.append(label)

def patch_regex(label, path, pattern, replacement, flags=0):
    with open(path) as f: content = f.read()
    new_content, n = re.subn(pattern, replacement, content, count=1, flags=flags)
    if n == 0:
        print(f"  {FAIL} [{label}] 未找到目标代码（正则）")
        failed.append(label)
        return
    with open(path, "w") as f: f.write(new_content)
    print(f"  {PASS} [{label}]")
    applied.append(label)

def backup(path):
    b = path + f".bak.{ts}"
    shutil.copy2(path, b)
    print(f"  备份: {b}")

print("\n" + "="*60)
print("  AI报价 + 文件上传 全自动修复")
print("="*60)

# ══════════════════════════════════════════════════════════
print(f"\n【1】修复 storage.ts — 本地文件存储兜底")
# ══════════════════════════════════════════════════════════
backup(STORAGE)
with open(STORAGE) as f:
    storage_src = f.read()
print(f"  storage.ts: {len(storage_src.split(chr(10)))} 行")

# 确保上传目录存在
os.makedirs("/opt/ogi-logistics/uploads", exist_ok=True)

# 方案：在 storagePut 头部，当凭据缺失时改用本地存储
# 查找抛出错误的那一行，在它之前插入本地存储逻辑
LOCAL_STORAGE_INJECTION = '''  // ── 本地文件存储兜底（当 BUILT_IN_FORGE 未配置时）──
  if (!process.env.BUILT_IN_FORGE_API_URL || !process.env.BUILT_IN_FORGE_API_KEY) {
    const path = require("path");
    const fs   = require("fs");
    const uploadsDir = path.join(__dirname, "..", "uploads");
    fs.mkdirSync(uploadsDir, { recursive: true });
    // key 可能包含路径分隔符，取最后一段作为文件名
    const safeName = key.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath  = path.join(uploadsDir, safeName);
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as any, "base64");
    fs.writeFileSync(filePath, buf);
    const baseUrl = process.env.SERVER_BASE_URL || "http://localhost:3000";
    return `${baseUrl}/uploads/${safeName}`;
  }
  // ── 原始外部存储逻辑 ──
'''

# 找到 storagePut 函数体的开头，在第一个实际代码行前注入
# 错误信息是 "Storage proxy credentials missing"
patch_regex(
    "1a-storage本地兜底",
    STORAGE,
    r'(export async function storagePut[^{]+\{)\s*\n(\s*)(const apiUrl|const url|const endpoint|if \(!)',
    r'\1\n' + LOCAL_STORAGE_INJECTION + r'  \3',
    flags=re.MULTILINE
)

# 如果上面的正则没匹配（文件结构不同），尝试直接替换错误抛出行
if "1a-storage本地兜底" in failed:
    failed.remove("1a-storage本地兜底")
    patch_regex(
        "1a-storage本地兜底(备用)",
        STORAGE,
        r'throw new Error\(["\']Storage proxy credentials missing[^"\']*["\']\)',
        '''(() => {
    const path = require("path");
    const fs   = require("fs");
    const uploadsDir = path.join(__dirname, "..", "uploads");
    fs.mkdirSync(uploadsDir, { recursive: true });
    const safeName = (typeof key !== "undefined" ? key : String(Date.now())).replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath  = path.join(uploadsDir, safeName);
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as any, "base64");
    fs.writeFileSync(filePath, buf);
    const baseUrl = process.env.SERVER_BASE_URL || "http://localhost:3000";
    return `${baseUrl}/uploads/${safeName}`;
  })()''',
        flags=re.MULTILINE
    )

# 添加 /uploads 静态路由（如果 ROUTES 里还没有）
with open(ROUTES) as f: routes_src = f.read()
if "/uploads" not in routes_src and "express.static" not in routes_src:
    patch(
        "1b-静态文件路由",
        ROUTES,
        "export function registerQuoteRoutes(",
        '''// 静态文件服务 - 本地上传的报价单
import path from "path";
import fs from "fs";
const uploadsDir = path.join(__dirname, "..", "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

export function registerQuoteRoutes('''
    )
    # 在 app 注册处添加静态路由
    with open(ROUTES) as f: routes_src2 = f.read()
    if "app.use(" in routes_src2 and "/uploads" not in routes_src2:
        # 在函数体第一个 app. 调用前插入静态路由
        routes_src2 = routes_src2.replace(
            "export function registerQuoteRoutes(app: Express)",
            "export function registerQuoteRoutes(app: Express)"
        )
        # 找 app.get 或 app.post 第一次出现位置，在前面加静态路由
        m = re.search(r'(\s+)(app\.(get|post|put|delete)\()', routes_src2)
        if m:
            insert_before = m.group(0)
            routes_src2 = routes_src2.replace(
                insert_before,
                f"\n  app.use('/uploads', require('express').static(uploadsDir));\n" + insert_before,
                1
            )
            with open(ROUTES, "w") as f: f.write(routes_src2)
            print(f"  {PASS} [1c-静态路由注册]")
            applied.append("1c-静态路由注册")
else:
    print(f"  {PASS} [1b-静态路由] 已存在，跳过")

# ══════════════════════════════════════════════════════════
print(f"\n【2】修复 ai-quote-service.ts — 无 API Key 时本地匹配兜底")
# ══════════════════════════════════════════════════════════
backup(AI_SVC)
with open(AI_SVC) as f:
    ai_src = f.read()
print(f"  ai-quote-service.ts: {len(ai_src.split(chr(10)))} 行")

# 在 aiMatchQuote 函数中，找到 OPENAI_API_KEY 检查，
# 替换为：无 key 时用本地规则匹配
LOCAL_MATCH_CODE = '''  // ── 无 API Key 时使用本地规则匹配 ──
  const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return localMatchQuote(inquiry, rules);
  }
  // ── 原始 AI 匹配逻辑 ──
'''

# 尝试替换 throw new Error("OPENAI_API_KEY is not configured")
patch_regex(
    "2a-AI无key本地兜底",
    AI_SVC,
    r'(const apiKey\s*=\s*process\.env\.OPENAI_API_KEY[^\n]*\n\s*)if\s*\(!apiKey\)\s*\{\s*\n\s*throw new Error\(["\']OPENAI_API_KEY is not configured["\']\);\s*\n\s*\}',
    LOCAL_MATCH_CODE.rstrip(),
    flags=re.MULTILINE
)

# 如果没匹配，用更宽松的方式匹配整个错误抛出
if "2a-AI无key本地兜底" in failed:
    failed.remove("2a-AI无key本地兜底")
    patch_regex(
        "2a-AI无key本地兜底(备用)",
        AI_SVC,
        r'throw new Error\(["\']OPENAI_API_KEY is not configured["\']\)',
        'return localMatchQuote(inquiry, rules)',
        flags=re.MULTILINE
    )

# 在文件末尾（或 aiMatchQuote 定义前）注入 localMatchQuote 本地实现
with open(AI_SVC) as f: ai_src2 = f.read()
if "localMatchQuote" not in ai_src2:
    LOCAL_MATCH_FN = '''
// ── 本地规则匹配（无 AI 时使用） ────────────────────────────
function localMatchQuote(inquiry: any, rules: AiPriceRule[]): any {
  const items = Array.isArray(inquiry) ? inquiry : (inquiry.items || []);
  const resultItems: any[] = [];
  let totalPrice = 0;

  for (const item of items) {
    const country  = (item.country || item.destinationCountry || "").toLowerCase();
    const weight   = parseFloat(item.weight) || 0;
    const volume   = parseFloat(item.volume) || 0;
    const category = (item.category || "").toLowerCase();
    const chargeableWeight = Math.max(weight, volume * 167);

    // 筛选匹配规则
    const matched = rules.filter(r => {
      const rc = (r.destinationCountry || r.country || (r as any).method || "").toLowerCase();
      if (rc && country && !rc.includes(country) && !country.includes(rc)) return false;
      const rc2 = (r as any).transportMethod || (r as any).method || "";
      const wMin = parseFloat(String((r as any).weightMin || 0));
      const wMax = parseFloat(String((r as any).weightMax || 999999));
      if (chargeableWeight > 0 && (chargeableWeight < wMin || chargeableWeight > wMax)) return false;
      return true;
    });

    let recommendation: any = null;
    if (matched.length > 0) {
      const best = matched.reduce((a, b) =>
        (a.unitPrice || 0) < (b.unitPrice || 0) ? a : b
      );
      const price = (best.unitPrice || 0) * Math.max(chargeableWeight, 1);
      recommendation = {
        transportMethod: (best as any).transportMethod || (best as any).method || "标准运输",
        totalPrice: price.toFixed(2),
        currency: best.currency || "RMB",
        transitTime: (best as any).transitTime || "",
        reason: `匹配 ${matched.length} 条规则，选最优价格`,
      };
      totalPrice += price;
    }

    resultItems.push({
      name: item.name,
      country: item.country,
      aiQuote: recommendation ? {
        recommendation,
        matchedRules: matched.slice(0, 5).map(r => ({
          transportMethod: (r as any).transportMethod || (r as any).method || "",
          currency: r.currency || "RMB",
          calculatedPrice: ((r.unitPrice || 0) * Math.max(chargeableWeight, 1)).toFixed(2),
          calculation: `${r.unitPrice} × ${chargeableWeight.toFixed(1)}kg`,
        })),
        analysis: `本地规则匹配，共匹配 ${matched.length} 条规则`,
        warnings: [],
      } : { analysis: "未找到匹配规则", warnings: ["无匹配规则，请检查价格表"], matchedRules: [] },
    });
  }

  return {
    success: true,
    currency: "RMB",
    totalRecommendedPrice: totalPrice.toFixed(2),
    items: resultItems,
    source: "local",
  };
}
'''
    with open(AI_SVC) as f: ai_src3 = f.read()
    # 在文件最后插入
    with open(AI_SVC, "w") as f:
        f.write(ai_src3.rstrip() + "\n" + LOCAL_MATCH_FN)
    print(f"  {PASS} [2b-注入localMatchQuote函数]")
    applied.append("2b-注入localMatchQuote函数")
else:
    print(f"  {PASS} [2b-localMatchQuote] 已存在，跳过")

# ══════════════════════════════════════════════════════════
print(f"\n{'='*60}")
print(f"  应用 {len(applied)}/{len(applied)+len(failed)} 项修复")
if failed: print(f"  {WARN} 未应用: {failed}")

# PM2 重启
print(f"\n{INFO} 重启 PM2...")
os.system("pm2 restart all --update-env 2>&1 | tail -6")
print(f"\n  {PASS} 完成！修复内容：")
print(f"     ① 上传报价单 → 本地存储 /opt/ogi-logistics/uploads/，通过 /uploads/ 路径访问")
print(f"     ② AI 自动报价 → 无 API Key 时自动用本地价格规则匹配计算")
print("="*60 + "\n")
