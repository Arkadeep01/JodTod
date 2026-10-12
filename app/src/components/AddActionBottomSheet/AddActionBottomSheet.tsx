import React from 'react';
import { View, Text, TouchableOpacity, Dimensions, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const BACKDROP_OPACITY = 0.12;

export const ADD_ACTION_COLORS = {
  primaryGreen: '#4CD3A5',
  primaryGreenLight: 'rgba(76, 211, 165, 0.15)',
  primaryGreenBorder: 'rgba(76, 211, 165, 0.3)',
  brandTeal: '#00B894',
  brandTealDark: '#00896B',
  textDark: '#14212B',
  textMuted: '#4B5A66',
  textLight: '#8A94A6',
  danger: '#E85D5D',
  dangerBg: 'rgba(232,93,93,0.12)',
  white: '#FFFFFF',
  glassBg: 'rgba(255, 255, 255, 0.25)',
  glassBorder: 'rgba(255, 255, 255, 0.35)',
  glassBorderStrong: 'rgba(255, 255, 255, 0.5)',
  backdropBg: 'rgba(0, 0, 0, 0.12)',
  comingSoonBg: 'rgba(138, 148, 166, 0.15)',
  comingSoonText: '#8A94A6',
};

interface ActionCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  iconBgColor: string;
  iconColor: string;
  borderColor?: string;
  isPrimary?: boolean;
  comingSoon?: boolean;
  blurTarget?: React.RefObject<View | null>;
  onPress: () => void;
}

function ActionCard({
  icon,
  title,
  subtitle,
  iconBgColor,
  iconColor,
  comingSoon = false,
  blurTarget,
  onPress,
}: ActionCardProps) {
  const pressScale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const handlePressIn = () => {
    pressScale.value = withSpring(0.96, { damping: 20, stiffness: 200 });
  };

  const handlePressOut = () => {
    pressScale.value = withSpring(1, { damping: 20, stiffness: 200 });
    // NOTE: must NOT call onPress here. The TouchableOpacity `onPress`
    // prop below already fires it on a valid tap; calling it from
    // onPressOut as well double-invoked every action (double
    // router.push → duplicate screens / stale sheet state).
  };

  return (
    <TouchableOpacity
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      activeOpacity={1}
      className="w-full"
    >
      <Animated.View style={animatedStyle}>
        <View
          className="flex-row items-center gap-4 p-4 rounded-2xl border overflow-hidden"
          style={{
            borderColor: 'rgba(255,255,255,0.18)',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.3,
            shadowRadius: 12,
            elevation: 6,
          }}
        >
          {blurTarget ? (
            <BlurView
              blurTarget={blurTarget}
              blurMethod="dimezisBlurView"
              intensity={45}
              tint="dark"
              style={actionCardStyles.iconBlur}
            />
          ) : (
            <BlurView intensity={45} tint="dark" style={actionCardStyles.iconBlur} />
          )}
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: 'rgba(5,20,35,0.5)', borderRadius: 16 },
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
          <View
            className="items-center justify-center"
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              backgroundColor: iconBgColor,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.15)',
            }}
          >
            <Ionicons name={icon} size={22} color={iconColor} />
          </View>

          <View className="flex-1 min-w-0">
            <Text
              className="text-base font-bold text-white"
              numberOfLines={1}
            >
              {title}
            </Text>
            <Text
              className="mt-0.5 text-sm text-white/60"
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          </View>

          {comingSoon && (
            <View className="px-3 py-1 rounded-full border border-white/20" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
              <Text className="font-semibold text-[11px] text-white/65">
                Coming Soon
              </Text>
            </View>
          )}

          {!comingSoon && (
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.4)" />
          )}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

const actionCardStyles = StyleSheet.create({
  iconBlur: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
  },
});

export interface AddActionBottomSheetProps {
  visible: boolean;
  groupName: string;
  /**
   * Ref to the BlurTargetView wrapping the Tabs content. The open-state
   * blur layer targets it so the entire screen behind the menu is blurred.
   * Optional: when absent the blur layer is skipped (dim only).
   */
  blurTarget?: React.RefObject<View | null>;
  onClose: () => void;
  onAddExpense: () => void;
  onAddSettlement: () => void;
  onAddMember: () => void;
  onScanReceipt: () => void;
  onScanJoin: () => void;
}

