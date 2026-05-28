/**
 * CRM 客户管理页面
 * 对接后端 REST API，实现公海池、我的客源、状态流转
 */
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Text, View, TouchableOpacity, FlatList, TextInput, Alert,
  StyleSheet, Platform, ScrollView, Modal, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { WebLayout } from "@/components/web-sidebar";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/lib/auth-context";
import { useCrmApi, type CrmLead, type CrmLog, type SalesStaff } from "@/hooks/use-crm-api";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as XLSX from "xlsx";

// Web 端 Alert.alert 是 no-op，统一用此函数替代
function showAlert(title: string, message?: string) {
  if (Platform.OS === "web") {
    window.alert(message ? `${title}\n${message}` : title);
  } else {
    Alert.alert(title, message ?? "");
  }
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  new: { label: "新登记", color: "#3B82F6" },
  assigned: { label: "已分配", color: "#8B5CF6" },
  developing: { label: "开发中", color: "#F59E0B" },
  signed: { label: "已签约", color: "#22C55E" },
  public_pool: { label: "公海池", color: "#6B7280" },
  zombie: { label: "僵尸客户", color: "#EF4444" },
};

const SOURCE_MAP: Record<string, string> = {
  manual_register: "手动登记",
  self_developed: "自行开发",
  system_assign: "系统分配",
  public_pool_claim: "公海捞取",
};

type TabKey = "my_leads" | "public_pool" | "all_leads";

