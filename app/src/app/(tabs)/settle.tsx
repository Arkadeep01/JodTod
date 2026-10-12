import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { PageTitle } from '../../components/ui/PageTitle';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { resolvePhotoUrl } from '../../services/profile.api';
import {
  fetchMyGroups,
  fetchGroupDetail,
  fetchGroupSuggestions,
  formatINR,
  type GroupSummary,
  type GroupDetail,
  type SettlementSuggestion,
} from '../../services/groups.api';
import {
  fetchGroupSettlementHistory,
  initiateSettlement,
  type Settlement,
} from '../../services/settlements.api';

/* ────────────────────────────────────────────────────────────────────────
   THEME + GLASS PRIMITIVES (unchanged visual language)
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
      <Image source={BACKGROUND_IMAGE} className="absolute inset-0 h-full w-full" resizeMode="cover" />
      <View className="absolute inset-0 bg-white/10" pointerEvents="none" />
    </>
  );
}

function GlassLayers({ radius = 24 }: { radius?: number }) {
  return (
    <>
      <BlurView intensity={40} tint="default" style={[StyleSheet.absoluteFill, { borderRadius: radius }]} />
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

function GlassCard({ children, radius = 24, style }: { children: React.ReactNode; radius?: number; style?: any }) {
  return (
    <View className="rounded-[24px]" style={[cardShadow, glassBg, style]}>
      <View className="overflow-hidden rounded-[24px] border border-white/60">
        <GlassLayers radius={radius} />
        <View className="p-4">{children}</View>
      </View>
    </View>
  );
}

function InfoRow({
  label,
  value,
  avatarUri,
  valueColor,
  last = false,
}: {
  label: string;
  value: string;
  avatarUri?: string;
  valueColor?: string;
  last?: boolean;
}) {
  return (
    <View className={`flex-row items-center justify-between py-3 ${last ? '' : 'border-b border-white/40'}`}>
      <Text className="text-[13px] font-semibold text-[#5B7C93]">{label}</Text>
      <View className="flex-row items-center">
        {avatarUri ? <Image source={{ uri: avatarUri }} className="mr-2 h-6 w-6 rounded-full" /> : null}
        <Text className="text-[14px] font-bold" style={{ color: valueColor ?? colors.navy }}>{value}</Text>
      </View>
    </View>
  );
}

function DetailHeader({ title, onBack, right }: { title: string; onBack: () => void; right?: React.ReactNode }) {
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
        <Text className="ml-3 text-[19px] font-extrabold text-[#0B3D62]">{title}</Text>
      </View>
      {right}
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

function OutlineButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      className="items-center rounded-full border-2 py-3.5"
      style={{ borderColor: colors.teal }}
    >
      <Text className="text-[15px] font-extrabold" style={{ color: colors.teal }}>{label}</Text>
    </TouchableOpacity>
  );
}

function InitialAvatar({ name, size = 36 }: { name: string; size?: number }) {
  const initial = (name.trim()[0] ?? '•').toUpperCase();
  return (
    <View
      className="items-center justify-center rounded-full bg-white/60"
      style={{ width: size, height: size }}
    >
      <Text className="font-extrabold text-[#0B3D62]" style={{ fontSize: size * 0.42 }}>
        {initial}
      </Text>
    </View>
  );
}

function MemberAvatar({ uri, name, size = 36 }: { uri: string | null; name: string; size?: number }) {
  const resolved = uri ? (resolvePhotoUrl(uri) ?? uri) : null;
  if (resolved) {
    return (
      <Image
        source={{ uri: resolved }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }
  return <InitialAvatar name={name} size={size} />;
}

/* ────────────────────────────────────────────────────────────────────────
   DATA (live backend — no mock groups, balances, or history)
   ──────────────────────────────────────────────────────────────────────── */

type GroupStatus = 'pending' | 'settled' | 'archived';

type SettleGroup = {
  id: string;
  name: string;
  image: string | null;
  members: number;
  status: GroupStatus;
  pendingCount: number;
  youOwe: string;
  youAreOwed: string;
  currency: string;
};

function toSettleGroup(g: GroupSummary): SettleGroup {
  return {
    id: g.id,
    name: g.name,
    image: g.image_url,
    members: g.member_count,
    status: g.lifecycle === 'archived' ? 'archived' : g.settlement_status === 'settled' ? 'settled' : 'pending',
    pendingCount: g.pending_count,
    youOwe: g.you_owe,
    youAreOwed: g.you_are_owed,
    currency: g.currency,
  };
}

const tabOptions: { key: 'all' | GroupStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'settled', label: 'Settled' },
  { key: 'archived', label: 'Archived' },
];

const paymentMethods: { key: string; icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; disabled?: boolean }[] = [
  { key: 'paid', icon: 'checkmark-circle', title: 'Mark as Paid', subtitle: 'I have paid outside the app' },
  { key: 'upi', icon: 'card', title: 'Pay via UPI (Future)', subtitle: 'Pay directly through UPI', disabled: true },
  { key: 'partial', icon: 'radio-button-off', title: 'Record Partial Payment', subtitle: 'Enter a custom amount' },
  { key: 'note', icon: 'document-text', title: 'Add a Note', subtitle: 'Record payment details manually' },
];

