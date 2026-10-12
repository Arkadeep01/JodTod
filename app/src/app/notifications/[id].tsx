import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';

import {
  fetchNotificationById,
  markNotificationAsRead,
  type BackendNotification,
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
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <View className="flex-row items-center px-5 pb-4 pt-3">
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
  );
}

function PrimaryButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      disabled={disabled}
      className="items-center rounded-full py-4"
      style={[cardShadow, { backgroundColor: disabled ? '#A9C9BE' : colors.teal }]}
    >
      <Text className="text-[15px] font-extrabold text-white">{label}</Text>
    </TouchableOpacity>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   NOTIFICATION TYPE ICONS
   ──────────────────────────────────────────────────────────────────────── */

const TYPE_ICONS: Record<BackendNotification['type'], { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
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
   DATE FORMATTING
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

function formatDate(date: Date): string {
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`;
}

function formatTime(date: Date): string {
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const suffix = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${hours}:${minutes} ${suffix}`;
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return `${formatDate(date)} • ${formatTime(date)}`;
}

/**
 * Backend notification metadata arrives as an untyped record
 * (Record<string, unknown> | null). Coerce every present value to a
 * display string once, so detail rows always receive real strings
 * (never objects or undefined).
 */
function metaStrings(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!metadata || typeof metadata !== 'object') return out;
  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value === 'string') out[key] = value;
    else if (value != null) out[key] = String(value);
  }
  return out;
}

/* ────────────────────────────────────────────────────────────────────────
   DETAIL CONTENT RENDERERS
   ──────────────────────────────────────────────────────────────────────── */

function InfoRow({
  label,
  value,
  icon,
  iconColor,
  iconBg,
  last = false,
}: {
  label: string;
  value: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  iconBg?: string;
  last?: boolean;
}) {
  return (
    <View
      className={`flex-row items-center justify-between py-3 ${last ? '' : 'border-b border-white/40'}`}
    >
      <Text className="text-[13px] font-semibold text-[#5B7C93]">{label}</Text>
      <View className="flex-row items-center">
        {icon ? (
          <View
            className="mr-2 h-6 w-6 items-center justify-center rounded-full"
            style={{ backgroundColor: iconBg ?? 'rgba(255,255,255,0.5)' }}
          >
            <Ionicons name={icon} size={13} color={iconColor ?? colors.navySoft} />
          </View>
        ) : null}
        <Text className="text-[14px] font-bold text-[#0B3D62]">{value}</Text>
      </View>
    </View>
  );
}

function ExpenseDetailContent({ notification }: { notification: BackendNotification }) {
  const router = useRouter();
  const metadata = metaStrings(notification.metadata);
  
  return (
    <>
      <View className="mb-4">
        <GlassCard>
          <InfoRow
            label="Expense"
            value={metadata.expense_title ?? '—'}
            icon="restaurant"
            iconColor={colors.red}
            iconBg={colors.redBg}
          />
          {metadata.amount ? (
            <InfoRow
              label="Amount"
              value={metadata.amount}
              icon="cash"
              iconColor={colors.teal}
              iconBg={colors.tealBg}
            />
          ) : null}
          {metadata.paid_by ? (
            <InfoRow
              label="Paid by"
              value={metadata.paid_by}
              icon="person"
              iconColor={colors.blue}
              iconBg={colors.blueBg}
            />
          ) : null}
          {metadata.group_name ? (
            <InfoRow
              label="Group"
              value={metadata.group_name}
              icon="airplane"
              iconColor={colors.teal}
              iconBg={colors.tealBg}
            />
          ) : null}
          {metadata.category ? (
            <InfoRow
              label="Category"
              value={metadata.category}
              icon="flame"
              iconColor={colors.orange}
              iconBg={colors.orangeBg}
            />
          ) : null}
          {metadata.split_type ? (
            <InfoRow label="Split Type" value={metadata.split_type} />
          ) : null}
          {metadata.shared_with ? (
            <InfoRow label="Shared with" value={metadata.shared_with} last />
          ) : null}
        </GlassCard>
      </View>

      {metadata.note ? (
        <View className="mb-4">
          <GlassCard>
            <Text className="mb-2 text-[13px] font-semibold text-[#5B7C93]">Note</Text>
            <Text className="text-[14px] leading-[20px] text-[#0B3D62]">{metadata.note}</Text>
          </GlassCard>
        </View>
      ) : null}

      {metadata.bill_image ? (
        <View className="mb-4">
          <GlassCard>
            <Text className="mb-2 text-[13px] font-semibold text-[#5B7C93]">Bill Image</Text>
            {/* Static thumbnail: no image-viewer flow exists, so this must
                not look tappable (was a pressable with no handler). */}
            <View className="flex-row items-center justify-between">
              <Image
                source={{ uri: metadata.bill_image }}
                className="h-14 w-14 rounded-xl"
              />
            </View>
          </GlassCard>
        </View>
      ) : null}

      {notification.related_group_id ? (
        <View className="mb-4">
          <PrimaryButton
            label="View in Group"
            onPress={() => router.push(`/(tabs)/groups/${notification.related_group_id}` as any)}
          />
        </View>
      ) : null}
    </>
  );
}

