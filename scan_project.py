#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OGI Logistics Project Bug Scanner
只读扫描，不修改任何文件。
用法: python scan_project.py <项目根目录>
"""

import os
import re
import sys
import json
from collections import defaultdict
from pathlib import Path

# ─── 配置 ───────────────────────────────────────────────────────────────────
IGNORE_DIRS = {
    "node_modules", ".git", "dist", "dist-web", "server-dist",
    ".next", ".expo", "build", "__pycache__", ".manus"
}
CODE_EXTS = {".ts", ".tsx", ".js", ".jsx"}
# ────────────────────────────────────────────────────────────────────────────

def collect_files(root: Path):
    files = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in IGNORE_DIRS]
        for f in filenames:
            p = Path(dirpath) / f
            files.append(p)
    return files

def read_safe(p: Path) -> str:
    try:
        return p.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return ""

def relative(p: Path, root: Path) -> str:
    try:
        return str(p.relative_to(root))
    except ValueError:
        return str(p)

# ══════════════════════════════════════════════════════════════════════════════
# 1. 重复页面
# ══════════════════════════════════════════════════════════════════════════════
def check_duplicate_pages(files, root):
    issues = []
    name_map = defaultdict(list)
    page_dirs = {"app", "pages", "screens", "views"}
    for f in files:
        parts = set(f.parts)
        if f.suffix in CODE_EXTS and (parts & {p for p in f.parts if p in page_dirs} or "page" in f.stem.lower() or "screen" in f.stem.lower()):
            stem = f.stem.lower().replace("page", "").replace("screen", "").replace("index", "").strip("-_.")
            if stem:
                name_map[stem].append(relative(f, root))
    for name, paths in name_map.items():
        if len(paths) > 1:
            issues.append({"name": name, "files": paths})
    return issues

# ══════════════════════════════════════════════════════════════════════════════
# 2. 重复 API
# ══════════════════════════════════════════════════════════════════════════════
def check_duplicate_apis(files, root):
    issues = []
    # 匹配 router.get/post/put/delete/patch('/xxx') 或 app.get('/xxx')
    route_pattern = re.compile(
        r'(?:router|app)\s*\.\s*(get|post|put|delete|patch)\s*\(\s*[\'"]([^\'"]+)[\'"]',
        re.IGNORECASE
    )
    route_map = defaultdict(list)
    for f in files:
        if f.suffix not in CODE_EXTS:
            continue
        content = read_safe(f)
        for m in route_pattern.finditer(content):
            method, path = m.group(1).upper(), m.group(2)
            key = f"{method} {path}"
            route_map[key].append(relative(f, root))
    for route, paths in route_map.items():
        if len(paths) > 1:
            issues.append({"route": route, "files": list(set(paths))})
    return issues

# ══════════════════════════════════════════════════════════════════════════════
# 3. 重复数据库模型
# ══════════════════════════════════════════════════════════════════════════════
def check_duplicate_models(files, root):
    issues = []
    # Drizzle: export const xxxTable = pgTable('xxx', ...)
    # Prisma: model Xxx {
    table_pattern = re.compile(
        r'(?:export\s+const\s+(\w+)\s*=\s*(?:pgTable|mysqlTable|sqliteTable)\s*\(|^model\s+(\w+)\s*\{)',
        re.MULTILINE
    )
    model_map = defaultdict(list)
    for f in files:
        if f.suffix not in CODE_EXTS and f.suffix not in {".prisma"}:
            continue
        content = read_safe(f)
        for m in table_pattern.finditer(content):
            name = (m.group(1) or m.group(2) or "").lower()
            if name:
                model_map[name].append(relative(f, root))
    for name, paths in model_map.items():
        if len(paths) > 1:
            issues.append({"model": name, "files": list(set(paths))})
    return issues

# ══════════════════════════════════════════════════════════════════════════════
# 4. 无用依赖
# ══════════════════════════════════════════════════════════════════════════════
def check_unused_deps(root, files):
    issues = []
    pkg_path = root / "package.json"
    if not pkg_path.exists():
        return [{"note": "未找到 package.json"}]
    pkg = json.loads(read_safe(pkg_path))
    all_deps = set()
    for key in ("dependencies", "devDependencies", "peerDependencies"):
        all_deps.update(pkg.get(key, {}).keys())

    # 收集所有代码中的 import
    import_pattern = re.compile(
        r'''(?:import|require)\s*(?:[\w\s{},*]+\s+from\s+)?['"]([@\w][\w./\-]*)['"]'''
    )
    used = set()
    for f in files:
        if f.suffix not in CODE_EXTS:
            continue
        content = read_safe(f)
        for m in import_pattern.finditer(content):
            pkg_name = m.group(1)
            # 取包名（@scope/name 或 name）
            parts = pkg_name.split("/")
            if pkg_name.startswith("@"):
                used.add("/".join(parts[:2]))
            else:
                used.add(parts[0])

    unused = all_deps - used - {"typescript", "ts-node", "@types/node"}
    # 过滤掉明显是 bin/脚本工具包
    script_tools = {"cross-env", "concurrently", "nodemon", "tsx", "drizzle-kit",
                    "eslint", "prettier", "jest", "vitest", "husky", "lint-staged"}
    possibly_unused = unused - script_tools
    if possibly_unused:
        issues.append({"possibly_unused": sorted(possibly_unused)})
    return issues

# ══════════════════════════════════════════════════════════════════════════════
# 5. 命名混乱
# ══════════════════════════════════════════════════════════════════════════════
def check_naming(files, root):
    issues = []
    camel = re.compile(r'^[a-z][a-zA-Z0-9]*$')
    pascal = re.compile(r'^[A-Z][a-zA-Z0-9]*$')
    kebab = re.compile(r'^[a-z][a-z0-9\-]*$')
    snake = re.compile(r'^[a-z][a-z0-9_]*$')

    component_files, util_files, route_files = [], [], []
    for f in files:
        if f.suffix not in CODE_EXTS:
            continue
        stem = f.stem
        rel = relative(f, root)
        # 组件文件应为 PascalCase
        if any(p in f.parts for p in ("components", "screens", "views")):
            if stem != "index" and not pascal.match(stem):
                component_files.append(rel)
        # hooks 应为 camelCase 且以 use 开头
        if "hooks" in f.parts:
            if not stem.startswith("use") and stem != "index":
                issues.append({"type": "hook 命名不规范（应以 use 开头）", "file": rel})
        # API 路由文件建议 kebab-case
        if any(p in f.parts for p in ("routes", "api", "router")):
            if not kebab.match(stem) and stem != "index":
                route_files.append(rel)

    if component_files:
        issues.append({"type": "组件文件名应为 PascalCase", "files": component_files[:10]})
    if route_files:
        issues.append({"type": "路由文件名建议 kebab-case", "files": route_files[:10]})

    # 检测同一目录下混用命名风格
    dir_map = defaultdict(list)
    for f in files:
        if f.suffix in CODE_EXTS:
            dir_map[str(f.parent)].append(f.stem)
    for d, names in dir_map.items():
        has_camel = any(camel.match(n) for n in names if n != "index")
        has_pascal = any(pascal.match(n) for n in names if n != "index")
        if has_camel and has_pascal and len(names) > 2:
            rel_dir = str(Path(d).relative_to(root)) if Path(d).is_relative_to(root) else d
            issues.append({"type": "同目录混用 camelCase 和 PascalCase", "dir": rel_dir, "files": names[:6]})

    return issues

# ══════════════════════════════════════════════════════════════════════════════
# 6. 业务逻辑分散
# ══════════════════════════════════════════════════════════════════════════════
def check_business_logic(files, root):
    issues = []
    # 在 UI 组件中直接写 fetch/axios/数据库查询 是典型的业务逻辑分散
    fetch_pattern = re.compile(r'\bfetch\s*\(|axios\s*\.|supabase\.|drizzle\.|db\.')
    sql_pattern = re.compile(r'\b(?:select|insert|update|delete)\s+\w+\s+(?:from|into|set)\b', re.IGNORECASE)
    for f in files:
        if f.suffix not in CODE_EXTS:
            continue
        rel = relative(f, root)
        is_component = any(p in f.parts for p in ("components", "screens", "app", "views", "pages"))
        is_logic = any(p in f.parts for p in ("hooks", "services", "api", "server", "lib", "utils"))
        if is_component and not is_logic:
            content = read_safe(f)
            hits = []
            if fetch_pattern.search(content):
                hits.append("直接调用 fetch/axios/db")
            if sql_pattern.search(content):
                hits.append("内嵌 SQL 语句")
            if hits:
                issues.append({"file": rel, "problems": hits})
    return issues

# ══════════════════════════════════════════════════════════════════════════════
# 7. 安全风险
# ══════════════════════════════════════════════════════════════════════════════
def check_security(files, root):
    issues = []

    # 规则: (描述, 正则, 排除路径关键字)
    rules = [
        ("硬编码密码/密钥",
         re.compile(r'''(?:password|passwd|secret|api[_-]?key|token|auth[_-]?key)\s*[:=]\s*["'][^"']{6,}["']''', re.IGNORECASE),
         {"example", "test", "mock", "fixture", "sample", ".env.example"}),
        ("硬编码 JWT_SECRET",
         re.compile(r'''JWT_SECRET\s*[:=]\s*["'][^"']{4,}["']''', re.IGNORECASE),
         {"example", "test"}),
        ("console.log 输出敏感字段",
         re.compile(r'''console\.log\s*\([^)]*(?:password|token|secret|key)[^)]*\)''', re.IGNORECASE),
         set()),
        ("eval() 使用",
         re.compile(r'\beval\s*\('),
         set()),
        ("SQL 字符串拼接（注入风险）",
         re.compile(r'''(?:db|pool|connection)\s*\.\s*(?:query|execute)\s*\(\s*[`"'].*?\$\{'''),
         set()),
        ("innerHTML 赋值（XSS 风险）",
         re.compile(r'\.innerHTML\s*='),
         set()),
        ("dangerouslySetInnerHTML（XSS 风险）",
         re.compile(r'dangerouslySetInnerHTML'),
         set()),
        ("TODO/FIXME/HACK 标记",
         re.compile(r'\b(?:TODO|FIXME|HACK|XXX)\b'),
         set()),
        ("明文存储敏感信息到 localStorage",
         re.compile(r'''localStorage\s*\.\s*setItem\s*\([^)]*(?:token|password|secret)[^)]*\)''', re.IGNORECASE),
         set()),
        ("HTTP（非 HTTPS）API 地址",
         re.compile(r'''["']http://(?!localhost)[^"']{5,}["']'''),
         {".env", "readme", "config"}),
    ]

    for f in files:
        if f.suffix not in CODE_EXTS and f.suffix not in {".json", ".env"}:
            continue
        rel = relative(f, root).lower()
        content = read_safe(f)
        for desc, pattern, excludes in rules:
            if any(ex in rel for ex in excludes):
                continue
            matches = pattern.findall(content)
            if matches:
                issues.append({
                    "risk": desc,
                    "file": relative(f, root),
                    "occurrences": len(matches),
                    "sample": str(matches[0])[:120]
                })

    return issues

# ══════════════════════════════════════════════════════════════════════════════
# 8. 后期维护风险
# ══════════════════════════════════════════════════════════════════════════════
def check_maintenance(files, root):
    issues = []

    # 超大文件
    for f in files:
        if f.suffix in CODE_EXTS:
            try:
                lines = f.read_text(encoding="utf-8", errors="ignore").splitlines()
                if len(lines) > 500:
                    issues.append({"type": "超大文件（>500行）", "file": relative(f, root), "lines": len(lines)})
            except Exception:
                pass

    # any 类型滥用（TypeScript）
    any_pattern = re.compile(r':\s*any\b')
    for f in files:
        if f.suffix in {".ts", ".tsx"}:
            content = read_safe(f)
            count = len(any_pattern.findall(content))
            if count > 5:
                issues.append({"type": f"any 类型滥用（{count} 处）", "file": relative(f, root)})

    # 循环依赖检测（简单版：A import B，B import A）
    import_map = {}
    import_pattern = re.compile(r'''import\s+.*?from\s+['"](\.{1,2}/[^'"]+)['"]''')
    for f in files:
        if f.suffix not in CODE_EXTS:
            continue
        content = read_safe(f)
        imports = set()
        for m in import_pattern.finditer(content):
            raw = m.group(1)
            resolved = (f.parent / raw).resolve()
            imports.add(str(resolved))
        import_map[str(f.resolve())] = imports

    for fa, imports_a in import_map.items():
        for fb in imports_a:
            fb_imports = import_map.get(fb, set())
            if any(fa in x or fa.replace(".tsx", "").replace(".ts", "") in x for x in fb_imports):
                rel_a = str(Path(fa).relative_to(root.resolve())) if Path(fa).is_relative_to(root.resolve()) else fa
                rel_b = str(Path(fb).relative_to(root.resolve())) if Path(fb).is_relative_to(root.resolve()) else fb
                issues.append({"type": "疑似循环依赖", "files": [rel_a, rel_b]})

    # 空 catch 块
    empty_catch = re.compile(r'catch\s*\([^)]*\)\s*\{\s*\}')
    for f in files:
        if f.suffix in CODE_EXTS:
            content = read_safe(f)
            if empty_catch.search(content):
                issues.append({"type": "空 catch 块（吞掉错误）", "file": relative(f, root)})

    return issues

# ══════════════════════════════════════════════════════════════════════════════
# 主流程
# ══════════════════════════════════════════════════════════════════════════════
def main():
    if len(sys.argv) < 2:
        print("用法: python scan_project.py <项目根目录>")
        print("示例: python scan_project.py /path/to/ogi-logistics")
        sys.exit(1)

    root = Path(sys.argv[1]).resolve()
    if not root.exists():
        print(f"路径不存在: {root}")
        sys.exit(1)

    print(f"\n{'='*60}")
    print(f"  OGI Logistics 项目扫描报告")
    print(f"  扫描路径: {root}")
    print(f"{'='*60}\n")

    print("正在收集文件...")
    all_files = collect_files(root)
    code_files = [f for f in all_files if f.suffix in CODE_EXTS]
    print(f"共找到 {len(all_files)} 个文件，其中代码文件 {len(code_files)} 个\n")

    results = {}

    # ── 1. 重复页面 ──
    print("【1/8】检查重复页面...")
    r = check_duplicate_pages(code_files, root)
    results["重复页面"] = r
    print(f"  发现 {len(r)} 处疑似重复\n")

    # ── 2. 重复 API ──
    print("【2/8】检查重复 API...")
    r = check_duplicate_apis(code_files, root)
    results["重复API"] = r
    print(f"  发现 {len(r)} 处疑似重复\n")

    # ── 3. 重复数据库模型 ──
    print("【3/8】检查重复数据库模型...")
    r = check_duplicate_models(all_files, root)
    results["重复数据库模型"] = r
    print(f"  发现 {len(r)} 处疑似重复\n")

    # ── 4. 无用依赖 ──
    print("【4/8】检查无用依赖...")
    r = check_unused_deps(root, code_files)
    results["无用依赖"] = r
    print(f"  分析完成\n")

    # ── 5. 命名混乱 ──
    print("【5/8】检查命名规范...")
    r = check_naming(code_files, root)
    results["命名混乱"] = r
    print(f"  发现 {len(r)} 处问题\n")

    # ── 6. 业务逻辑分散 ──
    print("【6/8】检查业务逻辑分散...")
    r = check_business_logic(code_files, root)
    results["业务逻辑分散"] = r
    print(f"  发现 {len(r)} 处问题\n")

    # ── 7. 安全风险 ──
    print("【7/8】检查安全风险...")
    r = check_security(all_files, root)
    results["安全风险"] = r
    print(f"  发现 {len(r)} 处风险\n")

    # ── 8. 维护风险 ──
    print("【8/8】检查维护风险...")
    r = check_maintenance(code_files, root)
    results["后期维护风险"] = r
    print(f"  发现 {len(r)} 处风险\n")

    # ── 输出详细报告 ──
    print(f"\n{'='*60}")
    print("  详细扫描结果")
    print(f"{'='*60}\n")

    for category, items in results.items():
        print(f"\n▶ {category} ({len(items)} 项)")
        print("-" * 50)
        if not items:
            print("  ✓ 未发现问题")
            continue
        for item in items:
            print(f"  • {json.dumps(item, ensure_ascii=False, indent=4)}")

    # ── 保存 JSON 结果 ──
    out_path = root / "scan_report.json"
    with open(out_path, "w", encoding="utf-8") as fp:
        json.dump(results, fp, ensure_ascii=False, indent=2)
    print(f"\n{'='*60}")
    print(f"  完整报告已保存到: {out_path}")
    print(f"{'='*60}\n")

if __name__ == "__main__":
    main()
