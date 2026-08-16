// AzuraCast public API client.
//
// Everything here is pure: endpoint builders, response types, and mappers that
// flatten AzuraCast's nested JSON into the flat shapes the UI consumes. Polling
// lives in nowplaying.svelte.ts. Nothing in this file is station-specific —
// the base URL and shortcode come from widget config, so the same code drives
// WVVY and any other AzuraCast install.

/** Strip trailing slashes so `${base}/api/...` never doubles up. */
export function normalizeBase(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export function nowPlayingUrl(base: string, shortcode: string): string {
  return `${normalizeBase(base)}/api/station/${encodeURIComponent(shortcode)}/nowplaying`;
}

export function scheduleUrl(base: string, shortcode: string): string {
  return `${normalizeBase(base)}/api/station/${encodeURIComponent(shortcode)}/schedule`;
}

export type Track = {
  artist: string;
  title: string;
  album?: string;
  art?: string;
  /** Epoch seconds (UTC) the track started, when AzuraCast reports it. */
  playedAt?: number;
};

export type NowPlayingData = {
  nowPlaying: Track;
  playingNext: Track | null;
  history: Track[];
  /** A live DJ (Web DJ / streamer) connected via the harbor input. */
  live: { isLive: boolean; streamer: string };
  /** Current listener count, or null when the station hides it. */
  listeners: number | null;
  bitrate: number | null;
  format: string | null;
  /** Default mount URL as reported by the station — used when no explicit stream override is set. */
  streamUrl: string | null;
  /** Station display name and description straight from AzuraCast. */
  stationName: string;
  stationDescription: string;
  /** Position within the current track, in seconds. */
  elapsed: number;
  duration: number;
};

export type ScheduleEntry = {
  name: string;
  /** Presenter / DJ, when the station fills it in. */
  presenter: string;
  /** Local start time formatted by AzuraCast, e.g. "7:30 PM". */
  start: string;
  isNow: boolean;
};

// AzuraCast's responses are loosely typed here — we read defensively and fall
// back to safe defaults so a shape change upstream degrades gracefully rather
// than throwing during render.
type RawSong = { artist?: string; title?: string; album?: string; art?: string; text?: string };
type RawNowPlaying = { song?: RawSong; played_at?: number; elapsed?: number; duration?: number };
type RawHistoryEntry = { played_at?: number; song?: RawSong };
type RawMount = { bitrate?: number; format?: string; is_default?: boolean; url?: string };
type RawStation = { name?: string; description?: string; listen_url?: string; mounts?: RawMount[] };
type RawResponse = {
  station?: RawStation;
  listeners?: { current?: number; unique?: number; total?: number };
  live?: { is_live?: boolean; streamer_name?: string };
  now_playing?: RawNowPlaying;
  playing_next?: RawNowPlaying | null;
  song_history?: RawHistoryEntry[];
};

function mapSong(song: RawSong | undefined, playedAt?: number): Track {
  return {
    artist: song?.artist?.trim() ?? '',
    title: song?.title?.trim() ?? '',
    album: song?.album?.trim() || undefined,
    art: song?.art || undefined,
    playedAt
  };
}

export function parseNowPlaying(raw: RawResponse): NowPlayingData {
  const mount = raw.station?.mounts?.find((m) => m.is_default) ?? raw.station?.mounts?.[0];
  // `listeners.current` is absent when the station disables public listener
  // counts. Distinguish that (null → hide the readout) from a genuine zero.
  const current = raw.listeners?.current ?? raw.listeners?.total;
  return {
    nowPlaying: mapSong(raw.now_playing?.song, raw.now_playing?.played_at),
    playingNext: raw.playing_next?.song ? mapSong(raw.playing_next.song) : null,
    history: (raw.song_history ?? []).map((h) => mapSong(h.song, h.played_at)),
    live: {
      isLive: raw.live?.is_live ?? false,
      streamer: raw.live?.streamer_name?.trim() ?? ''
    },
    listeners: typeof current === 'number' && Number.isFinite(current) ? current : null,
    bitrate: mount?.bitrate ?? null,
    format: mount?.format ?? null,
    streamUrl: raw.station?.listen_url || mount?.url || null,
    stationName: raw.station?.name?.trim() ?? '',
    stationDescription: raw.station?.description?.trim() ?? '',
    elapsed: raw.now_playing?.elapsed ?? 0,
    duration: raw.now_playing?.duration ?? 0
  };
}

type RawScheduleEntry = {
  name?: string;
  title?: string;
  start?: string;
  start_timestamp?: number;
  is_now?: boolean;
  streamer?: string;
  playlist?: string;
};

// AzuraCast's /schedule returns upcoming entries across several days. The card
// only has room for today, so filter to entries whose start timestamp falls on
// the viewer's current local date, and cap the list.
export function parseSchedule(raw: unknown, now = new Date(), limit = 3): ScheduleEntry[] {
  if (!Array.isArray(raw)) return [];
  const today = now.toDateString();
  const out: ScheduleEntry[] = [];
  for (const item of raw as RawScheduleEntry[]) {
    const name = (item?.name ?? item?.title ?? '').trim();
    if (!name) continue;
    const ts = item?.start_timestamp;
    if (typeof ts === 'number' && Number.isFinite(ts)) {
      if (new Date(ts * 1000).toDateString() !== today) continue;
    } else if (!item?.is_now) {
      // No timestamp and not flagged as current — we can't place it on a day,
      // so leave it out rather than showing tomorrow's show as today's.
      continue;
    }
    out.push({
      name,
      presenter: (item?.streamer ?? '').trim(),
      start: fmtScheduleTime(ts),
      isNow: item?.is_now === true
    });
    if (out.length >= limit) break;
  }
  return out;
}

/** Epoch seconds → "7:30 PM" in the viewer's local zone. Empty when unknown. */
function fmtScheduleTime(ts: number | undefined): string {
  if (typeof ts !== 'number' || !Number.isFinite(ts)) return '';
  const d = new Date(ts * 1000);
  const h = d.getHours();
  const m = d.getMinutes();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12} ${h < 12 ? 'AM' : 'PM'}` : `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

// A track counts as "real" once it has a title or artist — stations serve a
// blank payload before the backend reports its first song.
export function hasTrack(t: Track): boolean {
  return t.title.length > 0 || t.artist.length > 0;
}

/** "Artist · Title", collapsing gracefully when only one side is present. */
export function trackLine(t: Track | null | undefined): string {
  if (!t) return '';
  const a = t.artist.trim();
  const b = t.title.trim();
  if (a && b) return `${a} · ${b}`;
  return a || b;
}

/** M:SS for track-progress readouts. */
export function fmtDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
