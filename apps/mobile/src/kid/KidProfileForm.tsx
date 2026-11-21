import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { TextField } from '@/ui';
import { KidAvatar } from './KidAvatar';

export interface KidProfileDraft {
  name: string;
}

/**
 * The name for a new Kid Profile (no mockup; reuses the field pattern). The
 * avatar is always the name's first letter, previewed beside the field as it
 * is typed. Photos are after the MVP.
 */
export function KidProfileForm({ value, onChange }: { value: KidProfileDraft; onChange: (next: KidProfileDraft) => void }) {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-end gap-3">
      <KidAvatar name={value.name} size="lg" />
      <View className="flex-1">
        <TextField
          label={t('kid.profile.nameLabel')}
          value={value.name}
          onChangeText={(name) => onChange({ ...value, name })}
          placeholder={t('kid.profile.namePlaceholder')}
          maxLength={40}
          autoFocus
          returnKeyType="done"
        />
      </View>
    </View>
  );
}

/** The default Jars' names in the device language. */
export function useJarNames() {
  const { t } = useTranslation();
  return { save: t('kid.jars.save'), spend: t('kid.jars.spend'), give: t('kid.jars.give') };
}
