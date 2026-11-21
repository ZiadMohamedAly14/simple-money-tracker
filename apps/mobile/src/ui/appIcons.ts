import type { FC } from 'react';
import type { SvgProps } from 'react-native-svg';
import Add from '../../assets/icon/add.svg';
import Archive from '../../assets/icon/archive.svg';
import Back from '../../assets/icon/back.svg';
import Backspace from '../../assets/icon/backspace.svg';
import BillsUtilities from '../../assets/icon/bills-utilities.svg';
import Calendar from '../../assets/icon/calendar.svg';
import CharityHandCoin from '../../assets/icon/charity-hand-coin.svg';
import ChevronDown from '../../assets/icon/chevron-down.svg';
import ChevronForward from '../../assets/icon/chevron-forward.svg';
import ChevronUp from '../../assets/icon/chevron-up.svg';
import Close from '../../assets/icon/close.svg';
import Cloud from '../../assets/icon/cloud.svg';
import Currency from '../../assets/icon/currency.svg';
import Delete from '../../assets/icon/delete.svg';
import Devices from '../../assets/icon/devices.svg';
import Digits from '../../assets/icon/digits.svg';
import Edit from '../../assets/icon/edit.svg';
import Email from '../../assets/icon/email.svg';
import Entertainment from '../../assets/icon/entertainment.svg';
import Exit from '../../assets/icon/exit.svg';
import FingerprintBiometrics from '../../assets/icon/fingerprint-biometrics.svg';
import FoodGroceries from '../../assets/icon/food-groceries.svg';
import GentleWarning from '../../assets/icon/gentle-warning.svg';
import GiftGive from '../../assets/icon/gift-give.svg';
import Health from '../../assets/icon/health.svg';
import Housing from '../../assets/icon/housing.svg';
import IncomeMoney from '../../assets/icon/income-money.svg';
import Info from '../../assets/icon/info.svg';
import JarSave from '../../assets/icon/jar-save.svg';
import Key from '../../assets/icon/key.svg';
import KidDevice from '../../assets/icon/kid-device.svg';
import Kids from '../../assets/icon/kids.svg';
import Language from '../../assets/icon/language.svg';
import Learn from '../../assets/icon/learn.svg';
import LearnIllustrationBudget from '../../assets/icon/learn-illustration-budget.svg';
import LearnIllustrationComparePrices from '../../assets/icon/learn-illustration-compare-prices.svg';
import LearnIllustrationEarning from '../../assets/icon/learn-illustration-earning.svg';
import LearnIllustrationGiving from '../../assets/icon/learn-illustration-giving.svg';
import LearnIllustrationJarCoins from '../../assets/icon/learn-illustration-jar-coins.svg';
import LearnIllustrationNeedsWants from '../../assets/icon/learn-illustration-needs-wants.svg';
import LearnIllustrationPatience from '../../assets/icon/learn-illustration-patience.svg';
import LearnIllustrationSavingGoal from '../../assets/icon/learn-illustration-saving-goal.svg';
import LearnIllustrationSpendingChoices from '../../assets/icon/learn-illustration-spending-choices.svg';
import LockPin from '../../assets/icon/lock-pin.svg';
import MonthlyBills from '../../assets/icon/monthly-bills.svg';
import More from '../../assets/icon/more.svg';
import MoveMoney from '../../assets/icon/move-money.svg';
import Note from '../../assets/icon/note.svg';
import Offline from '../../assets/icon/offline.svg';
import Other from '../../assets/icon/other.svg';
import PendingSync from '../../assets/icon/pending-sync.svg';
import Personal from '../../assets/icon/personal.svg';
import PieChart from '../../assets/icon/pie-chart.svg';
import ReorderHistory from '../../assets/icon/reorder-history.svg';
import Restore from '../../assets/icon/restore.svg';
import RevokeDevice from '../../assets/icon/revoke-device.svg';
import Selected from '../../assets/icon/selected.svg';
import Settings from '../../assets/icon/settings.svg';
import ShoppingSpend from '../../assets/icon/shopping-spend.svg';
import Spending from '../../assets/icon/spending.svg';
import Success from '../../assets/icon/success.svg';
import Tag from '../../assets/icon/tag.svg';
import Transport from '../../assets/icon/transport.svg';
import Unallocated from '../../assets/icon/unallocated.svg';
import Wallet from '../../assets/icon/wallet.svg';

