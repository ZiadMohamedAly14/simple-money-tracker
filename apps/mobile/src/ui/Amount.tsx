import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { IconCircle, type GlyphName, type IconCircleTone } from './icons';
import { Caret } from './Caret';
import { Text, type TextTone } from './Text';

const AMOUNT_SIZE = {
  lg: { amount: 'text-6xl', currency: 'text-xl', caret: 'xl' },
  md: { amount: 'text-5xl', currency: 'text-lg', caret: 'lg' },
  sm: { amount: 'text-3xl', currency: 'text-base', caret: 'md' },
} as const;

export interface AmountDisplayProps {
  /** The number, already formatted: formatMoneyParts(...).amount, or formatAmountInput(typed). */
  amount: string;
  /** The currency label: formatMoneyParts(...).currency, e.g. "EGP". */
  currency: string;
  size?: keyof typeof AMOUNT_SIZE;
  align?: 'start' | 'center';
  /** on-primary on the kid's green wallet card. */
  tone?: TextTone;
  /** What the amount is ("Amount", "Top-up amount"); read before it as "label, amount". */
  accessibilityLabel?: string;
  /** A blinking cursor after the number: the amount being typed on the app's keypad. */
  caret?: boolean;
}

/** Big amount with the currency smaller beside it ("1,250 EGP"); currency sits at the end side. */
export function AmountDisplay({ amount, currency, size = 'lg', align = 'center', tone = 'text', accessibilityLabel, caret }: AmountDisplayProps) {
  const { t } = useTranslation();
  const sizes = AMOUNT_SIZE[size];
  const spokenAmount = `${amount} ${currency}`;
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel ? t('home.figure', { label: accessibilityLabel, amount: spokenAmount }) : spokenAmount}
      className={`flex-row items-baseline gap-2 ${align === 'center' ? 'justify-center' : 'justify-start'}`}
    >
      {/* The number and its cursor stay left to right, so the cursor sits after the last digit in Arabic too. */}
      <View style={{ flexDirection: 'row', direction: 'ltr' }} className="shrink">
        <Text weight="bold" tone={tone} numberOfLines={1} adjustsFontSizeToFit className={`shrink ${sizes.amount}`}>
          {amount}
        </Text>
        {caret ? <Caret size={sizes.caret} /> : null}
      </View>
      <Text weight="semibold" tone={tone} className={sizes.currency}>
        {currency}
      </Text>
    </View>
  );
}

export type ProgressTone = 'primary' | 'negative' | 'jar-save' | 'jar-spend' | 'jar-give';

const FILL_CLASS: Record<ProgressTone, string> = {
  primary: 'bg-primary',
  negative: 'bg-negative',
  'jar-save': 'bg-jar-save',
  'jar-spend': 'bg-jar-spend',
  'jar-give': 'bg-jar-give',
};

export interface ProgressBarProps {
  /** 0 to 1; values outside are clamped (an over-budget bar is simply full). */
  progress: number;
  tone?: ProgressTone;
  /** Drawn on a primary-green card (home hero card): light translucent track, on-primary fill; `tone` is ignored. */
  onPrimary?: boolean;
}

/** Thin bar on a tint track; fills from the start side. */
export function ProgressBar({ progress, tone = 'primary', onPrimary }: ProgressBarProps) {
  const percent = Math.round(Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0)) * 100);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      className={`h-2 flex-row overflow-hidden rounded-full ${onPrimary ? 'bg-on-primary/25' : 'bg-tint'}`}
    >
      <View className={`rounded-full ${onPrimary ? 'bg-on-primary' : FILL_CLASS[tone]}`} style={{ width: `${percent}%` }} />
    </View>
  );
}

export interface ProgressRowProps {
  icon: GlyphName;
  iconTone?: IconCircleTone;
  title: string;
  progress: number;
  barTone?: ProgressTone;
  /** Text at the end of the title line: "750 left", "420 over", or a Jar balance. */
  end?: string;
  endTone?: TextTone;
  /** Bigger end text, for Jar balances on the kid wallet. */
  largeEnd?: boolean;
  /** Under the bar, e.g. ltrIsolate(`${spent} / ${budget}`). */
  caption?: string;
}

/**
 * Category row (icon, name, "X left"/"X over", bar, "spent / budget") and
 * Jar row (jar-colored icon and bar, balance at the end). Render it inside a Card.
 */
export function ProgressRow({
  icon,
  iconTone = 'tint',
  title,
  progress,
  barTone = 'primary',
  end,
  endTone = 'positive',
  largeEnd,
  caption,
}: ProgressRowProps) {
  return (
    <View className="flex-row items-center gap-3">
      <IconCircle icon={icon} tone={iconTone} size={largeEnd ? 'lg' : 'sm'} />
      <View className="flex-1 gap-2">
        <View className="flex-row items-center justify-between gap-2">
          <Text weight="semibold" numberOfLines={1} className={`flex-1 ${largeEnd ? 'text-lg' : 'text-base'}`}>
            {title}
          </Text>
          {end && !largeEnd ? (
            <Text weight="bold" tone={endTone} className="text-sm">
              {end}
            </Text>
          ) : null}
        </View>
        <ProgressBar progress={progress} tone={barTone} />
        {caption ? (
          <Text tone="muted" className="text-xs">
            {caption}
          </Text>
        ) : null}
      </View>
      {end && largeEnd ? (
        <Text weight="bold" tone={endTone} className="text-3xl">
          {end}
        </Text>
      ) : null}
    </View>
  );
}
