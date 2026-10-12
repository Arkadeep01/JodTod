import { useState } from 'react';
import { Dimensions, Image, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GradientCTA, LabeledField, colors } from './ui';

const { width: SCREEN_W } = Dimensions.get('window');

export type GroupFormValues = {
  name: string;
  destination: string;
  description: string;
  budget: string;
  startDate: string;
  endDate: string;
};

type GroupFormProps = {
  initialValues?: Partial<GroupFormValues>;
  submitLabel: string;
  showCover?: 'picker' | 'banner';
  coverImage?: string;
  onSubmit: (values: GroupFormValues) => void;
};

const EMPTY: GroupFormValues = {
  name: '',
  destination: '',
  description: '',
  budget: '',
  startDate: '',
  endDate: '',
};

export function GroupForm({ initialValues, submitLabel, showCover = 'picker', coverImage, onSubmit }: GroupFormProps) {
  const [values, setValues] = useState<GroupFormValues>({ ...EMPTY, ...initialValues });
  const set = (key: keyof GroupFormValues) => (text: string) =>
    setValues((v) => ({ ...v, [key]: text }));
  const canSubmit = values.name.trim().length > 0;

  return (
    <View>
      {showCover === 'picker' ? (
        // Static placeholder art: no cover-upload flow exists (create only
        // sends name/description), so this must not fake tappability.
        // Was a pressable with no handler. Restoring onPress needs a real
        // picker + upload endpoint (product decision — see report).
        <View
          className="items-center justify-center rounded-3xl border-2 border-dashed mb-6"
          style={{
            height: 140,
            borderColor: colors.inputBorder,
            // Opaque enough to read "Add Cover Image" over the photo
            // backdrop (was 20% white, same wash-out as the inputs).
            backgroundColor: 'rgba(255,255,255,0.55)',
          }}
        >
          <View
            className="items-center justify-center rounded-full mb-2"
            style={{ width: 44, height: 44, backgroundColor: colors.successBg }}
          >
            <Ionicons name="camera-outline" size={20} color={colors.brandDark} />
          </View>
          <Text className="text-[13px] font-semibold" style={{ color: colors.textMuted }}>
            Add Cover Image
          </Text>
          <Text className="text-[11px]" style={{ color: colors.textMuted }}>
            (optional)
          </Text>
        </View>
      ) : (
        <View
          style={{
            width: SCREEN_W - 40,
            height: 140,
            borderRadius: 24,
            overflow: 'hidden',
            marginBottom: 20,
          }}
        >
          <Image
            source={{ uri: coverImage ?? 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=400' }}
            style={{
              width: SCREEN_W - 40,
              height: 140,
              borderRadius: 24,
              marginBottom: 20,
              backgroundColor: colors.neutralBg,
            }}
            resizeMode="cover"
          />
          {/* Static badge: changing the cover needs the same missing
              upload flow (see above). Not a pressable. */}
          <View
            className="absolute bottom-3 right-3 flex-row items-center gap-1.5 rounded-full px-3 py-1.5"
            style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          >
            <Ionicons name="camera-outline" size={14} color="#fff" />
            <Text className="text-[11px] font-semibold text-white">Change</Text>
          </View>
        </View>
      )}

      <LabeledField label="Group Name *" value={values.name} onChangeText={set('name')} placeholder="e.g., Goa Trip" />
      <LabeledField label="Destination" icon="location-outline" value={values.destination} onChangeText={set('destination')} placeholder="e.g., Goa, India" />
      <LabeledField label="Description" value={values.description} onChangeText={set('description')} placeholder="What's this trip about?" multiline />
      <LabeledField label="Budget (optional)" icon="pricetag-outline" value={values.budget} onChangeText={set('budget')} placeholder="e.g., 50010" keyboardType="numeric" />
      <LabeledField label="Start Date" icon="calendar-outline" value={values.startDate} onChangeText={set('startDate')} placeholder="Select start date" />
      <LabeledField label="End Date" icon="calendar-outline" value={values.endDate} onChangeText={set('endDate')} placeholder="Select end date" />

      <View style={{ marginTop: 4 }}>
        <GradientCTA onPress={() => canSubmit && onSubmit(values)} disabled={!canSubmit} icon={null}>
          <Text className="text-white text-[15px] font-bold">{submitLabel}</Text>
        </GradientCTA>
      </View>
    </View>
  );
}
