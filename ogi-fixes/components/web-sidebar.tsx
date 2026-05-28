import { Text, View, TouchableOpacity, StyleSheet, Platform, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useRouter, usePathname } from "expo-router";
import { useColors } from "@/hooks/use-colors";
import { usePermission } from "@/hooks/use-permission";
import { useAuth } from "@/lib/auth-context";
import { IconSymbol } from "@/components/ui/icon-symbol";
import type { PermissionKey } from "@/lib/permissions";

type NavItem = {
  key: string;
  label: string;
  icon: any;
  route: string;
  permission?: PermissionKey;
  dividerAfter?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { key: "home", label: "工作台", icon: "house.fill", route: "/" },
  { key: "shipment", label: "运单管理", icon: "paperplane.fill", route: "/shipment", permission: "module:orders" },
  { key: "warehouse", label: "海外仓储", icon: "archivebox.fill", route: "/warehouse", permission: "module:warehouse" },
  { key: "finance", label: "财务中心", icon: "banknote.fill", route: "/finance", permission: "module:finance", dividerAfter: true },
  { key: "crm", label: "客户CRM", icon: "person.crop.circle.badge.plus", route: "/crm", permission: "module:crm" },
  { key: "sales-board", label: "销售业绩", icon: "chart.bar.fill", route: "/sales-board", permission: "module:crm" },
  { key: "customers", label: "客户渠道", icon: "person.2.fill", route: "/customers", permission: "module:customers" },
  { key: "quotes", label: "报价产品", icon: "doc.text.fill", route: "/quotes", permission: "module:quotes" },
  { key: "quote-manage", label: "半自动报价", icon: "doc.text.fill", route: "/quote-manage", permission: "module:quotes" },
  { key: "quote-inquiry", label: "客户询价", icon: "doc.text.fill", route: "/quote-inquiry" },
  { key: "agents", label: "代理分润", icon: "building.2.fill", route: "/agents", permission: "module:agents", dividerAfter: true },
  { key: "approvals", label: "审批风控", icon: "exclamationmark.triangle.fill", route: "/approvals", permission: "module:approvals" },
  { key: "bi", label: "经营分析", icon: "chart.pie.fill", route: "/bi", permission: "module:bi" },
  { key: "accounts", label: "账号管理", icon: "person.badge.key.fill", route: "/accounts", permission: "module:accounts" },
  { key: "system", label: "系统管理", icon: "gearshape.fill", route: "/system", permission: "module:accounts" },
  { key: "logs", label: "系统日志", icon: "doc.text.magnifyingglass", route: "/logs", permission: "module:accounts", dividerAfter: true },
  { key: "profile", label: "个人设置", icon: "gearshape.fill", route: "/profile" },
];

export function WebSidebar() {
  const colors = useColors();
  const router = useRouter();
  const pathname = usePathname();
  const perm = usePermission();
  const { user: authUser, logout } = useAuth();
  // 始终使用最新的认证系统用户信息，避免切换账号后显示旧数据
  const displayName = authUser?.name ?? "用户";
  const displayRole = perm.roleLabel;

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.permission || perm.can(item.permission)
  );

  const isActive = (route: string) => {
    if (route === "/") return pathname === "/" || pathname === "/index";
    return pathname.includes(route);
  };

  return (
    <View style={[styles.sidebar, { backgroundColor: colors.surface, borderRightColor: colors.border }]}>
      {/* Logo */}
      <View style={styles.logoSection}>
        <Image
          source={require("@/assets/images/logo-full.png")}
          style={styles.logo}
          contentFit="contain"
        />
      </View>

      {/* User Info */}
      <View style={[styles.userSection, { borderBottomColor: colors.border }]}>
        <View style={[styles.userAvatar, { backgroundColor: colors.primary }]}>
          <Text style={styles.userAvatarText}>{displayName.charAt(0)}</Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={[styles.userName, { color: colors.foreground }]} numberOfLines={1}>{displayName}</Text>
          <Text style={[styles.userRole, { color: colors.primary }]} numberOfLines={1}>
            {displayRole}
          </Text>
        </View>
      </View>

      {/* Navigation */}
      <View style={styles.navSection}>
        {visibleItems.map((item) => {
          const active = isActive(item.route);
          return (
            <View key={item.key}>
              <TouchableOpacity
                style={[
                  styles.navItem,
                  active && { backgroundColor: colors.primary + "12" },
                ]}
                activeOpacity={0.7}
                onPress={() => {
                  if (item.route === "/") {
                    router.push("/(tabs)/" as any);
                  } else if (["/shipment", "/warehouse", "/finance", "/profile"].includes(item.route)) {
                    router.push(`/(tabs)${item.route}` as any);
                  } else {
                    router.push(item.route as any);
                  }
                }}
              >
                <View style={[styles.navIconWrap, active && { backgroundColor: colors.primary + "20" }]}>
                  <IconSymbol name={item.icon} size={18} color={active ? colors.primary : colors.muted} />
                </View>
                <Text style={[styles.navLabel, { color: active ? colors.primary : colors.foreground }]} numberOfLines={1}>
                  {item.label}
                </Text>
                {active && <View style={[styles.activeIndicator, { backgroundColor: colors.primary }]} />}
              </TouchableOpacity>
              {item.dividerAfter && <View style={[styles.navDivider, { backgroundColor: colors.border }]} />}
            </View>
          );
        })}
      </View>

      {/* Footer */}
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Text style={[styles.footerText, { color: colors.muted }]}>OGI 物流管理系统</Text>
        <Text style={[styles.footerVersion, { color: colors.muted }]}>v1.0.0</Text>
      </View>
    </View>
  );
}

/** Wrapper that adds sidebar on wide screens */
export function WebLayout({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === "web";
  const isWide = isWeb && width >= 900;

  if (!isWide) return <>{children}</>;

  return (
    <View style={styles.webLayout}>
      <WebSidebar />
      <View style={styles.webContent}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  webLayout: { flex: 1, flexDirection: "row" },
  webContent: { flex: 1 },
  sidebar: { width: 220, borderRightWidth: 0.5, paddingTop: 0 },
  logoSection: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12 },
  logo: { width: 120, height: 50 },
  userSection: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 0.5, flexDirection: "row", alignItems: "center", gap: 10 },
  userAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  userAvatarText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  userInfo: { flex: 1 },
  userName: { fontSize: 13, fontWeight: "600" },
  userRole: { fontSize: 11, fontWeight: "500", marginTop: 1 },
  navSection: { flex: 1, paddingTop: 8, paddingHorizontal: 8 },
  navItem: { flexDirection: "row", alignItems: "center", paddingVertical: 9, paddingHorizontal: 10, borderRadius: 8, marginBottom: 2 },
  navIconWrap: { width: 30, height: 30, borderRadius: 7, alignItems: "center", justifyContent: "center", marginRight: 10 },
  navLabel: { flex: 1, fontSize: 13, fontWeight: "500" },
  activeIndicator: { width: 3, height: 18, borderRadius: 1.5 },
  navDivider: { height: 0.5, marginVertical: 6, marginHorizontal: 10 },
  footer: { borderTopWidth: 0.5, paddingVertical: 12, paddingHorizontal: 16, alignItems: "center" },
  footerText: { fontSize: 11 },
  footerVersion: { fontSize: 10, marginTop: 2 },
});
