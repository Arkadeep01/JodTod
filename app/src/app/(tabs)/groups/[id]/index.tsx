import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassCard, ActionRow, GlassLayers, ScreenBackground, cardShadow, colors } from '@/components/groups/ui';
import { StatusPill } from '@/components/groups/ui';
import { MemberStack } from '@/components/groups/MemberStack';
import { BalanceSummary } from '@/components/groups/BalanceSummary';
import { ProfilePhotoSheet } from '@/components/profile/ProfilePhotoSheet';
import { useGroupPhoto } from '@/hooks/useGroupPhoto';
import { useAuth } from '@/context/AuthContext';
import {
  fetchGroupDetail,
  fetchGroupExpenses,
  leaveGroup,
  type GroupDetail,
} from '@/services/groups.api';
import {
  avatarOrEmpty,
  groupStatusOf,
} from '@/lib/groupAdapters';

/**
 * Header avatar geometry. All overlap math derives from this one constant
 * (half-diameter offsets); horizontal centering is flex-driven, so narrow
 * screens and larger font scales just work — no device-specific numbers.
 */
const AVATAR_SIZE = 96;

function groupInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function GroupAvatar({ name, imageUri, size }: { name: string; imageUri?: string; size: number }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    // A new URL (group switch / fresh upload) gets a fresh load attempt
    // instead of inheriting the previous failure state.
    setFailed(false);
  }, [imageUri]);

  const radius = size / 2;
  if (imageUri && !failed) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          borderWidth: 3,
          borderColor: '#fff',
          overflow: 'hidden',
          backgroundColor: colors.neutralBg,
        }}
      >
        <Image
          source={{ uri: imageUri }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      </View>
    );
  }
  return (
    <LinearGradient
      colors={[colors.brandLight, colors.brandDark]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        borderWidth: 3,
        borderColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.34 }}>
        {groupInitials(name)}
      </Text>
    </LinearGradient>
  );
}

