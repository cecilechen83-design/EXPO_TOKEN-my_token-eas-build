import { useState, useCallback, useRef } from "react";
import { Text, View, TouchableOpacity, ScrollView, TextInput, StyleSheet, Alert, Platform, useWindowDimensions, ActivityIndicator } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { WebLayout } from "@/components/web-sidebar";
import { useQuoteRequestsApi, type QuoteRequestItem, type QuoteRequestCustomer } from "@/hooks/use-quote-requests-api";
import { IconSymbol } from "@/components/ui/icon-symbol";

// 跨平台弹窗辅助（react-native-web 的 Alert.alert 是空函数）
function showAlert(title: string, message?: string) {
  if (Platform.OS === "web") {
    window.alert(message ? `${title}\n${message}` : title);
  } else {
    Alert.alert(title, message ?? "");
  }
}

const COUNTRY_OPTIONS = [
  "巴西", "墨西哥", "智利", "哥伦比亚", "阿根廷", "秘鲁", "厄瓜多尔", "巴拿马", "美国", "其他"
];

const CATEGORY_OPTIONS = [
  "普货", "纺织品", "电子产品", "机械配件", "化工品", "食品", "家具", "建材", "其他"
];

const INQUIRY_TEMPLATE = {
  name: "装箱清单询价模板",
  fields: [
    { key: "name", label: "品名", required: true, example: "蓝牙耳机" },
    { key: "hsCode", label: "HS编码", required: false, example: "8518300000" },
    { key: "qty", label: "件数", required: true, example: "10" },
    { key: "weight", label: "重量(kg)", required: true, example: "50" },
    { key: "volume", label: "体积(m³)", required: false, example: "0.5" },
    { key: "country", label: "目的国", required: true, example: "巴西" },
    { key: "category", label: "品类", required: false, example: "电子产品" },
    { key: "material", label: "材质", required: false, example: "塑料" },
    { key: "usage", label: "用途", required: false, example: "家用" },
    { key: "declaredValue", label: "申报价值(USD)", required: false, example: "500" },
  ],
};

type ItemForm = {
  name: string;
  hsCode: string;
  qty: string;
  weight: string;
  volume: string;
  material: string;
  usage: string;
  country: string;
  declaredValue: string;
  category: string;
};

const emptyItem: ItemForm = {
  name: "", hsCode: "", qty: "1", weight: "", volume: "",
  material: "", usage: "", country: "巴西", declaredValue: "", category: "普货",
};

