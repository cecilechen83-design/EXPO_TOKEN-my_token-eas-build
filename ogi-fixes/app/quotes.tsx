import { useState, useCallback, useEffect, useRef } from "react";
import {
  Text, View, TouchableOpacity, ScrollView, TextInput,
  StyleSheet, Alert, Platform, ActivityIndicator, useWindowDimensions,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { WebLayout } from "@/components/web-sidebar";
import { AuthGuard } from "@/components/auth-guard";
import { useAuth } from "@/lib/auth-context";
import { IconSymbol } from "@/components/ui/icon-symbol";

const CHANNELS = ["海运整柜", "海运拼柜", "空运", "快递", "小包", "铁路", "卡车"];
const CURRENCIES = ["RMB", "USD", "EUR"];

type PriceTable = {
  id: number;
  version: string;
  fileName: string;
  country: string;
  channel: string;
  currency: string;
  validFrom: string | null;
  validTo: string | null;
  ruleCount: number;
  isCurrent: number;
  aiParseStatus: string;
  uploadedByName: string;
  createdAt: string;
};

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

export default function QuotesScreen() {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const { user } = useAuth();

  const [tables, setTables] = useState<PriceTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);

  const [filterCountry, setFilterCountry] = useState("");
  const [filterChannel, setFilterChannel] = useState("");

  const [showUpload, setShowUpload] = useState(false);
  const [uploadCountry, setUploadCountry] = useState("");
  const [uploadChannel, setUploadChannel] = useState("");
  const [uploadCurrency, setUploadCurrency] = useState("RMB");
  const [uploadValidFrom, setUploadValidFrom] = useState("");
  const [uploadValidTo, setUploadValidTo] = useState("");
  const [uploadFileName, setUploadFileName] = useState("");
  const [parsedSheets, setParsedSheets] = useState<{ name: string; headers: string[]; rows: string[][] }[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadTables = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet("/api/price-table/list");
      if (res.success) setTables(res.priceTables || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { loadTables(); }, [loadTables]);

  const handleFileSelect = () => {
    if (Platform.OS !== "web") { showAlert("提示", "请在网页版操作"); return; }
    fileInputRef.current?.click();
  };

  const handleFileChange = async (file: File) => {
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });

      const sheets: { name: string; headers: string[]; rows: string[][] }[] = [];
      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[][];
        if (rawRows.length === 0) continue;
        let headerIdx = 0;
        for (let i = 0; i < Math.min(rawRows.length, 5); i++) {
          if (rawRows[i].filter((c: any) => String(c).trim() !== "").length >= 2) { headerIdx = i; break; }
        }
        const headers = rawRows[headerIdx].map((c: any) => String(c).trim());
        const dataRows = rawRows.slice(headerIdx + 1)
          .filter((row: any[]) => row.some((c: any) => String(c).trim() !== ""))
          .map((row: any[]) => row.map((c: any) => String(c).trim()));
        sheets.push({ name: sheetName, headers, rows: dataRows });
      }

      if (sheets.length === 0) { showAlert("错误", "文件中未读取到有效数据"); return; }
      setParsedSheets(sheets);
      setUploadFileName(file.name);
      setShowUpload(true);
    } catch (err: any) {
      showAlert("解析失败", err.message);
    }
  };

  const handleUpload = async () => {
    if (!uploadCountry.trim()) { showAlert("提示", "请填写目的国"); return; }
    if (!uploadChannel) { showAlert("提示", "请选择渠道"); return; }
    if (parsedSheets.length === 0) { showAlert("提示", "请先选择报价表文件"); return; }

    setUploading(true);
    try {
      const res = await apiPost("/api/price-table/upload", {
        rules: parsedSheets,
        fileName: uploadFileName,
        sheetNames: parsedSheets.map(s => s.name),
        country: uploadCountry.trim(),
        channel: uploadChannel,
        currency: uploadCurrency,
        validFrom: uploadValidFrom || null,
        validTo: uploadValidTo || null,
        uploadedBy: (user as any)?.id,
        uploadedByName: (user as any)?.name || "",
      });
      if (res.success) {
        showAlert("上传成功", res.message || "报价表已上传并开始AI解析");
        setShowUpload(false);
        setUploadCountry(""); setUploadChannel(""); setUploadCurrency("RMB");
        setUploadValidFrom(""); setUploadValidTo("");
        setUploadFileName(""); setParsedSheets([]);
        setTimeout(loadTables, 3000);
      } else {
        showAlert("上传失败", res.message || "请重试");
      }
    } catch (err: any) {
      showAlert("错误", err.message);
    }
    setUploading(false);
  };

  const handleSetCurrent = async (id: number) => {
    setActionId(id);
    try {
      const res = await apiPost(`/api/price-table/${id}/set-current`, {});
      if (res.success) { showAlert("成功", "已设为当前报价表"); loadTables(); }
      else showAlert("失败", res.message || "操作失败");
    } catch (e) { showAlert("错误", "网络错误"); }
    setActionId(null);
  };

  const handleAiParse = async (id: number) => {
    setActionId(id);
    try {
      const res = await apiPost(`/api/ai-parse-price-table/${id}`, {});
      if (res.success) {
        showAlert("已启动", "AI 解析已启动，约10-30秒后刷新查看结果");
        setTimeout(loadTables, 12000);
      } else showAlert("失败", res.message || "启动失败");
    } catch (e) { showAlert("错误", "网络错误"); }
    setActionId(null);
  };

  const statusColor = (s: string) =>
    s === "done" ? "#10B981" : s === "parsing" ? "#F59E0B" : s === "error" ? "#EF4444" : "#9CA3AF";

  const statusLabel = (s: string) =>
    s === "done" ? "已解析" : s === "parsing" ? "解析中..." : s === "error" ? "解析错误" : "待解析";

  const filtered = tables.filter(t =>
    (!filterCountry || t.country.toLowerCase().includes(filterCountry.toLowerCase())) &&
    (!filterChannel || t.channel === filterChannel)
  );

  const renderUploadPanel = () => (
    <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.primary + "40" }]}>
      <View style={styles.panelHeader}>
        <IconSymbol name="tray.and.arrow.up.fill" size={20} color={colors.primary} />
        <Text style={[styles.panelTitle, { color: colors.foreground }]}>上传新报价表</Text>
        <TouchableOpacity onPress={() => setShowUpload(false)}>
          <Text style={{ color: colors.muted, fontSize: 20 }}>×</Text>
        </TouchableOpacity>
      </View>

      {parsedSheets.length > 0 && (
        <View style={[styles.sheetPreview, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Text style={[styles.sheetPreviewLabel, { color: colors.muted }]}>
            已读取文件：{uploadFileName}（{parsedSheets.length} 个Sheet，共 {parsedSheets.reduce((s, sh) => s + sh.rows.length, 0)} 行数据）
          </Text>
          <Text style={[styles.sheetPreviewText, { color: colors.foreground }]}>
            Sheet名：{parsedSheets.map(s => s.name).join("、")}
          </Text>
          <Text style={[styles.sheetHint, { color: colors.muted }]}>
            提示：每个Sheet对应一个国家。请为本次上传指定目的国和渠道。
          </Text>
        </View>
      )}

      {parsedSheets.length === 0 && (
        <TouchableOpacity
          style={[styles.selectFileBtn, { borderColor: colors.primary, backgroundColor: colors.primary + "08" }]}
          onPress={handleFileSelect}
        >
          <IconSymbol name="doc.badge.plus" size={22} color={colors.primary} />
          <Text style={[styles.selectFileBtnText, { color: colors.primary }]}>选择报价表文件（.xlsx/.xls）</Text>
        </TouchableOpacity>
      )}

      <View style={[styles.formGrid, isWide && { flexDirection: "row", flexWrap: "wrap", gap: 12 }]}>
        <View style={[styles.formGroup, isWide && { flex: 1, minWidth: 160 }]}>
          <Text style={[styles.label, { color: colors.muted }]}>目的国 *</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
            value={uploadCountry}
            onChangeText={setUploadCountry}
            placeholder="例如：巴西"
            placeholderTextColor={colors.muted}
          />
        </View>

        <View style={[styles.formGroup, isWide && { flex: 1, minWidth: 160 }]}>
          <Text style={[styles.label, { color: colors.muted }]}>渠道 *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {CHANNELS.map(ch => (
              <TouchableOpacity
                key={ch}
                style={[styles.chip, uploadChannel === ch && { backgroundColor: colors.primary + "20", borderColor: colors.primary }]}
                onPress={() => setUploadChannel(ch)}
              >
                <Text style={[styles.chipText, { color: uploadChannel === ch ? colors.primary : colors.muted }]}>{ch}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={[styles.formGroup, isWide && { flex: 0.6, minWidth: 120 }]}>
          <Text style={[styles.label, { color: colors.muted }]}>币制</Text>
          <View style={styles.chipRowSmall}>
            {CURRENCIES.map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.chipSmall, uploadCurrency === c && { backgroundColor: colors.primary + "20", borderColor: colors.primary }]}
                onPress={() => setUploadCurrency(c)}
              >
                <Text style={[styles.chipTextSmall, { color: uploadCurrency === c ? colors.primary : colors.muted }]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.formGroup, isWide && { flex: 1, minWidth: 140 }]}>
          <Text style={[styles.label, { color: colors.muted }]}>有效期开始</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
            value={uploadValidFrom}
            onChangeText={setUploadValidFrom}
            placeholder="2025-01-01"
            placeholderTextColor={colors.muted}
          />
        </View>

        <View style={[styles.formGroup, isWide && { flex: 1, minWidth: 140 }]}>
          <Text style={[styles.label, { color: colors.muted }]}>有效期结束</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
            value={uploadValidTo}
            onChangeText={setUploadValidTo}
            placeholder="2025-12-31"
            placeholderTextColor={colors.muted}
          />
        </View>
      </View>

      <View style={styles.uploadActions}>
        {parsedSheets.length > 0 ? (
          <TouchableOpacity
            style={[styles.changeFileBtn, { borderColor: colors.border }]}
            onPress={handleFileSelect}
          >
            <Text style={[styles.changeFileBtnText, { color: colors.muted }]}>更换文件</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={[styles.uploadBtn, { backgroundColor: colors.primary, opacity: uploading ? 0.6 : 1 }]}
          onPress={handleUpload}
          disabled={uploading}
        >
          {uploading ? <ActivityIndicator color="#fff" size="small" /> :
            <Text style={styles.uploadBtnText}>确认上传 →</Text>}
        </TouchableOpacity>
      </View>

      {Platform.OS === "web" && (
        <input
          ref={(el) => { fileInputRef.current = el; }}
          type="file"
          accept=".xlsx,.xls"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) handleFileChange(file);
            if (e.target) (e.target as HTMLInputElement).value = "";
          }}
        />
      )}
    </View>
  );

  const renderTableCard = (t: PriceTable) => (
    <View key={t.id} style={[
      styles.tableCard,
      { backgroundColor: colors.surface, borderColor: t.isCurrent ? colors.primary : colors.border },
    ]}>
      {t.isCurrent ? (
        <View style={[styles.currentBadge, { backgroundColor: colors.primary }]}>
          <Text style={styles.currentBadgeText}>当前</Text>
        </View>
      ) : null}

      <View style={styles.cardTop}>
        <View style={styles.cardMeta}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>
            {t.country} · {t.channel}
          </Text>
          <Text style={[styles.cardSub, { color: colors.muted }]} numberOfLines={1}>
            {t.fileName}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor(t.aiParseStatus) + "20" }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor(t.aiParseStatus) }]} />
          <Text style={[styles.statusText, { color: statusColor(t.aiParseStatus) }]}>{statusLabel(t.aiParseStatus)}</Text>
        </View>
      </View>

      <View style={styles.cardInfo}>
        <InfoPill label="币制" value={t.currency || "RMB"} colors={colors} />
        <InfoPill label="规则数" value={`${t.ruleCount || 0} 条`} colors={colors} />
        {t.validFrom && <InfoPill label="有效期" value={`${t.validFrom} ~ ${t.validTo || "长期"}`} colors={colors} />}
        <InfoPill label="上传时间" value={t.createdAt?.slice(0, 10) || ""} colors={colors} />
      </View>

      <View style={styles.cardActions}>
        {!t.isCurrent && (
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: colors.primary }]}
            onPress={() => handleSetCurrent(t.id)}
            disabled={actionId === t.id}
          >
            {actionId === t.id ? <ActivityIndicator size="small" color={colors.primary} /> :
              <Text style={[styles.actionBtnText, { color: colors.primary }]}>设为当前</Text>}
          </TouchableOpacity>
        )}
        {t.aiParseStatus !== "done" && t.aiParseStatus !== "parsing" && (
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: "#F59E0B" }]}
            onPress={() => handleAiParse(t.id)}
            disabled={actionId === t.id}
          >
            <Text style={[styles.actionBtnText, { color: "#F59E0B" }]}>AI解析</Text>
          </TouchableOpacity>
        )}
        {t.aiParseStatus === "error" && (
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: "#EF4444" }]}
            onPress={() => handleAiParse(t.id)}
          >
            <Text style={[styles.actionBtnText, { color: "#EF4444" }]}>重新解析</Text>
          </TouchableOpacity>
        )}
        {t.aiParseStatus === "parsing" && (
          <View style={[styles.actionBtn, { borderColor: "#F59E0B" }]}>
            <ActivityIndicator size="small" color="#F59E0B" />
            <Text style={[styles.actionBtnText, { color: "#F59E0B", marginLeft: 4 }]}>解析中</Text>
          </View>
        )}
        <View style={[styles.uploadedBy, { backgroundColor: colors.background }]}>
          <Text style={[styles.uploadedByText, { color: colors.muted }]}>上传: {t.uploadedByName || "系统"}</Text>
        </View>
      </View>
    </View>
  );

  const content = (
    <AuthGuard>
      <ScreenContainer>
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={styles.header}>
            <View>
              <Text style={[styles.pageTitle, { color: colors.foreground }]}>报价表资料库</Text>
              <Text style={[styles.pageDesc, { color: colors.muted }]}>
                管理各国各渠道报价表，每张报价表对应一个国家+渠道组合
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.uploadTriggerBtn, { backgroundColor: colors.primary }]}
              onPress={() => setShowUpload(true)}
            >
              <IconSymbol name="plus" size={16} color="#fff" />
              <Text style={styles.uploadTriggerText}>上传报价表</Text>
            </TouchableOpacity>
          </View>

          {showUpload && renderUploadPanel()}

          <View style={styles.filterBar}>
            <TextInput
              style={[styles.filterInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.surface }]}
              value={filterCountry}
              onChangeText={setFilterCountry}
              placeholder="按目的国筛选"
              placeholderTextColor={colors.muted}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterChips}>
              <TouchableOpacity
                style={[styles.filterChip, !filterChannel && { backgroundColor: colors.primary + "20", borderColor: colors.primary }]}
                onPress={() => setFilterChannel("")}
              >
                <Text style={[styles.filterChipText, { color: !filterChannel ? colors.primary : colors.muted }]}>全部渠道</Text>
              </TouchableOpacity>
              {CHANNELS.map(ch => (
                <TouchableOpacity
                  key={ch}
                  style={[styles.filterChip, filterChannel === ch && { backgroundColor: colors.primary + "20", borderColor: colors.primary }]}
                  onPress={() => setFilterChannel(filterChannel === ch ? "" : ch)}
                >
                  <Text style={[styles.filterChipText, { color: filterChannel === ch ? colors.primary : colors.muted }]}>{ch}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.empty}>
              <IconSymbol name="doc.text" size={48} color={colors.muted} />
              <Text style={[styles.emptyText, { color: colors.muted }]}>
                {tables.length === 0 ? "暂无报价表，请先上传" : "无匹配的报价表"}
              </Text>
            </View>
          ) : (
            <View style={isWide ? styles.gridWide : styles.gridNarrow}>
              {filtered.map(renderTableCard)}
            </View>
          )}
        </ScrollView>
      </ScreenContainer>
    </AuthGuard>
  );

  return <WebLayout>{content}</WebLayout>;
}

