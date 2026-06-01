#!/usr/bin/env python3
"""读取 ai-quote-service.ts 和 storage.ts"""
for path in [
    "/opt/ogi-logistics/server/ai-quote-service.ts",
    "/opt/ogi-logistics/server/storage.ts",
]:
    print(f"\n{'='*60}\n  {path}\n{'='*60}")
    try:
        with open(path) as f:
            lines = f.readlines()
        print(f"共 {len(lines)} 行")
        for i, l in enumerate(lines, 1):
            print(f"L{i:4d}: {l}", end="")
    except Exception as e:
        print(f"读取失败: {e}")
