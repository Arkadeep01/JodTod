import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ImageBackground,
  Image,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import * as Google from "expo-auth-session/providers/google";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path } from "react-native-svg";
import { useAuth } from "../../context/AuthContext";

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;

type Step = "form" | "otp" | "verifying" | "verified";
type LoginMethod = "email" | "phone";

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

const BRAND_GREEN_LIGHT = "#00E6A8";
const BRAND_GREEN = "#00B894";
const BRAND_GREEN_DARK = "#00896B";

const TEXT_DARK = "#14212B";
const TEXT_MUTED = "#4B5A66";

const HEADER_TITLE = "#0B3D62";
const HEADER_SUB = "#2A5A82";

const INPUT_BG = "rgba(255,255,255,0.18)";
const INPUT_BORDER = "rgba(255,255,255,0.45)";

// ---------------------------------------------------------------------------
// Glass card
// ---------------------------------------------------------------------------

function GlassCard({
  children,
  radius = 28,
  style,
}: {
  children: ReactNode;
  radius?: number;
  style?: any;
}) {
  return (
    <View
      style={[
        {
          borderRadius: radius,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.35)",
          shadowColor: "#5FA8B4",
          shadowOpacity: 0.25,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 10 },
          elevation: 10,
          overflow: "hidden",
        },
        style,
      ]}
    >
      <BlurView
        intensity={14}
        tint="light"
        style={{ borderRadius: radius }}
      >
        <LinearGradient
          colors={["rgba(255,255,255,0.10)", "rgba(210,240,230,0.08)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {children}
        </LinearGradient>
      </BlurView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Glass input
// ---------------------------------------------------------------------------

function GlassInput({ children, style }: { children: ReactNode; style?: any }) {
  return (
    <View
      style={[
        {
          borderRadius: 16,
          backgroundColor: INPUT_BG,
          borderWidth: 1,
          borderColor: INPUT_BORDER,
          overflow: "hidden",
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Gradient CTA
// ---------------------------------------------------------------------------

const CTA_HEIGHT = 54;
const CTA_RADIUS = CTA_HEIGHT / 2;

function GradientCTA({
  children,
  onPress,
  disabled,
  radius = CTA_RADIUS,
  icon = "arrow-forward",
}: {
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  radius?: number;
  icon?: keyof typeof Ionicons.glyphMap | null;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.9}
      style={{
        borderRadius: radius,
        shadowColor: disabled ? "transparent" : BRAND_GREEN,
        shadowOpacity: disabled ? 0 : 0.45,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: disabled ? 0 : 8,
      }}
    >
      <LinearGradient
        colors={
          disabled
            ? ["#D7E0E0", "#C7D2D2"]
            : [BRAND_GREEN_LIGHT, BRAND_GREEN, BRAND_GREEN_DARK]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          height: CTA_HEIGHT,
          borderRadius: radius,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        {children}

        {icon ? (
          <Ionicons
            name={icon}
            size={18}
            color={disabled ? TEXT_MUTED : "#FFFFFF"}
          />
        ) : null}
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Segmented Email / Phone toggle
// ---------------------------------------------------------------------------

const TOGGLE_OPTIONS: Array<{
  value: LoginMethod;
  label: string;
}> = [
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
];

function SegmentedToggle({
  value,
  onChange,
}: {
  value: LoginMethod;
  onChange: (next: LoginMethod) => void;
}) {
  return (
    <View
      style={{
        marginBottom: 20,
        padding: 4,
        borderRadius: 16,
        backgroundColor: INPUT_BG,
        borderWidth: 1,
        borderColor: INPUT_BORDER,
      }}
    >
      <View className="flex-row">
        {TOGGLE_OPTIONS.map((option) => {
          const active = value === option.value;

          return (
            <View
              key={option.value}
              className="flex-1"
              style={{
                shadowColor: active ? BRAND_GREEN : "transparent",
                shadowOpacity: active ? 0.4 : 0,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 4 },
                elevation: active ? 4 : 0,
                borderRadius: 12,
              }}
            >
              <TouchableOpacity
                className="h-10 items-center justify-center"
                style={{
                  borderRadius: 12,
                  overflow: "hidden",
                }}
                onPress={() => onChange(option.value)}
              >
                {active ? (
                  <LinearGradient
                    colors={[BRAND_GREEN_LIGHT, BRAND_GREEN_DARK]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      borderRadius: 12,
                    }}
                  />
                ) : null}

                <Text
                  className="text-sm font-semibold"
                  style={{
                    color: active ? "#FFFFFF" : TEXT_MUTED,
                  }}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Google G icon
// ---------------------------------------------------------------------------

function GoogleGlyph({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.9-2.26 5.36-4.78 7.02l7.73 6c4.51-4.18 7.09-10.36 7.09-17.49z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59A14.5 14.5 0 0 1 9.5 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A24 24 0 0 0 0 24c0 3.86.92 7.51 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.9l-7.97 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Social button
// ---------------------------------------------------------------------------

const SOCIAL_HEIGHT = 50;
const SOCIAL_RADIUS = SOCIAL_HEIGHT / 2;

function SocialButton({
  renderIcon,
  label,
  onPress,
}: {
  renderIcon: () => ReactNode;
  label: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      className="flex-1 flex-row items-center justify-center gap-2"
      style={{
        height: SOCIAL_HEIGHT,
        borderRadius: SOCIAL_RADIUS,
        backgroundColor: "#FFFFFF",
        shadowColor: "#2A5A82",
        shadowOpacity: 0.1,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
      }}
    >
      {renderIcon()}

      <Text className="text-sm font-semibold" style={{ color: TEXT_DARK }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Bubble backdrop
// ---------------------------------------------------------------------------

function BubbleBackdrop({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();

  return (
    <ImageBackground
      source={require("../../../assets/images/jodtod/background_home.png")}
      resizeMode="cover"
      style={{
        flex: 1,
        width,
      }}
    >
      {children}
    </ImageBackground>
  );
}

// ---------------------------------------------------------------------------
// Header visual
// ---------------------------------------------------------------------------

function HeaderVisual({ height }: { height: number }) {
  const { width } = useWindowDimensions();

  return (
    <View
      style={{
        width,
        height,
        overflow: "hidden",
      }}
    >
      <Image
        source={require("../../../assets/images/jodtod/plan-trips-login.png")}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width,
          height: "100%",
        }}
        resizeMode="cover"
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Login screen
// ---------------------------------------------------------------------------

export default function Login() {
  const router = useRouter();
  const { width: screenW } = useWindowDimensions();

  const {
    login,
    loginWithGoogle,
    sendOTP,
    verifyOTP,
    isLoading: authLoading,
  } = useAuth();

  // -------------------------------------------------------------------------
  // Google configuration
  // -------------------------------------------------------------------------

  const manifestExtra = (
    Constants as unknown as {
      manifest2?: {
        extra?: {
          expoClient?: {
            extra?: unknown;
          };
        };
      };
    }
  ).manifest2?.extra?.expoClient?.extra;

  const extra = (Constants.expoConfig?.extra ?? manifestExtra) as
    | {
        googleWebClientId?: unknown;
        googleAndroidClientId?: unknown;
        googleIosClientId?: unknown;
      }
    | undefined;

  // Expo's config pipeline materializes null extra values as {} on device,
  // so every extra read is coerced: non-strings count as unset.
  const asExtraString = (v: unknown): string | undefined =>
    typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;

  const googleWebClientId = asExtraString(extra?.googleWebClientId);

  const googleAndroidClientId =
    asExtraString(extra?.googleAndroidClientId) ?? googleWebClientId;

  const googleIosClientId =
    asExtraString(extra?.googleIosClientId) ?? googleWebClientId;

  const googleConfigured = Boolean(
    Platform.OS === "android"
      ? googleAndroidClientId
      : Platform.OS === "ios"
        ? googleIosClientId
        : googleWebClientId,
  );

  const googleHookWebClientId =
    googleWebClientId ?? "google-client-id-not-configured";

  const [googleRequest, , promptGoogleAsync] = Google.useIdTokenAuthRequest({
    webClientId: googleHookWebClientId,
    androidClientId: googleAndroidClientId ?? googleHookWebClientId,
    iosClientId: googleIosClientId ?? googleHookWebClientId,
    scopes: ["openid", "email", "profile"],
  });

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  const [step, setStep] = useState<Step>("form");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Kept for the existing UI. The current login() API does not consume this.
  const [rememberMe, setRememberMe] = useState(true);

  const [loginMethod, setLoginMethod] = useState<LoginMethod>("email");

  const [phone, setPhone] = useState("");

  const [formError, setFormError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);

  const [otpMessage, setOtpMessage] = useState<string | null>(null);

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));

  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  const inputRefs = useRef<Array<TextInput | null>>([]);

  const otp = digits.join("");
  const isOtpComplete = otp.length === OTP_LENGTH;

  const spin = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0)).current;

  const verifyLoop = useRef<Animated.CompositeAnimation | null>(null);

  // -------------------------------------------------------------------------
  // OTP countdown
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (step !== "otp") return;

    const interval = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [step]);

  // -------------------------------------------------------------------------
  // Focus first OTP input
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (step !== "otp") return;

    const timeout = setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 150);

    return () => clearTimeout(timeout);
  }, [step]);

  // -------------------------------------------------------------------------
  // OTP verification animation
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (step === "verifying") {
      const loop = Animated.loop(
        Animated.timing(spin, {
          toValue: 1,
          duration: 900,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );

      verifyLoop.current = loop;
      loop.start();

      return () => {
        loop.stop();
      };
    }

    if (step === "verified") {
      verifyLoop.current?.stop();

      scale.setValue(0);

      Animated.spring(scale, {
        toValue: 1,
        friction: 4,
        tension: 80,
        useNativeDriver: true,
      }).start();
    }
  }, [step, scale, spin]);

  const rotateInterpolate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  // -------------------------------------------------------------------------
  // Switch Email / Phone login
  // -------------------------------------------------------------------------

  const switchMethod = (method: LoginMethod) => {
    setLoginMethod(method);
    setFormError(null);
    setOtpMessage(null);
  };

  // -------------------------------------------------------------------------
  // EMAIL + PASSWORD LOGIN
  //
  // IMPORTANT:
  // Email login is DIRECT.
  // There is NO EMAIL_LOGIN OTP flow here.
  // -------------------------------------------------------------------------

  const handleEmailLogin = async () => {
    setFormError(null);

    if (!email.trim()) {
      setFormError("Enter your email address.");
      return;
    }

    if (!password) {
      setFormError("Enter your password.");
      return;
    }

    setBusy(true);

    try {
      await login({
        identifier: email.trim(),
        password,
      });

      // Backend returns a fully authenticated AuthResponse.
      // AuthContext persists the session.
      // Email/password login does NOT require an OTP.
      router.replace("/(tabs)" as any);
    } catch (e) {
      setFormError(
        e instanceof Error ? e.message : "Login failed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  // -------------------------------------------------------------------------
  // PHONE LOGIN — OTP
  // -------------------------------------------------------------------------

  const handleSendOtp = async () => {
    setFormError(null);
    setOtpMessage(null);

    const destination = phone.trim();

    if (!destination) {
      setFormError("Enter your phone number to receive a code.");
      return;
    }

    setBusy(true);

    try {
      const result = (await sendOTP({
        destination,
        purpose: "phone_login",
      })) as {
        message?: string;
      };

      setDigits(Array(OTP_LENGTH).fill(""));
      setSecondsLeft(RESEND_SECONDS);

      setOtpMessage(result?.message ?? "Code sent. Check your phone.");

      setStep("otp");
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not send the code.");
    } finally {
      setBusy(false);
    }
  };

  // -------------------------------------------------------------------------
  // OTP input
  // -------------------------------------------------------------------------

  const handleChangeDigit = (text: string, index: number) => {
    const cleaned = text.replace(/[^0-9]/g, "");
    const next = [...digits];

    // Handle paste / SMS autofill of a full OTP.
    if (cleaned.length > 2) {
      const chars = cleaned.slice(0, OTP_LENGTH - index).split("");

      chars.forEach((char, offset) => {
        next[index + offset] = char;
      });

      setDigits(next);

      const focusIndex = Math.min(index + chars.length, OTP_LENGTH - 1);

      inputRefs.current[focusIndex]?.focus();
      return;
    }

    const value = cleaned.slice(-1);

    next[index] = value;
    setDigits(next);

    if (value && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();

      const next = [...digits];
      next[index - 1] = "";

      setDigits(next);
    }
  };

  // -------------------------------------------------------------------------
  // Resend phone OTP
  // -------------------------------------------------------------------------

  const handleResend = async () => {
    const destination = phone.trim();

    if (!destination) return;

    setFormError(null);

    try {
      await sendOTP({
        destination,
        purpose: "phone_login",
      });

      setDigits(Array(OTP_LENGTH).fill(""));
      setSecondsLeft(RESEND_SECONDS);
      setOtpMessage("A new code was sent.");

      inputRefs.current[0]?.focus();
    } catch (e) {
      setFormError(
        e instanceof Error ? e.message : "Could not resend the code.",
      );
    }
  };

  // -------------------------------------------------------------------------
  // Verify phone OTP
  // -------------------------------------------------------------------------

  const handleVerify = async () => {
    if (!isOtpComplete || busy) return;

    setBusy(true);
    setFormError(null);
    setStep("verifying");

    try {
      const result = (await verifyOTP({
        destination: phone.trim(),
        otp,
        purpose: "phone_login",
      })) as {
        message?: string;
      };

      setOtpMessage(result?.message ?? "Number verified.");

      // Do not manually navigate here.
      // AuthContext should update authentication state if the
      // backend creates a session for phone login.
      setStep("verified");
    } catch (e) {
      setStep("otp");

      setFormError(
        e instanceof Error ? e.message : "Invalid code. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  // -------------------------------------------------------------------------
  // Google / Apple login
  // -------------------------------------------------------------------------

  const handleSocial = async (provider: "Google" | "Apple") => {
    if (provider === "Apple") {
      setFormError("Apple sign-in is not configured yet.");
      return;
    }

    if (!googleConfigured) {
      setFormError("Google sign-in is not configured.");
      return;
    }

    if (!googleRequest) {
      setFormError("Google sign-in is still loading. Try again in a moment.");
      return;
    }

    setBusy(true);
    setFormError(null);

    try {
      const result = await promptGoogleAsync();

      if (result.type !== "success") {
        if (result.type !== "cancel" && result.type !== "dismiss") {
          setFormError("Google sign-in was not completed.");
        }

        return;
      }

      const idToken =
        (
          result as {
            params?: {
              id_token?: string;
            };
          }
        ).params?.id_token ??
        (
          result as {
            authentication?: {
              idToken?: string;
            };
          }
        ).authentication?.idToken;

      if (!idToken) {
        setFormError("Google did not return an identity credential.");
        return;
      }

      await loginWithGoogle({
        provider: "google",
        id_token: idToken,
      });
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Google sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

  // -------------------------------------------------------------------------
  // UI
  // -------------------------------------------------------------------------

  return (
    <View className="flex-1">
      {step === "form" ? (
        <BubbleBackdrop>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingBottom: 40,
              flexGrow: 1,
            }}
          >
            {/* Header */}
            <View
              style={{
                position: "relative",
                width: screenW,
              }}
            >
              <HeaderVisual height={340} />

              <View
                style={{
                  position: "absolute",
                  top: 120,
                  left: 18,
                  right: 20,
                }}
              >
                <Text
                  className="text-2xl font-extrabold mb-1.5"
                  style={{
                    color: HEADER_TITLE,
                    letterSpacing: 0.3,
                    textShadowColor: "rgba(255,255,255,0.85)",
                    textShadowOffset: {
                      width: 0,
                      height: 1,
                    },
                    textShadowRadius: 6,
                  }}
                >
                  Hey, you're back!
                </Text>

                <Text
                  className="text-sm font-semibold leading-5"
                  style={{
                    color: HEADER_SUB,
                    textShadowColor: "rgba(255,255,255,0.85)",
                    textShadowOffset: {
                      width: 0,
                      height: 1,
                    },
                    textShadowRadius: 6,
                  }}
                >
                  Log in to keep tracking{"\n"} your trips and expenses.
                </Text>
              </View>
            </View>

            {/* Login card */}
            <View
              style={{
                marginTop: -28,
                marginHorizontal: 18,
              }}
            >
              <GlassCard radius={28}>
                <View className="px-6 pt-7 pb-8">
                  <Text
                    className="text-2xl font-bold mb-5"
                    style={{
                      letterSpacing: 0.4,
                      color: TEXT_DARK,
                    }}
                  >
                    Login to your account
                  </Text>

                  <SegmentedToggle
                    value={loginMethod}
                    onChange={switchMethod}
                  />

                  {/* =======================================================
                      EMAIL LOGIN
                      ======================================================= */}
                  {loginMethod === "email" ? (
                    <>
                      <Text
                        className="text-[13px] mb-2 font-semibold"
                        style={{
                          color: TEXT_MUTED,
                        }}
                      >
                        Email address
                      </Text>

                      <GlassInput
                        style={{
                          marginBottom: 18,
                        }}
                      >
                        <View className="flex-row items-center px-3.5 h-[52px]">
                          <Ionicons
                            name="mail-outline"
                            size={18}
                            color={BRAND_GREEN_DARK}
                            style={{
                              marginRight: 10,
                            }}
                          />

                          <TextInput
                            className="flex-1 text-sm"
                            style={{
                              color: TEXT_DARK,
                            }}
                            placeholder="Enter your email"
                            placeholderTextColor="rgba(20,33,43,0.4)"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            autoComplete="email"
                            textContentType="emailAddress"
                          />
                        </View>
                      </GlassInput>

                      <Text
                        className="text-[13px] mb-2 font-semibold"
                        style={{
                          color: TEXT_MUTED,
                        }}
                      >
                        Password
                      </Text>

                      <GlassInput
                        style={{
                          marginBottom: 18,
                        }}
                      >
                        <View className="flex-row items-center px-3.5 h-[52px]">
                          <Ionicons
                            name="lock-closed-outline"
                            size={18}
                            color={BRAND_GREEN_DARK}
                            style={{
                              marginRight: 10,
                            }}
                          />

                          <TextInput
                            className="flex-1 text-sm"
                            style={{
                              color: TEXT_DARK,
                            }}
                            placeholder="Enter your password"
                            placeholderTextColor="rgba(20,33,43,0.4)"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!showPassword}
                            autoCapitalize="none"
                            autoCorrect={false}
                            autoComplete="password"
                            textContentType="password"
                          />

                          <TouchableOpacity
                            onPress={() => setShowPassword(!showPassword)}
                          >
                            <Ionicons
                              name={
                                showPassword ? "eye-outline" : "eye-off-outline"
                              }
                              size={18}
                              color={TEXT_MUTED}
                            />
                          </TouchableOpacity>
                        </View>
                      </GlassInput>

                      <View className="flex-row items-center justify-between mb-6">
                        <TouchableOpacity
                          className="flex-row items-center"
                          onPress={() => setRememberMe(!rememberMe)}
                        >
                          <View
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: 5,
                              borderWidth: 1.4,
                              borderColor: BRAND_GREEN_DARK,
                              alignItems: "center",
                              justifyContent: "center",
                              marginRight: 8,
                              backgroundColor: rememberMe
                                ? BRAND_GREEN
                                : "transparent",
                            }}
                          >
                            {rememberMe && (
                              <Ionicons
                                name="checkmark"
                                size={13}
                                color="#FFFFFF"
                              />
                            )}
                          </View>

                          <Text
                            className="text-[13px]"
                            style={{
                              color: TEXT_MUTED,
                            }}
                          >
                            Remember me
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => router.push("/forgot-password" as any)}
                        >
                          <Text
                            className="text-[13px] font-semibold"
                            style={{
                              color: BRAND_GREEN_DARK,
                            }}
                          >
                            Forgot password?
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {formError && loginMethod === "email" ? (
                        <Text
                          className="text-[13px] mb-4 text-center font-semibold"
                          style={{
                            color: "#D64545",
                          }}
                        >
                          {formError}
                        </Text>
                      ) : null}

                      <View
                        style={{
                          marginBottom: 24,
                        }}
                      >
                        <GradientCTA
                          onPress={handleEmailLogin}
                          disabled={busy || authLoading}
                        >
                          <Text className="text-white text-base font-bold">
                            {busy || authLoading ? "Logging in…" : "Login"}
                          </Text>
                        </GradientCTA>
                      </View>
                    </>
                  ) : (
                    /* =======================================================
                       PHONE LOGIN
                       ======================================================= */
                    <>
                      <Text
                        className="text-[13px] mb-2 font-semibold"
                        style={{
                          color: TEXT_MUTED,
                        }}
                      >
                        Phone number
                      </Text>

                      <GlassInput
                        style={{
                          marginBottom: 18,
                        }}
                      >
                        <View className="flex-row items-center px-3.5 h-[52px]">
                          <Ionicons
                            name="call-outline"
                            size={18}
                            color={BRAND_GREEN_DARK}
                            style={{
                              marginRight: 10,
                            }}
                          />

                          <TextInput
                            className="flex-1 text-sm"
                            style={{
                              color: TEXT_DARK,
                            }}
                            placeholder="Enter your phone number"
                            placeholderTextColor="rgba(20,33,43,0.4)"
                            value={phone}
                            onChangeText={setPhone}
                            keyboardType="phone-pad"
                            autoComplete="tel"
                            textContentType="telephoneNumber"
                          />
                        </View>
                      </GlassInput>

                      {formError && loginMethod === "phone" ? (
                        <Text
                          className="text-[13px] mb-4 text-center font-semibold"
                          style={{
                            color: "#D64545",
                          }}
                        >
                          {formError}
                        </Text>
                      ) : null}

                      <View
                        style={{
                          marginBottom: 24,
                        }}
                      >
                        <GradientCTA onPress={handleSendOtp} disabled={busy}>
                          <Text className="text-white text-base font-bold">
                            {busy ? "Sending…" : "Send OTP"}
                          </Text>
                        </GradientCTA>
                      </View>
                    </>
                  )}

                  {/* Divider */}
                  <View className="flex-row items-center mb-5">
                    <View
                      className="flex-1 h-px"
                      style={{
                        backgroundColor: INPUT_BORDER,
                      }}
                    />

                    <Text
                      className="text-xs mx-3"
                      style={{
                        color: TEXT_MUTED,
                      }}
                    >
                      or continue with
                    </Text>

                    <View
                      className="flex-1 h-px"
                      style={{
                        backgroundColor: INPUT_BORDER,
                      }}
                    />
                  </View>

                  {/* Social buttons */}
                  <View className="flex-row gap-3 mb-6">
                    <SocialButton
                      renderIcon={() => <GoogleGlyph size={18} />}
                      label="Google"
                      onPress={() => handleSocial("Google")}
                    />

                    <SocialButton
                      renderIcon={() => (
                        <Ionicons name="logo-apple" size={20} color="#000000" />
                      )}
                      label="Apple"
                      onPress={() => handleSocial("Apple")}
                    />
                  </View>

                  {/* Signup */}
                  <View className="flex-row justify-center mb-2">
                    <Text
                      className="text-[13px]"
                      style={{
                        color: TEXT_MUTED,
                      }}
                    >
                      Don't have an account?{" "}
                    </Text>

                    <TouchableOpacity
                      onPress={() => router.push("/signup" as any)}
                    >
                      <Text
                        className="text-[13px] font-bold"
                        style={{
                          color: BRAND_GREEN_DARK,
                        }}
                      >
                        Sign up
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </GlassCard>
            </View>
          </ScrollView>
        </BubbleBackdrop>
      ) : (
        // ================================================================
        // PHONE OTP SCREEN
        // ================================================================
        <BubbleBackdrop>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            className="flex-1"
          >
            <View className="flex-1 px-6 pt-[60px]">
              <View className="flex-1 items-center justify-center">
                {/* OTP entry */}
                {step === "otp" && (
                  <GlassCard
                    radius={28}
                    style={{
                      width: "100%",
                    }}
                  >
                    <View className="px-7 py-10 items-center">
                      <Text
                        className="text-2xl font-bold mb-3"
                        style={{
                          color: TEXT_DARK,
                        }}
                      >
                        Verify your number
                      </Text>

                      <View className="flex-row items-center mb-8">
                        <Text
                          className="text-base font-semibold mr-2"
                          style={{
                            color: BRAND_GREEN_DARK,
                          }}
                        >
                          {phone || "+91 00000 00000"}
                        </Text>

                        <TouchableOpacity onPress={() => setStep("form")}>
                          <Ionicons
                            name="pencil"
                            size={16}
                            color={BRAND_GREEN_DARK}
                          />
                        </TouchableOpacity>
                      </View>

                      <View className="flex-row gap-2 mb-8">
                        {digits.map((digit, index) => (
                          <View
                            key={index}
                            style={{
                              width: 46,
                              height: 58,
                              borderRadius: 14,
                              backgroundColor: digit ? "#F0FBF6" : INPUT_BG,
                              borderWidth: 1.6,
                              borderColor: digit ? BRAND_GREEN : INPUT_BORDER,
                              overflow: "hidden",
                            }}
                          >
                            <TextInput
                              ref={(ref) => {
                                inputRefs.current[index] = ref;
                              }}
                              value={digit}
                              onChangeText={(text) =>
                                handleChangeDigit(text, index)
                              }
                              onKeyPress={(e) => handleKeyPress(e, index)}
                              keyboardType="number-pad"
                              maxLength={OTP_LENGTH}
                              textContentType={
                                index === 0 ? "oneTimeCode" : "none"
                              }
                              autoComplete={index === 0 ? "sms-otp" : "off"}
                              className="flex-1 text-xl font-bold text-center"
                              style={{
                                color: TEXT_DARK,
                                backgroundColor: "transparent",
                              }}
                              placeholder=""
                            />
                          </View>
                        ))}
                      </View>

                      {otpMessage ? (
                        <Text
                          className="text-[13px] mb-4 text-center font-semibold"
                          style={{
                            color: BRAND_GREEN_DARK,
                          }}
                        >
                          {otpMessage}
                        </Text>
                      ) : null}

                      {formError ? (
                        <Text
                          className="text-[13px] mb-4 text-center font-semibold"
                          style={{
                            color: "#D64545",
                          }}
                        >
                          {formError}
                        </Text>
                      ) : null}

                      {secondsLeft > 0 ? (
                        <Text
                          className="text-[13px] mb-8"
                          style={{
                            color: TEXT_MUTED,
                          }}
                        >
                          Resend OTP in 00:
                          {secondsLeft < 10 ? "0" : ""}
                          {secondsLeft}
                        </Text>
                      ) : (
                        <TouchableOpacity
                          onPress={handleResend}
                          className="mb-8"
                        >
                          <Text
                            className="text-[13px] font-bold"
                            style={{
                              color: BRAND_GREEN_DARK,
                            }}
                          >
                            Resend OTP
                          </Text>
                        </TouchableOpacity>
                      )}

                      <View
                        style={{
                          width: "100%",
                        }}
                      >
                        <GradientCTA
                          onPress={handleVerify}
                          disabled={!isOtpComplete || busy}
                        >
                          <Text
                            className="text-base font-bold"
                            style={{
                              color: isOtpComplete ? "#FFFFFF" : TEXT_MUTED,
                            }}
                          >
                            {busy ? "Verifying…" : "Verify"}
                          </Text>
                        </GradientCTA>
                      </View>

                      <Text
                        className="text-[12px] text-center mt-6 leading-5"
                        style={{
                          color: TEXT_MUTED,
                        }}
                      >
                        We will never share your number with anyone.
                      </Text>
                    </View>
                  </GlassCard>
                )}

                {/* Verifying / verified */}
                {(step === "verifying" || step === "verified") && (
                  <GlassCard
                    radius={28}
                    style={{
                      width: "100%",
                    }}
                  >
                    <View className="px-8 py-12 items-center">
                      {step === "verifying" ? (
                        <>
                          <Animated.View
                            style={{
                              transform: [
                                {
                                  rotate: rotateInterpolate,
                                },
                              ],
                              width: 60,
                              height: 60,
                              borderRadius: 30,
                              borderWidth: 4,
                              borderColor: BRAND_GREEN,
                              borderTopColor: INPUT_BORDER,
                              marginBottom: 24,
                            }}
                          />

                          <Text
                            className="text-lg font-bold mb-2"
                            style={{
                              color: TEXT_DARK,
                            }}
                          >
                            Verifying OTP
                          </Text>

                          <Text
                            className="text-[13px] text-center"
                            style={{
                              color: TEXT_MUTED,
                            }}
                          >
                            {phone
                              ? `Confirming the code sent to ${phone}`
                              : "Confirming your code"}
                          </Text>
                        </>
                      ) : (
                        <>
                          <Animated.View
                            style={{
                              transform: [
                                {
                                  scale,
                                },
                              ],
                              marginBottom: 24,
                            }}
                          >
                            <LinearGradient
                              colors={[
                                BRAND_GREEN_LIGHT,
                                BRAND_GREEN,
                                BRAND_GREEN_DARK,
                              ]}
                              start={{
                                x: 0,
                                y: 0,
                              }}
                              end={{
                                x: 1,
                                y: 1,
                              }}
                              style={{
                                width: 64,
                                height: 64,
                                borderRadius: 32,
                                alignItems: "center",
                                justifyContent: "center",
                                shadowColor: BRAND_GREEN,
                                shadowOpacity: 0.4,
                                shadowRadius: 14,
                                shadowOffset: {
                                  width: 0,
                                  height: 0,
                                },
                                elevation: 6,
                              }}
                            >
                              <Ionicons
                                name="checkmark"
                                size={34}
                                color="#FFFFFF"
                              />
                            </LinearGradient>
                          </Animated.View>

                          <Text
                            className="text-lg font-bold mb-2"
                            style={{
                              color: TEXT_DARK,
                            }}
                          >
                            Verified!
                          </Text>

                          <Text
                            className="text-[13px] text-center"
                            style={{
                              color: TEXT_MUTED,
                            }}
                          >
                            {otpMessage ?? "Your number is verified."}
                          </Text>

                          <TouchableOpacity
                            onPress={() => {
                              setDigits(Array(OTP_LENGTH).fill(""));
                              setOtpMessage(null);
                              setFormError(null);
                              setStep("form");
                              setLoginMethod("email");
                            }}
                            className="mt-6"
                          >
                            <Text
                              className="text-[13px] font-bold"
                              style={{
                                color: BRAND_GREEN_DARK,
                              }}
                            >
                              Back to login
                            </Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </GlassCard>
                )}
              </View>
            </View>
          </KeyboardAvoidingView>
        </BubbleBackdrop>
      )}
    </View>
  );
}
