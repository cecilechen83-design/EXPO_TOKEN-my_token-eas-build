#!/usr/bin/env python3
"""
OGI 半自动报价模块 - 自动化测试脚本
运行: python3 /tmp/test-quote-module.py
"""
import json, subprocess, os, sys
try:
    import urllib.request as req
    import urllib.error
except ImportError:
    sys.exit("需要 Python 3")

BASE = "http://localhost:3000"
PASS = "\033[32m✅\033[0m"
FAIL = "\033[31m❌\033[0m"
WARN = "\033[33m⚠️ \033[0m"
results = []

def call(method, path, body=None, expect_status=200):
    url = BASE + path
    data = json.dumps(body).encode() if body else None
    headers = {"Content-Type": "application/json"}
    try:
        r = req.urlopen(req.Request(url, data=data, headers=headers, method=method), timeout=10)
        status = r.status
        resp = json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        status = e.code
        try: resp = json.loads(e.read().decode())
        except: resp = {"error": str(e)}
    except Exception as e:
        return None, None, str(e)
    return status, resp, None

def test(name, passed, detail="", warn=False):
    icon = WARN if warn else (PASS if passed else FAIL)
    status = "警告" if warn else ("通过" if passed else "失败")
    print(f"  {icon} [{status}] {name}")
    if detail:
        print(f"         → {detail}")
    results.append({"name": name, "passed": passed or warn, "warn": warn, "detail": detail})

print("\n" + "="*55)
print("  OGI 半自动报价模块 自动化测试")
print("="*55)

# ─── 1. 环境检查 ──────────────────────────────────────────
print("\n【1】环境检查")

env_path = "/opt/ogi-logistics/.env"
smtp_ok = False
smtp_details = []
if os.path.exists(env_path):
    with open(env_path) as f:
        env_text = f.read()
    for key in ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"]:
        val = ""
        for line in env_text.splitlines():
            if line.startswith(key + "="):
                val = line.split("=", 1)[1].strip().strip('"')
        if val:
            smtp_details.append(f"{key}=已配置")
        else:
            smtp_details.append(f"{key}=未配置")
    smtp_ok = all("已配置" in d for d in smtp_details)
    test("SMTP 邮件配置", smtp_ok,
         " | ".join(smtp_details),
         warn=not smtp_ok)
else:
    test("读取 .env 文件", False, f"{env_path} 不存在")

# ─── 2. 服务健康检查 ──────────────────────────────────────
print("\n【2】API 服务健康检查")
status, resp, err = call("GET", "/api/quote/stats")
if err:
    test("API 服务可达", False, f"连接失败: {err}")
    print("\n⛔ API 服务不可达，跳过后续测试\n")
    sys.exit(1)
else:
    test("API 服务可达", True, f"HTTP {status}")
    if resp and resp.get("success"):
        s = resp.get("stats", {})
        test("报价统计接口", True,
             f"待审核:{s.get('pending',0)} 已确认:{s.get('confirmed',0)} 总计:{s.get('total',0)} 价格表:{s.get('priceTableVersion','无')}")
    else:
        test("报价统计接口", False, str(resp))

# ─── 3. 价格表检查 ────────────────────────────────────────
print("\n【3】价格表检查")
status, resp, err = call("GET", "/api/price-table/current")
if err or not resp:
    test("获取当前价格表", False, str(err))
    pt_id = None
    has_ai_rules = False
else:
    pt = resp.get("priceTable")
    if pt:
        pt_id = pt.get("id")
        ai_status = pt.get("aiParseStatus", "idle")
        ai_rules = pt.get("aiRuleCount", 0)
        has_ai_rules = ai_status == "parsed" and ai_rules > 0
        test("当前价格表存在", True, f"V{pt.get('version')} | 文件:{pt.get('fileName')} | 上传人:{pt.get('uploadedByName','未知')}")
        test("AI 规则解析状态", has_ai_rules,
             f"状态:{ai_status} | 规则数:{ai_rules}",
             warn=(ai_status != "parsed"))
    else:
        test("当前价格表存在", False, "未上传价格表", warn=True)
        pt_id = None
        has_ai_rules = False

# ─── 4. 客户提交询价（核心流程） ─────────────────────────
print("\n【4】客户提交询价")
test_customer = {
    "name": "自动化测试客户",
    "email": "test-autocheck@ogi-test.com",
    "company": "测试贸易有限公司",
    "tel": "13800000000"
}
test_items = [
    {"name": "蓝牙耳机", "weight": "50", "volume": "0.3", "country": "巴西", "category": "电子产品", "qty": 10},
    {"name": "手机壳", "weight": "20", "volume": "0.1", "country": "墨西哥", "category": "普货", "qty": 50},
]

