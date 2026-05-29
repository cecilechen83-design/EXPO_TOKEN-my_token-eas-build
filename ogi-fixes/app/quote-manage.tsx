import { useState, useEffect, useCallback, useMemo } from "react";
import { Text, View, TouchableOpacity, ScrollView, TextInput, StyleSheet, Alert, Platform, useWindowDimensions, ActivityIndicator, Modal } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { WebLayout } from "@/components/web-sidebar";
import { AuthGuard } from "@/components/auth-guard";
import { useAuth } from "@/lib/auth-context";
import { useQuoteRequestsApi, type QuoteRequest, type QuoteRequestItem, type AiQuoteResponse, type AiPriceRule } from "@/hooks/use-quote-requests-api";
import * as XLSX from "xlsx";

// Web 端 Alert.alert 是 no-op，统一用此函数替代
function showAlert(title: string, message?: string) {
  if (Platform.OS === "web") {
    window.alert(message ? `${title}\n${message}` : title);
  } else {
    Alert.alert(title, message ?? "");
  }
}

// ===== 价格表上传解析（原样保存每个 Sheet 的表格数据） =====
interface SheetData {
  name: string;
  headers: string[];
  rows: string[][];
}

function parsePriceExcelRaw(buffer: ArrayBuffer): { sheets: SheetData[]; sheetNames: string[]; totalRows: number } {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheets: SheetData[] = [];
  let totalRows = 0;
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    // 用 header:1 获取原始二维数组（保留合并单元格的空值）
    const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    if (rawRows.length === 0) continue;
    // 找到第一个非空行作为表头
    let headerIdx = 0;
    for (let i = 0; i < Math.min(rawRows.length, 5); i++) {
      const nonEmpty = rawRows[i].filter((c: any) => String(c).trim() !== "").length;
      if (nonEmpty >= 2) { headerIdx = i; break; }
    }
    const headers = rawRows[headerIdx].map((c: any) => String(c).trim());
    const dataRows = rawRows.slice(headerIdx + 1)
      .filter((row: any[]) => row.some((c: any) => String(c).trim() !== ""))
      .map((row: any[]) => row.map((c: any) => String(c).trim()));
    totalRows += dataRows.length;
    sheets.push({ name: sheetName, headers, rows: dataRows });
  }
  return { sheets, sheetNames: wb.SheetNames, totalRows };
}

// 智能辅助定位：根据目的国和品类关键词，在 Sheet 数据中查找匹配的行
function findRelevantRows(sheets: SheetData[], country: string, category?: string): { sheetName: string; matchedRows: { rowIdx: number; cells: string[] }[]; headers: string[] }[] {
  const results: { sheetName: string; matchedRows: { rowIdx: number; cells: string[] }[]; headers: string[] }[] = [];
  const countryLower = (country || "").toLowerCase();
  const categoryLower = (category || "").toLowerCase();

  // 国家关键词映射
  const countryKeywords: Record<string, string[]> = {
    "巴西": ["巴西", "brazil", "br"],
    "墨西哥": ["墨西哥", "mexico", "mx", "美墨"],
    "智利": ["智利", "chile", "cl"],
    "哥伦比亚": ["哥伦比亚", "colombia", "co"],
    "秘鲁": ["秘鲁", "peru", "pe"],
    "美国": ["美国", "usa", "us", "美墨"],
  };

  for (const sheet of sheets) {
    // 先检查 Sheet 名称是否匹配目的国
    const sheetNameLower = sheet.name.toLowerCase();
    let sheetMatchesCountry = false;
    if (countryLower) {
      for (const [, keywords] of Object.entries(countryKeywords)) {
        if (keywords.some(kw => countryLower.includes(kw) || kw.includes(countryLower))) {
          if (keywords.some(kw => sheetNameLower.includes(kw))) {
            sheetMatchesCountry = true;
            break;
          }
        }
      }
      // 直接包含匹配
      if (!sheetMatchesCountry && (sheetNameLower.includes(countryLower) || countryLower.includes(sheetNameLower.slice(0, 2)))) {
        sheetMatchesCountry = true;
      }
    }
    if (!sheetMatchesCountry && countryLower) continue;

    // 在匹配的 Sheet 中查找品类相关行
    const matchedRows: { rowIdx: number; cells: string[] }[] = [];
    if (categoryLower) {
      for (let i = 0; i < sheet.rows.length; i++) {
        const rowText = sheet.rows[i].join(" ").toLowerCase();
        if (rowText.includes(categoryLower) || categoryLower.split("").some(ch => rowText.includes(ch))) {
          matchedRows.push({ rowIdx: i, cells: sheet.rows[i] });
        }
      }
    }
    // 如果没有品类匹配，返回所有数据行（限制前10行）
    if (matchedRows.length === 0) {
      for (let i = 0; i < Math.min(sheet.rows.length, 10); i++) {
        matchedRows.push({ rowIdx: i, cells: sheet.rows[i] });
      }
    }
    results.push({ sheetName: sheet.name, matchedRows, headers: sheet.headers });
  }
  return results;
}

