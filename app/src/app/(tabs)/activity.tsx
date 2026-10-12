import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
  ActivityIndicator,
  BackHandler,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useAuth } from "../../context/AuthContext";

import {
  fetchActivities,
  fetchActivityById,
  type ActivityDateRange,
  type BackendActivity,
} from "../../services/activity.api";

/* ────────────────────────────────────────────────────────────────────────
   THEME — swap BACKGROUND_IMAGE for your uploaded background when ready.
   ──────────────────────────────────────────────────────────────────────── */

const colors = {
  navy: "#0B3D62",
  navySoft: "#3E6E8E",
  muted: "#5B7C93",
  faint: "#8DA0B1",
  teal: "#149C73",
  tealBg: "#E7F7F2",
  red: "#F04F38",
  redBg: "#FDE3E8",
  orange: "#E0932E",
  orangeBg: "#FFF3DE",
  purple: "#6C63FF",
  purpleBg: "#EDEBFF",
  blue: "#2563EB",
  blueBg: "#DDEBFF",
};

const cardShadow = {
  shadowColor: colors.navy,
  shadowOffset: { width: 0, height: 5 },
  shadowOpacity: 0.1,
  shadowRadius: 9,
  elevation: 4,
};

const glassBg = { backgroundColor: "rgba(255,255,255,0.01)" };

const BACKGROUND_IMAGE = require("../../../assets/images/jodtod/background_home.png");

/* ────────────────────────────────────────────────────────────────────────
   REUSABLE GLASS PIECES
   ──────────────────────────────────────────────────────────────────────── */

