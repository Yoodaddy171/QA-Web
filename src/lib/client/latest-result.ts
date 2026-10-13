// Check again inside a transition updater: a request can become stale after
// parsing, but before React commits its lower-priority result.
export function isLatestResult(signal: AbortSignal, version: number, currentVersion: number, project: string, currentProject: string) {
  return !signal.aborted && version === currentVersion && project === currentProject;
}
