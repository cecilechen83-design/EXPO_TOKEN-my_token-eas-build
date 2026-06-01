#!/usr/bin/env python3
"""读取 AI 解析相关代码段"""
import os, subprocess

ROUTE = "/opt/ogi-logistics/server/quote-request-routes.ts"

with open(ROUTE) as f:
    lines = f.readlines()

print(f"共 {len(lines)} 行\n")

# 1. extractRulesFromSheets 函数 (L1-120)
print("="*60)
print("【1】extractRulesFromSheets 函数 (L1-120)")
print("="*60)
for i, l in enumerate(lines[:120], 1):
    print(f"L{i:4d}: {l}", end="")

# 2. AI parse endpoint (L640-760)
print("\n\n" + "="*60)
print("【2】AI 解析端点 (L640-760)")
print("="*60)
for i, l in enumerate(lines[639:760], 640):
    print(f"L{i:4d}: {l}", end="")

# 3. 数据库查询 (Python 3.6 兼容)
print("\n\n" + "="*60)
print("【3】数据库：价格表 AI 状态")
print("="*60)
node_script = """
var PrismaClient;
try { PrismaClient = require('@prisma/client').PrismaClient; } catch(e) { console.log('prisma不可用'); process.exit(0); }
var p = new PrismaClient();
p.priceTable.findFirst({ orderBy: { createdAt: 'desc' } }).then(function(t) {
  if (!t) { console.log('无价格表'); process.exit(0); return; }
  console.log('ID:', t.id, '| 文件:', t.fileName, '| AI状态:', t.aiParseStatus, '| AI规则数:', t.aiRuleCount);
  console.log('rulesJson长度:', t.rulesJson ? t.rulesJson.length : 0);
  console.log('aiParsedRules长度:', t.aiParsedRules ? t.aiParsedRules.length : 0);
  if (t.rulesJson) {
    try {
      var r = JSON.parse(t.rulesJson);
      if (Array.isArray(r) && r.length > 0) {
        console.log('rulesJson[0] keys:', Object.keys(r[0]).join(', '));
        console.log('rulesJson[0]:', JSON.stringify(r[0]).slice(0, 300));
      } else if (r && typeof r === 'object' && r.sheets) {
        console.log('rulesJson.sheets条数:', r.sheets.length);
        if (r.sheets[0]) {
          console.log('第一个Sheet名:', r.sheets[0].name);
          console.log('第一个Sheet headers:', r.sheets[0].headers);
          console.log('第一行数据:', r.sheets[0].rows ? JSON.stringify(r.sheets[0].rows[0]) : '无');
        }
      }
    } catch(e) { console.log('rulesJson解析失败:', e.message); }
  }
  if (t.aiParsedRules) {
    try {
      var r2 = JSON.parse(t.aiParsedRules);
      console.log('aiParsedRules条数:', Array.isArray(r2) ? r2.length : 'N/A');
      if (Array.isArray(r2) && r2.length > 0) console.log('第一条:', JSON.stringify(r2[0]).slice(0, 200));
    } catch(e) { console.log('aiParsedRules解析失败:', e.message); }
  }
  process.exit(0);
}).catch(function(e) { console.log('DB错误:', e.message); process.exit(0); });
"""
try:
    proc = subprocess.Popen(
        ["node", "-e", node_script],
        cwd="/opt/ogi-logistics",
        stdout=subprocess.PIPE, stderr=subprocess.PIPE
    )
    out, err = proc.communicate(timeout=15)
    print(out.decode("utf-8", errors="replace"))
    if err: print("STDERR:", err.decode("utf-8", errors="replace")[:300])
except Exception as e:
    print(f"运行失败: {e}")

# 4. 搜索 AI API key 和调用
print("\n" + "="*60)
print("【4】AI API 配置检查")
print("="*60)
env_path = "/opt/ogi-logistics/.env"
if os.path.exists(env_path):
    with open(env_path) as f:
        for l in f:
            if any(k in l for k in ["ANTHROPIC", "OPENAI", "CLAUDE", "GPT", "AI_KEY", "AI_MODEL"]):
                key = l.split("=")[0].strip()
                val = l.split("=", 1)[1].strip() if "=" in l else ""
                masked = val[:8] + "***" if len(val) > 8 else ("已设置" if val else "未设置")
                print(f"  {key} = {masked}")
else:
    print("  .env 不存在")
