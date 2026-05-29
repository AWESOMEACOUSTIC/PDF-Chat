// Swap the Map for Redis in production (multi-instance safe + TTL).
const lockouts = new Map<string, number>(); // userId -> unlockTimestamp
const strikes = new Map<string, number>();
const LOCKOUT_MS = 2 * 60 * 1000;
const STRIKE_LIMIT = 1; // lock on first violation; raise to 2-3 for a softer policy

export function isLockedOut(userId: string): boolean {
  const until = lockouts.get(userId);
  if (!until) return false;
  if (Date.now() > until) {
    lockouts.delete(userId);
    return false;
  }
  return true;
}

export function recordViolation(userId: string, reason: string): boolean {
  const count = (strikes.get(userId) ?? 0) + 1;
  strikes.set(userId, count);

  // 🔴 Real "reported to HR": persist to your audit log / DB / alerting here.
  console.error(
    `[HR-AUDIT] user=${userId} strike=${count} reason="${reason}" at=${new Date().toISOString()}`
  );

  if (count >= STRIKE_LIMIT) {
    lockouts.set(userId, Date.now() + LOCKOUT_MS);
    return true; // locked
  }
  return false; // warned only
}