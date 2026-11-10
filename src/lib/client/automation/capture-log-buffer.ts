import {
  adaptAutomationEventToLogEntry,
  adaptLegacyLogToLogEntry,
  isAutomationEventEnvelope,
  isLegacyLogMessage,
  type AutomationLogEntry as ClientLogEntry,
} from './automation-event-client';
import { inferDevLogRunner, type AutomationRunner, type DevLogCategory } from '@/lib/devlog-contract';
import { EventBuffer } from './event-buffer';

export interface CaptureLogEntry extends ClientLogEntry {
  runner?: AutomationRunner;
  category?: DevLogCategory;
  event?: string;
  schemaVersion?: number;
}

export function normalizeCaptureLog(message: unknown): CaptureLogEntry | null {
  let entry: ClientLogEntry;
  if (isAutomationEventEnvelope(message)) {
    entry = adaptAutomationEventToLogEntry(message);
  } else if (isLegacyLogMessage(message)) {
    const storedEvent = (message as ClientLogEntry & { automationEvent?: unknown }).automationEvent;
    const envelope = { type: 'automation.event', schemaVersion: 1, event: storedEvent };
    if (isAutomationEventEnvelope(envelope)) {
      const normalized = adaptAutomationEventToLogEntry(envelope);
      entry = { ...message, ...normalized, log: message.log ?? normalized.log, network: message.network ?? normalized.network };
    } else {
      entry = adaptLegacyLogToLogEntry(message);
    }
  } else {
    return null;
  }
  if (!entry.testCaseId) return null;
  return {
    ...entry,
    runner: inferDevLogRunner(entry),
    category: entry.isNetwork ? 'network' : entry.isConsole ? 'console' : 'execution',
    event: entry.eventType,
  };
}

export function parseCaptureLogs(text: string): CaptureLogEntry[] {
  const logs: CaptureLogEntry[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try { const entry = normalizeCaptureLog(JSON.parse(line)); if (entry) logs.push(entry); } catch { /* An incomplete final JSONL line can be retried on the next sync. */ }
  }
  return logs;
}

function logKey(entry: CaptureLogEntry) {
  if (entry.eventId) return `event:${entry.eventId}`;
  // Legacy fallback uses the exact clock, not a one-second bucket that merges real requests.
  return JSON.stringify([entry.testCaseId, entry.sessionId, entry.timestamp, entry.relativeMs, entry.source, entry.eventType,
    entry.network?.event, entry.network?.method, entry.network?.url, entry.network?.status, entry.log]);
}

export class CaptureLogBuffer {
  private buffer = new EventBuffer<CaptureLogEntry>();
  private keys = new Set<string>();
  private sessionId?: string;

  reset(entries: CaptureLogEntry[] = []) {
    this.buffer.reset(); this.keys.clear(); this.sessionId = undefined;
    for (const entry of entries) this.append(entry);
  }

  append(entry: CaptureLogEntry) {
    if (this.sessionId && entry.sessionId && entry.sessionId !== this.sessionId) this.reset();
    const key = logKey(entry);
    if (this.keys.has(key)) return false;
    this.keys.add(key);
    this.sessionId = entry.sessionId ?? this.sessionId;
    this.buffer.append([entry]);
    return true;
  }

  reconcile(history: CaptureLogEntry[]) {
    const live = this.snapshot();
    const sessionId = history.at(-1)?.sessionId;
    this.reset(history);
    // A response snapshot can finish after newer WebSocket messages have arrived.
    for (const entry of live) if (!sessionId || entry.sessionId === sessionId) this.append(entry);
    return this.snapshot();
  }

  snapshot() { return this.buffer.snapshot(); }
}
