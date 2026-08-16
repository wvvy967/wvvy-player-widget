import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PlayerStore } from '@lib/player.svelte';
import { reset as resetRegistry } from '@lib/registry';

const STREAM = 'https://radio.test/listen/x/radio.mp3';

function makePlayer(streamUrl: string | null = STREAM) {
  return new PlayerStore({ streamUrl: () => streamUrl, stationName: () => 'Test Radio' });
}

beforeEach(() => {
  resetRegistry();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  resetRegistry();
  vi.restoreAllMocks();
});

describe('playback', () => {
  it('starts the stream on first toggle', async () => {
    const p = makePlayer();
    await p.toggle();
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
    p.destroy();
  });

  it('appends a cache-buster so a proxy cannot serve a stale segment', async () => {
    const p = makePlayer();
    const srcs: string[] = [];
    const spy = vi.spyOn(HTMLMediaElement.prototype, 'src', 'set').mockImplementation(function (this: HTMLMediaElement, v: string) {
      srcs.push(v);
    });
    await p.toggle();
    expect(srcs[0]).toMatch(/^https:\/\/radio\.test\/listen\/x\/radio\.mp3\?_=\d+$/);
    spy.mockRestore();
    p.destroy();
  });

  it('reports an error rather than playing silence when no stream is known', async () => {
    const p = makePlayer(null);
    await p.toggle();
    expect(p.error).toBe('no stream configured');
    expect(p.isPlaying).toBe(false);
    p.destroy();
  });

  it('treats an autoplay block as terminal instead of retrying forever', async () => {
    const p = makePlayer();
    const err = new DOMException('blocked', 'NotAllowedError');
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValueOnce(err);
    await p.toggle();
    expect(p.error).toMatch(/blocked by the browser/);
    p.destroy();
  });

  it('drops the connection on pause so a paused live stream stops buffering', async () => {
    const p = makePlayer();
    await p.toggle();
    await p.toggle();
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    expect(HTMLMediaElement.prototype.load).toHaveBeenCalled();
    expect(p.isPlaying).toBe(false);
    p.destroy();
  });
});

describe('multiple widgets on one page', () => {
  // A host site may put a bar in the header and a card in the sidebar. Two
  // simultaneous streams would play the same audio a few seconds apart.
  it('stops the other instances when one starts', async () => {
    const a = makePlayer();
    const b = makePlayer();
    await a.toggle();
    const pauseSpy = vi.spyOn(HTMLMediaElement.prototype, 'pause');
    await b.toggle();
    expect(pauseSpy).toHaveBeenCalled();
    expect(a.isPlaying).toBe(false);
    a.destroy();
    b.destroy();
  });

  it('unregisters on destroy so a torn-down widget is not paused again', async () => {
    const a = makePlayer();
    a.destroy();
    const b = makePlayer();
    await expect(b.toggle()).resolves.toBeUndefined();
    b.destroy();
  });
});

describe('volume', () => {
  it('clamps out-of-range values', () => {
    const p = makePlayer();
    p.setVolume(2);
    expect(p.volume).toBe(1);
    p.setVolume(-1);
    expect(p.volume).toBe(0);
    p.destroy();
  });

  it('survives localStorage being unavailable', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const p = makePlayer();
    expect(() => p.setVolume(0.5)).not.toThrow();
    expect(p.volume).toBe(0.5);
    spy.mockRestore();
    p.destroy();
  });
});

describe('offline', () => {
  it('refuses to start and explains why when the browser is offline', async () => {
    const p = makePlayer();
    p.online = false;
    await p.toggle();
    expect(p.error).toBe('offline — no network connection');
    expect(p.isPlaying).toBe(false);
    p.destroy();
  });

  it('retries as soon as the network returns instead of waiting out the backoff', async () => {
    const p = makePlayer();
    p.online = false;
    await p.toggle();
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play');
    window.dispatchEvent(new Event('online'));
    await Promise.resolve();
    expect(p.online).toBe(true);
    expect(play).toHaveBeenCalled();
    p.destroy();
  });

  it('surfaces the outage when the network drops mid-listen', async () => {
    const p = makePlayer();
    await p.toggle();
    window.dispatchEvent(new Event('offline'));
    expect(p.online).toBe(false);
    expect(p.error).toBe('offline — no network connection');
    p.destroy();
  });
});

describe('reconnection', () => {
  // A dead upstream must not be retried forever — the listener ends up staring
  // at "reconnecting…" with no idea the station simply went off air.
  it('backs off and eventually gives up with an explanation', async () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new Error('boom'));
    const p = makePlayer();
    await p.toggle();
    expect(p.error).toBe('reconnecting…');

    for (let i = 0; i < 8; i++) await vi.advanceTimersByTimeAsync(12_000);

    expect(p.error).toBe('station appears to be off air');
    p.destroy();
    vi.useRealTimers();
  });

  it('stops retrying once the listener presses pause', async () => {
    vi.useFakeTimers();
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new Error('boom'));
    const p = makePlayer();
    await p.toggle();
    await p.toggle();
    const callsAtPause = play.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(play.mock.calls.length).toBe(callsAtPause);
    p.destroy();
    vi.useRealTimers();
  });
});

describe('media session', () => {
  it('publishes track metadata for the playing widget', async () => {
    const p = makePlayer();
    await p.toggle();
    p.updateNowPlaying({ artist: 'The Blasters', title: 'I Wish You Would' });
    expect(navigator.mediaSession.metadata).toMatchObject({ title: 'I Wish You Would', artist: 'The Blasters' });
    p.destroy();
  });

  // Two widgets on a page would otherwise fight over the lock screen, and the
  // silent one could win.
  it('ignores metadata from a widget that is not the audible one', async () => {
    const a = makePlayer();
    const b = makePlayer();
    await a.toggle();
    navigator.mediaSession.metadata = null;
    b.updateNowPlaying({ artist: 'Wrong', title: 'Widget' });
    expect(navigator.mediaSession.metadata).toBeNull();
    a.destroy();
    b.destroy();
  });

  it('falls back to the station name when a track has no artist', async () => {
    const p = makePlayer();
    await p.toggle();
    p.updateNowPlaying({ artist: '', title: '' });
    expect(navigator.mediaSession.metadata).toMatchObject({ title: 'Live Stream', artist: 'Test Radio' });
    p.destroy();
  });
});
