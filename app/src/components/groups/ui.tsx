import { ReactNode } from 'react';
import { View, Text, TouchableOpacity, TextInput, Image, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ---------------------------------------------------------------------------
// Shared palette — settle-tab theme (navy + teal glass). Same key names so
// every Groups screen picks up the new look with zero text changes.
// ---------------------------------------------------------------------------

export const colors = {
  brandLight: '#34C99E',
  brand: '#149C73',
  brandDark: '#0C6E52',
  textDark: '#0B3D62',
  textMuted: '#5B7C93',
  headerTitle: '#0B3D62',
  headerSub: '#3E6E8E',
  inputBorder: 'rgba(255,255,255,0.6)',
  danger: '#F04F38',
  dangerBg: '#FDE3E8',
  success: '#149C73',
  successBg: '#E7F7F2',
  neutralBg: 'rgba(75,90,102,0.10)',
  bg: '#F4FAF8',
  faint: '#8DA0B1',
  infoBlue: '#2563EB',
  infoBlueBg: '#DDEBFF',
  accentOrange: '#E0932E',
  accentOrangeBg: '#FFF3DE',
};

const GROUP_BG_IMAGE = require('../../../assets/images/jodtod/background_home.png');

export const cardShadow = {
  shadowColor: '#0B3D62',
  shadowOffset: { width: 0, height: 5 },
  shadowOpacity: 0.1,
  shadowRadius: 9,
  elevation: 4,
};

export const CARD_PADDING_H = 20;

// ---------------------------------------------------------------------------
// Page background — settle-tab artwork (onboarding image + soft veil).
// Fills the whole screen; each page handles its own top/bottom safe padding
// so it looks right on notch phones, tall Android phones, and small phones.
// ---------------------------------------------------------------------------

export function ScreenBackground() {
  return (
    <>
      {/* Decorative art only: a bare Image never becomes the touch
          responder, and the glow orbs below set pointerEvents="none",
          so touches always reach the form cards above. */}
      <Image source={GROUP_BG_IMAGE} className="absolute inset-0 h-full w-full" resizeMode="cover" />
      {/* Soft glow orbs for depth — background artwork stays visible through the glass */}
      <View
        className="absolute rounded-full"
        pointerEvents="none"
        style={{ width: 280, height: 280, top: -90, right: -80, backgroundColor: 'rgba(52,201,158,0.20)' }}
      />
      <View
        className="absolute rounded-full"
        pointerEvents="none"
        style={{ width: 220, height: 220, top: 180, left: -90, backgroundColor: 'rgba(37,99,235,0.12)' }}
      />
      <View
        className="absolute rounded-full"
        pointerEvents="none"
        style={{ width: 260, height: 260, bottom: -100, right: -70, backgroundColor: 'rgba(224,147,46,0.12)' }}
      />
    </>
  );
}

export function BubbleBackdrop({ children }: { children: ReactNode }) {
  return (
    <View style={{ flex: 1 }}>
      <ScreenBackground />
      {children}
    </View>
  );
}

export function GlassLayers({ radius = 24 }: { radius?: number }) {
  return (
    <>
      <BlurView intensity={28} tint="default" style={[StyleSheet.absoluteFill, { borderRadius: radius }]} />
      <LinearGradient
        colors={['rgba(255,255,255,0.38)', 'rgba(198,228,222,0.22)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      />
      <LinearGradient
        colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.4 }}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Glass card — settle-tab recipe (navy shadow, layered glass, white border)
// ---------------------------------------------------------------------------

export function GlassCard({
  children,
  className = 'rounded-[24px]',
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: any;
}) {
  return (
    <View className={`rounded-[24px] ${className}`} style={[cardShadow, { backgroundColor: 'rgba(255,255,255,0.01)' }, style]}>
      <View className="overflow-hidden rounded-[24px] border border-white/60">
        <GlassLayers radius={24} />
        <View className="relative z-10">{children}</View>
      </View>
    </View>
  );
}

export function GlassInput({ children, style }: { children: ReactNode; style?: any }) {
  return (
    <View className="overflow-hidden rounded-2xl border border-white/40 bg-white/25" style={style}>
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Gradient CTA — capsule pill button, 3 variants
// ---------------------------------------------------------------------------

const CTA_HEIGHT = 52;

export function GradientCTA({
  children,
  onPress,
  disabled,
  variant = 'solid',
  icon,
  outlineColor,
}: {
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  variant?: 'solid' | 'outline' | 'danger';
  icon?: keyof typeof Ionicons.glyphMap | null;
  outlineColor?: string;
}) {
  const radius = CTA_HEIGHT / 2;

  if (variant === 'outline') {
    const bc = outlineColor ?? colors.brand;
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.85}
        className="flex-row items-center justify-center border"
        style={{ height: CTA_HEIGHT, borderRadius: radius, borderColor: bc, gap: 8 }}
      >
        {icon ? <Ionicons name={icon} size={17} color={bc === colors.brand ? colors.brandDark : bc} /> : null}
        {children}
      </TouchableOpacity>
    );
  }

  if (variant === 'danger') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.85}
        className="flex-row items-center justify-center"
        style={{ height: CTA_HEIGHT, borderRadius: radius, backgroundColor: colors.danger, gap: 8 }}
      >
        {icon ? <Ionicons name={icon} size={17} color="#fff" /> : null}
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.9}
      className="items-center justify-center"
      style={{
        height: CTA_HEIGHT,
        borderRadius: radius,
        gap: 8,
        paddingHorizontal: 18,
        overflow: 'hidden',
        ...cardShadow,
        shadowColor: disabled ? 'transparent' : colors.brand,
        shadowOpacity: disabled ? 0 : 0.35,
        elevation: disabled ? 0 : 4,
        backgroundColor: disabled ? '#A9C9BE' : 'transparent',
      }}
    >
      {!disabled ? (
        <LinearGradient
          colors={[colors.brandLight, colors.brandDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
        />
      ) : null}
      <View className="flex-row items-center justify-center" style={{ gap: 8 }}>
        {children}
        {icon ? <Ionicons name={icon} size={17} color={disabled ? colors.textMuted : '#fff'} /> : null}
      </View>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Screen header — back button, title, optional right action.
// Uses safe-area insets so the row always clears the notch / status bar,
// instead of a fixed pt-4 that sits too high on some phones.
// ---------------------------------------------------------------------------

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  rightIcon,
  onRightPress,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightPress?: () => void;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-row items-center justify-between px-5 pb-2"
      style={{ paddingTop: insets.top + 10 }}
    >
      <TouchableOpacity
        onPress={onBack ?? (() => router.back())}
        className="w-10 h-10 rounded-full items-center justify-center border border-white/60 overflow-hidden"
        style={[cardShadow, { backgroundColor: 'rgba(255,255,255,0.01)' }]}
      >
        <GlassLayers radius={20} />
        <View className="absolute inset-0 bg-white/20" />
        <Ionicons name="chevron-back" size={20} color={colors.textDark} />
      </TouchableOpacity>

      <View className="items-center flex-1 mx-2">
        <Text className="text-base font-bold" style={{ color: colors.textDark }} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-[11px]" style={{ color: colors.textMuted }} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {rightIcon ? (
        <TouchableOpacity
          onPress={onRightPress}
          className="w-10 h-10 rounded-full items-center justify-center border border-white/60 overflow-hidden"
          style={[cardShadow, { backgroundColor: 'rgba(255,255,255,0.01)' }]}
        >
          <GlassLayers radius={20} />
          <View className="absolute inset-0 bg-white/20" />
          <Ionicons name={rightIcon} size={19} color={colors.textDark} />
        </TouchableOpacity>
      ) : (
        <View style={{ width: 40 }} />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Avatar — real photo when `photoUri` is set (group cover / member face),
// gradient initials only as a fallback.
// ---------------------------------------------------------------------------

const AVATAR_PALETTE = [
  ['#FF9A8B', '#FF6A88'],
  ['#00E6A8', '#00896B'],
  ['#4FACFE', '#00A9E0'],
  ['#F6D365', '#FDA085'],
  ['#A18CD1', '#FBC2EB'],
  ['#84FAB0', '#8FD3F4'],
];

export function Avatar({ name, size = 36, photoUri }: { name: string; size?: number; photoUri?: string }) {
  if (photoUri) {
    return (
      <Image
        source={{ uri: photoUri }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: '#fff',
          backgroundColor: colors.neutralBg,
        }}
      />
    );
  }

  const idx = name.charCodeAt(0) % AVATAR_PALETTE.length;
  const initials = name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <LinearGradient
      colors={AVATAR_PALETTE[idx] as [string, string]}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#fff',
      }}
    >
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.36 }}>{initials}</Text>
    </LinearGradient>
  );
}

