/**
 * Login OTP — step 2 of the two-step password login.
 *
 * Reached from login.tsx when POST /auth/login answers "otp_required":
 * the password was correct and a login OTP (EMAIL_LOGIN via SMTP, or
 * PHONE_LOGIN for phone-only accounts) was dispatched. This screen
 * completes login by calling verify-otp with the same purpose and device
 * id that started the flow. The backend then opens the session and this
 * screen navigates straight to the app.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  Dimensions,
  TouchableOpacity,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../../context/AuthContext";

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;
const { width: SCREEN_W } = Dimensions.get("window");

const BRAND_GREEN_LIGHT = "#00E6A8";
const BRAND_GREEN = "#00B894";
const BRAND_GREEN_DARK = "#00896B";
const TEXT_DARK = "#14212B";
const TEXT_MUTED = "#4B5A66";
const INPUT_BG = "rgba(255,255,255,0.18)";
const INPUT_BORDER = "rgba(255,255,255,0.45)";

function BubbleBackdrop({ children }: { children: ReactNode }) {
  return (
    <ImageBackground
      source={require("../../../assets/images/jodtod/background_home.png")}
      resizeMode="cover"
      style={{ flex: 1, width: SCREEN_W }}
    >
      {children}
    </ImageBackground>
  );
}

function GlassCard({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        borderRadius: 28,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.35)",
        shadowColor: "#5FA8B4",
        shadowOpacity: 0.25,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 10 },
        elevation: 10,
        overflow: "hidden",
      }}
    >
      <BlurView intensity={14} tint="light" style={{ borderRadius: 28 }}>
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

const CTA_HEIGHT = 54;
const CTA_RADIUS = CTA_HEIGHT / 2;

function GradientCTA({
  children,
  onPress,
  disabled,
}: {
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.9}
      style={{
        borderRadius: CTA_RADIUS,
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
          borderRadius: CTA_RADIUS,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        {children}
      </LinearGradient>
    </TouchableOpacity>
  );
}

export default function LoginOtp() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    destination?: string;
    purpose?: string;
    message?: string;
    deviceId?: string;
  }>();

  const { verifyOTP, sendOTP } = useAuth();

  const destination = String(params.destination ?? "").trim();
  const purpose =
    String(params.purpose ?? "") === "phone_login" ? "phone_login" : "email_login";
  const deviceId = String(params.deviceId ?? "").trim();

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const [resendTimerStarted, setResendTimerStarted] = useState(true);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [otpMessage, setOtpMessage] = useState<string | null>(
    String(params.message ?? "").trim() || null,
  );
  const inputRefs = useRef<Array<TextInput | null>>([]);

  const otp = digits.join("");
  const isOtpComplete = otp.length === OTP_LENGTH;

  useEffect(() => {
    if (!resendTimerStarted) return;
    if (secondsLeft <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimerStarted, secondsLeft]);

  useEffect(() => {
    if (isOtpComplete && !busy) {
      void handleVerify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOtpComplete]);

  const handleChangeDigit = (text: string, index: number) => {
    const value = text.replace(/[^0-9]/g, "").slice(-1);
    const next = [...digits];
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

  const handleResend = async () => {
    if (!destination) return;
    setFormError(null);
    setBusy(true);
    try {
      await sendOTP({ destination, purpose });
      setDigits(Array(OTP_LENGTH).fill(""));
      setSecondsLeft(RESEND_SECONDS);
      setResendTimerStarted(true);
      setOtpMessage("A new code was sent.");
      inputRefs.current[0]?.focus();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not resend the code.");
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async () => {
    if (!isOtpComplete || busy) return;
    setBusy(true);
    setFormError(null);
    try {
      if (!destination || !deviceId) {
        setFormError("Login session was lost. Please sign in again.");
        router.replace("/login" as any);
        return;
      }
      await verifyOTP({
        destination,
        otp,
        purpose,
        device_id: deviceId,
      });
      // verify-otp for login purposes returns an AuthResponse: AuthContext
      // adopts the session. Login always lands on Home directly — even when
      // the account's email is still unverified — so navigate explicitly.
      setOtpMessage("Verified. Signing you in…");
      router.replace("/(tabs)" as any);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Invalid code. Please try again.");
      setDigits(Array(OTP_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="flex-1">
      <BubbleBackdrop>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1"
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1, paddingVertical: 40 }}
          >
            <TouchableOpacity
              className="flex-row items-center px-5 pt-4"
              onPress={() => router.replace("/login" as any)}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back-outline" size={22} color={TEXT_DARK} />
              <Text className="ml-1 text-sm font-semibold" style={{ color: TEXT_DARK }}>
                Back to login
              </Text>
            </TouchableOpacity>

            <View className="flex-1 items-center justify-center px-6">
              <GlassCard>
                <View className="px-7 py-10">
                  <Text className="text-2xl font-bold mb-3" style={{ color: TEXT_DARK }}>
                    Enter your code
                  </Text>

                  <Text className="text-[13px] leading-5 mb-8" style={{ color: TEXT_MUTED }}>
                    {purpose === "phone_login"
                      ? `We sent a code to ${destination || "your phone"} to finish signing in.`
                      : otpMessage ??
                        `We sent a code to ${destination || "your email"} to finish signing in.`}
                  </Text>

                  <View className="flex-row gap-2 mb-2">
                    {digits.map((digit, index) => (
                      <View
                        key={index}
                        style={{
                          width: 44,
                          height: 56,
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
                          onChangeText={(text) => handleChangeDigit(text, index)}
                          onKeyPress={(e) => handleKeyPress(e, index)}
                          keyboardType="number-pad"
                          maxLength={1}
                          className="flex-1 text-xl font-bold text-center"
                          style={{ color: TEXT_DARK, backgroundColor: "transparent" }}
                          placeholder=""
                        />
                      </View>
                    ))}
                  </View>

                  {formError ? (
                    <Text className="text-[13px] my-3 text-center font-semibold" style={{ color: "#D64545" }}>
                      {formError}
                    </Text>
                  ) : null}

                  <View className="my-5 items-center">
                    {secondsLeft > 0 ? (
                      <Text className="text-[13px]" style={{ color: TEXT_MUTED }}>
                        Resend code in 00:{secondsLeft < 10 ? "0" : ""}
                        {secondsLeft}
                      </Text>
                    ) : (
                      <TouchableOpacity onPress={handleResend} activeOpacity={0.7}>
                        <Text className="text-[13px] font-bold" style={{ color: BRAND_GREEN_DARK }}>
                          Resend code
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={{ width: "100%" }}>
                    <GradientCTA onPress={handleVerify} disabled={!isOtpComplete || busy}>
                      <Text
                        className="text-base font-bold"
                        style={{ color: isOtpComplete ? "#FFFFFF" : TEXT_MUTED }}
                      >
                        {busy ? "Verifying…" : otpMessage === "Verified. Signing you in…" ? "Verified" : "Verify"}
                      </Text>
                    </GradientCTA>
                  </View>

                  <Text className="text-[12px] text-center mt-6 leading-5" style={{ color: TEXT_MUTED }}>
                    For your security, never share this code with anyone.
                  </Text>
                </View>
              </GlassCard>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </BubbleBackdrop>
    </View>
  );
}