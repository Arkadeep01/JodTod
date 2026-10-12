/**
 * Forgot-password — fully wired to the backend password-reset contract:
 *
 *   1. POST /auth/forgot-password  { identifier }  -> dispatches a
 *      PASSWORD_RESET OTP to the account email (SMTP) or phone (SMS).
 *      The response is intentionally generic to avoid account enumeration.
 *   2. POST /auth/reset-password   { identifier, code, new_password }
 *      -> verifies the OTP and sets the new password.
 *
 * `identifier` accepts an email address or an international phone number.
 */
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  ImageBackground,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAvoidingView, Platform, ScrollView, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { requestPasswordReset, resetPassword } from "../../services/auth.service";

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;
const { width: SCREEN_W } = Dimensions.get("window");

const TEXT_DARK = "#14212B";
const TEXT_MUTED = "#4B5A66";
const BRAND_GREEN = "#00B894";
const BRAND_GREEN_DARK = "#00896B";

type Step = "identifier" | "code";

export default function ForgotPassword() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("identifier");
  const [identifier, setIdentifier] = useState("");
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  const inputRefs = useRef<Array<TextInput | null>>([]);

  const code = digits.join("");
  const isCodeComplete = code.length === OTP_LENGTH;

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [secondsLeft]);

  const handleRequestCode = async () => {
    setFormError(null);
    if (!identifier.trim()) {
      setFormError("Enter your email address or phone number.");
      return;
    }
    setBusy(true);
    try {
      await requestPasswordReset({ identifier: identifier.trim() });
      setDigits(Array(OTP_LENGTH).fill(""));
      setSecondsLeft(RESEND_SECONDS);
      setStep("code");
      setFormError(null);
    } catch (e) {
      const text = e instanceof Error ? e.message : "Could not send the reset code.";
      setFormError(text);
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    setBusy(true);
    setFormError(null);
    try {
      await requestPasswordReset({ identifier: identifier.trim() });
      setDigits(Array(OTP_LENGTH).fill(""));
      setSecondsLeft(RESEND_SECONDS);
      inputRefs.current[0]?.focus();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not resend the code.");
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    setFormError(null);
    if (!isCodeComplete) {
      setFormError("Enter the 6-digit reset code.");
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setFormError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await resetPassword({
        identifier: identifier.trim(),
        code,
        new_password: newPassword,
      });
      Alert.alert(
        "Password updated",
        "Your password was changed. Sign in with your new password.",
        [{ text: "OK", onPress: () => router.replace("/login" as any) }],
      );
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Password reset failed. Try again.");
    } finally {
      setBusy(false);
    }
  };

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

  const renderField = ({
    value,
    onChangeText,
    placeholder,
    secure,
    visible,
    onToggle,
    keyboardType,
  }: {
    value: string;
    onChangeText: (text: string) => void;
    placeholder: string;
    secure?: boolean;
    visible?: boolean;
    onToggle?: () => void;
    keyboardType?: "email-address" | "default";
  }) => (
    <View
      style={{
        borderRadius: 16,
        backgroundColor: "rgba(255,255,255,0.18)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.45)",
        overflow: "hidden",
        marginBottom: 16,
      }}
    >
      <View className="flex-row items-center px-3.5 h-[52px]">
        <TextInput
          className="flex-1 text-sm"
          style={{ color: TEXT_DARK }}
          placeholder={placeholder}
          placeholderTextColor="rgba(20,33,43,0.4)"
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secure && !visible}
          keyboardType={keyboardType}
          autoCapitalize="none"
        />
        {onToggle ? (
          <TouchableOpacity onPress={onToggle}>
            <Ionicons
              name={visible ? "eye-off-outline" : "eye-outline"}
              size={18}
              color={TEXT_MUTED}
            />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );

  return (
    <ImageBackground
      source={require("../../../assets/images/jodtod/background_home.png")}
      resizeMode="cover"
      style={{ flex: 1, width: SCREEN_W }}
    >
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

          <View className="flex-1 justify-center px-6">
            <View
              style={{
                borderRadius: 28,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.35)",
                backgroundColor: "rgba(255,255,255,0.55)",
                paddingHorizontal: 24,
                paddingVertical: 28,
              }}
            >
              {step === "identifier" ? (
                <>
                  <Text className="text-2xl font-bold mb-2" style={{ color: TEXT_DARK }}>
                    Reset your password
                  </Text>
                  <Text className="text-[13px] leading-5 mb-6" style={{ color: TEXT_MUTED }}>
                    Enter your account email or phone number and we will send you a
                    one-time reset code.
                  </Text>

                  {renderField({
                    value: identifier,
                    onChangeText: setIdentifier,
                    placeholder: "Email address or phone number",
                    keyboardType: identifier.includes("@") ? "email-address" : "default",
                  })}

                  {formError ? (
                    <Text className="text-[13px] mb-4 text-center font-semibold" style={{ color: "#D64545" }}>
                      {formError}
                    </Text>
                  ) : null}

                  <TouchableOpacity
                    className="h-[54px] items-center justify-center rounded-full"
                    style={{ backgroundColor: BRAND_GREEN }}
                    onPress={handleRequestCode}
                    disabled={busy || !identifier.trim()}
                    activeOpacity={0.9}
                  >
                    <Text className="text-base font-bold text-white">
                      {busy ? "Sending…" : "Send reset code"}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text className="text-2xl font-bold mb-2" style={{ color: TEXT_DARK }}>
                    Set a new password
                  </Text>
                  <Text className="text-[13px] leading-5 mb-6" style={{ color: TEXT_MUTED }}>
                    Enter the 6-digit code sent to {identifier.trim()} and choose a
                    new password.
                  </Text>

                  <Text className="text-[13px] mb-2 font-semibold" style={{ color: TEXT_MUTED }}>
                    Reset code
                  </Text>
                  <View className="flex-row justify-between mb-5">
                    {digits.map((digit, index) => (
                      <View
                        key={index}
                        style={{
                          width: 42,
                          height: 54,
                          borderRadius: 14,
                          backgroundColor: digit ? "#F0FBF6" : "rgba(255,255,255,0.18)",
                          borderWidth: 1.6,
                          borderColor: digit ? BRAND_GREEN : "rgba(255,255,255,0.45)",
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

                  <Text className="text-[13px] mb-2 font-semibold" style={{ color: TEXT_MUTED }}>
                    New password
                  </Text>
                  {renderField({
                    value: newPassword,
                    onChangeText: setNewPassword,
                    placeholder: "At least 8 characters",
                    secure: true,
                    visible: showPassword,
                    onToggle: () => setShowPassword(!showPassword),
                  })}

                  <Text className="text-[13px] mb-2 font-semibold" style={{ color: TEXT_MUTED }}>
                    Confirm new password
                  </Text>
                  {renderField({
                    value: confirmPassword,
                    onChangeText: setConfirmPassword,
                    placeholder: "Re-enter your new password",
                    secure: true,
                    visible: showConfirmPassword,
                    onToggle: () => setShowConfirmPassword(!showConfirmPassword),
                  })}

                  {formError ? (
                    <Text className="text-[13px] my-2 text-center font-semibold" style={{ color: "#D64545" }}>
                      {formError}
                    </Text>
                  ) : null}

                  <View className="items-center mb-4">
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

                  <TouchableOpacity
                    className="h-[54px] items-center justify-center rounded-full"
                    style={{ backgroundColor: BRAND_GREEN }}
                    onPress={handleReset}
                    disabled={busy || !isCodeComplete || !newPassword || !confirmPassword}
                    activeOpacity={0.9}
                  >
                    <Text className="text-base font-bold text-white">
                      {busy ? "Updating…" : "Update password"}
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity className="mt-6 items-center" onPress={() => router.replace("/login" as any)}>
                <Text className="text-sm font-bold" style={{ color: BRAND_GREEN_DARK }}>
                  Back to login
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}