function InfoPill({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={[pillStyles.pill, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <Text style={[pillStyles.label, { color: colors.muted }]}>{label}</Text>
      <Text style={[pillStyles.value, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

const pillStyles = StyleSheet.create({
  pill: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4, marginRight: 6, marginBottom: 6 },
  label: { fontSize: 10, fontWeight: "500" },
  value: { fontSize: 12, fontWeight: "600", marginTop: 1 },
});

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  pageTitle: { fontSize: 22, fontWeight: "700" },
  pageDesc: { fontSize: 13, marginTop: 4 },
  uploadTriggerBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8 },
  uploadTriggerText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  panel: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 16 },
  panelHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  panelTitle: { fontSize: 16, fontWeight: "600", flex: 1 },
  sheetPreview: { borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 14 },
  sheetPreviewLabel: { fontSize: 12, marginBottom: 4 },
  sheetPreviewText: { fontSize: 13, fontWeight: "600" },
  sheetHint: { fontSize: 11, marginTop: 4, fontStyle: "italic" },
  selectFileBtn: { borderWidth: 2, borderStyle: "dashed", borderRadius: 10, paddingVertical: 24, alignItems: "center", gap: 8, marginBottom: 14 },
  selectFileBtnText: { fontSize: 15, fontWeight: "600" },
  formGrid: { gap: 12, marginBottom: 14 },
  formGroup: { marginBottom: 0 },
  label: { fontSize: 12, fontWeight: "500", marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14 },
  chipRow: { flexGrow: 0, flexShrink: 0, marginTop: 0 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: "#E5E7EB", marginRight: 6 },
  chipText: { fontSize: 13, fontWeight: "500" },
  chipRowSmall: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chipSmall: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: "#E5E7EB" },
  chipTextSmall: { fontSize: 12, fontWeight: "500" },
  uploadActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  changeFileBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 },
  changeFileBtnText: { fontSize: 13 },
  uploadBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, alignItems: "center", minWidth: 100 },
  uploadBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  filterBar: { gap: 10, marginBottom: 16 },
  filterInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14 },
  filterChips: { flexGrow: 0 },
  filterChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: "#E5E7EB", marginRight: 6 },
  filterChipText: { fontSize: 12, fontWeight: "500" },
  center: { paddingTop: 60, alignItems: "center" },
  empty: { paddingTop: 60, alignItems: "center", gap: 12 },
  emptyText: { fontSize: 14 },
  gridWide: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  gridNarrow: { gap: 12 },
  tableCard: { borderWidth: 1, borderRadius: 12, padding: 14, flex: 1, minWidth: 280, maxWidth: 480 },
  currentBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginBottom: 8 },
  currentBadgeText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  cardMeta: { flex: 1, marginRight: 8 },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  cardSub: { fontSize: 12, marginTop: 2 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: "600" },
  cardInfo: { flexDirection: "row", flexWrap: "wrap", marginBottom: 10 },
  cardActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  actionBtn: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  actionBtnText: { fontSize: 12, fontWeight: "600" },
  uploadedBy: { marginLeft: "auto", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  uploadedByText: { fontSize: 11 },
});
