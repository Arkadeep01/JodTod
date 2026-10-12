/**
 * Personal Information — central profile-management page.
 *
 * Flow: My Profile -> Personal Information -> Edit -> Edit Profile
 * -> Save -> Personal Information (updated) -> Back -> My Profile.
 *
 * All values come from the authenticated backend record
 * (GET /api/users/me/profile); the account-status indicator is
 * server-calculated (account_health) and lives ONLY beside the photo
 * in the header card. Photo editing reuses the Page 01 flow
 * (useProfilePhoto + ProfilePhotoSheet). Email is read-only; editing
 * lives on /edit-profile (Full Name, Username, Phone Number).
 * Display Name preference (account_name | username) is persisted to
 * /api/users/me/preferences and drives the primary name shown here
 * and on My Profile.
 */

import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  fetchProfileDashboard,
  resolvePhotoUrl,
  type AccountHealth,
  type ProfileDashboard,
} from "../services/profile.api";
import {
  fetchPreferences,
  getCachedPreferences,
  saveCachedPreferences,
  updatePreferences,
  type DisplayNameChoice,
} from "../services/preferences.api";
import { useProfilePhoto } from "../hooks/useProfilePhoto";
import { ProfilePhotoSheet } from "../components/profile/ProfilePhotoSheet";

const PHOTO_PLACEHOLDER = require("../../assets/images/jodtod/people.png");

const STATUS_DOT: Record<AccountHealth["status_color"], string> = {
  green: "#22C55E",
  yellow: "#EAB308",
  red: "#EF4444",
};

function InfoCard({
  label,
  value,
  hint,
  badge,
}: {
  label: string;
  value: string | null;
  hint?: string;
  badge?: string | null;
}) {
  return (
    <View className="mb-3 rounded-[20px] border border-white/30 bg-white/50 px-4 py-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-[13px] font-semibold uppercase tracking-wide text-[#4B5A66]">
          {label}
        </Text>
        {badge ? (
          <View className="flex-row items-center rounded-full bg-[#00B894]/15 px-2.5 py-1">
            <Ionicons name="checkmark-circle" size={13} color="#00896B" />
            <Text className="ml-1 text-[11px] font-bold text-[#00896B]">
              {badge}
            </Text>
          </View>
        ) : null}
      </View>
      <Text
        className={
          value
            ? "mt-1.5 text-[17px] font-semibold text-[#14212B]"
            : "mt-1.5 text-[15px] italic text-[#6B7280]"
        }
      >
        {value ?? "Not set"}
      </Text>
      {hint ? (
        <Text className="mt-1 text-[12px] text-[#6B7280]">{hint}</Text>
      ) : null}
    </View>
  );
}

