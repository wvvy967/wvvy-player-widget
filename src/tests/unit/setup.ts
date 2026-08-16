import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// jsdom ships neither of these, and the widget touches both on mount.
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }));
}

if (!('IntersectionObserver' in window)) {
  class MockIntersectionObserver implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = '';
    readonly thresholds: ReadonlyArray<number> = [];
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    takeRecords = vi.fn(() => []);
  }
  // `in` narrowing leaves `window` as never in this branch, hence the cast.
  (window as unknown as Record<string, unknown>).IntersectionObserver = MockIntersectionObserver;
}

// jsdom implements neither, and the widget writes lock-screen metadata through
// both. Stubbing them here keeps that path testable instead of short-circuited.
if (!('mediaSession' in navigator)) {
  Object.defineProperty(navigator, 'mediaSession', {
    configurable: true,
    value: { metadata: null, playbackState: 'none', setActionHandler: vi.fn() }
  });
}
if (!('MediaMetadata' in globalThis)) {
  (globalThis as unknown as Record<string, unknown>).MediaMetadata = class {
    title: string;
    artist: string;
    album: string;
    artwork: unknown[];
    constructor(init: { title?: string; artist?: string; album?: string; artwork?: unknown[] } = {}) {
      this.title = init.title ?? '';
      this.artist = init.artist ?? '';
      this.album = init.album ?? '';
      this.artwork = init.artwork ?? [];
    }
  };
}

// jsdom's HTMLMediaElement throws "not implemented" on play/load/pause.
Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: vi.fn().mockResolvedValue(undefined) });
Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: vi.fn() });
Object.defineProperty(HTMLMediaElement.prototype, 'load', { configurable: true, value: vi.fn() });
