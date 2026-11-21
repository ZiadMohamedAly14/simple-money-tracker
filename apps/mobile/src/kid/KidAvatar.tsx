import { View } from 'react-native';
import { Text } from '@/ui';

const SIZE = {
  md: { circle: 'h-11 w-11', text: 'text-lg' },
  lg: { circle: 'h-16 w-16', text: 'text-3xl' },
} as const;

/**
 * A Kid Profile's avatar: the name's first letter on the orange accent circle ("?" before a name is typed).
 * Decorative: the name is always shown beside it, so screen readers skip the letter.
 */
export function KidAvatar({ name, size = 'md' }: { name: string; size?: keyof typeof SIZE }) {
  const { circle, text } = SIZE[size];
  return (
    <View
      className={`items-center justify-center rounded-full bg-accent ${circle}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text weight="bold" tone="on-accent" className={text}>
        {(Array.from(name.trim())[0] ?? '?').toLocaleUpperCase()}
      </Text>
    </View>
  );
}