function SettlementDetailContent({ notification }: { notification: BackendNotification }) {
  const router = useRouter();
  const metadata = metaStrings(notification.metadata);
  
  return (
    <>
      <View className="mb-4">
        <GlassCard>
          {metadata.amount ? (
            <InfoRow
              label="Amount"
              value={metadata.amount}
              icon="cash"
              iconColor={colors.teal}
              iconBg={colors.tealBg}
            />
          ) : null}
          {metadata.payer_name ? (
            <InfoRow
              label="Paid by"
              value={metadata.payer_name}
              icon="person"
              iconColor={colors.blue}
              iconBg={colors.blueBg}
            />
          ) : null}
          {metadata.receiver_name ? (
            <InfoRow
              label="Received from"
              value={metadata.receiver_name}
              icon="person"
              iconColor={colors.green}
              iconBg={colors.greenBg}
            />
          ) : null}
          {metadata.group_name ? (
            <InfoRow
              label="Group"
              value={metadata.group_name}
              icon="airplane"
              iconColor={colors.teal}
              iconBg={colors.tealBg}
            />
          ) : null}
        </GlassCard>
      </View>

      {notification.related_group_id ? (
        <View className="mb-4">
          <PrimaryButton
            label="View in Group"
            onPress={() => router.push(`/(tabs)/groups/${notification.related_group_id}` as any)}
          />
        </View>
      ) : null}
    </>
  );
}

function GroupInvitationDetailContent({ notification }: { notification: BackendNotification }) {
  const router = useRouter();
  const metadata = metaStrings(notification.metadata);
  
  return (
    <>
      <View className="mb-4">
        <GlassCard>
          {metadata.group_name ? (
            <InfoRow
              label="Group"
              value={metadata.group_name}
              icon="airplane"
              iconColor={colors.teal}
              iconBg={colors.tealBg}
            />
          ) : null}
          {metadata.inviter_name ? (
            <InfoRow
              label="Invited by"
              value={metadata.inviter_name}
              icon="person"
              iconColor={colors.blue}
              iconBg={colors.blueBg}
            />
          ) : null}
          {metadata.expires_at ? (
            <InfoRow
              label="Expires"
              value={formatDateTime(metadata.expires_at)}
              icon="time"
              iconColor={colors.orange}
              iconBg={colors.orangeBg}
            />
          ) : null}
        </GlassCard>
      </View>

      {notification.related_group_id ? (
        <View className="mb-4">
          <PrimaryButton
            label="View Group"
            onPress={() => router.push(`/(tabs)/groups/${notification.related_group_id}` as any)}
          />
        </View>
      ) : null}
    </>
  );
}

