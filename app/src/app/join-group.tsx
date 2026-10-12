import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView, BlurTargetView } from 'expo-blur';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  joinGroupByCode,
  searchGroupByCode,
  GroupsApiError,
  type GroupSummary,
} from '@/services/groups.api';

const GREEN = '#34D399';
const CORAL = '#FB7185';

function GlassShell({
  children,
  radius,
  blurTarget,
}: {
  children: React.ReactNode;
  radius: number;
  blurTarget: React.RefObject<View | null>;
}) {
  return (
    <View
      className="overflow-hidden border border-white/20"
      style={[
        { borderRadius: radius },
        {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.3,
          shadowRadius: 14,
          elevation: 7,
        },
      ]}
    >
      <BlurView
        blurTarget={blurTarget}
        blurMethod="dimezisBlurView"
        intensity={55}
        tint="dark"
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: 'rgba(10,35,55,0.42)', borderRadius: radius },
        ]}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 14,
          right: 14,
          height: 1,
          backgroundColor: 'rgba(255,255,255,0.16)',
        }}
      />
      {children}
    </View>
  );
}

/**
 * Join via a scanned/copied invite code. The code is validated against
 * the backend (GET /api/groups/search/by-code) before anything is
 * shown, and membership is created server-side (POST /api/groups/join).
 * Group info always comes from the backend, never from the QR payload.
 */