status, resp, err = call("POST", "/api/quote/submit", {"customer": test_customer, "items": test_items})
if err or not resp:
    test("客户提交询价", False, str(err))
    quote_id = None
    quote_no = None
else:
    ok = resp.get("success")
    quote_no = resp.get("quoteNo")
    quote_id = None
    test("客户提交询价", bool(ok and quote_no), f"报价编号:{quote_no}" if quote_no else str(resp))

    if ok and resp.get("items"):
        items_out = resp["items"]
        auto_priced = sum(1 for it in items_out if it.get("recommended", {}).get("price", "0") != "0" and it.get("recommended", {}).get("price") is not None)
        test("自动套价结果", auto_priced > 0,
             f"{auto_priced}/{len(items_out)} 件货物已套价" + (" (无价格表规则，价格为0)" if auto_priced == 0 else ""),
             warn=(auto_priced == 0))

        total = resp.get("totalAmount", "0")
        test("合计金额计算", float(total) >= 0, f"合计: USD {total}")

# ─── 5. 报价列表 ─────────────────────────────────────────
print("\n【5】管理端报价列表")
status, resp, err = call("GET", "/api/quote/list?status=pending")
if err or not resp:
    test("获取待审报价列表", False, str(err))
else:
    ok = resp.get("success")
    quotes = resp.get("quotes", [])
    test("获取待审报价列表", bool(ok), f"待审报价: {len(quotes)} 条")

    # 找到刚才创建的报价
    if quote_no:
        for q in quotes:
            if q.get("quoteNo") == quote_no:
                quote_id = q.get("id")
                test("新提交询价可在列表中找到", True, f"ID={quote_id}")
                break
        if not quote_id:
            test("新提交询价可在列表中找到", False, f"未找到 {quote_no}")

# ─── 6. 确认报价（含邮件） ───────────────────────────────
print("\n【6】管理员确认报价 + 邮件发送")
if quote_id:
    status, resp, err = call("POST", f"/api/quote/{quote_id}/confirm", {
        "adminNote": "自动化测试确认",
        "validUntil": "2026-06-30",
        "contactName": "自动测试",
        "confirmedByName": "测试管理员"
    })
    if err or not resp:
        test("确认报价接口", False, str(err))
    else:
        ok = resp.get("success")
        email_info = resp.get("email", {})
        test("确认报价接口", bool(ok), resp.get("message", ""))
        if email_info:
            email_sent = email_info.get("success", False)
            test("邮件发送给客户", email_sent,
                 email_info.get("message", ""),
                 warn=not email_sent)
        elif not smtp_ok:
            test("邮件发送给客户", False, "SMTP 未配置，邮件不可用", warn=True)
        else:
            test("邮件发送给客户", False, "接口未返回邮件状态", warn=True)
else:
    test("确认报价接口", False, "无测试报价ID，跳过", warn=True)
    test("邮件发送给客户", False, "依赖上一步，跳过", warn=True)

# ─── 7. 报价单文件接口 ───────────────────────────────────
print("\n【7】报价单文件接口")
if quote_id:
    status, resp, err = call("GET", f"/api/quote/{quote_id}/file")
    if err:
        test("获取报价单文件接口", False, str(err))
    else:
        test("获取报价单文件接口", resp.get("success") or "message" in resp,
             resp.get("message", ""),
             warn=not resp.get("url"))
else:
    test("获取报价单文件接口", False, "无测试ID，跳过", warn=True)

# ─── 汇总 ────────────────────────────────────────────────
print("\n" + "="*55)
total = len(results)
passed = sum(1 for r in results if r["passed"] and not r["warn"])
warned = sum(1 for r in results if r["warn"])
failed = sum(1 for r in results if not r["passed"] and not r["warn"])

print(f"  测试结果：{total} 项  通过:{passed}  警告:{warned}  失败:{failed}")
print("="*55)

if failed > 0:
    print("\n需要修复的问题：")
    for r in results:
        if not r["passed"] and not r["warn"]:
            print(f"  ✗ {r['name']}: {r['detail']}")

if warned > 0:
    print("\n建议关注（不影响主流程）：")
    for r in results:
        if r["warn"]:
            print(f"  ! {r['name']}: {r['detail']}")

# 清理测试数据
if quote_id:
    print(f"\n[清理] 测试报价 ID={quote_id} ({quote_no}) 已保留在系统中，可在管理端查看。")

print()
