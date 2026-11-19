import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { View } from 'react-native';
import { vars } from 'nativewind';
import { themes, themeVariables, type Theme, type ThemeName } from './themes';

const ThemeContext = createContext<Theme>(themes.personal);

/**
 * Applies a theme's tokens to everything below it. The Personal route groups
 * wrap themselves in `name="personal"`, the Kid ones in `name="kid"`.
 */
export function ThemeProvider({ name, children }: { name: ThemeName; children: ReactNode }) {
  const style = useMemo(() => vars(themeVariables(name)), [name]);
  return (
    <ThemeContext.Provider value={themes[name]}>
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
