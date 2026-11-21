import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { View } from 'react-native';
import { vars } from 'nativewind';
import { useColorScheme } from './appearanceStore';
import { themes, themeVariables, type Theme, type ThemeName } from './themes';

const ThemeContext = createContext<Theme>(themes.personal.light);

/**
 * Applies a theme's tokens to everything below it, in the active light or
 * dark variant (the Appearance setting). The Personal route groups wrap
 * themselves in `name="personal"`, the Kid ones in `name="kid"`. Tokens reach
 * NativeWind classes as CSS variables (`vars()`), so both className colors
 * and `useTheme()` switch together.
 */
export function ThemeProvider({ name, children }: { name: ThemeName; children: ReactNode }) {
  const scheme = useColorScheme();
  const style = useMemo(() => vars(themeVariables(name, scheme)), [name, scheme]);
  return (
    <ThemeContext.Provider value={themes[name][scheme]}>
      {/* Variables are set on the outer view so the inner one can use them. */}
      <View style={[{ flex: 1 }, style]}>
        <View className="flex-1 bg-background">{children}</View>
      </View>
    </ThemeContext.Provider>
  );
}

/** Raw theme values for props that can't take a className (icon colors, spinners). */
export function useTheme(): Theme {
  return useContext(ThemeContext);
}
