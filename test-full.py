#!/usr/bin/env python3
"""
test-full.py — 全流程自动化测试（报价模块 + AI + 文件上传）
"""
import json, urllib.request, urllib.error, base64, time, os, sys

BASE = "http://localhost:3000"
PASS = "\033[32m✅\033[0m"; FAIL = "\033[31m❌\033[0m"
WARN = "\033[33m⚠ \033[0m"; INFO = "\033[36mℹ \033[0m"
results = []

def api(method, path, body=None, expect=200):
    url = BASE + path
    data = json.dumps(body).encode() if body else None
    hdrs = {"Content-Type": "application/json"}
    try:
        r = urllib.request.urlopen(
            urllib.request.Request(url, data=data, headers=hdrs, method=method), timeout=15)
        return r.status, json.loads(r.read().decode()), None
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read().decode()), None
        except: return e.code, {}, str(e)
    except Exception as e:
        return None, {}, str(e)

def chk(name, ok, detail="", warn=False):
    icon = WARN if warn else (PASS if ok else FAIL)
    label = "警告" if warn else ("通过" if ok else "失败")
    print(f"  {icon} [{label}] {name}")
    if detail: print(f"         → {detail}")
    results.append({"name": name, "ok": ok or warn, "warn": warn, "detail": detail})

print("\n" + "="*60)
print("  OGI 全流程自动化测试")
print("="*60)

# ── 1. 服务健康 ───────────────────────────────────────────
print("\n【1】服务健康检查")
s, r, e = api("GET", "/api/quote-stats")
if e:
    chk("API 服务可达", False, f"连接失败: {e}")
    print("\n⛔ 服务不可达，终止测试\n"); sys.exit(1)
chk("API 服务可达", True, f"HTTP {s}")
if r.get("success"):
    st = r.get("stats", {})
    chk("报价统计接口", True,
        f"待审核:{st.get('pending',0)} 已确认:{st.get('confirmed',0)} 总计:{st.get('total',0)} 价格表:{st.get('priceTableVersion','无')}")
else:
    chk("报价统计接口", False, str(r))

# ── 2. 价格表 + AI 规则 ────────────────────────────────────
print("\n【2】价格表 & AI 规则")
s, r, e = api("GET", "/api/price-table/current")
pt_id = None
rule_count = 0
if e or not r.get("priceTable"):
    chk("当前价格表", False, str(e or "无价格表"), warn=True)
else:
    pt = r["priceTable"]
    pt_id = pt.get("id")
    ai_status = pt.get("aiParseStatus", "idle")
    rule_count = pt.get("aiRuleCount") or 0
    chk("当前价格表", True, f"V{pt.get('version')} | {pt.get('fileName')} | AI:{ai_status} | 规则:{rule_count}")

# 如果规则数为0，触发重新解析
if rule_count == 0 and pt_id:
    print(f"  {INFO} 触发 AI 解析...")
    s2, r2, e2 = api("POST", "/api/price-table/ai-parse", {"priceTableId": pt_id})
    chk("触发 AI 解析", bool(r2.get("success")), r2.get("message","") if not e2 else e2, warn=True)
    time.sleep(8)
    s3, r3, e3 = api("GET", "/api/price-table/ai-status")
    if not e3:
        rule_count = r3.get("ruleCount", 0)
        chk("AI 解析结果", rule_count > 0,
            f"状态:{r3.get('status')} | 规则:{rule_count}", warn=(rule_count == 0))

# ── 3. 客户提交询价 ────────────────────────────────────────
print("\n【3】客户提交询价")
s, r, e = api("POST", "/api/quote/submit", {
    "customer": {"name":"自动测试客户","email":"autotest@ogi-test.com","company":"测试公司","tel":"13800000000"},
    "items": [
        {"name":"手机壳","weight":"50","volume":"0.3","country":"墨西哥","category":"普货","qty":10},
        {"name":"蓝牙耳机","weight":"80","volume":"0.5","country":"墨西哥","category":"电子产品","qty":5},
    ]
})
quote_id = None; quote_no = None
if e or not r.get("success"):
    chk("提交询价", False, str(e or r))
else:
    quote_no = r.get("quoteNo")
    items_out = r.get("items", [])
    auto_priced = sum(1 for it in items_out if float((it.get("recommended") or {}).get("price","0") or 0) > 0)
    chk("提交询价", True, f"编号:{quote_no}")
    chk("自动套价", auto_priced > 0,
        f"{auto_priced}/{len(items_out)} 件已套价",
        warn=(auto_priced == 0))
    total = float(r.get("totalAmount","0") or 0)
    chk("合计金额", total >= 0, f"USD {r.get('totalAmount','0')}")

