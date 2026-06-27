import { useMemo } from "react";
import { useAppConfig, BG_THEMES } from "@/context/AppConfigContext";
import colors from "@/constants/colors";

export function useColors() {
  const { config, loaded } = useAppConfig();
  const palette = colors.light;

  return useMemo(() => {
    if (!loaded) {
      return { ...palette, radius: colors.radius, isLight: false, logoBg: "#1F130A" };
    }
    const themeColors = BG_THEMES[config.bgTheme] ?? BG_THEMES["dark-brown"];
    return {
      ...palette,
      ...themeColors,
      foreground: themeColors.foreground ?? palette.foreground,
      mutedForeground: themeColors.mutedForeground ?? palette.mutedForeground,
      gold: config.accentColor,
      accent: config.accentColor,
      radius: colors.radius,
      isLight: themeColors.isLight ?? false,
      logoBg: config.logoBg,
    };
  }, [config, loaded]); // palette is a module constant — always stable
}
