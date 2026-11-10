/** Compare sources by when the session began, not by the last polling response. */
export function latestScriptResult<T extends { createdAt: string }>(runs: T[], captureStartedAt?: string | number | Date | null): T | null {
  const captureTime = captureStartedAt == null ? 0 : new Date(captureStartedAt).getTime() || 0;
  let latest: T | null = null;
  let latestTime = captureTime;
  for (const run of runs) {
    const time = new Date(run.createdAt).getTime();
    if (time > latestTime) { latest = run; latestTime = time; }
  }
  return latest;
}