export default function GroupDetails() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const groupId = Array.isArray(id) ? id[0] : (id as string);

  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!groupId) {
      setError('Group not found.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Detail + full expense list in parallel (independent).
      const [group, expenses] = await Promise.all([
        fetchGroupDetail(groupId),
        fetchGroupExpenses(groupId, 100, 0),
      ]);
      if (!mountedRef.current) return;
      if (!group) {
        setError('Group not found.');
        setDetail(null);
        return;
      }
      setDetail(group);
      setTotalExpenses(
        expenses.expenses.reduce((sum, row) => sum + Number(row.amount), 0),
      );
    } catch (e) {
      if (!mountedRef.current) return;
      setError(e instanceof Error ? e.message : 'Could not load group.');
      setDetail(null);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [groupId]);

  // Single focus-driven load (focus fires on mount too — no double fetch).
  useFocusEffect(
    useCallback(() => {
      mountedRef.current = true;
      void load();
      return () => {
        mountedRef.current = false;
      };
    }, [load]),
  );

  const handleLeave = useCallback(() => {
    if (!groupId || leaving) return;
    Alert.alert(
      'Leave group?',
      'You will no longer see this group or its balances.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => void (async () => {
            setLeaving(true);
            try {
              await leaveGroup(groupId);
              router.replace('/(tabs)/groups' as any);
            } catch (e) {
              if (mountedRef.current) {
                setError(e instanceof Error ? e.message : 'Could not leave the group.');
              }
            } finally {
              if (mountedRef.current) setLeaving(false);
            }
          })(),
        },
      ],
    );
  }, [groupId, leaving, router]);

  // Group photo: local override shows upload/remove instantly; undefined
  // means "use the server value". Reset on group switch so one group's
  // image never flashes on another group's screen.
  const [imageOverride, setImageOverride] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    setImageOverride(undefined);
  }, [groupId]);

  const myRole = user?.id
    ? detail?.members.find((m) => m.user_id === user.id)?.role
    : undefined;
  const canEditPhoto = myRole === 'admin';

  const effectiveImage = imageOverride !== undefined ? imageOverride : detail?.image_url;
  const resolvedImage = avatarOrEmpty(effectiveImage);
  const hasPhoto = resolvedImage.length > 0;

  const photo = useGroupPhoto({
    groupId: groupId ?? '',
    hasPhoto,
    onImageChanged: (url) => setImageOverride(url),
  });

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.textDark} />
        <Text className="mt-3 text-sm" style={{ color: colors.textMuted }}>
          Loading group…
        </Text>
      </View>
    );
  }

  if (error || !detail) {
    return (
      <View className="flex-1 items-center justify-center px-8" style={{ backgroundColor: colors.bg }}>
        <Text className="text-center" style={{ color: colors.textMuted }}>
          {error ?? 'Group not found'}
        </Text>
        <TouchableOpacity
          onPress={() => void load()}
          activeOpacity={0.7}
          className="mt-4 rounded-full px-5 py-2.5"
          style={{ backgroundColor: colors.brandDark }}
        >
          <Text className="text-[13px] font-bold text-white">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const myNet = Number(detail.my_net);
  const base = `/(tabs)/groups/${detail.id}`;
  const stackMembers = detail.members.map((m) => ({
    id: m.user_id,
    name: m.display_name,
    avatar: avatarOrEmpty(m.avatar_url) || undefined,
  }));

  return (
    <View className="flex-1">
      <ScreenBackground />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {/* Top controls live outside the card and stay clear of the avatar */}
        <View className="flex-row items-center justify-between px-5" style={{ paddingTop: insets.top + 10 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            className="w-10 h-10 rounded-full items-center justify-center border border-white/60 overflow-hidden"
            style={[cardShadow, { backgroundColor: 'rgba(255,255,255,0.01)' }]}
          >
            <GlassLayers radius={20} />
            <View className="absolute inset-0 bg-white/20" />
            <Ionicons name="chevron-back" size={20} color={colors.textDark} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push(`${base}/settings` as any)}
            accessibilityRole="button"
            accessibilityLabel="Group settings"
            className="w-10 h-10 rounded-full items-center justify-center border border-white/60 overflow-hidden"
            style={[cardShadow, { backgroundColor: 'rgba(255,255,255,0.01)' }]}
          >
            <GlassLayers radius={20} />
            <View className="absolute inset-0 bg-white/20" />
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.textDark} />
          </TouchableOpacity>
        </View>

        {/* Info card with the avatar overlapping its top edge */}
        <View style={{ marginTop: AVATAR_SIZE / 2 + 12, paddingHorizontal: 20 }}>
          <View>
            <GlassCard className="rounded-[24px]">
              <View style={{ padding: 20, paddingTop: AVATAR_SIZE / 2 + 14 }}>
                <View className="flex-row flex-wrap items-center justify-center" style={{ gap: 8 }}>
                  <Text
                    className="text-center text-xl font-extrabold"
                    style={{ color: colors.textDark }}
                    numberOfLines={2}
                  >
                    {detail.name}
                  </Text>
                  <StatusPill status={groupStatusOf(detail)} />
                </View>

                {detail.description ? (
                  <Text
                    className="mt-1.5 text-center text-[13px] leading-5"
                    style={{ color: colors.textMuted }}
                    numberOfLines={3}
                  >
                    {detail.description}
                  </Text>
                ) : null}

                <View className="mt-3 flex-row items-center" style={{ gap: 10 }}>
                  <TouchableOpacity
                    className="flex-row items-center"
                    accessibilityRole="button"
                    accessibilityLabel="View members"
                    onPress={() => router.push(`${base}/members` as any)}
                  >
                    <MemberStack members={stackMembers} max={4} size={30} />
                  </TouchableOpacity>
                  <Text className="text-[12px] font-semibold" style={{ color: colors.textMuted }}>
                    {detail.member_count === 1 ? '1 member' : `${detail.member_count} members`}
                  </Text>
                </View>
              </View>
            </GlassCard>
            {/* Centered avatar overlapping the card edge. box-none lets all
                touches outside the avatar/camera fall through to the card. */}
            <View
              className="absolute inset-x-0 items-center"
              style={{ top: -AVATAR_SIZE / 2 }}
              pointerEvents="box-none"
            >
              <View>
                <GroupAvatar
                  name={detail.name}
                  imageUri={hasPhoto ? resolvedImage : undefined}
                  size={AVATAR_SIZE}
                />
                {canEditPhoto ? (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    disabled={photo.uploading}
                    onPress={() => {
                      if (groupId) photo.setShowSheet(true);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Change group photo"
                    className="absolute bottom-0 right-0 h-9 w-9 items-center justify-center rounded-full border-2 border-white"
                    style={{
                      backgroundColor: colors.brandDark,
                      opacity: photo.uploading ? 0.7 : 1,
                    }}
                  >
                    {photo.uploading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Ionicons name="camera" size={16} color="#FFFFFF" />
                    )}
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>

          <View style={{ marginTop: 12 }}>
            <BalanceSummary
              youAreOwed={myNet > 0 ? myNet : 0}
              youOwe={myNet < 0 ? -myNet : 0}
              totalExpenses={totalExpenses}
              variant="cards"
            />
          </View>

          <View style={{ marginTop: 16 }}>
            <GlassCard>
              <View style={{ paddingHorizontal: 16 }}>
                <ActionRow icon="receipt-outline" label="Expenses" onPress={() => router.push(`${base}/expenses` as any)} />
                <ActionRow icon="people-outline" label="Members" onPress={() => router.push(`${base}/members` as any)} />
                <ActionRow icon="person-add-outline" label="Invite Members" onPress={() => router.push(`${base}/invite` as any)} />
                <ActionRow icon="cash-outline" label="Settle Up" onPress={() => router.push({ pathname: '/(tabs)/settle', params: { groupId: detail.id } } as any)} />
                <ActionRow icon="time-outline" label="Settlement History" onPress={() => router.push({ pathname: '/(tabs)/settle', params: { groupId: detail.id } } as any)} />
                <View className="border-b-0">
                  <ActionRow icon="settings-outline" label="Group Settings" onPress={() => router.push(`${base}/settings` as any)} />
                </View>
              </View>
            </GlassCard>
          </View>

          <View style={{ marginTop: 20 }}>
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={leaving}
              onPress={() => void handleLeave()}
              className="flex-row items-center justify-center"
              style={{ height: 52, borderRadius: 26, backgroundColor: colors.dangerBg, gap: 8, opacity: leaving ? 0.6 : 1 }}
            >
              {leaving ? (
                <ActivityIndicator size="small" color={colors.danger} />
              ) : (
                <Ionicons name="log-out-outline" size={17} color={colors.danger} />
              )}
              <Text className="text-[14px] font-bold" style={{ color: colors.danger }}>
                {leaving ? 'Leaving…' : 'Leave Group'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      <ProfilePhotoSheet
        visible={photo.showSheet}
        uploading={photo.uploading}
        hasPhoto={hasPhoto}
        title="Group photo"
        onTakePhoto={() => void photo.takePhoto()}
        onChooseFromGallery={() => void photo.chooseFromGallery()}
        onRemovePhoto={photo.removePhoto}
        onClose={() => photo.setShowSheet(false)}
      />
    </View>
  );
}
