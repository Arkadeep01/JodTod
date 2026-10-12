import { useState, type ReactNode } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ImageBackground,
  Image,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import * as Google from 'expo-auth-session/providers/google';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';

const { width: SCREEN_W } = Dimensions.get('window');

// ---------------------------------------------------------------------------
// Palette — bolder teal-green, matches the restyled login.tsx
// ---------------------------------------------------------------------------

const GLOW_FROM = '#2DD4BF';
const GLOW_TO = '#8B5CF6';

const BRAND_GREEN_LIGHT = '#00E6A8';
const BRAND_GREEN = '#00B894';
const BRAND_GREEN_DARK = '#00896B';

const TEXT_DARK = '#14212B';
const TEXT_MUTED = '#4B5A66';

const HEADER_TITLE = '#0B3D62';
const HEADER_SUB = '#2A5A82';

// Lowered so the bubble background tints through the inputs instead of a flat wash
const INPUT_BG = 'rgba(255,255,255,0.18)';
const INPUT_BORDER = 'rgba(255,255,255,0.45)';

// ---------------------------------------------------------------------------
// Glass card — blurred and translucent so the bubble background's own color
// shows through it, instead of reading as a flat white box
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
          borderColor: 'rgba(255,255,255,0.35)',
          shadowColor: '#5FA8B4',
          shadowOpacity: 0.25,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 10 },
          elevation: 10,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {/*
        Legacy BlurView path (no blurMethod): the dimezis methods require
        a configured blurTarget and warn + fall back to "none" without one,
        so a static auth card uses the plain supported blur instead.
      */}
      <BlurView
        intensity={14}
        tint="light"
        style={{ borderRadius: radius }}
      >
        {/* soft sky/green tint instead of flat white so bubbles read through in color */}
        <LinearGradient
          colors={['rgba(255,255,255,0.10)', 'rgba(210,240,230,0.08)']}
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
// Simple pill input — translucent fill so it sits as a layer on the glass card
// ---------------------------------------------------------------------------

