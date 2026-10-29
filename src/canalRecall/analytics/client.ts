/**
 * Batching beacon client for consent-free analytics.
 *
 * It holds a queue in memory, validates every event against the shared
 * allow-list before queueing it (so a bug in a hook cannot leak a field), and
 * sends batches with `navigator.sendBeacon`. Nothing is written to cookies or
 * web storage; the session id is random per client instance (per tab) and
 * lives only in this object.
 */
import {
  ANALYTICS_SCHEMA_VERSION, MAX_BATCH_BYTES, MAX_EVENTS_PER_BATCH, validateEvent,
  type AnalyticsBatch, type AnalyticsEvent,
} from './schema';

export type BeaconSend = (url: string, body: string) => boolean;

export interface AnalyticsClientOptions {
  endpoint: string;
  send: BeaconSend;
  /** 16 hex chars; see `randomSessionId`. */
  sessionId: string;
  /** Flush on its own once this many events are queued. */
  autoFlushAt?: number;
  /** Events kept while the beacon queue refuses (sendBeacon returned false). */
  maxQueued?: number;
}

export function randomSessionId(random: (bytes: Uint8Array) => Uint8Array = b => crypto.getRandomValues(b)): string {
  return Array.from(random(new Uint8Array(8)), byte => byte.toString(16).padStart(2, '0')).join('');
}

export class AnalyticsClient {
  private queue: AnalyticsEvent[] = [];
  private batchCount = 0;
  private readonly autoFlushAt: number;
  private readonly maxQueued: number;
  /** Events refused by the allow-list (a hook bug); visible for tests and devtools. */
  rejected = 0;
  sentBatches = 0;

  constructor(private readonly options: AnalyticsClientOptions) {
    this.autoFlushAt = Math.min(options.autoFlushAt ?? 40, MAX_EVENTS_PER_BATCH);
    this.maxQueued = options.maxQueued ?? 400;
  }

  get pending(): number {
    return this.queue.length;
  }

  track(event: AnalyticsEvent): boolean {
    const valid = validateEvent(event);
    if (!valid) {
      this.rejected += 1;
      return false;
    }
    if (this.queue.length >= this.maxQueued) this.queue.shift();
    this.queue.push(valid);
    if (this.queue.length >= this.autoFlushAt) this.flush();
    return true;
  }

  /** Send everything queued, in batches within the server's limits. False if the browser refused one. */
  flush(): boolean {
    while (this.queue.length) {
      let take = Math.min(this.queue.length, MAX_EVENTS_PER_BATCH);
      let body = this.body(this.queue.slice(0, take));
      while (body.length > MAX_BATCH_BYTES && take > 1) {
        take = Math.ceil(take / 2);
        body = this.body(this.queue.slice(0, take));
      }
      let ok = false;
      try { ok = this.options.send(this.options.endpoint, body); } catch { ok = false; }
      if (!ok) return false;
      this.queue.splice(0, take);
      this.batchCount += 1;
      this.sentBatches += 1;
    }
    return true;
  }

  private body(events: AnalyticsEvent[]): string {
    const batch: AnalyticsBatch = { v: ANALYTICS_SCHEMA_VERSION, sid: this.options.sessionId, n: this.batchCount, events };
    return JSON.stringify(batch);
  }
}
