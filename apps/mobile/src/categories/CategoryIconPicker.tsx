import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CATEGORY_ICON_CHOICES } from '@money-tracker/shared';
import { categoryGlyph } from '@/data/categoryIcons';
import { useTheme } from '@/theme/ThemeProvider';
import { AppIcon, Glyph, Text } from '@/ui';

export interface CategoryIconPickerProps {
  /** The Category's icon name (`housing`, …); one this app doesn't offer marks nothing. */
  value: string;
  onChange: (icon: string) => void;
}

/** A grid of the Category icons an adult can pick; the current one is marked with `selected`. */
export function CategoryIconPicker({ value, onChange }: CategoryIconPickerProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View className="gap-1">
      <Text tone="muted" className="text-xs">
        {t('categories.iconLabel')}
      </Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={t('categories.iconLabel')} className="flex-row flex-wrap gap-2">
        {CATEGORY_ICON_CHOICES.map((icon) => {
          const selected = icon === value;
          return (
            <Pressable
              key={icon}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={t(`categories.icons.${icon}`)}
              onPress={() => onChange(icon)}
              className={`h-12 w-12 items-center justify-center rounded-full active:opacity-80 ${selected ? 'bg-primary' : 'bg-tint'}`}
            >
              <Glyph name={categoryGlyph(icon)} size={22} color={selected ? theme.colors['on-primary'] : theme.colors.primary} />
              {selected ? (
                <View className="absolute -end-1 -top-1 rounded-full bg-surface">
                  <AppIcon name="selected" size={18} color={theme.colors.primary} />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