// ---------------------------------------------------------------------------
// Status pill (Active / Completed / Archived)
// ---------------------------------------------------------------------------

export type GroupStatus = 'Active' | 'Completed' | 'Archived';

const STATUS_STYLE: Record<GroupStatus, { bg: string; fg: string }> = {
  Active: { bg: colors.successBg, fg: colors.brandDark },
  Completed: { bg: colors.infoBlueBg, fg: colors.infoBlue },
  Archived: { bg: colors.neutralBg, fg: colors.faint },
};

export function StatusPill({ status }: { status: GroupStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: s.bg }}>
      <Text className="text-[11px] font-bold" style={{ color: s.fg }}>
        {status}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Settings-style row — icon, label, chevron
// ---------------------------------------------------------------------------

export function ActionRow({
  icon,
  label,
  onPress,
  danger,
  iconColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  danger?: boolean;
  iconColor?: string;
}) {
  const fg = danger ? colors.danger : colors.textDark;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="flex-row items-center justify-between py-3.5 border-b border-white/40"
    >
      <View className="flex-row items-center gap-3">
        <View
          className="w-9 h-9 rounded-full items-center justify-center"
          style={{ backgroundColor: danger ? colors.dangerBg : colors.successBg }}
        >
          <Ionicons name={icon} size={17} color={iconColor ?? (danger ? colors.danger : colors.brandDark)} />
        </View>
        <Text className="text-sm font-semibold" style={{ color: fg }}>
          {label}
        </Text>
      </View>
      {!danger && <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />}
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Labeled text field — label above a glass pill input with a leading icon.
// Matches the "Group Name / Destination / Budget..." fields in the
// Create Group & Edit Group screens.
// ---------------------------------------------------------------------------

type LabeledFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  multiline?: boolean;
  keyboardType?: any;
  icon?: keyof typeof Ionicons.glyphMap;
};

