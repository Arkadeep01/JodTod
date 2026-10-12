import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView, BlurTargetView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { Svg, Path, Defs, Marker, Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withRepeat,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { useAuth } from '../../context/AuthContext';
import { useFocusEffect } from 'expo-router';
import { fetchMyGroups, type GroupSummary } from '../../services/groups.api';
import { fetchPeople, type PersonSummary } from '../../services/settlements.api';
import { fetchActivities, type BackendActivity } from '../../services/activity.api';
import { parseAmountToPaise } from '../../lib/money';

const GREEN = '#34D399';
const CYAN = '#22D3EE';
const CORAL = '#FB7185';

// ---------------------------------------------------------------------------
// Real backend data (groups, people, recent expense activity).
// No hardcoded financial/user data: everything below derives from the
// API at runtime, with neutral placeholders while loading.
// ---------------------------------------------------------------------------

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good Morning,';
  if (hour >= 12 && hour < 17) return 'Good Afternoon,';
  if (hour >= 17 && hour < 21) return 'Good Evening,';
  return 'Good Night,';
};

const TINTS = ['#34D399', '#22D3EE', '#A78BFA', '#38BDF8', '#FB7185', '#FBBF24'];
const GROUP_ICONS = ['airplane', 'home', 'car', 'people', 'briefcase', 'cart'];
const EXPENSE_ICONS = ['cafe', 'restaurant', 'cart', 'receipt', 'fast-food', 'beer'] as const;
const EXPENSE_TINTS = ['#FB923C', '#C084FC', '#34D399', '#38BDF8', '#FBBF24', '#FB7185'];

/** Backend "X.XX" money string → paise integer (never float). */
function toPaiseSafe(raw: string | null | undefined): number {
  if (!raw) return 0;
  return parseAmountToPaise(raw, { allowZero: true, allowNegative: true }) ?? 0;
}

