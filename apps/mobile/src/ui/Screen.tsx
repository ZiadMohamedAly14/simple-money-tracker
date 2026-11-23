import type { ReactElement, ReactNode } from 'react';
import { ScrollView, View, type RefreshControlProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { IconButton } from './Button';
import { Text } from './Text';

export interface ScreenProps {
  children: ReactNode;
  /** Scrolls the content; keep fixed footers (main button) outside via `footer`. */
  scroll?: boolean;
  /** Pinned to the bottom (e.g. the main button). */
  footer?: ReactNode;
  /** Pull to refresh on a scrolling screen. */
  refreshControl?: ReactElement<RefreshControlProps>;
  className?: string;
}

/** Safe-area screen with the standard side padding. The theme background comes from ThemeProvider. */
export function Screen({ children, scroll, footer, refreshControl, className = '' }: ScreenProps) {
  const body = scroll ? (
    <ScrollView
      className="flex-1"
      contentContainerClassName={`gap-4 px-5 pb-6 ${className}`}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  ) : (
    <View className={`flex-1 gap-4 px-5 ${className}`}>{children}</View>
  );
  return (
    <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
      {body}
      {footer ? <View className="gap-3 px-5 pb-4 pt-2">{footer}</View> : null}
    </SafeAreaView>
  );
}

export interface ScreenHeaderProps {
  title?: string;
  /** Shows a round back (or close) button. */
  onBack?: () => void;
  backIcon?: 'back' | 'close';
  /** Element at the end of the header (e.g. "Pending sync"). */
  end?: ReactNode;
  /** Centers the title between the start and end elements (keep their widths equal). */
  centerTitle?: boolean;
}

/** Round back/close button, then the title, then an optional end element. */
export function ScreenHeader({ title, onBack, backIcon = 'back', end, centerTitle }: ScreenHeaderProps) {
  const { t } = useTranslation();
  const back = onBack ? (
    <IconButton
      icon={backIcon === 'close' ? 'app:close' : 'app:back'}
      directional={backIcon === 'back'}
      accessibilityLabel={backIcon === 'close' ? t('common.close') : t('common.back')}
      onPress={onBack}
    />
  ) : null;
  return (
    <View className="min-h-11 flex-row items-center gap-3 pt-2">
      {backIcon === 'back' ? back : null}
      {title ? (
        <Text weight="bold" accessibilityRole="header" numberOfLines={1} className={`flex-1 text-xl ${centerTitle ? 'text-center' : ''}`}>
          {title}
        </Text>
      ) : (
        <View className="flex-1" />
      )}
      {end}
      {backIcon === 'close' ? back : null}
    </View>
  );
}
