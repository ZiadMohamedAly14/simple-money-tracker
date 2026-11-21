import type { FC } from 'react';
import type { SvgProps } from 'react-native-svg';
import Add from '../../assets/icon/add.svg';
import Back from '../../assets/icon/back.svg';
import BillsUtilities from '../../assets/icon/bills-utilities.svg';
import CharityHandCoin from '../../assets/icon/charity-hand-coin.svg';
import Delete from '../../assets/icon/delete.svg';
import Entertainment from '../../assets/icon/entertainment.svg';
import FingerprintBiometrics from '../../assets/icon/fingerprint-biometrics.svg';
import FoodGroceries from '../../assets/icon/food-groceries.svg';
import GentleWarning from '../../assets/icon/gentle-warning.svg';
import GiftGive from '../../assets/icon/gift-give.svg';
import Health from '../../assets/icon/health.svg';
import Housing from '../../assets/icon/housing.svg';
import IncomeMoney from '../../assets/icon/income-money.svg';
import JarSave from '../../assets/icon/jar-save.svg';
import KidDevice from '../../assets/icon/kid-device.svg';
import Kids from '../../assets/icon/kids.svg';
import Learn from '../../assets/icon/learn.svg';
import LearnIllustrationJarCoins from '../../assets/icon/learn-illustration-jar-coins.svg';
import LockPin from '../../assets/icon/lock-pin.svg';
import MonthlyBills from '../../assets/icon/monthly-bills.svg';
import MoveMoney from '../../assets/icon/move-money.svg';
import Offline from '../../assets/icon/offline.svg';
import Other from '../../assets/icon/other.svg';
import Personal from '../../assets/icon/personal.svg';
import ReorderHistory from '../../assets/icon/reorder-history.svg';
import Selected from '../../assets/icon/selected.svg';
import ShoppingSpend from '../../assets/icon/shopping-spend.svg';
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
  back: Back,
  'bills-utilities': BillsUtilities,
  'charity-hand-coin': CharityHandCoin,
  delete: Delete,
  entertainment: Entertainment,
  'fingerprint-biometrics': FingerprintBiometrics,
  'food-groceries': FoodGroceries,
  'gentle-warning': GentleWarning,
  'gift-give': GiftGive,
  health: Health,
  housing: Housing,
  'income-money': IncomeMoney,
  'jar-save': JarSave,
  'kid-device': KidDevice,
  kids: Kids,
  learn: Learn,
  'learn-illustration-jar-coins': LearnIllustrationJarCoins,
  'lock-pin': LockPin,
  'monthly-bills': MonthlyBills,
  'move-money': MoveMoney,
  offline: Offline,
  other: Other,
  personal: Personal,
  'reorder-history': ReorderHistory,
  selected: Selected,
  'shopping-spend': ShoppingSpend,
  transport: Transport,
  unallocated: Unallocated,
  wallet: Wallet,
} satisfies Record<string, FC<SvgProps>>;

export type AppIconName = keyof typeof APP_ICONS;

/** Launcher artwork in the same folder, not part of APP_ICONS. */
export const NON_UI_ICON_FILES = ['icon', 'adaptive-foreground'] as const;

/** Arrows: drawn for left-to-right, mirrored in right-to-left. */
export const DIRECTIONAL_APP_ICONS: ReadonlySet<AppIconName> = new Set<AppIconName>(['back', 'move-money']);
