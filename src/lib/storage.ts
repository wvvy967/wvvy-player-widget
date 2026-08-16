// localStorage access that can't take the widget down. Embedded in someone
// else's page we may be inside a sandboxed iframe, a Safari private window, or
// a site where storage is blocked outright — every one of those throws on
// access rather than returning null.

const VOLUME_KEY = 'wvvy-widget:volume';

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage unavailable — volume just won't persist across loads.
  }
}

export function loadVolume(fallback = 0.85): number {
  const raw = safeGet(VOLUME_KEY);
  const n = raw == null ? NaN : Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : fallback;
}

export function saveVolume(v: number): void {
  safeSet(VOLUME_KEY, String(v));
}
