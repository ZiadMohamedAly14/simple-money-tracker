import { useState } from 'react';
import { Text as NativeText, TextInput, View, type TextInputProps, type TextProps as NativeTextProps } from 'react-native';
import { useLanguage } from '@/i18n/useLanguage';
import { fontFamily, type FontWeight } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';

export type TextTone =
  | 'text'
  | 'muted'
  | 'primary'
  | 'on-primary'
  | 'on-dark'
  | 'on-warning'
  | 'positive'
  | 'negative';

/** Literal class names so Tailwind's content scan finds them. */
const TONE_CLASS: Record<TextTone, string> = {
  text: 'text-text',
  muted: 'text-muted',
  primary: 'text-primary',
  'on-primary': 'text-on-primary',
  'on-dark': 'text-on-dark',
  'on-warning': 'text-on-warning',
  positive: 'text-positive',
  negative: 'text-negative',
};

const ALIGN_CLASS = { start: 'text-start', center: 'text-center', end: 'text-end' } as const;

export interface TextProps extends NativeTextProps {
  /** Font weight; picks the Inter/Alexandria file. Never use font-* classes. */
  weight?: FontWeight;
  /** Text color token. Don't put text-<color> in className. */
  tone?: TextTone;
  align?: keyof typeof ALIGN_CLASS;
  /** Sizes, spacing, flex. */
  className?: string;
}

/**
 * All app text goes through this: Inter in English, Alexandria in Arabic,
 * theme color, start-aligned by default.
 */
export function Text({ weight = 'regular', tone = 'text', align = 'start', className = '', style, ...props }: TextProps) {
  const language = useLanguage();
  return (
    <NativeText
      {...props}
      className={`${TONE_CLASS[tone]} ${ALIGN_CLASS[align]} ${className}`}
      style={[{ fontFamily: fontFamily(language, weight) }, style]}
    />
  );
}

export interface TextFieldProps extends TextInputProps {
  label?: string;
  /** Left-to-right content (emails) stays LTR in an Arabic layout. */
  ltr?: boolean;
  className?: string;
}

/** A labelled text input: white, rounded, primary outline while focused. */
export function TextField({ label, ltr, className = '', style, onFocus, onBlur, ...props }: TextFieldProps) {
  const language = useLanguage();
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View className={`gap-1.5 ${className}`}>
      {label ? (
        <Text tone="muted" className="text-xs">
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={theme.colors.muted}
        accessibilityLabel={label}
        {...props}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          { fontFamily: fontFamily(language, 'regular') },
          ltr ? { writingDirection: 'ltr' } : null,
          style,
        ]}
        className={`min-h-control rounded-theme border bg-surface px-4 text-start text-base text-text ${
          focused ? 'border-primary' : 'border-border'
        }`}
      />
    </View>
  );
}