export default function PersonalInformation() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const [dashboard, setDashboard] = useState<ProfileDashboard | null>(null);
  const [displayChoice, setDisplayChoice] = useState<DisplayNameChoice>("account_name");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displaySaving, setDisplaySaving] = useState(false);
  // Local override set immediately after upload/remove so the new photo
  // shows without waiting for a refetch. `undefined` = no override.
  const [avatarOverride, setAvatarOverride] = useState<string | null | undefined>(
    undefined,
  );

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadProfile = useCallback(async () => {
    if (mountedRef.current) {
      setLoading(true);
      setError(null);
    }
    try {
      const cached = await getCachedPreferences().catch(() => null);
      if (mountedRef.current && cached) {
        setDisplayChoice(cached.display_name);
      }
      const [data, prefs] = await Promise.all([
        fetchProfileDashboard(),
        fetchPreferences(),
      ]);
      if (!mountedRef.current) return;
      setDashboard(data);
      setDisplayChoice(prefs.display_name);
      void saveCachedPreferences(prefs);
      // Fresh server state wins over any stale local override.
      setAvatarOverride(undefined);
      await refreshUser().catch(() => undefined);
    } catch (e) {
      if (!mountedRef.current) return;
      setError(
        e instanceof Error ? e.message : "Could not load your profile.",
      );
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [refreshUser]);

  // SINGLE loading trigger: useFocusEffect.
  //
  // useFocusEffect already runs on the first focus, so the previous
  // paired useEffect duplicated the initial load. One trigger only:
  //   opened   -> one load
  // revisited -> one load (so a Save on /edit-profile is immediately
  //               visible here without a restart)
  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile]),
  );

  const setDisplayNameChoice = useCallback(
    async (choice: DisplayNameChoice) => {
      if (displaySaving) return;
      const previous = displayChoice;
      if (previous === choice) return;
      if (mountedRef.current) {
        setDisplayChoice(choice);
        setDisplaySaving(true);
      }
      try {
        const saved = await updatePreferences({ display_name: choice });
        if (!mountedRef.current) return;
        setDisplayChoice(saved.display_name);
        void saveCachedPreferences(saved);
      } catch {
        // Revert: never leave the UI showing a rejected value.
        if (mountedRef.current) setDisplayChoice(previous);
      } finally {
        if (mountedRef.current) setDisplaySaving(false);
      }
    },
    [displayChoice, displaySaving],
  );

  const storedAvatar =
    avatarOverride !== undefined
      ? avatarOverride
      : (dashboard?.profile.avatar_url ?? user?.avatar_url ?? null);
  const photoUrl = resolvePhotoUrl(storedAvatar);

  const photo = useProfilePhoto({
    hasPhoto: photoUrl !== null,
    onAvatarChanged: (avatarUrl) => setAvatarOverride(avatarUrl),
  });

  const profile = dashboard?.profile ?? user;
  const health: AccountHealth | null = dashboard?.account_health ?? null;

  const fullName = profile?.name?.trim() || null;
  const username = profile?.username?.trim() || null;
  const email = profile?.email?.trim() || null;
  const phone = profile?.phone?.trim() || null;
  const emailVerified = Boolean(profile?.email_verified);
  const primaryName =
    displayChoice === "username" && username ? `@${username}` : (fullName ?? "Not set");

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/profile");
    }
  }, [router]);

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-[#F5F9FC]">
      {/* Background */}
      <Image
        source={require("../../assets/images/jodtod/background_home.png")}
        resizeMode="cover"
        className="absolute inset-0 h-full w-full"
      />

      {/* Content wrapper */}
      <View className="relative z-10 flex-1 p-6">
        {/* Header: back (top-left) | title | spacer */}
        <View className="mb-6 flex-row items-center justify-between">
          <TouchableOpacity
            onPress={goBack}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Back to My Profile"
            className="h-11 w-11 items-center justify-center rounded-full bg-white/30"
          >
            <Ionicons name="arrow-back-outline" size={24} color="#0B3D62" />
          </TouchableOpacity>
          <Text className="flex-1 text-center text-[22px] font-extrabold text-[#0B3D62]">
            Personal Information
          </Text>
          <View className="h-11 w-11" />
        </View>

        {loading && !dashboard ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#0B3D62" />
            <Text className="mt-3 text-[13px] font-medium text-[#4B5A66]">
              Loading your profile...
            </Text>
          </View>
        ) : error && !dashboard ? (
          <View className="items-center rounded-2xl border border-red-300/60 bg-white/60 px-4 py-5">
            <Text className="text-center text-[13px] font-medium text-red-600">
              {error}
            </Text>
            <TouchableOpacity
              onPress={() => void loadProfile()}
              activeOpacity={0.7}
              className="mt-3 rounded-full bg-[#0B3D62] px-4 py-2"
            >
              <Text className="text-[13px] font-bold text-white">Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Profile photo card: photo + status + Edit Profile */}
            <View className="mb-4 items-center rounded-[20px] border border-white/30 bg-white/50 px-4 py-6">
              <View className="relative">
                <Image
                  source={photoUrl ? { uri: photoUrl } : PHOTO_PLACEHOLDER}
                  resizeMode="cover"
                  className="h-20 w-20 rounded-full border-2 border-white/30"
                />
                {health ? (
                  <View
                    accessibilityLabel={`Account status: ${health.status_label}`}
                    className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full border-2 border-white"
                    style={{ backgroundColor: STATUS_DOT[health.status_color] }}
                  />
                ) : null}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => photo.setShowSheet(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Change profile photo"
                  className="absolute -bottom-1 -right-1 h-8 w-8 items-center justify-center rounded-full border border-white/40 bg-white"
                >
                  <Ionicons name="camera-outline" size={15} color="#0B3D62" />
                </TouchableOpacity>
              </View>

              <Text className="mt-3 text-[19px] font-extrabold text-[#14212B]">
                {primaryName}
              </Text>
              <Text className="mt-0.5 text-[13px] text-[#4B5A66]">
                {username ? `@${username}` : "Username not set"}
              </Text>

              <TouchableOpacity
                onPress={() => router.push("/edit-profile")}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Edit Profile"
                className="mt-4 rounded-full bg-[#00B894] px-8 py-2.5"
              >
                <Text className="text-[14px] font-bold text-white">
                  Edit Profile
                </Text>
              </TouchableOpacity>
            </View>

            {/* Full Name */}
            <InfoCard
              label="Full Name"
              value={fullName}
              hint="Shown when Display Name is Account Name."
            />

            {/* Username */}
            <InfoCard
              label="Username"
              value={username ? `@${username}` : null}
              hint="Shown when Display Name is Username."
            />

            {/* Email (read-only) */}
            <InfoCard
              label="Email"
              value={email}
              hint="Email cannot be changed."
              badge={email && emailVerified ? "Verified" : null}
            />

            {/* Phone */}
            <InfoCard label="Phone Number" value={phone} />

            {/* Display Name preference */}
            <View className="mb-3 rounded-[20px] border border-white/30 bg-white/50 px-4 py-4">
              <Text className="text-[13px] font-semibold uppercase tracking-wide text-[#4B5A66]">
                Display Name
              </Text>
              <Text className="mt-1 text-[12px] text-[#6B7280]">
                Choose which name appears across your profile.
              </Text>
              <View className="mt-3 gap-2">
                {(
                  [
                    { value: "account_name", label: "Account Name" },
                    { value: "username", label: "Username" },
                  ] as const
                ).map((option) => {
                  const active = displayChoice === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      activeOpacity={0.8}
                      disabled={displaySaving}
                      onPress={() => void setDisplayNameChoice(option.value)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      className={`flex-row items-center rounded-[14px] border px-4 py-3 ${
                        active
                          ? "border-[#00B894] bg-[#00B894]/15"
                          : "border-white/50 bg-white/30"
                      }`}
                    >
                      <View
                        className={`h-5 w-5 items-center justify-center rounded-full border-2 ${
                          active ? "border-[#00B894]" : "border-[#6B7280]/40"
                        }`}
                      >
                        {active ? (
                          <View className="h-2.5 w-2.5 rounded-full bg-[#00B894]" />
                        ) : null}
                      </View>
                      <Text
                        className={`ml-3 text-[15px] font-semibold ${
                          active ? "text-[#0B3D62]" : "text-[#4B5A66]"
                        }`}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {displaySaving ? (
                <View className="mt-2 flex-row items-center">
                  <ActivityIndicator size="small" color="#0B3D62" />
                  <Text className="ml-2 text-[12px] text-[#4B5A66]">
                    Saving...
                  </Text>
                </View>
              ) : null}
            </View>

            {loading ? (
              <View className="mt-2 flex-row items-center justify-center">
                <ActivityIndicator size="small" color="#0B3D62" />
                <Text className="ml-2 text-[13px] text-[#4B5A66]">
                  Refreshing...
                </Text>
              </View>
            ) : null}
          </ScrollView>
        )}
      </View>

      <ProfilePhotoSheet
        visible={photo.showSheet}
        uploading={photo.uploading}
        hasPhoto={photoUrl !== null}
        onTakePhoto={() => void photo.takePhoto()}
        onChooseFromGallery={() => void photo.chooseFromGallery()}
        onRemovePhoto={photo.removePhoto}
        onClose={() => photo.setShowSheet(false)}
      />
    </SafeAreaView>
  );
}
