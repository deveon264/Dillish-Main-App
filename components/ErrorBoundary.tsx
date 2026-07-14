import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Bouncy as Pressable } from "@/components/Bouncy";
import { reloadAppAsync } from "expo";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/colors";
import { fonts } from "@/constants/fonts";

function ErrorFallback({ error }: { error: Error }) {
  return (
    <View style={styles.container}>
      <Ionicons name="alert-circle-outline" size={48} color={colors.primary} />
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.message}>{error?.message ?? "An unexpected error occurred."}</Text>
      <Pressable style={styles.button} onPress={() => reloadAppAsync()}>
        <Text style={styles.buttonText}>Restart</Text>
      </Pressable>
    </View>
  );
}

type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error("ErrorBoundary caught:", error);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    padding: 32,
  },
  title: {
    fontFamily: fonts.serifSemibold,
    fontSize: 24,
    color: colors.foreground,
    marginTop: 16,
  },
  message: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
  },
  button: {
    backgroundColor: colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: colors.radiusLg,
  },
  buttonText: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.onPrimary },
});
