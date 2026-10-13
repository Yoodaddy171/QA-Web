'use client';
import { useLayoutEffect, useState } from 'react';

export function createActionDispatcher<T extends Record<string, (...args: any[]) => any>>(initial: T) {
  let committed = initial;
  const actions = Object.fromEntries(Object.keys(initial).map(key => [key, (...args: any[]) => committed[key](...args)])) as T;
  return { actions, commit: (next: T) => { committed = next; } };
}

// Stable event handlers for a memoized view. Update after commit, never during
// render, so interrupted renders cannot replace the currently visible actions.
export function useCommittedActions<T extends Record<string, (...args: any[]) => any>>(actions: T): T {
  const [dispatcher] = useState(() => createActionDispatcher(actions));
  useLayoutEffect(() => { dispatcher.commit(actions); });
  return dispatcher.actions;
}
