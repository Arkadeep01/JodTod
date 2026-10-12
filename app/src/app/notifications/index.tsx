import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  BackHandler,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';

import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationAsRead,
  type BackendNotification,
  type NotificationType,
  NotificationApiError,
} from '../../services/notification.api';

/* ────────────────────────────────────────────────────────────────────────
   THEME + GLASS PRIMITIVES
   ──────────────────────────────────────────────────────────────────────── */

const colors = {
  navy: '#0B3D62',
  navySoft: '#3E6E8E',
  muted: '#5B7C93',
  faint: '#8DA0B1',
  teal: '#149C73',
  tealBg: '#E7F7F2',
  red: '#F04F38',
  redBg: '#FDE3E8',
  orange: '#E0932E',
  orangeBg: '#FFF3DE',
  purple: '#6C63FF',
  purpleBg: '#EDEBFF',
  blue: '#2563EB',
  blueBg: '#DDEBFF',
  green: '#10B981',
  greenBg: '#D1FAE5',
};

const cardShadow = {
  shadowColor: colors.navy,
  shadowOffset: { width: 0, height: 5 },
  shadowOpacity: 0.1,
  shadowRadius: 9,
  elevation: 4,
};

const glassBg = { backgroundColor: 'rgba(255,255,255,0.01)' };

const BACKGROUND_IMAGE = require('../../../assets/images/jodtod/background_home.png');

function ScreenBackground() {
  return (
    <>
      <Image
        source={BACKGROUND_IMAGE}
        className="absolute inset-0 h-full w-full"
        resizeMode="cover"
      />
      <View className="absolute inset-0 bg-white/10" pointerEvents="none" />
    </>
  );
}