/**
 * The custom icon set in `assets/icon/`, keyed by file name. Metro needs static
 * imports, so a new .svg file needs a line here (appIcons.test.ts checks the
 * two match). `icon.svg` and `adaptive-foreground.svg` are the launcher icon,
 * not UI icons, and are left out.
 */
export const APP_ICONS = {
  add: Add,
  archive: Archive,
  back: Back,
  backspace: Backspace,
  'bills-utilities': BillsUtilities,
  calendar: Calendar,
  'charity-hand-coin': CharityHandCoin,
  'chevron-down': ChevronDown,
  'chevron-forward': ChevronForward,
  'chevron-up': ChevronUp,
  close: Close,
  cloud: Cloud,
  currency: Currency,
  delete: Delete,
  devices: Devices,
  digits: Digits,
  edit: Edit,
  email: Email,
  entertainment: Entertainment,
  exit: Exit,
  'fingerprint-biometrics': FingerprintBiometrics,
  'food-groceries': FoodGroceries,
  'gentle-warning': GentleWarning,
  'gift-give': GiftGive,
  health: Health,
  housing: Housing,
  'income-money': IncomeMoney,
  info: Info,
  'jar-save': JarSave,
  key: Key,
  'kid-device': KidDevice,
  kids: Kids,
  language: Language,
  learn: Learn,
  'learn-illustration-budget': LearnIllustrationBudget,
  'learn-illustration-compare-prices': LearnIllustrationComparePrices,
  'learn-illustration-earning': LearnIllustrationEarning,
  'learn-illustration-giving': LearnIllustrationGiving,
  'learn-illustration-jar-coins': LearnIllustrationJarCoins,
  'learn-illustration-needs-wants': LearnIllustrationNeedsWants,
  'learn-illustration-patience': LearnIllustrationPatience,
  'learn-illustration-saving-goal': LearnIllustrationSavingGoal,
  'learn-illustration-spending-choices': LearnIllustrationSpendingChoices,
  'lock-pin': LockPin,
  'monthly-bills': MonthlyBills,
  more: More,
  'move-money': MoveMoney,
  note: Note,
  offline: Offline,
  other: Other,
  'pending-sync': PendingSync,
  personal: Personal,
  'pie-chart': PieChart,
  'reorder-history': ReorderHistory,
  restore: Restore,
  'revoke-device': RevokeDevice,
  selected: Selected,
  settings: Settings,
  'shopping-spend': ShoppingSpend,
  spending: Spending,
  success: Success,
  tag: Tag,
  transport: Transport,
  unallocated: Unallocated,
  wallet: Wallet,
} satisfies Record<string, FC<SvgProps>>;

export type AppIconName = keyof typeof APP_ICONS;

/** Launcher artwork in the same folder, not part of APP_ICONS. */
export const NON_UI_ICON_FILES = ['icon', 'adaptive-foreground'] as const;

/**
 * Arrows and chevrons that point along the line: drawn for left-to-right,
 * mirrored in right-to-left. chevron-up and chevron-down point the same way in
 * both directions, so they are not here.
 */
export const DIRECTIONAL_APP_ICONS: ReadonlySet<AppIconName> = new Set<AppIconName>(['back', 'chevron-forward', 'move-money']);

/**
 * Whether to draw an icon flipped left to right. Directional icons flip in
 * right-to-left; `reversed` flips once more, so chevron-forward used as a
 * "previous" arrow points toward the start of the line in both directions.
 */
export function isAppIconMirrored(
  name: AppIconName,
  { isRTL, directional = false, reversed = false }: { isRTL: boolean; directional?: boolean; reversed?: boolean },
): boolean {
  return (isRTL && (directional || DIRECTIONAL_APP_ICONS.has(name))) !== reversed;
}

/**
 * Drawn and registered, but no screen uses them yet: they wait for upcoming
 * tickets (the adult's devices list and revoking one, the recovery key, an
 * expense note).
 */
export const RESERVED_APP_ICONS = ['devices', 'revoke-device', 'key', 'note'] as const satisfies readonly AppIconName[];
