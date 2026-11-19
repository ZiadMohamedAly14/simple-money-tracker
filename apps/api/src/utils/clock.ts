/** The current time. Injected through `createApp` deps so tests can move time forward. */
export type Clock = () => Date;

export const systemClock: Clock = () => new Date();