function GlassInput({
  children,
  style,
}: {
  children: ReactNode;
  style?: any;
}) {
  return (
    <View
      style={[
        {
          borderRadius: 16,
          backgroundColor: INPUT_BG,
          borderWidth: 1,
          borderColor: INPUT_BORDER,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Gradient CTA — solid vivid green capsule pill with trailing arrow
// ---------------------------------------------------------------------------

const CTA_HEIGHT = 54;
const CTA_RADIUS = CTA_HEIGHT / 2; // full capsule, matches reference "Sign Up" button

function GradientCTA({
  children,
  onPress,
  disabled,
  radius = CTA_RADIUS,
  icon = 'arrow-forward',
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
        shadowColor: disabled ? 'transparent' : BRAND_GREEN,
        shadowOpacity: disabled ? 0 : 0.45,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: disabled ? 0 : 8,
      }}
    >
      <LinearGradient
        colors={
          disabled
            ? ['#D7E0E0', '#C7D2D2']
            : [BRAND_GREEN_LIGHT, BRAND_GREEN, BRAND_GREEN_DARK]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          height: CTA_HEIGHT,
          borderRadius: radius,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {children}
        {icon ? (
          <Ionicons
            name={icon}
            size={18}
            color={disabled ? TEXT_MUTED : '#FFFFFF'}
          />
        ) : null}
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Real multicolor Google "G" mark — Ionicons' logo-google is flat single-color
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
// Social button — solid white capsule pill with soft shadow
// ---------------------------------------------------------------------------

const SOCIAL_HEIGHT = 50;
const SOCIAL_RADIUS = SOCIAL_HEIGHT / 2; // same capsule-pill language as GradientCTA

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
        backgroundColor: '#FFFFFF',
        shadowColor: '#2A5A82',
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
// Full-bleed bubble backdrop (same asset & treatment as login.tsx)
// ---------------------------------------------------------------------------

function BubbleBackdrop({ children }: { children: ReactNode }) {
  return (
    <ImageBackground
      source={require('../../../assets/images/jodtod/background_home.png')}
      resizeMode="cover"
      style={{ flex: 1, width: SCREEN_W }}
    >
      {children}
    </ImageBackground>
  );
}

// ---------------------------------------------------------------------------
// Header photo — the split-expenses illustration, given a little extra
// height and vertical breathing room, plus a light blend at the very bottom
// so it settles into the card instead of cutting off sharply
// ---------------------------------------------------------------------------

function HeaderVisual({ height }: { height: number }) {
  return (
    <View style={{ width: SCREEN_W, height, overflow: 'hidden' }}>
      <Image
        source={require('../../../assets/images/jodtod/tip.png')}
        style={{
          position: 'absolute',
          top: -10,
          left: 0,
          width: SCREEN_W,
          height: '110%',
        }}
        resizeMode="cover"
      />

      {/* Soft blend into the card below — light, not a wash */}
      <LinearGradient
        colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.5)']}
        locations={[0.8, 1] as any}
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '24%',
        }}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Signup screen
// ---------------------------------------------------------------------------

export default function Signup() {
  const router = useRouter();
  const { signup, loginWithGoogle, isLoading: authLoading } = useAuth();
  const manifestExtra = (
    Constants as unknown as {
      manifest2?: { extra?: { expoClient?: { extra?: unknown } } };
    }
  ).manifest2?.extra?.expoClient?.extra;
  const googleClientId = (
    Constants.expoConfig?.extra?.googleWebClientId ??
    (manifestExtra as { googleWebClientId?: string } | undefined)?.googleWebClientId
  ) as string | undefined;
  const googleHookClientId = googleClientId ?? 'google-client-id-not-configured';
  const [, , promptGoogleAsync] = Google.useAuthRequest({
    androidClientId: googleHookClientId,
    iosClientId: googleHookClientId,
    webClientId: googleHookClientId,
    scopes: ['openid', 'email', 'profile'],
  });

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSignup = async () => {
    setFormError(null);
    if (!fullName.trim()) {
      setFormError('Enter your full name.');
      return;
    }
    if (!email.trim() && !phone.trim()) {
      setFormError('Enter your email address or phone number.');
      return;
    }
    if (phone.trim() && (phone.trim().length < 7 || phone.trim().length > 20)) {
      setFormError('Enter a valid phone number.');
      return;
    }
    if (!password || password.length < 8) {
      setFormError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }
    if (!agreedToTerms) {
      setFormError('Please agree to the Terms of Service and Privacy Policy.');
      return;
    }
    setBusy(true);
    try {
      await signup({
        name: fullName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        password,
      });
      // Signup creates an immediate backend session and dispatches the
      // channel OTP. The account is PENDING until verification, so route
      // to /verify-email (the (auth) layout also redirects there while
      // verification is pending). Keep this session so verification can
      // complete without logging in again.
      router.replace('/verify-email' as any);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Signup failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleSocial = async (provider: 'Google' | 'Apple') => {
    if (provider === 'Apple') {
      setFormError('Apple sign-in is not configured yet.');
      return;
    }
    if (!googleClientId) {
      setFormError('Google sign-in is not configured.');
      return;
    }

    setBusy(true);
    setFormError(null);
    try {
      const result = await promptGoogleAsync();
      if (result.type !== 'success') {
        if (result.type !== 'cancel' && result.type !== 'dismiss') {
          setFormError('Google sign-in was not completed.');
        }
        return;
      }
      const idToken = (result as { params?: { id_token?: string }; authentication?: { idToken?: string } }).params?.id_token
        ?? (result as { authentication?: { idToken?: string } }).authentication?.idToken;
      if (!idToken) {
        setFormError('Google did not return an identity credential.');
        return;
      }
      await loginWithGoogle({ provider: 'google', id_token: idToken });
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Google sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="flex-1">
      <BubbleBackdrop>
        {/* Fixed back button — sits outside ScrollView so it never scrolls away */}
        <View
          style={{
            position: 'absolute',
            top: 54,
            left: 18,
            zIndex: 10,
          }}
        >
          <TouchableOpacity
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{
              backgroundColor: 'rgba(255,255,255,0.85)',
              shadowColor: '#000',
              shadowOpacity: 0.15,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
              elevation: 3,
            }}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={20} color={BRAND_GREEN_DARK} />
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40, flexGrow: 1 }}
        >
          {/* Header — full bleed photo, given a bit more height for the art */}
          <View style={{ position: 'relative', width: SCREEN_W }}>
            <HeaderVisual height={370} />
          </View>

          {/* Glass signup card, floated up slightly over the photo */}
          <View style={{ marginTop: -28, marginHorizontal: 18 }}>
            <GlassCard radius={28}>
              <View className="px-6 pt-7 pb-8">
                <Text
                  className="text-2xl font-bold mb-5"
                  style={{ letterSpacing: 0.4, color: TEXT_DARK }}
                >
                  Create your account
                </Text>

                {/* Full name */}
                <Text className="text-[13px] mb-2 font-semibold" style={{ color: TEXT_MUTED }}>
                  Full name
                </Text>
                <GlassInput style={{ marginBottom: 18 }}>
                  <View className="flex-row items-center px-3.5 h-[52px]">
                    <Ionicons
                      name="person-outline"
                      size={18}
                      color={BRAND_GREEN_DARK}
                      style={{ marginRight: 10 }}
                    />
                    <TextInput
                      className="flex-1 text-sm"
                      style={{ color: TEXT_DARK }}
                      placeholder="Enter your full name"
                      placeholderTextColor="rgba(20,33,43,0.4)"
                      value={fullName}
                      onChangeText={setFullName}
                      autoCapitalize="words"
                    />
                  </View>
                </GlassInput>

                {/* Email */}
                <Text className="text-[13px] mb-2 font-semibold" style={{ color: TEXT_MUTED }}>
                  Email address
                </Text>
                <GlassInput style={{ marginBottom: 18 }}>
                  <View className="flex-row items-center px-3.5 h-[52px]">
                    <Ionicons
                      name="mail-outline"
                      size={18}
                      color={BRAND_GREEN_DARK}
                      style={{ marginRight: 10 }}
                    />
                    <TextInput
                      className="flex-1 text-sm"
                      style={{ color: TEXT_DARK }}
                      placeholder="Enter your email"
                      placeholderTextColor="rgba(20,33,43,0.4)"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                </GlassInput>

                {/* Phone (optional — either email or phone is required) */}
                <Text className="text-[13px] mb-2 font-semibold" style={{ color: TEXT_MUTED }}>
                  Phone number (optional)
                </Text>
                <GlassInput style={{ marginBottom: 18 }}>
                  <View className="flex-row items-center px-3.5 h-[52px]">
                    <Ionicons
                      name="call-outline"
                      size={18}
                      color={BRAND_GREEN_DARK}
                      style={{ marginRight: 10 }}
                    />
                    <TextInput
                      className="flex-1 text-sm"
                      style={{ color: TEXT_DARK }}
                      placeholder="Enter your phone number"
                      placeholderTextColor="rgba(20,33,43,0.4)"
                      value={phone}
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
                      autoCapitalize="none"
                    />
                  </View>
                </GlassInput>

                {/* Password */}
                <Text className="text-[13px] mb-2 font-semibold" style={{ color: TEXT_MUTED }}>
                  Password
                </Text>
                <GlassInput style={{ marginBottom: 18 }}>
                  <View className="flex-row items-center px-3.5 h-[52px]">
                    <Ionicons
                      name="lock-closed-outline"
                      size={18}
                      color={BRAND_GREEN_DARK}
                      style={{ marginRight: 10 }}
                    />
                    <TextInput
                      className="flex-1 text-sm"
                      style={{ color: TEXT_DARK }}
                      placeholder="Create a password"
                      placeholderTextColor="rgba(20,33,43,0.4)"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                      <Ionicons
                        name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                        size={18}
                        color={TEXT_MUTED}
                      />
                    </TouchableOpacity>
                  </View>
                </GlassInput>

                {/* Confirm password */}
                <Text className="text-[13px] mb-2 font-semibold" style={{ color: TEXT_MUTED }}>
                  Confirm password
                </Text>
                <GlassInput style={{ marginBottom: 18 }}>
                  <View className="flex-row items-center px-3.5 h-[52px]">
                    <Ionicons
                      name="lock-closed-outline"
                      size={18}
                      color={BRAND_GREEN_DARK}
                      style={{ marginRight: 10 }}
                    />
                    <TextInput
                      className="flex-1 text-sm"
                      style={{ color: TEXT_DARK }}
                      placeholder="Re-enter your password"
                      placeholderTextColor="rgba(20,33,43,0.4)"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showConfirmPassword}
                    />
                    <TouchableOpacity
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      <Ionicons
                        name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                        size={18}
                        color={TEXT_MUTED}
                      />
                    </TouchableOpacity>
                  </View>
                </GlassInput>

                {/* Terms */}
                <TouchableOpacity
                  className="flex-row items-start mb-6"
                  onPress={() => setAgreedToTerms(!agreedToTerms)}
                >
                  <View
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 5,
                      borderWidth: 1.4,
                      borderColor: BRAND_GREEN_DARK,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 10,
                      marginTop: 2,
                      backgroundColor: agreedToTerms ? BRAND_GREEN : 'transparent',
                    }}
                  >
                    {agreedToTerms && <Ionicons name="checkmark" size={13} color="#fff" />}
                  </View>
                  <Text className="flex-1 text-[13px] leading-[19px]" style={{ color: TEXT_MUTED }}>
                    I agree to the{' '}
                    <Text className="font-semibold" style={{ color: GLOW_TO }}>
                      Terms of Service
                    </Text>{' '}
                    and{' '}
                    <Text className="font-semibold" style={{ color: GLOW_TO }}>
                      Privacy Policy
                    </Text>
                  </Text>
                </TouchableOpacity>

                {formError ? (
                  <Text className="text-[13px] mb-4 text-center font-semibold" style={{ color: '#D64545' }}>
                    {formError}
                  </Text>
                ) : null}

                <View style={{ marginBottom: 24 }}>
                  <GradientCTA onPress={handleSignup} disabled={busy || authLoading}>
                    <Text className="text-white text-base font-bold">
                      {busy || authLoading ? 'Creating…' : 'Sign Up'}
                    </Text>
                  </GradientCTA>
                </View>

                {/* Divider */}
                <View className="flex-row items-center mb-5">
                  <View className="flex-1 h-px" style={{ backgroundColor: INPUT_BORDER }} />
                  <Text className="text-xs mx-3" style={{ color: TEXT_MUTED }}>
                    or continue with
                  </Text>
                  <View className="flex-1 h-px" style={{ backgroundColor: INPUT_BORDER }} />
                </View>

                {/* Social buttons */}
                <View className="flex-row gap-3 mb-6">
                  <SocialButton
                    renderIcon={() => <GoogleGlyph size={18} />}
                    label="Google"
                    onPress={() => handleSocial('Google')}
                  />
                  <SocialButton
                    renderIcon={() => <Ionicons name="logo-apple" size={20} color="#000000" />}
                    label="Apple"
                    onPress={() => handleSocial('Apple')}
                  />
                </View>

                {/* Login link */}
                <View className="flex-row justify-center mb-2">
                  <Text className="text-[13px]" style={{ color: TEXT_MUTED }}>
                    Already have an account?{' '}
                  </Text>
                  <TouchableOpacity onPress={() => router.push('/login' as any)}>
                    <Text className="text-[13px] font-bold" style={{ color: GLOW_TO }}>
                      Login
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </GlassCard>
          </View>
        </ScrollView>
      </BubbleBackdrop>
    </View>
  );
}
