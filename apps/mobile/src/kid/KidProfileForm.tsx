import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { KID_AVATARS } from '@/data/kidWallet';
import { Text, TextField } from '@/ui';
import { KidAvatar } from './KidAvatar';

export interface KidProfileDraft {
  name: string;
  avatar: string | null;
}

/** Name and optional avatar for a new Kid Profile (no mockup; reuses the field and chip patterns). */
export function KidProfileForm({ value, onChange }: { value: KidProfileDraft; onChange: (next: KidProfileDraft) => void }) {
  const { t } = useTranslation();
  const choices: (string | null)[] = [null, ...KID_AVATARS];
  return (
    <View className="gap-4">
      <TextField
        label={t('kid.profile.nameLabel')}
        value={value.name}
        onChangeText={(name) => onChange({ ...value, name })}
        placeholder={t('kid.profile.namePlaceholder')}
        maxLength={40}
        autoFocus
        returnKeyType="done"
      />
      <View className="gap-2">
        <Text tone="muted" className="text-sm">
          {t('kid.profile.avatarLabel')}
        </Text>
        <View className="flex-row flex-wrap gap-3">
          {choices.map((avatar) => {
            const selected = value.avatar === avatar;
            return (
              <Pressable
                key={avatar ?? 'initial'}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={avatar ?? t('kid.profile.noAvatar')}
                onPress={() => onChange({ ...value, avatar })}
                className={`rounded-full border-2 p-0.5 ${selected ? 'border-primary' : 'border-transparent'}`}
              >
                <KidAvatar name={value.name || '?'} avatar={avatar} />
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

/** The default Jars' names in the device language. */
export function useJarNames() {
  const { t } = useTranslation();
  return { save: t('kid.jars.save'), spend: t('kid.jars.spend'), give: t('kid.jars.give') };
}