function GroupCommentDetailContent({ notification }: { notification: BackendNotification }) {
  const router = useRouter();
  const metadata = metaStrings(notification.metadata);
  
  return (
    <>
      <View className="mb-4">
        <GlassCard>
          {metadata.comment_text ? (
            <InfoRow
              label="Comment"
              value={metadata.comment_text}
              icon="chatbubble"
              iconColor={colors.blue}
              iconBg={colors.blueBg}
            />
          ) : null}
          {metadata.comment_author ? (
            <InfoRow
              label="By"
              value={metadata.comment_author}
              icon="person"
              iconColor={colors.purple}
              iconBg={colors.purpleBg}
            />
          ) : null}
          {metadata.group_name ? (
            <InfoRow
              label="Group"
              value={metadata.group_name}
              icon="airplane"
              iconColor={colors.teal}
              iconBg={colors.tealBg}
              last
            />
          ) : null}
        </GlassCard>
      </View>

      {notification.related_group_id ? (
        <View className="mb-4">
          <PrimaryButton
            label="View in Group"
            onPress={() => router.push(`/(tabs)/groups/${notification.related_group_id}` as any)}
          />
        </View>
      ) : null}
    </>
  );
}

function TripReportDetailContent({ notification }: { notification: BackendNotification }) {
  const metadata = metaStrings(notification.metadata);
  
  return (
    <>
      <View className="mb-4">
        <GlassCard>
          {metadata.trip_name ? (
            <InfoRow
              label="Trip"
              value={metadata.trip_name}
              icon="airplane"
              iconColor={colors.teal}
              iconBg={colors.tealBg}
            />
          ) : null}
          {metadata.report_ready_at ? (
            <InfoRow
              label="Ready at"
              value={formatDateTime(metadata.report_ready_at)}
              icon="time"
              iconColor={colors.orange}
              iconBg={colors.orangeBg}
            />
          ) : null}
        </GlassCard>
      </View>

      {/* No trip-report viewer exists in the app yet: render disabled
          rather than a button that appears tappable but does nothing. */}
      <View className="mb-4">
        <PrimaryButton
          label="View Report"
          disabled
          onPress={() => {}}
        />
      </View>
    </>
  );
}

function BudgetAlertDetailContent({ notification }: { notification: BackendNotification }) {
  const router = useRouter();
  const metadata = metaStrings(notification.metadata);
  
  return (
    <>
      <View className="mb-4">
        <GlassCard>
          {metadata.budget_name ? (
            <InfoRow
              label="Budget"
              value={metadata.budget_name}
              icon="wallet"
              iconColor={colors.orange}
              iconBg={colors.orangeBg}
            />
          ) : null}
          {metadata.limit ? (
            <InfoRow
              label="Limit"
              value={metadata.limit}
              icon="cash"
              iconColor={colors.teal}
              iconBg={colors.tealBg}
            />
          ) : null}
          {metadata.spent ? (
            <InfoRow
              label="Spent"
              value={metadata.spent}
              icon="card"
              iconColor={colors.red}
              iconBg={colors.redBg}
            />
          ) : null}
          {metadata.group_name ? (
            <InfoRow
              label="Group"
              value={metadata.group_name}
              icon="airplane"
              iconColor={colors.teal}
              iconBg={colors.tealBg}
              last
            />
          ) : null}
        </GlassCard>
      </View>

      {notification.related_group_id ? (
        <View className="mb-4">
          <PrimaryButton
            label="View Budget"
            onPress={() => router.push(`/(tabs)/groups/${notification.related_group_id}` as any)}
          />
        </View>
      ) : null}
    </>
  );
}

