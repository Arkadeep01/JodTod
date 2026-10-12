import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';

import {
  BubbleBackdrop,
  ScreenHeader,
  GlassCard,
  ActionRow,
  Avatar,
  StatusPill,
  colors,
} from '@/components/groups/ui';
import { ConfirmSheet } from '@/components/groups/ConfirmSheet';
import { archiveGroup, fetchGroupDetail, type GroupDetail } from '@/services/groups.api';
import { groupStatusOf } from '@/lib/groupAdapters';

type SheetMode = 'archive' | null;

export default function GroupSettings() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = Array.isArray(id) ? id[0] : (id as string);
  const [sheet, setSheet] = useState<SheetMode>(null);
  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const group = await fetchGroupDetail(groupId);
      if (!mountedRef.current) return;
      if (!group) {
        setError('Group not found.');
        setDetail(null);
      } else {
        setDetail(group);
      }
    } catch (e) {
      if (!mountedRef.current) return;
      setError(e instanceof Error ? e.message : 'Could not load settings.');
      setDetail(null);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [groupId]);

  useFocusEffect(
    useCallback(() => {
      mountedRef.current = true;
      void load();
      return () => {
        mountedRef.current = false;
      };
    }, [load]),
  );

  const confirmArchive = useCallback(async () => {
    if (!groupId || archiving) return;
    setArchiving(true);
    try {
      await archiveGroup(groupId);
      if (!mountedRef.current) return;
      setSheet(null);
      router.replace('/(tabs)/groups' as any);
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : 'Could not archive the group.');
        setSheet(null);
      }
    } finally {
      if (mountedRef.current) setArchiving(false);
    }
  }, [groupId, archiving, router]);

  if (loading) {
    return (
      <BubbleBackdrop>
        <ScreenHeader title="Group Settings" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="small" color={colors.textDark} />
        </View>
      </BubbleBackdrop>
    );
  }

  if (error || !detail) {
    return (
      <BubbleBackdrop>
        <ScreenHeader title="Group Settings" />
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-sm" style={{ color: colors.textMuted }}>
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
      </BubbleBackdrop>
    );
  }

  const base = `/(tabs)/groups/${detail.id}`;

  return (
    <BubbleBackdrop>
      <ScreenHeader title="Group Settings" />

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Group summary strip */}
        <GlassCard style={{ marginBottom: 18 }}>
          <View className="flex-row items-center justify-between px-4 py-4">
            <View className="flex-row items-center gap-3 flex-1">
              <Avatar name={detail.name} size={46} photoUri={detail.image_url ?? undefined} />
              <View className="flex-1">
                <View className="flex-row items-center gap-2 mb-1">
                  <Text className="text-[15px] font-bold" style={{ color: colors.textDark }}>
                    {detail.name}
                  </Text>
                  <StatusPill status={groupStatusOf(detail)} />
                </View>
                <Text className="text-[12px]" style={{ color: colors.textMuted }}>
                  {detail.member_count === 1 ? '1 member' : `${detail.member_count} members`}
                </Text>
                {detail.description ? (
                  <Text className="text-[12px]" style={{ color: colors.textMuted }} numberOfLines={2}>
                    {detail.description}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        </GlassCard>

        <GlassCard style={{ marginBottom: 18 }}>
          <View style={{ paddingHorizontal: 16 }}>
            <ActionRow icon="people-outline" label="Manage Members" onPress={() => router.push(`${base}/members` as any)} />
            <ActionRow icon="link-outline" label="Invite via Link" onPress={() => router.push(`${base}/invite` as any)} />
            <ActionRow icon="qr-code-outline" label="Invite via QR Code" onPress={() => router.push(`${base}/invite` as any)} />
            <View>
              {/* App-level notification settings live on Preferences;
                  previously a dead row with an empty handler. */}
              <ActionRow icon="notifications-outline" label="Notification Preferences" onPress={() => router.push('/preferences' as any)} />
            </View>
          </View>
        </GlassCard>

        <GlassCard>
          <View style={{ paddingHorizontal: 16 }}>
            <View>
              <ActionRow icon="archive-outline" label="Archive Group" onPress={() => setSheet('archive')} />
            </View>
          </View>
        </GlassCard>

        {detail.lifecycle === 'archived' ? (
          <Text className="mt-3 text-center text-[12px]" style={{ color: colors.textMuted }}>
            This group is archived. Balances and history stay available.
          </Text>
        ) : null}
      </ScrollView>

      {/* Archive confirmation sheet */}
      <ConfirmSheet
        visible={!!sheet}
        title="Archive Group"
        message="Move this group to archive. Balances and history stay available."
        icon="archive-outline"
        variant="solid"
        confirmLabel={archiving ? 'Archiving…' : 'Archive Group'}
        onConfirm={() => void confirmArchive()}
        onClose={() => setSheet(null)}
      />
    </BubbleBackdrop>
  );
}
