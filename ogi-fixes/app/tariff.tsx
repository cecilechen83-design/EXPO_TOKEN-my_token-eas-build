import React, { useState, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Platform,
} from "react-native";
import { useColors } from "@/hooks/use-colors";
import { WebLayout } from "@/components/web-sidebar";
import { searchTariff, calcTotal, getMainRate, COUNTRIES, FIXED_TAXES, type TariffItem } from "@/lib/tariff-data";

const QUICK_TAGS = ["手机", "运动鞋", "T恤", "化妆品", "电视", "空调", "家具", "8517", "6404", "3304"];

const COUNTRY_COLORS: Record<string, string> = {
  BR: "#009c3b", MX: "#006847", AR: "#74acdf",
  CO: "#d4a017", CL: "#d52b1e", PE: "#d91023",
};

function rateColor(rate: number) {
  if (rate === 0) return "#10b981";
  if (rate <= 5) return "#34d399";
  if (rate <= 15) return "#f59e0b";
  if (rate <= 25) return "#f97316";
  return "#ef4444";
}

export default function TariffScreen() {
  const colors = useColors();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TariffItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const doSearch = useCallback((q?: string) => {
    const term = (q ?? query).trim();
    if (!term) return;
    setLoading(true);
    setSearched(false);
    setTimeout(() => {
      setResults(searchTariff(term));
      setSearched(true);
      setLoading(false);
    }, 300);
  }, [query]);

  return (
    <WebLayout>
      <ScrollView style={[styles.root, { backgroundColor: colors.background }]} keyboardShouldPersistTaps="handled">
        {/* Header Banner */}
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>🌎 万国拉美查税助手</Text>
          <Text style={styles.bannerSub}>拉美六国进口关税智能查询 · 支持商品名称 / HS编码 / 材质</Text>
          <View style={styles.flagRow}>
            {["🇧🇷 巴西", "🇲🇽 墨西哥", "🇦🇷 阿根廷", "🇨🇴 哥伦比亚", "🇨🇱 智利", "🇵🇪 秘鲁"].map(c => (
              <View key={c} style={styles.flagBadge}><Text style={styles.flagText}>{c}</Text></View>
            ))}
          </View>
        </View>

        {/* Search Box */}
        <View style={[styles.searchCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.inputRow, { borderColor: colors.border }]}>
            <Text style={{ fontSize: 18, marginRight: 8 }}>🔍</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => doSearch()}
              placeholder="输入商品名称、HS编码或材质..."
              placeholderTextColor={colors.muted}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => { setQuery(""); setSearched(false); setResults([]); }}>
                <Text style={{ color: colors.muted, fontSize: 18, padding: 4 }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[styles.searchBtn, { backgroundColor: colors.primary, opacity: query.trim() ? 1 : 0.5 }]}
            onPress={() => doSearch()}
            disabled={!query.trim() || loading}
          >
            <Text style={styles.searchBtnText}>{loading ? "查询中..." : "查询税率"}</Text>
          </TouchableOpacity>

          {/* Quick Tags */}
          <View style={styles.tagRow}>
            <Text style={[styles.tagHint, { color: colors.muted }]}>快速：</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {QUICK_TAGS.map(tag => (
                <TouchableOpacity
                  key={tag}
                  style={[styles.tag, { borderColor: colors.border, backgroundColor: colors.background }]}
                  onPress={() => { setQuery(tag); doSearch(tag); }}
                >
                  <Text style={[styles.tagText, { color: colors.foreground }]}>{tag}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* Loading */}
        {loading && (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.hint, { color: colors.muted }]}>正在查询税率数据库...</Text>
          </View>
        )}

        {/* No Results */}
        {searched && !loading && results.length === 0 && (
          <View style={styles.centerBox}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>🔎</Text>
            <Text style={[styles.hint, { color: colors.foreground, fontWeight: "600" }]}>未找到"{query}"的税率信息</Text>
            <Text style={[styles.hint, { color: colors.muted, marginTop: 4 }]}>请尝试更换关键词或直接输入HS编码</Text>
          </View>
        )}

        {/* Results */}
        {searched && !loading && results.length > 0 && (
          <View style={styles.resultSection}>
            <Text style={[styles.resultCount, { color: colors.primary }]}>
              找到 {results.length} 个匹配商品
            </Text>
            {results.map((item) => (
              <ResultCard
                key={item.hs}
                item={item}
                colors={colors}
                expanded={expanded === item.hs}
                onToggle={() => setExpanded(expanded === item.hs ? null : item.hs)}
              />
            ))}
          </View>
        )}

        {/* Help */}
        {!searched && !loading && <HelpSection colors={colors} />}

        {/* Disclaimer */}
        <View style={[styles.disclaimer, { borderColor: colors.border }]}>
          <Text style={[styles.disclaimerText, { color: colors.muted }]}>
            ⚠️ 税率数据仅供参考（2025年MFN税率），实际税率以各国海关官方公布为准。
          </Text>
        </View>
      </ScrollView>
    </WebLayout>
  );
}

