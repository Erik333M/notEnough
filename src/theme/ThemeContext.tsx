import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, useColorScheme } from 'react-native';

import { THEMES, type Theme, type ThemeName } from './tokens';

/**
 * Which theme is in force, and how a component reads it.
 *
 * Three settings, not two. "System" is the default and the one most people
 * never change — a phone that goes dark at sunset should take the app with it.
 * The other two are for the people who want to decide.
 *
 * The preference is a display choice and nothing more, so it lives in ordinary
 * storage rather than the keystore, and it is never synced: the same account
 * on a tablet and a phone can reasonably want different answers.
 */
export type ThemeSetting = 'system' | 'light' | 'dark';

const KEY = 'notenough.theme';

type ThemeContextValue = {
  theme: Theme;
  setting: ThemeSetting;
  setSetting: (next: ThemeSetting) => void;
  /** What "system" currently resolves to, for a settings screen to show. */
  systemIs: ThemeName;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [setting, setStored] = useState<ThemeSetting>('system');
  const loaded = useRef(false);

  // Read once at start-up. Until it lands the app renders on the system
  // setting, which is the right guess and avoids a flash of the wrong theme
  // for everybody who never changed it.
  useEffect(() => {
    let live = true;
    void AsyncStorage.getItem(KEY).then((raw) => {
      if (!live) return;
      if (raw === 'light' || raw === 'dark' || raw === 'system') setStored(raw);
      loaded.current = true;
    });
    return () => {
      live = false;
    };
  }, []);

  const setSetting = useCallback((next: ThemeSetting) => {
    setStored(next);
    // Fire and forget: a failed write costs the preference next launch and
    // nothing else, which is not worth blocking the paint for.
    void AsyncStorage.setItem(KEY, next).catch(() => undefined);
  }, []);

  const systemIs: ThemeName = system === 'light' ? 'light' : 'dark';
  const name: ThemeName = setting === 'system' ? systemIs : setting;

  const value = useMemo(
    () => ({ theme: THEMES[name], setting, setSetting, systemIs }),
    [name, setSetting, setting, systemIs],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * The colours in force.
 *
 * Falls back to dark rather than throwing when there is no provider above it.
 * A missing provider should be a wrong-looking screen somebody notices, not a
 * crash in a component that only wanted a border colour.
 */
export function useTheme(): Theme {
  return useContext(ThemeContext)?.theme ?? THEMES.dark;
}

export function useThemeSetting(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useThemeSetting needs a ThemeProvider above it.');
  return value;
}

/**
 * A stylesheet that follows the theme.
 *
 * `StyleSheet.create` reads its colours once, when the module loads, so a
 * stylesheet written at the top of a file can never change theme. Components
 * therefore export a factory and call this, which builds one sheet per theme
 * and hands back the right one.
 *
 * The cache is keyed by the factory and then by theme name, so each component's
 * two sheets are built once for the life of the app rather than on every
 * render — which is the whole reason StyleSheet.create was at module scope to
 * begin with.
 */
type NamedStyles = Record<string, object>;
const cache = new WeakMap<object, Partial<Record<ThemeName, unknown>>>();

export function useStyles<T extends NamedStyles>(factory: (theme: Theme) => T): T {
  const theme = useTheme();
  let byTheme = cache.get(factory);
  if (!byTheme) {
    byTheme = {};
    cache.set(factory, byTheme);
  }
  if (!byTheme[theme.name]) byTheme[theme.name] = StyleSheet.create(factory(theme));
  return byTheme[theme.name] as T;
}