# ── 4. 找到刚提交的报价 ────────────────────────────────────
print("\n【4】管理端报价列表")
s, r, e = api("GET", "/api/quote/list?status=pending")
if e or not r.get("success"):
    chk("获取待审列表", False, str(e or r))
else:
    quotes = r.get("quotes", [])
    chk("获取待审列表", True, f"{len(quotes)} 条待审报价")
    if quote_no:
        for q in quotes:
            if q.get("quoteNo") == quote_no:
                quote_id = q.get("id"); break
        chk("新报价在列表中", bool(quote_id), f"ID={quote_id}" if quote_id else f"未找到 {quote_no}")

# ── 5. AI 自动报价 ─────────────────────────────────────────
print("\n【5】AI 自动报价（本地规则匹配兜底）")
if quote_id:
    s, r, e = api("POST", f"/api/quote-request/{quote_id}/ai-quote", {})
    if e or not r.get("success"):
        chk("AI 自动报价", False, str(e or r.get("message","")))
    else:
        total_ai = r.get("totalRecommendedPrice","0")
        source   = r.get("source","ai")
        items_ai = r.get("items",[])
        has_rec  = any((it.get("aiQuote") or {}).get("recommendation") for it in items_ai)
        chk("AI 自动报价", True,
            f"总价:{r.get('currency','RMB')} {total_ai} | 来源:{source} | 有推荐:{has_rec}")
else:
    chk("AI 自动报价", False, "无报价ID，跳过", warn=True)

# ── 6. 上传报价单文件（本地存储兜底）─────────────────────
print("\n【6】上传报价单文件")
if quote_id:
    # 构造一个最小的 PDF-like 文件内容（纯文本模拟）
    fake_content = b"%PDF-1.4 test quote file for autotest"
    b64 = base64.b64encode(fake_content).decode()
    s, r, e = api("POST", f"/api/quote/{quote_id}/upload-file", {
        "fileName": "autotest-quote.pdf",
        "fileData": b64,
        "contentType": "application/pdf",
    })
    if e:
        chk("上传报价单", False, str(e))
    else:
        ok = r.get("success")
        url = r.get("url","")
        chk("上传报价单", bool(ok),
            f"URL:{url[:60]}..." if url else (r.get("message","") or str(r)))
        if ok and url:
            # 验证文件可访问
            try:
                ur = urllib.request.urlopen(url, timeout=5)
                chk("文件可访问", ur.status == 200, f"HTTP {ur.status}")
            except Exception as ex:
                chk("文件可访问", False, str(ex), warn=True)
else:
    chk("上传报价单", False, "无报价ID，跳过", warn=True)

# ── 7. 确认报价 ────────────────────────────────────────────
print("\n【7】确认报价 + 邮件")
if quote_id:
    s, r, e = api("POST", f"/api/quote/{quote_id}/confirm", {
        "adminNote": "自动化测试确认",
        "validUntil": "2026-12-31",
        "contactName": "自动测试",
        "confirmedByName": "测试管理员",
    })
    if e or not r.get("success"):
        chk("确认报价", False, str(e or r.get("message","")))
    else:
        chk("确认报价", True, r.get("message",""))
        em = r.get("email", {})
        if em:
            chk("邮件发送", bool(em.get("success")), em.get("message",""), warn=not em.get("success"))
        else:
            chk("邮件发送", False, "接口未返回邮件信息", warn=True)
else:
    chk("确认报价", False, "无报价ID，跳过", warn=True)

# ── 汇总 ──────────────────────────────────────────────────
print("\n" + "="*60)
total  = len(results)
passed = sum(1 for r in results if r["ok"] and not r["warn"])
warned = sum(1 for r in results if r["warn"])
failed = sum(1 for r in results if not r["ok"] and not r["warn"])
print(f"  结果：{total} 项  通过:{passed}  警告:{warned}  失败:{failed}")
print("="*60)
if failed:
    print("\n需要修复：")
    for r in results:
        if not r["ok"] and not r["warn"]:
            print(f"  ✗ {r['name']}: {r['detail']}")
if warned:
    print("\n警告（不影响主流程）：")
    for r in results:
        if r["warn"]:
            print(f"  ! {r['name']}: {r['detail']}")
if quote_id:
    print(f"\n测试报价 ID={quote_id} ({quote_no}) 已保留，可在管理端查看。\n")