function MemberJoinedDetailContent({ notification }: { notification: BackendNotification }) {
  const router = useRouter();
  const metadata = metaStrings(notification.metadata);
  
  return (
    <>
      <View className="mb-4">
        <GlassCard>
          {metadata.member_name ? (
            <InfoRow
              label="Member"
              value={metadata.member_name}
              icon="person"
              iconColor={colors.blue}
              iconBg={colors.blueBg}
            />
          ) : null}
          {metadata.group_name ? (
            <InfoRow
              label="Group"
              value={metadata.group_name}
              icon="airplane"
              iconColor={colors.teal}
              iconBg={colors.tealBg}
            />
          ) : null}
          {metadata.added_by ? (
            <InfoRow
              label="Added by"
              value={metadata.added_by}
              icon="person-add"
              iconColor={colors.green}
              iconBg={colors.greenBg}
              last
            />
          ) : null}
        </GlassCard>
      </View>

      {notification.related_group_id ? (
        <View className="mb-4">
          <PrimaryButton
            label="View Group"
            onPress={() => router.push(`/(tabs)/groups/${notification.related_group_id}` as any)}
          />
        </View>
      ) : null}
    </>
  );
}

function BillImageDetailContent({ notification }: { notification: BackendNotification }) {
  const router = useRouter();
  const metadata = metaStrings(notification.metadata);
  
  return (
    <>
      <View className="mb-4">
        <GlassCard>
          {metadata.expense_title ? (
            <InfoRow
              label="Expense"
              value={metadata.expense_title}
              icon="restaurant"
              iconColor={colors.red}
              iconBg={colors.redBg}
            />
          ) : null}
          {metadata.bill_image ? (
            <>
              <Text className="mb-2 text-[13px] font-semibold text-[#5B7C93]">Bill Image</Text>
              {/* Static thumbnail: no image-viewer flow exists, so this must
                  not look tappable (was a pressable with no handler). */}
              <View className="flex-row items-center justify-between">
                <Image
                  source={{ uri: metadata.bill_image }}
                  className="h-14 w-14 rounded-xl"
                />
              </View>
            </>
          ) : null}
        </GlassCard>
      </View>

      {notification.related_group_id ? (
        <View className="mb-4">
          <PrimaryButton
            label="View in Group"
            onPress={() => router.push(`/(tabs)/groups/${notification.related_group_id}` as any)}
          />
        </View>
      ) : null}
    </>
  );
}

function GroupSettingsDetailContent({ notification }: { notification: BackendNotification }) {
  const router = useRouter();
  const metadata = metaStrings(notification.metadata);
  
  return (
    <>
      <View className="mb-4">
        <GlassCard>
          {metadata.group_name ? (
            <InfoRow
              label="Group"
              value={metadata.group_name}
              icon="airplane"
              iconColor={colors.teal}
              iconBg={colors.tealBg}
            />
          ) : null}
          {metadata.changed_setting ? (
            <InfoRow
              label="Setting changed"
              value={metadata.changed_setting}
              icon="settings"
              iconColor={colors.blue}
              iconBg={colors.blueBg}
              last
            />
          ) : null}
        </GlassCard>
      </View>

      {notification.related_group_id ? (
        <View className="mb-4">
          <PrimaryButton
            label="View Group Settings"
            onPress={() => router.push(`/(tabs)/groups/${notification.related_group_id}` as any)}
          />
        </View>
      ) : null}
    </>
  );
}

