import { useState, useCallback, useEffect } from "react";
import {
  Text, View, TouchableOpacity, ScrollView, TextInput,
  StyleSheet, Alert, Platform, ActivityIndicator, useWindowDimensions, Modal,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { WebLayout } from "@/components/web-sidebar";
import { AuthGuard } from "@/components/auth-guard";
import { useAuth } from "@/lib/auth-context";
import { IconSymbol } from "@/components/ui/icon-symbol";

const CHANNELS = ["海运整柜", "海运拼柜", "空运", "快递", "小包", "铁路", "卡车"];

function showAlert(title: string, message?: string) {
  if (Platform.OS === "web") window.alert(message ? `${title}\n${message}` : title);
  else Alert.alert(title, message ?? "");
}

async function apiPost(path: string, body: any) {
  const r = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}
async function apiGet(path: string) {
  const r = await fetch(path, { credentials: "include" });
  return r.json();
}

type CalcResult = {
  success: boolean;
  tableInfo?: { id: number; fileName: string; country: string; channel: string; currency: string };
  chargeableWeight?: number;
  unitPrice?: number;
  freightBase?: number;
  freightFormula?: string;
  surcharges?: { name: string; amount: number; formula?: string }[];
  totalPrice?: number;
  currency?: string;
  matchedRule?: any;
  message?: string;
};

type QuoteRequest = {
  id: number;
  quoteNo: string;
  status: string;
  createdAt: string;
  customerName: string;
  customerEmail: string;
  customerCompany: string;
  totalWeight: number;
  totalVolume: number;
  itemCount: number;
  items: any[];
  adminNote?: string;
  confirmedBy?: string;
  confirmedAt?: string;
  quoteFileUrl?: string;
};

export default function QuoteManageScreen() {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<"calc" | "inquiries">("calc");

  // ── Pricing Calculator State ──────────────────────────────
  const [calcCountry, setCalcCountry] = useState("");
  const [calcChannel, setCalcChannel] = useState("");
  const [calcWeight, setCalcWeight] = useState("");
  const [calcVolume, setCalcVolume] = useState("");
  const [calcQty, setCalcQty] = useState("1");
  const [calcName, setCalcName] = useState("");
  const [calcCategory, setCalcCategory] = useState("");
  const [calcResult, setCalcResult] = useState<CalcResult | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);

  // Manual adjustment & surcharges
  const [manualSurcharges, setManualSurcharges] = useState<{ name: string; amount: string }[]>([]);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [clientName, setClientName] = useState("");
  const [quoteNote, setQuoteNote] = useState("");

  // Available countries/channels from price tables
  const [availCountries, setAvailCountries] = useState<string[]>([]);
  const [availChannels, setAvailChannels] = useState<string[]>(CHANNELS);

  // ── Inquiry List State ────────────────────────────────────
  const [inquiries, setInquiries] = useState<QuoteRequest[]>([]);
  const [inquiriesLoading, setInquiriesLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [inlineCalcId, setInlineCalcId] = useState<number | null>(null);
  const [inlineResult, setInlineResult] = useState<CalcResult | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ visible: boolean; quote: QuoteRequest | null }>({ visible: false, quote: null });
  const [confirmNote, setConfirmNote] = useState("");
  const [confirmExpiry, setConfirmExpiry] = useState("");

  // Load available countries from price tables
  useEffect(() => {
    apiGet("/api/price-table/countries").then(res => {
      if (res.success && res.countries?.length) setAvailCountries(res.countries);
    }).catch(() => {});
  }, []);

  // Load inquiries
  const loadInquiries = useCallback(async () => {
    setInquiriesLoading(true);
    try {
      const res = await apiGet(`/api/quote-requests?status=${statusFilter}`);
      if (res.success) setInquiries(res.quotes || []);
    } catch (e) { console.error(e); }
    setInquiriesLoading(false);
  }, [statusFilter]);

  useEffect(() => { if (activeTab === "inquiries") loadInquiries(); }, [activeTab, loadInquiries]);

  // ── Calculate price ───────────────────────────────────────
  const handleCalculate = async () => {
    if (!calcCountry.trim()) { showAlert("提示", "请填写目的国"); return; }
    if (!calcChannel) { showAlert("提示", "请选择渠道"); return; }
    const weight = parseFloat(calcWeight);
    const volume = parseFloat(calcVolume) || 0;
    if (!weight || weight <= 0) { showAlert("提示", "请输入有效重量"); return; }

    setCalcLoading(true);
    setCalcResult(null);
    try {
      const res = await apiPost("/api/price-table/calculate", {
        country: calcCountry.trim(),
        channel: calcChannel,
        weight,
        volume,
        qty: parseInt(calcQty) || 1,
        category: calcCategory,
      });
      setCalcResult(res);
      if (!res.success) showAlert("计算失败", res.message || "未找到匹配报价表");
    } catch (err: any) {
      showAlert("错误", err.message);
    }
    setCalcLoading(false);
  };

  // ── Inline calculate for inquiry ─────────────────────────
  const handleInlineCalc = async (inquiry: QuoteRequest, channel: string) => {
    if (!channel) { showAlert("提示", "请选择渠道"); return; }
    setInlineCalcId(inquiry.id);
    setInlineResult(null);
    const weight = inquiry.totalWeight || inquiry.items?.reduce((s: number, i: any) => s + (parseFloat(i.weight) || 0), 0) || 0;
    const volume = inquiry.totalVolume || inquiry.items?.reduce((s: number, i: any) => s + (parseFloat(i.volume) || 0), 0) || 0;
    const country = inquiry.items?.[0]?.country || "";
    try {
      const res = await apiPost("/api/price-table/calculate", {
        country, channel, weight, volume,
        qty: inquiry.itemCount || 1,
      });
      setInlineResult(res);
      if (!res.success) showAlert("计算失败", res.message || "未找到匹配报价表");
    } catch (err: any) {
      showAlert("错误", err.message);
    }
    setInlineCalcId(null);
  };

  // ── Confirm inquiry ───────────────────────────────────────
  const handleConfirm = async () => {
    if (!confirmModal.quote) return;
    try {
      const res = await apiPost(`/api/quote-requests/${confirmModal.quote.id}/confirm`, {
        adminNote: confirmNote,
        validUntil: confirmExpiry,
        confirmedByName: (user as any)?.name || "",
      });
      if (res.success) {
        showAlert("成功", "已确认并发送报价邮件");
        setConfirmModal({ visible: false, quote: null });
        setConfirmNote(""); setConfirmExpiry("");
        loadInquiries();
      } else showAlert("失败", res.message);
    } catch (e) { showAlert("错误", "操作失败"); }
  };

  const handleReject = async (q: QuoteRequest) => {
    const reason = Platform.OS === "web" ? prompt("拒绝原因（可选）：") : "";
    try {
      const res = await apiPost(`/api/quote-requests/${q.id}/reject`, {
        reason, confirmedByName: (user as any)?.name || "",
      });
      if (res.success) { showAlert("已拒绝", "报价已拒绝"); loadInquiries(); }
      else showAlert("失败", res.message);
    } catch (e) { showAlert("错误", "操作失败"); }
  };

  // ── PDF Export ────────────────────────────────────────────
  const handleExportPDF = () => {
    if (Platform.OS !== "web") { showAlert("提示", "请在网页版导出PDF"); return; }
    if (!calcResult?.success) { showAlert("提示", "请先完成报价计算"); return; }

    const autoSurcharges = calcResult.surcharges || [];
    const manualAmt = manualSurcharges.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
    const adjust = parseFloat(adjustAmount) || 0;
    const baseFreight = calcResult.freightBase || 0;
    const autoSurTotal = autoSurcharges.reduce((s: number, x: any) => s + (x.amount || 0), 0);
    const total = baseFreight + autoSurTotal + manualAmt + adjust;
    const currency = calcResult.currency || "RMB";

    const html = `<!DOCTYPE html>
<html lang="zh">
<head><meta charset="UTF-8"><title>报价单</title>
<style>
  body{font-family:Arial,sans-serif;padding:40px;color:#111;max-width:800px;margin:0 auto}
  h1{color:#1e40af;border-bottom:2px solid #1e40af;padding-bottom:8px}
  .meta{display:flex;gap:40px;margin:20px 0;color:#555}
  table{width:100%;border-collapse:collapse;margin:20px 0}
  th{background:#1e40af;color:white;padding:10px;text-align:left}
  td{padding:9px 10px;border-bottom:1px solid #e5e7eb}
  tr:nth-child(even)td{background:#f9fafb}
  .total{font-size:18px;font-weight:700;color:#1e40af;text-align:right;margin-top:10px}
  .formula{background:#f0f9ff;border-left:3px solid #3b82f6;padding:10px;margin:10px 0;font-size:13px;color:#1e40af}
  .note{color:#6b7280;font-size:13px;margin-top:20px}
  @media print{body{padding:20px}}
</style></head>
<body>
<h1>运输报价单</h1>
<div class="meta">
  <span>客户：<strong>${clientName || "(内部报价)"}</strong></span>
  <span>日期：<strong>${new Date().toLocaleDateString("zh-CN")}</strong></span>
  <span>目的国：<strong>${calcResult.tableInfo?.country || calcCountry}</strong></span>
  <span>渠道：<strong>${calcResult.tableInfo?.channel || calcChannel}</strong></span>
</div>
${calcResult.tableInfo ? `<div style="color:#6b7280;font-size:13px;margin-bottom:12px">参考报价表：${calcResult.tableInfo.fileName}</div>` : ""}
<div class="formula">${calcResult.freightFormula || ""}</div>
<table>
  <tr><th>费用项目</th><th>计算公式</th><th>金额（${currency}）</th></tr>
  <tr><td>基础运费</td><td>${calcResult.freightFormula || ""}</td><td>${baseFreight.toFixed(2)}</td></tr>
  ${autoSurcharges.map((s: any) => `<tr><td>${s.name}</td><td>${s.formula || ""}</td><td>${(s.amount || 0).toFixed(2)}</td></tr>`).join("")}
  ${manualSurcharges.filter(s => s.name && parseFloat(s.amount)).map(s => `<tr><td>${s.name}</td><td>手动添加</td><td>${parseFloat(s.amount).toFixed(2)}</td></tr>`).join("")}
  ${adjust ? `<tr><td>价格调整</td><td>${adjustNote || ""}</td><td>${adjust.toFixed(2)}</td></tr>` : ""}
</table>
<div class="total">合计：${currency} ${total.toFixed(2)}</div>
${quoteNote ? `<div class="note"><strong>备注：</strong>${quoteNote}</div>` : ""}
<div class="note" style="margin-top:30px">本报价单仅供参考，最终价格以正式合同为准。有效期：${confirmExpiry || "7天"}</div>
</body></html>`;

    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.print();
    }
  };

  // ── Renders ───────────────────────────────────────────────
  const renderCalcTab = () => {
    const autoSurcharges = calcResult?.surcharges || [];
    const manualAmt = manualSurcharges.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
    const adjust = parseFloat(adjustAmount) || 0;
    const baseFreight = calcResult?.freightBase || 0;
    const autoSurTotal = autoSurcharges.reduce((s: number, x: any) => s + (x.amount || 0), 0);
    const finalTotal = baseFreight + autoSurTotal + manualAmt + adjust;
    const currency = calcResult?.currency || "RMB";

    return (
      <View>
        {/* Step 1: Conditions */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>第一步：选择报价条件</Text>
          <View style={[styles.row, isWide && { flexDirection: "row" }]}>
            <View style={[styles.formGroup, isWide && { flex: 1 }]}>
              <Text style={[styles.label, { color: colors.muted }]}>目的国 *</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                value={calcCountry}
                onChangeText={setCalcCountry}
                placeholder="例：巴西"
                placeholderTextColor={colors.muted}
              />
              {availCountries.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestRow}>
                  {availCountries.filter(c => !calcCountry || c.includes(calcCountry)).map(c => (
                    <TouchableOpacity key={c} style={[styles.suggestChip, { borderColor: colors.border, backgroundColor: colors.background }]} onPress={() => setCalcCountry(c)}>
                      <Text style={[styles.suggestText, { color: colors.foreground }]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
            <View style={[styles.formGroup, isWide && { flex: 1 }]}>
              <Text style={[styles.label, { color: colors.muted }]}>渠道 *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {CHANNELS.map(ch => (
                  <TouchableOpacity
                    key={ch}
                    style={[styles.chip, calcChannel === ch && { backgroundColor: colors.primary + "20", borderColor: colors.primary }]}
                    onPress={() => setCalcChannel(ch)}
                  >
                    <Text style={[styles.chipText, { color: calcChannel === ch ? colors.primary : colors.muted }]}>{ch}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          {/* Step 2: Cargo */}
          <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 16 }]}>第二步：货物信息</Text>
          <View style={[styles.row, isWide && { flexDirection: "row" }]}>
            <View style={[styles.formGroup, isWide && { flex: 2 }]}>
              <Text style={[styles.label, { color: colors.muted }]}>品名</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                value={calcName}
                onChangeText={setCalcName}
                placeholder="货物品名（选填）"
                placeholderTextColor={colors.muted}
              />
            </View>
            <View style={[styles.formGroup, isWide && { flex: 1 }]}>
              <Text style={[styles.label, { color: colors.muted }]}>品类</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                value={calcCategory}
                onChangeText={setCalcCategory}
                placeholder="如：普货、电子"
                placeholderTextColor={colors.muted}
              />
            </View>
          </View>
          <View style={[styles.row, isWide && { flexDirection: "row" }]}>
            <View style={[styles.formGroup, isWide && { flex: 1 }]}>
              <Text style={[styles.label, { color: colors.muted }]}>重量(kg) *</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                value={calcWeight}
                onChangeText={setCalcWeight}
                placeholder="总重量"
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={[styles.formGroup, isWide && { flex: 1 }]}>
              <Text style={[styles.label, { color: colors.muted }]}>体积(m³)</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                value={calcVolume}
                onChangeText={setCalcVolume}
                placeholder="体积重=体积×167"
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={[styles.formGroup, isWide && { flex: 0.6 }]}>
              <Text style={[styles.label, { color: colors.muted }]}>件数</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                value={calcQty}
                onChangeText={setCalcQty}
                placeholder="1"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.calcBtn, { backgroundColor: colors.primary, opacity: calcLoading ? 0.6 : 1 }]}
            onPress={handleCalculate}
            disabled={calcLoading}
          >
            {calcLoading ? <ActivityIndicator color="#fff" /> :
              <Text style={styles.calcBtnText}>开始计算报价</Text>}
          </TouchableOpacity>
        </View>

        {/* Step 3: Result */}
        {calcResult && (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: calcResult.success ? colors.primary + "40" : "#FCA5A5" }]}>
            {!calcResult.success ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{calcResult.message || "计算失败，未找到匹配报价表"}</Text>
              </View>
            ) : (
              <>
                <View style={styles.resultHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>第三步：计算结果</Text>
                  {calcResult.tableInfo && (
                    <Text style={[styles.tableRef, { color: colors.muted }]}>
                      参考报价表：{calcResult.tableInfo.fileName} ({calcResult.tableInfo.country} · {calcResult.tableInfo.channel})
                    </Text>
                  )}
                </View>

                <View style={[styles.formulaBox, { backgroundColor: colors.primary + "08", borderColor: colors.primary + "30" }]}>
                  <Text style={[styles.formulaLabel, { color: colors.primary }]}>计费重量</Text>
                  <Text style={[styles.formulaText, { color: colors.foreground }]}>
                    {`重量 ${calcWeight}kg，体积重 ${calcVolume ? (parseFloat(calcVolume) * 167).toFixed(1) : "0"}kg → 计费重 ${calcResult.chargeableWeight?.toFixed(1) || 0}kg`}
                  </Text>
                </View>

                <View style={[styles.breakdownTable, { borderColor: colors.border }]}>
                  <View style={[styles.breakdownHeader, { backgroundColor: colors.background }]}>
                    <Text style={[styles.bh, { color: colors.muted }]}>费用项目</Text>
                    <Text style={[styles.bh, { color: colors.muted, flex: 2 }]}>计算公式</Text>
                    <Text style={[styles.bhRight, { color: colors.muted }]}>金额({currency})</Text>
                  </View>
                  <BreakdownRow
                    label="基础运费"
                    formula={calcResult.freightFormula || ""}
                    amount={baseFreight}
                    highlight
                    colors={colors}
                  />
                  {autoSurcharges.map((s: any, i: number) => (
                    <BreakdownRow key={i} label={s.name} formula={s.formula || "自动识别"} amount={s.amount || 0} colors={colors} />
                  ))}
                  {manualSurcharges.map((s, i) => (
                    parseFloat(s.amount) > 0 && (
                      <BreakdownRow key={`m${i}`} label={s.name || `附加费${i + 1}`} formula="手动添加" amount={parseFloat(s.amount)} colors={colors} />
                    )
                  ))}
                  {adjust !== 0 && (
                    <BreakdownRow label="价格调整" formula={adjustNote || ""} amount={adjust} colors={colors} />
                  )}
                  <View style={[styles.totalRow, { borderTopColor: colors.primary, backgroundColor: colors.primary + "08" }]}>
                    <Text style={[styles.totalLabel, { color: colors.foreground }]}>合计</Text>
                    <Text style={[styles.totalAmount, { color: colors.primary }]}>{currency} {finalTotal.toFixed(2)}</Text>
                  </View>
                </View>

                {/* Step 4: Adjustments */}
                <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 16 }]}>第四步：手动调整</Text>

                <Text style={[styles.label, { color: colors.muted }]}>附加费（超大件/远程/燃油等）</Text>
                {manualSurcharges.map((s, i) => (
                  <View key={i} style={[styles.surchargeRow, isWide && { flexDirection: "row" }]}>
                    <TextInput
                      style={[styles.surchargeInput, { flex: 2, borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                      value={s.name}
                      onChangeText={v => setManualSurcharges(prev => prev.map((x, j) => j === i ? { ...x, name: v } : x))}
                      placeholder="费用名称（如：超大件费）"
                      placeholderTextColor={colors.muted}
                    />
                    <TextInput
                      style={[styles.surchargeInput, { flex: 1, borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                      value={s.amount}
                      onChangeText={v => setManualSurcharges(prev => prev.map((x, j) => j === i ? { ...x, amount: v } : x))}
                      placeholder="金额"
                      placeholderTextColor={colors.muted}
                      keyboardType="decimal-pad"
                    />
                    <TouchableOpacity onPress={() => setManualSurcharges(prev => prev.filter((_, j) => j !== i))}>
                      <Text style={{ color: "#EF4444", padding: 8, fontSize: 18 }}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  style={[styles.addSurchargeBtn, { borderColor: colors.border }]}
                  onPress={() => setManualSurcharges(prev => [...prev, { name: "", amount: "" }])}
                >
                  <Text style={[styles.addSurchargeBtnText, { color: colors.primary }]}>+ 添加附加费</Text>
                </TouchableOpacity>

                <View style={[styles.row, isWide && { flexDirection: "row" }]}>
                  <View style={[styles.formGroup, isWide && { flex: 1 }]}>
                    <Text style={[styles.label, { color: colors.muted }]}>价格调整金额（负数为减价）</Text>
                    <TextInput
                      style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                      value={adjustAmount}
                      onChangeText={setAdjustAmount}
                      placeholder="0.00"
                      placeholderTextColor={colors.muted}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={[styles.formGroup, isWide && { flex: 2 }]}>
                    <Text style={[styles.label, { color: colors.muted }]}>调整说明</Text>
                    <TextInput
                      style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                      value={adjustNote}
                      onChangeText={setAdjustNote}
                      placeholder="如：大客户折扣、节日优惠"
                      placeholderTextColor={colors.muted}
                    />
                  </View>
                </View>

                <View style={[styles.row, isWide && { flexDirection: "row" }]}>
                  <View style={[styles.formGroup, isWide && { flex: 1 }]}>
                    <Text style={[styles.label, { color: colors.muted }]}>客户名称</Text>
                    <TextInput
                      style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                      value={clientName}
                      onChangeText={setClientName}
                      placeholder="用于报价单抬头"
                      placeholderTextColor={colors.muted}
                    />
                  </View>
                  <View style={[styles.formGroup, isWide && { flex: 1 }]}>
                    <Text style={[styles.label, { color: colors.muted }]}>有效期</Text>
                    <TextInput
                      style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                      value={confirmExpiry}
                      onChangeText={setConfirmExpiry}
                      placeholder="如：7天"
                      placeholderTextColor={colors.muted}
                    />
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: colors.muted }]}>备注（出现在报价单中）</Text>
                  <TextInput
                    style={[styles.input, styles.textarea, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                    value={quoteNote}
                    onChangeText={setQuoteNote}
                    placeholder="运费不含保险、关税等其他费用"
                    placeholderTextColor={colors.muted}
                    multiline
                    numberOfLines={3}
                  />
                </View>

                <View style={styles.exportRow}>
                  <View style={[styles.finalPriceBox, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "40" }]}>
                    <Text style={[styles.finalPriceLabel, { color: colors.muted }]}>最终报价</Text>
                    <Text style={[styles.finalPrice, { color: colors.primary }]}>
                      {currency} {finalTotal.toFixed(2)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.exportBtn, { backgroundColor: "#1e40af" }]}
                    onPress={handleExportPDF}
                  >
                    <IconSymbol name="doc.text.fill" size={16} color="#fff" />
                    <Text style={styles.exportBtnText}>导出PDF报价单</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderInquiry = (q: QuoteRequest) => (
    <InquiryCard
      key={q.id}
      q={q}
      colors={colors}
      expandedId={expandedId}
      setExpandedId={setExpandedId}
      inlineCalcId={inlineCalcId}
      inlineResult={inlineResult}
      handleInlineCalc={handleInlineCalc}
      onConfirm={() => { setConfirmModal({ visible: true, quote: q }); setConfirmNote(""); }}
      onReject={() => handleReject(q)}
    />
  );

  const renderInquiriesTab = () => (
    <View>
      <View style={styles.filterBar}>
        {(["pending", "confirmed", "rejected"] as const).map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.filterBtn, statusFilter === s && { backgroundColor: colors.primary + "20", borderColor: colors.primary }]}
            onPress={() => setStatusFilter(s)}
          >
            <Text style={[styles.filterBtnText, { color: statusFilter === s ? colors.primary : colors.muted }]}>
              {s === "pending" ? "待处理" : s === "confirmed" ? "已确认" : "已拒绝"}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.refreshBtn, { borderColor: colors.border }]}
          onPress={loadInquiries}
        >
          <Text style={[styles.refreshBtnText, { color: colors.muted }]}>刷新</Text>
        </TouchableOpacity>
      </View>

      {inquiriesLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : inquiries.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.muted }]}>暂无{statusFilter === "pending" ? "待处理" : statusFilter === "confirmed" ? "已确认" : "已拒绝"}询价</Text>
        </View>
      ) : (
        inquiries.map(renderInquiry)
      )}
    </View>
  );

  const renderConfirmModal = () => (
    <Modal visible={confirmModal.visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>确认报价</Text>
          <Text style={[styles.modalSub, { color: colors.muted }]}>{confirmModal.quote?.quoteNo} · {confirmModal.quote?.customerName}</Text>
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.muted }]}>报价备注（将出现在邮件中）</Text>
            <TextInput
              style={[styles.input, styles.textarea, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
              value={confirmNote}
              onChangeText={setConfirmNote}
              placeholder="如：报价有效期7天，不含关税"
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={4}
            />
          </View>
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.muted }]}>有效期</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
              value={confirmExpiry}
              onChangeText={setConfirmExpiry}
              placeholder="如：2025-12-31 或 7天"
              placeholderTextColor={colors.muted}
            />
          </View>
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalCancelBtn, { borderColor: colors.border }]}
              onPress={() => setConfirmModal({ visible: false, quote: null })}
            >
              <Text style={[styles.modalCancelText, { color: colors.muted }]}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalConfirmBtn, { backgroundColor: "#10B981" }]} onPress={handleConfirm}>
              <Text style={styles.modalConfirmText}>确认发送</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const content = (
    <AuthGuard>
      <ScreenContainer>
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
          <View style={styles.pageHeader}>
            <Text style={[styles.pageTitle, { color: colors.foreground }]}>半自动报价</Text>
            <Text style={[styles.pageDesc, { color: colors.muted }]}>内部核价工具 · 选择报价表 → 输入货物 → 查看计算公式 → 导出PDF</Text>
          </View>

          <View style={styles.tabs}>
            {([["calc", "核价计算器"], ["inquiries", "客户询价审核"]] as const).map(([key, label]) => (
              <TouchableOpacity
                key={key}
                style={[styles.tab, activeTab === key && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                onPress={() => setActiveTab(key)}
              >
                <Text style={[styles.tabText, { color: activeTab === key ? colors.primary : colors.muted }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {activeTab === "calc" ? renderCalcTab() : renderInquiriesTab()}
        </ScrollView>
        {renderConfirmModal()}
      </ScreenContainer>
    </AuthGuard>
  );

  return <WebLayout>{content}</WebLayout>;
}

function InquiryCard({
  q, colors, expandedId, setExpandedId, inlineCalcId, inlineResult, handleInlineCalc, onConfirm, onReject,
}: {
  q: QuoteRequest; colors: any; expandedId: number | null; setExpandedId: (id: number | null) => void;
  inlineCalcId: number | null; inlineResult: CalcResult | null;
  handleInlineCalc: (q: QuoteRequest, ch: string) => void;
  onConfirm: () => void; onReject: () => void;
}) {
  const [selectedChannel, setSelectedChannel] = useState("");
  const isExpanded = expandedId === q.id;
  const statusColor = q.status === "confirmed" ? "#10B981" : q.status === "rejected" ? "#EF4444" : "#F59E0B";
  const statusLabel = q.status === "confirmed" ? "已确认" : q.status === "rejected" ? "已拒绝" : "待处理";

  return (
    <View style={[styles.inquiryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <TouchableOpacity style={styles.inquiryHeader} onPress={() => setExpandedId(isExpanded ? null : q.id)}>
        <View style={styles.inquiryHeaderLeft}>
          <Text style={[styles.inquiryNo, { color: colors.primary }]}>{q.quoteNo}</Text>
          <Text style={[styles.inquiryCustomer, { color: colors.foreground }]}>
            {q.customerName} {q.customerCompany ? `(${q.customerCompany})` : ""}
          </Text>
          <Text style={[styles.inquiryMeta, { color: colors.muted }]}>
            {q.itemCount}件 · {(q.totalWeight || 0).toFixed(1)}kg · {q.createdAt?.slice(0, 10)}
          </Text>
        </View>
        <View style={[styles.statusTag, { backgroundColor: statusColor + "20" }]}>
          <Text style={[styles.statusTagText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.inquiryBody}>
          {q.items?.length > 0 && (
            <View style={[styles.itemsList, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.muted, marginBottom: 6 }]}>货物清单</Text>
              {q.items.map((item: any, i: number) => (
                <View key={i} style={styles.itemRow}>
                  <Text style={[styles.itemName, { color: colors.foreground }]}>{item.name || `货物${i + 1}`}</Text>
                  <Text style={[styles.itemDetail, { color: colors.muted }]}>
                    {item.country} · {item.weight}kg · {item.volume || 0}m³
                  </Text>
                </View>
              ))}
            </View>
          )}

          {q.status === "pending" && (
            <View style={styles.pricingPanel}>
              <Text style={[styles.label, { color: colors.muted }]}>快速核价：选择渠道</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                {CHANNELS.map(ch => (
                  <TouchableOpacity
                    key={ch}
                    style={[styles.chip, selectedChannel === ch && { backgroundColor: colors.primary + "20", borderColor: colors.primary }]}
                    onPress={() => setSelectedChannel(ch)}
                  >
                    <Text style={[styles.chipText, { color: selectedChannel === ch ? colors.primary : colors.muted }]}>{ch}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity
                style={[styles.smallCalcBtn, { backgroundColor: colors.primary }]}
                onPress={() => handleInlineCalc(q, selectedChannel)}
                disabled={inlineCalcId === q.id}
              >
                {inlineCalcId === q.id ? <ActivityIndicator color="#fff" size="small" /> :
                  <Text style={styles.smallCalcBtnText}>计算报价</Text>}
              </TouchableOpacity>
              {inlineResult && inlineCalcId === null && expandedId === q.id && (
                <View style={[styles.inlineResult, { backgroundColor: colors.primary + "08", borderColor: colors.primary + "30" }]}>
                  {inlineResult.success ? (
                    <>
                      <Text style={[styles.inlineFormula, { color: colors.primary }]}>{inlineResult.freightFormula}</Text>
                      <Text style={[styles.inlineTotal, { color: colors.foreground }]}>
                        合计：{inlineResult.currency} {inlineResult.totalPrice?.toFixed(2)}
                      </Text>
                    </>
                  ) : (
                    <Text style={{ color: "#EF4444", fontSize: 13 }}>{inlineResult.message}</Text>
                  )}
                </View>
              )}
            </View>
          )}

          {q.status === "pending" && (
            <View style={styles.actionRow}>
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: "#10B981" }]} onPress={onConfirm}>
                <Text style={styles.actionBtnText}>确认报价</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.rejectBtn, { borderColor: "#EF4444" }]} onPress={onReject}>
                <Text style={[styles.rejectBtnText, { color: "#EF4444" }]}>拒绝</Text>
              </TouchableOpacity>
            </View>
          )}

          {q.adminNote && (
            <View style={[styles.noteBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.muted }]}>备注</Text>
              <Text style={[styles.noteText, { color: colors.foreground }]}>{q.adminNote}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function BreakdownRow({ label, formula, amount, highlight, colors }: { label: string; formula: string; amount: number; highlight?: boolean; colors: any }) {
  return (
    <View style={[styles.breakdownRow, highlight && { backgroundColor: colors.primary + "05" }]}>
      <Text style={[styles.bd, { color: colors.foreground, fontWeight: highlight ? "600" : "400" }]}>{label}</Text>
      <Text style={[styles.bd, { flex: 2, color: colors.muted, fontSize: 12 }]}>{formula}</Text>
      <Text style={[styles.bdRight, { color: highlight ? colors.primary : colors.foreground, fontWeight: highlight ? "700" : "500" }]}>
        {amount.toFixed(2)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  pageHeader: { marginBottom: 16 },
  pageTitle: { fontSize: 22, fontWeight: "700" },
  pageDesc: { fontSize: 13, marginTop: 4 },
  tabs: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#E5E7EB", marginBottom: 16 },
  tab: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabText: { fontSize: 14, fontWeight: "600" },
  section: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 12 },
  row: { gap: 12, marginBottom: 0 },
  formGroup: { marginBottom: 12 },
  label: { fontSize: 12, fontWeight: "500", marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14 },
  textarea: { height: 80, textAlignVertical: "top" },
  suggestRow: { marginTop: 6, flexGrow: 0 },
  suggestChip: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginRight: 6 },
  suggestText: { fontSize: 12 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: "#E5E7EB", marginRight: 6 },
  chipText: { fontSize: 12, fontWeight: "500" },
  calcBtn: { paddingVertical: 13, borderRadius: 10, alignItems: "center", marginTop: 4 },
  calcBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  resultHeader: { marginBottom: 12 },
  tableRef: { fontSize: 12, marginTop: 4 },
  formulaBox: { borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 14 },
  formulaLabel: { fontSize: 11, fontWeight: "600", marginBottom: 4 },
  formulaText: { fontSize: 13, lineHeight: 18 },
  breakdownTable: { borderWidth: 1, borderRadius: 8, overflow: "hidden", marginBottom: 14 },
  breakdownHeader: { flexDirection: "row", paddingVertical: 8, paddingHorizontal: 12 },
  bh: { flex: 1, fontSize: 11, fontWeight: "600" },
  bhRight: { width: 80, fontSize: 11, fontWeight: "600", textAlign: "right" },
  breakdownRow: { flexDirection: "row", paddingVertical: 9, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: "#F3F4F6" },
  bd: { flex: 1, fontSize: 13 },
  bdRight: { width: 80, fontSize: 13, textAlign: "right" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, paddingHorizontal: 12, borderTopWidth: 2 },
  totalLabel: { fontSize: 14, fontWeight: "600" },
  totalAmount: { fontSize: 16, fontWeight: "700" },
  surchargeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  surchargeInput: { borderWidth: 1, borderRadius: 8, padding: 9, fontSize: 14 },
  addSurchargeBtn: { borderWidth: 1, borderStyle: "dashed", borderRadius: 8, paddingVertical: 8, alignItems: "center", marginBottom: 14 },
  addSurchargeBtnText: { fontSize: 13, fontWeight: "500" },
  exportRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 16 },
  finalPriceBox: { flex: 1, borderWidth: 1, borderRadius: 10, padding: 12 },
  finalPriceLabel: { fontSize: 11, fontWeight: "500" },
  finalPrice: { fontSize: 22, fontWeight: "700", marginTop: 2 },
  exportBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10 },
  exportBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  errorBox: { padding: 12, backgroundColor: "#FEF2F2", borderRadius: 8 },
  errorText: { color: "#EF4444", fontSize: 14 },
  filterBar: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 6, borderWidth: 1, borderColor: "#E5E7EB" },
  filterBtnText: { fontSize: 13, fontWeight: "500" },
  refreshBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 6, borderWidth: 1, marginLeft: "auto" },
  refreshBtnText: { fontSize: 12 },
  center: { paddingTop: 40, alignItems: "center" },
  empty: { paddingTop: 40, alignItems: "center" },
  emptyText: { fontSize: 14 },
  inquiryCard: { borderWidth: 1, borderRadius: 10, marginBottom: 10, overflow: "hidden" },
  inquiryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: 12 },
  inquiryHeaderLeft: { flex: 1 },
  inquiryNo: { fontSize: 13, fontWeight: "700", marginBottom: 2 },
  inquiryCustomer: { fontSize: 14, fontWeight: "600", marginBottom: 2 },
  inquiryMeta: { fontSize: 12 },
  statusTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusTagText: { fontSize: 12, fontWeight: "600" },
  inquiryBody: { padding: 12, paddingTop: 0 },
  itemsList: { borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 12 },
  itemRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  itemName: { fontSize: 13, fontWeight: "500" },
  itemDetail: { fontSize: 12 },
  pricingPanel: { marginBottom: 12 },
  smallCalcBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, alignSelf: "flex-start", marginTop: 6 },
  smallCalcBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  inlineResult: { borderWidth: 1, borderRadius: 8, padding: 10, marginTop: 8 },
  inlineFormula: { fontSize: 13, fontWeight: "500", marginBottom: 4 },
  inlineTotal: { fontSize: 15, fontWeight: "700" },
  actionRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  confirmBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  rejectBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1 },
  actionBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  rejectBtnText: { fontSize: 13, fontWeight: "600" },
  noteBox: { borderWidth: 1, borderRadius: 8, padding: 10 },
  noteText: { fontSize: 13, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalBox: { width: "100%", maxWidth: 480, borderWidth: 1, borderRadius: 14, padding: 20 },
  modalTitle: { fontSize: 17, fontWeight: "700", marginBottom: 4 },
  modalSub: { fontSize: 13, marginBottom: 16 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  modalCancelBtn: { flex: 1, borderWidth: 1, borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  modalCancelText: { fontSize: 14 },
  modalConfirmBtn: { flex: 2, borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  modalConfirmText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
