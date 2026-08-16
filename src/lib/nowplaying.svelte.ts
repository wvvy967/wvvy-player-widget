import { nowPlayingUrl, scheduleUrl, parseNowPlaying, parseSchedule, hasTrack, type NowPlayingData, type ScheduleEntry } from './azuracast';

export type FeedState = 'loading' | 'live' | 'stale' | 'down';

export type FeedOptions = {
  station: string;
  shortcode: string;
  pollIntervalMs: number;
  withSchedule: boolean;
  /**
   * Explicit schedule endpoint. Falls back to the station's own AzuraCast
   * schedule when unset — the override exists for stations whose schedule lives
   * elsewhere but is published in the same JSON shape.
   */
  scheduleUrl?: string;
};

/**
 * Polls one AzuraCast station. Per-instance rather than a module singleton: a
 * host page may embed two widgets pointed at different stations.
 *
 * Polling is deliberately conservative — this runs on someone else's site, on
 * someone else's server. It stops while the tab is hidden and while the widget
 * is scrolled out of view, and it never retries faster than the configured
 * interval.
 */
export class NowPlayingStore {
  data = $state<NowPlayingData | null>(null);
  schedule = $state<ScheduleEntry[]>([]);
  /** Station is broadcasting: a real track is playing, or a live DJ is connected. */
  online = $state(false);
  feedState = $state<FeedState>('loading');
  /** Has the feed resolved at least once? Guards "off air" claims before first contact. */
  polled = $state(false);

  private timer: ReturnType<typeof setInterval> | null = null;
  private opts: FeedOptions;
  private visible = true;
  private inView = true;
  private observer: IntersectionObserver | null = null;
  private inFlight: AbortController | null = null;
  /** Schedule changes far more slowly than now-playing; fetch it once per session. */
  private scheduleLoaded = false;

  constructor(opts: FeedOptions) {
    this.opts = opts;
  }

  async load(): Promise<void> {
    // Never stack requests — a slow station shouldn't accumulate a queue.
    this.inFlight?.abort();
    const ctrl = new AbortController();
    this.inFlight = ctrl;
    try {
      const res = await fetch(nowPlayingUrl(this.opts.station, this.opts.shortcode), { cache: 'no-store', signal: ctrl.signal });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const parsed = parseNowPlaying(await res.json());
      // On air when the backend is serving a real track OR a live DJ is
      // connected via the harbor input. A live streamer's now_playing payload
      // often carries blank song metadata, so hasTrack alone would wrongly read
      // a live set as "off air".
      this.online = hasTrack(parsed.nowPlaying) || parsed.live.isLive;
      this.data = parsed;
      this.feedState = 'live';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      // Fail open: never claim the stream is dead just because the metadata feed
      // hiccupped. Keep whatever we have and mark it stale; only drop to "down"
      // when there's nothing to show at all.
      this.online = false;
      this.feedState = this.data ? 'stale' : 'down';
    } finally {
      if (this.inFlight === ctrl) this.inFlight = null;
      this.polled = true;
    }

    if (this.opts.withSchedule && !this.scheduleLoaded) {
      this.scheduleLoaded = true;
      await this.loadSchedule();
    }
  }

  private async loadSchedule(): Promise<void> {
    try {
      const url = this.opts.scheduleUrl ?? scheduleUrl(this.opts.station, this.opts.shortcode);
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`status ${res.status}`);
      this.schedule = parseSchedule(await res.json());
    } catch {
      // Stations that don't run their schedule through AzuraCast just get an
      // empty strip, which the card hides. WVVY keeps theirs in a Google Sheet
      // and points `scheduleUrl` at an endpoint that republishes it in this
      // same shape, so it takes the normal path above.
      this.schedule = [];
    }
  }

  start(): void {
    if (this.timer || typeof window === 'undefined') return;
    document.addEventListener('visibilitychange', this.handleVisibility);
    this.visible = document.visibilityState !== 'hidden';
    void this.load();
    this.timer = setInterval(() => {
      if (this.visible && this.inView) void this.load();
    }, this.opts.pollIntervalMs);
  }

  /**
   * Suspend polling while the widget is scrolled out of view. A player parked in
   * a page footer shouldn't cost the station a request every 20s forever.
   */
  observe(el: Element): void {
    if (typeof IntersectionObserver === 'undefined') return;
    this.observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const wasHidden = !this.inView;
      this.inView = entry.isIntersecting;
      // Coming back into view with stale data — refresh immediately rather than
      // showing an old track until the next tick.
      if (this.inView && wasHidden && this.visible) void this.load();
    });
    this.observer.observe(el);
  }

  private handleVisibility = () => {
    const wasHidden = !this.visible;
    this.visible = document.visibilityState !== 'hidden';
    if (this.visible && wasHidden && this.inView) void this.load();
  };

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.inFlight?.abort();
    this.inFlight = null;
    this.observer?.disconnect();
    this.observer = null;
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibility);
    }
  }
}
