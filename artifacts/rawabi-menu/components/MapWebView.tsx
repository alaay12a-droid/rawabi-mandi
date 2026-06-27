import React from "react";
import { ActivityIndicator, View, Text } from "react-native";
import { WebView } from "react-native-webview";

export function MapWebView({ uri, style }: { uri: string; style?: object }) {
  return (
    <WebView
      source={{ uri }}
      style={[{ flex: 1 }, style]}
      javaScriptEnabled
      domStorageEnabled
      originWhitelist={["*"]}
      allowsInlineMediaPlayback
      startInLoadingState
      renderLoading={() => (
        <View style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", backgroundColor: "#0D1117" }}>
          <ActivityIndicator size="large" color="#29B6F6" />
        </View>
      )}
    />
  );
}
