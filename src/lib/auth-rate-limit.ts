interface Bucket { attempts: number; resetAt: number }

const buckets = new Map<string, Bucket>();

export function consumeLoginAttempt(key: string, now = Date.now(), limit = 5, windowMs = 15 * 60 * 1000) {
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { attempts: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }
  current.attempts += 1;
  return { allowed: current.attempts <= limit, remaining: Math.max(0, limit - current.attempts), resetAt: current.resetAt };
}

export function clearLoginAttempts(key: string) {
  buckets.delete(key);
}
