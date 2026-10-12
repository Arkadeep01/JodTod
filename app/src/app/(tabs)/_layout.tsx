import React from 'react';
import { Redirect, Tabs, useRouter, useSegments } from 'expo-router';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView, BlurTargetView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import AuthLoadingScreen from '../../components/auth/AuthLoadingScreen';
import { AddActionBottomSheet } from '../../components/AddActionBottomSheet';

function isGroupsSubScreen(routeName: string) {
  return routeName.startsWith('groups/') && routeName !== 'groups/index' && routeName !== 'groups/[id]/index';
}

const EXTRA_HIDDEN_ROUTES = ['add-expense'];

function shouldHideTabBar(routeName: string | undefined) {
  if (!routeName) return false;
  if (isGroupsSubScreen(routeName)) return true;
  if (EXTRA_HIDDEN_ROUTES.includes(routeName)) return true;
  return false;
}

// Tab order for directional slide transitions: Home 0, Groups 1, Activity 2, Settle 3.
function tabPositionFromSegments(segments: readonly string[]) {
  if (segments.includes('groups')) return 1;
  if (segments.includes('activity')) return 2;
  if (segments.includes('settle')) return 3;
  return 0;
}

function CustomTabBar({ state, navigation, onAddActionPress, blurTarget, sheetOpen }: any) {
  const insets = useSafeAreaInsets();

  const tabs = [
    { name: 'index', label: 'Home', icon: 'home' },
    { name: 'groups/index', label: 'Groups', icon: 'people' },
    { name: 'activity', label: 'Activity', icon: 'receipt-outline' },
    { name: 'settle', label: 'Settle', icon: 'paper-plane' },
  ];

  const focusedRouteName = state.routes[state.index]?.name as string | undefined;

  // Plus button press + open-state animations (hooks before any early return).
  const plusScale = useSharedValue(1);
  const plusRotate = useSharedValue(0);

  React.useEffect(() => {
    plusRotate.value = withTiming(sheetOpen ? 45 : 0, { duration: 250 });
  }, [sheetOpen, plusRotate]);

  const plusScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: plusScale.value }],
  }));
  const plusIconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${plusRotate.value}deg` }],
  }));

  if (shouldHideTabBar(focusedRouteName)) {
    return null;
  }

  const renderTab = (tab: any) => {
    const routeIndex = state.routes.findIndex((route: any) => route.name === tab.name);
    const isFocused = state.index === routeIndex;

    const handlePress = () => {
      navigation.navigate(tab.name);
    };

    return (
      <TouchableOpacity
        key={tab.name}
        activeOpacity={0.7}
        onPress={handlePress}
        className="flex-1 items-center justify-center"
      >
        <View className="items-center justify-center">
          <Ionicons
            name={tab.icon as keyof typeof Ionicons.glyphMap}
            size={22}
            color={isFocused ? '#34D399' : 'rgba(255,255,255,0.6)'}
          />

          <Text
            className={`mt-1 text-[10px] ${
              isFocused ? 'font-bold' : 'font-medium'
            }`}
            style={{ color: isFocused ? '#34D399' : 'rgba(255,255,255,0.55)' }}
          >
            {tab.label}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const handleAddButtonPress = () => {
    // The "+" tab always opens the action menu, from every tab.
    // It must never navigate directly (previously non-Home tabs pushed
    // /add-expense here, bypassing the menu entirely).
    onAddActionPress();
  };

  const handlePlusPressIn = () => {
    plusScale.value = withSpring(0.88, { damping: 18, stiffness: 260 });
  };
  const handlePlusPressOut = () => {
    plusScale.value = withSpring(1, { damping: 18, stiffness: 260 });
  };

  return (
    <View
      className="absolute left-4 right-4 z-50"
      style={{ bottom: Math.max(insets.bottom, 12) }}
      pointerEvents="box-none"
    >
      <View className="h-[80px] overflow-visible">
        {/* Clipped glass background. overflow-hidden on THIS layer forces the
            native Android blur into the rounded shape. Previously the blur sat
            in the overflow-visible wrapper (needed for the overlapping Plus
            button), so it rendered as an unclipped rectangle behind the dock. */}
        <View
          pointerEvents="none"
          className="absolute inset-0 overflow-hidden rounded-[36px] border border-white/20"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.35,
            shadowRadius: 18,
            elevation: 12,
          }}
        >
          <BlurView
            blurTarget={blurTarget}
            blurMethod="dimezisBlurView"
            intensity={50}
            tint="dark"
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(3,18,32,0.72)',
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 20,
              right: 20,
              height: 1,
              backgroundColor: 'rgba(255,255,255,0.18)',
            }}
          />
        </View>

        <View className="h-[80px] flex-row items-center px-2">
          <View className="flex-1">{renderTab(tabs[0])}</View>
          <View className="flex-1">{renderTab(tabs[1])}</View>

          <View className="w-[64px]" />

          <View className="flex-1">{renderTab(tabs[2])}</View>
          <View className="flex-1">{renderTab(tabs[3])}</View>
        </View>

        <Animated.View
          style={[
            {
              position: 'absolute',
              left: '50%',
              top: 10,
              zIndex: 100,
              marginLeft: -30,
              width: 60,
              height: 60,
            },
            plusScaleStyle,
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleAddButtonPress}
            onPressIn={handlePlusPressIn}
            onPressOut={handlePlusPressOut}
            className="h-[60px] w-[60px]"
          >
            <View
              className="h-[60px] w-[60px] items-center justify-center overflow-hidden rounded-full border border-white/30"
              style={{
                shadowColor: '#34D399',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.65,
                shadowRadius: 14,
                elevation: 10,
              }}
            >
              <LinearGradient
                colors={['#34D399', '#0E9F6E']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 30 }}
              />
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 10,
                  right: 10,
                  height: 1,
                  backgroundColor: 'rgba(255,255,255,0.5)',
                }}
              />
              <Animated.View style={plusIconStyle}>
                <Ionicons name="add" size={30} color="#FFFFFF" />
              </Animated.View>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const router = useRouter();
  const { isLoading, isAuthenticated, isVerificationPending } = useAuth();
  const [sheetVisible, setSheetVisible] = React.useState(false);
  // Blur target covering the entire Tabs content (all screens + tab bar).
  // The Add Action sheet blurs this target when open; passthrough when closed.
  const screenBlurTarget = React.useRef<View>(null);

  // Clean horizontal slide between tabs: translateX screen-width -> 0,
  // 280ms cubic ease-out. No spring, bounce, scale, or vertical motion.
  // The dock + sheet render outside this wrapper, so they stay fixed.
  const segments = useSegments();
  const tabPos = tabPositionFromSegments(segments);
  const slideX = useSharedValue(0);
  const prevTabPos = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (prevTabPos.current === null) {
      prevTabPos.current = tabPos;
      return;
    }
    if (tabPos === prevTabPos.current) return;
    const dir = tabPos > prevTabPos.current ? 1 : -1;
    prevTabPos.current = tabPos;
    const w = Dimensions.get('window').width;
    slideX.value = dir * w;
    slideX.value = withTiming(0, {
      duration: 280,
      easing: Easing.out(Easing.cubic),
    });
  }, [tabPos, slideX]);

  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideX.value }],
  }));

  const handleAddActionPress = React.useCallback(() => {
    // Triggered from every tab. Boolean state is idempotent: repeated
    // presses while open are no-ops, so duplicate menus cannot stack.
    setSheetVisible(true);
  }, []);

  const handleSheetClose = React.useCallback(() => {
    setSheetVisible(false);
  }, []);

  const handleAddExpense = React.useCallback(() => {
    setSheetVisible(false);
    router.push('/add-expense' as any);
  }, [router]);

  // NOTE: misnamed handler — the sheet's "Add Group" card is wired to
  // onAddSettlement. It navigates to the one existing Add Group flow.
  const handleAddSettlement = React.useCallback(() => {
    setSheetVisible(false);
    router.push('/(tabs)/groups/create' as any);
  }, [router]);

  const handleAddMember = React.useCallback(() => {
    setSheetVisible(false);
    router.push('/add-member' as any);
  }, [router]);

  const handleScanJoin = React.useCallback(() => {
    setSheetVisible(false);
    router.push('/scan-join-qr' as any);
  }, [router]);

  const handleScanReceipt = React.useCallback(() => {
    setSheetVisible(false);
    router.push('/add-receipt' as any);
  }, [router]);

  if (isLoading) {
    return <AuthLoadingScreen message="Loading your account…" />;
  }

  if (!isAuthenticated && !isVerificationPending) {
    return <Redirect href="/login" />;
  }

  if (isVerificationPending) {
    return <Redirect href="/verify-email" />;
  }

  return (
    <>
      <Animated.View style={[{ flex: 1 }, slideStyle]}>
        <BlurTargetView ref={screenBlurTarget} style={{ flex: 1 }}>
          <Tabs
            // Keep inactive tab screens attached natively so tab switches
            // don't replay the native attach/detach transition underneath
            // our slide. Screens still lazy-load on first visit.
            detachInactiveScreens={false}
            tabBar={(props) => (
              <CustomTabBar
                {...props}
                onAddActionPress={handleAddActionPress}
                blurTarget={screenBlurTarget}
                sheetOpen={sheetVisible}
              />
            )}
            screenOptions={{
              headerShown: false,
            }}
          >
          <Tabs.Screen name="index" options={{ title: 'Home' }} />
          <Tabs.Screen name="groups/index" options={{ title: 'Groups' }} />
          <Tabs.Screen name="groups/create" options={{ title: 'Create Group' }} />
          <Tabs.Screen name="groups/[id]/index" options={{ title: 'Group Details' }} />
          <Tabs.Screen name="groups/[id]/members" options={{ title: 'Members' }} />
          <Tabs.Screen name="groups/[id]/expenses" options={{ title: 'Expenses' }} />
          <Tabs.Screen name="groups/[id]/settings" options={{ title: 'Group Settings' }} />
          <Tabs.Screen name="groups/[id]/invite" options={{ title: 'Invite Members' }} />
          <Tabs.Screen name="groups/[id]/edit" options={{ title: 'Edit Group' }} />
          <Tabs.Screen name="activity" options={{ title: 'Activity' }} />
          <Tabs.Screen name="settle" options={{ title: 'Settle' }} />
        </Tabs>
        </BlurTargetView>
      </Animated.View>

      {/* Global Add Action Bottom Sheet - shown when "+" pressed on any tab */}
      <AddActionBottomSheet
        visible={sheetVisible}
        groupName="Goa Trip"
        blurTarget={screenBlurTarget}
        onClose={handleSheetClose}
        onAddExpense={handleAddExpense}
        onAddSettlement={handleAddSettlement}
        onAddMember={handleAddMember}
        onScanReceipt={handleScanReceipt}
        onScanJoin={handleScanJoin}
      />
    </>
  );
}