function GlassLayers({ radius = 24 }: { radius?: number }) {
  return (
    <>
      <BlurView
        intensity={40}
        tint="default"
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      />
      <LinearGradient
        colors={['rgba(255,255,255,0.62)', 'rgba(198,228,222,0.4)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      />
      <LinearGradient
        colors={['rgba(255,255,255,0.5)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.4 }}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      />
    </>
  );
}

function GlassCard({
  children,
  radius = 24,
  style,
}: {
  children: React.ReactNode;
  radius?: number;
  style?: any;
}) {
  return (
    <View className="rounded-[24px]" style={[cardShadow, glassBg, style]}>
      <View className="overflow-hidden rounded-[24px] border border-white/60">
        <GlassLayers radius={radius} />
        <View className="p-4">{children}</View>
      </View>
    </View>
  );
}

function DetailHeader({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack: () => void;
  right?: React.ReactNode;
}) {
  return (
    <View className="flex-row items-center justify-between px-5 pb-4 pt-3">
      <View className="flex-row items-center">
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={onBack}
          className="h-10 w-10 items-center justify-center rounded-full border border-white/60 overflow-hidden"
          style={[cardShadow, glassBg]}
        >
          <GlassLayers radius={20} />
          <View className="absolute inset-0 bg-white/40" />
          <Ionicons name="chevron-back" size={19} color={colors.navy} />
        </TouchableOpacity>
        <Text className="ml-3 text-[19px] font-extrabold text-[#0B3D62]">
          {title}
        </Text>
      </View>
      {right}
    </View>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   FILTER CHIPS
   ──────────────────────────────────────────────────────────────────────── */

const FILTER_OPTIONS: {
  key: 'all' | NotificationType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}[] = [
  { key: 'all', label: 'All', icon: 'apps', color: colors.navy },
  { key: 'expense_added', label: 'Expenses', icon: 'restaurant', color: colors.red },
  { key: 'settlement_completed', label: 'Settlements', icon: 'cash', color: colors.teal },
  { key: 'group_invitation', label: 'Group', icon: 'people', color: colors.purple },
  { key: 'system', label: 'System', icon: 'settings', color: colors.blue },
];

/* ────────────────────────────────────────────────────────────────────────
   DATE FORMATTING (uses user preference in production)
   ──────────────────────────────────────────────────────────────────────── */

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatTime(date: Date): string {
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const suffix = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${hours}:${minutes} ${suffix}`;
}

function formatDate(date: Date): string {
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`;
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return `${formatDate(date)} • ${formatTime(date)}`;
}

function sectionLabelFor(date: Date, now: Date): string {
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.round(
    (startOfDay(now).getTime() - startOfDay(date).getTime()) / dayMs,
  );
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return formatDate(date);
}

/* ────────────────────────────────────────────────────────────────────────
   NOTIFICATION TYPE ICONS
   ──────────────────────────────────────────────────────────────────────── */

const TYPE_ICONS: Record<NotificationType, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  expense_added: { icon: 'restaurant', color: colors.red, bg: colors.redBg },
  settlement_completed: { icon: 'cash', color: colors.teal, bg: colors.tealBg },
  group_invitation: { icon: 'people', color: colors.purple, bg: colors.purpleBg },
  group_comment: { icon: 'chatbubble', color: colors.blue, bg: colors.blueBg },
  trip_report_ready: { icon: 'document-text', color: colors.orange, bg: colors.orangeBg },
  budget_alert: { icon: 'alert', color: colors.orange, bg: colors.orangeBg },
  member_joined_group: { icon: 'person-add', color: colors.green, bg: colors.greenBg },
  bill_image_updated: { icon: 'image', color: colors.purple, bg: colors.purpleBg },
  group_settings_updated: { icon: 'settings', color: colors.blue, bg: colors.blueBg },
  system: { icon: 'information-circle', color: colors.navySoft, bg: 'rgba(255,255,255,0.2)' },
};

/* ────────────────────────────────────────────────────────────────────────
   DATA TRANSFORM
   ──────────────────────────────────────────────────────────────────────── */

type NotificationSection = {
  key: string;
  label: string;
  items: BackendNotification[];
};

function groupNotificationsByDay(items: BackendNotification[]): NotificationSection[] {
  const now = new Date();
  const groups = new Map<string, NotificationSection>();
  for (const item of items) {
    const date = new Date(item.created_at);
    const label = sectionLabelFor(date, now);
    const dayKey = startOfDay(date).getTime().toString();
    const existing = groups.get(dayKey);
    if (existing) {
      existing.items.push(item);
    } else {
      groups.set(dayKey, { key: dayKey, label, items: [item] });
    }
  }
  return [...groups.entries()]
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([, section]) => section);
}

/* ────────────────────────────────────────────────────────────────────────
   SCREEN
   ──────────────────────────────────────────────────────────────────────── */

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [activeFilter, setActiveFilter] = useState<'all' | NotificationType>('all');
  const [notifications, setNotifications] = useState<BackendNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadNotifications = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setLoadError(false);
    try {
      const typeParam = activeFilter === 'all' ? undefined : activeFilter;
      const result = await fetchNotifications({ type: typeParam, limit: 100 });
      if (!mountedRef.current) return;
      setNotifications(result);
    } catch (err) {
      if (!mountedRef.current) return;
      setLoadError(true);
      console.error('Failed to load notifications:', err);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [activeFilter]);

  const loadUnreadCount = useCallback(async () => {
    try {
      const result = await fetchUnreadCount();
      if (mountedRef.current) setUnreadCount(result.unread_count);
    } catch {
      // Non-fatal
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
    void loadUnreadCount();
  }, [loadNotifications, loadUnreadCount]);

  const handleRefresh = useCallback(() => {
    void loadNotifications(true);
  }, [loadNotifications]);

  const handleFilterPress = useCallback((filter: 'all' | NotificationType) => {
    setActiveFilter(filter);
  }, []);

  const handleNotificationPress = useCallback(
    async (notification: BackendNotification) => {
      if (notification.read_at === null) {
        try {
          await markNotificationAsRead(notification.id);
          if (mountedRef.current) {
            setNotifications((prev) =>
              prev.map((n) =>
                n.id === notification.id ? { ...n, read_at: new Date().toISOString() } : n,
              ),
            );
            setUnreadCount((prev) => Math.max(0, prev - 1));
          }
        } catch {
          // Non-fatal; still navigate
        }
      }
      router.push(`/notifications/${notification.id}` as any);
    },
    [router],
  );

  const sections = useMemo(
    () => groupNotificationsByDay(notifications),
    [notifications],
  );

  const filteredSections = useMemo(() => {
    if (activeFilter === 'all') return sections;
    return sections.map((section) => ({
      ...section,
      items: section.items.filter((n) => n.type === activeFilter),
    })).filter((s) => s.items.length > 0);
  }, [sections, activeFilter]);

  const hasNotifications = notifications.length > 0;

  return (
    <View className="flex-1">
      <ScreenBackground />
      <SafeAreaView edges={['top']} className="flex-1">
        <View className="px-5 pb-3 pt-5">
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center">
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => {
                  // Cold-link entry has no history to pop: fall back to
                  // the tabs root (same house pattern as scan-join-qr).
                  if (router.canGoBack()) {
                    router.back();
                  } else {
                    router.replace('/(tabs)' as any);
                  }
                }}
                className="h-10 w-10 items-center justify-center rounded-full border border-white/60 overflow-hidden"
                style={[cardShadow, glassBg]}
              >
                <GlassLayers radius={20} />
                <View className="absolute inset-0 bg-white/40" />
                <Ionicons name="chevron-back" size={19} color={colors.navy} />
              </TouchableOpacity>
              <Text
                className="ml-3 text-[28px] font-extrabold text-[#0B3D62]"
                style={{
                  textShadowColor: 'rgba(255,255,255,0.75)',
                  textShadowRadius: 10,
                  textShadowOffset: { width: 0, height: 1 },
                }}
              >
                Notifications
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              className="h-10 w-10 items-center justify-center rounded-full border border-white/60 overflow-hidden"
              style={[cardShadow, glassBg]}
            >
              <GlassLayers radius={20} />
              <View className="absolute inset-0 bg-white/40" />
              <Ionicons name="settings-outline" size={19} color={colors.navy} />
            </TouchableOpacity>
          </View>

          <Text className="mb-4 text-[14px] text-[#5B7C93]">View all notifications</Text>
        </View>

        {/* Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-4 px-0"
          contentContainerClassName="px-5 pr-8"
          style={{ flexGrow: 0, flexShrink: 0, height: 40 }}
        >
          {FILTER_OPTIONS.map((f, index, list) => {
            const active = activeFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                activeOpacity={0.85}
                onPress={() => handleFilterPress(f.key)}
                className={`${index === list.length - 1 ? 'mr-0' : 'mr-2'} flex-row items-center overflow-hidden rounded-full border px-3.5 py-2`}
                style={[
                  { flexShrink: 0 },
                  active
                    ? {
                        borderColor: 'transparent',
                        backgroundColor: f.color,
                        ...cardShadow,
                        shadowColor: f.color,
                        shadowOpacity: 0.2,
                        shadowRadius: 5,
                        shadowOffset: { width: 0, height: 3 },
                      }
                    : {
                        borderColor: 'rgba(255,255,255,0.7)',
                        backgroundColor: 'rgba(255,255,255,0.45)',
                      },
                ]}
              >
                {!active ? <GlassLayers radius={24} /> : null}
                <Ionicons
                  name={f.icon}
                  size={12}
                  color={active ? '#FFFFFF' : colors.navySoft}
                  style={{ marginRight: 4 }}
                />
                <Text
                  className={`text-[12.5px] font-bold ${active ? 'text-white' : 'text-[#3E6E8E]'}`}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <ScrollView
          showsVerticalScrollIndicator={false}
          className="px-5"
          contentContainerClassName="pb-44"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[colors.teal]}
              progressBackgroundColor="rgba(255,255,255,0.1)"
            />
          }
        >
          {loading ? (
            <View className="mt-16 items-center px-8">
              <ActivityIndicator size="large" color={colors.teal} />
              <Text className="mt-4 text-[14px] font-semibold text-[#0B3D62]">
                Loading notifications...
              </Text>
            </View>
          ) : loadError ? (
            <View className="mt-16 items-center px-8">
              <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-white/40">
                <Ionicons name="cloud-offline-outline" size={32} color={colors.faint} />
              </View>
              <Text className="text-[16px] font-extrabold text-[#0B3D62]">
                Couldn't load notifications
              </Text>
              <Text className="mt-1 text-center text-[13px] text-[#5B7C93]">
                Check your connection and try again.
              </Text>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleRefresh}
                className="mt-5 items-center rounded-full bg-[#149C73] px-6 py-3"
              >
                <Text className="text-[14px] font-extrabold text-white">Retry</Text>
              </TouchableOpacity>
            </View>
          ) : !hasNotifications ? (
            <View className="mt-16 items-center px-8">
              <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-white/40">
                <Ionicons name="notifications-off-outline" size={32} color={colors.faint} />
              </View>
              <Text className="text-[16px] font-extrabold text-[#0B3D62]">
                No notifications yet
              </Text>
              <Text className="mt-1 text-center text-[13px] text-[#5B7C93]">
                When you have new activity, it will appear here.
              </Text>
            </View>
          ) : (
            filteredSections.map((section) => (
              <View key={section.key} className="mb-8">
                <Text className="mb-3 text-[13px] font-bold text-[#0B3D62]">
                  {section.label}
                </Text>
                <GlassCard>
                  <View className="-m-4">
                    <View className="px-4">
                      {section.items.map((item, index) => (
                        <TouchableOpacity
                          key={item.id}
                          activeOpacity={0.8}
                          onPress={() => handleNotificationPress(item)}
                          className={
                            index === section.items.length - 1
                              ? 'flex-row items-center py-4'
                              : 'flex-row items-center border-b border-white/40 py-4'
                          }
                        >
                          {/* Icon */}
                          <View
                            className="mr-3.5 h-11 w-11 items-center justify-center rounded-full"
                            style={{
                              backgroundColor: TYPE_ICONS[item.type]?.bg ?? colors.navySoft,
                            }}
                          >
                            <Ionicons
                              name={TYPE_ICONS[item.type]?.icon ?? 'notifications'}
                              size={19}
                              color={TYPE_ICONS[item.type]?.color ?? colors.navy}
                            />
                          </View>

                          {/* Content */}
                          <View className="flex-1 min-w-0">
                            <View className="flex-row items-start justify-between">
                              <Text
                                numberOfLines={1}
                                className={`text-[14px] font-bold text-[#0B3D62] ${
                                  item.read_at === null ? 'font-extrabold' : ''
                                }`}
                              >
                                {item.title}
                              </Text>
                              {item.read_at === null ? (
                                <View
                                  className="ml-2 h-2.5 w-2.5 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: colors.teal }}
                                />
                              ) : null}
                            </View>
                            <Text
                              numberOfLines={2}
                              className="mt-0.5 text-[12px] text-[#5B7C93]"
                            >
                              {item.message}
                            </Text>
                            <Text
                              numberOfLines={1}
                              className="mt-1 text-[11px] text-[#8DA0B1]"
                            >
                              {formatTime(new Date(item.created_at))}
                            </Text>
                          </View>

                          {/* Chevron */}
                          <Ionicons
                            name="chevron-forward"
                            size={16}
                            color={colors.faint}
                          />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </GlassCard>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}