export default function AddActionBottomSheet({
  visible,
  groupName,
  blurTarget,
  onClose,
  onAddExpense,
  onAddSettlement,
  onAddMember,
  onScanReceipt,
  onScanJoin,
}: AddActionBottomSheetProps) {
  const insets = useSafeAreaInsets();

  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);
  const handleOpacity = useSharedValue(0);

  React.useEffect(() => {
    // The overlay tree stays mounted at all times. Opening/closing touches
    // ONLY UI-thread shared values: zero React state changes, zero remounts,
    // zero re-renders mid-animation — one continuous 60fps glide.
    if (visible) {
      // Reset values before animating in
      translateY.value = SCREEN_HEIGHT;
      backdropOpacity.value = 0;
      handleOpacity.value = 0;

      translateY.value = withTiming(0, {
        duration: 320,
        easing: Easing.out(Easing.cubic),
      });
      backdropOpacity.value = withTiming(BACKDROP_OPACITY, { duration: 200 });
      handleOpacity.value = withTiming(1, { duration: 200 });
    } else {
      translateY.value = withTiming(SCREEN_HEIGHT, {
        duration: 220,
        easing: Easing.in(Easing.cubic),
      });
      backdropOpacity.value = withTiming(0, { duration: 150 });
      handleOpacity.value = withTiming(0, { duration: 100 });
    }
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  // Full-screen open-state blur: fades in/out in sync with the dim backdrop.
  // Closed (opacity 0 / unmounted) = no extra blur over Home.
  const openBlurStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const handleStyle = useAnimatedStyle(() => ({
    opacity: handleOpacity.value,
  }));

  const handleBackdropPress = () => {
    onClose();
  };

  const handleClosePress = () => {
    onClose();
  };

  return (
    <View
      className="absolute inset-0 z-50"
      pointerEvents={visible ? 'auto' : 'none'}
    >
    {/* Backdrop press layer. Sibling of the sheet below (NOT its parent):
        the sheet used to be nested inside this TouchableOpacity, so taps
        on action cards bubbled up to handleBackdropPress and the card's
        own navigation handler never reliably fired. */}
    <TouchableOpacity
      onPress={handleBackdropPress}
      activeOpacity={1}
      className="absolute inset-0"
      disabled={!visible}
    >
      <Animated.View
        className="absolute inset-0"
        style={[sheetStyles.backdrop, backdropStyle]}
        pointerEvents="none"
      />

      {blurTarget && (
        <Animated.View
          className="absolute inset-0"
          style={openBlurStyle}
          pointerEvents="none"
        >
          <BlurView
            blurTarget={blurTarget}
            blurMethod="dimezisBlurView"
            intensity={65}
            tint="light"
            style={StyleSheet.absoluteFill}
          />
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: 'rgba(255,255,255,0.28)' },
            ]}
          />
        </Animated.View>
      )}
    </TouchableOpacity>

      <Animated.View
        className="absolute left-0 right-0 bottom-0 overflow-hidden"
        style={[
          sheetStyles.sheetContainer,
          sheetStyle,
          { borderTopLeftRadius: 24, borderTopRightRadius: 24 },
        ]}
      >
        <Animated.View style={[sheetStyles.dragHandleContainer, handleStyle]}>
          <View className="w-10 h-1.5 rounded-full bg-white/50" />
        </Animated.View>

        {blurTarget ? (
          <BlurView
            blurTarget={blurTarget}
            blurMethod="dimezisBlurView"
            intensity={60}
            tint="dark"
            className="absolute inset-0"
            style={{ borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
          />
        ) : (
          <BlurView intensity={60} tint="dark" className="absolute inset-0" style={{ borderTopLeftRadius: 24, borderTopRightRadius: 24 }} />
        )}
        <View
          pointerEvents="none"
          className="absolute inset-0"
          style={{ backgroundColor: 'rgba(5,20,35,0.45)', borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
        />

        <View
          className="px-5"
          style={{
            paddingTop: 8,
            paddingBottom: insets.bottom + 20,
          }}
        >
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-bold text-white" numberOfLines={1}>
              Add to {groupName}
            </Text>
          </View>

          <View className="gap-3 mb-4">
            <ActionCard
              icon="receipt-outline"
              title="Add Expense"
              subtitle="Record a new expense"
              iconBgColor="rgba(76, 211, 165, 0.15)"
              iconColor="#4CD3A5"
              borderColor="rgba(76, 211, 165, 0.3)"
              isPrimary
              blurTarget={blurTarget}
              onPress={onAddExpense}
            />

            <ActionCard
              icon="scan-outline"
              title="Add Receipt"
              subtitle="Scan or upload a receipt"
              iconBgColor="rgba(0, 184, 148, 0.14)"
              iconColor="#4CD3A5"
              borderColor="rgba(0, 184, 148, 0.25)"
              blurTarget={blurTarget}
              onPress={onScanReceipt}
            />

            <ActionCard
              icon="person-add-outline"
              title="Add Member"
              subtitle="Invite someone to your group"
              iconBgColor="rgba(79, 172, 254, 0.12)"
              iconColor="#3268A6"
              borderColor="rgba(79, 172, 254, 0.25)"
              blurTarget={blurTarget}
              onPress={onAddMember}
            />

            <ActionCard
              icon="people-outline"
              title="Add Group"
              subtitle="Create a new expense group"
              iconBgColor="rgba(167, 139, 250, 0.14)"
              iconColor="#A78BFA"
              borderColor="rgba(167, 139, 250, 0.25)"
              blurTarget={blurTarget}
              onPress={onAddSettlement}
            />

            <ActionCard
              icon="qr-code-outline"
              title="Scan QR to Join"
              subtitle="Scan a group invite code"
              iconBgColor="rgba(56, 189, 248, 0.14)"
              iconColor="#38BDF8"
              borderColor="rgba(56, 189, 248, 0.25)"
              blurTarget={blurTarget}
              onPress={onScanJoin}
            />
          </View>

          <TouchableOpacity
            onPress={handleClosePress}
            activeOpacity={0.8}
            className="w-full"
          >
            <View
              className="flex-row items-center justify-center py-3.5 rounded-2xl border border-white/20"
              style={{ backgroundColor: 'rgba(5,20,35,0.5)' }}
            >
              <Text className="text-base font-bold text-white">Cancel</Text>
            </View>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const sheetStyles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
  },
  sheetContainer: {
    overflow: 'hidden',
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
});