function todayLabel(): string {
  return new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function historySectionLabel(value: string | null): string {
  if (!value) return 'Earlier';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Earlier';
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function historyTimeLabel(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

/* ────────────────────────────────────────────────────────────────────────
   NAVIGATION
   ──────────────────────────────────────────────────────────────────────── */

type Screen =
  | { name: 'main' }
  | { name: 'overview'; group: SettleGroup }
  | { name: 'suggestions'; group: SettleGroup }
  | { name: 'options'; group: SettleGroup; payTo: string; payToId: string; payToAvatar: string | null; amount: string }
  | { name: 'confirm'; group: SettleGroup; payTo: string; payToId: string; payToAvatar: string | null; amount: string; method: string; methodKey: string }
  | { name: 'success'; group: SettleGroup; payTo: string; amount: string }
  | { name: 'updated'; group: SettleGroup }
  | { name: 'history'; group: SettleGroup }
  | { name: 'manual'; group: SettleGroup; payTo: string; payToId: string; payToAvatar: string | null; amount: string }
  | { name: 'allSettled'; group: SettleGroup };

/* ────────────────────────────────────────────────────────────────────────
   SCREENS
   ──────────────────────────────────────────────────────────────────────── */

function MainScreen({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const [tab, setTab] = useState<'all' | GroupStatus>('all');
  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState<SettleGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchMyGroups();
      if (!mountedRef.current) return;
      setGroups(rows.map(toSettleGroup));
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Could not load groups.');
      setGroups([]);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  // Single focus-driven load (focus fires on mount too — no double fetch).
  useFocusEffect(
    useCallback(() => {
      mountedRef.current = true;
      void load();
      return () => {
        mountedRef.current = false;
      };
    }, [load]),
  );

  const filtered = groups.filter((g) => {
    const matchesTab = tab === 'all' || g.status === tab;
    const matchesQuery = query.trim().length === 0 || g.name.toLowerCase().includes(query.trim().toLowerCase());
    return matchesTab && matchesQuery;
  });

  const openGroup = (g: SettleGroup) => {
    if (g.status === 'settled') onNavigate({ name: 'allSettled', group: g });
    else onNavigate({ name: 'overview', group: g });
  };

  return (
    <View className="flex-1">
      <ScreenBackground />
      <SafeAreaView edges={['top']} className="flex-1">
        <View className="px-5 pb-3 pt-5">
          <PageTitle>Settle</PageTitle>
        </View>

        <View className="mx-5 mb-3 rounded-full" style={[cardShadow, glassBg]}>
          <View className="h-12 flex-row items-center overflow-hidden rounded-full border border-white/70 px-4">
            <GlassLayers radius={24} />
            <View className="absolute inset-0 bg-white/50" />
            <Ionicons name="search" size={18} color={colors.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search groups..."
              placeholderTextColor={colors.faint}
              className="ml-2.5 flex-1 text-[14px] text-[#0B3D62]"
            />
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4 flex-grow-0" contentContainerClassName="px-5 pr-8">
          {tabOptions.map((t) => {
            const active = tab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                activeOpacity={0.85}
                onPress={() => setTab(t.key)}
                className="mr-2 items-center overflow-hidden rounded-full border px-4 py-2.5"
                style={[
                  { flexShrink: 0 },
                  active
                    ? { borderColor: 'transparent', backgroundColor: colors.teal, ...cardShadow, shadowColor: colors.teal, shadowOpacity: 0.35 }
                    : { borderColor: 'rgba(255,255,255,0.7)', backgroundColor: 'rgba(255,255,255,0.45)' },
                ]}
              >
                {!active ? <GlassLayers radius={24} /> : null}
                <Text className={`text-[13.5px] font-bold ${active ? 'text-white' : 'text-[#3E6E8E]'}`}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <ScrollView showsVerticalScrollIndicator={false} className="px-5" contentContainerClassName="pb-36">
          {loading ? (
            <View className="items-center py-16">
              <ActivityIndicator size="large" color={colors.navy} />
              <Text className="mt-3 text-[13px]" style={{ color: colors.muted }}>Loading groups…</Text>
            </View>
          ) : error ? (
            <GlassCard>
              <View className="items-center py-8">
                <Ionicons name="cloud-offline-outline" size={36} color={colors.red} />
                <Text className="mt-2 text-center text-[15px] font-extrabold text-[#0B3D62]">Could not load groups</Text>
                <Text className="mt-1 px-4 text-center text-[12px] text-[#5B7C93]">{error}</Text>
                <View className="mt-4 w-32">
                  <PrimaryButton label="Retry" onPress={() => void load()} />
                </View>
              </View>
            </GlassCard>
          ) : filtered.length === 0 ? (
            <GlassCard>
              <View className="items-center py-10">
                <Ionicons name="checkmark-circle-outline" size={40} color={colors.teal} />
                <Text className="mt-2 text-center text-[15px] font-extrabold text-[#0B3D62]">No groups need settlement</Text>
                <Text className="mt-1 px-6 text-center text-[12px] text-[#5B7C93]">
                  {groups.length === 0
                    ? 'Groups you join will appear here with live balances.'
                    : 'Nothing matches this filter.'}
                </Text>
              </View>
            </GlassCard>
          ) : (
            filtered.map((g) => (
              <TouchableOpacity key={g.id} activeOpacity={0.85} onPress={() => openGroup(g)} className="mb-3">
                <GlassCard>
                  <View className="flex-row items-center">
                    {g.image ? (
                      <Image source={{ uri: g.image }} className="mr-3.5 h-14 w-14 rounded-2xl" />
                    ) : (
                      <View className="mr-3.5">
                        <InitialAvatar name={g.name} size={56} />
                      </View>
                    )}
                    <View className="flex-1">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-[15px] font-extrabold text-[#0B3D62]">{g.name}</Text>
                        <View
                          className="rounded-full px-2.5 py-1"
                          style={{ backgroundColor: g.status === 'settled' ? colors.tealBg : colors.orangeBg }}
                        >
                          <Text
                            className="text-[10.5px] font-extrabold"
                            style={{ color: g.status === 'settled' ? colors.teal : colors.orange }}
                          >
                            {g.status === 'settled'
                              ? 'All settled'
                              : g.status === 'archived'
                                ? 'Archived'
                                : `${g.pendingCount} pending`}
                          </Text>
                        </View>
                      </View>
                      <Text className="mt-0.5 text-[12px] text-[#5B7C93]">
                        {g.members === 1 ? '1 member' : `${g.members} members`}
                      </Text>
                      {g.youOwe !== '0.00' ? (
                        <View className="mt-1.5 flex-row items-center justify-between">
                          <Text className="text-[11px] font-semibold text-[#8DA0B1]">You owe</Text>
                          <Text className="text-[15px] font-extrabold" style={{ color: colors.red }}>
                            {formatINR(g.youOwe)}
                          </Text>
                        </View>
                      ) : g.youAreOwed !== '0.00' ? (
                        <View className="mt-1.5 flex-row items-center justify-between">
                          <Text className="text-[11px] font-semibold text-[#8DA0B1]">You are owed</Text>
                          <Text className="text-[15px] font-extrabold" style={{ color: colors.teal }}>
                            {formatINR(g.youAreOwed)}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </GlassCard>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

type BalanceRow = {
  userId: string;
  name: string;
  avatar: string | null;
  status: 'owesYou' | 'youOwe' | 'settled';
  amount: string;
  isYou: boolean;
};

function GroupOverviewScreen({
  group,
  onBack,
  onSettleNow,
  onHistory,
  title,
}: {
  group: SettleGroup;
  onBack: () => void;
  onSettleNow?: () => void;
  onHistory?: () => void;
  title?: string;
}) {
  const { user } = useAuth();
  const [isBalanceExpanded, setIsBalanceExpanded] = useState(true);
  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchGroupDetail(group.id);
      if (!mountedRef.current) return;
      if (!data) {
        setError('Group not found.');
        setDetail(null);
      } else {
        setDetail(data);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Could not load group.');
      setDetail(null);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [group.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const myId = user?.id ?? null;
  const myNet = detail?.my_net ?? '0.00';
  const myNetNum = Number(myNet);
  const owed = myNetNum > 0 ? myNetNum : 0;
  const owe = myNetNum < 0 ? -myNetNum : 0;

  const balances: BalanceRow[] = (detail?.members ?? []).map((m) => {
    const net = Number(m.net_balance);
    return {
      userId: m.user_id,
      name: m.display_name,
      avatar: m.avatar_url,
      status: net > 0 ? 'owesYou' : net < 0 ? 'youOwe' : 'settled',
      amount: formatINR(m.net_balance),
      isYou: myId !== null && m.user_id === myId,
    };
  });

  return (
    <View className="flex-1">
      <ScreenBackground />
      <SafeAreaView edges={['top']} className="flex-1">
        <View className="flex-row items-center justify-between px-5 pb-2 pt-3">
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
          {onHistory ? (
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={onHistory}
              className="h-10 w-10 items-center justify-center rounded-full border border-white/60 overflow-hidden"
              style={[cardShadow, glassBg]}
            >
              <GlassLayers radius={20} />
              <View className="absolute inset-0 bg-white/40" />
              <Ionicons name="time" size={18} color={colors.navy} />
            </TouchableOpacity>
          ) : null}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} className="px-5" contentContainerClassName="pb-36">
          {loading ? (
            <View className="items-center py-16">
              <ActivityIndicator size="large" color={colors.navy} />
              <Text className="mt-3 text-[13px]" style={{ color: colors.muted }}>Loading balances…</Text>
            </View>
          ) : error || !detail ? (
            <GlassCard>
              <View className="items-center py-8">
                <Ionicons name="alert-circle-outline" size={36} color={colors.red} />
                <Text className="mt-2 text-center text-[15px] font-extrabold text-[#0B3D62]">{error ?? 'Group not found.'}</Text>
                <View className="mt-4 w-32">
                  <PrimaryButton label="Retry" onPress={() => void load()} />
                </View>
              </View>
            </GlassCard>
          ) : (
            <>
              <View className="mb-4 items-center overflow-hidden rounded-[24px] border border-white/60 bg-white/40 py-8" style={cardShadow}>
                <InitialAvatar name={detail.name} size={64} />
              </View>

              <Text className="text-[20px] font-extrabold text-[#0B3D62]">{title ?? detail.name}</Text>
              <View className="mb-4 mt-1.5 flex-row items-center">
                <Ionicons name="people" size={13} color={colors.faint} />
                <Text className="ml-1.5 text-[12px] text-[#5B7C93]">
                  {detail.member_count === 1 ? '1 member' : `${detail.member_count} members`}
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setIsBalanceExpanded(!isBalanceExpanded)}
                className="mb-4 flex-row items-center justify-between rounded-2xl border border-white/60 bg-white/35 px-4 py-3"
              >
                <Text className="text-[13.5px] font-bold text-[#0B3D62]">Overall Balance</Text>
                <Ionicons name={isBalanceExpanded ? "chevron-up" : "chevron-down"} size={16} color={colors.navySoft} />
              </TouchableOpacity>

              {isBalanceExpanded && (
                <View className="mb-5 flex-row gap-3">
                  <View className="flex-1 rounded-2xl px-4 py-3.5" style={{ backgroundColor: colors.tealBg }}>
                    <Text className="text-[12px] font-bold" style={{ color: colors.teal }}>You&apos;re owed</Text>
                    <Text className="mt-1 text-[20px] font-extrabold" style={{ color: colors.teal }}>{formatINR(owed.toFixed(2))}</Text>
                  </View>
                  <View className="flex-1 rounded-2xl px-4 py-3.5" style={{ backgroundColor: colors.redBg }}>
                    <Text className="text-[12px] font-bold" style={{ color: colors.red }}>You owe</Text>
                    <Text className="mt-1 text-[20px] font-extrabold" style={{ color: colors.red }}>{formatINR(owe.toFixed(2))}</Text>
                  </View>
                </View>
              )}

              <Text className="mb-2 text-[14px] font-extrabold text-[#0B3D62]">Member Balances</Text>
              <GlassCard>
                {balances.map((b, i) => (
                  <View key={b.userId} className={`flex-row items-center justify-between py-3 ${i < balances.length - 1 ? 'border-b border-white/40' : ''}`}>
                    <View className="flex-row items-center">
                      <View className="mr-2.5">
                        <MemberAvatar uri={b.avatar} name={b.name} size={32} />
                      </View>
                      <View>
                        <Text className="text-[14px] font-bold text-[#0B3D62]">
                          {b.name}{b.isYou ? ' (you)' : ''}
                        </Text>
                        <Text className="text-[11px] text-[#8DA0B1]">
                          {b.status === 'owesYou' ? 'gets back' : b.status === 'youOwe' ? 'owes' : 'settled'}
                        </Text>
                      </View>
                    </View>
                    <Text
                      className="text-[14px] font-extrabold"
                      style={{ color: b.status === 'owesYou' ? colors.teal : b.status === 'youOwe' ? colors.red : colors.faint }}
                    >
                      {b.amount}
                    </Text>
                  </View>
                ))}
              </GlassCard>

              {onSettleNow && group.status !== 'archived' && detail.settlement_status !== 'settled' ? (
                <View className="mt-5">
                  <PrimaryButton label="Settle Now" onPress={onSettleNow} />
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function SuggestionsScreen({ group, onBack, onProceed }: { group: SettleGroup; onBack: () => void; onProceed: (payToId: string, payTo: string, payToAvatar: string | null, amount: string) => void }) {
  const { user } = useAuth();
  const [selected, setSelected] = useState(0);
  const [suggestions, setSuggestions] = useState<SettlementSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchGroupSuggestions(group.id);
      if (!mountedRef.current) return;
      setSuggestions(rows);
      setSelected(0);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Could not load suggestions.');
      setSuggestions([]);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [group.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const myId = user?.id ?? null;

  return (
    <View className="flex-1">
      <ScreenBackground />
      <SafeAreaView edges={['top']} className="flex-1">
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
            <Text className="ml-3 text-[19px] font-extrabold text-[#0B3D62]">Settle Up</Text>
          </View>
          <View className="h-10 w-10 items-center justify-center rounded-full border border-white/60 overflow-hidden" style={[cardShadow, glassBg]}>
            <GlassLayers radius={20} />
            <View className="absolute inset-0 bg-white/40" />
            <Ionicons name="settings-outline" size={17} color={colors.navy} />
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} className="px-5" contentContainerClassName="pb-36">
          {loading ? (
            <View className="items-center py-16">
              <ActivityIndicator size="large" color={colors.navy} />
              <Text className="mt-3 text-[13px]" style={{ color: colors.muted }}>Calculating best plan…</Text>
            </View>
          ) : error ? (
            <GlassCard>
              <View className="items-center py-8">
                <Ionicons name="alert-circle-outline" size={36} color={colors.red} />
                <Text className="mt-2 text-center text-[15px] font-extrabold text-[#0B3D62]">{error}</Text>
                <View className="mt-4 w-32">
                  <PrimaryButton label="Retry" onPress={() => void load()} />
                </View>
              </View>
            </GlassCard>
          ) : suggestions.length === 0 ? (
            <GlassCard>
              <View className="items-center py-10">
                <Ionicons name="checkmark-circle-outline" size={40} color={colors.teal} />
                <Text className="mt-2 text-center text-[15px] font-extrabold text-[#0B3D62]">Nothing to settle</Text>
                <Text className="mt-1 px-6 text-center text-[12px] text-[#5B7C93]">
                  Every balance in this group is zero.
                </Text>
              </View>
            </GlassCard>
          ) : (
            <>
              <View className="mb-4 flex-row items-start rounded-2xl px-4 py-3.5" style={{ backgroundColor: colors.blueBg }}>
                <Ionicons name="information-circle" size={18} color={colors.blue} style={{ marginTop: 1 }} />
                <Text className="ml-2.5 flex-1 text-[13px] leading-[18px]" style={{ color: '#1E4E8C' }}>
                  We found the best way to settle up with minimum transactions.
                </Text>
              </View>

              <Text className="mb-2 text-[14px] font-extrabold text-[#0B3D62]">{suggestions.length} payments needed</Text>
              <GlassCard>
                {suggestions.map((p, i) => {
                  const mine = myId !== null && p.payer_user_id === myId;
                  return (
                    <TouchableOpacity
                      key={`${p.payer_user_id}-${p.receiver_user_id}-${p.amount}`}
                      activeOpacity={mine ? 0.7 : 1}
                      onPress={() => {
                        if (mine) setSelected(i);
                      }}
                      className={`flex-row items-center justify-between py-3 ${i < suggestions.length - 1 ? 'border-b border-white/40' : ''}`}
                      style={mine ? undefined : { opacity: 0.65 }}
                    >
                      <View className="flex-row items-center">
                        <View className="mr-2.5">
                          <MemberAvatar uri={p.payer_avatar_url} name={p.payer_name} size={36} />
                        </View>
                        <View>
                          <Text className="text-[14px] font-bold text-[#0B3D62]">{p.payer_name} → {p.receiver_name}</Text>
                          <Text className="text-[14px] font-extrabold" style={{ color: colors.red }}>{formatINR(p.amount)}</Text>
                          {!mine ? (
                            <Text className="text-[11px] text-[#8DA0B1]">Only {p.payer_name} can mark this paid</Text>
                          ) : null}
                        </View>
                      </View>
                      {mine ? (
                        <View className={`h-5 w-5 items-center justify-center rounded-full border-2 ${selected === i ? 'border-[#149C73]' : 'border-[#C7D6DF]'}`}>
                          {selected === i ? <View className="h-2.5 w-2.5 rounded-full bg-[#149C73]" /> : null}
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </GlassCard>

              <View className="mt-4 rounded-2xl px-4 py-3.5" style={{ backgroundColor: colors.tealBg }}>
                <Text className="text-[12.5px] leading-[18px]" style={{ color: colors.teal }}>
                  This settles all balances in the group with just {suggestions.length} transaction{suggestions.length === 1 ? '' : 's'}.
                </Text>
              </View>

              <View className="mt-6 flex-row items-center justify-between">
                <Text className="text-[13px] font-semibold text-[#5B7C93]">Total Transactions</Text>
                <Text className="text-[22px] font-extrabold text-[#0B3D62]">{suggestions.length}</Text>
              </View>

              {(() => {
                const mine = suggestions.filter((s) => myId !== null && s.payer_user_id === myId);
                if (mine.length === 0) {
                  return (
                    <View className="mt-4 rounded-2xl px-4 py-3.5" style={{ backgroundColor: colors.orangeBg }}>
                      <Text className="text-[12.5px] leading-[18px]" style={{ color: colors.orange }}>
                        None of these payments are yours to make — you are owed money in this group.
                      </Text>
                    </View>
                  );
                }
                const chosen = mine[Math.min(selected, mine.length - 1)] ?? mine[0];
                return (
                  <View className="mt-4">
                    <PrimaryButton
                      label="Proceed to Settle"
                      onPress={() => onProceed(chosen.receiver_user_id, chosen.receiver_name, chosen.receiver_avatar_url, chosen.amount)}
                    />
                  </View>
                );
              })()}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function SettleOptionsScreen({
  group,
  payTo,
  payToAvatar,
  amount,
  onBack,
  onNext,
  onPartial,
}: {
  group: SettleGroup;
  payTo: string;
  payToAvatar: string | null;
  amount: string;
  onBack: () => void;
  onNext: (methodKey: string, methodTitle: string) => void;
  onPartial: () => void;
}) {
  const [method, setMethod] = useState('paid');

  return (
    <View className="flex-1">
      <ScreenBackground />
      <SafeAreaView edges={['top']} className="flex-1">
        <DetailHeader title={`Settle with ${payTo}`} onBack={onBack} />

        <ScrollView showsVerticalScrollIndicator={false} className="px-5" contentContainerClassName="pb-36">
          <View className="mb-5">
            <GlassCard>
              <View className="flex-row items-center">
                <View className="mr-3.5">
                  <MemberAvatar uri={payToAvatar} name={payTo} size={48} />
                </View>
                <View>
                  <Text className="text-[16px] font-extrabold text-[#0B3D62]">{payTo}</Text>
                  <Text className="mt-1 text-[20px] font-extrabold" style={{ color: colors.red }}>{formatINR(amount)}</Text>
                  <Text className="text-[11px] text-[#8DA0B1]">You owe this amount</Text>
                </View>
              </View>
            </GlassCard>
          </View>

          <Text className="mb-2 text-[14px] font-extrabold text-[#0B3D62]">Choose Payment Method</Text>
          {paymentMethods.map((m) => {
            const active = method === m.key;
            return (
              <TouchableOpacity
                key={m.key}
                activeOpacity={m.disabled ? 1 : 0.8}
                disabled={m.disabled}
                onPress={() => (m.key === 'partial' ? onPartial() : setMethod(m.key))}
                className="mb-3"
                style={m.disabled ? { opacity: 0.5 } : undefined}
              >
                <View
                  className="rounded-2xl border p-4"
                  style={[
                    glassBg,
                    cardShadow,
                    { borderColor: active ? colors.teal : 'rgba(255,255,255,0.6)', borderWidth: active ? 1.5 : 1 },
                  ]}
                >
                  <View className="overflow-hidden rounded-2xl">
                    <GlassLayers radius={16} />
                    <View className="flex-row items-center px-0.5 py-0.5">
                      <View
                        className="mr-3 h-9 w-9 items-center justify-center rounded-full"
                        style={{ backgroundColor: active ? colors.tealBg : 'rgba(255,255,255,0.6)' }}
                      >
                        <Ionicons name={m.icon} size={17} color={active ? colors.teal : colors.navySoft} />
                      </View>
                      <View className="flex-1">
                        <Text className="text-[14px] font-bold text-[#0B3D62]">{m.title}</Text>
                        <Text className="mt-0.5 text-[11.5px] text-[#5B7C93]">{m.subtitle}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}

          <View className="mt-2">
            <PrimaryButton label="Next" onPress={() => onNext(method, (paymentMethods.find((m: (typeof paymentMethods)[number]) => m.key === method)?.title ?? 'Mark as Paid'))} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function ConfirmSettlementScreen({
  group,
  payTo,
  payToId,
  payToAvatar,
  amount,
  method,
  methodKey,
  onBack,
  onConfirm,
}: {
  group: SettleGroup;
  payTo: string;
  payToId: string;
  payToAvatar: string | null;
  amount: string;
  method: string;
  methodKey: string;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const idempotencyKey = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const row = await initiateSettlement({
        group_id: group.id,
        receiver_user_id: payToId,
        amount,
        payment_method: 'marked_as_paid',
        note: note.trim() || undefined,
        idempotency_key: idempotencyKey,
      });
      if (!row) {
        setError('Could not record the payment. Please try again.');
        return;
      }
      void methodKey;
      onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record the payment.');
    } finally {
      setSubmitting(false);
    }
  }, [submitting, group.id, payToId, amount, note, methodKey, onConfirm]);

  return (
    <View className="flex-1">
      <ScreenBackground />
      <SafeAreaView edges={['top']} className="flex-1">
        <DetailHeader title="Confirm Payment" onBack={onBack} />

        <ScrollView showsVerticalScrollIndicator={false} className="px-5" contentContainerClassName="pb-36">
          <View className="mb-4">
            <GlassCard>
              <View className="flex-row items-center">
                <View className="mr-3.5">
                  <MemberAvatar uri={payToAvatar} name={payTo} size={48} />
                </View>
                <View>
                  <Text className="text-[16px] font-extrabold text-[#0B3D62]">{payTo}</Text>
                  <Text className="mt-1 text-[20px] font-extrabold" style={{ color: colors.red }}>{formatINR(amount)}</Text>
                  <Text className="text-[11px] text-[#8DA0B1]">You owe this amount</Text>
                </View>
              </View>
            </GlassCard>
          </View>

          <View className="mb-4">
            <GlassCard>
              <InfoRow label="Payment method" value={method} />
              <InfoRow label="Date" value={todayLabel()} last />
            </GlassCard>
          </View>

          <Text className="mb-2 text-[13px] font-semibold text-[#5B7C93]">Note (optional)</Text>
          <View className="mb-2 rounded-2xl border border-white/60 bg-white/35 px-4 py-3.5">
            <TextInput
              value={note}
              onChangeText={(t) => t.length <= 200 && setNote(t)}
              placeholder="Add a note..."
              placeholderTextColor={colors.faint}
              multiline
              className="min-h-[44px] text-[14px] text-[#0B3D62]"
            />
          </View>
          <Text className="mb-6 text-right text-[11px] text-[#8DA0B1]">{note.length}/200</Text>

          {error ? (
            <Text className="mb-3 text-center text-[13px] font-semibold" style={{ color: colors.red }}>
              {error}
            </Text>
          ) : null}

          {submitting ? (
            <View className="items-center py-4">
              <ActivityIndicator size="small" color={colors.teal} />
            </View>
          ) : (
            <PrimaryButton label="Confirm & Settle" onPress={() => void submit()} />
          )}

          <Text className="mt-3 text-center text-[11.5px] leading-[17px] text-[#5B7C93]">
            {payTo} will confirm receipt in the app. The balance updates only after confirmation.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function SuccessScreen({ payTo, amount, onBack, onViewUpdated, onSettleAnother }: { payTo: string; amount: string; onBack: () => void; onViewUpdated: () => void; onSettleAnother: () => void }) {
  return (
    <View className="flex-1">
      <ScreenBackground />
      <SafeAreaView edges={['top']} className="flex-1">
        <View className="px-5 pb-2 pt-3">
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
        </View>

        <View className="flex-1 items-center justify-center px-8">
          <View className="mb-6 h-28 w-28 items-center justify-center rounded-full" style={{ backgroundColor: colors.teal }}>
            <Ionicons name="checkmark" size={56} color="#FFFFFF" />
          </View>
          <Text className="text-[22px] font-extrabold text-[#0B3D62]">Payment Marked!</Text>
          <Text className="mt-2 text-center text-[14px] leading-[20px] text-[#5B7C93]">
            {formatINR(amount)} marked as paid to {payTo}. {payTo} will confirm receipt — the balance updates then.
          </Text>
        </View>

        <View className="gap-3 px-5 pb-8">
          <PrimaryButton label="View Updated Balances" onPress={onViewUpdated} />
          <OutlineButton label="Settle Another" onPress={onSettleAnother} />
        </View>
      </SafeAreaView>
    </View>
  );
}

function SettlementHistoryScreen({ group, onBack }: { group: SettleGroup; onBack: () => void }) {
  const { user } = useAuth();
  const [filter, setFilter] = useState<'All' | 'Sent' | 'Received'>('All');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [items, setItems] = useState<Settlement[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const PAGE = 20;
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadPage = useCallback(async (offset: number) => {
    if (offset === 0) setLoading(true);
    else setLoadingMore(true);
    if (offset === 0) setError(null);
    try {
      const page = await fetchGroupSettlementHistory(group.id, PAGE, offset);
      if (!mountedRef.current) return;
      setItems((prev) => (offset === 0 ? page.settlements : [...prev, ...page.settlements]));
      setTotal(page.total);
    } catch (err) {
      if (!mountedRef.current) return;
      if (offset === 0) {
        setError(err instanceof Error ? err.message : 'Could not load history.');
        setItems([]);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [group.id]);

  useEffect(() => {
    void loadPage(0);
  }, [loadPage]);

  const myId = user?.id ?? null;
  const visible = items.filter((item) => {
    if (filter === 'All') return true;
    const sent = myId !== null && item.payer_user_id === myId;
    if (filter === 'Sent') return sent;
    return !sent;
  });

  const sections: { date: string; items: Settlement[] }[] = [];
  for (const item of visible) {
    const label = historySectionLabel(item.confirmed_at ?? item.created_at);
    const last = sections[sections.length - 1];
    if (last && last.date === label) last.items.push(item);
    else sections.push({ date: label, items: [item] });
  }

  return (
    <View className="flex-1">
      <ScreenBackground />
      <SafeAreaView edges={['top']} className="flex-1">
        <DetailHeader title="Settlement History" onBack={onBack} />

        <ScrollView showsVerticalScrollIndicator={false} className="px-5" contentContainerClassName="pb-36">
          <View className="relative z-50 mb-5">
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setIsFilterOpen(!isFilterOpen)}
              className="flex-row items-center justify-between rounded-[16px] border border-white/60 bg-white/35 px-4 py-3"
            >
              <Text className="text-[13.5px] font-bold text-[#0B3D62]">{filter}</Text>
              <Ionicons name={isFilterOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.navySoft} />
            </TouchableOpacity>

            {isFilterOpen && (
              <View
                className="absolute left-0 right-0 top-[52px] rounded-[16px]"
                style={[cardShadow, glassBg, { zIndex: 100 }]}
              >
                <View className="overflow-hidden rounded-[16px] border border-white/60">
                  <GlassLayers radius={16} />

                  <View className="relative z-10 py-1">
                    {['All', 'Sent', 'Received'].map((opt, index) => (
                      <TouchableOpacity
                        key={opt}
                        activeOpacity={0.7}
                        onPress={() => {
                          setFilter(opt as 'All' | 'Sent' | 'Received');
                          setIsFilterOpen(false);
                        }}
                        className={`px-4 py-3.5 ${index !== 2 ? 'border-b border-white/40' : ''}`}
                      >
                        <Text className={`text-[14px] font-bold ${filter === opt ? 'text-[#149C73]' : 'text-[#0B3D62]'}`}>
                          {opt}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            )}
          </View>

          <View className="-z-10">
            {loading ? (
              <View className="items-center py-12">
                <ActivityIndicator size="large" color={colors.navy} />
              </View>
            ) : error ? (
              <View className="mt-6 items-center">
                <Ionicons name="alert-circle-outline" size={28} color={colors.red} />
                <Text className="mt-2 text-[14px] font-bold text-[#0B3D62]">{error}</Text>
                <View className="mt-4 w-32">
                  <PrimaryButton label="Retry" onPress={() => void loadPage(0)} />
                </View>
              </View>
            ) : items.length === 0 ? (
              <View className="mt-6 items-center">
                <View className="mb-3 h-16 w-16 items-center justify-center rounded-full bg-white/40">
                  <Ionicons name="receipt-outline" size={24} color={colors.faint} />
                </View>
                <Text className="text-[15px] font-extrabold text-[#0B3D62]">No settlement history</Text>
                <Text className="mt-1 text-[12px] text-[#5B7C93]">Confirmed payments will appear here.</Text>
              </View>
            ) : sections.length === 0 ? (
              <View className="mt-6 items-center">
                <View className="mb-3 h-16 w-16 items-center justify-center rounded-full bg-white/40">
                  <Ionicons name="search" size={24} color={colors.faint} />
                </View>
                <Text className="text-[15px] font-extrabold text-[#0B3D62]">No settlements found</Text>
              </View>
            ) : (
              <>
                {sections.map((section) => (
                  <View key={section.date} className="mb-5">
                    <Text className="mb-2 text-[13px] font-bold text-[#5B7C93]">{section.date}</Text>
                    <GlassCard>
                      {section.items.map((item, i) => {
                        const sent = myId !== null && item.payer_user_id === myId;
                        const from = sent ? 'You' : item.payer_name;
                        const to = sent ? item.receiver_name : 'You';
                        return (
                          <View
                            key={item.id}
                            className={`flex-row items-center justify-between py-3 ${i < section.items.length - 1 ? 'border-b border-white/40' : ''}`}
                          >
                            <View className="flex-row items-center">
                              <View className="mr-3 h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: colors.tealBg }}>
                                <Ionicons name="checkmark" size={17} color={colors.teal} />
                              </View>
                              <View>
                                <Text className="text-[14px] font-bold text-[#0B3D62]">{from} → {to}</Text>
                                <Text className="text-[11px] text-[#8DA0B1]">Marked as paid • {historyTimeLabel(item.confirmed_at ?? item.created_at)}</Text>
                              </View>
                            </View>
                            <View className="flex-row items-center">
                              <Text className="mr-1.5 text-[14px] font-extrabold" style={{ color: colors.teal }}>{formatINR(item.amount)}</Text>
                            </View>
                          </View>
                        );
                      })}
                    </GlassCard>
                  </View>
                ))}

                {items.length < total ? (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    disabled={loadingMore}
                    onPress={() => void loadPage(items.length)}
                    className="items-center rounded-full border-2 py-3"
                    style={{ borderColor: colors.teal }}
                  >
                    {loadingMore ? (
                      <ActivityIndicator size="small" color={colors.teal} />
                    ) : (
                      <Text className="text-[13px] font-bold" style={{ color: colors.teal }}>
                        Load more ({total - items.length} remaining)
                      </Text>
                    )}
                  </TouchableOpacity>
                ) : null}
              </>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function ManualSettlementScreen({ group, payTo, payToId, payToAvatar, amount, onBack, onMarkPaid }: { group: SettleGroup; payTo: string; payToId: string; payToAvatar: string | null; amount: string; onBack: () => void; onMarkPaid: () => void }) {
  const [value, setValue] = useState('150');
  const [note, setNote] = useState('Paid partial amount');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chips = ['50', '100', '200', Number(amount).toFixed(2)];

  const submit = useCallback(async () => {
    if (submitting) return;
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      setError('Enter an amount greater than 0.');
      return;
    }
    if (numeric > Number(amount)) {
      setError(`Amount cannot exceed the outstanding ${formatINR(amount)}.`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const idempotencyKey = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const row = await initiateSettlement({
        group_id: group.id,
        receiver_user_id: payToId,
        amount: numeric.toFixed(2),
        payment_method: 'partial_payment',
        note: note.trim() || undefined,
        idempotency_key: idempotencyKey,
      });
      if (!row) {
        setError('Could not record the payment. Please try again.');
        return;
      }
      onMarkPaid();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record the payment.');
    } finally {
      setSubmitting(false);
    }
  }, [submitting, value, amount, group.id, payToId, note, onMarkPaid]);

  return (
    <View className="flex-1">
      <ScreenBackground />
      <SafeAreaView edges={['top']} className="flex-1">
        <DetailHeader title="Record Settlement" onBack={onBack} />

        <ScrollView showsVerticalScrollIndicator={false} className="px-5" contentContainerClassName="pb-36">
          <View className="mb-5">
            <GlassCard>
              <View className="flex-row items-center">
                <View className="mr-3.5">
                  <MemberAvatar uri={payToAvatar} name={payTo} size={48} />
                </View>
                <View>
                  <Text className="text-[16px] font-extrabold text-[#0B3D62]">{payTo}</Text>
                  <Text className="mt-1 text-[20px] font-extrabold" style={{ color: colors.red }}>{formatINR(amount)}</Text>
                  <Text className="text-[11px] text-[#8DA0B1]">You owe this amount</Text>
                </View>
              </View>
            </GlassCard>
          </View>

          <Text className="mb-2 text-[13px] font-semibold text-[#5B7C93]">Amount</Text>
          <View className="mb-3 flex-row items-center rounded-2xl border border-white/60 bg-white/35 px-4 py-3.5">
            <Text className="mr-1.5 text-[16px] font-extrabold text-[#0B3D62]">₹</Text>
            <TextInput
              value={value}
              onChangeText={setValue}
              keyboardType="numeric"
              className="flex-1 text-[16px] font-bold text-[#0B3D62]"
            />
          </View>
          <View className="mb-5 flex-row flex-wrap gap-2">
            {chips.map((c) => (
              <TouchableOpacity
                key={c}
                activeOpacity={0.8}
                onPress={() => setValue(c)}
                className="rounded-full border border-white/60 bg-white/40 px-3.5 py-1.5"
              >
                <Text className="text-[12.5px] font-bold text-[#3E6E8E]">₹{c}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text className="mb-2 text-[13px] font-semibold text-[#5B7C93]">Date</Text>
          <View className="mb-5 flex-row items-center rounded-2xl border border-white/60 bg-white/35 px-4 py-3.5">
            <Ionicons name="calendar-outline" size={16} color={colors.navySoft} />
            <Text className="ml-2 text-[14px] font-semibold text-[#0B3D62]">{todayLabel()}</Text>
          </View>

          <Text className="mb-2 text-[13px] font-semibold text-[#5B7C93]">Note (optional)</Text>
          <View className="mb-1 rounded-2xl border border-white/60 bg-white/35 px-4 py-3.5">
            <TextInput
              value={note}
              onChangeText={(t) => t.length <= 200 && setNote(t)}
              multiline
              className="min-h-[44px] text-[14px] text-[#0B3D62]"
            />
          </View>
          <Text className="mb-6 text-right text-[11px] text-[#8DA0B1]">{note.length}/200</Text>

          {error ? (
            <Text className="mb-3 text-center text-[13px] font-semibold" style={{ color: colors.red }}>
              {error}
            </Text>
          ) : null}

          {submitting ? (
            <View className="items-center py-4">
              <ActivityIndicator size="small" color={colors.teal} />
            </View>
          ) : (
            <PrimaryButton label="Mark as Paid" onPress={() => void submit()} />
          )}

          <Text className="mt-3 text-center text-[11.5px] leading-[17px] text-[#5B7C93]">
            {payTo} will confirm receipt in the app. The remaining balance stays active until then.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function AllSettledScreen({ onBack, onViewGroup }: { onBack: () => void; onViewGroup: () => void }) {
  return (
    <View className="flex-1">
      <ScreenBackground />
      <SafeAreaView edges={['top']} className="flex-1">
        <View className="px-5 pb-2 pt-3">
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
        </View>

        <View className="flex-1 items-center justify-center px-8">
          <View className="mb-6 h-32 w-32 items-center justify-center rounded-full" style={{ backgroundColor: colors.tealBg }}>
            <View className="flex-row">
              <Ionicons name="hand-left" size={44} color={colors.teal} />
              <Ionicons name="hand-right" size={44} color={colors.teal} style={{ marginLeft: -6 }} />
            </View>
          </View>
          <Text className="text-[22px] font-extrabold text-[#0B3D62]">All Settled!</Text>
          <Text className="mt-2 text-center text-[14px] leading-[20px] text-[#5B7C93]">
            Great! Everyone in this group is settled up.
          </Text>
        </View>

        <View className="px-5 pb-8">
          <OutlineButton label="View Group" onPress={onViewGroup} />
        </View>
      </SafeAreaView>
    </View>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   ROOT
   ──────────────────────────────────────────────────────────────────────── */

export default function SettleFlow() {
  const [stack, setStack] = useState<Screen[]>([{ name: 'main' }]);
  const params = useLocalSearchParams<{ groupId?: string | string[] }>();
  const deepLinkConsumedRef = useRef<string | null>(null);

  const push = (s: Screen) => setStack((st) => [...st, s]);
  const pop = () => setStack((st) => (st.length > 1 ? st.slice(0, -1) : st));
  const resetTo = (s: Screen) => setStack([{ name: 'main' }, s]);
  const current = stack[stack.length - 1];

  // Person Detail -> group drill: open the settlement overview directly.
  // The group summary is fetched lazily; the overview loads its own data.
  // Focus-driven (not mount-only) so re-entering with the same groupId
  // after navigating away still opens the overview exactly once.
  useFocusEffect(
    useCallback(() => {
      const raw = params.groupId;
      const groupId = Array.isArray(raw) ? raw[0] : raw;
      if (!groupId || deepLinkConsumedRef.current === groupId) return;
      deepLinkConsumedRef.current = groupId;
      void (async () => {
        try {
          const detail = await fetchGroupDetail(groupId);
          if (!detail) return;
        const lite: SettleGroup = {
          id: detail.id,
          name: detail.name,
          image: detail.image_url,
          members: detail.member_count,
          status: detail.lifecycle === 'archived' ? 'archived' : detail.settlement_status === 'settled' ? 'settled' : 'pending',
          pendingCount: 0,
          youOwe: '0.00',
          youAreOwed: '0.00',
          currency: detail.currency,
        };
        setStack((st) => {
          if (st.length === 1 && st[0].name === 'main') {
            return detail.settlement_status === 'settled' && detail.lifecycle !== 'archived'
              ? [...st, { name: 'allSettled', group: lite }]
              : [...st, { name: 'overview', group: lite }];
          }
          return st;
        });
      } catch {
        // Stay on main; the user can retry from the list.
      }
    })();
    }, [params.groupId]),
  );

  switch (current.name) {
    case 'main':
      return <MainScreen onNavigate={push} />;

    case 'overview':
      return (
        <GroupOverviewScreen
          group={current.group}
          onBack={pop}
          onSettleNow={() => push({ name: 'suggestions', group: current.group })}
          onHistory={() => push({ name: 'history', group: current.group })}
        />
      );

    case 'suggestions':
      return (
        <SuggestionsScreen
          group={current.group}
          onBack={pop}
          onProceed={(payToId, payTo, payToAvatar, amount) =>
            push({ name: 'options', group: current.group, payToId, payTo, payToAvatar, amount })
          }
        />
      );

    case 'options':
      return (
        <SettleOptionsScreen
          group={current.group}
          payTo={current.payTo}
          payToAvatar={current.payToAvatar}
          amount={current.amount}
          onBack={pop}
          onNext={(methodKey, methodTitle) =>
            push({ name: 'confirm', group: current.group, payTo: current.payTo, payToId: current.payToId, payToAvatar: current.payToAvatar, amount: current.amount, method: methodTitle, methodKey })
          }
          onPartial={() => push({ name: 'manual', group: current.group, payTo: current.payTo, payToId: current.payToId, payToAvatar: current.payToAvatar, amount: current.amount })}
        />
      );

    case 'confirm':
      return (
        <ConfirmSettlementScreen
          group={current.group}
          payTo={current.payTo}
          payToId={current.payToId}
          payToAvatar={current.payToAvatar}
          amount={current.amount}
          method={current.method}
          methodKey={current.methodKey}
          onBack={pop}
          onConfirm={() => push({ name: 'success', group: current.group, payTo: current.payTo, amount: current.amount })}
        />
      );

    case 'manual':
      return (
        <ManualSettlementScreen
          group={current.group}
          payTo={current.payTo}
          payToId={current.payToId}
          payToAvatar={current.payToAvatar}
          amount={current.amount}
          onBack={pop}
          onMarkPaid={() => push({ name: 'success', group: current.group, payTo: current.payTo, amount: current.amount })}
        />
      );

    case 'success':
      return (
        <SuccessScreen
          payTo={current.payTo}
          amount={current.amount}
          onBack={pop}
          onViewUpdated={() => resetTo({ name: 'updated', group: current.group })}
          onSettleAnother={() => resetTo({ name: 'suggestions', group: current.group })}
        />
      );

    case 'updated':
      return (
        <GroupOverviewScreen
          group={current.group}
          onBack={pop}
          title={current.group.name}
        />
      );

    case 'history':
      return <SettlementHistoryScreen group={current.group} onBack={pop} />;

    case 'allSettled':
      return <AllSettledScreen onBack={pop} onViewGroup={() => resetTo({ name: 'overview', group: current.group })} />;

    default:
      return <MainScreen onNavigate={push} />;
  }
}
