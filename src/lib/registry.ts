import type { PlayerStore } from './player.svelte';

/**
 * Page-wide bookkeeping for mounted players.
 *
 * A host site can drop a bar in the header and a card in the sidebar; starting
 * one has to stop the others, or the visitor hears two copies of the same stream
 * a few seconds apart. Separately, only one player may own the OS media session
 * — otherwise a silent widget can clobber the lock screen of the audible one.
 *
 * This lives in a plain module rather than the `.svelte.ts` store because none
 * of it is reactive state: nothing here is ever read during render.
 */
const instances = new Set<PlayerStore>();
let mediaSessionOwner: PlayerStore | null = null;

export function register(player: PlayerStore): void {
  instances.add(player);
}

export function unregister(player: PlayerStore): void {
  instances.delete(player);
  if (mediaSessionOwner === player) mediaSessionOwner = null;
}

/** Every other mounted player — the ones to silence when `player` starts. */
export function siblings(player: PlayerStore): PlayerStore[] {
  return Array.from(instances).filter((other) => other !== player);
}

export function claimMediaSession(player: PlayerStore): void {
  mediaSessionOwner = player;
}

export function ownsMediaSession(player: PlayerStore): boolean {
  return mediaSessionOwner === player;
}

/** Test seam — drops every registered instance. */
export function reset(): void {
  instances.clear();
  mediaSessionOwner = null;
}
