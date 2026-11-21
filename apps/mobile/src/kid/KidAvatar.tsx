import { View } from 'react-native';
import { Text } from '@/ui';

const SIZE = {
  md: { circle: 'h-11 w-11', text: 'text-lg' },
  lg: { circle: 'h-16 w-16', text: 'text-3xl' },
} as const;

/** A Kid Profile's avatar: the chosen emoji, or the name's first letter, on the orange accent circle. */
export function KidAvatar({ name, avatar, size = 'md' }: { name: string; avatar: string | null; size?: keyof typeof SIZE }) {
  const { circle, text } = SIZE[size];
  return (
    <View className={`items-center justify-center rounded-full bg-accent ${circle}`} accessible={false}>
      <Text weight="bold" className={text}>
        {avatar ?? (Array.from(name.trim())[0] ?? '').toLocaleUpperCase()}
      </Text>
    </View>
  );
}
