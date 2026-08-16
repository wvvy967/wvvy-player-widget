import { describe, it, expect } from 'vitest';
import { deriveStatus, statusLabel, statusTone } from '@lib/status';

const player = (isPlaying: boolean, online = true) => ({ isPlaying, online });
const feed = (online: boolean, polled: boolean) => ({ online, polled });

describe('deriveStatus', () => {
  it('reports offline above everything else', () => {
    expect(deriveStatus(player(true, false), feed(true, true))).toBe('offline');
  });

  // If audio is flowing, the station is live regardless of what a stale poll says.
  it('trusts playback over a stale feed', () => {
    expect(deriveStatus(player(true), feed(false, true))).toBe('on-air');
  });

  it('shows the station on air before the visitor presses play', () => {
    expect(deriveStatus(player(false), feed(true, true))).toBe('on-air');
  });

  // Claiming "off air" before the first response would flash a false alarm on
  // every page load.
  it('waits for the first poll before claiming off air', () => {
    expect(deriveStatus(player(false), feed(false, false))).toBe('standby');
    expect(deriveStatus(player(false), feed(false, true))).toBe('off-air');
  });
});

describe('labels', () => {
  it('maps each status to copy and a colour tone', () => {
    expect(statusLabel('on-air')).toBe('On Air');
    expect(statusLabel('off-air')).toBe('Off Air');
    expect(statusLabel('offline')).toBe('Offline');
    expect(statusLabel('standby')).toBe('Standby');
    expect(statusTone('on-air')).toBe('live');
    expect(statusTone('standby')).toBe('muted');
    expect(statusTone('offline')).toBe('warn');
  });
});
