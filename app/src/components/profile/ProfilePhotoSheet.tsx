/**
 * Shared profile-photo action sheet (Page 01 system, reused everywhere).
 *
 * Presentational only: Take Photo / Choose from Gallery / Remove Photo
 * / Cancel. Pair with hooks/useProfilePhoto, which owns permissions,
 * upload, removal, loading, and error handling.
 */

import { ActivityIndicator, Modal, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface ProfilePhotoSheetProps {
  visible: boolean;
  uploading: boolean;
  /** Whether a photo exists (controls the Remove row). */
  hasPhoto: boolean;
  /** Sheet heading — defaults to "Profile photo" (group flow passes its own). */
  title?: string;
  onTakePhoto: () => void;
  onChooseFromGallery: () => void;
  onRemovePhoto: () => void;
  onClose: () => void;
}

export function ProfilePhotoSheet({
  visible,
  uploading,
  hasPhoto,
  title = "Profile photo",
  onTakePhoto,
  onChooseFromGallery,
  onRemovePhoto,
  onClose,
}: ProfilePhotoSheetProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (!uploading) onClose();
      }}
    >
      <View className="flex-1 justify-end bg-black/45">
        <View className="rounded-t-[28px] border border-white/50 bg-white/95 px-5 pb-8 pt-4">
          <View className="mb-4 h-1 w-12 self-center rounded-full bg-black/15" />
          <Text className="mb-4 text-center text-[17px] font-extrabold text-[#0B3D62]">
            {title}
          </Text>

          {/* CARD 1 — Camera */}
          <TouchableOpacity
            activeOpacity={0.8}
            disabled={uploading}
            onPress={onTakePhoto}
            className="mb-3 flex-row items-center rounded-[20px] border border-white/60 bg-white px-4 py-4"
          >
            <View className="h-12 w-12 items-center justify-center rounded-full bg-[#00B894]/15">
              <Ionicons name="camera-outline" size={24} color="#0B3D62" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-[15px] font-bold text-[#0B3D62]">
                Take Photo
              </Text>
              <Text className="mt-0.5 text-[12px] text-[#4B5A66]">
                Opens the device camera
              </Text>
            </View>
            {uploading ? (
              <ActivityIndicator size="small" color="#0B3D62" />
            ) : (
              <Ionicons name="chevron-forward" size={19} color="#2A5A82" />
            )}
          </TouchableOpacity>

          {/* CARD 2 — Gallery */}
          <TouchableOpacity
            activeOpacity={0.8}
            disabled={uploading}
            onPress={onChooseFromGallery}
            className="mb-3 flex-row items-center rounded-[20px] border border-white/60 bg-white px-4 py-4"
          >
            <View className="h-12 w-12 items-center justify-center rounded-full bg-[#0B3D62]/10">
              <Ionicons name="image-outline" size={24} color="#0B3D62" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-[15px] font-bold text-[#0B3D62]">
                Choose from Gallery
              </Text>
              <Text className="mt-0.5 text-[12px] text-[#4B5A66]">
                Opens the device photo library
              </Text>
            </View>
            {uploading ? (
              <ActivityIndicator size="small" color="#0B3D62" />
            ) : (
              <Ionicons name="chevron-forward" size={19} color="#2A5A82" />
            )}
          </TouchableOpacity>

          {uploading ? (
            <Text className="mb-2 text-center text-[13px] font-medium text-[#2A5A82]">
              Uploading...
            </Text>
          ) : null}

          {/* Remove photo (only when a photo exists) */}
          {hasPhoto && !uploading ? (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onRemovePhoto}
              className="mb-3 items-center rounded-[20px] border border-red-300/60 bg-white px-4 py-3.5"
            >
              <Text className="text-[14px] font-bold text-red-500">
                Remove Photo
              </Text>
            </TouchableOpacity>
          ) : null}

          {/* Cancel */}
          <TouchableOpacity
            activeOpacity={0.8}
            disabled={uploading}
            onPress={onClose}
            className="items-center rounded-[20px] bg-[#0B3D62]/10 px-4 py-3.5"
          >
            <Text className="text-[14px] font-bold text-[#0B3D62]">
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
