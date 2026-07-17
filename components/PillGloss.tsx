import React from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

// Glass finish for action pills: a soft white sheen falling from the top edge
// plus a hairline light rim, laid over a gradient (or frosted) pill body.
// Purely decorative — never catches touches. The host pill must have
// overflow: "hidden" so the sheen respects its rounded corners.
export function PillGloss({ radius = 999 }: { radius?: number }) {
  return (
    <View style={[StyleSheet.absoluteFill, { borderRadius: radius }]} pointerEvents="none">
      <LinearGradient
        colors={["rgba(255,255,255,0.35)", "rgba(255,255,255,0)"]}
        style={[styles.sheen, { borderTopLeftRadius: radius, borderTopRightRadius: radius }]}
      />
      <View style={[StyleSheet.absoluteFill, styles.rim, { borderRadius: radius }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  sheen: { position: "absolute", top: 0, left: 0, right: 0, height: "55%" },
  rim: { borderWidth: 1, borderColor: "rgba(255,255,255,0.28)" },
});
