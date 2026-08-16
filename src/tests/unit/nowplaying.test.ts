import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NowPlayingStore } from '@lib/nowplaying.svelte';

const opts = { station: 'https://radio.test', shortcode: 'x', pollIntervalMs: 20_000, withSchedule: false };

const payload = {
  station: { name: 'Test Radio', mounts: [{ bitrate: 128, is_default: true, url: 'https://radio.test/listen' }] },
  listeners: { current: 3 },
  now_playing: { song: { artist: 'A', title: 'B' } },
  live: { is_live: false }
};

function mockFetch(impl: (url: string) => Promise<Response> | Response) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input) => Promise.resolve(impl(String(input))));
}

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('load', () => {
  it('marks the station on air when a real track is reported', async () => {
    mockFetch(() => ok(payload));
    const s = new NowPlayingStore(opts);
    await s.load();
    expect(s.online).toBe(true);
    expect(s.feedState).toBe('live');
    expect(s.data?.nowPlaying.title).toBe('B');
    expect(s.polled).toBe(true);
    s.stop();
  });

  // A live DJ's now_playing payload usually carries blank song metadata, so a
  // track check alone would read a live set as "off air".
  it('marks the station on air for a live DJ with no track metadata', async () => {
    mockFetch(() => ok({ live: { is_live: true, streamer_name: 'DJ Allen' } }));
    const s = new NowPlayingStore(opts);
    await s.load();
    expect(s.online).toBe(true);
    s.stop();
  });

  it('goes down when the first fetch fails and there is nothing cached', async () => {
    mockFetch(() => new Response('nope', { status: 500 }));
    const s = new NowPlayingStore(opts);
    await s.load();
    expect(s.feedState).toBe('down');
    expect(s.data).toBeNull();
    s.stop();
  });

  // Fail open: a metadata hiccup must never make the widget claim the stream is
  // dead when the audio is fine.
  it('keeps prior data and goes stale when a later fetch fails', async () => {
    const fetchMock = mockFetch(() => ok(payload));
    const s = new NowPlayingStore(opts);
    await s.load();
    fetchMock.mockImplementation(() => Promise.reject(new Error('network')));
    await s.load();
    expect(s.feedState).toBe('stale');
    expect(s.data?.nowPlaying.title).toBe('B');
    s.stop();
  });

  it('fetches the schedule once, not on every poll', async () => {
    const seen: string[] = [];
    mockFetch((url) => {
      seen.push(url);
      return url.includes('/schedule') ? ok([]) : ok(payload);
    });
    const s = new NowPlayingStore({ ...opts, withSchedule: true });
    await s.load();
    await s.load();
    expect(seen.filter((u) => u.includes('/schedule'))).toHaveLength(1);
    s.stop();
  });

  it('leaves the schedule empty when the station does not publish one', async () => {
    mockFetch((url) => (url.includes('/schedule') ? new Response('', { status: 404 }) : ok(payload)));
    const s = new NowPlayingStore({ ...opts, withSchedule: true });
    await s.load();
    expect(s.schedule).toEqual([]);
    expect(s.feedState).toBe('live');
    s.stop();
  });

  it('does not treat its own abort as a feed failure', async () => {
    mockFetch(() => ok(payload));
    const s = new NowPlayingStore(opts);
    const first = s.load();
    const second = s.load();
    await Promise.all([first, second]);
    expect(s.feedState).toBe('live');
    s.stop();
  });
});

describe('polling lifecycle', () => {
  it('stops the interval and aborts in-flight work on stop', async () => {
    vi.useFakeTimers();
    const fetchMock = mockFetch(() => ok(payload));
    const s = new NowPlayingStore(opts);
    s.start();
    s.stop();
    const callsAfterStop = fetchMock.mock.calls.length;
    vi.advanceTimersByTime(120_000);
    expect(fetchMock.mock.calls.length).toBe(callsAfterStop);
    vi.useRealTimers();
  });
});
