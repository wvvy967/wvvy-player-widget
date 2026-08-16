import type { Track } from './azuracast';
import { loadVolume, saveVolume } from './storage';
import { canControlVolume } from './platform';
import { register, unregister, siblings, claimMediaSession, ownsMediaSession } from './registry';

export type PlayerOptions = {
  /** Resolves the stream URL at play time — the default mount isn't known until the API responds. */
  streamUrl: () => string | null;
  /** Station name used for lock-screen metadata when a track has no artist. */
  stationName: () => string;
  /** Artwork fallbacks for the lock screen, absolute URLs. */
  artwork?: () => { src: string; sizes?: string; type?: string }[];
};

export class PlayerStore {
  isPlaying = $state(false);
  loading = $state(false);
  error = $state<string | null>(null);
  online = $state(typeof navigator === 'undefined' ? true : navigator.onLine);
  volume = $state(loadVolume());
  /**
   * Whether an on-page volume slider can actually work. False on iOS, where the
   * UI hides the slider and points listeners at the device buttons instead.
   */
  canSetVolume = $state(true);

  private audio: HTMLAudioElement | null = null;
  private wantPlay = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private lastMetadataKey: string | null = null;
  private opts: PlayerOptions;

  // ~35s of backoff (1+2+4+8+10+10) before giving up. Beyond that it's almost
  // certainly the station, not a flaky network — bail and say so.
  private readonly MAX_RECONNECT_ATTEMPTS = 6;

  constructor(opts: PlayerOptions) {
    this.opts = opts;
    if (typeof window === 'undefined') return;
    this.canSetVolume = canControlVolume();
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    register(this);
  }

