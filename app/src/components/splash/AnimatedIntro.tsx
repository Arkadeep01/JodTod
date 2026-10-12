import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Asset } from 'expo-asset';

export default function AnimatedIntro({
  onAssetsReady,
}: {
  /**
   * Fired once the preloaded onboarding assets have SETTLED (loaded or
   * failed). This is a real readiness signal, so the root route can
   * navigate the instant auth restoration finishes instead of waiting
   * out a fixed multi-second delay.
   */
  onAssetsReady?: () => void;
}) {
  const hasStarted = useRef(false);

  // Animation values
  const dividerOpacity = useSharedValue(0);
  const dividerScale = useSharedValue(0.5);

  const peopleOpacity = useSharedValue(0);
  const peopleTranslateY = useSharedValue(20);

  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(15);

  const taglineOpacity = useSharedValue(0);

  useEffect(() => {
    // Prevent duplicate execution in development
    if (hasStarted.current) return;
    hasStarted.current = true;

    // Preload ONLY the next screen assets
    Asset.loadAsync([
      require('../../../assets/images/jodtod/background_home.png'),
      require('../../../assets/images/jodtod/split-expenses.png'),
      require('../../../assets/images/jodtod/plan-trips.png'),
      require('../../../assets/images/jodtod/settle-up.png'),
    ]).catch((error) => {
      console.warn('Failed to preload onboarding assets:', error);
    }).then(() => {
      // Reported on BOTH outcomes: a failed asset must never leave the
      // root route waiting forever.
      onAssetsReady?.();
    });

    // =========================================
    // 1. DIVIDED SIGN
    // =========================================
    dividerOpacity.value = withTiming(1, {
      duration: 600,
    });

    dividerScale.value = withTiming(1, {
      duration: 600,
      easing: Easing.out(Easing.back(1.5)),
    });

    // =========================================
    // 2. PEOPLE + MONEY
    // =========================================
    peopleOpacity.value = withDelay(
      600,
      withTiming(1, {
        duration: 600,
      })
    );

    peopleTranslateY.value = withDelay(
      600,
      withTiming(0, {
        duration: 600,
      })
    );

    // =========================================
    // 3. JODTOD TEXT
    // =========================================
    textOpacity.value = withDelay(
      1200,
      withTiming(1, {
        duration: 600,
      })
    );

    textTranslateY.value = withDelay(
      1200,
      withTiming(0, {
        duration: 600,
      })
    );

    // =========================================
    // 4. TAGLINE
    // =========================================
    taglineOpacity.value = withDelay(
      1800,
      withTiming(1, {
        duration: 600,
      })
    );

    // =========================================
    // NAVIGATION
    //
    // This component is purely presentational. It no longer navigates
    // itself: the previous 3700 ms setTimeout was an unconditional
    // artificial floor on every cold start, and the root index route now
    // navigates the moment auth restoration and asset readiness are
    // both real (see app/src/app/index.tsx).
    // =========================================
  }, [onAssetsReady]);

  // =========================================
  // ANIMATED STYLES
  // =========================================

  const dividerStyle = useAnimatedStyle(() => ({
    opacity: dividerOpacity.value,
    transform: [
      {
        scale: dividerScale.value,
      },
    ],
  }));

  const peopleStyle = useAnimatedStyle(() => ({
    opacity: peopleOpacity.value,
    transform: [
      {
        translateY: peopleTranslateY.value,
      },
    ],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [
      {
        translateY: textTranslateY.value,
      },
    ],
  }));

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
  }));

  // =========================================
  // UI
  // =========================================

  return (
    <View className="flex-1 items-center justify-center bg-white">

      {/* Background */}
      <Animated.Image
        source={require('../../../assets/images/jodtod/background_home.png')}
        className="absolute inset-0 w-full h-full"
        resizeMode="cover"
      />

      {/* Logo / People Area */}
      <View className="w-[340px] h-[340px] items-center justify-center">

        {/* 1. Divided Sign */}
        <Animated.Image
          source={require('../../../assets/images/jodtod/1.png')}
          className="absolute w-[130px] h-[130px] top-[25px]"
          style={dividerStyle}
          resizeMode="contain"
        />

        {/* 2. People + Money */}
        <Animated.Image
          source={require('../../../assets/images/jodtod/2.png')}
          className="absolute w-[420px] h-[520px]"
          style={peopleStyle}
          resizeMode="contain"
        />

      </View>

      {/* 3. JodTod */}
      <Animated.Image
        source={require('../../../assets/images/jodtod/3.png')}
        className="w-[360px] h-[110px] top-[-100px] z-30"
        style={textStyle}
        resizeMode="contain"
      />

      {/* 4. Tagline */}
      <Animated.Image
        source={require('../../../assets/images/jodtod/4.png')}
        className="absolute w-[300px] h-[70px] bottom-[235px] z-20"
        style={taglineStyle}
        resizeMode="contain"
      />

    </View>
  );
}