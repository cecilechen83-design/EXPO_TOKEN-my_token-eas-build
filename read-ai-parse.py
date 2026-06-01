#!/usr/bin/env python3
"""读取 AI 解析价格表相关代码"""
import os

ROUTE = "/opt/ogi-logistics/server/quote-request-routes.ts"

with open(ROUTE) as f:
    lines = f.readlines()

print(f"=== quote-request-routes.ts 共 {len(lines)} 行 ===\n")

# 找 AI parse 相关段落 (L650 附近)
sections = [
    ("AI解析端点 L640-L720", 639, 720),
    ("价格表上传 L180-L240", 179, 240),
]

for title, start, end in sections:
    print(f"\n{'='*60}")
    print(f"  {title}")
    print('='*60)
    for i, line in enumerate(lines[start:end], start=start+1):
        print(f"L{i:4d}: {line}", end="")

# 也找所有包含 AI / prompt / Claude / OpenAI / rules 的行
print(f"\n\n{'='*60}")
print("  AI/prompt 关键行")
print('='*60)
for i, line in enumerate(lines, 1):
    if any(kw in line for kw in ["prompt", "claude", "openai", "anthropic", "gpt", "aiRules", "ai_rules", "parsedRules", "ruleCount", "rule_count", "extractRule", "parsePrice"]):
        print(f"L{i:4d}: {line}", end="")

# 找数据库中最新的价格表数据
print(f"\n\n{'='*60}")
print("  数据库：当前价格表 AI 解析状态")
print('='*60)
try:
    import subprocess
    r = subprocess.run(
        ["node", "-e", """
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.priceTable.findFirst({ orderBy: { createdAt: 'desc' } }).then(t => {
  if (!t) { console.log('无价格表'); return; }
  console.log('ID:', t.id);
  console.log('文件名:', t.fileName);
  console.log('AI状态:', t.aiParseStatus);
  console.log('AI规则数:', t.aiRuleCount);
  console.log('AI错误:', t.aiParseError);
  console.log('rulesJson长度:', t.rulesJson ? t.rulesJson.length : 0);
  if (t.rulesJson) {
    try {
      const r = JSON.parse(t.rulesJson);
      console.log('rulesJson类型:', Array.isArray(r) ? 'array' : typeof r);
      if (Array.isArray(r) && r.length > 0) {
        console.log('第一条:', JSON.stringify(r[0]).slice(0, 200));
      }
    } catch(e) { console.log('rulesJson解析失败:', e.message); }
  }
  if (t.aiParsedRules) {
    try {
      const r = JSON.parse(t.aiParsedRules);
      console.log('aiParsedRules条数:', Array.isArray(r) ? r.length : 'N/A');
      if (Array.isArray(r) && r.length > 0) console.log('第一条:', JSON.stringify(r[0]).slice(0, 200));
    } catch(e) { console.log('aiParsedRules解析失败:', e.message); }
  }
  process.exit(0);
}).catch(e => { console.log('DB错误:', e.message); process.exit(0); });
"""],
        cwd="/opt/ogi-logistics",
        capture_output=True, text=True, timeout=15
    )
    print(r.stdout or "(无输出)")
    if r.stderr: print("STDERR:", r.stderr[:500])
except Exception as e:
    print(f"运行失败: {e}")