function ScreenBackground() {
  return (
    <>
      <Image
        source={BACKGROUND_IMAGE}
        className="absolute inset-0 h-full w-full"
        resizeMode="cover"
      />
      <View className="absolute inset-0 bg-white/10" />
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
        colors={["rgba(255,255,255,0.62)", "rgba(198,228,222,0.4)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      />
      <LinearGradient
        colors={["rgba(255,255,255,0.5)", "rgba(255,255,255,0)"]}
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

function InfoRow({
  label,
  value,
  avatarUri,
  icon,
  iconColor,
  iconBg,
  last = false,
}: {
  label: string;
  value: string;
  avatarUri?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  iconBg?: string;
  last?: boolean;
}) {
  return (
    <View
      className={`flex-row items-center justify-between py-3 ${last ? "" : "border-b border-white/40"}`}
    >
      <Text className="text-[13px] font-semibold text-[#5B7C93]">{label}</Text>
      <View className="flex-row items-center">
        {avatarUri ? (
          <Image
            source={{ uri: avatarUri }}
            className="mr-2 h-6 w-6 rounded-full"
          />
        ) : icon ? (
          <View
            className="mr-2 h-6 w-6 items-center justify-center rounded-full"
            style={{ backgroundColor: iconBg ?? "rgba(255,255,255,0.5)" }}
          >
            <Ionicons
              name={icon}
              size={13}
              color={iconColor ?? colors.navySoft}
            />
          </View>
        ) : null}
        <Text className="text-[14px] font-bold text-[#0B3D62]">{value}</Text>
      </View>
    </View>
  );
}

function StatusPill({
  label,
  color,
  bg,
}: {
  label: string;
  color: string;
  bg: string;
}) {
  return (
    <View
      className="flex-row items-center rounded-full px-2.5 py-1"
      style={{ backgroundColor: bg }}
    >
      <Ionicons
        name="checkmark-circle"
        size={13}
        color={color}
        style={{ marginRight: 4 }}
      />
      <Text className="text-[12px] font-extrabold" style={{ color }}>
        {label}
      </Text>
    </View>
  );
}

function NoteBanner({ text }: { text: string }) {
  return (
    <View className="rounded-2xl bg-white/35 px-4 py-3.5">
      <Text className="text-[12.5px] leading-[18px] text-[#5B7C93]">
        {text}
      </Text>
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

/* ────────────────────────────────────────────────────────────────────────
   DATA
   ──────────────────────────────────────────────────────────────────────── */

type ActivityType = "expense" | "settlement" | "member" | "group";

type ActivityItem = {
  id: string;
  type: ActivityType;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle?: string;
  time?: string;
  amount?: string;
  amountColor?: string;
  memberId?: string;
};

/* ────────────────────────────────────────────────────────────────────────
   ACTIVITY LIST — backed by GET /api/activities (no mock dataset).
   Detail screens below still use static demo payloads (out of scope).
   ──────────────────────────────────────────────────────────────────────── */

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatTime(date: Date): string {
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const suffix = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${hours}:${minutes} ${suffix}`;
}

function formatOlderDate(date: Date): string {
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`;
}

function formatDateTime(occurredAt: string): string {
  const date = new Date(occurredAt);
  return `${formatOlderDate(date)} • ${formatTime(date)}`;
}

function sectionLabelFor(date: Date, now: Date): string {
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.round(
    (startOfDay(now).getTime() - startOfDay(date).getTime()) / dayMs,
  );
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return formatOlderDate(date);
}

export type ActivitySection = {
  key: string;
  label: string;
  items: ActivityItem[];
};

const TYPE_ICONS: Record<
  BackendActivity["type"],
  { icon: ActivityItem["icon"]; iconColor: string; iconBg: string }
> = {
  expense: { icon: "restaurant", iconColor: colors.red, iconBg: colors.redBg },
  settlement: { icon: "cash", iconColor: colors.teal, iconBg: colors.tealBg },
  member: { icon: "people", iconColor: colors.purple, iconBg: colors.purpleBg },
  group: { icon: "settings", iconColor: colors.blue, iconBg: colors.blueBg },
};

function toActivityItem(record: BackendActivity): ActivityItem {
  const visuals = TYPE_ICONS[record.type];
  return {
    id: record.id,
    type: record.type,
    icon: visuals.icon,
    iconColor: visuals.iconColor,
    iconBg: visuals.iconBg,
    title: record.title,
    subtitle: record.subtitle ?? undefined,
    time: formatTime(new Date(record.occurred_at)),
    amount: record.amount ?? undefined,
    amountColor: record.type === "settlement" ? colors.teal : colors.navy,
    memberId: record.member_key ?? undefined,
  };
}

function groupItemsByDay(
  items: ActivityItem[],
  occurredById: Map<string, string>,
): ActivitySection[] {
  const now = new Date();
  const groups = new Map<string, ActivitySection>();
  for (const item of items) {
    const occurred = occurredById.get(item.id);
    const date = occurred ? new Date(occurred) : now;
    const label = sectionLabelFor(date, now);
    const dayKey = startOfDay(date).getTime().toString();
    const existing = groups.get(dayKey);
    if (existing) {
      existing.items.push(item);
    } else {
      groups.set(dayKey, { key: dayKey, label, items: [item] });
    }
  }
  // Newest day first (records already arrive newest-first).
  return [...groups.entries()]
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([, section]) => section);
}

const filters: {
  key: "all" | ActivityType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "all", label: "All", icon: "apps" },
  { key: "expense", label: "Expenses", icon: "restaurant" },
  { key: "settlement", label: "Settlements", icon: "cash" },
  { key: "member", label: "Members", icon: "people" },
  { key: "group", label: "Updates", icon: "settings" },
];

/* ────────────────────────────────────────────────────────────────────────
   NAVIGATION — a tiny internal stack, no router dependency
   ──────────────────────────────────────────────────────────────────────── */

type Screen =
  | { name: "main" }
  | {
      name: "expense" | "settlement" | "event" | "group-update";
      params: { id: string };
    }
  | { name: "member"; params: { memberKey: string } };

/* ────────────────────────────────────────────────────────────────────────
   FILTER MODAL
   ──────────────────────────────────────────────────────────────────────── */

type ActivityFilters = {
  type: "all" | ActivityType;
  dateRange: string;
  member: string[];
  group: string[];
  startDate: string | null;
  endDate: string | null;
  active: boolean;
};

const INITIAL_FILTERS: ActivityFilters = {
  type: "all",
  dateRange: "all",
  member: [],
  group: [],
  startDate: null,
  endDate: null,
  active: false,
};

function toDateKey(date: Date): string {
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function parseDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function formatDateKey(key: string): string {
  const date = parseDateKey(key);
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`;
}

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function CustomRangePicker({
  startDate,
  endDate,
  onChange,
}: {
  startDate: string | null;
  endDate: string | null;
  onChange: (start: string | null, end: string | null) => void;
}) {
  const today = new Date();
  const [monthCursor, setMonthCursor] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );

  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const handleDayPress = (day: number) => {
    const key = toDateKey(new Date(year, month, day));
    if (!startDate || (startDate && endDate)) {
      onChange(key, null);
    } else if (key < startDate) {
      onChange(key, null);
    } else {
      onChange(startDate, key);
    }
  };

  return (
    <View className="mt-3 rounded-2xl bg-white/30 px-3 pb-3 pt-1">
      <View className="flex-row items-center justify-between py-2">
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setMonthCursor(new Date(year, month - 1, 1))}
          className="h-8 w-8 items-center justify-center rounded-full bg-white/40"
        >
          <Ionicons name="chevron-back" size={16} color={colors.navy} />
        </TouchableOpacity>
        <Text className="text-[14px] font-extrabold text-[#0B3D62]">
          {MONTH_LABELS[month]} {year}
        </Text>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setMonthCursor(new Date(year, month + 1, 1))}
          className="h-8 w-8 items-center justify-center rounded-full bg-white/40"
        >
          <Ionicons name="chevron-forward" size={16} color={colors.navy} />
        </TouchableOpacity>
      </View>
      <View className="flex-row">
        {WEEKDAY_LABELS.map((label, i) => (
          <View key={`${label}-${i}`} className="flex-1 items-center py-1">
            <Text className="text-[11px] font-bold text-[#5B7C93]">
              {label}
            </Text>
          </View>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, week) => (
        <View key={`week-${week}`} className="flex-row">
          {cells.slice(week * 7, week * 7 + 7).map((day, i) => {
            if (day === null) {
              return (
                <View key={`empty-${i}`} className="flex-1 items-center py-1" />
              );
            }
            const key = toDateKey(new Date(year, month, day));
            const isStart = key === startDate;
            const isEnd = key === endDate;
            const inRange =
              startDate !== null &&
              endDate !== null &&
              key > startDate &&
              key < endDate;
            return (
              <View key={`day-${day}`} className="flex-1 items-center py-1">
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleDayPress(day)}
                  className={`h-9 w-9 items-center justify-center rounded-full ${
                    isStart || isEnd
                      ? "bg-[#149C73]"
                      : inRange
                        ? "bg-[#149C73]/25"
                        : "bg-white/40"
                  }`}
                >
                  <Text
                    className={`text-[13px] font-bold ${
                      isStart || isEnd ? "text-white" : "text-[#0B3D62]"
                    }`}
                  >
                    {day}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      ))}
      <Text className="px-1 pb-1 pt-2 text-center text-[12px] font-semibold text-[#0B3D62]">
        {startDate && endDate
          ? `${formatDateKey(startDate)} – ${formatDateKey(endDate)}`
          : startDate
            ? `From ${formatDateKey(startDate)} — tap an end date`
            : "Tap a start date, then an end date"}
      </Text>
    </View>
  );
}

function RadioRow({
  label,
  selected,
  onPress,
  icon,
  multi,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  multi?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      className="flex-row items-center justify-between py-3"
    >
      <View className="flex-row items-center">
        {icon ? (
          <View className="mr-3 h-7 w-7 items-center justify-center rounded-full bg-white/50">
            <Ionicons name={icon} size={15} color={colors.navySoft} />
          </View>
        ) : null}
        <Text className="text-[14px] font-semibold text-[#0B3D62]">
          {label}
        </Text>
      </View>
      {multi ? (
        <View
          className={`h-5 w-5 items-center justify-center rounded-md border-2 ${selected ? "border-[#149C73] bg-[#149C73]" : "border-[#C7D6DF]"}`}
        >
          {selected ? (
            <Ionicons name="checkmark" size={13} color="#FFFFFF" />
          ) : null}
        </View>
      ) : (
        <View
          className={`h-5 w-5 items-center justify-center rounded-full border-2 ${selected ? "border-[#149C73]" : "border-[#C7D6DF]"}`}
        >
          {selected ? (
            <View className="h-2.5 w-2.5 rounded-full bg-[#149C73]" />
          ) : null}
        </View>
      )}
    </TouchableOpacity>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="mb-1 mt-5 text-[13px] font-extrabold text-[#0B3D62]">
      {children}
    </Text>
  );
}

const TYPE_OPTIONS: {
  key: ActivityFilters["type"];
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "all", label: "All", icon: "apps" },
  { key: "expense", label: "Expenses", icon: "restaurant" },
  { key: "settlement", label: "Settlements", icon: "cash" },
  { key: "member", label: "Members", icon: "people" },
  { key: "group", label: "Group Updates", icon: "settings" },
];
const DATE_OPTIONS = [
  { key: "all", label: "All Time" },
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "custom", label: "Custom Range" },
];
// No friend/connection system exists in this project, so the Member filter
// offers only "All Members" plus "You" (the authenticated user's real id).
// No member names or IDs are hardcoded here.

function ActivityFilterModal({
  visible,
  onClose,
  onApply,
  onReset,
  groups,
}: {
  visible: boolean;
  onClose: () => void;
  onApply: (f: ActivityFilters) => void;
  onReset: () => void;
  groups: string[];
}) {
  const [type, setType] = useState<ActivityFilters["type"]>("all");
  const [dateRange, setDateRange] = useState("all");
  const [member, setMember] = useState<string[]>([]);
  const [group, setGroup] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const memberOptions = [
    ...(user?.id ? [{ key: user.id, label: "You" }] : []),
  ];

  const groupOptions = [...groups.map((name) => ({ key: name, label: name }))];

  const toggleValue = (current: string[], key: string) =>
    current.includes(key)
      ? current.filter((v) => v !== key)
      : [...current, key];

  const handleReset = () => {
    setType(INITIAL_FILTERS.type);
    setDateRange(INITIAL_FILTERS.dateRange);
    setMember(INITIAL_FILTERS.member);
    setGroup(INITIAL_FILTERS.group);
    setStartDate(INITIAL_FILTERS.startDate);
    setEndDate(INITIAL_FILTERS.endDate);
    onReset();
  };

  const canApply =
    dateRange !== "custom" || (startDate !== null && endDate !== null);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end">
        <TouchableOpacity
          className="absolute inset-0"
          activeOpacity={1}
          onPress={onClose}
        />
        <View className="rounded-t-[28px]" style={[cardShadow, glassBg]}>
          <View className="overflow-hidden rounded-t-[28px] border border-white/60">
            <GlassLayers radius={28} />
            <View className="absolute inset-0 bg-white/55" />
            <View className="px-5 pt-5">
              <View className="mb-1 flex-row items-center justify-between">
                <Text className="text-[19px] font-extrabold text-[#0B3D62]">
                  Filter Activity
                </Text>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={onClose}
                  className="h-8 w-8 items-center justify-center rounded-full bg-white/50"
                >
                  <Ionicons name="close" size={18} color={colors.navy} />
                </TouchableOpacity>
              </View>
              <ScrollView
                showsVerticalScrollIndicator={false}
                style={{ maxHeight: 380 }}
              >
                <SectionLabel>Activity Type</SectionLabel>
                <View className="rounded-2xl bg-white/30 px-3">
                  {TYPE_OPTIONS.map((opt, i) => (
                    <View
                      key={opt.key}
                      className={
                        i < TYPE_OPTIONS.length - 1
                          ? "border-b border-white/40"
                          : ""
                      }
                    >
                      <RadioRow
                        label={opt.label}
                        icon={opt.icon}
                        selected={type === opt.key}
                        onPress={() => setType(opt.key)}
                      />
                    </View>
                  ))}
                </View>
                <SectionLabel>Date Range</SectionLabel>
                <View className="rounded-2xl bg-white/30 px-3">
                  {DATE_OPTIONS.map((opt, i) => (
                    <View
                      key={opt.key}
                      className={
                        i < DATE_OPTIONS.length - 1
                          ? "border-b border-white/40"
                          : ""
                      }
                    >
                      <RadioRow
                        label={opt.label}
                        selected={dateRange === opt.key}
                        onPress={() => setDateRange(opt.key)}
                      />
                    </View>
                  ))}
                </View>
                <SectionLabel>Member</SectionLabel>
                <View className="mb-2 rounded-2xl bg-white/30 px-3">
                  {memberOptions.length === 0 ? (
                    <Text className="py-3 text-[13px] text-[#5B7C93]">
                      Log in to filter by member.
                    </Text>
                  ) : (
                    memberOptions.map((opt, i) => (
                      <View
                        key={opt.key}
                        className={
                          i < memberOptions.length - 1
                            ? "border-b border-white/40"
                            : ""
                        }
                      >
                        <RadioRow
                          label={opt.label}
                          multi
                          selected={member.includes(opt.key)}
                          onPress={() => setMember(toggleValue(member, opt.key))}
                        />
                      </View>
                    ))
                  )}
                </View>
                <SectionLabel>Group</SectionLabel>
                <View className="mb-2 rounded-2xl bg-white/30 px-3">
                  {groupOptions.length === 0 ? (
                    <Text className="py-3 text-[13px] text-[#5B7C93]">
                      No groups found in your activity.
                    </Text>
                  ) : (
                    groupOptions.map((opt, i) => (
                      <View
                        key={opt.key}
                        className={
                          i < groupOptions.length - 1
                            ? "border-b border-white/40"
                            : ""
                        }
                      >
                        <RadioRow
                          label={opt.label}
                          multi
                          selected={group.includes(opt.key)}
                          onPress={() => setGroup(toggleValue(group, opt.key))}
                        />
                      </View>
                    ))
                  )}
                </View>
                {dateRange === "custom" ? (
                  <CustomRangePicker
                    startDate={startDate}
                    endDate={endDate}
                    onChange={(start, end) => {
                      setStartDate(start);
                      setEndDate(end);
                    }}
                  />
                ) : null}
              </ScrollView>
            </View>
            <View
              className="px-5 pt-3"
              style={{ paddingBottom: insets.bottom + 16 }}
            >
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleReset}
                className="mb-3 items-center rounded-full border-2 py-3"
                style={{ borderColor: colors.teal }}
              >
                <Text
                  className="text-[14px] font-extrabold"
                  style={{ color: colors.teal }}
                >
                  Reset
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={canApply ? 0.9 : 1}
                disabled={!canApply}
                onPress={() =>
                  onApply({
                    type,
                    dateRange,
                    member,
                    group,
                    startDate: dateRange === "custom" ? startDate : null,
                    endDate: dateRange === "custom" ? endDate : null,
                    active:
                      type !== "all" ||
                      dateRange !== "all" ||
                      member.length > 0 ||
                      group.length > 0,
                  })
                }
                className="items-center rounded-full bg-[#149C73] py-4"
                style={[cardShadow, { opacity: canApply ? 1 : 0.5 }]}
              >
                <Text className="text-[15px] font-extrabold text-white">
                  Apply Filters
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   SCREENS
   ──────────────────────────────────────────────────────────────────────── */

function MainScreen({
  onNavigate,
  onOpenFilters,
  appliedFilters,
  onApplyFilters,
  onResetFilters,
  filterVisible,
  onCloseFilters,
}: {
  onNavigate: (s: Screen) => void;
  onOpenFilters: () => void;
  appliedFilters: ActivityFilters | null;
  onApplyFilters: (f: ActivityFilters) => void;
  onResetFilters: () => void;
  filterVisible: boolean;
  onCloseFilters: () => void;
}) {
  const [activeFilter, setActiveFilter] = useState<"all" | ActivityType>("all");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [records, setRecords] = useState<BackendActivity[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  // Quick tabs take precedence; otherwise the Filter sheet selections apply.
  const effectiveType: "all" | ActivityType =
    activeFilter !== "all" ? activeFilter : (appliedFilters?.type ?? "all");
  const effectiveMember = useMemo(
    () => appliedFilters?.member ?? [],
    [appliedFilters],
  );
  const effectiveGroup = useMemo(
    () => appliedFilters?.group ?? [],
    [appliedFilters],
  );
  const effectiveDateRange: ActivityDateRange = (appliedFilters?.dateRange ??
    "all") as ActivityDateRange;
  const effectiveStartDate =
    appliedFilters?.dateRange === "custom"
      ? (appliedFilters?.startDate ?? null)
      : null;
  const effectiveEndDate =
    appliedFilters?.dateRange === "custom"
      ? (appliedFilters?.endDate ?? null)
      : null;

  // Debounce keystrokes so typing does not fire a request per character.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    setRecords(null);
    setLoadError(false);
    fetchActivities({
      type: effectiveType,
      member: effectiveMember,
      group: effectiveGroup,
      date_range: effectiveDateRange,
      start_date: effectiveStartDate,
      end_date: effectiveEndDate,
      search: debouncedQuery,
    })
      .then((result) => {
        if (!cancelled) setRecords(result);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [
    effectiveType,
    effectiveMember,
    effectiveGroup,
    effectiveDateRange,
    effectiveStartDate,
    effectiveEndDate,
    debouncedQuery,
  ]);

  const availableGroups = (() => {
    const names = new Set<string>();
    for (const record of records ?? []) {
      if (record.group_name) names.add(record.group_name);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  })();

  const sections: ActivitySection[] = (() => {
    if (!records) return [];
    const occurredById = new Map(records.map((r) => [r.id, r.occurred_at]));
    // Text search runs on the backend (q param); group the returned rows.
    const items = records.map(toActivityItem);
    return groupItemsByDay(items, occurredById);
  })();

  const isLoading = records === null && !loadError;

  const handleItemPress = (item: ActivityItem) => {
    if (item.type === "expense")
      onNavigate({ name: "expense", params: { id: item.id } });
    else if (item.type === "settlement")
      onNavigate({ name: "settlement", params: { id: item.id } });
    else if (item.type === "group")
      onNavigate({ name: "group-update", params: { id: item.id } });
    else onNavigate({ name: "event", params: { id: item.id } });
  };

  return (
    <View className="flex-1">
      <ScreenBackground />
      <SafeAreaView edges={["top"]} className="flex-1">
        <View className="px-5 pb-3 pt-5">
          <Text
            className="text-[28px] font-extrabold text-[#0B3D62]"
            style={{
              textShadowColor: "rgba(255,255,255,0.75)",
              textShadowRadius: 10,
              textShadowOffset: { width: 0, height: 1 },
            }}
          >
            Activity
          </Text>
        </View>

        <View className="mx-5 mb-4 flex-row items-center">
          <View className="flex-1 rounded-full" style={[cardShadow, glassBg]}>
            <View className="h-12 flex-row items-center overflow-hidden rounded-full border border-white/70 px-4">
              <GlassLayers radius={24} />
              <View className="absolute inset-0 bg-white/50" />
              <Ionicons name="search" size={18} color={colors.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search activities..."
                placeholderTextColor={colors.faint}
                className="ml-2.5 flex-1 text-[14px] text-[#0B3D62]"
              />
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={onOpenFilters}
            className="ml-2.5 h-12 w-12 items-center justify-center rounded-full border border-white/70 overflow-hidden"
            style={[cardShadow, glassBg]}
          >
            <GlassLayers radius={24} />
            <View className="absolute inset-0 bg-white/50" />
            <Ionicons name="options" size={19} color={colors.navy} />
            {appliedFilters?.active ? (
              <View className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-[#F04F38]" />
            ) : null}
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-4 px-0"
          contentContainerClassName="px-5"
          style={{ flexGrow: 0, flexShrink: 0, height: 40 }}
        >
          {filters
            .filter((f) => f.key !== "group")
            .map((f, index, list) => {
              const active = activeFilter === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  activeOpacity={0.85}
                  onPress={() => setActiveFilter(f.key)}
                  className={`${index === list.length - 1 ? "mr-0" : "mr-2"} flex-row items-center overflow-hidden rounded-full border px-3.5 py-2`}
                  style={[
                    { flexShrink: 0 },
                    active
                      ? {
                          borderColor: "transparent",
                          backgroundColor: colors.teal,
                          ...cardShadow,
                          shadowColor: colors.teal,
                          shadowOpacity: 0.2,
                          shadowRadius: 5,
                          shadowOffset: { width: 0, height: 3 },
                        }
                      : {
                          borderColor: "rgba(255,255,255,0.7)",
                          backgroundColor: "rgba(255,255,255,0.45)",
                        },
                  ]}
                >
                  {!active ? <GlassLayers radius={24} /> : null}
                  <Ionicons
                    name={f.icon}
                    size={12}
                    color={active ? "#FFFFFF" : colors.navySoft}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    className={`text-[12.5px] font-bold ${active ? "text-white" : "text-[#3E6E8E]"}`}
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
        >
          {isLoading ? (
            <View className="mt-16 items-center px-8">
              <ActivityIndicator size="large" color={colors.teal} />
              <Text className="mt-4 text-[14px] font-semibold text-[#0B3D62]">
                Loading activity...
              </Text>
            </View>
          ) : loadError ? (
            <View className="mt-16 items-center px-8">
              <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-white/40">
                <Ionicons
                  name="cloud-offline-outline"
                  size={32}
                  color={colors.faint}
                />
              </View>
              <Text className="text-[16px] font-extrabold text-[#0B3D62]">
                Couldn't load activity
              </Text>
              <Text className="mt-1 text-center text-[13px] text-[#5B7C93]">
                Check your connection and try again.
              </Text>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  setRecords(null);
                  setLoadError(false);
                  fetchActivities({
                    type: effectiveType,
                    member: effectiveMember,
                    group: effectiveGroup,
                    date_range: effectiveDateRange,
                    start_date: effectiveStartDate,
                    end_date: effectiveEndDate,
                    search: debouncedQuery,
                  })
                    .then(setRecords)
                    .catch(() => setLoadError(true));
                }}
                className="mt-5 items-center rounded-full bg-[#149C73] px-6 py-3"
              >
                <Text className="text-[14px] font-extrabold text-white">
                  Retry
                </Text>
              </TouchableOpacity>
            </View>
          ) : sections.length === 0 ? (
            <View className="mt-16 items-center px-8">
              <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-white/40">
                <Ionicons name="search" size={32} color={colors.faint} />
              </View>
              <Text className="text-[16px] font-extrabold text-[#0B3D62]">
                No activity yet
              </Text>
              <Text className="mt-1 text-center text-[13px] text-[#5B7C93]">
                All group activities like expenses, settlements and member
                updates will appear here.
              </Text>
            </View>
          ) : (
            sections.map((section) => (
              <View
                key={section.key}
                className={activeFilter === "all" ? "mb-8" : "mb-6"}
              >
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
                          onPress={() => handleItemPress(item)}
                          className={
                            index === section.items.length - 1
                              ? "flex-row items-center py-4"
                              : "flex-row items-center border-b border-white/40 py-4"
                          }
                        >
                          <View
                            className="mr-3.5 h-11 w-11 items-center justify-center rounded-full"
                            style={{ backgroundColor: item.iconBg }}
                          >
                            <Ionicons
                              name={item.icon}
                              size={19}
                              color={item.iconColor}
                            />
                          </View>
                          <View className="flex-1">
                            <Text
                              numberOfLines={1}
                              className="text-[14px] font-bold text-[#0B3D62]"
                            >
                              {item.title}
                            </Text>
                            {item.subtitle ? (
                              <Text
                                numberOfLines={1}
                                className="mt-0.5 text-[12px] text-[#5B7C93]"
                              >
                                {item.subtitle}
                              </Text>
                            ) : null}
                          </View>
                          <View className="ml-2 items-end">
                            {item.time ? (
                              <Text className="mb-1 text-[11px] text-[#8DA0B1]">
                                {item.time}
                              </Text>
                            ) : null}
                            {item.amount ? (
                              <Text
                                className="text-[15px] font-extrabold"
                                style={{
                                  color: item.amountColor ?? colors.navy,
                                }}
                              >
                                {item.amount}
                              </Text>
                            ) : (
                              <Ionicons
                                name="chevron-forward"
                                size={16}
                                color={colors.faint}
                              />
                            )}
                          </View>
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
      <ActivityFilterModal
        visible={filterVisible}
        onClose={onCloseFilters}
        onApply={onApplyFilters}
        onReset={onResetFilters}
        groups={availableGroups}
      />
    </View>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   DYNAMIC DETAIL — every detail screen fetches its record by id from
   GET /api/activities/{id}. No mock payloads remain in these paths.
   ──────────────────────────────────────────────────────────────────────── */

function useActivityDetail(activityId: string) {
  const [record, setRecord] = useState<BackendActivity | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setRecord(null);
    setFailed(false);
    fetchActivityById(activityId)
      .then((result) => {
        if (!cancelled) setRecord(result);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [activityId, attempt]);

  return { record, failed, retry: () => setAttempt((n) => n + 1) };
}

function DetailStatus({
  failed,
  onRetry,
}: {
  failed: boolean;
  onRetry: () => void;
}) {
  if (!failed) {
    return (
      <View className="mt-16 items-center px-8">
        <ActivityIndicator size="large" color={colors.teal} />
        <Text className="mt-4 text-[14px] font-semibold text-[#0B3D62]">
          Loading details...
        </Text>
      </View>
    );
  }
  return (
    <View className="mt-16 items-center px-8">
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
        onPress={onRetry}
        className="mt-5 items-center rounded-full bg-[#149C73] px-6 py-3"
      >
        <Text className="text-[14px] font-extrabold text-white">Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

function detailParticipants(record: BackendActivity) {
  if (!Array.isArray(record.participants)) return [];
  return record.participants
    .filter(
      (p) => p && typeof p.name === "string" && typeof p.share === "string",
    )
    .map((p) => ({
      name: p.name,
      share: p.share,
      avatar: typeof p.avatar === "string" ? p.avatar : null,
    }));
}

function ExpenseScreen({
  onBack,
  activityId,
}: {
  onBack: () => void;
  activityId: string;
}) {
  const { record: e, failed, retry } = useActivityDetail(activityId);
  return (
    <View className="flex-1">
      <ScreenBackground />
      <SafeAreaView edges={["top"]} className="flex-1">
        <DetailHeader title="Activity Details" onBack={onBack} />
        {!e ? (
          <DetailStatus failed={failed} onRetry={retry} />
        ) : (
          <ScrollView
            className="px-5"
            showsVerticalScrollIndicator={false}
            contentContainerClassName="pb-44"
          >
            <View className="mb-4">
              <GlassCard>
                <View className="flex-row items-center">
                  <View
                    className="mr-3.5 h-12 w-12 items-center justify-center rounded-full"
                    style={{ backgroundColor: colors.redBg }}
                  >
                    <Ionicons name="restaurant" size={21} color={colors.red} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[16px] font-extrabold text-[#0B3D62]">
                      {e.title}
                    </Text>
                    <Text className="mt-1 text-[12px] text-[#8DA0B1]">
                      {formatDateTime(e.occurred_at)}
                    </Text>
                  </View>
                </View>
                {e.amount ? (
                  <Text className="mt-3 text-[26px] font-extrabold text-[#0B3D62]">
                    {e.amount}
                  </Text>
                ) : null}
              </GlassCard>
            </View>

            <View className="mb-4">
              <GlassCard>
                <InfoRow
                  label="Added by"
                  value={e.actor_name ?? "—"}
                  avatarUri={e.actor_avatar ?? undefined}
                />
                {e.group_name ? (
                  <InfoRow
                    label="Group"
                    value={e.group_name}
                    icon="airplane"
                    iconColor={colors.teal}
                    iconBg={colors.tealBg}
                  />
                ) : null}
                {e.category ? (
                  <InfoRow
                    label="Category"
                    value={e.category}
                    icon="flame"
                    iconColor={colors.orange}
                    iconBg={colors.orangeBg}
                  />
                ) : null}
                {e.split_type ? (
                  <InfoRow label="Split Type" value={e.split_type} />
                ) : null}
                {e.split_among ? (
                  <InfoRow label="Split Among" value={e.split_among} />
                ) : null}
                {e.each_share ? (
                  <InfoRow
                    label="Each Person's Share"
                    value={e.each_share}
                    last
                  />
                ) : null}
              </GlassCard>
            </View>

            {e.description || e.bill_image ? (
              <View className="mb-4">
                <GlassCard>
                  {e.description ? (
                    <>
                      <Text className="mb-1 text-[13px] font-semibold text-[#5B7C93]">
                        Description
                      </Text>
                      <Text className="mb-3 text-[14px] leading-[20px] text-[#0B3D62]">
                        {e.description}
                      </Text>
                    </>
                  ) : null}
                  {e.bill_image ? (
                    <>
                      <Text className="mb-2 text-[13px] font-semibold text-[#5B7C93]">
                        Bill Image
                      </Text>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        className="flex-row items-center justify-between"
                      >
                        <Image
                          source={{ uri: e.bill_image }}
                          className="h-14 w-14 rounded-xl"
                        />
                        <Ionicons
                          name="chevron-forward"
                          size={18}
                          color={colors.faint}
                        />
                      </TouchableOpacity>
                    </>
                  ) : null}
                </GlassCard>
              </View>
            ) : null}

            {detailParticipants(e).length > 0 ? (
              <GlassCard>
                <Text className="mb-1 text-[13px] font-extrabold text-[#0B3D62]">
                  Participants
                </Text>
                {detailParticipants(e).map((p, i, arr) => (
                  <View
                    key={p.name}
                    className={`flex-row items-center justify-between py-3 ${i < arr.length - 1 ? "border-b border-white/40" : ""}`}
                  >
                    <View className="flex-row items-center">
                      {p.avatar ? (
                        <Image
                          source={{ uri: p.avatar }}
                          className="mr-2.5 h-8 w-8 rounded-full"
                        />
                      ) : (
                        <View
                          className="mr-2.5 h-8 w-8 items-center justify-center rounded-full"
                          style={{ backgroundColor: colors.tealBg }}
                        >
                          <Text
                            className="text-[13px] font-extrabold"
                            style={{ color: colors.teal }}
                          >
                            {p.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <Text className="text-[14px] font-semibold text-[#0B3D62]">
                        {p.name}
                      </Text>
                    </View>
                    <Text className="text-[14px] font-extrabold text-[#0B3D62]">
                      {p.share}
                    </Text>
                  </View>
                ))}
              </GlassCard>
            ) : null}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

function SettlementScreen({
  onBack,
  activityId,
}: {
  onBack: () => void;
  activityId: string;
}) {
  const { record: s, failed, retry } = useActivityDetail(activityId);
  const banner =
    s && s.actor_name && s.counterparty_name
      ? `This settlement reduces the pending balance between ${s.actor_name} and ${s.counterparty_name}.`
      : (s?.description ?? "");
  return (
    <View className="flex-1">
      <ScreenBackground />
      <SafeAreaView edges={["top"]} className="flex-1">
        <DetailHeader title="Activity Details" onBack={onBack} />
        {!s ? (
          <DetailStatus failed={failed} onRetry={retry} />
        ) : (
          <ScrollView
            className="px-5"
            showsVerticalScrollIndicator={false}
            contentContainerClassName="pb-44"
          >
            <View className="mb-4">
              <GlassCard>
                <View className="flex-row items-center">
                  <View
                    className="mr-3.5 h-12 w-12 items-center justify-center rounded-full"
                    style={{ backgroundColor: colors.tealBg }}
                  >
                    <Ionicons name="cash" size={21} color={colors.teal} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[16px] font-extrabold text-[#0B3D62]">
                      {s.title}
                    </Text>
                    {s.subtitle ? (
                      <Text className="text-[13px] text-[#5B7C93]">
                        {s.subtitle}
                      </Text>
                    ) : null}
                    <Text className="mt-1 text-[12px] text-[#8DA0B1]">
                      {formatDateTime(s.occurred_at)}
                    </Text>
                  </View>
                </View>
                {s.amount ? (
                  <Text
                    className="mt-3 text-[26px] font-extrabold"
                    style={{ color: colors.teal }}
                  >
                    {s.amount}
                  </Text>
                ) : null}
              </GlassCard>
            </View>

            <View className="mb-4">
              <GlassCard>
                <InfoRow
                  label="From"
                  value={s.actor_name ?? "—"}
                  avatarUri={s.actor_avatar ?? undefined}
                />
                <InfoRow
                  label="To"
                  value={s.counterparty_name ?? "—"}
                  avatarUri={s.counterparty_avatar ?? undefined}
                />
                {s.group_name ? (
                  <InfoRow
                    label="Group"
                    value={s.group_name}
                    icon="airplane"
                    iconColor={colors.teal}
                    iconBg={colors.tealBg}
                  />
                ) : null}
                <View className="flex-row items-center justify-between border-b border-white/40 py-3">
                  <Text className="text-[13px] font-semibold text-[#5B7C93]">
                    Status
                  </Text>
                  <StatusPill
                    label={s.status ?? "Pending"}
                    color={colors.teal}
                    bg={colors.tealBg}
                  />
                </View>
                <InfoRow label="Note" value={s.description ?? "—"} last />
              </GlassCard>
            </View>

            {banner !== "" ? <NoteBanner text={banner} /> : null}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

function EventScreen({
  onBack,
  onNavigate,
  activityId,
}: {
  onBack: () => void;
  onNavigate: (s: Screen) => void;
  activityId: string;
}) {
  const { record: ev, failed, retry } = useActivityDetail(activityId);
  const visuals = ev ? TYPE_ICONS[ev.type] : TYPE_ICONS.member;
  const memberKey = ev?.member_key ?? ev?.counterparty_name ?? "";
  return (
    <View className="flex-1">
      <ScreenBackground />
      <SafeAreaView edges={["top"]} className="flex-1">
        <DetailHeader title="Activity Details" onBack={onBack} />
        {!ev ? (
          <DetailStatus failed={failed} onRetry={retry} />
        ) : (
          <ScrollView
            className="px-5"
            showsVerticalScrollIndicator={false}
            contentContainerClassName="pb-44"
          >
            <View className="mb-4">
              <GlassCard>
                <View className="flex-row items-center">
                  <View
                    className="mr-3.5 h-12 w-12 items-center justify-center rounded-full"
                    style={{ backgroundColor: visuals.iconBg }}
                  >
                    <Ionicons
                      name={visuals.icon}
                      size={21}
                      color={visuals.iconColor}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[16px] font-extrabold text-[#0B3D62]">
                      {ev.title}
                    </Text>
                    <Text className="mt-1 text-[12px] text-[#8DA0B1]">
                      {formatDateTime(ev.occurred_at)}
                    </Text>
                  </View>
                </View>
              </GlassCard>
            </View>

            <View className="mb-4">
              <GlassCard>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() =>
                    onNavigate({ name: "member", params: { memberKey } })
                  }
                  className="flex-row items-center justify-between border-b border-white/40 py-3"
                >
                  <Text className="text-[13px] font-semibold text-[#5B7C93]">
                    Member
                  </Text>
                  <View className="flex-row items-center">
                    {ev.counterparty_avatar ? (
                      <Image
                        source={{ uri: ev.counterparty_avatar }}
                        className="mr-2 h-7 w-7 rounded-full"
                      />
                    ) : null}
                    <View>
                      <Text className="text-[14px] font-bold text-[#0B3D62]">
                        {ev.counterparty_name ?? ev.actor_name ?? "—"}
                      </Text>
                      {ev.counterparty_sub ? (
                        <Text className="text-[11px] text-[#8DA0B1]">
                          {ev.counterparty_sub}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </TouchableOpacity>
                {ev.group_name ? (
                  <InfoRow
                    label="Group"
                    value={ev.group_name}
                    icon="airplane"
                    iconColor={colors.teal}
                    iconBg={colors.tealBg}
                  />
                ) : null}
                {ev.actor_name ? (
                  <InfoRow
                    label="Invited by"
                    value={ev.actor_name}
                    avatarUri={ev.actor_avatar ?? undefined}
                    last
                  />
                ) : null}
              </GlassCard>
            </View>

            {ev.description ? <NoteBanner text={ev.description} /> : null}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

function GroupUpdateScreen({
  onBack,
  activityId,
}: {
  onBack: () => void;
  activityId: string;
}) {
  const { record: record, failed, retry } = useActivityDetail(activityId);
  const visuals = record ? TYPE_ICONS[record.type] : TYPE_ICONS.group;
  return (
    <View className="flex-1">
      <ScreenBackground />
      <SafeAreaView edges={["top"]} className="flex-1">
        <DetailHeader title="Activity Details" onBack={onBack} />
        {!record ? (
          <DetailStatus failed={failed} onRetry={retry} />
        ) : (
          <ScrollView
            className="px-5"
            showsVerticalScrollIndicator={false}
            contentContainerClassName="pb-44"
          >
            <View className="mb-4">
              <GlassCard>
                <View className="flex-row items-center">
                  <View
                    className="mr-3.5 h-12 w-12 items-center justify-center rounded-full"
                    style={{ backgroundColor: visuals.iconBg }}
                  >
                    <Ionicons
                      name={visuals.icon}
                      size={21}
                      color={visuals.iconColor}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[16px] font-extrabold text-[#0B3D62]">
                      {record.title}
                    </Text>
                    <Text className="mt-1 text-[12px] text-[#8DA0B1]">
                      {formatDateTime(record.occurred_at)}
                    </Text>
                  </View>
                </View>
              </GlassCard>
            </View>

            <View className="mb-4">
              <GlassCard>
                {record.group_name ? (
                  <InfoRow
                    label="Group"
                    value={record.group_name}
                    icon="airplane"
                    iconColor={colors.teal}
                    iconBg={colors.tealBg}
                  />
                ) : null}
                {record.actor_name ? (
                  <InfoRow
                    label="Updated by"
                    value={record.actor_name}
                    avatarUri={record.actor_avatar ?? undefined}
                  />
                ) : null}
                {record.category ? (
                  <InfoRow label="Update type" value={record.category} last />
                ) : null}
              </GlassCard>
            </View>

            {record.description ? (
              <NoteBanner text={record.description} />
            ) : null}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

function MemberScreen({
  onBack,
  memberKey,
}: {
  onBack: () => void;
  memberKey: string;
}) {
  const [activeTab, setActiveTab] = useState<"all" | ActivityType>("all");
  const [records, setRecords] = useState<BackendActivity[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRecords(null);
    setLoadError(false);
    fetchActivities({ type: activeTab, member: memberKey })
      .then((result) => {
        if (!cancelled) setRecords(result);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, memberKey]);

  const profile = (() => {
    for (const record of records ?? []) {
      const name = record.counterparty_name ?? record.actor_name;
      if (name) {
        return {
          name,
          avatar: record.counterparty_avatar ?? record.actor_avatar ?? null,
        };
      }
    }
    return { name: memberKey, avatar: null as string | null };
  })();

  const sections: ActivitySection[] = (() => {
    if (!records) return [];
    const occurredById = new Map(records.map((r) => [r.id, r.occurred_at]));
    return groupItemsByDay(records.map(toActivityItem), occurredById);
  })();

  const isLoading = records === null && !loadError;

  return (
    <View className="flex-1">
      <ScreenBackground />
      <SafeAreaView edges={["top"]} className="flex-1">
        <DetailHeader title="Activity" onBack={onBack} />

        <View
          className="mx-5 mb-4 rounded-[22px] border border-white/60 overflow-hidden"
          style={[cardShadow, glassBg]}
        >
          <GlassLayers radius={22} />
          <View className="flex-row items-center px-4 py-3.5">
            {profile.avatar ? (
              <Image
                source={{ uri: profile.avatar }}
                className="mr-3 h-12 w-12 rounded-full"
              />
            ) : (
              <View
                className="mr-3 h-12 w-12 items-center justify-center rounded-full"
                style={{ backgroundColor: colors.purpleBg }}
              >
                <Text
                  className="text-[18px] font-extrabold"
                  style={{ color: colors.purple }}
                >
                  {profile.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View>
              <Text className="text-[16px] font-extrabold text-[#0B3D62]">
                {profile.name}
              </Text>
              <Text className="mt-0.5 text-[12px] text-[#5B7C93]">
                {isLoading
                  ? "Loading activity..."
                  : `${records?.length ?? 0} recent activities`}
              </Text>
            </View>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-4 px-0"
          contentContainerClassName="px-5"
          style={{ flexGrow: 0, flexShrink: 0, height: 40 }}
        >
          {filters
            .filter((f) => f.key !== "member")
            .map((t, index, list) => {
              const active = activeTab === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  activeOpacity={0.85}
                  onPress={() => setActiveTab(t.key)}
                  className={`${index === list.length - 1 ? "mr-0" : "mr-2"} flex-row items-center overflow-hidden rounded-full border px-3.5 py-2`}
                  style={[
                    { flexShrink: 0 },
                    active
                      ? {
                          borderColor: "transparent",
                          backgroundColor: colors.teal,
                          ...cardShadow,
                          shadowColor: colors.teal,
                          shadowOpacity: 0.2,
                          shadowRadius: 5,
                          shadowOffset: { width: 0, height: 3 },
                        }
                      : {
                          borderColor: "rgba(255,255,255,0.7)",
                          backgroundColor: "rgba(255,255,255,0.45)",
                        },
                  ]}
                >
                  {!active ? <GlassLayers radius={24} /> : null}
                  <Ionicons
                    name={t.icon}
                    size={12}
                    color={active ? "#FFFFFF" : colors.navySoft}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    className={`text-[12.5px] font-bold ${active ? "text-white" : "text-[#3E6E8E]"}`}
                  >
                    {t.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
        </ScrollView>

        <ScrollView
          className="px-5"
          showsVerticalScrollIndicator={false}
          contentContainerClassName="pb-44"
        >
          {isLoading ? (
            <View className="mt-16 items-center px-8">
              <ActivityIndicator size="large" color={colors.teal} />
              <Text className="mt-4 text-[14px] font-semibold text-[#0B3D62]">
                Loading activity...
              </Text>
            </View>
          ) : loadError ? (
            <View className="mt-16 items-center px-8">
              <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-white/40">
                <Ionicons
                  name="cloud-offline-outline"
                  size={32}
                  color={colors.faint}
                />
              </View>
              <Text className="text-[16px] font-extrabold text-[#0B3D62]">
                Couldn't load activity
              </Text>
              <Text className="mt-1 text-center text-[13px] text-[#5B7C93]">
                Check your connection and try again.
              </Text>
            </View>
          ) : sections.length === 0 ? (
            <View className="mt-16 items-center px-8">
              <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-white/40">
                <Ionicons name="search" size={32} color={colors.faint} />
              </View>
              <Text className="text-[16px] font-extrabold text-[#0B3D62]">
                No activity yet
              </Text>
              <Text className="mt-1 text-center text-[13px] text-[#5B7C93]">
                {profile.name}'s activity in this group will appear here.
              </Text>
            </View>
          ) : (
            sections.map((section) => (
              <View key={section.key} className="mb-6">
                <Text className="mb-3 text-[13px] font-bold text-[#0B3D62]">
                  {section.label}
                </Text>
                <GlassCard>
                  <View className="-m-4 px-4">
                    {section.items.map((item, index) => (
                      <TouchableOpacity
                        key={item.id}
                        activeOpacity={0.8}
                        className={
                          index === section.items.length - 1
                            ? "flex-row items-center py-4"
                            : "flex-row items-center border-b border-white/40 py-4"
                        }
                      >
                        <View
                          className="mr-3.5 h-11 w-11 items-center justify-center rounded-full"
                          style={{ backgroundColor: item.iconBg }}
                        >
                          <Ionicons
                            name={item.icon}
                            size={19}
                            color={item.iconColor}
                          />
                        </View>
                        <View className="flex-1">
                          <Text
                            numberOfLines={1}
                            className="text-[14px] font-bold text-[#0B3D62]"
                          >
                            {item.title}
                          </Text>
                          {item.subtitle ? (
                            <Text
                              numberOfLines={1}
                              className="mt-0.5 text-[12px] text-[#5B7C93]"
                            >
                              {item.subtitle}
                            </Text>
                          ) : null}
                        </View>
                        <View className="ml-2 items-end">
                          {item.time ? (
                            <Text className="mb-1 text-[11px] text-[#8DA0B1]">
                              {item.time}
                            </Text>
                          ) : null}
                          {item.amount ? (
                            <Text className="text-[15px] font-extrabold text-[#0B3D62]">
                              {item.amount}
                            </Text>
                          ) : null}
                        </View>
                      </TouchableOpacity>
                    ))}
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

/* ────────────────────────────────────────────────────────────────────────
   ROOT — swap this internal stack for expo-router later if you want deep
   links; for now everything lives in this one file and "just works".
   ──────────────────────────────────────────────────────────────────────── */

export default function ActivityFlow() {
  const [stack, setStack] = useState<Screen[]>([{ name: "main" }]);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<ActivityFilters | null>(
    null,
  );
  const params = useLocalSearchParams<{
    activityId?: string | string[];
    ts?: string | string[];
  }>();
  const deepLinkConsumedRef = useRef<string | null>(null);

  const push = (screen: Screen) => setStack((s) => [...s, screen]);
  const pop = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  const current = stack[stack.length - 1];
  const isMain = current.name === "main";

  // Home recent-expense drill: open the expense detail directly.
  // The detail screen fetches its own record by id (loading/error/retry
  // included), so nothing is trusted from the link except the id.
  // Focus-driven (not mount-only) so the detail opens whenever Home
  // navigates here. The `ts` nonce is part of the consumed key so repeat
  // taps on the same expense still open it; plain tab-bar visits carry
  // no fresh nonce and leave the list untouched. Only pushes from the
  // main list — never stacks duplicates over an open detail.
  useFocusEffect(
    useCallback(() => {
      const rawId = params.activityId;
      const rawTs = params.ts;
      const id = Array.isArray(rawId) ? rawId[0] : rawId;
      if (!id) return;
      const ts = Array.isArray(rawTs) ? rawTs[0] : rawTs;
      const key = `${id}:${ts ?? ""}`;
      if (deepLinkConsumedRef.current === key) return;
      deepLinkConsumedRef.current = key;
      setStack((st) => {
        if (st.length === 1 && st[0].name === "main") {
          return [...st, { name: "expense", params: { id } }];
        }
        return st;
      });
    }, [params.activityId, params.ts]),
  );

  // Android hardware Back mirrors the visible Detail Back button: pop the
  // internal stack when a detail is open, otherwise let the OS/router
  // handle it (exit tab). Functional setState avoids stale closures.
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        let handled = false;
        setStack((s) => {
          if (s.length > 1) {
            handled = true;
            return s.slice(0, -1);
          }
          return s;
        });
        return handled;
      },
    );
    return () => subscription.remove();
  }, []);

  return (
    // MainScreen stays mounted while a detail is open (hidden, not
    // unmounted) so search query, quick tab, applied filters, custom
    // range, and fetched results survive Detail -> Back.
    <View className="flex-1">
      <View className="flex-1" style={isMain ? undefined : { display: "none" }}>
        <MainScreen
          onNavigate={push}
          onOpenFilters={() => setFilterModalVisible(true)}
          appliedFilters={appliedFilters}
          onApplyFilters={(f) => {
            setAppliedFilters(f);
            setFilterModalVisible(false);
          }}
          onResetFilters={() => {
            setAppliedFilters({ ...INITIAL_FILTERS });
            setFilterModalVisible(false);
          }}
          filterVisible={filterModalVisible}
          onCloseFilters={() => setFilterModalVisible(false)}
        />
      </View>
      {current.name === "expense" && (
        <ExpenseScreen onBack={pop} activityId={current.params.id} />
      )}
      {current.name === "settlement" && (
        <SettlementScreen onBack={pop} activityId={current.params.id} />
      )}
      {current.name === "event" && (
        <EventScreen
          onBack={pop}
          onNavigate={push}
          activityId={current.params.id}
        />
      )}
      {current.name === "group-update" && (
        <GroupUpdateScreen onBack={pop} activityId={current.params.id} />
      )}
      {current.name === "member" && (
        <MemberScreen onBack={pop} memberKey={current.params.memberKey} />
      )}
    </View>
  );
}
