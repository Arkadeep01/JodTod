import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  Dimensions,
  ScrollView,
  TouchableOpacity,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ImageBackground,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
const { width } = Dimensions.get('window');

const slides = [
  {
    id: '1',
    image: require('../../assets/images/jodtod/split-expenses.png'),
    title: 'Split expenses easily',
    subtitle:
      'Add every expense as it happens, split bills fairly among friends, and always know exactly who owes what — no more awkward money talk.',
  },
  {
    id: '2',
    image: require('../../assets/images/jodtod/plan-trips.png'),
    title: 'Plan trips together',
    subtitle:
      'Create a trip, invite your friends, and manage flights, stays, and activities all in one place — planning has never been this smooth.',
  },
  {
    id: '3',
    image: require('../../assets/images/jodtod/settle-up.png'),
    title: 'Settle up, stress free',
    subtitle:
      'See exactly who owes whom at a glance, and settle every group expense in a few taps — clean, simple, and drama free.',
  },
];

export default function Onboarding() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const isLastSlide = activeIndex === slides.length - 1;

  const goToSlide = (index: number) => {
    scrollRef.current?.scrollTo({
      x: index * width,
      animated: true,
    });

    setActiveIndex(index);
  };

  const handleScroll = (
    e: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    const index = Math.round(
      e.nativeEvent.contentOffset.x / width
    );

    setActiveIndex(index);
  };

  // replace (not push): onboarding must not linger beneath the auth
  // stack, or system Back at the tab root replays these slides after
  // a successful login (back-navigation audit P0-1). Forward flow is
  // identical — only the history residue is gone.
  const handleNext = () => {
    if (isLastSlide) {
      router.replace('/login' as any);
    } else {
      goToSlide(activeIndex + 1);
    }
  };

  const handleSkip = () => {
    router.replace('/login' as any);
  };

  return (
    <ImageBackground
      source={require('../../assets/images/jodtod/background_home.png')}
      resizeMode="cover"
      className="flex-1"
    >
      <View className="flex-1">

        {/* ================= CONTENT ================= */}

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
        >
          {slides.map((slide) => (
            <View
              key={slide.id}
              style={{ width }}
              className="flex-1 items-center justify-center px-7"
            >
              <Image
                source={slide.image}
                style={{
                  width: width * 0.85,
                  height: width * 0.85,
                }}
                className="mb-6"
                resizeMode="contain"
              />

              <Text className="mb-3 text-center text-[22px] font-bold text-[#0B3D62]">
                {slide.title}
              </Text>

              <Text className="px-2 text-center text-sm leading-[21px] text-[#666]">
                {slide.subtitle}
              </Text>
            </View>
          ))}
        </ScrollView>

        {/* ================= BOTTOM CONTROLS ================= */}

        <View className="flex-row items-center justify-between px-7 pb-10 pt-4">

          {/* ================= SKIP ================= */}

          <TouchableOpacity
            onPress={handleSkip}
            activeOpacity={0.85}
            className="overflow-hidden rounded-[16px] shadow-lg shadow-black/10"
          >
            <View
              className="
                min-w-[80px]
                overflow-hidden
                rounded-[16px]
                relative
              "
            >

              {/* Base frosted blur */}
              <BlurView
                intensity={80}
                tint="light"
                className="absolute inset-0"
              />

              {/* Green glass tint */}
              <View className="absolute inset-0 bg-[#00C853]/65 rounded-[16px]" />

              {/* Inner highlight - top edge */}
              <LinearGradient
                colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0)']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFill}
                locations={[0, 1]}
              />

              {/* Inner highlight - left edge */}
              <LinearGradient
                colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0)']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
                locations={[0, 1]}
              />

              {/* Inner shadow - bottom edge */}
              <LinearGradient
                colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0)']}
                start={{ x: 0.5, y: 1 }}
                end={{ x: 0.5, y: 0 }}
                style={StyleSheet.absoluteFill}
                locations={[0, 1]}
              />

              {/* Inner shadow - right edge */}
              <LinearGradient
                colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0)']}
                start={{ x: 1, y: 0.5 }}
                end={{ x: 0, y: 0.5 }}
                style={StyleSheet.absoluteFill}
                locations={[0, 1]}
              />

              {/* Border highlight - top */}
              <View className="absolute top-0 left-0 right-0 h-0.5 bg-white/50 rounded-t-[16px]" />

              {/* Border highlight - left */}
              <View className="absolute top-0 left-0 w-0.5 h-full bg-white/40 rounded-l-[16px]" />

              {/* Border shadow - bottom */}
              <View className="absolute bottom-0 left-0 right-0 h-0.5 bg-black/10 rounded-b-[16px]" />

              {/* Border shadow - right */}
              <View className="absolute top-0 right-0 w-0.5 h-full bg-black/10 rounded-r-[16px]" />

              <View className="relative z-10 items-center justify-center px-6 py-3">
                <Text className="text-[15px] text-white font-bold">
                  Skip
                </Text>
              </View>

            </View>
          </TouchableOpacity>


          {/* ================= PAGINATION ================= */}

          <View className="flex-row items-center gap-2">

            {slides.map((_, index) => (
              <View
                key={index}
                className={
                  index === activeIndex
                    ? 'h-2.5 w-8 rounded-full bg-[#00C853]/75'
                    : 'h-2.5 w-2.5 rounded-full border border-white/70 bg-white/55'
                }
              />
            ))}

          </View>


{/* ================= NEXT / GET STARTED ================= */}

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleNext}
            className="overflow-hidden rounded-[16px] shadow-lg shadow-black/10"
          >
            <View
              className="
                min-w-[90px]
                overflow-hidden
                rounded-[16px]
                relative
              "
            >

              {/* Base frosted blur */}
              <BlurView
                intensity={80}
                tint="light"
                className="absolute inset-0"
              />

              {/* Blue glass tint */}
              <View className="absolute inset-0 bg-[#0064D8]/65 rounded-[16px]" />

              {/* Inner highlight - top edge */}
              <LinearGradient
                colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0)']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFill}
                locations={[0, 1]}
              />

              {/* Inner highlight - left edge */}
              <LinearGradient
                colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0)']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
                locations={[0, 1]}
              />

              {/* Inner shadow - bottom edge */}
              <LinearGradient
                colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0)']}
                start={{ x: 0.5, y: 1 }}
                end={{ x: 0.5, y: 0 }}
                style={StyleSheet.absoluteFill}
                locations={[0, 1]}
              />

              {/* Inner shadow - right edge */}
              <LinearGradient
                colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0)']}
                start={{ x: 1, y: 0.5 }}
                end={{ x: 0, y: 0.5 }}
                style={StyleSheet.absoluteFill}
                locations={[0, 1]}
              />

              {/* Border highlight - top */}
              <View className="absolute top-0 left-0 right-0 h-0.5 bg-white/50 rounded-t-[16px]" />

              {/* Border highlight - left */}
              <View className="absolute top-0 left-0 w-0.5 h-full bg-white/40 rounded-l-[16px]" />

              {/* Border shadow - bottom */}
              <View className="absolute bottom-0 left-0 right-0 h-0.5 bg-black/10 rounded-b-[16px]" />

              {/* Border shadow - right */}
              <View className="absolute top-0 right-0 w-0.5 h-full bg-black/10 rounded-r-[16px]" />

              <View className="relative z-10 items-center justify-center px-6 py-3">
                <Text className="whitespace-nowrap text-[15px] font-bold text-white">
                  {isLastSlide ? 'Get Started' : 'Next'}
                </Text>
              </View>

            </View>
          </TouchableOpacity>

        </View>

      </View>
    </ImageBackground>
  );
}