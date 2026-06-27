import React from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";

export function MapWebView({ uri, style }: { uri: string; style?: object }) {
  return (
    <View style={[{ flex: 1 }, style]}>
      {React.createElement("iframe", {
        src: uri,
        style: { width: "100%", height: "100%", border: "none", display: "block" },
        allow: "geolocation *",
      })}
    </View>
  );
}