function ResultCard({ item, colors, expanded, onToggle }: {
  item: TariffItem; colors: any; expanded: boolean; onToggle: () => void;
}) {
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Card Header */}
      <TouchableOpacity style={styles.cardHeader} onPress={onToggle} activeOpacity={0.7}>
        <View style={styles.cardHeaderLeft}>
          <View style={[styles.hsBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.hsBadgeText}>{item.hs}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.itemName, { color: colors.foreground }]}>{item.name}</Text>
            <Text style={[styles.itemKw, { color: colors.muted }]} numberOfLines={1}>
              {item.keywords.slice(0, 4).join("、")}
            </Text>
          </View>
        </View>
        <Text style={[styles.chevron, { color: colors.muted }]}>{expanded ? "▲" : "▼"}</Text>
      </TouchableOpacity>

      {/* Rate Summary Row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rateRow}>
        {COUNTRIES.map(c => {
          const rate = getMainRate(item, c.code);
          const color = rateColor(rate);
          return (
            <View key={c.code} style={[styles.rateChip, { borderColor: color + "50", backgroundColor: color + "15" }]}>
              <Text style={styles.rateFlag}>{c.flag}</Text>
              <Text style={[styles.rateVal, { color }]}>{rate}%</Text>
              <Text style={[styles.rateName, { color: colors.muted }]}>{c.name}</Text>
            </View>
          );
        })}
      </ScrollView>

      {/* Expanded Detail */}
      {expanded && (
        <View style={styles.detailSection}>
          {COUNTRIES.map(c => (
            <CountryDetail key={c.code} countryCode={c.code} countryName={c.name} flag={c.flag} item={item} colors={colors} />
          ))}
        </View>
      )}
    </View>
  );
}

function CountryDetail({ countryCode, countryName, flag, item, colors }: {
  countryCode: string; countryName: string; flag: string; item: TariffItem; colors: any;
}) {
  const countryColor = COUNTRY_COLORS[countryCode] ?? "#888";
  const fixed = FIXED_TAXES[countryCode as keyof typeof FIXED_TAXES];
  const mainRate = getMainRate(item, countryCode);
  const total = calcTotal(item, countryCode);

  let rows: { label: string; value: string; main?: boolean }[] = [];

  if (countryCode === 'BR') {
    const d = item.BR;
    rows = [
      { label: "II 进口税", value: `${d.ii}%`, main: true },
      { label: "IPI 工业品税", value: `${d.ipi}%` },
      { label: "PIS", value: `${(fixed as any).pis}%` },
      { label: "COFINS", value: `${(fixed as any).cofins}%` },
      { label: "ICMS（含税基调整）", value: `≈${((fixed as any).icms * (1 + (d.ii + d.ipi + (fixed as any).pis + (fixed as any).cofins) / 100)).toFixed(1)}%` },
    ];
  } else if (countryCode === 'MX') {
    rows = [
      { label: "IGI 进口关税", value: `${item.MX.igi}%`, main: true },
      { label: "IVA 增值税", value: `${(fixed as any).iva}%` },
    ];
  } else if (countryCode === 'AR') {
    rows = [
      { label: "进口关税", value: `${item.AR.arancel}%`, main: true },
      { label: "IVA 增值税", value: `${(fixed as any).iva}%` },
      { label: "统计税", value: `${(fixed as any).estadistica}%` },
    ];
  } else if (countryCode === 'CO') {
    rows = [
      { label: "进口关税", value: `${item.CO.arancel}%`, main: true },
      { label: "IVA 增值税", value: `${(fixed as any).iva}%` },
    ];
  } else if (countryCode === 'CL') {
    rows = [
      { label: "进口关税", value: `${item.CL.arancel}%`, main: true },
      { label: "IVA 增值税", value: `${(fixed as any).iva}%` },
    ];
  } else if (countryCode === 'PE') {
    rows = [
      { label: "进口关税", value: `${item.PE.arancel}%`, main: true },
      { label: "IGV（16%）+ IPM（2%）", value: "18%" },
    ];
  }

  return (
    <View style={[styles.countryCard, { borderLeftColor: countryColor }]}>
      <View style={styles.countryHeader}>
        <Text style={{ fontSize: 22 }}>{flag}</Text>
        <Text style={[styles.countryName, { color: colors.foreground }]}>{countryName}</Text>
        <View style={{ flex: 1 }} />
        <Text style={[styles.mainRate, { color: rateColor(mainRate) }]}>{mainRate}%</Text>
        <Text style={[styles.mainRateLabel, { color: colors.muted }]}>关税</Text>
      </View>
      {rows.map((r, i) => (
        <View key={i} style={[styles.taxRow, { borderBottomColor: colors.border }]}>
          <Text style={[styles.taxLabel, { color: r.main ? colors.foreground : colors.muted, fontWeight: r.main ? "600" : "400" }]}>
            {r.label}
          </Text>
          <Text style={[styles.taxValue, { color: r.main ? rateColor(mainRate) : colors.foreground }]}>
            {r.value}
          </Text>
        </View>
      ))}
      <View style={styles.totalRow}>
        <Text style={[styles.totalLabel, { color: colors.foreground }]}>综合税负（约）</Text>
        <Text style={[styles.totalValue, { color: countryColor }]}>{total.toFixed(1)}%</Text>
      </View>
    </View>
  );
}

