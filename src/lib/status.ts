import type { NowPlayingStore } from './nowplaying.svelte';
import type { PlayerStore } from './player.svelte';

export type Status = 'offline' | 'off-air' | 'on-air' | 'standby';

/**
 * The status shown is the *station's*, not our playback's — a visitor who hasn't
 * pressed play should still see "ON AIR" when the station is broadcasting.
 *
 * `player.isPlaying` outranks the feed in both directions: if audio is flowing
 * the station is live regardless of what a stale metadata poll claims, and we
 * never claim "off air" before the feed has resolved even once.
 */
export function deriveStatus(player: Pick<PlayerStore, 'isPlaying' | 'online'>, feed: Pick<NowPlayingStore, 'online' | 'polled'>): Status {
  if (!player.online) return 'offline';
  if (player.isPlaying) return 'on-air';
  if (feed.online) return 'on-air';
  if (feed.polled) return 'off-air';
  return 'standby';
}

export function statusLabel(status: Status): string {
  switch (status) {
    case 'offline':
      return 'Offline';
    case 'off-air':
      return 'Off Air';
    case 'on-air':
      return 'On Air';
    default:
      return 'Standby';
  }
}

/** Token name for the status colour, resolved to a Tailwind class by the caller. */
export function statusTone(status: Status): 'warn' | 'live' | 'muted' {
  if (status === 'offline') return 'warn';
  if (status === 'off-air') return 'warn';
  if (status === 'on-air') return 'live';
  return 'muted';
}
