/**
 * Shared group-photo flow (mirrors hooks/useProfilePhoto).
 *
 * Single implementation of Take Photo / Choose from Gallery / Remove
 * Photo / Cancel with permissions, upload, persistence, loading, and
 * error handling. Backed by POST/DELETE /api/groups/{id}/photo through
 * services/groups.api.ts — the same local-filesystem storage family as
 * profile photos, no second storage system.
 *
 * The screen owns the displayed image URL (server detail value plus a
 * local override applied via onImageChanged so the new photo shows
 * immediately; the backend stays source of truth on refetch).
 * Only mount/use for group admins — the sheet must stay hidden
 * otherwise (the screen gates this).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Linking } from "react-native";
import * as ImagePicker from "expo-image-picker";

import {
  removeGroupPhoto,
  uploadGroupPhoto,
  type PickedGroupPhoto,
} from "../services/groups.api";

/** Backend + client cap for group photos (mirrors backend 5 MB). */
export const MAX_GROUP_PHOTO_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

interface UseGroupPhotoOptions {
  /** Group the photo belongs to (admin-only endpoints). */
  groupId: string;
  /** Whether an image is currently displayed (controls Remove row). */
  hasPhoto: boolean;
  /** Applied immediately after upload/remove so UI updates at once. */
  onImageChanged: (imageUrl: string | null) => void;
}

export function useGroupPhoto({ groupId, hasPhoto, onImageChanged }: UseGroupPhotoOptions) {
  const [showSheet, setShowSheet] = useState(false);
  const [uploading, setUploading] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Keep latest values without re-creating handlers each render.
  const changedRef = useRef(onImageChanged);
  useEffect(() => {
    changedRef.current = onImageChanged;
  }, [onImageChanged]);

  const groupIdRef = useRef(groupId);
  useEffect(() => {
    groupIdRef.current = groupId;
  }, [groupId]);

  const showPermissionDenied = useCallback(
    (kind: "Camera" | "Photo library") => {
      Alert.alert(
        `${kind} permission needed`,
        `JodTod needs ${kind === "Camera" ? "camera" : "photo library"} access to set this group's photo. You can enable it in Settings.`,
        [
          { text: "Not now", style: "cancel" },
          {
            text: "Open Settings",
            onPress: () => {
              void Linking.openSettings().catch(() => undefined);
            },
          },
        ],
      );
    },
    [],
  );

  const toPickedPhoto = useCallback(
    (asset: ImagePicker.ImagePickerAsset): PickedGroupPhoto | null => {
      const mimeType =
        asset.mimeType?.toLowerCase() ??
        (asset.fileName?.toLowerCase().endsWith(".png")
          ? "image/png"
          : asset.fileName?.toLowerCase().endsWith(".webp")
            ? "image/webp"
            : "image/jpeg");

      if (!ALLOWED_MIME_TYPES.has(mimeType)) {
        Alert.alert(
          "Unsupported image",
          "Please choose a JPEG, PNG, or WebP image.",
        );
        return null;
      }

      if (
        typeof asset.fileSize === "number" &&
        asset.fileSize > MAX_GROUP_PHOTO_BYTES
      ) {
        Alert.alert(
          "Image too large",
          "Please choose an image under 5 MB.",
        );
        return null;
      }

      const ext =
        mimeType === "image/png"
          ? "png"
          : mimeType === "image/webp"
            ? "webp"
            : "jpg";
      return {
        uri: asset.uri,
        fileName: asset.fileName ?? `group-photo.${ext}`,
        mimeType,
      };
    },
    [],
  );

  const uploadPicked = useCallback(
    async (photo: PickedGroupPhoto) => {
      if (mountedRef.current) setUploading(true);
      try {
        const imageUrl = await uploadGroupPhoto(groupIdRef.current, photo);
        if (!mountedRef.current) return;
        // Show immediately; backend is the source of truth on refetch.
        changedRef.current(imageUrl);
        setShowSheet(false);
      } catch (e) {
        if (!mountedRef.current) return;
        Alert.alert(
          "Upload failed",
          e instanceof Error ? e.message : "Could not upload the group photo.",
        );
      } finally {
        if (mountedRef.current) setUploading(false);
      }
    },
    [],
  );

  const takePhoto = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        // Covers denied + permanently denied (canAskAgain false -> settings).
        showPermissionDenied("Camera");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]) {
        return; // User cancelled — stay on the sheet, no crash.
      }
      const picked = toPickedPhoto(result.assets[0]);
      if (picked) await uploadPicked(picked);
    } catch (e) {
      Alert.alert(
        "Camera unavailable",
        e instanceof Error ? e.message : "Could not open the camera.",
      );
    }
  }, [showPermissionDenied, toPickedPhoto, uploadPicked]);

  const chooseFromGallery = useCallback(async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showPermissionDenied("Photo library");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]) {
        return; // User cancelled — stay on the sheet, no crash.
      }
      const picked = toPickedPhoto(result.assets[0]);
      if (picked) await uploadPicked(picked);
    } catch (e) {
      Alert.alert(
        "Gallery unavailable",
        e instanceof Error ? e.message : "Could not open the gallery.",
      );
    }
  }, [showPermissionDenied, toPickedPhoto, uploadPicked]);

  const removePhoto = useCallback(() => {
    Alert.alert(
      "Remove photo?",
      "This group's photo will be removed.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            void (async () => {
              if (mountedRef.current) setUploading(true);
              try {
                await removeGroupPhoto(groupIdRef.current);
                if (!mountedRef.current) return;
                changedRef.current(null);
                setShowSheet(false);
              } catch (e) {
                if (!mountedRef.current) return;
                Alert.alert(
                  "Removal failed",
                  e instanceof Error
                    ? e.message
                    : "Could not remove the group photo.",
                );
              } finally {
                if (mountedRef.current) setUploading(false);
              }
            })();
          },
        },
      ],
    );
  }, []);

  return {
    showSheet,
    setShowSheet,
    uploading,
    takePhoto,
    chooseFromGallery,
    removePhoto,
  };
}
