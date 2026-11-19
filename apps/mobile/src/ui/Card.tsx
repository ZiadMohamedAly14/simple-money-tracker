import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';
import { IconCircle, type IconCircleTone, type IconName } from './icons';
import { Text, type TextTone } from './Text';

export interface CardProps {
  children: ReactNode;
  /** Makes the whole card pressable. */
  onPress?: () => void;
  /** Primary outline, as on a chosen option ("Who is it for?"). */
  selected?: boolean;
  accessibilityLabel?: string;
  /** Padding, gaps, layout. Default padding is p-4. */
  className?: string;
}

/** White, rounded, no shadow or border (unless selected). */
export function Card({ children, onPress, selected, accessibilityLabel, className = 'p-4' }: CardProps) {
  const classes = `rounded-theme border-2 bg-surface ${selected ? 'border-primary' : 'border-transparent'} ${className}`;
  if (!onPress) return <View className={classes}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      className={`${classes} active:opacity-80`}
    >
      {children}
    </Pressable>
  );
}

export interface ListRowProps {
  icon: IconName;
  iconTone?: IconCircleTone;
  title: string;
  subtitle?: string;
  /** Text at the end (an amount) or any element. */
  end?: ReactNode;
  endTone?: TextTone;
  onPress?: () => void;
  /** Primary outline plus a check mark: a chosen option. */
  selected?: boolean;
}

/** A card row: icon in a circle, title and subtitle, something at the end. */
export function ListRow({ icon, iconTone, title, subtitle, end, endTone = 'text', onPress, selected }: ListRowProps) {
  const theme = useTheme();
  return (
    <Card onPress={onPress} selected={selected} accessibilityLabel={title} className="flex-row items-center gap-3 px-3 py-3">
      <IconCircle icon={icon} tone={iconTone} />
      <View className="flex-1 gap-0.5">
        <Text weight="semibold" numberOfLines={1} className="text-base">
          {title}
        </Text>
        {subtitle ? (
          <Text tone="muted" numberOfLines={2} className="text-sm">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {typeof end === 'string' ? (
        <Text weight="bold" tone={endTone} className="text-base">
          {end}
        </Text>
      ) : (
        end
      )}
      {selected ? <Ionicons name="checkmark" size={20} color={theme.colors.primary} /> : null}
    </Card>
  );
}

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}

/**
 * Pill: selected = primary, unselected = chip token (tint, white in Kid).
 * Shows the full name and truncates (design flaw 12).
 */
export function Chip({ label, selected, onPress }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      className={`min-h-10 max-w-48 items-center justify-center rounded-full px-4 active:opacity-80 ${
        selected ? 'bg-primary' : 'bg-chip'
      }`}
    >
      <Text weight="semibold" tone={selected ? 'on-primary' : 'text'} numberOfLines={1} className="text-sm">
        {label}
      </Text>
    </Pressable>
  );
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
}

/** Tint track, selected segment primary (Settings: language, digit style). */
export function SegmentedControl<T extends string>({ options, value, onChange, accessibilityLabel }: SegmentedControlProps<T>) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} className="flex-row rounded-theme bg-tint p-1">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected, checked: selected }}
            onPress={() => onChange(option.value)}
            className={`min-h-11 flex-1 items-center justify-center rounded-theme px-3 ${selected ? 'bg-primary' : ''}`}
          >
            <Text weight="semibold" tone={selected ? 'on-primary' : 'text'} align="center" numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export interface NoticeProps {
  text: string;
  icon?: IconName;
}

/** Warning-surface banner: over-plan, low Jar, "went below zero". */
export function Notice({ text, icon }: NoticeProps) {
  const theme = useTheme();
  return (
    <View accessibilityRole="alert" className="flex-row items-center gap-2 rounded-theme bg-warning px-3 py-2.5">
      {icon ? <Ionicons name={icon} size={18} color={theme.colors['on-warning']} /> : null}
      <Text weight="medium" tone="on-warning" className="flex-1 text-sm">
        {text}
      </Text>
    </View>
  );
}

/**
 * "Pending sync": small muted text, no icon. Callers decide when to show it
 * (only after changes have waited more than a minute; ticket 06).
 */
export function PendingSyncLabel({ align = 'center' }: { align?: 'start' | 'center' | 'end' }) {
  const { t } = useTranslation();
  return (
    <Text tone="muted" align={align} className="text-xs">
      {t('sync.pending')}
    </Text>
  );
}
