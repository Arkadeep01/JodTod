import { useState } from "react";
import { ScrollView, KeyboardAvoidingView, Platform, View, Text } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BubbleBackdrop, ScreenHeader } from "@/components/groups/ui";
import { GroupForm, type GroupFormValues } from "@/components/groups/GroupForm";
import { createGroup, GroupsApiError } from "@/services/groups.api";

export default function CreateGroup() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (values: GroupFormValues) => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const description = [values.destination.trim(), values.description.trim()]
        .filter(Boolean)
        .join(" · ");
      const created = await createGroup({
        name: values.name.trim(),
        description: description || undefined,
      });
      if (!created) {
        setError("Could not create the group. Please try again.");
        return;
      }
      router.replace("/(tabs)/groups" as any);
    } catch (e) {
      setError(
        e instanceof GroupsApiError
          ? e.message
          : "Could not create the group. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BubbleBackdrop>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={insets.top + 56}
        className="flex-1"
      >
        <ScreenHeader title="Create a Group" />

        <ScrollView
          className="flex-1 px-5"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <GroupForm
            submitLabel={submitting ? "Creating…" : "Create Group"}
            showCover="picker"
            onSubmit={(values) => void handleSubmit(values)}
          />

          {/* Error box uses 70% white so it stays legible over the photo backdrop. */}
          {error ? (
            <View className="mt-3 rounded-2xl border border-red-300/50 bg-white/70 px-4 py-3">
              <Text className="text-center text-[13px] font-medium text-red-600">
                {error}
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </BubbleBackdrop>
  );
}
