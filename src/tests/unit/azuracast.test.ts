import { describe, it, expect } from 'vitest';
import { normalizeBase, nowPlayingUrl, scheduleUrl, parseNowPlaying, parseSchedule, hasTrack, trackLine, fmtDuration } from '@lib/azuracast';

describe('endpoint builders', () => {
  it('trims trailing slashes so paths never double up', () => {
    expect(normalizeBase('https://radio.wvvy.org///')).toBe('https://radio.wvvy.org');
    expect(nowPlayingUrl('https://radio.wvvy.org/', 'wvvy')).toBe('https://radio.wvvy.org/api/station/wvvy/nowplaying');
    expect(scheduleUrl('https://radio.wvvy.org', 'wvvy')).toBe('https://radio.wvvy.org/api/station/wvvy/schedule');
  });

  it('encodes shortcodes so an odd station id cannot break the path', () => {
    expect(nowPlayingUrl('https://x.test', 'a b/c')).toBe('https://x.test/api/station/a%20b%2Fc/nowplaying');
  });
});

describe('parseNowPlaying', () => {
  const full = {
    station: {
      name: 'WVVY 96.7',
      description: 'Community radio',
      listen_url: 'https://radio.wvvy.org/listen/wvvy/radio.mp3',
      mounts: [
        { bitrate: 64, format: 'audio/mpeg', is_default: false, url: 'https://x/low' },
        { bitrate: 128, format: 'audio/mpeg', is_default: true, url: 'https://x/high' }
      ]
    },
    listeners: { current: 7, unique: 5, total: 7 },
    live: { is_live: true, streamer_name: '  DJ Allen  ' },
    now_playing: { song: { artist: ' The Blasters ', title: ' I Wish You Would ', album: 'Non Fiction', art: 'https://art' }, played_at: 1700000000, elapsed: 42, duration: 180 },
    playing_next: { song: { artist: 'Next', title: 'Song' } },
    song_history: [{ played_at: 1699999000, song: { artist: 'Prev', title: 'Track' } }]
  };

  it('flattens the nested payload and trims whitespace', () => {
    const d = parseNowPlaying(full);
    expect(d.nowPlaying).toMatchObject({ artist: 'The Blasters', title: 'I Wish You Would', album: 'Non Fiction', art: 'https://art' });
    expect(d.live).toEqual({ isLive: true, streamer: 'DJ Allen' });
    expect(d.listeners).toBe(7);
    expect(d.stationName).toBe('WVVY 96.7');
    expect(d.playingNext?.title).toBe('Song');
    expect(d.history).toHaveLength(1);
    expect(d.elapsed).toBe(42);
  });

  it('prefers the default mount for bitrate/format', () => {
    expect(parseNowPlaying(full).bitrate).toBe(128);
  });

  it('falls back to the first mount when none is flagged default', () => {
    const d = parseNowPlaying({ station: { mounts: [{ bitrate: 64, format: 'audio/mpeg' }] } });
    expect(d.bitrate).toBe(64);
  });

  it('survives an empty payload rather than throwing', () => {
    const d = parseNowPlaying({});
    expect(d.nowPlaying).toMatchObject({ artist: '', title: '' });
    expect(d.listeners).toBeNull();
    expect(d.streamUrl).toBeNull();
    expect(d.history).toEqual([]);
  });

  it('distinguishes a hidden listener count from zero listeners', () => {
    expect(parseNowPlaying({ listeners: { current: 0 } }).listeners).toBe(0);
    expect(parseNowPlaying({}).listeners).toBeNull();
  });

  it('reads the stream URL from listen_url, then the mount', () => {
    expect(parseNowPlaying(full).streamUrl).toBe('https://radio.wvvy.org/listen/wvvy/radio.mp3');
    expect(parseNowPlaying({ station: { mounts: [{ url: 'https://only/mount' }] } }).streamUrl).toBe('https://only/mount');
  });
});

describe('parseSchedule', () => {
  const at = (d: Date, h: number) => Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate(), h).getTime() / 1000);

  it('keeps only entries starting today, in the viewer local zone', () => {
    const now = new Date(2026, 7, 16, 9, 0);
    const tomorrow = new Date(2026, 7, 17, 12, 0);
    const out = parseSchedule(
      [
        { name: 'Sunday Sessions', start_timestamp: at(now, 12), streamer: 'DJ Ricky Prime' },
        { name: 'Tomorrow Show', start_timestamp: Math.floor(tomorrow.getTime() / 1000) }
      ],
      now
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ name: 'Sunday Sessions', presenter: 'DJ Ricky Prime', start: '12 PM' });
  });

  it('formats minutes only when non-zero', () => {
    const now = new Date(2026, 7, 16, 9, 0);
    const out = parseSchedule([{ name: 'Open Yer Ears', start_timestamp: at(now, 19) + 1800 }], now);
    expect(out[0]?.start).toBe('7:30 PM');
  });

  it('caps the list', () => {
    const now = new Date(2026, 7, 16, 0, 0);
    const many = Array.from({ length: 8 }, (_, i) => ({ name: `Show ${i}`, start_timestamp: at(now, i + 1) }));
    expect(parseSchedule(many, now)).toHaveLength(3);
  });

  it('drops undated entries unless flagged as on now', () => {
    const now = new Date(2026, 7, 16, 9, 0);
    expect(parseSchedule([{ name: 'Mystery' }], now)).toHaveLength(0);
    expect(parseSchedule([{ name: 'Mystery', is_now: true }], now)).toHaveLength(1);
  });

  it('returns empty for a non-array payload instead of throwing', () => {
    expect(parseSchedule(null)).toEqual([]);
    expect(parseSchedule({ error: 'nope' })).toEqual([]);
  });
});

describe('track helpers', () => {
  it('treats a track as real once either field is filled', () => {
    expect(hasTrack({ artist: '', title: '' })).toBe(false);
    expect(hasTrack({ artist: 'X', title: '' })).toBe(true);
  });

  it('joins artist and title, collapsing when one is missing', () => {
    expect(trackLine({ artist: 'A', title: 'B' })).toBe('A · B');
    expect(trackLine({ artist: '', title: 'B' })).toBe('B');
    expect(trackLine({ artist: 'A', title: '' })).toBe('A');
    expect(trackLine(null)).toBe('');
  });

  it('formats durations', () => {
    expect(fmtDuration(0)).toBe('0:00');
    expect(fmtDuration(-5)).toBe('0:00');
    expect(fmtDuration(65)).toBe('1:05');
  });
});
