import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { extractInviteCode } from '@/services/groups.api';

export default function ScanJoinQR() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [invalidMsg, setInvalidMsg] = useState<string | null>(null);
  const scannedRef = useRef(false);

  const handleScan = ({ data }: { data: string }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    // The QR payload is never trusted for group info — only the invite
    // code is extracted; join-group validates it with the backend.
    const code = extractInviteCode(data);
    if (!code) {
      setInvalidMsg('This QR code is not a valid JodTod group invitation.');
      return;
    }
    router.replace(`/join-group?code=${encodeURIComponent(code)}` as any);
  };

  const retry = () => {
    setInvalidMsg(null);
    scannedRef.current = false;
  };

  // Cold-link entry has no history to pop: fall back to the tabs root
  // instead of leaving Cancel/close as dead-end no-ops. Same house
  // pattern as currency-selection / SupportForm.
  const goBackOrTabs = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)' as any);
    }
  };

  if (!permission) {
    return <View style={{ flex: 1, backgroundColor: '#000' }} />;
  }

  if (!permission.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: '#04121f' }}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <View className="flex-row items-center px-4 pb-2 pt-1">
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={goBackOrTabs}
              className="h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10"
            >
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <Text className="ml-3 text-[19px] font-extrabold text-white">
              Scan QR to Join
            </Text>
          </View>
          <View className="flex-1 items-center justify-center px-8">
            <Ionicons name="camera-outline" size={56} color="rgba(255,255,255,0.6)" />
            <Text className="mt-4 text-center text-[15px] font-bold text-white">
              Camera permission is required to scan a group QR.
            </Text>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={requestPermission}
              className="mt-5 w-full items-center rounded-2xl py-3.5"
              style={{ backgroundColor: 'rgba(52,211,153,0.2)' }}
            >
              <Text className="text-[15px] font-extrabold text-white">
                Try Again
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={goBackOrTabs}
              className="mt-2.5 w-full items-center rounded-2xl border border-white/20 bg-white/10 py-3.5"
            >
              <Text className="text-[15px] font-bold text-white">Cancel</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={handleScan}
      />
      <SafeAreaView edges={['top']} style={{ flex: 1 }} pointerEvents="box-none">
        <View className="flex-row items-center px-4 pb-2 pt-1" pointerEvents="box-none">
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={goBackOrTabs}
            className="h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-black/50"
          >
            <Ionicons name="close" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text
            className="ml-3 text-[19px] font-extrabold text-white"
            style={{ textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 6 }}
          >
            Scan QR to Join
          </Text>
        </View>

        <View className="flex-1 items-center justify-center px-10" pointerEvents="none">
          <View
            className="aspect-square w-full rounded-[28px] border-2"
            style={{ borderColor: 'rgba(52,211,153,0.8)' }}
          />
          <Text
            className="mt-5 text-center text-[14px] font-semibold text-white"
            style={{ textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 6 }}
          >
            Point your camera at a JodTod group QR code.
          </Text>
          {invalidMsg && (
            <View
              className="mt-3 rounded-2xl border border-white/20 px-4 py-3"
              style={{ backgroundColor: 'rgba(4,18,31,0.85)' }}
              pointerEvents="auto"
            >
              <Text className="text-center text-[13px] font-bold text-white">
                Invalid QR
              </Text>
              <Text className="mt-0.5 text-center text-[12px] text-white/75">
                {invalidMsg}
              </Text>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={retry}
                className="mt-2.5 items-center rounded-xl px-5 py-2.5"
                style={{ backgroundColor: 'rgba(52,211,153,0.25)' }}
              >
                <Text className="text-[13px] font-bold text-white">
                  Scan Again
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View className="items-center pb-6" pointerEvents="box-none">
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={goBackOrTabs}
            className="rounded-full border border-white/30 bg-black/50 px-8 py-3"
          >
            <Text className="text-[14px] font-bold text-white">Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}