  /** Tear down listeners, timers, and the audio element. Called on unmount. */
  destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.wantPlay = false;
    if (this.audio) {
      this.audio.pause();
      this.audio.removeAttribute('src');
      this.audio.load();
      this.audio = null;
    }
    unregister(this);
  }

  private takeMediaSession() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    claimMediaSession(this);
    navigator.mediaSession.setActionHandler('play', () => {
      if (!this.wantPlay) void this.toggle();
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      if (this.wantPlay) void this.toggle();
    });
    navigator.mediaSession.setActionHandler('stop', () => {
      if (this.wantPlay) void this.toggle();
    });
  }

  /**
   * Push now-playing metadata to the OS media controls (lock screen, notification
   * shade, CarPlay). This is the capability that pushed the widget away from an
   * iframe embed — the OS binds media controls to the top-level document, so the
   * audio element has to live in the host page for any of this to surface.
   */
  updateNowPlaying(track: Track | null | undefined) {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    // Only the audible player writes metadata; otherwise a second widget on the
    // page would clobber the lock screen of the one actually making noise.
    if (!ownsMediaSession(this)) return;
    const artist = (track?.artist ?? '').trim();
    const title = (track?.title ?? '').trim() || 'Live Stream';
    // The poller reassigns data wholesale every tick, so this fires on every
    // poll. Skip the MediaMetadata churn when the track hasn't moved.
    const key = `${artist} ${title}`;
    if (key === this.lastMetadataKey) return;
    this.lastMetadataKey = key;
    const station = this.opts.stationName();
    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist: artist || station,
      album: track?.album?.trim() || station,
      artwork: track?.art ? [{ src: track.art }, ...(this.opts.artwork?.() ?? [])] : (this.opts.artwork?.() ?? [])
    });
  }

  private setPlaybackState(state: MediaSessionPlaybackState) {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    if (!ownsMediaSession(this)) return;
    navigator.mediaSession.playbackState = state;
  }

  private handleOnline = () => {
    this.online = true;
    if (this.error === 'offline — no network connection') this.error = null;
    // The listener asked to play before the network dropped — retry now rather
    // than waiting out the backoff timer.
    if (this.wantPlay) {
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      this.reconnectAttempts = 0;
      void this.start();
    }
  };

  private handleOffline = () => {
    this.online = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.wantPlay) this.error = 'offline — no network connection';
  };

  private ensure() {
    if (this.audio) return this.audio;
    const el = new Audio();
    el.preload = 'none';
    // Icecast mounts are same-origin-agnostic; anonymous CORS keeps the element
    // from failing on stations that do send CORS headers for artwork/analytics.
    el.crossOrigin = 'anonymous';
    el.addEventListener('playing', () => {
      this.reconnectAttempts = 0;
      this.error = null;
      this.isPlaying = true;
      this.setPlaybackState('playing');
    });
    el.addEventListener('ended', () => this.handleDrop());
    el.addEventListener('error', () => this.handleDrop());
    el.addEventListener('stalled', () => this.handleDrop());
    el.addEventListener('pause', () => this.setPlaybackState(this.wantPlay ? 'playing' : 'paused'));
    this.audio = el;
    return el;
  }

  // Long-lived stream connections drop mid-song (network blips, upstream
  // restarts, mobile backgrounding). Auto-reconnect on any drop the listener
  // didn't ask for, with backoff so a dead upstream doesn't get hammered. After
  // MAX_RECONNECT_ATTEMPTS, give up and say "off air" rather than spinning forever.
  private handleDrop() {
    this.isPlaying = false;
    if (!this.wantPlay) return;
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      this.wantPlay = false;
      this.reconnectAttempts = 0;
      this.error = 'station appears to be off air';
      return;
    }
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 10_000);
    this.reconnectAttempts++;
    this.error = 'reconnecting…';
    this.reconnectTimer = setTimeout(() => void this.start(), delay);
  }

  /** Add a cache-buster so intermediary proxies don't hand back a stale segment. */
  private resolveStream(): string | null {
    const base = this.opts.streamUrl();
    if (!base) return null;
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}_=${Math.floor(Math.random() * 1_000_000)}`;
  }

  private async start() {
    const src = this.resolveStream();
    if (!src) {
      this.error = 'no stream configured';
      this.wantPlay = false;
      return;
    }
    const audio = this.ensure();
    try {
      this.loading = true;
      audio.volume = this.volume;
      audio.src = src;
      audio.load();
      await audio.play();
    } catch (err) {
      // A play() rejection right after a user gesture is almost always the
      // browser's autoplay policy, which retrying won't fix.
      //
      // Read `name` off the value directly rather than gating on
      // `instanceof Error` — DOMException doesn't reliably inherit from Error
      // across engines, and misclassifying this sends us into the reconnect
      // backoff for something no amount of retrying will fix.
      const name = typeof err === 'object' && err !== null && 'name' in err ? String((err as { name: unknown }).name) : '';
      if (name === 'NotAllowedError') {
        this.wantPlay = false;
        this.error = 'playback blocked by the browser — tap play again';
      } else {
        this.error = err instanceof Error ? err.message : 'transmission lost';
        if (this.wantPlay) this.handleDrop();
      }
    } finally {
      this.loading = false;
    }
  }

  /** Stop without touching wantPlay bookkeeping of other instances. */
  private stopAudio() {
    this.wantPlay = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.audio) {
      this.audio.pause();
      // Drop the connection outright. A paused <audio> on a live stream keeps
      // buffering, so the listener would be paying for bandwidth they can't hear
      // and would resume minutes behind live.
      this.audio.removeAttribute('src');
      this.audio.load();
    }
    this.isPlaying = false;
    this.reconnectAttempts = 0;
    this.error = null;
    this.setPlaybackState('paused');
  }

  async toggle() {
    if (this.wantPlay) {
      this.stopAudio();
      return;
    }
    // Two widgets on one page must not both make noise.
    for (const other of siblings(this)) other.stopAudio();
    if (!this.online) {
      this.wantPlay = true;
      this.error = 'offline — no network connection';
      return;
    }
    this.takeMediaSession();
    // Force a metadata refresh: the previous owner may have left a stale key.
    this.lastMetadataKey = null;
    this.wantPlay = true;
    this.reconnectAttempts = 0;
    this.error = null;
    await this.start();
  }

  setVolume(v: number) {
    const clamped = Math.min(1, Math.max(0, v));
    this.volume = clamped;
    if (this.audio) this.audio.volume = clamped;
    saveVolume(clamped);
  }
}
