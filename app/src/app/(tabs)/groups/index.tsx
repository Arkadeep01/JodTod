import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BubbleBackdrop, GlassLayers, cardShadow, colors } from '@/components/groups/ui';
import { FilterTabs } from '@/components/groups/FilterTabs';
import { GroupCard } from '@/components/groups/GroupCard';
import { EmptyState } from '@/components/groups/EmptyState';
import { PageTitle } from '@/components/ui/PageTitle';
import { fetchMyGroups, type GroupSummary } from '@/services/groups.api';
import type { Group } from '@/lib/groupAdapters';

type FilterTab = 'All' | 'Active' | 'Completed' | 'Archived';
const TABS: readonly FilterTab[] = ['All', 'Active', 'Completed', 'Archived'];

function toMockGroup(summary: GroupSummary): Group {
  return {
    id: summary.id,
    name: summary.name,
    status:
      summary.lifecycle === 'archived'
        ? 'Archived'
        : summary.settlement_status === 'settled'
          ? 'Completed'
          : 'Active',
    dateRange: '',
    destination: '',
    description: '',
    coverImage: '',
    totalExpenses: 0,
    youAreOwed: Number(summary.you_are_owed),
    youOwe: Number(summary.you_owe),
    members: [],
    expenses: [],
  };
}

export default function GroupsList() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<FilterTab>('All');
  const [groups, setGroups] = useState<Group[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [covers, setCovers] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchMyGroups();
      if (!mountedRef.current) return;
      setGroups(rows.map(toMockGroup));
      const nextCounts: Record<string, number> = {};
      const nextCovers: Record<string, string | null> = {};
      for (const row of rows) {
        nextCounts[row.id] = row.member_count;
        nextCovers[row.id] = row.image_url;
      }
      setCounts(nextCounts);
      setCovers(nextCovers);
    } catch (e) {
      if (!mountedRef.current) return;
      setGroups([]);
      setError(e instanceof Error ? e.message : 'Could not load groups.');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      mountedRef.current = true;
      void load();
      return () => {
        mountedRef.current = false;
      };
    }, [load]),
  );

  const filtered = useMemo(() => {
    return groups.filter((g) => {
      const matchesTab = tab === 'All' || g.status === tab;
      const matchesQuery = g.name.toLowerCase().includes(query.toLowerCase());
      return matchesTab && matchesQuery;
    });
  }, [groups, tab, query]);

  return (
    <BubbleBackdrop>
      <View className="flex-1 px-5" style={{ paddingTop: insets.top + 14 }}>
        <View className="mb-4 flex-row items-center justify-between">
          <PageTitle>Groups</PageTitle>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/groups/create' as any)}
            activeOpacity={0.9}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.brand,
              shadowColor: colors.brand,
              shadowOpacity: 0.35,
              shadowRadius: 9,
              shadowOffset: { width: 0, height: 5 },
              elevation: 4,
            }}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={colors.textDark} />
            <Text className="mt-3 text-sm" style={{ color: colors.textMuted }}>
              Loading groups…
            </Text>
          </View>
        ) : error ? (
          <View className="flex-1 items-center justify-center px-8">
            <Ionicons name="cloud-offline-outline" size={40} color={colors.danger} />
            <Text className="mt-3 text-center text-[15px] font-bold" style={{ color: colors.textDark }}>
              Could not load groups
            </Text>
            <Text className="mt-1 text-center text-[13px]" style={{ color: colors.textMuted }}>
              {error}
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
        ) : (
          <>
            {groups.length > 0 && (
              <>
                <View className="mb-3 rounded-full" style={[cardShadow, { backgroundColor: 'rgba(255,255,255,0.01)' }]}>
                  <View className="h-12 flex-row items-center overflow-hidden rounded-full border border-white/70 px-4">
                    <GlassLayers radius={24} />
                    <View className="absolute inset-0 bg-white/25" />
                    <Ionicons name="search" size={18} color={colors.textMuted} />
                    <TextInput
                      className="ml-2.5 flex-1 text-[14px]"
                      style={{ color: colors.textDark }}
                      placeholder="Search groups..."
                      placeholderTextColor={colors.faint}
                      value={query}
                      onChangeText={setQuery}
                    />
                  </View>
                </View>

                <FilterTabs tabs={TABS} value={tab} onChange={setTab} />
              </>
            )}

            {groups.length === 0 ? (
              <EmptyState onCreate={() => router.push('/(tabs)/groups/create' as any)} />
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: insets.bottom + 100, gap: 14 }}
              >
                {filtered.map((g) => (
                  <GroupCard
                    key={g.id}
                    group={g}
                    memberCount={counts[g.id] ?? 0}
                    coverUri={covers[g.id] ?? null}
                    onPress={() => router.push(`/(tabs)/groups/${g.id}` as any)}
                  />
                ))}
                {filtered.length === 0 && (
                  <Text className="text-center mt-10 text-sm" style={{ color: colors.textMuted }}>
                    No groups match &quot;{query}&quot;
                  </Text>
                )}
              </ScrollView>
            )}
          </>
        )}
      </View>
    </BubbleBackdrop>
  );
}
