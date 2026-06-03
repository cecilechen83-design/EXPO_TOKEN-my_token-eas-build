import React, { useState, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Platform,
} from "react-native";
import { useColors } from "@/hooks/use-colors";
import { WebLayout } from "@/components/web-sidebar";
import {
  searchTariff, TAX_DETAIL, COUNTRIES,
  calcBRDetail, calcMXDetail, calcARDetail, calcCODetail, calcCLDetail, calcPEDetail,
  getCertsForItem,
  type TariffItem,
} from "@/lib/tariff-data";

const QUICK_TAGS = [
  { label: "智能手机", q: "智能手机" }, { label: "运动鞋", q: "运动鞋" },
  { label: "T恤", q: "T恤" }, { label: "化妆品", q: "面霜" },
  { label: "电视机", q: "液晶电视" }, { label: "空调", q: "空调" },
  { label: "锂电池", q: "锂电池" }, { label: "8517.13", q: "8517.13" },
  { label: "6404.11", q: "6404.11" }, { label: "3304", q: "3304" },
];

export default function TariffScreen() {
  const colors = useColors();
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1=搜索 2=选NCM 3=国家详情
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TariffItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TariffItem | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string>("BR");
  const [cifValue, setCifValue] = useState("1000");

  const doSearch = useCallback((q?: string) => {
    const term = (q ?? query).trim();
    if (!term) return;
    setLoading(true);
    setSearched(false);
    setSelectedItem(null);
    setStep(1);
    setTimeout(() => {
      const found = searchTariff(term);
      setResults(found);
      setSearched(true);
      setLoading(false);
      if (found.length > 0) setStep(2);
    }, 300);
  }, [query]);

  const selectItem = (item: TariffItem) => {
    setSelectedItem(item);
    setStep(3);
  };

  const reset = () => {
    setStep(1);
    setResults([]);
    setSearched(false);
    setSelectedItem(null);
    setQuery("");
  };

  return (
    <WebLayout>
      <ScrollView
        style={[styles.root, { backgroundColor: colors.background }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Banner */}
        <View style={[styles.banner, { backgroundColor: "#0c1a2e" }]}>
          <View style={styles.bannerRow}>
            <Text style={styles.bannerIcon}>🌎</Text>
            <View>
              <Text style={styles.bannerTitle}>万国拉美查税助手</Text>
              <Text style={styles.bannerSub}>NCM / HS编码精准匹配 · 拉美六国全税种明细查询</Text>
            </View>
          </View>
          <View style={styles.flagRow}>
            {COUNTRIES.map(c => (
              <View key={c.code} style={styles.flagBadge}>
                <Text style={styles.flagText}>{c.flag} {c.name}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Step Indicator */}
        <View style={[styles.stepBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          {[
            { n: 1, label: "搜索品名/编码" },
            { n: 2, label: "确认NCM编码" },
            { n: 3, label: "查看税率详情" },
          ].map((s, i) => (
            <React.Fragment key={s.n}>
              <TouchableOpacity
                onPress={() => {
                  if (s.n < step || (s.n === 2 && results.length > 0)) {
                    setStep(s.n as 1 | 2 | 3);
                    if (s.n === 1) { setResults([]); setSearched(false); }
                  }
                }}
                style={styles.stepItem}
              >
                <View style={[
                  styles.stepCircle,
                  step >= s.n
                    ? { backgroundColor: colors.primary }
                    : { backgroundColor: colors.border }
                ]}>
                  <Text style={[styles.stepNum, { color: step >= s.n ? "#fff" : colors.muted }]}>
                    {step > s.n ? "✓" : s.n}
                  </Text>
                </View>
                <Text style={[
                  styles.stepLabel,
                  { color: step >= s.n ? colors.foreground : colors.muted },
                ]}>{s.label}</Text>
              </TouchableOpacity>
              {i < 2 && <View style={[styles.stepLine, { backgroundColor: step > s.n ? colors.primary : colors.border }]} />}
            </React.Fragment>
          ))}
        </View>

        {/* ===== STEP 1: 搜索 ===== */}
        {step === 1 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              输入品名、材质或NCM/HS编码
            </Text>

            {/* Search Input */}
            <View style={[styles.inputWrap, {
              borderColor: colors.primary,
              backgroundColor: colors.surface,
            }]}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={() => doSearch()}
                placeholder="例：运动鞋、棉质T恤、6404.11、锂电池..."
                placeholderTextColor={colors.muted}
                returnKeyType="search"
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => setQuery("")}>
                  <Text style={[styles.clearBtn, { color: colors.muted }]}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={[styles.searchBtn, {
                backgroundColor: query.trim() ? colors.primary : colors.border,
              }]}
              onPress={() => doSearch()}
              disabled={!query.trim() || loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.searchBtnText}>查询 NCM 编码及税率</Text>
              }
            </TouchableOpacity>

            {/* Quick Tags */}
            <View style={styles.tagSection}>
              <Text style={[styles.tagHint, { color: colors.muted }]}>快速查询：</Text>
              <View style={styles.tagWrap}>
                {QUICK_TAGS.map(t => (
                  <TouchableOpacity
                    key={t.q}
                    style={[styles.tag, { borderColor: colors.border, backgroundColor: colors.surface }]}
                    onPress={() => { setQuery(t.q); doSearch(t.q); }}
                  >
                    <Text style={[styles.tagText, { color: colors.foreground }]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Help */}
            <View style={[styles.helpBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.helpTitle, { color: colors.foreground }]}>📖 查询说明</Text>
              {[
                { icon: "🏷️", t: "HS/NCM编码", d: "直接输入编码，如 8517.13（手机）、6404.11（运动鞋）" },
                { icon: "📦", t: "商品名称", d: "中文品名，如 液晶电视、洗衣机、背包" },
                { icon: "🧵", t: "材质描述", d: "如"棉质T恤"、"皮革手提包"、"铝合金框架"" },
              ].map((h, i) => (
                <View key={i} style={styles.helpRow}>
                  <Text style={{ fontSize: 18, marginRight: 10 }}>{h.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.helpItemTitle, { color: colors.foreground }]}>{h.t}</Text>
                    <Text style={[styles.helpItemDesc, { color: colors.muted }]}>{h.d}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ===== STEP 2: 选NCM ===== */}
        {step === 2 && searched && (
          <View style={styles.section}>
            <View style={styles.stepHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                找到 {results.length} 个匹配的NCM/HS编码
              </Text>
              <TouchableOpacity onPress={reset} style={[styles.backBtn, { borderColor: colors.border }]}>
                <Text style={[styles.backBtnText, { color: colors.muted }]}>← 重新搜索</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.stepHint, { color: colors.muted }]}>
              请选择与您商品最匹配的NCM/HS编码 →
            </Text>

            {results.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={{ fontSize: 40 }}>🔎</Text>
                <Text style={[styles.emptyText, { color: colors.foreground }]}>未找到匹配结果</Text>
                <Text style={[styles.emptyHint, { color: colors.muted }]}>请尝试更换关键词或直接输入HS编码</Text>
              </View>
            ) : (
              results.map(item => (
                <TouchableOpacity
                  key={item.hs}
                  style={[styles.resultCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => selectItem(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.resultCardInner}>
                    <View style={[styles.hsBadge, { backgroundColor: colors.primary }]}>
                      <Text style={styles.hsBadgeText}>{item.hs}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.resultName, { color: colors.foreground }]}>{item.name}</Text>
                      <Text style={[styles.resultNameEn, { color: colors.muted }]}>{item.nameEn}</Text>
                      <View style={styles.resultMeta}>
                        <View style={[styles.chapterTag, { backgroundColor: colors.primary + "15" }]}>
                          <Text style={[styles.chapterText, { color: colors.primary }]}>{item.chapter}</Text>
                        </View>
                        <Text style={[styles.kwText, { color: colors.muted }]}>
                          {item.keywords.slice(0, 3).join("・")}
                        </Text>
                      </View>
                    </View>
                    {/* Mini rate preview */}
                    <View style={styles.miniRates}>
                      {COUNTRIES.slice(0, 3).map(c => {
                        const r = c.code === 'BR' ? item.BR.ii
                          : c.code === 'MX' ? item.MX.igi
                          : (item as any)[c.code]?.arancel ?? 0;
                        return (
                          <View key={c.code} style={styles.miniRate}>
                            <Text style={styles.miniFlag}>{c.flag}</Text>
                            <Text style={[styles.miniRateVal, { color: r === 0 ? "#10b981" : r >= 25 ? "#ef4444" : "#f59e0b" }]}>
                              {r}%
                            </Text>
                          </View>
                        );
                      })}
                      <Text style={[styles.selectArrow, { color: colors.primary }]}>→</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* ===== STEP 3: 国家税率详情 ===== */}
        {step === 3 && selectedItem && (
          <View style={styles.section}>
            {/* Selected Item Header */}
            <View style={styles.stepHeader}>
              <TouchableOpacity onPress={() => setStep(2)} style={[styles.backBtn, { borderColor: colors.border }]}>
                <Text style={[styles.backBtnText, { color: colors.muted }]}>← 返回编码列表</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.selectedItemCard, { backgroundColor: colors.surface, borderColor: colors.primary + "50" }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <View style={[styles.hsBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.hsBadgeText}>{selectedItem.hs}</Text>
                </View>
                <View style={[styles.chapterTag, { backgroundColor: colors.primary + "15" }]}>
                  <Text style={[styles.chapterText, { color: colors.primary }]}>{selectedItem.chapter}</Text>
                </View>
              </View>
              <Text style={[styles.selectedName, { color: colors.foreground }]}>{selectedItem.name}</Text>
              <Text style={[styles.selectedNameEn, { color: colors.muted }]}>{selectedItem.nameEn}</Text>
            </View>

            {/* CIF Input */}
            <View style={[styles.cifRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cifLabel, { color: colors.foreground }]}>模拟计税货值（USD）：</Text>
              <View style={[styles.cifInput, { borderColor: colors.border }]}>
                <Text style={[styles.cifPrefix, { color: colors.muted }]}>$</Text>
                <TextInput
                  style={[styles.cifField, { color: colors.foreground }]}
                  value={cifValue}
                  onChangeText={v => setCifValue(v.replace(/[^0-9]/g, ''))}
                  keyboardType="numeric"
                  placeholder="1000"
                  placeholderTextColor={colors.muted}
                />
                <Text style={[styles.cifSuffix, { color: colors.muted }]}>CIF</Text>
              </View>
            </View>

            {/* Country Selector */}
            <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 10 }]}>
              选择目的国查看完整税率：
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.countryTabs}>
              {COUNTRIES.map(c => (
                <TouchableOpacity
                  key={c.code}
                  onPress={() => setSelectedCountry(c.code)}
                  style={[
                    styles.countryTab,
                    {
                      borderColor: selectedCountry === c.code ? colors.primary : colors.border,
                      backgroundColor: selectedCountry === c.code ? colors.primary + "12" : colors.surface,
                    }
                  ]}
                >
                  <Text style={styles.countryTabFlag}>{c.flag}</Text>
                  <Text style={[styles.countryTabName, {
                    color: selectedCountry === c.code ? colors.primary : colors.foreground,
                    fontWeight: selectedCountry === c.code ? "700" : "400",
                  }]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Full Tax Detail */}
            <TaxDetailPanel
              item={selectedItem}
              countryCode={selectedCountry}
              colors={colors}
              cif={parseFloat(cifValue) || 1000}
            />

            {/* All Countries Summary */}
            <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.summaryTitle, { color: colors.foreground }]}>六国关税率一览</Text>
              <View style={styles.summaryGrid}>
                {COUNTRIES.map(c => {
                  const rate = c.code === 'BR' ? selectedItem.BR.ii
                    : c.code === 'MX' ? selectedItem.MX.igi
                    : (selectedItem as any)[c.code]?.arancel ?? 0;
                  const detail = TAX_DETAIL[c.code as keyof typeof TAX_DETAIL];
                  const cif = parseFloat(cifValue) || 1000;
                  let effective = 0;
                  if (c.code === 'BR') effective = calcBRDetail(selectedItem, cif).effective_rate;
                  else if (c.code === 'MX') effective = calcMXDetail(selectedItem, cif).effective_rate;
                  else if (c.code === 'AR') effective = calcARDetail(selectedItem, cif).effective_rate;
                  else if (c.code === 'CO') effective = calcCODetail(selectedItem, cif).effective_rate;
                  else if (c.code === 'CL') effective = calcCLDetail(selectedItem, cif).effective_rate;
                  else if (c.code === 'PE') effective = calcPEDetail(selectedItem, cif).effective_rate;

                  const isSelected = selectedCountry === c.code;
                  return (
                    <TouchableOpacity
                      key={c.code}
                      onPress={() => setSelectedCountry(c.code)}
                      style={[styles.summaryItem, {
                        borderColor: isSelected ? colors.primary : colors.border,
                        backgroundColor: isSelected ? colors.primary + "08" : "transparent",
                      }]}
                    >
                      <Text style={styles.summaryFlag}>{c.flag}</Text>
                      <Text style={[styles.summaryCountry, { color: colors.foreground }]}>{c.name}</Text>
                      <Text style={[styles.summaryRate, {
                        color: rate === 0 ? "#10b981" : rate >= 25 ? "#ef4444" : rate >= 15 ? "#f97316" : "#f59e0b"
                      }]}>{rate}%</Text>
                      <Text style={[styles.summaryRateLabel, { color: colors.muted }]}>关税</Text>
                      <Text style={[styles.summaryEffective, { color: colors.muted }]}>综合≈{effective.toFixed(0)}%</Text>
                      {(detail as any).ftaNote && (
                        <Text style={styles.ftaBadge}>FTA</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Disclaimer */}
            <View style={[styles.disclaimer, { borderColor: colors.border }]}>
              <Text style={[styles.disclaimerText, { color: colors.muted }]}>
                ⚠️ 以上税率为2025年MFN最惠国税率，仅供参考。实际税率可能因贸易协定、反倾销税、特殊监管规定而不同，正式报关前请向专业报关行确认。
              </Text>
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </WebLayout>
  );
}

// ============ 国家税率详情面板 ============
function TaxDetailPanel({ item, countryCode, colors, cif }: {
  item: TariffItem; countryCode: string; colors: any; cif: number;
}) {
  const detail = TAX_DETAIL[countryCode as keyof typeof TAX_DETAIL];
  if (!detail) return null;

  let rows: { label: string; basis: string; rate: string; amount: string; highlight?: boolean; note?: string; isTotal?: boolean }[] = [];
  let calcResult: any = {};

  if (countryCode === 'BR') {
    calcResult = calcBRDetail(item, cif);
    rows = [
      {
        label: "II — 进口税", basis: `CIF $${cif.toLocaleString()}`,
        rate: `${item.BR.ii}%`, amount: `$${calcResult.II.toFixed(2)}`, highlight: true,
        note: "直接对CIF征收",
      },
      {
        label: "IPI — 工业品税", basis: `CIF + II = $${(cif + calcResult.II).toFixed(2)}`,
        rate: `${item.BR.ipi}%`, amount: `$${calcResult.IPI.toFixed(2)}`,
        note: item.BR.ipiNote ?? "对CIF+II征收",
      },
      {
        label: "PIS — 社会统合税", basis: `CIF+II+IPI = $${(cif + calcResult.II + calcResult.IPI).toFixed(2)}`,
        rate: "2.1%", amount: `$${calcResult.PIS.toFixed(2)}`,
      },
      {
        label: "COFINS — 社会贡献税", basis: `CIF+II+IPI = $${(cif + calcResult.II + calcResult.IPI).toFixed(2)}`,
        rate: "9.75%", amount: `$${calcResult.COFINS.toFixed(2)}`,
      },
      {
        label: "ICMS — 州流通税（SP州）", basis: "含税倒算法（税率18%）",
        rate: "18%（含税）", amount: `$${calcResult.ICMS.toFixed(2)}`,
        note: "各州不同，以圣保罗州18%为参考；倒算后等效约21.95%",
      },
      {
        label: "合计税费", basis: "",
        rate: `综合税负 ${calcResult.effective_rate.toFixed(1)}%`,
        amount: `$${(calcResult.total - cif).toFixed(2)}`,
        isTotal: true,
      },
      {
        label: "到岸总成本（估算）", basis: "",
        rate: "", amount: `$${calcResult.total.toFixed(2)}`, isTotal: true,
      },
    ];
  } else if (countryCode === 'MX') {
    calcResult = calcMXDetail(item, cif);
    rows = [
      {
        label: "IGI — 进口关税", basis: `FOB/CIF $${cif.toLocaleString()}`,
        rate: `${item.MX.igi}%`, amount: `$${calcResult.IGI.toFixed(2)}`, highlight: true,
        note: "墨西哥以FOB为税基",
      },
      {
        label: "DTA — 海关手续费", basis: `FOB $${cif.toLocaleString()}`,
        rate: "0.8%", amount: `$${calcResult.DTA.toFixed(2)}`,
        note: "最低约$422 MXN",
      },
      {
        label: "IVA — 增值税", basis: `FOB+IGI+DTA = $${(cif + calcResult.IGI + calcResult.DTA).toFixed(2)}`,
        rate: "16%", amount: `$${calcResult.IVA.toFixed(2)}`,
      },
      {
        label: "合计税费", basis: "",
        rate: `综合税负 ${calcResult.effective_rate.toFixed(1)}%`,
        amount: `$${(calcResult.total - cif).toFixed(2)}`, isTotal: true,
      },
      {
        label: "到岸总成本（估算）", basis: "",
        rate: "", amount: `$${calcResult.total.toFixed(2)}`, isTotal: true,
      },
    ];
  } else if (countryCode === 'AR') {
    calcResult = calcARDetail(item, cif);
    rows = [
      {
        label: "进口关税（Arancel）", basis: `CIF $${cif.toLocaleString()}`,
        rate: `${item.AR.arancel}%`, amount: `$${calcResult.AR.toFixed(2)}`, highlight: true,
      },
      {
        label: "统计税（Estadística）", basis: `CIF $${cif.toLocaleString()}`,
        rate: "3%", amount: `$${calcResult.EST.toFixed(2)}`,
        note: "上限$500美元",
      },
      {
        label: "IVA — 增值税", basis: `CIF+关税+统计税`,
        rate: "21%", amount: `$${calcResult.IVA.toFixed(2)}`,
      },
      {
        label: "附加增值税（IVA Adicional）", basis: `CIF+关税+统计税`,
        rate: "10%", amount: `$${calcResult.IVA_ADI.toFixed(2)}`,
        note: "注册进口商10%，非注册20%",
      },
      {
        label: "预缴所得税（Ganancias）", basis: `CIF+关税+统计税`,
        rate: "3%", amount: `$${calcResult.GANANCIAS.toFixed(2)}`,
        note: "注册进口商3%，可年度抵扣",
      },
      {
        label: "合计税费", basis: "",
        rate: `综合税负 ${calcResult.effective_rate.toFixed(1)}%`,
        amount: `$${(calcResult.total - cif).toFixed(2)}`, isTotal: true,
      },
      {
        label: "到岸总成本（估算）", basis: "",
        rate: "", amount: `$${calcResult.total.toFixed(2)}`, isTotal: true,
      },
    ];
  } else if (countryCode === 'CO') {
    calcResult = calcCODetail(item, cif);
    rows = [
      {
        label: "进口关税（Arancel）", basis: `CIF $${cif.toLocaleString()}`,
        rate: `${item.CO.arancel}%`, amount: `$${calcResult.AR.toFixed(2)}`, highlight: true,
      },
      {
        label: "IVA — 增值税", basis: `CIF + 关税`,
        rate: "19%", amount: `$${calcResult.IVA.toFixed(2)}`,
        note: "标准19%，部分商品5%或免税",
      },
      {
        label: "合计税费", basis: "",
        rate: `综合税负 ${calcResult.effective_rate.toFixed(1)}%`,
        amount: `$${(calcResult.total - cif).toFixed(2)}`, isTotal: true,
      },
      {
        label: "到岸总成本（估算）", basis: "",
        rate: "", amount: `$${calcResult.total.toFixed(2)}`, isTotal: true,
      },
    ];
  } else if (countryCode === 'CL') {
    calcResult = calcCLDetail(item, cif);
    rows = [
      {
        label: "进口关税（Arancel）", basis: `CIF $${cif.toLocaleString()}`,
        rate: `${item.CL.arancel}%`, amount: `$${calcResult.AR.toFixed(2)}`, highlight: true,
        note: "MFN税率6%；持中智FTA原产地证可降至0%",
      },
      {
        label: "IVA — 增值税", basis: `CIF + 关税`,
        rate: "19%", amount: `$${calcResult.IVA.toFixed(2)}`,
      },
      {
        label: "合计税费（MFN）", basis: "",
        rate: `综合税负 ${calcResult.effective_rate.toFixed(1)}%`,
        amount: `$${(calcResult.total - cif).toFixed(2)}`, isTotal: true,
      },
      {
        label: "FTA优惠（中智协定）", basis: "需提供Form F原产地证书",
        rate: "关税 → 0%", amount: `节省 $${calcResult.AR.toFixed(2)}`,
        note: "持原产地证则综合税负约19%",
      },
      {
        label: "到岸总成本（估算MFN）", basis: "",
        rate: "", amount: `$${calcResult.total.toFixed(2)}`, isTotal: true,
      },
    ];
  } else if (countryCode === 'PE') {
    calcResult = calcPEDetail(item, cif);
    rows = [
      {
        label: "进口关税（Derecho Arancelario）", basis: `CIF $${cif.toLocaleString()}`,
        rate: `${item.PE.arancel}%`, amount: `$${calcResult.AR.toFixed(2)}`, highlight: true,
        note: "税率分0/4/6/11%档",
      },
      {
        label: "IGV — 一般销售税", basis: `CIF + 关税`,
        rate: "16%", amount: `$${calcResult.IGV.toFixed(2)}`,
      },
      {
        label: "IPM — 市政促进税", basis: `CIF + 关税`,
        rate: "2%", amount: `$${calcResult.IPM.toFixed(2)}`,
        note: "IGV+IPM合并征收=18%",
      },
      {
        label: "合计税费", basis: "",
        rate: `综合税负 ${calcResult.effective_rate.toFixed(1)}%`,
        amount: `$${(calcResult.total - cif).toFixed(2)}`, isTotal: true,
      },
      {
        label: "FTA优惠（中秘协定）", basis: "需提供原产地证书",
        rate: "关税可减免", amount: "视具体编码而定",
        note: "部分商品已降至0%",
      },
      {
        label: "到岸总成本（估算）", basis: "",
        rate: "", amount: `$${calcResult.total.toFixed(2)}`, isTotal: true,
      },
    ];
  }

  return (
    <View style={[styles.detailCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Country Header */}
      <View style={[styles.detailHeader, { borderBottomColor: colors.border }]}>
        <Text style={{ fontSize: 28 }}>
          {COUNTRIES.find(c => c.code === countryCode)?.flag}
        </Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.detailCountryName, { color: colors.foreground }]}>{detail.name}</Text>
          <Text style={[styles.detailSystem, { color: colors.muted }]}>{detail.system}</Text>
        </View>
        {(detail as any).ftaNote && (
          <View style={styles.ftaBox}>
            <Text style={styles.ftaText}>{(detail as any).ftaNote}</Text>
          </View>
        )}
      </View>

      {/* Tax Table */}
      <View style={styles.taxTable}>
        {/* Header */}
        <View style={[styles.taxTableHeader, { backgroundColor: colors.primary + "10", borderBottomColor: colors.border }]}>
          <Text style={[styles.taxCol1, styles.taxHeader, { color: colors.foreground }]}>税种</Text>
          <Text style={[styles.taxCol2, styles.taxHeader, { color: colors.foreground }]}>计税基础</Text>
          <Text style={[styles.taxCol3, styles.taxHeader, { color: colors.foreground }]}>税率</Text>
          <Text style={[styles.taxCol4, styles.taxHeader, { color: colors.foreground }]}>税额(USD)</Text>
        </View>

        {rows.map((row, i) => (
          <View
            key={i}
            style={[
              styles.taxRow,
              { borderBottomColor: colors.border },
              row.isTotal && { backgroundColor: colors.primary + "08" },
            ]}
          >
            <View style={styles.taxCol1}>
              <Text style={[
                styles.taxLabel,
                { color: row.highlight ? colors.primary : row.isTotal ? colors.foreground : colors.foreground },
                row.highlight && { fontWeight: "700" },
                row.isTotal && { fontWeight: "700" },
              ]}>{row.label}</Text>
              {row.note && <Text style={[styles.taxNote, { color: colors.muted }]}>{row.note}</Text>}
            </View>
            <Text style={[styles.taxCol2, styles.taxBasis, { color: colors.muted }]}>{row.basis}</Text>
            <Text style={[
              styles.taxCol3, styles.taxRate,
              { color: row.highlight ? "#f59e0b" : row.isTotal ? colors.primary : colors.foreground },
              (row.highlight || row.isTotal) && { fontWeight: "700" },
            ]}>{row.rate}</Text>
            <Text style={[
              styles.taxCol4, styles.taxAmount,
              { color: row.isTotal ? colors.primary : colors.foreground },
              row.isTotal && { fontWeight: "800" },
            ]}>{row.amount}</Text>
          </View>
        ))}
      </View>

      {/* Calc Note */}
      <View style={[styles.calcNoteBox, { backgroundColor: colors.primary + "08", borderColor: colors.primary + "20" }]}>
        <Text style={[styles.calcNoteText, { color: colors.muted }]}>
          💡 {detail.calcNote}
        </Text>
      </View>

      {/* Certifications */}
      <CertSection item={item} countryCode={countryCode} colors={colors} />
    </View>
  );
}

// ============ 认证要求面板 ============
function CertSection({ item, countryCode, colors }: {
  item: TariffItem; countryCode: string; colors: any;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const certs = getCertsForItem(item, countryCode);

  if (certs.length === 0) {
    return (
      <View style={[styles.certSection, { borderTopColor: colors.border }]}>
        <Text style={[styles.certSectionTitle, { color: colors.foreground }]}>📋 进口认证要求</Text>
        <View style={[styles.certEmptyBox, { backgroundColor: colors.background }]}>
          <Text style={[styles.certEmptyText, { color: colors.muted }]}>
            该商品类别暂无特殊认证要求，但仍需符合一般进口标签规范
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.certSection, { borderTopColor: colors.border }]}>
      <View style={styles.certSectionHeader}>
        <Text style={[styles.certSectionTitle, { color: colors.foreground }]}>📋 进口认证要求</Text>
        <View style={[styles.certCountBadge, { backgroundColor: colors.warning + "20" }]}>
          <Text style={[styles.certCountText, { color: colors.warning }]}>
            {certs.filter(c => c.required === 'mandatory').length} 项强制
          </Text>
        </View>
      </View>
      <Text style={[styles.certHint, { color: colors.muted }]}>
        点击各认证查看详情、申请机构及费用参考
      </Text>

      {certs.map((cert, i) => {
        const isExpanded = expanded === cert.name;
        const badgeColor = cert.required === 'mandatory' ? '#ef4444'
          : cert.required === 'conditional' ? '#f59e0b' : '#10b981';
        const badgeLabel = cert.required === 'mandatory' ? '强制'
          : cert.required === 'conditional' ? '有条件' : '建议';

        return (
          <TouchableOpacity
            key={i}
            onPress={() => setExpanded(isExpanded ? null : cert.name)}
            activeOpacity={0.7}
            style={[styles.certCard, {
              backgroundColor: colors.surface,
              borderColor: isExpanded ? badgeColor + "60" : colors.border,
              borderLeftColor: badgeColor,
            }]}
          >
            {/* Cert Header */}
            <View style={styles.certCardHeader}>
              <View style={[styles.certBadge, { backgroundColor: badgeColor + "15", borderColor: badgeColor + "40" }]}>
                <Text style={[styles.certBadgeText, { color: badgeColor }]}>{badgeLabel}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.certName, { color: colors.foreground }]}>{cert.name}</Text>
                <Text style={[styles.certFullName, { color: colors.muted }]}>{cert.fullName}</Text>
              </View>
              <Text style={[styles.certChevron, { color: colors.muted }]}>{isExpanded ? "▲" : "▼"}</Text>
            </View>

            {/* Cert Scope (always visible) */}
            <Text style={[styles.certScope, { color: colors.muted }]} numberOfLines={isExpanded ? 0 : 2}>
              适用：{cert.scope}
            </Text>

            {/* Expanded Detail */}
            {isExpanded && (
              <View style={[styles.certDetail, { borderTopColor: colors.border }]}>
                {[
                  { label: "颁发机构", value: cert.authority, icon: "🏛️" },
                  { label: "要求说明", value: cert.note, icon: "📝" },
                  cert.duration ? { label: "有效期", value: cert.duration, icon: "📅" } : null,
                  cert.approxCost ? { label: "费用参考", value: cert.approxCost, icon: "💰" } : null,
                ].filter(Boolean).map((row: any, j) => (
                  <View key={j} style={styles.certDetailRow}>
                    <Text style={styles.certDetailIcon}>{row.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.certDetailLabel, { color: colors.muted }]}>{row.label}</Text>
                      <Text style={[styles.certDetailValue, { color: colors.foreground }]}>{row.value}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </TouchableOpacity>
        );
      })}

      <View style={[styles.certDisclaimer, { backgroundColor: colors.warning + "08", borderColor: colors.warning + "20" }]}>
        <Text style={[styles.certDisclaimerText, { color: colors.muted }]}>
          ⚠️ 认证信息仅供参考，实际要求以各国官方机构最新规定为准。建议委托当地认证代理机构办理。
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  banner: { padding: 16, paddingBottom: 12 },
  bannerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  bannerIcon: { fontSize: 36 },
  bannerTitle: { color: "#fff", fontSize: 20, fontWeight: "800" },
  bannerSub: { color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 2 },
  flagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  flagBadge: { backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  flagText: { color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: "500" },

  stepBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stepItem: { alignItems: "center", flex: 1 },
  stepCircle: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  stepNum: { fontSize: 12, fontWeight: "700" },
  stepLabel: { fontSize: 11, textAlign: "center" },
  stepLine: { flex: 1, height: 1.5, marginBottom: 16 },

  section: { padding: 14 },
  stepHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 12 },
  stepHint: { fontSize: 12, marginBottom: 12 },
  backBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  backBtnText: { fontSize: 12 },

  inputWrap: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 10 : 6, marginBottom: 10,
  },
  searchIcon: { fontSize: 18, marginRight: 8 },
  input: { flex: 1, fontSize: 15, paddingVertical: 4 },
  clearBtn: { fontSize: 18, padding: 4 },
  searchBtn: { borderRadius: 10, paddingVertical: 13, alignItems: "center", marginBottom: 14 },
  searchBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  tagSection: { marginBottom: 16 },
  tagHint: { fontSize: 12, marginBottom: 6 },
  tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 5 },
  tagText: { fontSize: 12 },

  helpBox: { borderRadius: 12, borderWidth: 1, padding: 14 },
  helpTitle: { fontSize: 14, fontWeight: "700", marginBottom: 10 },
  helpRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
  helpItemTitle: { fontSize: 13, fontWeight: "600", marginBottom: 2 },
  helpItemDesc: { fontSize: 12, lineHeight: 18 },

  emptyBox: { alignItems: "center", paddingVertical: 40 },
  emptyText: { fontSize: 16, fontWeight: "600", marginTop: 12 },
  emptyHint: { fontSize: 13, marginTop: 4 },

  resultCard: { borderRadius: 12, borderWidth: 1, marginBottom: 8, overflow: "hidden" },
  resultCardInner: { padding: 14, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  hsBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: "flex-start" },
  hsBadgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  resultName: { fontSize: 14, fontWeight: "700", marginBottom: 2 },
  resultNameEn: { fontSize: 11, marginBottom: 6 },
  resultMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  chapterTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 5 },
  chapterText: { fontSize: 11, fontWeight: "600" },
  kwText: { fontSize: 11 },
  miniRates: { alignItems: "flex-end", gap: 4 },
  miniRate: { flexDirection: "row", alignItems: "center", gap: 3 },
  miniFlag: { fontSize: 13 },
  miniRateVal: { fontSize: 12, fontWeight: "700" },
  selectArrow: { fontSize: 16, fontWeight: "700", marginTop: 4 },

  selectedItemCard: { borderRadius: 12, borderWidth: 1.5, padding: 14, marginBottom: 12 },
  selectedName: { fontSize: 16, fontWeight: "800", marginBottom: 3 },
  selectedNameEn: { fontSize: 12 },

  cifRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 14,
  },
  cifLabel: { fontSize: 13, fontWeight: "600" },
  cifInput: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  cifPrefix: { fontSize: 14, marginRight: 2 },
  cifField: { fontSize: 16, fontWeight: "700", minWidth: 70, textAlign: "right" },
  cifSuffix: { fontSize: 12, marginLeft: 4 },

  countryTabs: { marginBottom: 14 },
  countryTab: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
    marginRight: 8,
  },
  countryTabFlag: { fontSize: 20 },
  countryTabName: { fontSize: 13 },

  detailCard: { borderRadius: 14, borderWidth: 1, marginBottom: 14, overflow: "hidden" },
  detailHeader: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  detailCountryName: { fontSize: 16, fontWeight: "800" },
  detailSystem: { fontSize: 11, marginTop: 2 },
  ftaBox: {
    backgroundColor: "#10b981" + "20", borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4, maxWidth: 200,
  },
  ftaText: { color: "#10b981", fontSize: 11, fontWeight: "600" },

  taxTable: {},
  taxTableHeader: { flexDirection: "row", padding: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  taxHeader: { fontSize: 11, fontWeight: "700" },
  taxRow: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  taxCol1: { flex: 2.2 },
  taxCol2: { flex: 2, paddingHorizontal: 4 },
  taxCol3: { flex: 1.2, textAlign: "right" },
  taxCol4: { flex: 1.2, textAlign: "right" },
  taxLabel: { fontSize: 12 },
  taxNote: { fontSize: 10, marginTop: 2, lineHeight: 14 },
  taxBasis: { fontSize: 10 },
  taxRate: { fontSize: 12 },
  taxAmount: { fontSize: 13 },

  calcNoteBox: { margin: 10, borderRadius: 8, borderWidth: 1, padding: 10 },
  calcNoteText: { fontSize: 11, lineHeight: 17 },

  summaryCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 12 },
  summaryTitle: { fontSize: 14, fontWeight: "700", marginBottom: 10 },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  summaryItem: {
    borderWidth: 1, borderRadius: 10, padding: 10,
    alignItems: "center", minWidth: "30%", flex: 1,
  },
  summaryFlag: { fontSize: 22, marginBottom: 4 },
  summaryCountry: { fontSize: 12, fontWeight: "600", marginBottom: 4 },
  summaryRate: { fontSize: 20, fontWeight: "800" },
  summaryRateLabel: { fontSize: 10, marginBottom: 2 },
  summaryEffective: { fontSize: 10 },
  ftaBadge: {
    backgroundColor: "#10b981", color: "#fff",
    fontSize: 9, fontWeight: "700",
    paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, marginTop: 2,
  },

  disclaimer: { borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 8 },
  disclaimerText: { fontSize: 11, lineHeight: 17 },

  // ===== Certification styles =====
  certSection: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 14, padding: 14 },
  certSectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  certSectionTitle: { fontSize: 14, fontWeight: "700", flex: 1 },
  certCountBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  certCountText: { fontSize: 12, fontWeight: "700" },
  certHint: { fontSize: 11, marginBottom: 10 },
  certEmptyBox: { borderRadius: 10, padding: 12, marginBottom: 8 },
  certEmptyText: { fontSize: 12, lineHeight: 18 },

  certCard: {
    borderRadius: 10, borderWidth: 1, borderLeftWidth: 3,
    marginBottom: 8, overflow: "hidden",
    padding: 12,
  },
  certCardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 6 },
  certBadge: {
    borderWidth: 1, borderRadius: 5,
    paddingHorizontal: 6, paddingVertical: 2, alignSelf: "flex-start",
  },
  certBadgeText: { fontSize: 10, fontWeight: "700" },
  certName: { fontSize: 13, fontWeight: "700" },
  certFullName: { fontSize: 11, marginTop: 1 },
  certChevron: { fontSize: 11, marginTop: 2 },
  certScope: { fontSize: 11, lineHeight: 16 },

  certDetail: {
    marginTop: 10, paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth, gap: 8,
  },
  certDetailRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  certDetailIcon: { fontSize: 14, width: 20 },
  certDetailLabel: { fontSize: 10, marginBottom: 2 },
  certDetailValue: { fontSize: 12, lineHeight: 17 },

  certDisclaimer: {
    borderRadius: 8, borderWidth: 1,
    padding: 10, marginTop: 4,
  },
  certDisclaimerText: { fontSize: 10, lineHeight: 15 },
});