export default function QuoteInquiryScreen() {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const api = useQuoteRequestsApi();

  const [step, setStep] = useState<"info" | "items" | "result">("info");
  const [customer, setCustomer] = useState<QuoteRequestCustomer>({
    name: "", email: "", company: "", tel: "", wechat: "",
  });
  const [items, setItems] = useState<ItemForm[]>([{ ...emptyItem }]);
  const [result, setResult] = useState<{ quoteNo: string; totalAmount: string; items: QuoteRequestItem[] } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [parsing, setParsing] = useState(false);

  const updateCustomer = (key: keyof QuoteRequestCustomer, value: string) => {
    setCustomer(prev => ({ ...prev, [key]: value }));
  };

  const updateItem = (index: number, key: keyof ItemForm, value: string) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [key]: value } : item));
  };

  const addItem = () => setItems(prev => [...prev, { ...emptyItem }]);

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const downloadTemplate = () => {
    if (Platform.OS !== "web") {
      showAlert("提示", "请在电脑网页版中下载模板");
      return;
    }
    const headers = INQUIRY_TEMPLATE.fields.map(f => f.label);
    const examples = INQUIRY_TEMPLATE.fields.map(f => f.example || "");
    const csv = "﻿" + headers.join(",") + "\n" + examples.join(",") + "\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${INQUIRY_TEMPLATE.name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseExcelFile = async (file: File) => {
    setParsing(true);
    try {
      setUploadedFileName(file.name);
      const XLSX = await import("xlsx");
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

      if (jsonData.length < 2) {
        showAlert("错误", "文件中没有数据行");
        setParsing(false);
        return;
      }

      const fileHeaders = jsonData[0] as string[];
      const headerMap: Record<string, string> = {};
      INQUIRY_TEMPLATE.fields.forEach(f => {
        headerMap[f.label] = f.key;
        headerMap[f.key] = f.key;
      });

      const parsedItems: ItemForm[] = [];
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.every((cell: any) => cell === null || cell === undefined || cell === "")) continue;
        const obj: Record<string, any> = {};
        fileHeaders.forEach((h, idx) => {
          const key = headerMap[h?.toString()?.trim()] || h?.toString()?.trim();
          if (key && row[idx] !== undefined && row[idx] !== null && row[idx] !== "") {
            obj[key] = String(row[idx]).trim();
          }
        });
        if (obj.name || obj["品名"]) {
          parsedItems.push({
            name: obj.name || obj["品名"] || "",
            hsCode: obj.hsCode || obj["HS编码"] || "",
            qty: obj.qty || obj["件数"] || "1",
            weight: obj.weight || obj["重量(kg)"] || "",
            volume: obj.volume || obj["体积(m³)"] || "",
            country: obj.country || obj["目的国"] || "巴西",
            category: obj.category || obj["品类"] || "普货",
            material: obj.material || obj["材质"] || "",
            usage: obj.usage || obj["用途"] || "",
            declaredValue: obj.declaredValue || obj["申报价值(USD)"] || "",
          });
        }
      }

      if (parsedItems.length === 0) {
        showAlert("错误", "解析后没有有效货物数据，请检查文件格式");
        setParsing(false);
        return;
      }

      setItems(parsedItems);
      showAlert("导入成功", `已从 ${file.name} 导入 ${parsedItems.length} 件货物`);
    } catch (err: any) {
      showAlert("解析失败", err.message || "无法解析文件，请确认文件格式正确");
    }
    setParsing(false);
  };

  const handleNativePick = async () => {
    setParsing(true);
    try {
      const DocumentPicker = await import("expo-document-picker");
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel", "text/csv"],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) {
        setParsing(false);
        return;
      }
      const asset = result.assets[0];
      setUploadedFileName(asset.name);

      const FileSystem = await import("expo-file-system/legacy");
      const content = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(content, { type: "base64" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

      if (jsonData.length < 2) {
        showAlert("错误", "文件中没有数据行");
        setParsing(false);
        return;
      }

      const fileHeaders = jsonData[0] as string[];
      const headerMap: Record<string, string> = {};
      INQUIRY_TEMPLATE.fields.forEach(f => {
        headerMap[f.label] = f.key;
        headerMap[f.key] = f.key;
      });

      const parsedItems: ItemForm[] = [];
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.every((cell: any) => cell === null || cell === undefined || cell === "")) continue;
        const obj: Record<string, any> = {};
        fileHeaders.forEach((h, idx) => {
          const key = headerMap[h?.toString()?.trim()] || h?.toString()?.trim();
          if (key && row[idx] !== undefined && row[idx] !== null && row[idx] !== "") {
            obj[key] = String(row[idx]).trim();
          }
        });
        if (obj.name || obj["品名"]) {
          parsedItems.push({
            name: obj.name || obj["品名"] || "",
            hsCode: obj.hsCode || obj["HS编码"] || "",
            qty: obj.qty || obj["件数"] || "1",
            weight: obj.weight || obj["重量(kg)"] || "",
            volume: obj.volume || obj["体积(m³)"] || "",
            country: obj.country || obj["目的国"] || "巴西",
            category: obj.category || obj["品类"] || "普货",
            material: obj.material || obj["材质"] || "",
            usage: obj.usage || obj["用途"] || "",
            declaredValue: obj.declaredValue || obj["申报价值(USD)"] || "",
          });
        }
      }

      if (parsedItems.length === 0) {
        showAlert("错误", "解析后没有有效货物数据");
        setParsing(false);
        return;
      }

      setItems(parsedItems);
      showAlert("导入成功", `已从 ${asset.name} 导入 ${parsedItems.length} 件货物`);
    } catch (err: any) {
      showAlert("选择文件失败", err.message || "无法读取文件");
    }
    setParsing(false);
  };

  const handleSubmit = useCallback(async () => {
    if (!customer.name.trim()) { showAlert("提示", "请输入联系人姓名"); return; }
    if (!customer.email.trim()) { showAlert("提示", "请输入邮箱地址"); return; }

    const validItems = items.filter(it => it.name.trim() && (parseFloat(it.weight) > 0));
    if (validItems.length === 0) {
      showAlert("提示", "请至少填写一件货物（品名和重量为必填）");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.submitQuote({
        customer,
        items: validItems.map(it => ({
          name: it.name,
          hsCode: it.hsCode,
          qty: parseInt(it.qty) || 1,
          weight: parseFloat(it.weight) || 0,
          volume: parseFloat(it.volume) || 0,
          material: it.material,
          usage: it.usage,
          country: it.country,
          declaredValue: parseFloat(it.declaredValue) || 0,
          category: it.category,
        })),
      });

      if (res.success && res.quoteNo) {
        setResult({ quoteNo: res.quoteNo, totalAmount: res.totalAmount || "0", items: res.items || [] });
        setStep("result");
      } else {
        showAlert("提交失败", (res as any).message || "请稍后重试");
      }
    } catch (e) {
      showAlert("网络错误", "请检查网络连接后重试");
    }
    setSubmitting(false);
  }, [customer, items, api]);

  const handleReset = () => {
    setStep("info");
    setCustomer({ name: "", email: "", company: "", tel: "", wechat: "" });
    setItems([{ ...emptyItem }]);
    setResult(null);
    setUploadedFileName("");
  };

  const renderInfoStep = () => (
    <View>
      <View style={[styles.stepHeader, { borderColor: colors.primary }]}>
        <View style={[styles.stepBadge, { backgroundColor: colors.primary }]}>
          <Text style={styles.stepBadgeText}>1</Text>
        </View>
        <Text style={[styles.stepTitle, { color: colors.foreground }]}>填写联系信息</Text>
      </View>

      <View style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.formRow, isWide && styles.formRowWide]}>
          <View style={[styles.formGroup, isWide && { flex: 1 }]}>
            <Text style={[styles.formLabel, { color: colors.muted }]}>联系人 *</Text>
            <TextInput
              style={[styles.formInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
              value={customer.name}
              onChangeText={v => updateCustomer("name", v)}
              placeholder="您的姓名"
              placeholderTextColor={colors.muted}
            />
          </View>
          <View style={[styles.formGroup, isWide && { flex: 1 }]}>
            <Text style={[styles.formLabel, { color: colors.muted }]}>邮箱 *</Text>
            <TextInput
              style={[styles.formInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
              value={customer.email}
              onChangeText={v => updateCustomer("email", v)}
              placeholder="email@company.com"
              placeholderTextColor={colors.muted}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        </View>
        <View style={[styles.formRow, isWide && styles.formRowWide]}>
          <View style={[styles.formGroup, isWide && { flex: 1 }]}>
            <Text style={[styles.formLabel, { color: colors.muted }]}>公司名称</Text>
            <TextInput
              style={[styles.formInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
              value={customer.company}
              onChangeText={v => updateCustomer("company", v)}
              placeholder="公司名称（选填）"
              placeholderTextColor={colors.muted}
            />
          </View>
          <View style={[styles.formGroup, isWide && { flex: 1 }]}>
            <Text style={[styles.formLabel, { color: colors.muted }]}>电话</Text>
            <TextInput
              style={[styles.formInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
              value={customer.tel}
              onChangeText={v => updateCustomer("tel", v)}
              placeholder="联系电话（选填）"
              placeholderTextColor={colors.muted}
              keyboardType="phone-pad"
            />
          </View>
        </View>
        <View style={styles.formRow}>
          <View style={[styles.formGroup, isWide && { flex: 0.5 }]}>
            <Text style={[styles.formLabel, { color: colors.muted }]}>微信</Text>
            <TextInput
              style={[styles.formInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
              value={customer.wechat}
              onChangeText={v => updateCustomer("wechat", v)}
              placeholder="微信号（选填）"
              placeholderTextColor={colors.muted}
            />
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.nextBtn, { backgroundColor: colors.primary }]}
        onPress={() => {
          if (!customer.name.trim() || !customer.email.trim()) {
            showAlert("提示", "请填写联系人姓名和邮箱");
            return;
          }
          setStep("items");
        }}
      >
        <Text style={styles.nextBtnText}>下一步：填写货物信息 →</Text>
      </TouchableOpacity>
    </View>
  );

  const renderItemsStep = () => (
    <View>
      <View style={[styles.stepHeader, { borderColor: colors.primary }]}>
        <View style={[styles.stepBadge, { backgroundColor: colors.primary }]}>
          <Text style={styles.stepBadgeText}>2</Text>
        </View>
        <Text style={[styles.stepTitle, { color: colors.foreground }]}>填写货物清单</Text>
        <TouchableOpacity style={[styles.backBtn, { borderColor: colors.border }]} onPress={() => setStep("info")}>
          <Text style={[styles.backBtnText, { color: colors.muted }]}>← 上一步</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.uploadSection, { backgroundColor: colors.primary + "06", borderColor: colors.primary + "30" }]}>
        <View style={styles.uploadSectionHeader}>
          <IconSymbol name="doc.text.fill" size={20} color={colors.primary} />
          <Text style={[styles.uploadSectionTitle, { color: colors.foreground }]}>快速导入：上传装箱清单</Text>
        </View>
        <Text style={[styles.uploadSectionDesc, { color: colors.muted }]}>
          下载模板 → 按格式填写货物信息 → 上传文件，系统自动解析填入
        </Text>

        <View style={[styles.uploadActions, isWide && { flexDirection: "row" }]}>
          <TouchableOpacity
            style={[styles.templateDownloadBtn, { backgroundColor: colors.background, borderColor: colors.primary + "40" }]}
            onPress={downloadTemplate}
          >
            <IconSymbol name="tray.and.arrow.down.fill" size={18} color={colors.primary} />
            <Text style={[styles.templateDownloadText, { color: colors.primary }]}>下载询价模板</Text>
          </TouchableOpacity>

          {Platform.OS === "web" ? (
            <TouchableOpacity
              style={[styles.fileUploadBtn, { backgroundColor: colors.primary }]}
              onPress={() => fileInputRef.current?.click()}
              disabled={parsing}
            >
              {parsing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <IconSymbol name="tray.and.arrow.up.fill" size={18} color="#fff" />
                  <Text style={styles.fileUploadText}>上传装箱清单</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.fileUploadBtn, { backgroundColor: colors.primary }]}
              onPress={handleNativePick}
              disabled={parsing}
            >
              {parsing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <IconSymbol name="tray.and.arrow.up.fill" size={18} color="#fff" />
                  <Text style={styles.fileUploadText}>上传装箱清单</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {uploadedFileName ? (
          <View style={[styles.uploadedFileRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <IconSymbol name="checkmark.circle.fill" size={16} color={colors.success} />
            <Text style={[styles.uploadedFileName, { color: colors.foreground }]} numberOfLines={1}>
              {uploadedFileName}
            </Text>
            <Text style={[styles.uploadedFileCount, { color: colors.primary }]}>
              {items.length} 件货物已导入
            </Text>
          </View>
        ) : null}

        <Text style={[styles.uploadHint, { color: colors.muted }]}>
          支持 .xlsx、.xls、.csv 格式，也可以在下方手动填写
        </Text>

        {Platform.OS === "web" && (
          <input
            ref={(el) => { fileInputRef.current = el; }}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) parseExcelFile(file);
              if (e.target) (e.target as HTMLInputElement).value = "";
            }}
          />
        )}
      </View>

      <View style={styles.dividerRow}>
        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        <Text style={[styles.dividerText, { color: colors.muted }]}>货物明细（可编辑）</Text>
        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
      </View>

      {items.map((item, idx) => (
        <View key={idx} style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: 14 }]}>
          <View style={styles.itemHeader}>
            <Text style={[styles.itemTitle, { color: colors.foreground }]}>货物 #{idx + 1}</Text>
            {items.length > 1 && (
              <TouchableOpacity onPress={() => removeItem(idx)}>
                <Text style={{ color: "#EF4444", fontSize: 13 }}>✕ 删除</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={[styles.formRow, isWide && styles.formRowWide]}>
            <View style={[styles.formGroup, isWide && { flex: 2 }]}>
              <Text style={[styles.formLabel, { color: colors.muted }]}>品名 *</Text>
              <TextInput
                style={[styles.formInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                value={item.name}
                onChangeText={v => updateItem(idx, "name", v)}
                placeholder="货物品名"
                placeholderTextColor={colors.muted}
              />
            </View>
            <View style={[styles.formGroup, isWide && { flex: 1 }]}>
              <Text style={[styles.formLabel, { color: colors.muted }]}>HS编码</Text>
              <TextInput
                style={[styles.formInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                value={item.hsCode}
                onChangeText={v => updateItem(idx, "hsCode", v)}
                placeholder="选填"
                placeholderTextColor={colors.muted}
              />
            </View>
          </View>

          <View style={[styles.formRow, isWide && styles.formRowWide]}>
            <View style={[styles.formGroup, isWide && { flex: 1 }]}>
              <Text style={[styles.formLabel, { color: colors.muted }]}>目的国 *</Text>
              <View style={[styles.pickerRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {COUNTRY_OPTIONS.map(c => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.pickerItem, item.country === c && { backgroundColor: colors.primary + "20" }]}
                      onPress={() => updateItem(idx, "country", c)}
                    >
                      <Text style={[styles.pickerItemText, { color: item.country === c ? colors.primary : colors.muted }]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </View>

          <View style={[styles.formRow, isWide && styles.formRowWide]}>
            <View style={[styles.formGroup, isWide && { flex: 1 }]}>
              <Text style={[styles.formLabel, { color: colors.muted }]}>重量(kg) *</Text>
              <TextInput
                style={[styles.formInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                value={item.weight}
                onChangeText={v => updateItem(idx, "weight", v)}
                placeholder="总重量"
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={[styles.formGroup, isWide && { flex: 1 }]}>
              <Text style={[styles.formLabel, { color: colors.muted }]}>体积(m³)</Text>
              <TextInput
                style={[styles.formInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                value={item.volume}
                onChangeText={v => updateItem(idx, "volume", v)}
                placeholder="长×宽×高/1000000"
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={[styles.formGroup, isWide && { flex: 1 }]}>
              <Text style={[styles.formLabel, { color: colors.muted }]}>件数</Text>
              <TextInput
                style={[styles.formInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                value={item.qty}
                onChangeText={v => updateItem(idx, "qty", v)}
                placeholder="1"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
              />
            </View>
          </View>

          <View style={[styles.formRow, isWide && styles.formRowWide]}>
            <View style={[styles.formGroup, isWide && { flex: 1 }]}>
              <Text style={[styles.formLabel, { color: colors.muted }]}>品类</Text>
              <View style={[styles.pickerRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {CATEGORY_OPTIONS.map(c => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.pickerItem, item.category === c && { backgroundColor: colors.primary + "20" }]}
                      onPress={() => updateItem(idx, "category", c)}
                    >
                      <Text style={[styles.pickerItemText, { color: item.category === c ? colors.primary : colors.muted }]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </View>

          <View style={[styles.formRow, isWide && styles.formRowWide]}>
            <View style={[styles.formGroup, isWide && { flex: 1 }]}>
              <Text style={[styles.formLabel, { color: colors.muted }]}>材质</Text>
              <TextInput
                style={[styles.formInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                value={item.material}
                onChangeText={v => updateItem(idx, "material", v)}
                placeholder="如：塑料、金属、纺织品…"
                placeholderTextColor={colors.muted}
              />
            </View>
            <View style={[styles.formGroup, isWide && { flex: 1 }]}>
              <Text style={[styles.formLabel, { color: colors.muted }]}>用途</Text>
              <TextInput
                style={[styles.formInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                value={item.usage}
                onChangeText={v => updateItem(idx, "usage", v)}
                placeholder="如：家用、工业…"
                placeholderTextColor={colors.muted}
              />
            </View>
            <View style={[styles.formGroup, isWide && { flex: 1 }]}>
              <Text style={[styles.formLabel, { color: colors.muted }]}>申报价值(USD)</Text>
              <TextInput
                style={[styles.formInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                value={item.declaredValue}
                onChangeText={v => updateItem(idx, "declaredValue", v)}
                placeholder="选填"
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
        </View>
      ))}

      <TouchableOpacity
        style={[styles.addItemBtn, { borderColor: colors.primary }]}
        onPress={addItem}
      >
        <Text style={[styles.addItemBtnText, { color: colors.primary }]}>+ 添加更多货物</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: submitting ? 0.6 : 1 }]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.submitBtnText}>提交询价（共 {items.filter(it => it.name.trim()).length} 件货物）</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderResultStep = () => {
    if (!result) return null;
    return (
      <View>
        <View style={[styles.resultHeader, { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" }]}>
          <Text style={{ fontSize: 36, marginBottom: 8 }}>✅</Text>
          <Text style={[styles.resultTitle, { color: "#065F46" }]}>询价已提交成功</Text>
          <Text style={[styles.resultDesc, { color: "#047857" }]}>
            报价编号：{result.quoteNo}{"\n"}
            我们的团队将在1-2个工作日内审核并发送正式报价单
          </Text>
        </View>

        <View style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.itemTitle, { color: colors.foreground, marginBottom: 12 }]}>
            预估报价（仅供参考，以正式报价单为准）
          </Text>
          <View style={[styles.itemsTable, { borderColor: colors.border }]}>
            <View style={[styles.tableHeader, { backgroundColor: colors.background }]}>
              <Text style={[styles.th, { color: colors.muted, flex: 2 }]}>品名</Text>
              <Text style={[styles.th, { color: colors.muted }]}>目的国</Text>
              <Text style={[styles.th, { color: colors.muted }]}>推荐方式</Text>
              <Text style={[styles.th, { color: colors.muted }]}>时效</Text>
              <Text style={[styles.th, { color: colors.muted }]}>预估费用</Text>
            </View>
            {result.items.map((item, idx) => (
              <View key={idx} style={[styles.tableRow, { borderTopColor: colors.border }]}>
                <Text style={[styles.td, { color: colors.foreground, flex: 2 }]}>{item.name}</Text>
                <Text style={[styles.td, { color: colors.foreground }]}>{item.country}</Text>
                <Text style={[styles.td, { color: colors.primary }]}>{item.recommended?.method || "—"}</Text>
                <Text style={[styles.td, { color: colors.muted }]}>{item.recommended?.days || "—"}</Text>
                <Text style={[styles.td, { color: colors.primary, fontWeight: "600" }]}>${item.recommended?.price || "0"}</Text>
              </View>
            ))}
            <View style={[styles.tableRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.td, { color: colors.muted, flex: 4, textAlign: "right", fontWeight: "500" }]}>合计预估</Text>
              <Text style={[styles.td, { color: colors.primary, fontWeight: "700", fontSize: 15 }]}>${result.totalAmount}</Text>
            </View>
          </View>

          {result.items.length > 0 && result.items[0].options && result.items[0].options.length > 1 && (
            <View style={{ marginTop: 16 }}>
              <Text style={[styles.formLabel, { color: colors.muted, marginBottom: 8 }]}>
                其他可选运输方式（第一件货物）
              </Text>
              {result.items[0].options.map((opt, i) => (
                <View key={i} style={[styles.optionRow, { borderColor: colors.border }]}>
                  <Text style={[styles.optionMethod, { color: colors.foreground }]}>{opt.method}</Text>
                  <Text style={[styles.optionDays, { color: colors.muted }]}>{opt.days}</Text>
                  <Text style={[styles.optionPrice, { color: colors.primary }]}>${opt.price}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.nextBtn, { backgroundColor: colors.primary, marginTop: 20 }]}
          onPress={handleReset}
        >
          <Text style={styles.nextBtnText}>提交新询价</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const content = (
    <ScreenContainer>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.pageHeader}>
          <Text style={[styles.pageTitle, { color: colors.foreground }]}>在线询价</Text>
          <Text style={[styles.pageDesc, { color: colors.muted }]}>
            填写货物信息或上传装箱清单，系统将自动为您匹配最优运输方案
          </Text>
        </View>

        <View style={styles.stepIndicator}>
          {[
            { key: "info", label: "联系信息" },
            { key: "items", label: "货物清单" },
            { key: "result", label: "报价结果" },
          ].map((s, i) => (
            <View key={s.key} style={styles.stepDot}>
              <View style={[
                styles.stepCircle,
                { backgroundColor: step === s.key ? colors.primary : (["info", "items", "result"].indexOf(step) > i ? "#10B981" : colors.border) }
              ]}>
                <Text style={styles.stepCircleText}>{["info", "items", "result"].indexOf(step) > i ? "✓" : String(i + 1)}</Text>
              </View>
              <Text style={[styles.stepLabel, { color: step === s.key ? colors.primary : colors.muted }]}>{s.label}</Text>
              {i < 2 && <View style={[styles.stepLine, { backgroundColor: ["info", "items", "result"].indexOf(step) > i ? "#10B981" : colors.border }]} />}
            </View>
          ))}
        </View>

        {step === "info" && renderInfoStep()}
        {step === "items" && renderItemsStep()}
        {step === "result" && renderResultStep()}
      </ScrollView>
    </ScreenContainer>
  );

  return <WebLayout>{content}</WebLayout>;
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  pageHeader: { marginBottom: 16 },
  pageTitle: { fontSize: 22, fontWeight: "700" },
  pageDesc: { fontSize: 13, marginTop: 4 },
  stepIndicator: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 24 },
  stepDot: { flexDirection: "row", alignItems: "center" },
  stepCircle: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  stepCircleText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  stepLabel: { fontSize: 12, marginLeft: 6, fontWeight: "500" },
  stepLine: { width: 40, height: 2, marginHorizontal: 8, borderRadius: 1 },
  stepHeader: { flexDirection: "row", alignItems: "center", marginBottom: 16, paddingBottom: 12, borderBottomWidth: 2, gap: 10 },
  stepBadge: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  stepBadgeText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  stepTitle: { fontSize: 16, fontWeight: "600", flex: 1 },
  backBtn: { paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderRadius: 6 },
  backBtnText: { fontSize: 12 },
  formCard: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 12 },
  formRow: { marginBottom: 0 },
  formRowWide: { flexDirection: "row", gap: 12 },
  formGroup: { marginBottom: 12 },
  formLabel: { fontSize: 12, fontWeight: "500", marginBottom: 4 },
  formInput: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14 },
  pickerRow: { borderWidth: 1, borderRadius: 8, padding: 6, flexDirection: "row" },
  pickerItem: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, marginRight: 4 },
  pickerItemText: { fontSize: 12, fontWeight: "500" },
  nextBtn: { paddingVertical: 14, borderRadius: 10, alignItems: "center", marginTop: 8 },
  nextBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  itemHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  itemTitle: { fontSize: 14, fontWeight: "600" },
  addItemBtn: { borderWidth: 1, borderStyle: "dashed", borderRadius: 10, paddingVertical: 12, alignItems: "center", marginBottom: 16 },
  addItemBtnText: { fontSize: 14, fontWeight: "500" },
  submitBtn: { paddingVertical: 14, borderRadius: 10, alignItems: "center", marginTop: 4 },
  submitBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  resultHeader: { borderWidth: 1, borderRadius: 12, padding: 24, alignItems: "center", marginBottom: 16 },
  resultTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  resultDesc: { fontSize: 13, textAlign: "center", lineHeight: 20 },
  itemsTable: { borderWidth: 1, borderRadius: 8, overflow: "hidden" },
  tableHeader: { flexDirection: "row", paddingVertical: 8, paddingHorizontal: 10 },
  th: { flex: 1, fontSize: 11, fontWeight: "500" },
  tableRow: { flexDirection: "row", paddingVertical: 9, paddingHorizontal: 10, borderTopWidth: 1 },
  td: { flex: 1, fontSize: 12 },
  optionRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderRadius: 8, marginBottom: 6, gap: 12 },
  optionMethod: { flex: 1, fontSize: 13, fontWeight: "500" },
  optionDays: { fontSize: 12 },
  optionPrice: { fontSize: 14, fontWeight: "600" },
  uploadSection: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 16, borderStyle: "dashed" },
  uploadSectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  uploadSectionTitle: { fontSize: 15, fontWeight: "600" },
  uploadSectionDesc: { fontSize: 12, marginBottom: 14, lineHeight: 18 },
  uploadActions: { gap: 10, marginBottom: 10 },
  templateDownloadBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 11, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1 },
  templateDownloadText: { fontSize: 14, fontWeight: "500" },
  fileUploadBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 11, paddingHorizontal: 16, borderRadius: 8 },
  fileUploadText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  uploadedFileRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, marginBottom: 8 },
  uploadedFileName: { flex: 1, fontSize: 13 },
  uploadedFileCount: { fontSize: 12, fontWeight: "600" },
  uploadHint: { fontSize: 11, textAlign: "center" },
  dividerRow: { flexDirection: "row", alignItems: "center", marginVertical: 16, gap: 10 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 12, fontWeight: "500" },
});
