import { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, type ButtonVariant } from './Button';
import { answerDialog, dismissButton, subscribeDialog, type DialogButton, type DialogRequest } from './dialogStore';
import { Text } from './Text';

const VARIANT: Record<NonNullable<DialogButton['style']>, ButtonVariant> = {
  default: 'primary',
  cancel: 'secondary',
  destructive: 'danger',
};

/**
 * Draws the dialog at the front of the `showDialog` queue as a Mizan card on a
 * dimmed backdrop: title, message, then the buttons (Cancel first, so it sits
 * at the start edge). Up to two buttons share a row; three stack. Mount once,
 * inside the root ThemeProvider.
 */
export function DialogHost() {
  const { t } = useTranslation();
  const [request, setRequest] = useState<DialogRequest | null>(null);
  useEffect(() => subscribeDialog(setRequest), []);
  if (!request) return null;

  const dismiss = () => {
    const button = dismissButton(request);
    if (button !== false) answerDialog(request.id, button);
  };
  const given: DialogButton[] = request.buttons.length > 0 ? request.buttons : [{ text: t('common.ok') }];
  const buttons = [...given].sort((a, b) => Number(b.style === 'cancel') - Number(a.style === 'cancel'));
  const stacked = buttons.length > 2;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={dismiss}>
      <Pressable className="flex-1 justify-center bg-scrim/40 px-6" onPress={dismiss}>
        {/* Inner Pressable swallows taps so they don't close the dialog. */}
        <Pressable className="gap-3 rounded-theme bg-surface p-5" onPress={() => undefined} accessibilityViewIsModal>
          <Text weight="bold" accessibilityRole="header" className="text-lg">
            {request.title}
          </Text>
          {request.message ? (
            <Text tone="muted" className="text-base leading-6">
              {request.message}
            </Text>
          ) : null}
          <View className={`mt-2 gap-3 ${stacked ? '' : 'flex-row'}`}>
            {buttons.map((button) => (
              <Button
                key={button.text}
                label={button.text}
                variant={VARIANT[button.style ?? 'default']}
                className={stacked ? '' : 'flex-1'}
                onPress={() => answerDialog(request.id, button)}
              />
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
