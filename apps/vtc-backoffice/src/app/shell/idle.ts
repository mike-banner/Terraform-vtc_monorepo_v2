export const IDLE_LIMIT_MS = 30 * 60 * 1000;

export const isIdle = (last: number, now: number, limit = IDLE_LIMIT_MS) => now - last > limit;