export function LabeledField({
  label,
  value,
  onChangeText,
  placeholder,
  autoCapitalize = 'sentences',
  multiline,
  keyboardType,
  icon,
}: LabeledFieldProps) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text className="mb-2 font-bold" style={{ color: colors.textDark, fontSize: 14 }}>
        {label}
      </Text>
      <GlassInput
        style={{
          borderWidth: 1.5,
          borderColor: '#8FE3BB',
          // Nearly-opaque surface: the previous 8% white let the
          // full-bleed photo artwork show through behind the text,
          // destroying contrast. 78% keeps the glass feel while
          // keeping labels/values readable.
          backgroundColor: 'rgba(255,255,255,0.78)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <View
          className="flex-row"
          style={{
            minHeight: multiline ? 90 : 52,
            alignItems: multiline ? 'flex-start' : 'center',
            paddingLeft: 14,
            paddingRight: 14,
          }}
        >
          {icon ? (
            <Ionicons
              name={icon}
              size={17}
              color={colors.brandDark}
              style={{ marginRight: 10, marginTop: multiline ? 14 : 0 }}
            />
          ) : null}
          <TextInput
            className="flex-1 text-sm"
            style={{ color: colors.textDark, paddingVertical: multiline ? 14 : 0 }}
            placeholder={placeholder}
            placeholderTextColor="rgba(20,33,43,0.55)"
            value={value}
            onChangeText={onChangeText}
            autoCapitalize={autoCapitalize}
            multiline={multiline}
            keyboardType={keyboardType}
            textAlignVertical={multiline ? 'top' : 'center'}
          />
        </View>
      </GlassInput>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Money formatter (₹)
// ---------------------------------------------------------------------------

export function inr(n: number) {
  return `₹${n.toLocaleString('en-IN')}`;
}

export { useSafeAreaInsets };
