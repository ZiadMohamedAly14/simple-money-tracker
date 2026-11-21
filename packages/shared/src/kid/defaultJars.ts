/**
 * The Jars every new Kid Wallet starts with (spec, story 39), in display
 * order. Names come from the device language at creation time; IDs from
 * `defaultJarId`.
 */
export const DEFAULT_JAR_KEYS = ['save', 'spend', 'give'] as const;

export type DefaultJarKey = (typeof DEFAULT_JAR_KEYS)[number];
