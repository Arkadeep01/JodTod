import { useCallback, useEffect, useRef, useState } from "react";
import {
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ScreenHeader,
  LabeledField,
  GradientCTA,
  colors,
} from "@/components/groups/ui";
import {
  fetchGroupDetail,
  updateGroup,
  GroupsApiError,
  type GroupDetail,
} from "@/services/groups.api";

export default function EditGroup() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = Array.isArray(id) ? id[0] : (id as string);

  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!groupId) {
      setError("Group not found.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const group = await fetchGroupDetail(groupId);
      if (!mountedRef.current) return;
      if (!group) {
        setError("Group not found.");
        setDetail(null);
      } else {
        setDetail(group);
        setName(group.name);
        setDescription(group.description ?? "");
      }
    } catch (e) {
      if (!mountedRef.current) return;
      setError(e instanceof Error ? e.message : "Could not load group.");
      setDetail(null);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    void load();
  }, [load]);

  const nameError =
    touched && name.trim().length === 0 ? "Group name is required." : null;
  const dirty =
    detail !== null &&
    (name.trim() !== detail.name ||
      description.trim() !== (detail.description ?? "").trim());
  const canSave =
    detail !== null && dirty && name.trim().length > 0 && !saving;

  const handleSave = useCallback(async () => {
    if (!canSave || !groupId) return;
    setTouched(true);
    if (name.trim().length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateGroup(groupId, {
        name: name.trim(),
        description: description.trim() === "" ? null : description.trim(),
      });
      if (!mountedRef.current) return;
      if (!updated) {
        setError("Could not save changes. Please try again.");
        return;
      }
      // Group Details + Groups List refetch on focus, so the edit is
      // visible everywhere without a second local store.
      router.back();
    } catch (e) {
      if (!mountedRef.current) return;
      if (e instanceof GroupsApiError && e.status === 403) {
        setError("Only a group admin can edit this group.");
      } else {
        setError(
          e instanceof Error ? e.message : "Could not save changes.",
        );
      }
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }, [canSave, groupId, name, description, router]);

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={insets.top + 56}
        className="flex-1"
      >
        <ScreenHeader title="Edit Group" />

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="small" color={colors.textDark} />
            <Text className="mt-3 text-sm" style={{ color: colors.textMuted }}>
              Loading group…
            </Text>
          </View>
        ) : error && !detail ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-center text-sm" style={{ color: colors.textMuted }}>
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
          <ScrollView
            className="flex-1 px-5"
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            keyboardShouldPersistTaps="handled"
          >
            <LabeledField
              label="Group Name *"
              value={name}
              onChangeText={setName}
              placeholder="e.g., Goa Trip"
            />
            {nameError ? (
              <Text className="-mt-2 mb-3 text-[12px] font-semibold text-red-600">
                {nameError}
              </Text>
            ) : null}
            <LabeledField
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="What's this group about?"
              multiline
            />

            {/* Error box: 70% white so it stays legible over the photo backdrop (same fix as Create). */}
            {error ? (
              <View className="mt-3 rounded-2xl border border-red-300/50 bg-white/70 px-4 py-3">
                <Text className="text-center text-[13px] font-medium text-red-600">
                  {error}
                </Text>
              </View>
            ) : null}

            <View style={{ marginTop: 12 }}>
              <GradientCTA
                onPress={() => void handleSave()}
                disabled={!canSave}
                icon={null}
              >
                <Text className="text-white text-[15px] font-bold">
                  {saving ? "Saving…" : "Save Changes"}
                </Text>
              </GradientCTA>
            </View>
            {!dirty && detail ? (
              <Text
                className="mt-3 text-center text-[12px]"
                style={{ color: colors.textMuted }}
              >
                No changes yet.
              </Text>
            ) : null}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}
