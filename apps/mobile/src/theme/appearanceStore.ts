import { useSyncExternalStore } from 'react';
import { Appearance as NativeAppearance, useColorScheme as useNativeColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { activeScheme, parseAppearance, type Appearance, type ColorScheme } from './appearance';

/**
 * The Appearance choice, kept in AsyncStorage on this device only (never
 * synced, kept on sign-out like the language). The choice is also handed to
 * React Native's Appearance, which sets Android's night mode, so system
 * dialogs, the navigation bar buttons and `useColorScheme` follow it.
 */
const APPEARANCE_KEY = 'device.appearance';

let current: Appearance = 'system';
const listeners = new Set<() => void>();

function apply(choice: Appearance): void {
  current = choice;
  NativeAppearance.setColorScheme(choice === 'system' ? 'auto' : choice);
  listeners.forEach((listener) => listener());
}

/** Reads the stored choice; call before the first render so dark mode doesn't flash light. */
export async function startAppearance(): Promise<void> {
  const stored = await AsyncStorage.getItem(APPEARANCE_KEY).catch(() => null);
  apply(parseAppearance(stored));
}

/** Changes the choice; screens re-render with the new palette, no restart needed. */
export async function setAppearance(choice: Appearance): Promise<void> {
  apply(choice);
  await AsyncStorage.setItem(APPEARANCE_KEY, choice).catch(() => undefined);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The adult's choice: System, Light or Dark. */
export function useAppearance(): Appearance {
  return useSyncExternalStore(subscribe, () => current);
}

/** The palette in use now: the choice, or the phone's setting under System. */
export function useColorScheme(): ColorScheme {
  return activeScheme(useAppearance(), useNativeColorScheme());
}