function fmtINR(paise: number): string {
  const whole = paise % 100 === 0;
  return `₹${(paise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function tintFor(name: string): string {
  let sum = 0;
  for (let i = 0; i < name.length; i += 1) sum += name.charCodeAt(i);
  return TINTS[sum % TINTS.length];
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0].charAt(0) ?? '?').toUpperCase();
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
}

function activityDateLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  if (sameDay) return 'Today';
  if (isYesterday) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// Connector geometry in the 320x250 map space. TOWARD curves run pill edge
// -> avatar edge (arrowhead lands just outside the face = money flowing in).
// AWAY curves are the exact geometric reverse (money flowing out).
// Center avatar occupies roughly x 122-198, so endpoints stop short of it.
type Cubic = [number, number, number, number, number, number, number, number];

const FLOW_TOWARD_LEFT: Cubic[] = [
  [90, 44, 100, 58, 114, 74, 132, 93],
  [90, 125, 100, 125, 110, 125, 118, 125],
  [90, 208, 100, 194, 114, 176, 133, 157],
];

const FLOW_TOWARD_RIGHT: Cubic[] = [
  [230, 44, 220, 58, 206, 74, 188, 93],
  [230, 125, 220, 125, 210, 125, 202, 125],
  [230, 208, 220, 194, 206, 176, 187, 157],
];

const reverseCubic = (c: Cubic): Cubic => [c[6], c[7], c[4], c[5], c[2], c[3], c[0], c[1]];

const FLOW_AWAY_LEFT: Cubic[] = FLOW_TOWARD_LEFT.map(reverseCubic);
const FLOW_AWAY_RIGHT: Cubic[] = FLOW_TOWARD_RIGHT.map(reverseCubic);

const cubicD = (c: Cubic) =>
  `M${c[0]},${c[1]} C${c[2]},${c[3]} ${c[4]},${c[5]} ${c[6]},${c[7]}`;

type Pt = { x: number; y: number };

// Sampled once at module level — the particle worklet lerps between these.
const sampleCubic = (c: Cubic, n = 56): Pt[] => {
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    pts.push({
      x:
        u * u * u * c[0] +
        3 * u * u * t * c[2] +
        3 * u * t * t * c[4] +
        t * t * t * c[6],
      y:
        u * u * u * c[1] +
        3 * u * u * t * c[3] +
        3 * u * t * t * c[5] +
        t * t * t * c[7],
    });
  }
  return pts;
};

// ---------------------------------------------------------------------------
// Shared dark-glass shell (real Android blur via blurTarget)
// ---------------------------------------------------------------------------

function GlassShell({
  children,
  radius,
  intensity = 55,
  blurTarget,
  style,
}: {
  children: React.ReactNode;
  radius: number;
  intensity?: number;
  blurTarget: React.RefObject<View | null>;
  style?: object;
}) {
  return (
    <View
      className="overflow-hidden border border-white/20"
      style={[
        { borderRadius: radius },
        {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.3,
          shadowRadius: 14,
          elevation: 7,
        },
        style,
      ]}
    >
      <BlurView
        blurTarget={blurTarget}
        blurMethod="dimezisBlurView"
        intensity={intensity}
        tint="dark"
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: 'rgba(10,35,55,0.38)', borderRadius: radius },
        ]}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 14,
          right: 14,
          height: 1,
          backgroundColor: 'rgba(255,255,255,0.16)',
        }}
      />
      {children}
    </View>
  );
}

function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  return (
    <View className="mb-2.5 flex-row items-center justify-between">
      <Text className="text-[17px] font-extrabold text-white">{title}</Text>
      <TouchableOpacity activeOpacity={0.7} className="flex-row items-center" onPress={onSeeAll}>
        <Text className="mr-1 text-[12px] font-semibold text-white/70">See all</Text>
        <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Energy particle: travels the ACTUAL sampled cubic (never straight-line
// left/top animation). Runs fully on the UI thread: one linear withTiming
// loop, opacity fades at both ends so the loop reset is invisible.
// ---------------------------------------------------------------------------

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const positionAlong = (pts: Pt[], t: number, opacityScale: number) => {
  'worklet';
  const n = pts.length - 1;
  const clamped = Math.min(Math.max(t, 0), 1);
  const scaled = clamped * n;
  const i = Math.min(Math.floor(scaled), n - 1);
  const f = scaled - i;
  const a = pts[i];
  const b = pts[i + 1];
  const fade = Math.sin(clamped * Math.PI);
  return {
    cx: a.x + (b.x - a.x) * f,
    cy: a.y + (b.y - a.y) * f,
    opacity: (0.12 + 0.88 * fade) * opacityScale,
  };
};

function FlowDots({
  curve,
  color,
  delay,
  duration = 2100,
}: {
  curve: Cubic;
  color: string;
  delay: number;
  duration?: number;
}) {
  // Module-level curve identity is stable, so this samples exactly once.
  const samples = React.useMemo(() => sampleCubic(curve, 56), [curve]);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration, easing: Easing.linear }),
        -1,
        false
      )
    );
  }, [delay, duration, progress]);

  const dotProps = useAnimatedProps(() => positionAlong(samples, progress.value, 1));
  const haloProps = useAnimatedProps(() => positionAlong(samples, progress.value, 0.32));

  return (
    <>
      <AnimatedCircle r={7} fill={color} animatedProps={haloProps} />
      <AnimatedCircle r={3} fill="#FFFFFF" animatedProps={dotProps} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Home screen (content only — tab bar lives in the parent layout)
// ---------------------------------------------------------------------------

type HomeGroup = {
  id: string;
  name: string;
  members: string;
  amount: string;
  icon: string;
  tint: string;
};

type FlowPerson = { id: string; name: string; amount: string; initial: string; tint: string };

// Never render more than this many arrows per flow; the header sub-line
// always shows the real total, so capping never misrepresents the count.
const MAX_FLOW_ARROWS = 5;

// Curve slots sit at fixed anchor rows (top/middle/bottom of the panel).
// For fewer people, use spread-out slots so each arrow stays aligned
// with its person row: 1 person -> middle, 2 -> top+bottom, 3 -> all.
function slotsFor(count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [1];
  if (count === 2) return [0, 2];
  return [0, 1, 2];
}

type RecentExpense = {
  id: string;
  title: string;
  meta: string;
  amount: string;
  status: string;
  statusStyle: 'paid' | 'split';
  icon: (typeof EXPENSE_ICONS)[number];
  iconColor: string;
};

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const displayName = user?.name?.split(' ')[0] || 'there';
  const backgroundRef = useRef<View>(null);
  const [flowTab, setFlowTab] = useState<'get' | 'owe'>('get');

  const [homeGroups, setHomeGroups] = useState<GroupSummary[]>([]);
  const [homePeople, setHomePeople] = useState<PersonSummary[]>([]);
  const [homeActivities, setHomeActivities] = useState<BackendActivity[]>([]);
  const [homeLoading, setHomeLoading] = useState(true);
  const [homeError, setHomeError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadHome = React.useCallback(async () => {
    setHomeLoading(true);
    setHomeError(null);
    try {
      const [groups, people, activities] = await Promise.all([
        fetchMyGroups(),
        fetchPeople('all', undefined, 50, 0).then(
          (r) => r.people,
          () => [] as PersonSummary[],
        ),
        fetchActivities({ type: 'expense' }).then(
          (rows) => rows.slice(0, 5),
          () => [] as BackendActivity[],
        ),
      ]);
      if (!mountedRef.current) return;
      setHomeGroups(groups);
      setHomePeople(people);
      setHomeActivities(activities);
    } catch (e) {
      if (!mountedRef.current) return;
      setHomeError(e instanceof Error ? e.message : 'Could not load home.');
    } finally {
      if (mountedRef.current) setHomeLoading(false);
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      mountedRef.current = true;
      void loadHome();
      return () => {
        mountedRef.current = false;
      };
    }, [loadHome]),
  );

  const totalOwed = homeGroups.reduce((s, g) => s + toPaiseSafe(g.you_are_owed), 0);
  const totalOwe = homeGroups.reduce((s, g) => s + toPaiseSafe(g.you_owe), 0);

  const theyOweMe = homePeople
    .filter((p) => toPaiseSafe(p.they_owe) > 0)
    .sort((a, b) => toPaiseSafe(b.they_owe) - toPaiseSafe(a.they_owe));
  const iOweThem = homePeople
    .filter((p) => toPaiseSafe(p.you_owe) > 0)
    .sort((a, b) => toPaiseSafe(b.you_owe) - toPaiseSafe(a.you_owe));

  const toFlow = (p: PersonSummary, amount: string): FlowPerson => ({
    id: p.user_id,
    name: p.display_name.toUpperCase(),
    amount,
    initial: initialsOf(p.display_name),
    tint: tintFor(p.display_name),
  });
  // Dynamic people for the active flow: the category list is already one
  // row per distinct person (backend-aggregated) filtered to positive
  // balances above, so settled/zero relationships are excluded and no
  // person is double-counted. Cap at MAX_FLOW_ARROWS and split balanced
  // across the two columns (left gets the odd one out).
  const flowSource = flowTab === 'get' ? theyOweMe : iOweThem;
  const flowPeople: FlowPerson[] = flowSource
    .slice(0, MAX_FLOW_ARROWS)
    .map((p) =>
      toFlow(p, fmtINR(toPaiseSafe(flowTab === 'get' ? p.they_owe : p.you_owe))),
    );
  const flowLeftCount = Math.ceil(flowPeople.length / 2);
  const flowLeft: FlowPerson[] = flowPeople.slice(0, flowLeftCount);
  const flowRight: FlowPerson[] = flowPeople.slice(flowLeftCount);

  const groups: HomeGroup[] = homeGroups.slice(0, 2).map((g, i) => {
    const owed = toPaiseSafe(g.you_are_owed);
    const owe = toPaiseSafe(g.you_owe);
    const net = owed - owe;
    return {
      id: g.id,
      name: g.name,
      members:
        g.member_count === 1 ? '1 member' : `${g.member_count} members`,
      amount: homeLoading ? '…' : fmtINR(Math.abs(net)),
      icon: GROUP_ICONS[i % GROUP_ICONS.length],
      tint: tintFor(g.name),
    };
  });

  const myKey = (user?.name ?? '').trim().toLowerCase();
  const expenses: RecentExpense[] = homeActivities.slice(0, 3).map((a, i) => {
    const mine =
      myKey.length > 0 &&
      (a.actor_name ?? '').trim().toLowerCase() === myKey;
    return {
      id: a.id,
      title: a.title,
      meta: `${a.group_name ?? 'Group'} • ${activityDateLabel(a.occurred_at)}`,
      amount: a.amount ?? '',
      status: mine ? 'You paid' : 'Split',
      statusStyle: mine ? ('paid' as const) : ('split' as const),
      icon: EXPENSE_ICONS[(a.title.length + i) % EXPENSE_ICONS.length],
      iconColor: EXPENSE_TINTS[(a.title.length + i) % EXPENSE_TINTS.length],
    };
  });

  // Single source of truth for the financial direction. Header pill,
  // balance card, people amounts, and arrow geometry all read from this.
  const isGet = flowTab === 'get';
  const finAmount = isGet ? totalOwed : totalOwe;
  const finPeopleCount = isGet ? theyOweMe.length : iOweThem.length;
  const fin = {
    label: isGet ? 'You will get' : 'You owe',
    amount: homeLoading ? '…' : fmtINR(finAmount),
    sub: `Across ${finPeopleCount} ${finPeopleCount === 1 ? 'person' : 'people'} • ${homeGroups.length} ${homeGroups.length === 1 ? 'group' : 'groups'}`,
    arrow: isGet ? 'arrow-up' : 'arrow-down',
    accent: isGet ? '#34D399' : '#FB7185',
    accentSoft: isGet ? 'rgba(52,211,153,0.16)' : 'rgba(251,113,133,0.16)',
    gradient: (isGet ? ['#34D399', '#0E9F6E'] : ['#FB7185', '#EA580C']) as [
      string,
      string,
    ],
    left: flowLeft,
    right: flowRight,
    amountLeft: isGet ? GREEN : '#FB7185',
    amountRight: isGet ? CYAN : '#FB7185',
    strokeLeft: isGet ? GREEN : '#FB7185',
    strokeRight: isGet ? CYAN : '#F59E0B',
    markerLeft: isGet ? 'arrowG' : 'arrowR',
    markerRight: isGet ? 'arrowC' : 'arrowO',
    // Direction follows the money, per mode. Incoming (they owe me)
    // uses TOWARD geometry: paths run person -> avatar with the
    // markerEnd arrowhead landing at the central user. Outgoing (I owe
    // them) uses AWAY: avatar -> person, heads at the people. Dots
    // travel t=0->1 along the same paths, so animation always matches
    // the arrowheads. Data, balances, and settlement math untouched.
    pathsLeft: isGet ? FLOW_TOWARD_LEFT : FLOW_AWAY_LEFT,
    pathsRight: isGet ? FLOW_TOWARD_RIGHT : FLOW_AWAY_RIGHT,
    particleLeft: isGet ? '#6EE7B7' : '#FDA4AF',
    particleRight: isGet ? '#67E8F9' : '#FDBA74',
  } as const;

  const handleProfilePress = () => {
    router.push('/profile');
  };

  return (
    <View style={{ flex: 1 }}>
      <BlurTargetView ref={backgroundRef} style={StyleSheet.absoluteFill}>
        <Image
          source={require('../../../assets/images/jodtod/background_home.png')}
          resizeMode="cover"
          style={StyleSheet.absoluteFill}
        />
      </BlurTargetView>

      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          className="px-4"
          contentContainerStyle={{ paddingBottom: 110 }}
        >
          {/* Header — profile left, Search + Notification top-right */}
          <View className="mb-3 mt-1 flex-row items-center justify-between">
            <View className="mr-2 flex-row min-w-0 flex-1 items-center">
              <TouchableOpacity activeOpacity={0.85} onPress={handleProfilePress}>
                <View
                  className="h-16 w-16 overflow-hidden rounded-full border-2 border-white/30"
                  style={{
                    shadowColor: '#22D3EE',
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.45,
                    shadowRadius: 12,
                    elevation: 7,
                  }}
                >
                  <Image
                    source={require('../../../assets/images/jodtod/people.png')}
                    resizeMode="cover"
                    style={{ width: '100%', height: '100%' }}
                  />
                </View>
                <View
                  className="absolute bottom-0.5 right-0.5 h-[14px] w-[14px] rounded-full border-2 border-white"
                  style={{
                    backgroundColor: '#22C55E',
                    shadowColor: '#22C55E',
                    shadowOpacity: 0.9,
                    shadowRadius: 5,
                    elevation: 3,
                  }}
                />
              </TouchableOpacity>

              <View className="ml-3 flex-1">
                <Text className="text-[14px] font-medium text-white">
                  {getGreeting()}
                </Text>
                <Text
                  className="text-[30px] font-extrabold leading-[34px] text-white"
                  numberOfLines={1}
                >
                  {displayName} 👋
                </Text>
                <Text className="text-[13px] text-white/80" numberOfLines={1}>
                  Split Smart. Stay Together.
                </Text>
                <View className="mt-1.5 h-[3px] w-[40px] rounded-full bg-white opacity-90" />
              </View>
            </View>
            <View className="flex-row items-center gap-2">
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => router.push('/(tabs)/groups' as any)}
                className="h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/10"
              >
                <Ionicons name="search" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push('/notifications' as any)}
              className="h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/10"
            >
              <Ionicons name="notifications" size={20} color="#FFFFFF" />
              <View
                className="absolute right-2.5 top-2.5 h-[12px] w-[12px] rounded-full border border-white"
                style={{
                  backgroundColor: '#EF4444',
                  shadowColor: '#EF4444',
                  shadowOpacity: 0.9,
                  shadowRadius: 4,
                  elevation: 3,
                }}
              />
            </TouchableOpacity>
            </View>
          </View>

          {homeError ? (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => void loadHome()}
              className="mb-3 flex-row items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-4 py-3"
            >
              <Ionicons name="cloud-offline-outline" size={16} color="#FFFFFF" />
              <Text className="ml-2 text-[13px] font-bold text-white">
                Couldn&apos;t refresh home — tap to retry
              </Text>
            </TouchableOpacity>
          ) : null}

          {/* Get / Owe toggle — both states always visible, tap either half */}
          <View className="mb-3">
            <View className="w-full overflow-hidden rounded-[28px] border border-white/20">
              <BlurView
                blurTarget={backgroundRef}
                blurMethod="dimezisBlurView"
                intensity={50}
                tint="dark"
                style={StyleSheet.absoluteFill}
              />
              <View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: 'rgba(10,35,55,0.4)' },
                ]}
              />
              <View className="flex-row p-1">
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => setFlowTab('get')}
                  className="flex-1"
                >
                  <View
                    className="flex-row items-center justify-center rounded-full py-2.5"
                    style={
                      isGet
                        ? {
                            shadowColor: '#34D399',
                            shadowOffset: { width: 0, height: 0 },
                            shadowOpacity: 0.55,
                            shadowRadius: 10,
                            elevation: 5,
                          }
                        : undefined
                    }
                  >
                    {isGet && (
                      <LinearGradient
                        colors={['#34D399', '#22D3EE']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[StyleSheet.absoluteFill, { borderRadius: 999 }]}
                      />
                    )}
                    <Ionicons
                      name="arrow-up"
                      size={16}
                      color={isGet ? '#FFFFFF' : 'rgba(255,255,255,0.55)'}
                      style={{ marginRight: 5 }}
                    />
                    <Text
                      className="text-[15px] font-bold"
                      style={{ color: isGet ? '#FFFFFF' : 'rgba(255,255,255,0.55)' }}
                    >
                      You will get
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => setFlowTab('owe')}
                  className="flex-1"
                >
                  <View
                    className="flex-row items-center justify-center rounded-full py-2.5"
                    style={
                      !isGet
                        ? {
                            shadowColor: '#FB7185',
                            shadowOffset: { width: 0, height: 0 },
                            shadowOpacity: 0.55,
                            shadowRadius: 10,
                            elevation: 5,
                          }
                        : undefined
                    }
                  >
                    {!isGet && (
                      <LinearGradient
                        colors={['#FB7185', '#EA580C']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[StyleSheet.absoluteFill, { borderRadius: 999 }]}
                      />
                    )}
                    <Ionicons
                      name="arrow-down"
                      size={16}
                      color={!isGet ? '#FFFFFF' : 'rgba(255,255,255,0.55)'}
                      style={{ marginRight: 5 }}
                    />
                    <Text
                      className="text-[15px] font-bold"
                      style={{ color: !isGet ? '#FFFFFF' : 'rgba(255,255,255,0.55)' }}
                    >
                      You owe
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Main balance card */}
          <View className="mb-3">
            <GlassShell radius={26} blurTarget={backgroundRef}>
              <LinearGradient
                colors={[
                  `${fin.accent}1A`,
                  'rgba(255,255,255,0)',
                  `${fin.accent}1A`,
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
              <View className="flex-row items-center p-4">
                <View
                  className="h-16 w-16 items-center justify-center rounded-full"
                  style={{
                    shadowColor: fin.accent,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.7,
                    shadowRadius: 14,
                    elevation: 7,
                  }}
                >
                  <LinearGradient
                    colors={fin.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[StyleSheet.absoluteFill, { borderRadius: 32 }]}
                  />
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      top: 5,
                      left: 12,
                      right: 12,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: 'rgba(255,255,255,0.35)',
                    }}
                  />
                  <Ionicons name={fin.arrow as any} size={30} color="#FFFFFF" />
                </View>

                <View className="ml-3 min-w-0 flex-1">
                  <Text className="text-[13px] text-white/85">{fin.label}</Text>
                  <Text
                    className="text-[34px] font-extrabold leading-[38px] text-white"
                    numberOfLines={1}
                  >
                    {fin.amount}
                  </Text>
                  <Text className="text-[12px] text-white/70" numberOfLines={1}>
                    {fin.sub}
                  </Text>
                </View>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => router.push('/(tabs)/settle' as any)}
                  className="ml-2 h-[44px] w-[118px] flex-row items-center justify-center rounded-full border border-white/25 bg-white/10"
                >
                  <Text className="mr-1 text-[11px] font-bold text-white">
                    View details
                  </Text>
                  <Ionicons name="chevron-forward" size={13} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </GlassShell>
          </View>

          {/* People / Money flow */}
          <View className="mb-4">
            <GlassShell radius={24} blurTarget={backgroundRef}>
              <View className="px-3 pb-4 pt-4">
                <View style={{ height: 250 }}>
                  <View className="flex-1 flex-row items-stretch justify-between gap-1.5">
                    {/* Left people */}
                    <View className="flex-[30] justify-between py-1">
                      {/* Single row is vertically centered (spacers keep the
                          panel height stable so nothing jumps as data loads);
                          two rows sit top/bottom via justify-between. */}
                      {fin.left.length === 1 && <View className="flex-1" />}
                      {fin.left.map((p) => (
                        <View
                          key={p.id}
                          className="flex-row items-center rounded-xl border border-white/20 bg-white/10 px-1.5 py-1.5"
                        >
                          <View
                            className="h-9 w-9 items-center justify-center rounded-full border border-white/30"
                            style={{ backgroundColor: `${p.tint}33` }}
                          >
                            <Text className="text-[13px] font-extrabold text-white">
                              {p.initial}
                            </Text>
                          </View>
                          <View className="ml-1.5 min-w-0 flex-1">
                            <Text
                              className="text-[12px] font-bold text-white"
                              numberOfLines={1}
                            >
                              {p.name}
                            </Text>
                          <Text
                            className="text-[14px] font-extrabold"
                            style={{ color: fin.amountLeft }}
                            numberOfLines={1}
                          >
                            {p.amount}
                          </Text>
                        </View>
                      </View>
                      ))}
                      {fin.left.length === 1 && <View className="flex-1" />}
                    </View>

                    {/* Center user */}
                    <View className="flex-[34] items-center justify-center">
                      <View
                        className="items-center justify-center rounded-full border-2 border-cyan-200/70"
                        style={{
                          width: 72,
                          height: 72,
                          shadowColor: CYAN,
                          shadowOffset: { width: 0, height: 0 },
                          shadowOpacity: 0.65,
                          shadowRadius: 16,
                          elevation: 8,
                        }}
                      >
                        <Image
                          source={require('../../../assets/images/jodtod/people.png')}
                          resizeMode="cover"
                          style={{ width: 64, height: 64, borderRadius: 32 }}
                        />
                      </View>
                      <Text className="mt-1.5 text-[13px] font-bold text-white">
                        You
                      </Text>
                    </View>

                    {/* Right people */}
                    <View className="flex-[30] justify-between py-1">
                      {fin.right.length === 1 && <View className="flex-1" />}
                      {fin.right.map((p) => (
                        <View
                          key={p.id}
                          className="flex-row items-center rounded-xl border border-white/20 bg-white/10 px-1.5 py-1.5"
                        >
                          <View
                            className="h-9 w-9 items-center justify-center rounded-full border border-white/30"
                            style={{ backgroundColor: `${p.tint}33` }}
                          >
                            <Text className="text-[13px] font-extrabold text-white">
                              {p.initial}
                            </Text>
                          </View>
                          <View className="ml-1.5 min-w-0 flex-1">
                            <Text
                              className="text-[12px] font-bold text-white"
                              numberOfLines={1}
                            >
                              {p.name}
                            </Text>
                          <Text
                            className="text-[14px] font-extrabold"
                            style={{ color: fin.amountRight }}
                            numberOfLines={1}
                          >
                            {p.amount}
                          </Text>
                        </View>
                      </View>
                      ))}
                      {fin.right.length === 1 && <View className="flex-1" />}
                    </View>
                  </View>

                  {/* Curved glowing connectors */}
                  <Svg
                    style={StyleSheet.absoluteFill}
                    viewBox="0 0 320 250"
                    preserveAspectRatio="none"
                    pointerEvents="none"
                  >
                    <Defs>
                      <Marker
                        id="arrowG"
                        markerWidth="7"
                        markerHeight="7"
                        refX="5"
                        refY="3.5"
                        orient="auto"
                      >
                        <Path d="M0,0 L7,3.5 L0,7 Z" fill={GREEN} opacity={0.95} />
                      </Marker>
                      <Marker
                        id="arrowC"
                        markerWidth="7"
                        markerHeight="7"
                        refX="5"
                        refY="3.5"
                        orient="auto"
                      >
                        <Path d="M0,0 L7,3.5 L0,7 Z" fill={CYAN} opacity={0.95} />
                      </Marker>
                      <Marker
                        id="arrowR"
                        markerWidth="7"
                        markerHeight="7"
                        refX="5"
                        refY="3.5"
                        orient="auto"
                      >
                        <Path d="M0,0 L7,3.5 L0,7 Z" fill="#FB7185" opacity={0.95} />
                      </Marker>
                      <Marker
                        id="arrowO"
                        markerWidth="7"
                        markerHeight="7"
                        refX="5"
                        refY="3.5"
                        orient="auto"
                      >
                        <Path d="M0,0 L7,3.5 L0,7 Z" fill="#F59E0B" opacity={0.95} />
                      </Marker>
                    </Defs>
                    {/* One arrow per person on this side (slots spread so
                        arrows align with their rows; zero people renders
                        zero arrows). Slot keys keep surviving arrows
                        mounted — no animation restart when counts change. */}
                    {slotsFor(fin.left.length).map((slot) => {
                      const c = fin.pathsLeft[slot];
                      return (
                      <React.Fragment key={`l${slot}`}>
                        <Path
                          d={cubicD(c)}
                          stroke={fin.strokeLeft}
                          strokeWidth={5}
                          fill="none"
                          opacity={0.22}
                          strokeLinecap="round"
                        />
                        <Path
                          d={cubicD(c)}
                          stroke={fin.strokeLeft}
                          strokeWidth={1.5}
                          fill="none"
                          opacity={0.9}
                          strokeLinecap="round"
                          markerEnd={`url(#${fin.markerLeft})`}
                        />
                        <FlowDots
                          curve={c}
                          color={fin.particleLeft}
                          delay={slot * 280}
                        />
                      </React.Fragment>
                      );
                    })}
                    {slotsFor(fin.right.length).map((slot) => {
                      const c = fin.pathsRight[slot];
                      return (
                      <React.Fragment key={`r${slot}`}>
                        <Path
                          d={cubicD(c)}
                          stroke={fin.strokeRight}
                          strokeWidth={5}
                          fill="none"
                          opacity={0.22}
                          strokeLinecap="round"
                        />
                        <Path
                          d={cubicD(c)}
                          stroke={fin.strokeRight}
                          strokeWidth={1.5}
                          fill="none"
                          opacity={0.9}
                          strokeLinecap="round"
                          markerEnd={`url(#${fin.markerRight})`}
                        />
                        <FlowDots
                          curve={c}
                          color={fin.particleRight}
                          delay={slot * 280 + 140}
                        />
                      </React.Fragment>
                      );
                    })}
                  </Svg>
                </View>
                {fin.left.length === 0 && fin.right.length === 0 && !homeLoading ? (
                  <Text className="pb-3 text-center text-[12px] text-white/60">
                    No outstanding balances — add an expense to get started.
                  </Text>
                ) : null}
              </View>
            </GlassShell>
          </View>

          {/* Your Groups */}
          <View className="mb-4">
            <SectionHeader
              title="Your Groups"
              onSeeAll={() => router.push('/(tabs)/groups' as any)}
            />
            {groups.length === 0 && !homeLoading ? (
              <GlassShell radius={24} blurTarget={backgroundRef}>
                <View className="items-center p-5">
                  <Text className="text-[14px] font-bold text-white">
                    No groups yet
                  </Text>
                  <Text className="mt-1 text-center text-[13px] text-white/65">
                    Create a group to start splitting expenses.
                  </Text>
                </View>
              </GlassShell>
            ) : (
            <View className="flex-row gap-2.5">
              {groups.map((group) => (
                <View key={group.id} className="flex-1">
                  <GlassShell radius={24} blurTarget={backgroundRef}>
                    <TouchableOpacity
                      activeOpacity={0.9}
                      className="p-3.5"
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${group.name}`}
                      onPress={() => {
                        // Missing id: stay put instead of opening the
                        // wrong group. IDs always come from the backend.
                        if (!group.id) return;
                        router.push(`/(tabs)/groups/${group.id}` as any);
                      }}
                    >
                      <View className="flex-row items-center">
                        <View
                          className="h-[52px] w-[52px] items-center justify-center rounded-full border border-white/30"
                          style={{
                            backgroundColor: `${group.tint}26`,
                            shadowColor: group.tint,
                            shadowOffset: { width: 0, height: 0 },
                            shadowOpacity: 0.5,
                            shadowRadius: 8,
                            elevation: 4,
                          }}
                        >
                          <Ionicons
                            name={group.icon as any}
                            size={24}
                            color="#FFFFFF"
                          />
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={18}
                          color="rgba(255,255,255,0.6)"
                          style={{ marginLeft: 'auto' }}
                        />
                      </View>
                      <Text
                        className="mt-2.5 text-[16px] font-extrabold text-white"
                        numberOfLines={1}
                      >
                        {group.name}
                      </Text>
                      <Text className="mt-0.5 text-[12px] text-white/65">
                        {group.members}
                      </Text>
                      <Text className="mt-0.5 text-[22px] font-extrabold text-white">
                        {group.amount}
                      </Text>
                    </TouchableOpacity>
                    <LinearGradient
                      colors={[`${group.tint}30`, 'rgba(255,255,255,0)']}
                      start={{ x: 0, y: 1 }}
                      end={{ x: 1, y: 0 }}
                      pointerEvents="none"
                      style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
                    />
                    </GlassShell>
                </View>
              ))}
            </View>
            )}
          </View>

          {/* Recent Expenses */}
          <View className="mb-2">
            <SectionHeader
              title="Recent Expenses"
              onSeeAll={() => router.push('/(tabs)/activity' as any)}
            />
            <GlassShell radius={24} blurTarget={backgroundRef}>
              <View className="px-3.5 py-1.5">
                {expenses.length === 0 && !homeLoading ? (
                  <View className="items-center py-5">
                    <Text className="text-[14px] font-bold text-white">
                      No recent activity yet
                    </Text>
                    <Text className="mt-1 text-center text-[13px] text-white/65">
                      Expenses you add will appear here.
                    </Text>
                  </View>
                ) : (
                expenses.map((expense, index) => (
                  <TouchableOpacity
                    key={expense.id}
                    activeOpacity={0.7}
                    className="flex-row items-center py-3"
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${expense.title}`}
                    onPress={() => {
                      // Missing id: stay put instead of opening the
                      // wrong record. The `ts` nonce forces the Activity
                      // tab to consume every tap, even repeat taps on the
                      // same expense.
                      if (!expense.id) return;
                      router.push(
                        {
                          pathname: '/(tabs)/activity',
                          params: {
                            activityId: expense.id,
                            ts: String(Date.now()),
                          },
                        } as any,
                      );
                    }}
                    style={
                      index < expenses.length - 1
                        ? {
                            borderBottomWidth: 1,
                            borderBottomColor: 'rgba(255,255,255,0.08)',
                          }
                        : undefined
                    }
                  >
                    <View
                      className="mr-2.5 h-11 w-11 items-center justify-center rounded-full border border-white/20"
                      style={{ backgroundColor: `${expense.iconColor}22` }}
                    >
                      <Ionicons
                        name={expense.icon as any}
                        size={20}
                        color={expense.iconColor}
                      />
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text
                        className="text-[15px] font-bold text-white"
                        numberOfLines={1}
                      >
                        {expense.title}
                      </Text>
                      <Text
                        className="mt-0.5 text-[12px] text-white/60"
                        numberOfLines={1}
                      >
                        {expense.meta}
                      </Text>
                    </View>
                    <View className="ml-2 items-end">
                      <Text className="text-[17px] font-extrabold text-white">
                        {expense.amount}
                      </Text>
                      <View
                        className="mt-1 rounded-full border px-2 py-0.5"
                        style={{
                          borderColor:
                            expense.statusStyle === 'paid'
                              ? 'rgba(52,211,153,0.35)'
                              : 'rgba(255,255,255,0.2)',
                          backgroundColor:
                            expense.statusStyle === 'paid'
                              ? 'rgba(52,211,153,0.14)'
                              : 'rgba(255,255,255,0.08)',
                        }}
                      >
                        <Text
                          className="text-[12px] font-semibold"
                          style={{
                            color:
                              expense.statusStyle === 'paid'
                                ? GREEN
                                : 'rgba(255,255,255,0.75)',
                          }}
                        >
                          {expense.status}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
                )}
              </View>
            </GlassShell>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
