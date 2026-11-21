import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

/**
 * Whether the system keyboard is open. Screens with both a text field and
 * the in-app keypad hide the keypad while the keyboard is up, so the keyboard
 * never covers it.
 */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', () => setVisible(true));
    const hidden = Keyboard.addListener('keyboardDidHide', () => setVisible(false));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);
  return visible;
}