export default function CRMScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  // 客服主管也有批量导入权限
  const canImportCustomers = isAdmin || user?.role === "cs_supervisor" || user?.role === "ceo";
  const crm = useCrmApi();

  const [activeTab, setActiveTab] = useState<TabKey>("my_leads");
  const [myLeads, setMyLeads] = useState<CrmLead[]>([]);
  const [seaLeads, setSeaLeads] = useState<CrmLead[]>([]);
  const [allLeads, setAllLeads] = useState<CrmLead[]>([]);
  const [salesStaff, setSalesStaff] = useState<SalesStaff[]>([]);
  const [leadLogs, setLeadLogs] = useState<CrmLog[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState("");

  // 弹窗状态
  const [showRegister, setShowRegister] = useState(false);
  const [showDetail, setShowDetail] = useState<CrmLead | null>(null);
  const [showAssign, setShowAssign] = useState<CrmLead | null>(null);
  const [editingLead, setEditingLead] = useState<CrmLead | null>(null);
  const [editForm, setEditForm] = useState({
    companyName: "", legalPerson: "", shareholders: "",
    contactName: "", contactPhone: "", contactEmail: "",
    contactPosition: "", country: "", address: "",
    businessType: "", notes: "",
  });

  // 表单状态
  const [formCompany, setFormCompany] = useState("");
  const [formLegal, setFormLegal] = useState("");
  const [formShareholders, setFormShareholders] = useState("");
  const [formContact, setFormContact] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPosition, setFormPosition] = useState("");
  const [formCountry, setFormCountry] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formBusiness, setFormBusiness] = useState("");
  const [formSource, setFormSource] = useState("self_developed");
  const [formNotes, setFormNotes] = useState("");

  // 导入相关状态
  const [showImport, setShowImport] = useState(false);
  const [importParsedData, setImportParsedData] = useState<any[]>([]);
  const [importFileName, setImportFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ successCount?: number; failedCount?: number; errors?: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Excel 解析
  const parseExcelBuffer = (buffer: ArrayBuffer) => {
    try {
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet);
      if (!jsonData || jsonData.length === 0) {
        showAlert("错误", "Excel 文件为空或格式不正确");
        return;
      }
      setImportParsedData(jsonData as any[]);
      showAlert("解析成功", `共解析 ${jsonData.length} 条客户数据，请确认后点击"开始导入"`);
    } catch (e) {
      showAlert("错误", "Excel 文件解析失败，请确保文件格式正确");
    }
  };

  // Web 端文件选择
  const handleImportWebFileSelect = () => {
    if (Platform.OS === "web" && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleImportWebFileChange = (event: any) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      if (buffer) parseExcelBuffer(buffer);
    };
    reader.readAsArrayBuffer(file);
  };

  // APP 端文件选择
  const handleImportNativeFilePick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel", "text/csv"],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setImportFileName(asset.name);
      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      const binaryStr = atob(base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
      parseExcelBuffer(bytes.buffer);
    } catch (e) {
      showAlert("错误", "文件选择失败");
    }
  };

  const handlePickImportFile = () => {
    if (Platform.OS === "web") handleImportWebFileSelect();
    else handleImportNativeFilePick();
  };

  // 执行导入
  const handleImportSubmit = async () => {
    if (importParsedData.length === 0) {
      showAlert("提示", "请先选择并解析 Excel/CSV 文件");
      return;
    }
    setImporting(true);
    try {
      const result = await crm.importLeads({
        data: importParsedData,
        fileName: importFileName || `CRM客户导入_${new Date().toLocaleDateString()}.xlsx`,
      });
      if (result.success) {
        setImportResult({ successCount: result.successCount, failedCount: result.failedCount, errors: result.errors });
        showAlert("导入完成", `成功: ${result.successCount} 条\n失败: ${result.failedCount} 条${result.errors && result.errors.length > 0 ? "\n\n详情请查看导入结果" : ""}`);
        loadData();
      } else {
        showAlert("导入失败", result.message || "未知错误");
      }
    } catch {
      showAlert("错误", "导入失败，请检查网络连接");
    } finally {
      setImporting(false);
    }
  };

  // 重置导入状态
  const resetImport = () => {
    setImportParsedData([]);
    setImportFileName("");
    setImportResult(null);
  };

  // 加载数据
  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      const [mine, sea, staff] = await Promise.all([
        crm.getMyLeads(),
        crm.getSeaLeads(),
        crm.getSalesStaff(),
      ]);
      setMyLeads(mine);
      setSeaLeads(sea);
      setSalesStaff(staff);
      if (isAdmin) {
        const all = await crm.getAllLeads();
        setAllLeads(all);
      }
    } catch (err) {
      console.error("[CRM] Load data error:", err);
    } finally {
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  useEffect(() => {
    if (user) loadData();
  }, [user, loadData]);

  // 搜索过滤
  const filteredLeads = useMemo(() => {
    const source = activeTab === "my_leads" ? myLeads : activeTab === "public_pool" ? seaLeads : allLeads;
    if (!searchText) return source;
    const q = searchText.toLowerCase();
    return source.filter((l) =>
      l.companyName.toLowerCase().includes(q) ||
      (l.legalPerson || "").toLowerCase().includes(q) ||
      (l.contactName || "").toLowerCase().includes(q) ||
      (l.country || "").toLowerCase().includes(q)
    );
  }, [activeTab, myLeads, seaLeads, allLeads, searchText]);

  // 重置表单
  const resetForm = () => {
    setFormCompany(""); setFormLegal(""); setFormShareholders("");
    setFormContact(""); setFormPhone(""); setFormEmail("");
    setFormPosition(""); setFormCountry(""); setFormAddress("");
    setFormBusiness(""); setFormSource("self_developed"); setFormNotes("");
  };

  // 登记客源
  const handleRegister = async () => {
    if (!formCompany.trim()) {
      showAlert("提示", "请填写公司名称");
      return;
    }

    const result = await crm.createLead({
      companyName: formCompany.trim(),
      legalPerson: formLegal.trim() || undefined,
      shareholders: formShareholders.trim() || undefined,
      contactName: formContact.trim() || undefined,
      contactPhone: formPhone.trim() || undefined,
      contactEmail: formEmail.trim() || undefined,
      contactPosition: formPosition.trim() || undefined,
      country: formCountry.trim() || undefined,
      address: formAddress.trim() || undefined,
      businessType: formBusiness.trim() || undefined,
      source: formSource,
      notes: formNotes.trim() || undefined,
    });

    if (result.success) {
      resetForm();
      setShowRegister(false);
      showAlert("成功", result.message);
      loadData();
    } else {
      showAlert("失败", result.message);
    }
  };

  // 捞取客户
  const handleClaim = (lead: CrmLead) => {
    if (Platform.OS === "web") {
      if (window.confirm(`确定要从公海捞取「${lead.companyName}」吗？\n捞取后将获得60天开发保护期。`)) {
        crm.claimLead(lead.id).then((result) => {
          if (result.success) {
            showAlert("成功", result.message);
            loadData();
          } else {
            showAlert("失败", result.message);
          }
        });
      }
    } else {
      Alert.alert(
        "确认捞取",
        `确定要从公海捞取「${lead.companyName}」吗？\n捞取后将获得60天开发保护期。`,
        [
          { text: "取消", style: "cancel" },
          {
            text: "确认捞取",
            onPress: async () => {
              const result = await crm.claimLead(lead.id);
              if (result.success) {
                showAlert("成功", result.message);
                loadData();
              } else {
                showAlert("失败", result.message);
              }
            },
          },
        ]
      );
    }
  };

  // 释放到公海
  const handleRelease = (lead: CrmLead) => {
    if (Platform.OS === "web") {
      if (window.confirm(`确定要将「${lead.companyName}」释放到公海池吗？`)) {
        crm.releaseLead(lead.id, "主动释放").then((result) => {
          if (result.success) {
            setShowDetail(null);
            showAlert("成功", result.message);
            loadData();
          } else {
            showAlert("失败", result.message);
          }
        });
      }
    } else {
      Alert.alert(
        "释放到公海",
        `确定要将「${lead.companyName}」释放到公海池吗？`,
        [
          { text: "取消", style: "cancel" },
          {
            text: "确认释放",
            style: "destructive",
            onPress: async () => {
              const result = await crm.releaseLead(lead.id, "主动释放");
              if (result.success) {
                setShowDetail(null);
                showAlert("成功", result.message);
                loadData();
              } else {
                showAlert("失败", result.message);
              }
            },
          },
        ]
      );
    }
  };

  // 标记签约
  const handleSign = (lead: CrmLead) => {
    if (Platform.OS === "web") {
      if (window.confirm(`确定将「${lead.companyName}」标记为已签约吗？`)) {
        crm.updateLead(lead.id, {
          status: "signed",
          contractSignedDate: new Date().toISOString(),
        }).then((result) => {
          if (result.success) {
            setShowDetail(null);
            showAlert("成功", "客户已标记为签约状态");
            loadData();
          } else {
            showAlert("失败", result.message);
          }
        });
      }
    } else {
      Alert.alert(
        "标记签约",
        `确定将「${lead.companyName}」标记为已签约吗？`,
        [
          { text: "取消", style: "cancel" },
          {
            text: "确认签约",
            onPress: async () => {
              const result = await crm.updateLead(lead.id, {
                status: "signed",
                contractSignedDate: new Date().toISOString(),
              });
              if (result.success) {
                setShowDetail(null);
                showAlert("成功", "客户已标记为签约状态");
                loadData();
              } else {
                showAlert("失败", result.message);
              }
            },
          },
        ]
      );
    }
  };

  // 管理员分配
  const handleAssign = async (lead: CrmLead, salesId: number) => {
    const result = await crm.assignLead(lead.id, salesId);
    if (result.success) {
      setShowAssign(null);
      setShowDetail(null);
      showAlert("成功", result.message);
      loadData();
    } else {
      showAlert("失败", result.message);
    }
  };

  // 编辑客户
  const handleStartEdit = (lead: CrmLead) => {
    setEditForm({
      companyName: lead.companyName || "",
      legalPerson: lead.legalPerson || "",
      shareholders: lead.shareholders || "",
      contactName: lead.contactName || "",
      contactPhone: lead.contactPhone || "",
      contactEmail: lead.contactEmail || "",
      contactPosition: lead.contactPosition || "",
      country: lead.country || "",
      address: lead.address || "",
      businessType: lead.businessType || "",
      notes: lead.notes || "",
    });
    setEditingLead(lead);
    setShowDetail(null);
  };

  const handleSaveEdit = async () => {
    if (!editingLead) return;
    if (!editForm.companyName.trim()) {
      showAlert("提示", "公司名称不能为空");
      return;
    }
    const payload: Record<string, any> = {};
    if (editForm.companyName !== editingLead.companyName) payload.companyName = editForm.companyName.trim();
    if (editForm.legalPerson !== (editingLead.legalPerson || "")) payload.legalPerson = editForm.legalPerson.trim();
    if (editForm.shareholders !== (editingLead.shareholders || "")) payload.shareholders = editForm.shareholders.trim();
    if (editForm.contactName !== (editingLead.contactName || "")) payload.contactName = editForm.contactName.trim();
    if (editForm.contactPhone !== (editingLead.contactPhone || "")) payload.contactPhone = editForm.contactPhone.trim();
    if (editForm.contactEmail !== (editingLead.contactEmail || "")) payload.contactEmail = editForm.contactEmail.trim();
    if (editForm.contactPosition !== (editingLead.contactPosition || "")) payload.contactPosition = editForm.contactPosition.trim();
    if (editForm.country !== (editingLead.country || "")) payload.country = editForm.country.trim();
    if (editForm.address !== (editingLead.address || "")) payload.address = editForm.address.trim();
    if (editForm.businessType !== (editingLead.businessType || "")) payload.businessType = editForm.businessType.trim();
    if (editForm.notes !== (editingLead.notes || "")) payload.notes = editForm.notes.trim();

    if (Object.keys(payload).length === 0) {
      showAlert("提示", "没有修改内容");
      return;
    }

    const result = await crm.updateLead(editingLead.id, payload);
    if (result.success) {
      setEditingLead(null);
      showAlert("成功", "客户信息已更新");
      loadData();
    } else {
      showAlert("失败", result.message);
    }
  };

  // 查看日志
  const handleViewLogs = async (lead: CrmLead) => {
    const logs = await crm.getLeadLogs(lead.id);
    setLeadLogs(logs);
  };

  const getDaysRemaining = (expiry: string | null) => {
    if (!expiry) return null;
    const diff = new Date(expiry).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / 86400000));
  };

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "my_leads", label: "我的客源", count: myLeads.length },
    { key: "public_pool", label: "公海池", count: seaLeads.length },
    ...(isAdmin ? [{ key: "all_leads" as TabKey, label: "全部客源", count: allLeads.length }] : []),
  ];

  // 未登录提示
  if (!user) {
    return (
      <WebLayout>
        <ScreenContainer className="flex-1">
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 40 }}>
            <Text style={{ fontSize: 16, color: colors.muted, marginBottom: 16 }}>请先登录后使用 CRM 功能</Text>
            <TouchableOpacity
              style={{ backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
              onPress={() => router.push("/login")}
            >
              <Text style={{ color: "#fff", fontWeight: "600" }}>去登录</Text>
            </TouchableOpacity>
          </View>
        </ScreenContainer>
      </WebLayout>
    );
  }

  const renderLeadCard = ({ item }: { item: CrmLead }) => {
    const st = STATUS_MAP[item.status] || { label: item.status, color: "#6B7280" };
    const daysLeft = getDaysRemaining(item.protectionExpiry);
    const isPool = item.pool === "sea";

    return (
      <TouchableOpacity
        style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        activeOpacity={0.7}
        onPress={() => { setShowDetail(item); handleViewLogs(item); }}
      >
        <View style={s.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[s.cardTitle, { color: colors.foreground }]} numberOfLines={1}>
              {item.companyName}
            </Text>
            <Text style={[s.cardSub, { color: colors.muted }]}>
              {item.country || "未知"} · {item.businessType || "未知"} · {item.contactName || "无联系人"}
            </Text>
          </View>
          <View style={[s.badge, { backgroundColor: st.color + "18" }]}>
            <Text style={[s.badgeText, { color: st.color }]}>{st.label}</Text>
          </View>
        </View>

        <View style={s.cardBody}>
          {item.legalPerson ? (
            <View style={s.cardRow}>
              <Text style={[s.cardLabel, { color: colors.muted }]}>法人</Text>
              <Text style={[s.cardValue, { color: colors.foreground }]}>{item.legalPerson}</Text>
            </View>
          ) : null}
          <View style={s.cardRow}>
            <Text style={[s.cardLabel, { color: colors.muted }]}>来源</Text>
            <Text style={[s.cardValue, { color: colors.foreground }]}>{SOURCE_MAP[item.source] || item.source}</Text>
          </View>
          {item.ownerName ? (
            <View style={s.cardRow}>
              <Text style={[s.cardLabel, { color: colors.muted }]}>业务人员</Text>
              <Text style={[s.cardValue, { color: colors.primary }]}>{item.ownerName}</Text>
            </View>
          ) : null}
          {item.customerServiceName ? (
            <View style={s.cardRow}>
              <Text style={[s.cardLabel, { color: colors.muted }]}>客服人员</Text>
              <Text style={[s.cardValue, { color: colors.primary }]}>{item.customerServiceName}</Text>
            </View>
          ) : null}
          {daysLeft !== null && daysLeft > 0 && (
            <View style={s.cardRow}>
              <Text style={[s.cardLabel, { color: colors.muted }]}>保护期剩余</Text>
              <Text style={[s.cardValue, { color: daysLeft < 15 ? colors.error : colors.success }]}>
                {daysLeft} 天
              </Text>
            </View>
          )}
          {item.createdByName ? (
            <View style={s.cardRow}>
              <Text style={[s.cardLabel, { color: colors.muted }]}>登记人</Text>
              <Text style={[s.cardValue, { color: colors.muted }]}>{item.createdByName}</Text>
            </View>
          ) : null}
        </View>

        {isPool && (
          <TouchableOpacity
            style={[s.claimBtn, { backgroundColor: colors.primary }]}
            activeOpacity={0.7}
            onPress={() => handleClaim(item)}
          >
            <Text style={s.claimBtnText}>捞取此客户</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const content = (
    <ScreenContainer className="flex-1">
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <View style={s.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <IconSymbol name="chevron.right" size={20} color={colors.primary} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.foreground }]}>客户 CRM 管理</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {isAdmin && (
            <TouchableOpacity
              style={[s.addBtn, { backgroundColor: colors.warning }]}
              activeOpacity={0.7}
              onPress={async () => {
                const result = await crm.autoRelease();
                showAlert("自动回收", result.message);
                loadData();
              }}
            >
              <Text style={s.addBtnText}>自动回收</Text>
            </TouchableOpacity>
          )}
          {canImportCustomers && (
            <TouchableOpacity
              style={[s.addBtn, { backgroundColor: colors.success }]}
              activeOpacity={0.7}
              onPress={() => { resetImport(); setShowImport(true); }}
            >
              <IconSymbol name="tray.and.arrow.down.fill" size={16} color="#fff" />
              <Text style={s.addBtnText}>导入客户</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[s.addBtn, { backgroundColor: colors.primary }]}
            activeOpacity={0.7}
            onPress={() => { resetForm(); setShowRegister(true); }}
          >
            <IconSymbol name="plus.circle.fill" size={16} color="#fff" />
            <Text style={s.addBtnText}>登记客源</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 规则说明卡片 */}
      <View style={[s.rulesCard, { backgroundColor: colors.primary + "08", borderColor: colors.primary + "20" }]}>
        <Text style={[s.rulesTitle, { color: colors.primary }]}>分配与保护规则</Text>
        <Text style={[s.rulesText, { color: colors.muted }]}>
          1. 销售自行登记客源 → 归入我的客源，60天保护期{"\n"}
          2. 管理员登记 → 放入公海，可手动分配给销售{"\n"}
          3. 公海捞取 → 捞取后60天开发保护期{"\n"}
          4. 保护期到期未签约 → 自动转入公海{"\n"}
          5. 签约后3个月无发货 → 僵尸客户转入公海{"\n"}
          6. 冲突检测：同公司名不可重复登记
        </Text>
      </View>

      {/* Tab 切换 */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[s.tab, activeTab === tab.key && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[s.tabText, { color: activeTab === tab.key ? colors.primary : colors.muted }]}>
              {tab.label}
            </Text>
            <View style={[s.tabCount, { backgroundColor: activeTab === tab.key ? colors.primary : colors.muted + "30" }]}>
              <Text style={[s.tabCountText, { color: activeTab === tab.key ? "#fff" : colors.muted }]}>
                {tab.count}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 搜索 */}
      <View style={[s.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <IconSymbol name="magnifyingglass" size={16} color={colors.muted} />
        <TextInput
          style={[s.searchInput, { color: colors.foreground }]}
          placeholder="搜索公司名/法人/联系人/国家..."
          placeholderTextColor={colors.muted}
          value={searchText}
          onChangeText={setSearchText}
        />
      </View>

      {/* 列表 */}
      {refreshing ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.muted, marginTop: 8 }}>加载中...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredLeads}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={s.listContent}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={[s.emptyText, { color: colors.muted }]}>
                {activeTab === "public_pool" ? "公海池暂无客户" : "暂无客源数据"}
              </Text>
              <Text style={[{ fontSize: 12, color: colors.muted, marginTop: 4 }]}>
                点击右上角"登记客源"添加第一个客户
              </Text>
            </View>
          }
          renderItem={renderLeadCard}
        />
      )}

      {/* ===== 客源登记弹窗 ===== */}
      <Modal visible={showRegister} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={[s.modalContent, { backgroundColor: colors.background }]}>
            <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[s.modalTitle, { color: colors.foreground }]}>登记新客源</Text>
              <TouchableOpacity onPress={() => { resetForm(); setShowRegister(false); }}>
                <IconSymbol name="xmark.circle.fill" size={24} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={s.modalBody} showsVerticalScrollIndicator={false}>
              {/* 来源选择 */}
              <Text style={[s.fieldLabel, { color: colors.foreground }]}>客源来源</Text>
              <View style={s.sourceRow}>
                {[
                  { value: "self_developed", label: "自行开发" },
                  { value: "manual_register", label: "手动登记" },
                ].map((src) => (
                  <TouchableOpacity
                    key={src.value}
                    style={[
                      s.sourceBtn,
                      { borderColor: formSource === src.value ? colors.primary : colors.border },
                      formSource === src.value && { backgroundColor: colors.primary + "10" },
                    ]}
                    onPress={() => setFormSource(src.value)}
                  >
                    <Text style={[s.sourceBtnText, { color: formSource === src.value ? colors.primary : colors.muted }]}>
                      {src.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {isAdmin && (
                <Text style={[s.sourceHint, { color: colors.primary }]}>
                  管理员登记的客户将放入公海，可手动分配给销售
                </Text>
              )}

              {/* 公司信息 */}
              <Text style={[s.sectionTitle, { color: colors.foreground }]}>公司信息</Text>

              <Text style={[s.fieldLabel, { color: colors.foreground }]}>公司名称 *</Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                value={formCompany}
                onChangeText={setFormCompany}
                placeholder="输入公司全称"
                placeholderTextColor={colors.muted}
              />

              <Text style={[s.fieldLabel, { color: colors.foreground }]}>法人</Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                value={formLegal}
                onChangeText={setFormLegal}
                placeholder="输入法人姓名"
                placeholderTextColor={colors.muted}
              />

              <Text style={[s.fieldLabel, { color: colors.foreground }]}>股东信息</Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                value={formShareholders}
                onChangeText={setFormShareholders}
                placeholder="如：张三 60%, 李四 40%"
                placeholderTextColor={colors.muted}
              />

              {/* 联系信息 */}
              <Text style={[s.sectionTitle, { color: colors.foreground }]}>联系信息</Text>

              <Text style={[s.fieldLabel, { color: colors.foreground }]}>联系人</Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                value={formContact}
                onChangeText={setFormContact}
                placeholder="联系人姓名"
                placeholderTextColor={colors.muted}
              />

              <Text style={[s.fieldLabel, { color: colors.foreground }]}>职位</Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                value={formPosition}
                onChangeText={setFormPosition}
                placeholder="如：采购经理"
                placeholderTextColor={colors.muted}
              />

              <Text style={[s.fieldLabel, { color: colors.foreground }]}>电话</Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                value={formPhone}
                onChangeText={setFormPhone}
                placeholder="联系电话"
                placeholderTextColor={colors.muted}
                keyboardType="phone-pad"
              />

              <Text style={[s.fieldLabel, { color: colors.foreground }]}>邮箱</Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                value={formEmail}
                onChangeText={setFormEmail}
                placeholder="邮箱地址"
                placeholderTextColor={colors.muted}
                keyboardType="email-address"
              />

              {/* 业务信息 */}
              <Text style={[s.sectionTitle, { color: colors.foreground }]}>业务信息</Text>

              <Text style={[s.fieldLabel, { color: colors.foreground }]}>国家</Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                value={formCountry}
                onChangeText={setFormCountry}
                placeholder="如：巴西、墨西哥"
                placeholderTextColor={colors.muted}
              />

              <Text style={[s.fieldLabel, { color: colors.foreground }]}>地址</Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                value={formAddress}
                onChangeText={setFormAddress}
                placeholder="详细地址"
                placeholderTextColor={colors.muted}
              />

              <Text style={[s.fieldLabel, { color: colors.foreground }]}>业务类型</Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                value={formBusiness}
                onChangeText={setFormBusiness}
                placeholder="如：电商、贸易、代购"
                placeholderTextColor={colors.muted}
              />

              <Text style={[s.fieldLabel, { color: colors.foreground }]}>备注</Text>
              <TextInput
                style={[s.input, s.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                value={formNotes}
                onChangeText={setFormNotes}
                placeholder="补充说明"
                placeholderTextColor={colors.muted}
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity
                style={[s.submitBtn, { backgroundColor: colors.primary, opacity: crm.loading ? 0.7 : 1 }]}
                activeOpacity={0.7}
                onPress={handleRegister}
                disabled={crm.loading}
              >
                {crm.loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.submitBtnText}>提交登记</Text>
                )}
              </TouchableOpacity>

              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ===== 客户详情弹窗 ===== */}
      <Modal visible={!!showDetail} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={[s.modalContent, { backgroundColor: colors.background }]}>
            <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[s.modalTitle, { color: colors.foreground }]}>客户详情</Text>
              <TouchableOpacity onPress={() => { setShowDetail(null); setLeadLogs([]); }}>
                <IconSymbol name="xmark.circle.fill" size={24} color={colors.muted} />
              </TouchableOpacity>
            </View>
            {showDetail && (
              <ScrollView style={s.modalBody} showsVerticalScrollIndicator={false}>
                <View style={[s.detailSection, { borderBottomColor: colors.border }]}>
                  <Text style={[s.detailCompany, { color: colors.foreground }]}>{showDetail.companyName}</Text>
                  <View style={[s.badge, { backgroundColor: (STATUS_MAP[showDetail.status]?.color || "#6B7280") + "18", alignSelf: "flex-start" }]}>
                    <Text style={[s.badgeText, { color: STATUS_MAP[showDetail.status]?.color || "#6B7280" }]}>
                      {STATUS_MAP[showDetail.status]?.label || showDetail.status}
                    </Text>
                  </View>
                </View>

                <Text style={[s.sectionTitle, { color: colors.foreground }]}>工商信息</Text>
                <View style={s.detailRow}>
                  <Text style={[s.detailLabel, { color: colors.muted }]}>法人</Text>
                  <Text style={[s.detailValue, { color: colors.foreground }]}>{showDetail.legalPerson || "未填写"}</Text>
                </View>
                <View style={s.detailRow}>
                  <Text style={[s.detailLabel, { color: colors.muted }]}>股东</Text>
                  <Text style={[s.detailValue, { color: colors.foreground }]}>{showDetail.shareholders || "未填写"}</Text>
                </View>

                <Text style={[s.sectionTitle, { color: colors.foreground }]}>联系信息</Text>
                <View style={s.detailRow}>
                  <Text style={[s.detailLabel, { color: colors.muted }]}>联系人</Text>
                  <Text style={[s.detailValue, { color: colors.foreground }]}>{showDetail.contactName || "未填写"}</Text>
                </View>
                <View style={s.detailRow}>
                  <Text style={[s.detailLabel, { color: colors.muted }]}>职位</Text>
                  <Text style={[s.detailValue, { color: colors.foreground }]}>{showDetail.contactPosition || "未填写"}</Text>
                </View>
                <View style={s.detailRow}>
                  <Text style={[s.detailLabel, { color: colors.muted }]}>电话</Text>
                  <Text style={[s.detailValue, { color: colors.foreground }]}>{showDetail.contactPhone || "未填写"}</Text>
                </View>
                <View style={s.detailRow}>
                  <Text style={[s.detailLabel, { color: colors.muted }]}>邮箱</Text>
                  <Text style={[s.detailValue, { color: colors.foreground }]}>{showDetail.contactEmail || "未填写"}</Text>
                </View>

                <Text style={[s.sectionTitle, { color: colors.foreground }]}>业务信息</Text>
                <View style={s.detailRow}>
                  <Text style={[s.detailLabel, { color: colors.muted }]}>国家</Text>
                  <Text style={[s.detailValue, { color: colors.foreground }]}>{showDetail.country || "未填写"}</Text>
                </View>
                <View style={s.detailRow}>
                  <Text style={[s.detailLabel, { color: colors.muted }]}>业务类型</Text>
                  <Text style={[s.detailValue, { color: colors.foreground }]}>{showDetail.businessType || "未填写"}</Text>
                </View>
                <View style={s.detailRow}>
                  <Text style={[s.detailLabel, { color: colors.muted }]}>来源</Text>
                  <Text style={[s.detailValue, { color: colors.primary }]}>{SOURCE_MAP[showDetail.source] || showDetail.source}</Text>
                </View>

                <Text style={[s.sectionTitle, { color: colors.foreground }]}>分配与保护</Text>
                <View style={s.detailRow}>
                  <Text style={[s.detailLabel, { color: colors.muted }]}>业务负责人</Text>
                  <Text style={[s.detailValue, { color: colors.foreground }]}>{showDetail.ownerName || "无（公海池）"}</Text>
                </View>
                <View style={s.detailRow}>
                  <Text style={[s.detailLabel, { color: colors.muted }]}>客服人员</Text>
                  <Text style={[s.detailValue, { color: colors.primary }]}>{showDetail.customerServiceName || "未分配"}</Text>
                </View>
                <View style={s.detailRow}>
                  <Text style={[s.detailLabel, { color: colors.muted }]}>分配时间</Text>
                  <Text style={[s.detailValue, { color: colors.foreground }]}>
                    {showDetail.assignedAt ? new Date(showDetail.assignedAt).toLocaleDateString("zh-CN") : "-"}
                  </Text>
                </View>
                {showDetail.protectionExpiry ? (
                  <View style={s.detailRow}>
                    <Text style={[s.detailLabel, { color: colors.muted }]}>保护期到期</Text>
                    <Text style={[s.detailValue, { color: colors.warning }]}>
                      {new Date(showDetail.protectionExpiry).toLocaleDateString("zh-CN")}
                    </Text>
                  </View>
                ) : null}
                {showDetail.contractSignedDate ? (
                  <View style={s.detailRow}>
                    <Text style={[s.detailLabel, { color: colors.muted }]}>签约日期</Text>
                    <Text style={[s.detailValue, { color: colors.success }]}>
                      {new Date(showDetail.contractSignedDate).toLocaleDateString("zh-CN")}
                    </Text>
                  </View>
                ) : null}
                {showDetail.notes ? (
                  <>
                    <Text style={[s.sectionTitle, { color: colors.foreground }]}>备注</Text>
                    <Text style={[s.detailNotes, { color: colors.foreground, backgroundColor: colors.surface }]}>
                      {showDetail.notes}
                    </Text>
                  </>
                ) : null}

                {/* 操作按钮 */}
                <View style={s.actionRow}>
                  <TouchableOpacity
                    style={[s.actionBtn, { backgroundColor: colors.primary }]}
                    onPress={() => handleStartEdit(showDetail)}
                  >
                    <Text style={s.actionBtnText}>编辑客户信息</Text>
                  </TouchableOpacity>
                  {showDetail.pool === "mine" && showDetail.status !== "signed" ? (
                    <>
                      <TouchableOpacity
                        style={[s.actionBtn, { backgroundColor: colors.success }]}
                        onPress={() => handleSign(showDetail)}
                      >
                        <Text style={s.actionBtnText}>标记签约</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.actionBtn, { backgroundColor: colors.error }]}
                        onPress={() => handleRelease(showDetail)}
                      >
                        <Text style={s.actionBtnText}>释放到公海</Text>
                      </TouchableOpacity>
                    </>
                  ) : null}
                  {showDetail.pool === "sea" && (
                    <TouchableOpacity
                      style={[s.actionBtn, { backgroundColor: colors.primary }]}
                      onPress={() => { handleClaim(showDetail); setShowDetail(null); }}
                    >
                      <Text style={s.actionBtnText}>从公海捞取</Text>
                    </TouchableOpacity>
                  )}
                  {isAdmin && showDetail.pool === "sea" && (
                    <TouchableOpacity
                      style={[s.actionBtn, { backgroundColor: colors.warning }]}
                      onPress={() => setShowAssign(showDetail)}
                    >
                      <Text style={s.actionBtnText}>分配给销售</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* 操作日志 */}
                {leadLogs.length > 0 && (
                  <>
                    <Text style={[s.sectionTitle, { color: colors.foreground, marginTop: 20 }]}>操作日志</Text>
                    {leadLogs.map((log) => (
                      <View key={log.id} style={[s.logCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={s.logHeader}>
                          <View style={[s.logAction, { backgroundColor: colors.primary + "18" }]}>
                            <Text style={[s.logActionText, { color: colors.primary }]}>{log.action}</Text>
                          </View>
                          <Text style={[s.logTime, { color: colors.muted }]}>
                            {new Date(log.createdAt).toLocaleString("zh-CN")}
                          </Text>
                        </View>
                        <Text style={[s.logReason, { color: colors.foreground }]}>{log.detail}</Text>
                        {log.operatorName ? (
                          <Text style={[s.logDetail, { color: colors.muted }]}>操作人: {log.operatorName}</Text>
                        ) : null}
                      </View>
                    ))}
                  </>
                )}

                <View style={{ height: 40 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ===== 分配弹窗 ===== */}
      <Modal visible={!!showAssign} animationType="fade" transparent>
        <View style={s.modalOverlay}>
          <View style={[s.assignModal, { backgroundColor: colors.background }]}>
            <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[s.modalTitle, { color: colors.foreground }]}>
                分配「{showAssign?.companyName}」
              </Text>
              <TouchableOpacity onPress={() => setShowAssign(null)}>
                <IconSymbol name="xmark.circle.fill" size={24} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 16 }}>
              {salesStaff.length === 0 ? (
                <Text style={{ color: colors.muted, textAlign: "center", padding: 20 }}>
                  暂无可分配的销售人员
                </Text>
              ) : (
                salesStaff.map((staff) => (
                  <TouchableOpacity
                    key={staff.id}
                    style={[s.staffItem, { borderColor: colors.border }]}
                    onPress={() => showAssign && handleAssign(showAssign, staff.id)}
                    activeOpacity={0.7}
                  >
                    <View>
                      <Text style={[s.staffName, { color: colors.foreground }]}>{staff.name || "未命名"}</Text>
                      <Text style={[s.staffDept, { color: colors.muted }]}>
                        {staff.department || "未分配部门"} · {staff.role === "company_admin" ? "管理员" : "业务员"}
                      </Text>
                    </View>
                    <IconSymbol name="chevron.right" size={16} color={colors.muted} />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ===== 导入客户弹窗 ===== */}
      <Modal visible={showImport} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={[s.modalContent, { backgroundColor: colors.background }]}>
            <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[s.modalTitle, { color: colors.foreground }]}>导入原有客户信息</Text>
              <TouchableOpacity onPress={() => { resetImport(); setShowImport(false); }}>
                <IconSymbol name="xmark.circle.fill" size={24} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={s.modalBody} showsVerticalScrollIndicator={false}>
              {/* 模板说明 */}
              <View style={[s.rulesCard, { backgroundColor: colors.primary + "08", borderColor: colors.primary + "20", marginHorizontal: 0 }]}>
                <Text style={[s.rulesTitle, { color: colors.primary }]}>导入模板字段说明</Text>
                <Text style={[s.rulesText, { color: colors.muted }]}>
                  Excel 表头字段（支持中文或英文）：{"\n"}
                  • 公司名称 (companyName) *必填{"\n"}
                  • 联系人 (contactName){"\n"}
                  • 联系电话 (contactPhone){"\n"}
                  • 联系邮箱 (contactEmail){"\n"}
                  • 国家 (country){"\n"}
                  • 地址 (address){"\n"}
                  • 业务类型 (businessType){"\n"}
                  • 法人 (legalPerson){"\n"}
                  • 股东 (shareholders){"\n"}
                  • 业务人员 (salesName) - 填写系统员工姓名，自动匹配{"\n"}
                  • 客服人员 (customerServiceName) - 填写系统员工姓名，自动匹配{"\n"}
                  • 备注 (notes)
                </Text>
                <Text style={[{ fontSize: 11, color: colors.warning, marginTop: 6 }]}>
                  ✱ 业务人员匹配成功→客户归入该销售"我的客源"；未匹配→客户进入公海池
                </Text>
              </View>

              {/* 文件选择 */}
              <View style={{ marginTop: 16 }}>
                {Platform.OS === "web" && (
                  <input
                    ref={fileInputRef as any}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    style={{ display: "none" }}
                    onChange={handleImportWebFileChange}
                  />
                )}
                <TouchableOpacity
                  style={[s.importFileBtn, { borderColor: colors.primary, backgroundColor: colors.surface }]}
                  onPress={handlePickImportFile}
                >
                  <IconSymbol name="tray.and.arrow.down.fill" size={24} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontWeight: "600", marginTop: 8 }}>
                    {importFileName || "点击选择 Excel/CSV 文件"}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>支持 .xlsx, .xls, .csv 格式</Text>
                </TouchableOpacity>
              </View>

              {/* 解析结果预览 */}
              {importParsedData.length > 0 && (
                <View style={[{ marginTop: 12, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.success, backgroundColor: colors.surface }]}>
                  <Text style={{ color: colors.success, fontWeight: "700", fontSize: 14, marginBottom: 6 }}>
                    ✅ 已解析 {importParsedData.length} 条客户数据
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    字段: {Object.keys(importParsedData[0]).join(", ")}
                  </Text>
                  {importParsedData.length > 0 && (
                    <View style={{ marginTop: 8, padding: 8, backgroundColor: colors.background, borderRadius: 6 }}>
                      <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 4 }}>首条数据预览：</Text>
                      {Object.entries(importParsedData[0]).slice(0, 6).map(([key, val]) => (
                        <Text key={key} style={{ color: colors.foreground, fontSize: 12 }}>
                          {key}: {String(val)}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* 导入结果 */}
              {importResult && (
                <View style={[{ marginTop: 12, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }]}>
                  <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 14, marginBottom: 6 }}>导入结果</Text>
                  <Text style={{ color: colors.success, fontSize: 13 }}>成功: {importResult.successCount} 条</Text>
                  <Text style={{ color: colors.error, fontSize: 13 }}>失败: {importResult.failedCount} 条</Text>
                  {importResult.errors && importResult.errors.length > 0 && (
                    <View style={{ marginTop: 8 }}>
                      <Text style={{ color: colors.warning, fontSize: 12, fontWeight: "600" }}>详细信息：</Text>
                      {importResult.errors.slice(0, 10).map((err, idx) => (
                        <Text key={idx} style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>• {err}</Text>
                      ))}
                      {importResult.errors.length > 10 && (
                        <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>… 还有 {importResult.errors.length - 10} 条</Text>
                      )}
                    </View>
                  )}
                </View>
              )}

              {/* 导入按钮 */}
              <TouchableOpacity
                style={[s.submitBtn, { backgroundColor: importParsedData.length > 0 ? colors.success : colors.muted, opacity: importing ? 0.7 : 1, marginTop: 20 }]}
                activeOpacity={0.7}
                onPress={handleImportSubmit}
                disabled={importing || importParsedData.length === 0}
              >
                {importing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.submitBtnText}>开始导入</Text>
                )}
              </TouchableOpacity>

              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ===== 编辑客户弹窗 ===== */}
      <Modal visible={!!editingLead} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={[s.modalContent, { backgroundColor: colors.background }]}>
            <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[s.modalTitle, { color: colors.foreground }]}>编辑客户信息</Text>
              <TouchableOpacity onPress={() => setEditingLead(null)}>
                <IconSymbol name="xmark.circle.fill" size={24} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={s.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={[s.fieldLabel, { color: colors.muted }]}>公司名称 *</Text>
              <TextInput
                style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
                value={editForm.companyName}
                onChangeText={(v) => setEditForm({ ...editForm, companyName: v })}
                placeholder="公司名称"
                placeholderTextColor={colors.muted}
              />
              <Text style={[s.fieldLabel, { color: colors.muted }]}>法人</Text>
              <TextInput
                style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
                value={editForm.legalPerson}
                onChangeText={(v) => setEditForm({ ...editForm, legalPerson: v })}
                placeholder="法人"
                placeholderTextColor={colors.muted}
              />
              <Text style={[s.fieldLabel, { color: colors.muted }]}>股东</Text>
              <TextInput
                style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
                value={editForm.shareholders}
                onChangeText={(v) => setEditForm({ ...editForm, shareholders: v })}
                placeholder="股东"
                placeholderTextColor={colors.muted}
              />
              <Text style={[s.fieldLabel, { color: colors.muted }]}>联系人姓名</Text>
              <TextInput
                style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
                value={editForm.contactName}
                onChangeText={(v) => setEditForm({ ...editForm, contactName: v })}
                placeholder="联系人姓名"
                placeholderTextColor={colors.muted}
              />
              <Text style={[s.fieldLabel, { color: colors.muted }]}>联系电话</Text>
              <TextInput
                style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
                value={editForm.contactPhone}
                onChangeText={(v) => setEditForm({ ...editForm, contactPhone: v })}
                placeholder="联系电话"
                placeholderTextColor={colors.muted}
              />
              <Text style={[s.fieldLabel, { color: colors.muted }]}>联系邮箱</Text>
              <TextInput
                style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
                value={editForm.contactEmail}
                onChangeText={(v) => setEditForm({ ...editForm, contactEmail: v })}
                placeholder="联系邮箱"
                placeholderTextColor={colors.muted}
                keyboardType="email-address"
              />
              <Text style={[s.fieldLabel, { color: colors.muted }]}>联系人职位</Text>
              <TextInput
                style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
                value={editForm.contactPosition}
                onChangeText={(v) => setEditForm({ ...editForm, contactPosition: v })}
                placeholder="联系人职位"
                placeholderTextColor={colors.muted}
              />
              <Text style={[s.fieldLabel, { color: colors.muted }]}>国家</Text>
              <TextInput
                style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
                value={editForm.country}
                onChangeText={(v) => setEditForm({ ...editForm, country: v })}
                placeholder="国家"
                placeholderTextColor={colors.muted}
              />
              <Text style={[s.fieldLabel, { color: colors.muted }]}>地址</Text>
              <TextInput
                style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
                value={editForm.address}
                onChangeText={(v) => setEditForm({ ...editForm, address: v })}
                placeholder="地址"
                placeholderTextColor={colors.muted}
              />
              <Text style={[s.fieldLabel, { color: colors.muted }]}>业务类型</Text>
              <TextInput
                style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
                value={editForm.businessType}
                onChangeText={(v) => setEditForm({ ...editForm, businessType: v })}
                placeholder="业务类型"
                placeholderTextColor={colors.muted}
              />
              <Text style={[s.fieldLabel, { color: colors.muted }]}>备注</Text>
              <TextInput
                style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface, minHeight: 80 }]}
                value={editForm.notes}
                onChangeText={(v) => setEditForm({ ...editForm, notes: v })}
                placeholder="备注信息"
                placeholderTextColor={colors.muted}
                multiline
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={[s.submitBtn, { backgroundColor: colors.primary, marginTop: 20 }]}
                activeOpacity={0.7}
                onPress={handleSaveEdit}
              >
                <Text style={s.submitBtnText}>保存修改</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.submitBtn, { backgroundColor: colors.muted, marginTop: 10 }]}
                activeOpacity={0.7}
                onPress={() => setEditingLead(null)}
              >
                <Text style={s.submitBtnText}>取消</Text>
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );

  return <WebLayout>{content}</WebLayout>;
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  addBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  rulesCard: { marginHorizontal: 16, marginTop: 12, padding: 12, borderRadius: 10, borderWidth: 1 },
  rulesTitle: { fontSize: 13, fontWeight: "700", marginBottom: 6 },
  rulesText: { fontSize: 11, lineHeight: 18 },
  tabBar: { flexDirection: "row", paddingHorizontal: 12, marginTop: 8, maxHeight: 44 },
  tab: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, marginRight: 4, gap: 6 },
  tabText: { fontSize: 13, fontWeight: "600" },
  tabCount: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10, minWidth: 20, alignItems: "center" },
  tabCountText: { fontSize: 11, fontWeight: "600" },
  searchBar: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginTop: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, gap: 8 },
  searchInput: { flex: 1, fontSize: 13, padding: 0 },
  listContent: { padding: 16, gap: 10 },
  card: { borderRadius: 10, borderWidth: 1, padding: 14 },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 },
  cardTitle: { fontSize: 15, fontWeight: "700" },
  cardSub: { fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: "600" },
  cardBody: { gap: 6 },
  cardRow: { flexDirection: "row", justifyContent: "space-between" },
  cardLabel: { fontSize: 12 },
  cardValue: { fontSize: 12, fontWeight: "500" },
  claimBtn: { marginTop: 10, paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  claimBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  empty: { paddingVertical: 60, alignItems: "center" },
  emptyText: { fontSize: 14 },
  logCard: { borderRadius: 8, borderWidth: 1, padding: 12, marginBottom: 8 },
  logHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  logAction: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  logActionText: { fontSize: 11, fontWeight: "600" },
  logTime: { fontSize: 11 },
  logReason: { fontSize: 13, fontWeight: "500" },
  logDetail: { fontSize: 11, marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { maxHeight: "90%", borderTopLeftRadius: 20, borderTopRightRadius: 20, ...Platform.select({ web: { maxWidth: 600, alignSelf: "center" as any, width: "100%" as any } }) },
  assignModal: { maxHeight: "60%", borderTopLeftRadius: 20, borderTopRightRadius: 20, ...Platform.select({ web: { maxWidth: 500, alignSelf: "center" as any, width: "100%" as any } }) },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 0.5 },
  modalTitle: { fontSize: 17, fontWeight: "700" },
  modalBody: { paddingHorizontal: 20, paddingTop: 12 },
  fieldLabel: { fontSize: 13, fontWeight: "600", marginTop: 12, marginBottom: 4 },
  sectionTitle: { fontSize: 14, fontWeight: "700", marginTop: 18, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  textArea: { minHeight: 70, textAlignVertical: "top" },
  sourceRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  sourceBtn: { flex: 1, borderWidth: 1.5, borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  sourceBtnText: { fontSize: 13, fontWeight: "600" },
  sourceHint: { fontSize: 11, marginTop: 6, fontStyle: "italic" },
  submitBtn: { marginTop: 20, paddingVertical: 14, borderRadius: 10, alignItems: "center" },
  submitBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  detailSection: { paddingBottom: 12, borderBottomWidth: 0.5, marginBottom: 4 },
  detailCompany: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  detailLabel: { fontSize: 13 },
  detailValue: { fontSize: 13, fontWeight: "500", maxWidth: "60%" as any, textAlign: "right" },
  detailNotes: { padding: 12, borderRadius: 8, fontSize: 13, lineHeight: 20 },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 20, flexWrap: "wrap" },
  actionBtn: { flex: 1, minWidth: 100, paddingVertical: 12, borderRadius: 8, alignItems: "center" },
  actionBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  staffItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, borderWidth: 1, borderRadius: 8, marginBottom: 8 },
  staffName: { fontSize: 15, fontWeight: "600" },
  staffDept: { fontSize: 12, marginTop: 2 },
  importFileBtn: { borderWidth: 2, borderStyle: "dashed", borderRadius: 12, paddingVertical: 24, alignItems: "center", justifyContent: "center" },
});