function HelpSection({ colors }: { colors: any }) {
  return (
    <View style={styles.helpSection}>
      <Text style={[styles.helpTitle, { color: colors.foreground }]}>💡 使用说明</Text>
      {[
        { icon: "🏷️", t: "HS编码查询", d: "直接输入编码，如 8517（手机）、6404（运动鞋）" },
        { icon: "📦", t: "商品名称", d: "输入中文名称，如 空调、洗衣机、化妆品" },
        { icon: "🧵", t: "材质查询", d: "输入材质，如 棉、皮革、铝、塑料" },
      ].map((h, i) => (
        <View key={i} style={[styles.helpItem, { borderColor: colors.border }]}>
          <Text style={{ fontSize: 22, marginRight: 10 }}>{h.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.helpItemTitle, { color: colors.foreground }]}>{h.t}</Text>
            <Text style={[styles.helpItemDesc, { color: colors.muted }]}>{h.d}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  banner: {
    padding: 20, paddingBottom: 16,
    background: undefined,
    backgroundColor: "#0f172a",
  },
  bannerTitle: { color: "#fff", fontSize: 20, fontWeight: "800", marginBottom: 4 },
  bannerSub: { color: "rgba(255,255,255,0.55)", fontSize: 12, marginBottom: 10 },
  flagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  flagBadge: { backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  flagText: { color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: "500" },

  searchCard: { margin: 12, borderRadius: 14, borderWidth: 1, padding: 14 },
  inputRow: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 10,
  },
  input: { flex: 1, fontSize: 15, paddingVertical: Platform.OS === "ios" ? 8 : 4 },
  searchBtn: { borderRadius: 10, paddingVertical: 12, alignItems: "center", marginBottom: 10 },
  searchBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  tagRow: { flexDirection: "row", alignItems: "center" },
  tagHint: { fontSize: 12, marginRight: 6 },
  tag: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 4, marginRight: 6 },
  tagText: { fontSize: 12 },

  centerBox: { alignItems: "center", paddingVertical: 40 },
  hint: { fontSize: 14, marginTop: 8 },

  resultSection: { paddingHorizontal: 12, paddingBottom: 8 },
  resultCount: { fontSize: 13, fontWeight: "700", marginBottom: 10 },

  card: { borderRadius: 14, borderWidth: 1, marginBottom: 12, overflow: "hidden" },
  cardHeader: {
    flexDirection: "row", alignItems: "center", padding: 14,
    justifyContent: "space-between",
  },
  cardHeaderLeft: { flexDirection: "row", alignItems: "center", flex: 1, gap: 10 },
  hsBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  hsBadgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  itemName: { fontSize: 14, fontWeight: "700" },
  itemKw: { fontSize: 11, marginTop: 2 },
  chevron: { fontSize: 12, marginLeft: 8 },

  rateRow: { paddingHorizontal: 12, paddingBottom: 12 },
  rateChip: {
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
    marginRight: 8, alignItems: "center", minWidth: 62,
  },
  rateFlag: { fontSize: 16, marginBottom: 2 },
  rateVal: { fontSize: 15, fontWeight: "800" },
  rateName: { fontSize: 10, marginTop: 1 },

  detailSection: { padding: 12, paddingTop: 4, gap: 10 },
  countryCard: {
    borderRadius: 10, borderLeftWidth: 3, padding: 12,
    backgroundColor: "rgba(0,0,0,0.03)",
  },
  countryHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 8 },
  countryName: { fontSize: 14, fontWeight: "700" },
  mainRate: { fontSize: 20, fontWeight: "800" },
  mainRateLabel: { fontSize: 10, marginLeft: 2, alignSelf: "flex-end", marginBottom: 2 },
  taxRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  taxLabel: { fontSize: 12 },
  taxValue: { fontSize: 13, fontWeight: "600" },
  totalRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginTop: 8, paddingTop: 6,
  },
  totalLabel: { fontSize: 13, fontWeight: "600" },
  totalValue: { fontSize: 18, fontWeight: "800" },

  helpSection: { margin: 12 },
  helpTitle: { fontSize: 15, fontWeight: "700", marginBottom: 10 },
  helpItem: { flexDirection: "row", alignItems: "flex-start", padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
  helpItemTitle: { fontSize: 13, fontWeight: "600", marginBottom: 2 },
  helpItemDesc: { fontSize: 12 },

  disclaimer: { margin: 12, padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 24 },
  disclaimerText: { fontSize: 11, lineHeight: 16 },
});
