import { Text } from "react-native";

/**
 * PageTitle — canonical page-level heading.
 *
 * Spec is taken verbatim from the Activity page (`(tabs)/activity.tsx`),
 * the visual reference for heading typography across the app:
 * 28px extrabold navy (#0B3D62) with a soft white text shadow so the
 * heading stays legible over the light background artwork.
 *
 * Opt-in only: pages keep their own heading containers (padding, safe
 * area, row layout). Home does not use this component and is unaffected.
 */
export function PageTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text
      className="text-[28px] font-extrabold text-[#0B3D62]"
      style={{
        textShadowColor: "rgba(255,255,255,0.75)",
        textShadowRadius: 10,
        textShadowOffset: { width: 0, height: 1 },
      }}
    >
      {children}
    </Text>
  );
}