export default function QuoteManageScreen() {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const { user } = useAuth();
  const api = useQuoteRequestsApi();

  const [activeTab, setActiveTab] = useState<"quotes" | "prices">("quotes");
  const [quotes, setQuotes] = useState<QuoteRequest[]>([]);
  const [stats, setStats] = useState({ pending: 0, confirmed: 0, total: 0, priceTableVersion: "未上传" });
  const [priceTable, setPriceTable] = useState<any>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  // 价格表上传状态
  const [uploadPreview, setUploadPreview] = useState<{ sheets: SheetData[]; sheetNames: string[]; totalRows: number; fileName: string } | null>(null);
  // 当前查看的 Sheet 索引
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);
  // 已加载的价格表 Sheet 数据（从数据库加载）
  const [loadedSheets, setLoadedSheets] = useState<SheetData[]>([]);
  const [loadedSheetIdx, setLoadedSheetIdx] = useState(0);

  // 报价确认弹窗
  const [confirmModal, setConfirmModal] = useState<{ visible: boolean; quote: QuoteRequest | null }>({ visible: false, quote: null });
  const [confirmNote, setConfirmNote] = useState("");
  const [confirmExpiry, setConfirmExpiry] = useState("");
  const [confirmContact, setConfirmContact] = useState("");

  // 上传报价单状态
  const [uploadingFileId, setUploadingFileId] = useState<number | null>(null);

  // AI 报价状态
  const [aiParseStatus, setAiParseStatus] = useState<string>("idle");
  const [aiRuleCount, setAiRuleCount] = useState(0);
  const [aiParseError, setAiParseError] = useState<string | null>(null);
  const [aiParsing, setAiParsing] = useState(false);
  const [aiQuoteResult, setAiQuoteResult] = useState<AiQuoteResponse | null>(null);
  const [aiQuoting, setAiQuoting] = useState<number | null>(null);

  // AI 规则查看/编辑状态
  const [aiRulesVisible, setAiRulesVisible] = useState(false);
  const [aiRules, setAiRules] = useState<AiPriceRule[]>([]);
  const [aiRulesLoading, setAiRulesLoading] = useState(false);
  const [editingRuleIdx, setEditingRuleIdx] = useState<number | null>(null);
  const [editingRule, setEditingRule] = useState<AiPriceRule | null>(null);
  const [addingRule, setAddingRule] = useState(false);

  // 新建报价弹窗状态
  const [newQuoteModal, setNewQuoteModal] = useState(false);
  const [nqCustomer, setNqCustomer] = useState({ name: "", email: "", company: "", tel: "" });
  const [nqItems, setNqItems] = useState([{ name: "", weight: "", volume: "", country: "巴西", category: "普货" }]);
  const [nqSubmitting, setNqSubmitting] = useState(false);

  // 加载数据
  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      const [statsRes, listRes, ptRes] = await Promise.all([
        api.getQuoteStats(),
        api.getQuoteList({ status: statusFilter === "all" ? undefined : statusFilter }),
        api.getCurrentPriceTable(),
      ]);
      if (statsRes.success) setStats(statsRes.stats);
      if (listRes.success) setQuotes(listRes.quotes);
      if (ptRes.success) {
        setPriceTable(ptRes.priceTable);
        if (ptRes.priceTable) {
          setAiParseStatus(ptRes.priceTable.aiParseStatus || "idle");
          setAiRuleCount(ptRes.priceTable.aiRuleCount || 0);
          setAiParseError(ptRes.priceTable.aiParseError || null);
        }
      }
    } catch (e) {
      console.error("加载数据失败", e);
    }
    setRefreshing(false);
  }, [statusFilter]); // api omitted: including it causes infinite re-render when api reference is unstable

  useEffect(() => { loadData(); }, [loadData]);

  // 文件上传处理（Web 端）
  const handleFileUpload = useCallback(() => {
    if (Platform.OS !== "web") {
      showAlert("提示", "请在网页版上传价格表");
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.xls,.csv";
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const buffer = await file.arrayBuffer();
      const { sheets, sheetNames, totalRows } = parsePriceExcelRaw(buffer);
      if (sheets.length === 0 || totalRows === 0) {
        showAlert("错误", "未能解析到有效数据，请检查 Excel 文件");
        return;
      }
      setUploadPreview({ sheets, sheetNames, totalRows, fileName: file.name });
      setActiveSheetIdx(0);
    };
    input.click();
  }, []);

  // 确认上传价格表（原样保存 Sheet 数据）
  const handleConfirmUpload = useCallback(async () => {
    if (!uploadPreview) return;
    const res = await api.uploadPriceTable({
      rules: uploadPreview.sheets,
      fileName: uploadPreview.fileName,
      sheetNames: uploadPreview.sheetNames,
      uploadedBy: (user as any)?.id,
      uploadedByName: user?.name || "",
    });
    if (res.success) {
      showAlert("成功", res.message || "价格表已生效");
      setUploadPreview(null);
      loadData();
    } else {
      showAlert("失败", res.message || "上传失败");
    }
  }, [api, uploadPreview, user, loadData]);

  // 确认报价
  const handleConfirmQuote = useCallback(async () => {
    if (!confirmModal.quote) return;
    const res = await api.confirmQuote(confirmModal.quote.id, {
      adminNote: confirmNote,
      validUntil: confirmExpiry,
      contactName: confirmContact,
      confirmedBy: (user as any)?.id,
      confirmedByName: user?.name || "",
    });
    if (res.success) {
      showAlert("成功", "报价已确认发出");
      setConfirmModal({ visible: false, quote: null });
      setConfirmNote("");
      setConfirmExpiry("");
      setConfirmContact("");
      loadData();
    } else {
      showAlert("失败", res.message || "操作失败");
    }
  }, [api, confirmModal, confirmNote, confirmExpiry, confirmContact, user, loadData]);

  // 拒绝报价
  const handleRejectQuote = useCallback(async (quote: QuoteRequest) => {
    if (Platform.OS === "web") {
      const reason = prompt("请输入拒绝原因（可选）：");
      const res = await api.rejectQuote(quote.id, {
        reason: reason || undefined,
        confirmedBy: (user as any)?.id,
        confirmedByName: user?.name || "",
      });
      if (res.success) {
        showAlert("已拒绝", "报价已拒绝");
        loadData();
      }
    } else {
      Alert.alert("确认", "确定拒绝此报价？", [
        { text: "取消" },
        { text: "确定", onPress: async () => {
          const res = await api.rejectQuote(quote.id, {
            confirmedBy: (user as any)?.id,
            confirmedByName: user?.name || "",
          });
          if (res.success) loadData();
        }},
      ]);
    }
  }, [api, user, loadData]);

  // 上传报价单文件
  const handleUploadQuoteFile = useCallback(async (quoteId: number) => {
    if (Platform.OS !== "web") {
      showAlert("提示", "请在网页版上传报价单");
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.xls,.csv,.pdf,.doc,.docx";
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploadingFileId(quoteId);
      try {
        const reader = new FileReader();
        reader.onload = async (ev) => {
          const base64 = (ev.target?.result as string).split(",")[1];
          const res = await api.uploadQuoteFile(quoteId, {
            fileName: file.name,
            fileData: base64,
            contentType: file.type,
          });
          if (res.success) {
            showAlert("成功", "报价单已上传");
            loadData();
          } else {
            showAlert("失败", res.message || "上传失败");
          }
          setUploadingFileId(null);
        };
        reader.readAsDataURL(file);
      } catch (err) {
        showAlert("失败", "上传失败");
        setUploadingFileId(null);
      }
    };
    input.click();
  }, [api, loadData]);

  // 下载报价单文件
  const handleDownloadQuoteFile = useCallback(async (quoteId: number) => {
    try {
      const res = await api.getQuoteFile(quoteId);
      if (res.success && res.url) {
        if (Platform.OS === "web") {
          window.open(res.url, "_blank");
        }
      } else {
        showAlert("提示", res.message || "未找到报价单文件");
      }
    } catch (err) {
      showAlert("失败", "获取报价单失败");
    }
  }, [api]);

  // AI 解析价格表
  const handleAiParse = useCallback(async () => {
    setAiParsing(true);
    try {
      const res = await api.aiParsePriceTable(priceTable?.id);
      if (res.success) {
        setAiParseStatus("parsing");
        showAlert("已启动", res.message || "AI 解析已启动，请稍后刷新查看结果");
        setTimeout(() => loadData(), 10000);
      } else {
        showAlert("失败", res.message || "AI 解析启动失败");
      }
    } catch (err: any) {
      showAlert("错误", err.message || "AI 解析失败");
    }
    setAiParsing(false);
  }, [api, priceTable, loadData]);

  // AI 自动报价
  const handleAiQuote = useCallback(async (quoteId: number) => {
    setAiQuoting(quoteId);
    setAiQuoteResult(null);
    try {
      const res = await api.aiAutoQuote(quoteId);
      if (res.success) {
        setAiQuoteResult(res);
      } else {
        showAlert("失败", (res as any).message || "AI 报价失败");
      }
    } catch (err: any) {
      showAlert("错误", err.message || "AI 报价失败");
    }
    setAiQuoting(null);
  }, [api]);

  // 加载 AI 解析规则明细
  const handleLoadAiRules = useCallback(async () => {
    setAiRulesLoading(true);
    try {
      const res = await api.getAiParseStatus();
      if (res.success && res.parsedRules) {
        setAiRules(res.parsedRules);
        setAiRulesVisible(true);
      } else {
        showAlert("提示", "未找到 AI 解析规则，请先执行 AI 解析");
      }
    } catch (err: any) {
      showAlert("错误", err.message || "加载规则失败");
    }
    setAiRulesLoading(false);
  }, [api]);

  // 删除单条规则
  const handleDeleteRule = useCallback((idx: number) => {
    if (Platform.OS === "web") {
      if (window.confirm(`确定删除第 ${idx + 1} 条规则？`)) {
        setAiRules(prev => prev.filter((_, i) => i !== idx));
      }
    } else {
      Alert.alert("确认删除", `确定删除第 ${idx + 1} 条规则？`, [
        { text: "取消", style: "cancel" },
        { text: "删除", style: "destructive", onPress: () => {
          setAiRules(prev => prev.filter((_, i) => i !== idx));
        }},
      ]);
    }
  }, []);

  // 编辑单条规则
  const handleEditRule = useCallback((idx: number) => {
    setEditingRuleIdx(idx);
    setEditingRule({ ...aiRules[idx] });
  }, [aiRules]);

  // 保存编辑
  const handleSaveEditRule = useCallback(() => {
    if (editingRuleIdx === null || !editingRule) return;
    setAiRules(prev => prev.map((r, i) => i === editingRuleIdx ? editingRule : r));
    setEditingRuleIdx(null);
    setEditingRule(null);
  }, [editingRuleIdx, editingRule]);

  // 新增规则
  const handleAddRule = useCallback(() => {
    setAddingRule(true);
    setEditingRule({
      route: "", transportMethod: "", destinationCountry: "",
      category: "普货", pricingUnit: "RMB/CBM", volumeOrWeightRange: "",
      unitPrice: 0, currency: "RMB", transitTime: "",
    });
  }, []);

  // 保存新增规则
  const handleSaveNewRule = useCallback(() => {
    if (!editingRule || !editingRule.unitPrice) {
      showAlert("提示", "单价不能为空");
      return;
    }
    setAiRules(prev => [...prev, editingRule]);
    setAddingRule(false);
    setEditingRule(null);
  }, [editingRule]);

  // 保存所有规则到服务器
  const handleSaveAllRules = useCallback(async () => {
    try {
      const res = await api.updateAiRules(aiRules, priceTable?.id);
      if (res.success) {
        showAlert("成功", res.message || "规则已保存");
        setAiRuleCount(res.ruleCount || aiRules.length);
      } else {
        showAlert("失败", res.message || "保存失败");
      }
    } catch (err: any) {
      showAlert("错误", err.message || "保存失败");
    }
  }, [api, aiRules, priceTable]);

  // 新建报价提交
  const handleNewQuoteSubmit = useCallback(async () => {
    if (!nqCustomer.name.trim() || !nqCustomer.email.trim()) {
      showAlert("提示", "请填写联系人和邮箱");
      return;
    }
    const validItems = nqItems.filter(it => it.name.trim() && parseFloat(it.weight) > 0);
    if (validItems.length === 0) {
      showAlert("提示", "请至少填写一件货物（品名和重量必填）");
      return;
    }
    setNqSubmitting(true);
    try {
      const res = await api.submitQuote({
        customer: { ...nqCustomer, wechat: "" },
        items: validItems.map(it => ({
          name: it.name, qty: 1,
          weight: parseFloat(it.weight) || 0,
          volume: parseFloat(it.volume) || 0,
          country: it.country, category: it.category,
        })),
      });
      if (res.success) {
        showAlert("成功", `报价已创建：${res.quoteNo}`);
        setNewQuoteModal(false);
        setNqCustomer({ name: "", email: "", company: "", tel: "" });
        setNqItems([{ name: "", weight: "", volume: "", country: "巴西", category: "普货" }]);
        loadData();
      } else {
        showAlert("失败", (res as any).message || "创建失败");
      }
    } catch (e: any) {
      showAlert("错误", e.message || "网络错误");
    }
    setNqSubmitting(false);
  }, [api, nqCustomer, nqItems, loadData]);

  // 统计卡片
  const renderStats = () => (
    <View style={[styles.statsRow, isWide && styles.statsRowWide]}>
      <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.statLabel, { color: colors.muted }]}>待审核</Text>
        <Text style={[styles.statValue, { color: "#F59E0B" }]}>{stats.pending}</Text>
      </View>
      <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.statLabel, { color: colors.muted }]}>已确认</Text>
        <Text style={[styles.statValue, { color: "#10B981" }]}>{stats.confirmed}</Text>
      </View>
      <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.statLabel, { color: colors.muted }]}>总询价</Text>
        <Text style={[styles.statValue, { color: colors.foreground }]}>{stats.total}</Text>
      </View>
      <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.statLabel, { color: colors.muted }]}>价格表</Text>
        <Text style={[styles.statVersionText, { color: colors.primary }]}>{stats.priceTableVersion}</Text>
      </View>
    </View>
  );

  // 报价卡片
  const renderQuoteCard = (quote: QuoteRequest) => {
    const isExpanded = expandedId === quote.id;
    const total = quote.totalAmount ? `USD ${quote.totalAmount}` : "—";
    const statusColor = quote.status === "pending" ? "#F59E0B" : quote.status === "confirmed" ? "#10B981" : "#EF4444";
    const statusLabel = quote.status === "pending" ? "待审核" : quote.status === "confirmed" ? "已确认" : "已拒绝";

    return (
      <View key={quote.id} style={[styles.quoteCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity style={styles.quoteCardHeader} onPress={() => setExpandedId(isExpanded ? null : quote.id)}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <View style={styles.quoteInfo}>
            <Text style={[styles.quoteCustomer, { color: colors.foreground }]}>
              {quote.customer?.name || "—"} · {quote.customer?.company || "—"}
            </Text>
            <Text style={[styles.quoteMeta, { color: colors.muted }]}>
              {quote.customer?.email} · {quote.items?.length || 0}件货物 · {quote.quoteNo}
            </Text>
          </View>
          <View style={styles.quoteRight}>
            <Text style={[styles.quoteTotal, { color: colors.primary }]}>{total}</Text>
            <View style={[styles.statusTag, { backgroundColor: statusColor + "20" }]}>
              <Text style={[styles.statusTagText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
            <Text style={[styles.quoteTime, { color: colors.muted }]}>{new Date(quote.createdAt).toLocaleString("zh-CN")}</Text>
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={[styles.quoteCardBody, { borderTopColor: colors.border }]}>
            {/* 货物明细表 */}
            <View style={[styles.itemsTable, { borderColor: colors.border }]}>
              <View style={[styles.tableHeader, { backgroundColor: colors.background }]}>
                <Text style={[styles.th, { color: colors.muted, flex: 2 }]}>品名</Text>
                <Text style={[styles.th, { color: colors.muted }]}>目的国</Text>
                <Text style={[styles.th, { color: colors.muted }]}>重量</Text>
                <Text style={[styles.th, { color: colors.muted }]}>体积</Text>
                <Text style={[styles.th, { color: colors.muted }]}>运输方式</Text>
                <Text style={[styles.th, { color: colors.muted }]}>报价(USD)</Text>
              </View>
              {(quote.items || []).map((item, idx) => (
                <View key={idx} style={[styles.tableRow, { borderTopColor: colors.border }]}>
                  <Text style={[styles.td, { color: colors.foreground, flex: 2 }]}>{item.name}</Text>
                  <Text style={[styles.td, { color: colors.foreground }]}>{item.country}</Text>
                  <Text style={[styles.td, { color: colors.foreground }]}>{item.weight || 0}kg</Text>
                  <Text style={[styles.td, { color: colors.foreground }]}>{item.volume || 0}m³</Text>
                  <Text style={[styles.td, { color: colors.primary }]}>{item.recommended?.method || "—"}</Text>
                  <Text style={[styles.td, { color: colors.primary, fontWeight: "600" }]}>{item.recommended?.price || "0"}</Text>
                </View>
              ))}
              <View style={[styles.tableRow, { borderTopColor: colors.border }]}>
                <Text style={[styles.td, { color: colors.muted, flex: 5, textAlign: "right", fontWeight: "500" }]}>合计</Text>
                <Text style={[styles.td, { color: colors.primary, fontWeight: "700" }]}>{total}</Text>
              </View>
            </View>

            {/* 操作按钮 */}
            {/* 报价单文件状态 */}
            {quote.quoteFileUrl && (
              <View style={[styles.quoteFileBar, { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }]}>
                <Text style={{ fontSize: 13, color: "#16A34A", flex: 1 }}>📄 已上传报价单：{quote.quoteFileName || "报价单"}</Text>
                <TouchableOpacity onPress={() => handleDownloadQuoteFile(quote.id)}>
                  <Text style={{ fontSize: 13, color: colors.primary, fontWeight: "500" }}>下载查看</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* AI 报价结果展示 */}
            {aiQuoteResult && aiQuoteResult.quoteId === quote.id && (
              <View style={[styles.aiResultBox, { backgroundColor: "#F0F9FF", borderColor: "#BAE6FD" }]}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: "#0369A1" }}>🤖 AI 报价建议</Text>
                  <Text style={{ fontSize: 12, color: "#0EA5E9", marginLeft: 8 }}>建议总价: {aiQuoteResult.currency} {aiQuoteResult.totalRecommendedPrice}</Text>
                </View>
                {aiQuoteResult.items.map((item, idx) => (
                  <View key={idx} style={{ marginBottom: 8, paddingBottom: 8, borderBottomWidth: idx < aiQuoteResult.items.length - 1 ? 1 : 0, borderBottomColor: "#E0F2FE" }}>
                    <Text style={{ fontSize: 13, fontWeight: "500", color: "#0C4A6E" }}>{item.name} → {item.country}</Text>
                    {item.aiQuote?.recommendation && (
                      <View style={{ marginTop: 4, paddingLeft: 12 }}>
                        <Text style={{ fontSize: 12, color: "#0369A1" }}>
                          ✅ 推荐: {item.aiQuote.recommendation.transportMethod} | {item.aiQuote.recommendation.currency} {item.aiQuote.recommendation.totalPrice}
                          {item.aiQuote.recommendation.transitTime ? ` | ${item.aiQuote.recommendation.transitTime}` : ""}
                        </Text>
                        <Text style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>{item.aiQuote.recommendation.reason}</Text>
                      </View>
                    )}
                    {item.aiQuote?.matchedRules && item.aiQuote.matchedRules.length > 0 && (
                      <View style={{ marginTop: 4, paddingLeft: 12 }}>
                        <Text style={{ fontSize: 11, color: "#64748B" }}>其他方案:</Text>
                        {item.aiQuote.matchedRules.slice(0, 3).map((rule, rIdx) => (
                          <Text key={rIdx} style={{ fontSize: 11, color: "#64748B", marginTop: 1 }}>
                            · {rule.transportMethod}: {rule.currency} {rule.calculatedPrice} ({rule.calculation})
                          </Text>
                        ))}
                      </View>
                    )}
                    {item.aiQuote?.analysis && (
                      <Text style={{ fontSize: 11, color: "#475569", marginTop: 3, paddingLeft: 12 }}>📝 {item.aiQuote.analysis}</Text>
                    )}
                    {item.aiQuote?.warnings && item.aiQuote.warnings.length > 0 && (
                      <View style={{ marginTop: 3, paddingLeft: 12 }}>
                        {item.aiQuote.warnings.map((w, wIdx) => (
                          <Text key={wIdx} style={{ fontSize: 11, color: "#D97706" }}>⚠️ {w}</Text>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            {quote.status === "pending" && (
              <View style={styles.actionBar}>
                {aiParseStatus === "parsed" && (
                  <TouchableOpacity
                    style={[styles.btn, { borderColor: "#7DD3FC", backgroundColor: "#F0F9FF" }]}
                    onPress={() => handleAiQuote(quote.id)}
                    disabled={aiQuoting === quote.id}
                  >
                    <Text style={[styles.btnText, { color: "#0284C7" }]}>
                      {aiQuoting === quote.id ? "🤖 AI 报价中..." : "🤖 AI 自动报价"}
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.btn, { borderColor: "#93C5FD", backgroundColor: "#EFF6FF" }]}
                  onPress={() => handleUploadQuoteFile(quote.id)}
                  disabled={uploadingFileId === quote.id}
                >
                  <Text style={[styles.btnText, { color: "#2563EB" }]}>
                    {uploadingFileId === quote.id ? "上传中..." : "📂 上传报价单"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnDanger, { borderColor: "#FCA5A5" }]}
                  onPress={() => handleRejectQuote(quote)}
                >
                  <Text style={[styles.btnText, { color: "#EF4444" }]}>✗ 拒绝</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    setConfirmModal({ visible: true, quote });
                    setConfirmContact(user?.name || "");
                  }}
                >
                  <Text style={[styles.btnText, { color: "#fff" }]}>✓ 确认发出</Text>
                </TouchableOpacity>
              </View>
            )}
            {quote.status === "confirmed" && (
              <View style={styles.actionBar}>
                <TouchableOpacity
                  style={[styles.btn, { borderColor: "#93C5FD", backgroundColor: "#EFF6FF" }]}
                  onPress={() => handleUploadQuoteFile(quote.id)}
                  disabled={uploadingFileId === quote.id}
                >
                  <Text style={[styles.btnText, { color: "#2563EB" }]}>
                    {uploadingFileId === quote.id ? "上传中..." : (quote.quoteFileUrl ? "📂 更新报价单" : "📂 上传报价单")}
                  </Text>
                </TouchableOpacity>
                <Text style={{ color: "#10B981", fontSize: 13, flex: 1, textAlign: "right" }}>✓ 已确认发出 · {quote.confirmedByName || ""} · {quote.confirmedAt ? new Date(quote.confirmedAt).toLocaleString("zh-CN") : ""}</Text>
              </View>
            )}
            {quote.status === "rejected" && (
              <View style={styles.actionBar}>
                <Text style={{ color: "#EF4444", fontSize: 13 }}>✗ 已拒绝 · {quote.adminNote || ""}</Text>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  // 渲染 Sheet 表格（通用）
  const renderSheetTable = (sheet: SheetData, maxRows?: number) => {
    const displayRows = maxRows ? sheet.rows.slice(0, maxRows) : sheet.rows;
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={true} style={{ marginTop: 8 }}>
        <View>
          {/* 表头 */}
          <View style={{ flexDirection: "row", backgroundColor: colors.primary + "12", borderBottomWidth: 1, borderBottomColor: colors.border }}>
            {sheet.headers.map((h: string, i: number) => (
              <View key={i} style={{ minWidth: 100, maxWidth: 200, paddingHorizontal: 8, paddingVertical: 6, borderRightWidth: 1, borderRightColor: colors.border }}>
                <Text style={{ fontSize: 12, fontWeight: "600", color: colors.foreground }} numberOfLines={2}>{h || `列${i + 1}`}</Text>
              </View>
            ))}
          </View>
          {/* 数据行 */}
          {displayRows.map((row: string[], rIdx: number) => (
            <View key={rIdx} style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.border + "40", backgroundColor: rIdx % 2 === 0 ? "transparent" : colors.surface }}>
              {sheet.headers.map((_: string, cIdx: number) => (
                <View key={cIdx} style={{ minWidth: 100, maxWidth: 200, paddingHorizontal: 8, paddingVertical: 5, borderRightWidth: 1, borderRightColor: colors.border + "30" }}>
                  <Text style={{ fontSize: 12, color: colors.foreground }} numberOfLines={3}>{row[cIdx] || ""}</Text>
                </View>
              ))}
            </View>
          ))}
          {maxRows && sheet.rows.length > maxRows && (
            <View style={{ paddingVertical: 8, alignItems: "center" }}>
              <Text style={{ fontSize: 12, color: colors.muted }}>… 还有 {sheet.rows.length - maxRows} 行数据</Text>
            </View>
          )}
        </View>
      </ScrollView>
    );
  };

  // Sheet Tab 切换组件
  const renderSheetTabs = (sheets: SheetData[], activeIdx: number, onSelect: (idx: number) => void) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {sheets.map((s: SheetData, i: number) => (
          <TouchableOpacity
            key={i}
            style={[{
              paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
              backgroundColor: i === activeIdx ? colors.primary : colors.surface,
              borderWidth: 1, borderColor: i === activeIdx ? colors.primary : colors.border,
            }]}
            onPress={() => onSelect(i)}
          >
            <Text style={{ fontSize: 12, color: i === activeIdx ? "#fff" : colors.foreground }} numberOfLines={1}>{s.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );

  // 价格表管理
  const renderPricesTab = () => (
    <View>
      {/* 格式说明 */}
      <View style={[styles.hintBox, { backgroundColor: "#EFF4FF", borderColor: "#BFD0FE" }]}>
        <Text style={{ fontSize: 13, color: "#1A56DB", lineHeight: 20 }}>
          📋 上传您的报价表 Excel，系统将原样保存所有 Sheet 数据。{"\n"}
          客户提交询价时，系统会根据目的国和品类自动定位到对应的 Sheet 和价格区域，辅助您快速报价。{"\n"}
          支持任意格式的 Excel 报价表，无需固定列名。
        </Text>
      </View>

      {/* 上传区域 */}
      <TouchableOpacity
        style={[styles.uploadZone, { borderColor: colors.border }]}
        onPress={handleFileUpload}
      >
        <Text style={{ fontSize: 36, marginBottom: 8 }}>📤</Text>
        <Text style={[styles.uploadTitle, { color: colors.foreground }]}>点击上传报价表</Text>
        <Text style={[styles.uploadHint, { color: colors.muted }]}>支持 .xlsx / .xls / .csv</Text>
      </TouchableOpacity>

      {/* 上传预览：原样展示 Sheet 数据 */}
      {uploadPreview && (
        <View style={[styles.previewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.previewHeader}>
            <Text style={[styles.previewTitle, { color: colors.foreground }]}>
              {uploadPreview.fileName}
            </Text>
            <Text style={[styles.previewMeta, { color: colors.muted }]}>
              {uploadPreview.sheets.length} 个 Sheet · 共 {uploadPreview.totalRows} 行数据
            </Text>
          </View>

          {/* Sheet Tab 切换 */}
          {uploadPreview.sheets.length > 1 && renderSheetTabs(uploadPreview.sheets, activeSheetIdx, setActiveSheetIdx)}

          {/* 当前 Sheet 表格预览 */}
          {uploadPreview.sheets[activeSheetIdx] && (
            <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, overflow: "hidden" }}>
              <View style={{ backgroundColor: colors.primary + "08", paddingHorizontal: 12, paddingVertical: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: colors.primary }}>
                  {uploadPreview.sheets[activeSheetIdx].name}
                  <Text style={{ fontWeight: "400", color: colors.muted }}> ({uploadPreview.sheets[activeSheetIdx].rows.length} 行)</Text>
                </Text>
              </View>
              {renderSheetTable(uploadPreview.sheets[activeSheetIdx], 8)}
            </View>
          )}

          <View style={[styles.actionBar, { marginTop: 12 }]}>
            <TouchableOpacity style={[styles.btn, { borderColor: colors.border }]} onPress={() => setUploadPreview(null)}>
              <Text style={[styles.btnText, { color: colors.foreground }]}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnPrimary, { backgroundColor: colors.primary }]} onPress={handleConfirmUpload}>
              <Text style={[styles.btnText, { color: "#fff" }]}>✓ 确认上传生效</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 当前价格表信息 + 原样浏览 */}
      {priceTable && (
        <View style={[styles.previewCard, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 16 }]}>
          <View style={styles.previewHeader}>
            <Text style={[styles.previewTitle, { color: colors.foreground }]}>当前生效：{priceTable.fileName}</Text>
            <Text style={[styles.previewMeta, { color: colors.muted }]}>
              V{priceTable.version} · {priceTable.uploadedByName || "—"} 上传
            </Text>
          </View>

          {/* AI 解析状态栏 */}
          <View style={[styles.aiStatusBar, {
            backgroundColor: aiParseStatus === "parsed" ? "#F0FDF4" : aiParseStatus === "parsing" ? "#FFF7ED" : aiParseStatus === "failed" ? "#FEF2F2" : "#F8FAFC",
            borderColor: aiParseStatus === "parsed" ? "#BBF7D0" : aiParseStatus === "parsing" ? "#FED7AA" : aiParseStatus === "failed" ? "#FECACA" : colors.border,
          }]}>
            <Text style={{ fontSize: 13, flex: 1, color: aiParseStatus === "parsed" ? "#16A34A" : aiParseStatus === "parsing" ? "#EA580C" : aiParseStatus === "failed" ? "#DC2626" : colors.muted }}>
              {aiParseStatus === "idle" && "🤖 AI 未解析 — 点击右侧按钮启动 AI 智能解析价格规则"}
              {aiParseStatus === "parsing" && "⏳ AI 正在解析中… 请稍后刷新"}
              {aiParseStatus === "parsed" && `✅ AI 已解析完成，提取 ${aiRuleCount} 条价格规则`}
              {aiParseStatus === "failed" && `❌ AI 解析失败: ${aiParseError || "未知错误"}`}
            </Text>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: aiParseStatus === "parsing" ? "#F97316" : "#0EA5E9", borderWidth: 0 }]}
              onPress={aiParseStatus === "parsing" ? loadData : handleAiParse}
              disabled={aiParsing}
            >
              <Text style={[styles.btnText, { color: "#fff" }]}>
                {aiParsing ? "启动中..." : aiParseStatus === "parsing" ? "🔄 刷新状态" : aiParseStatus === "parsed" ? "🔄 重新解析" : "🤖 AI 解析"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* AI 规则查看/编辑按钮 */}
          {aiParseStatus === "parsed" && (
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: "#EFF6FF", borderColor: "#93C5FD" }]}
                onPress={handleLoadAiRules}
                disabled={aiRulesLoading}
              >
                <Text style={[styles.btnText, { color: "#1D4ED8" }]}>
                  {aiRulesLoading ? "加载中..." : "📊 查看 AI 计算逻辑"}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* AI 规则明细表格 */}
          {aiRulesVisible && aiRules.length > 0 && (
            <View style={{ marginTop: 12, borderWidth: 1, borderColor: "#BAE6FD", borderRadius: 10, overflow: "hidden", backgroundColor: "#F0F9FF" }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, backgroundColor: "#E0F2FE" }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#0369A1" }}>🧠 AI 解析规则明细（{aiRules.length} 条）</Text>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <TouchableOpacity
                    style={[styles.btn, { backgroundColor: "#10B981", borderWidth: 0, paddingVertical: 5, paddingHorizontal: 10 }]}
                    onPress={handleAddRule}
                  >
                    <Text style={{ fontSize: 12, color: "#fff", fontWeight: "500" }}>+ 新增</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btn, { backgroundColor: "#0284C7", borderWidth: 0, paddingVertical: 5, paddingHorizontal: 10 }]}
                    onPress={handleSaveAllRules}
                  >
                    <Text style={{ fontSize: 12, color: "#fff", fontWeight: "500" }}>💾 保存修改</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btn, { borderColor: "#94A3B8", paddingVertical: 5, paddingHorizontal: 10 }]}
                    onPress={() => setAiRulesVisible(false)}
                  >
                    <Text style={{ fontSize: 12, color: "#64748B", fontWeight: "500" }}>收起</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {/* 规则表头 */}
              <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                <View style={{ minWidth: 900 }}>
                  <View style={{ flexDirection: "row", paddingVertical: 8, paddingHorizontal: 10, backgroundColor: "#DBEAFE", borderBottomWidth: 1, borderBottomColor: "#BAE6FD" }}>
                    <Text style={{ width: 30, fontSize: 11, fontWeight: "600", color: "#1E40AF" }}>#</Text>
                    <Text style={{ width: 100, fontSize: 11, fontWeight: "600", color: "#1E40AF" }}>线路</Text>
                    <Text style={{ width: 70, fontSize: 11, fontWeight: "600", color: "#1E40AF" }}>运输方式</Text>
                    <Text style={{ width: 70, fontSize: 11, fontWeight: "600", color: "#1E40AF" }}>目的国</Text>
                    <Text style={{ width: 70, fontSize: 11, fontWeight: "600", color: "#1E40AF" }}>品类</Text>
                    <Text style={{ width: 90, fontSize: 11, fontWeight: "600", color: "#1E40AF" }}>计费单位</Text>
                    <Text style={{ width: 90, fontSize: 11, fontWeight: "600", color: "#1E40AF" }}>区间条件</Text>
                    <Text style={{ width: 70, fontSize: 11, fontWeight: "600", color: "#1E40AF" }}>单价</Text>
                    <Text style={{ width: 50, fontSize: 11, fontWeight: "600", color: "#1E40AF" }}>币种</Text>
                    <Text style={{ width: 80, fontSize: 11, fontWeight: "600", color: "#1E40AF" }}>时效</Text>
                    <Text style={{ width: 120, fontSize: 11, fontWeight: "600", color: "#1E40AF" }}>操作</Text>
                  </View>
                  {/* 规则行 */}
                  {aiRules.map((rule, idx) => (
                    <View key={idx} style={{ flexDirection: "row", paddingVertical: 7, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: "#E0F2FE", backgroundColor: idx % 2 === 0 ? "#F8FAFC" : "#FFFFFF" }}>
                      <Text style={{ width: 30, fontSize: 11, color: "#64748B" }}>{idx + 1}</Text>
                      <Text style={{ width: 100, fontSize: 11, color: "#0F172A" }} numberOfLines={1}>{rule.route || "-"}</Text>
                      <Text style={{ width: 70, fontSize: 11, color: "#0F172A" }}>{rule.transportMethod || "-"}</Text>
                      <Text style={{ width: 70, fontSize: 11, color: "#0F172A" }}>{rule.destinationCountry || "-"}</Text>
                      <Text style={{ width: 70, fontSize: 11, color: "#0F172A" }}>{rule.category || "-"}</Text>
                      <Text style={{ width: 90, fontSize: 11, color: "#0F172A" }}>{rule.pricingUnit || "-"}</Text>
                      <Text style={{ width: 90, fontSize: 11, color: "#0F172A" }}>{rule.volumeOrWeightRange || "-"}</Text>
                      <Text style={{ width: 70, fontSize: 11, color: "#DC2626", fontWeight: "600" }}>{rule.unitPrice}</Text>
                      <Text style={{ width: 50, fontSize: 11, color: "#0F172A" }}>{rule.currency || "RMB"}</Text>
                      <Text style={{ width: 80, fontSize: 11, color: "#0F172A" }}>{rule.transitTime || "-"}</Text>
                      <View style={{ width: 120, flexDirection: "row", gap: 4 }}>
                        <TouchableOpacity onPress={() => handleEditRule(idx)} style={{ backgroundColor: "#DBEAFE", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                          <Text style={{ fontSize: 10, color: "#1D4ED8" }}>编辑</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteRule(idx)} style={{ backgroundColor: "#FEE2E2", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                          <Text style={{ fontSize: 10, color: "#DC2626" }}>删除</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              </ScrollView>
              <View style={{ padding: 10, backgroundColor: "#E0F2FE", borderTopWidth: 1, borderTopColor: "#BAE6FD" }}>
                <Text style={{ fontSize: 11, color: "#475569" }}>
                  💡 提示：您可以编辑或删除不准确的规则，新增缺失的规则，修改后点击"保存修改"即可生效。AI 报价时将使用调整后的规则。
                </Text>
              </View>
            </View>
          )}

          {/* 加载并展示已保存的 Sheet 数据 */}
          {loadedSheets.length > 0 && (
            <View style={{ marginTop: 12 }}>
              {loadedSheets.length > 1 && renderSheetTabs(loadedSheets, loadedSheetIdx, setLoadedSheetIdx)}
              {loadedSheets[loadedSheetIdx] && (
                <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, overflow: "hidden" }}>
                  <View style={{ backgroundColor: colors.primary + "08", paddingHorizontal: 12, paddingVertical: 6 }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: colors.primary }}>
                      {loadedSheets[loadedSheetIdx].name}
                      <Text style={{ fontWeight: "400", color: colors.muted }}> ({loadedSheets[loadedSheetIdx].rows.length} 行)</Text>
                    </Text>
                  </View>
                  {renderSheetTable(loadedSheets[loadedSheetIdx])}
                </View>
              )}
            </View>
          )}
          {loadedSheets.length === 0 && (
            <TouchableOpacity
              style={[styles.btn, { marginTop: 8, alignSelf: "flex-start" }]}
              onPress={async () => {
                try {
                  const res = await api.getCurrentPriceTable();
                  if (res.success && res.priceTable?.rulesJson) {
                    const parsed = JSON.parse(res.priceTable.rulesJson);
                    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].name) {
                      setLoadedSheets(parsed as SheetData[]);
                    }
                  }
                } catch (e) { console.error(e); }
              }}
            >
              <Text style={[styles.btnText, { color: colors.primary }]}>👁 查看报价表内容</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );

  const content = (
    <ScreenContainer>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* 页面标题 */}
        <View style={styles.pageHeader}>
          <Text style={[styles.pageTitle, { color: colors.foreground }]}>半自动报价</Text>
          <Text style={[styles.pageDesc, { color: colors.muted }]}>
            客户提交清单 → 系统自动套价 → 人工确认 → 推送客户
          </Text>
        </View>

        {/* Tab 切换 */}
        <View style={[styles.tabBar, { borderColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "quotes" && { backgroundColor: colors.background }]}
            onPress={() => setActiveTab("quotes")}
          >
            <Text style={[styles.tabBtnText, { color: activeTab === "quotes" ? colors.foreground : colors.muted }]}>
              报价审核 {stats.pending > 0 ? `(${stats.pending})` : ""}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "prices" && { backgroundColor: colors.background }]}
            onPress={() => setActiveTab("prices")}
          >
            <Text style={[styles.tabBtnText, { color: activeTab === "prices" ? colors.foreground : colors.muted }]}>
              价格表管理
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, { marginLeft: "auto", backgroundColor: colors.primary, borderWidth: 0 }]}
            onPress={() => setNewQuoteModal(true)}
          >
            <Text style={[styles.btnText, { color: "#fff" }]}>+ 新建报价</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, { marginLeft: 8 }]} onPress={loadData}>
            <Text style={[styles.btnText, { color: colors.primary }]}>
              {refreshing ? "刷新中..." : "🔄 刷新"}
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === "quotes" && (
          <>
            {renderStats()}
            {/* 状态筛选 */}
            <View style={styles.filterRow}>
              {[
                { key: "all", label: "全部" },
                { key: "pending", label: "待审核" },
                { key: "confirmed", label: "已确认" },
                { key: "rejected", label: "已拒绝" },
              ].map(f => (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.filterBtn, statusFilter === f.key && { backgroundColor: colors.primary + "15" }]}
                  onPress={() => setStatusFilter(f.key)}
                >
                  <Text style={[styles.filterBtnText, { color: statusFilter === f.key ? colors.primary : colors.muted }]}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {/* 报价列表 */}
            {quotes.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={{ fontSize: 36, marginBottom: 12 }}>📭</Text>
                <Text style={[styles.emptyText, { color: colors.muted }]}>暂无报价请求</Text>
                <Text style={[styles.emptyHint, { color: colors.muted }]}>客户端提交清单后会在此显示</Text>
              </View>
            ) : (
              quotes.map(q => renderQuoteCard(q))
            )}
          </>
        )}

        {activeTab === "prices" && renderPricesTab()}
      </ScrollView>

      {/* 确认报价弹窗 */}
      <Modal visible={confirmModal.visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, maxWidth: isWide ? 500 : "90%" }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>确认发出报价</Text>
            <Text style={[styles.modalDesc, { color: colors.muted }]}>
              确认后客户将收到正式报价单
            </Text>
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.muted }]}>备注/附加说明</Text>
              <TextInput
                style={[styles.formInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                value={confirmNote}
                onChangeText={setConfirmNote}
                placeholder="可添加附加说明、税率提示等…"
                placeholderTextColor={colors.muted}
                multiline
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.muted }]}>有效期至</Text>
              <TextInput
                style={[styles.formInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                value={confirmExpiry}
                onChangeText={setConfirmExpiry}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.muted}
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.muted }]}>联系人</Text>
              <TextInput
                style={[styles.formInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                value={confirmContact}
                onChangeText={setConfirmContact}
                placeholder="您的姓名"
                placeholderTextColor={colors.muted}
              />
            </View>
            <View style={[styles.actionBar, { marginTop: 16 }]}>
              <TouchableOpacity style={[styles.btn, { borderColor: colors.border }]} onPress={() => setConfirmModal({ visible: false, quote: null })}>
                <Text style={[styles.btnText, { color: colors.foreground }]}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnPrimary, { backgroundColor: colors.primary }]} onPress={handleConfirmQuote}>
                <Text style={[styles.btnText, { color: "#fff" }]}>✓ 确认发出</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* AI 规则编辑弹窗 */}
      <Modal visible={editingRuleIdx !== null || addingRule} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, maxWidth: isWide ? 600 : "95%" }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {addingRule ? "新增价格规则" : "编辑价格规则"}
            </Text>
            <Text style={[styles.modalDesc, { color: colors.muted }]}>
              {addingRule ? "手动添加一条新的价格规则" : `编辑第 ${(editingRuleIdx ?? 0) + 1} 条规则`}
            </Text>
            {editingRule && (
              <ScrollView style={{ maxHeight: 400 }}>
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: colors.muted }]}>线路名称</Text>
                  <TextInput
                    style={[styles.formInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                    value={editingRule.route || ""}
                    onChangeText={(v) => setEditingRule({ ...editingRule, route: v })}
                    placeholder="如：深圳-巴西全境"
                    placeholderTextColor={colors.muted}
                  />
                </View>
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: colors.muted }]}>运输方式</Text>
                  <TextInput
                    style={[styles.formInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                    value={editingRule.transportMethod || ""}
                    onChangeText={(v) => setEditingRule({ ...editingRule, transportMethod: v })}
                    placeholder="如：海运拼箱/空运/铁路"
                    placeholderTextColor={colors.muted}
                  />
                </View>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.formLabel, { color: colors.muted }]}>目的国</Text>
                    <TextInput
                      style={[styles.formInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                      value={editingRule.destinationCountry || ""}
                      onChangeText={(v) => setEditingRule({ ...editingRule, destinationCountry: v })}
                      placeholder="如：巴西"
                      placeholderTextColor={colors.muted}
                    />
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.formLabel, { color: colors.muted }]}>品类</Text>
                    <TextInput
                      style={[styles.formInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                      value={editingRule.category || ""}
                      onChangeText={(v) => setEditingRule({ ...editingRule, category: v })}
                      placeholder="如：普货/电池/纳电"
                      placeholderTextColor={colors.muted}
                    />
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.formLabel, { color: colors.muted }]}>计费单位</Text>
                    <TextInput
                      style={[styles.formInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                      value={editingRule.pricingUnit || ""}
                      onChangeText={(v) => setEditingRule({ ...editingRule, pricingUnit: v })}
                      placeholder="如：RMB/KG、RMB/CBM"
                      placeholderTextColor={colors.muted}
                    />
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.formLabel, { color: colors.muted }]}>区间条件</Text>
                    <TextInput
                      style={[styles.formInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                      value={editingRule.volumeOrWeightRange || ""}
                      onChangeText={(v) => setEditingRule({ ...editingRule, volumeOrWeightRange: v })}
                      placeholder="如：1-100kg、45-999CBM"
                      placeholderTextColor={colors.muted}
                    />
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.formLabel, { color: colors.muted }]}>单价 *</Text>
                    <TextInput
                      style={[styles.formInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                      value={String(editingRule.unitPrice || "")}
                      onChangeText={(v) => setEditingRule({ ...editingRule, unitPrice: parseFloat(v) || 0 })}
                      placeholder="如：25.5"
                      placeholderTextColor={colors.muted}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.formLabel, { color: colors.muted }]}>币种</Text>
                    <TextInput
                      style={[styles.formInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                      value={editingRule.currency || "RMB"}
                      onChangeText={(v) => setEditingRule({ ...editingRule, currency: v })}
                      placeholder="RMB/USD"
                      placeholderTextColor={colors.muted}
                    />
                  </View>
                </View>
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: colors.muted }]}>时效</Text>
                  <TextInput
                    style={[styles.formInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                    value={editingRule.transitTime || ""}
                    onChangeText={(v) => setEditingRule({ ...editingRule, transitTime: v })}
                    placeholder="如：25-35天"
                    placeholderTextColor={colors.muted}
                  />
                </View>
                {editingRule.minimumCharge !== undefined && (
                  <View style={styles.formGroup}>
                    <Text style={[styles.formLabel, { color: colors.muted }]}>最低收费</Text>
                    <TextInput
                      style={[styles.formInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                      value={String(editingRule.minimumCharge || "")}
                      onChangeText={(v) => setEditingRule({ ...editingRule, minimumCharge: parseFloat(v) || 0 })}
                      placeholder="最低收费金额"
                      placeholderTextColor={colors.muted}
                      keyboardType="numeric"
                    />
                  </View>
                )}
              </ScrollView>
            )}
            <View style={[styles.actionBar, { marginTop: 16 }]}>
              <TouchableOpacity
                style={[styles.btn, { borderColor: colors.border }]}
                onPress={() => { setEditingRuleIdx(null); setEditingRule(null); setAddingRule(false); }}
              >
                <Text style={[styles.btnText, { color: colors.foreground }]}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary, { backgroundColor: colors.primary }]}
                onPress={addingRule ? handleSaveNewRule : handleSaveEditRule}
              >
                <Text style={[styles.btnText, { color: "#fff" }]}>✓ 保存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 新建报价弹窗 */}
      <Modal visible={newQuoteModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, maxWidth: isWide ? 560 : "95%" }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>新建报价</Text>
            <Text style={[styles.modalDesc, { color: colors.muted }]}>代客户提交询价，系统将自动套价</Text>
            <ScrollView style={{ maxHeight: 460 }}>
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.formLabel, { color: colors.muted }]}>联系人 *</Text>
                  <TextInput
                    style={[styles.formInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                    value={nqCustomer.name}
                    onChangeText={v => setNqCustomer(c => ({ ...c, name: v }))}
                    placeholder="姓名"
                    placeholderTextColor={colors.muted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.formLabel, { color: colors.muted }]}>邮箱 *</Text>
                  <TextInput
                    style={[styles.formInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                    value={nqCustomer.email}
                    onChangeText={v => setNqCustomer(c => ({ ...c, email: v }))}
                    placeholder="email@example.com"
                    placeholderTextColor={colors.muted}
                    autoCapitalize="none"
                  />
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.formLabel, { color: colors.muted }]}>公司</Text>
                  <TextInput
                    style={[styles.formInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                    value={nqCustomer.company}
                    onChangeText={v => setNqCustomer(c => ({ ...c, company: v }))}
                    placeholder="公司名称（选填）"
                    placeholderTextColor={colors.muted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.formLabel, { color: colors.muted }]}>电话</Text>
                  <TextInput
                    style={[styles.formInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                    value={nqCustomer.tel}
                    onChangeText={v => setNqCustomer(c => ({ ...c, tel: v }))}
                    placeholder="联系电话（选填）"
                    placeholderTextColor={colors.muted}
                  />
                </View>
              </View>
              <Text style={[styles.formLabel, { color: colors.muted, marginBottom: 8 }]}>货物清单</Text>
              {nqItems.map((item, idx) => (
                <View key={idx} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, marginBottom: 10 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: colors.foreground }}>货物 #{idx + 1}</Text>
                    {nqItems.length > 1 && (
                      <TouchableOpacity onPress={() => setNqItems(prev => prev.filter((_, i) => i !== idx))}>
                        <Text style={{ fontSize: 12, color: "#EF4444" }}>✕ 删除</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
                    <View style={{ flex: 2 }}>
                      <Text style={[styles.formLabel, { color: colors.muted }]}>品名 *</Text>
                      <TextInput
                        style={[styles.formInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                        value={item.name}
                        onChangeText={v => setNqItems(prev => prev.map((it, i) => i === idx ? { ...it, name: v } : it))}
                        placeholder="货物名称"
                        placeholderTextColor={colors.muted}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.formLabel, { color: colors.muted }]}>重量(kg) *</Text>
                      <TextInput
                        style={[styles.formInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                        value={item.weight}
                        onChangeText={v => setNqItems(prev => prev.map((it, i) => i === idx ? { ...it, weight: v } : it))}
                        placeholder="0"
                        placeholderTextColor={colors.muted}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.formLabel, { color: colors.muted }]}>体积(m³)</Text>
                      <TextInput
                        style={[styles.formInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                        value={item.volume}
                        onChangeText={v => setNqItems(prev => prev.map((it, i) => i === idx ? { ...it, volume: v } : it))}
                        placeholder="0"
                        placeholderTextColor={colors.muted}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.formLabel, { color: colors.muted }]}>目的国</Text>
                      <TextInput
                        style={[styles.formInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                        value={item.country}
                        onChangeText={v => setNqItems(prev => prev.map((it, i) => i === idx ? { ...it, country: v } : it))}
                        placeholder="巴西"
                        placeholderTextColor={colors.muted}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.formLabel, { color: colors.muted }]}>品类</Text>
                      <TextInput
                        style={[styles.formInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                        value={item.category}
                        onChangeText={v => setNqItems(prev => prev.map((it, i) => i === idx ? { ...it, category: v } : it))}
                        placeholder="普货"
                        placeholderTextColor={colors.muted}
                      />
                    </View>
                  </View>
                </View>
              ))}
              <TouchableOpacity
                style={[styles.btn, { borderStyle: "dashed", alignSelf: "flex-start", marginBottom: 4 }]}
                onPress={() => setNqItems(prev => [...prev, { name: "", weight: "", volume: "", country: "巴西", category: "普货" }])}
              >
                <Text style={[styles.btnText, { color: colors.primary }]}>+ 增加货物</Text>
              </TouchableOpacity>
            </ScrollView>
            <View style={[styles.actionBar, { marginTop: 16 }]}>
              <TouchableOpacity
                style={[styles.btn, { borderColor: colors.border }]}
                onPress={() => {
                  setNewQuoteModal(false);
                  setNqCustomer({ name: "", email: "", company: "", tel: "" });
                  setNqItems([{ name: "", weight: "", volume: "", country: "巴西", category: "普货" }]);
                }}
              >
                <Text style={[styles.btnText, { color: colors.foreground }]}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary, { backgroundColor: colors.primary, opacity: nqSubmitting ? 0.6 : 1 }]}
                onPress={handleNewQuoteSubmit}
                disabled={nqSubmitting}
              >
                <Text style={[styles.btnText, { color: "#fff" }]}>{nqSubmitting ? "提交中..." : "✓ 提交询价"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );

  return (
    <AuthGuard>
      <WebLayout>{content}</WebLayout>
    </AuthGuard>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  pageHeader: { marginBottom: 20 },
  pageTitle: { fontSize: 22, fontWeight: "700" },
  pageDesc: { fontSize: 13, marginTop: 4 },
  tabBar: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, marginBottom: 16, paddingBottom: 8 },
  tabBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6, marginRight: 4 },
  tabBtnText: { fontSize: 14, fontWeight: "500" },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 16, flexWrap: "wrap" },
  statsRowWide: { flexWrap: "nowrap" },
  statCard: { flex: 1, minWidth: 140, padding: 14, borderRadius: 12, borderWidth: 1 },
  statLabel: { fontSize: 12, marginBottom: 4 },
  statValue: { fontSize: 24, fontWeight: "700" },
  statVersionText: { fontSize: 13, fontWeight: "600", marginTop: 2 },
  filterRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16 },
  filterBtnText: { fontSize: 13, fontWeight: "500" },
  quoteCard: { borderWidth: 1, borderRadius: 12, marginBottom: 12, overflow: "hidden" },
  quoteCardHeader: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  quoteInfo: { flex: 1 },
  quoteCustomer: { fontSize: 14, fontWeight: "500" },
  quoteMeta: { fontSize: 12, marginTop: 2 },
  quoteRight: { alignItems: "flex-end" },
  quoteTotal: { fontSize: 17, fontWeight: "700" },
  statusTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, marginTop: 4 },
  statusTagText: { fontSize: 11, fontWeight: "500" },
  quoteTime: { fontSize: 11, marginTop: 2 },
  quoteCardBody: { padding: 16, borderTopWidth: 1 },
  itemsTable: { borderWidth: 1, borderRadius: 8, overflow: "hidden" },
  tableHeader: { flexDirection: "row", paddingVertical: 8, paddingHorizontal: 10 },
  th: { flex: 1, fontSize: 11, fontWeight: "500" },
  tableRow: { flexDirection: "row", paddingVertical: 9, paddingHorizontal: 10, borderTopWidth: 1 },
  td: { flex: 1, fontSize: 12 },
  actionBar: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 14 },
  btn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: "transparent" },
  btnText: { fontSize: 13, fontWeight: "500" },
  btnPrimary: { borderWidth: 0 },
  btnDanger: {},
  hintBox: { padding: 14, borderRadius: 8, borderWidth: 1, marginBottom: 16 },
  uploadZone: { borderWidth: 2, borderStyle: "dashed", borderRadius: 12, padding: 40, alignItems: "center", justifyContent: "center" },
  uploadTitle: { fontSize: 15, fontWeight: "500", marginBottom: 4 },
  uploadHint: { fontSize: 13 },
  previewCard: { borderWidth: 1, borderRadius: 12, padding: 16, marginTop: 16 },
  previewHeader: {},
  previewTitle: { fontSize: 14, fontWeight: "600" },
  previewMeta: { fontSize: 12, marginTop: 4 },
  emptyState: { alignItems: "center", paddingVertical: 60 },
  emptyText: { fontSize: 14, marginBottom: 4 },
  emptyHint: { fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" },
  modalContent: { width: "90%", borderRadius: 14, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 4 },
  modalDesc: { fontSize: 13, marginBottom: 16 },
  formGroup: { marginBottom: 12 },
  formLabel: { fontSize: 12, fontWeight: "500", marginBottom: 4 },
  formInput: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14 },
  quoteFileBar: { flexDirection: "row", alignItems: "center", padding: 10, borderRadius: 8, borderWidth: 1, marginBottom: 10, gap: 8 },
  aiResultBox: { padding: 14, borderRadius: 10, borderWidth: 1, marginBottom: 12, marginTop: 8 },
  aiStatusBar: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 8, borderWidth: 1, marginTop: 12, gap: 8 },
});