function SystemDetailContent({ notification }: { notification: BackendNotification }) {
  const metadata = metaStrings(notification.metadata);
  
  return (
    <>
      <View className="mb-4">
        <GlassCard>
          {metadata.action_url ? (
            <InfoRow
              label="Action"
              value={metadata.action_label ?? 'View'}
              icon="open"
              iconColor={colors.teal}
              iconBg={colors.tealBg}
            />
          ) : null}
        </GlassCard>
      </View>

      {/* metadata.action_url is an opaque backend string with no registered
          in-app handler: render disabled rather than a dead button. */}
      {metadata.action_url ? (
        <View className="mb-4">
          <PrimaryButton
            label={metadata.action_label ?? 'Open'}
            disabled
            onPress={() => {}}
          />
        </View>
      ) : null}
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   SCREEN
   ──────────────────────────────────────────────────────────────────────── */

export default function NotificationDetailScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const [notification, setNotification] = useState<BackendNotification | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const loadNotification = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setFailed(false);
    try {
      const result = await fetchNotificationById(id);
      setNotification(result);
    } catch (err) {
      if (err instanceof NotificationApiError && err.status === 404) {
        setFailed(true);
      }
      console.error('Failed to load notification detail:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadNotification();
  }, [loadNotification]);

  const handleBack = useCallback(() => {
    // Cold-link entry (notification tap with no history) has nothing to
    // pop: fall back to the list instead of a dead-end no-op.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/notifications' as any);
    }
  }, [router]);

  if (!notification) {
    return (
      <View className="flex-1">
        <ScreenBackground />
        <SafeAreaView edges={['top']} className="flex-1">
          {loading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color={colors.teal} />
              <Text className="mt-4 text-[14px] font-semibold text-[#0B3D62]">
                Loading details...
              </Text>
            </View>
          ) : failed ? (
            <View className="flex-1 items-center justify-center px-8">
              <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-white/40">
                <Ionicons name="cloud-offline-outline" size={32} color={colors.faint} />
              </View>
              <Text className="text-[16px] font-extrabold text-[#0B3D62]">
                Couldn't load details
              </Text>
              <Text className="mt-1 text-center text-[13px] text-[#5B7C93]">
                Check your connection and try again.
              </Text>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => void loadNotification()}
                className="mt-5 items-center rounded-full bg-[#149C73] px-6 py-3"
              >
                <Text className="text-[14px] font-extrabold text-white">Retry</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </SafeAreaView>
      </View>
    );
  }

  // Mark as read on mount if unread
  useEffect(() => {
    if (notification.read_at === null) {
      markNotificationAsRead(notification.id).catch(() => {});
    }
  }, [notification.id, notification.read_at]);

  const iconData = TYPE_ICONS[notification.type] ?? TYPE_ICONS.system;

  return (
    <View className="flex-1">
      <ScreenBackground />
      <SafeAreaView edges={['top']} className="flex-1">
        <DetailHeader title="Notification" onBack={handleBack} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          className="px-5"
          contentContainerClassName="pb-44"
        >
          {/* Category Header */}
          <View className="mb-4">
            <GlassCard>
              <View className="flex-row items-center">
                <View
                  className="mr-3.5 h-12 w-12 items-center justify-center rounded-full"
                  style={{ backgroundColor: iconData.bg }}
                >
                  <Ionicons name={iconData.icon} size={21} color={iconData.color} />
                </View>
                <View className="flex-1">
                  <Text className="text-[16px] font-extrabold text-[#0B3D62]">
                    {notification.title}
                  </Text>
                  <Text className="mt-1 text-[12px] text-[#8DA0B1]">
                    {formatDateTime(notification.created_at)}
                  </Text>
                </View>
              </View>
            </GlassCard>
          </View>

          {/* Detailed Content */}
          <View className="mb-4">
            <GlassCard>
              <Text className="mb-3 text-[13px] font-semibold text-[#5B7C93]">Details</Text>
              <Text className="text-[14px] leading-[20px] text-[#0B3D62]">
                {notification.message}
              </Text>
            </GlassCard>
          </View>

          {/* Type-specific content */}
          {(() => {
            switch (notification.type) {
              case 'expense_added':
                return <ExpenseDetailContent notification={notification} />;
              case 'settlement_completed':
                return <SettlementDetailContent notification={notification} />;
              case 'group_invitation':
                return <GroupInvitationDetailContent notification={notification} />;
              case 'group_comment':
                return <GroupCommentDetailContent notification={notification} />;
              case 'trip_report_ready':
                return <TripReportDetailContent notification={notification} />;
              case 'budget_alert':
                return <BudgetAlertDetailContent notification={notification} />;
              case 'member_joined_group':
                return <MemberJoinedDetailContent notification={notification} />;
              case 'bill_image_updated':
                return <BillImageDetailContent notification={notification} />;
              case 'group_settings_updated':
                return <GroupSettingsDetailContent notification={notification} />;
              case 'system':
                return <SystemDetailContent notification={notification} />;
              default:
                return null;
            }
          })()}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}