export default function JoinGroup() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const backgroundRef = useRef<View>(null);

  const cleanCode = typeof code === 'string' ? code.trim().toUpperCase() : '';
  const [preview, setPreview] = useState<GroupSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [joinedId, setJoinedId] = useState<string | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    void (async () => {
      if (!cleanCode) {
        setError('No invite code was provided.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const group = await searchGroupByCode(cleanCode);
        if (!mountedRef.current) return;
        if (!group) {
          setError('This group invitation is no longer valid.');
        } else {
          setPreview(group);
        }
      } catch (e) {
        if (!mountedRef.current) return;
        if (e instanceof GroupsApiError && e.status === 404) {
          setError('This group invitation is no longer valid.');
        } else {
          setError(e instanceof Error ? e.message : 'Could not validate the invite.');
        }
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();
  }, [cleanCode]);

  const doJoin = async () => {
    if (!cleanCode || joining || joinedId) return;
    setJoining(true);
    setError(null);
    try {
      const joined = await joinGroupByCode(cleanCode);
      if (!mountedRef.current) return;
      if (!joined) {
        setError('Could not join the group. Please try again.');
        return;
      }
      // Idempotent re-join lands here too: the backend membership is
      // authoritative either way.
      setJoinedId(joined.id);
    } catch (e) {
      if (!mountedRef.current) return;
      if (e instanceof GroupsApiError && e.status === 404) {
        setError('This group invitation is no longer valid.');
      } else {
        setError(e instanceof Error ? e.message : 'Could not join the group.');
      }
    } finally {
      if (mountedRef.current) setJoining(false);
    }
  };

  const openGroup = (groupId: string) => {
    router.replace(`/(tabs)/groups/${groupId}` as any);
  };

  // History-less entry (e.g. a cold QR deep link straight to
  // /join-group?code=) has nothing to pop: fall back to the Groups
  // list instead of leaving every back button a dead-end no-op.
  // Same house pattern as currency-selection / SupportForm.
  const goBackOrGroups = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/groups' as any);
    }
  }, [router]);

  const invalid = !loading && (!preview || error);

  return (
    <View style={{ flex: 1 }}>
      <BlurTargetView ref={backgroundRef} style={StyleSheet.absoluteFill}>
        <Image
          source={require('../../assets/images/jodtod/background_home.png')}
          resizeMode="cover"
          style={StyleSheet.absoluteFill}
        />
      </BlurTargetView>

      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View className="flex-row items-center px-4 pb-2 pt-1">
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={goBackOrGroups}
            className="h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10"
          >
            <Ionicons name="close" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text className="ml-3 text-[19px] font-extrabold text-white">
            Join Group
          </Text>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          className="px-4"
          contentContainerStyle={{ paddingBottom: 24 }}
        >
          {loading ? (
            <GlassShell radius={22} blurTarget={backgroundRef}>
              <View className="items-center p-6">
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text className="mt-2 text-[14px] text-white/70">
                  Validating invite…
                </Text>
              </View>
            </GlassShell>
          ) : invalid || !preview ? (
            <GlassShell radius={22} blurTarget={backgroundRef}>
              <View className="items-center p-6">
                <View
                  className="h-16 w-16 items-center justify-center rounded-full"
                  style={{ backgroundColor: 'rgba(251,113,133,0.16)' }}
                >
                  <Ionicons name="alert-circle" size={32} color={CORAL} />
                </View>
                <Text className="mt-3 text-[17px] font-extrabold text-white">
                  Invalid invitation
                </Text>
                <Text className="mt-1 px-4 text-center text-[13px] text-white/70">
                  {error ?? 'This group invitation is no longer valid.'}
                </Text>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={goBackOrGroups}
                  className="mt-4 rounded-full border border-white/20 bg-white/10 px-6 py-2.5"
                >
                  <Text className="text-[14px] font-bold text-white">Cancel</Text>
                </TouchableOpacity>
              </View>
            </GlassShell>
          ) : joinedId ? (
            <GlassShell radius={22} blurTarget={backgroundRef}>
              <View className="items-center p-6">
                <View
                  className="h-16 w-16 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: 'rgba(52,211,153,0.18)',
                    shadowColor: GREEN,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.6,
                    shadowRadius: 14,
                    elevation: 8,
                  }}
                >
                  <Ionicons name="checkmark" size={32} color="#FFFFFF" />
                </View>
                <Text className="mt-3 text-[17px] font-extrabold text-white">
                  Joined {preview.name}
                </Text>
                <Text className="mt-1 px-4 text-center text-[13px] text-white/70">
                  Welcome to {preview.name}. It now appears in your Groups.
                </Text>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => openGroup(joinedId)}
                  className="mt-4 w-full"
                >
                  <LinearGradient
                    colors={['#34D399', '#0E9F6E']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{ borderRadius: 16 }}
                  >
                    <View className="items-center py-3.5">
                      <Text className="text-[15px] font-extrabold text-white">
                        Open Group
                      </Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </GlassShell>
          ) : (
            <GlassShell radius={22} blurTarget={backgroundRef}>
              <View className="items-center p-6">
                <View
                  className="h-16 w-16 items-center justify-center rounded-full border border-white/25"
                  style={{ backgroundColor: 'rgba(52,211,153,0.16)' }}
                >
                  <Ionicons name="people" size={30} color="#FFFFFF" />
                </View>
                <Text className="mt-3 text-[22px] font-extrabold text-white">
                  {preview.name}
                </Text>
                <Text className="mt-1 text-[14px] text-white/70">
                  You&apos;ve been invited to join this group.
                </Text>
                <Text className="mt-0.5 text-[13px] text-white/60">
                  {preview.member_count === 1
                    ? '1 member'
                    : `${preview.member_count} members`}
                </Text>
                {error ? (
                  <Text className="mt-2 text-center text-[12px] font-semibold" style={{ color: CORAL }}>
                    {error}
                  </Text>
                ) : null}
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => void doJoin()}
                  disabled={joining}
                  className="mt-5 w-full"
                  style={{ opacity: joining ? 0.6 : 1 }}
                >
                  <LinearGradient
                    colors={['#34D399', '#0E9F6E']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{ borderRadius: 16 }}
                  >
                    <View className="items-center py-3.5">
                      <Text className="text-[15px] font-extrabold text-white">
                        {joining ? 'Joining…' : 'Join Group'}
                      </Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={goBackOrGroups}
                  className="mt-2.5 w-full items-center rounded-2xl border border-white/20 bg-white/10 py-3.5"
                >
                  <Text className="text-[15px] font-bold text-white">Cancel</Text>
                </TouchableOpacity>
              </View>
            </GlassShell>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
