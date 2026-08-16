import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mountPlayer } from '@lib/mount';
import { reset as resetRegistry } from '@lib/registry';
import type { PlayerWidgetConfig } from '@/types';

// Renders the real widget end-to-end against a stubbed AzuraCast, so the
// component templates are exercised the way a host page would exercise them.

type Scenario = { nowplaying?: unknown; schedule?: unknown; nowplayingStatus?: number };

function stubStation(s: Scenario) {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = String(input);
    if (url.includes('/schedule')) return Promise.resolve(new Response(JSON.stringify(s.schedule ?? []), { status: 200 }));
    if (s.nowplayingStatus && s.nowplayingStatus >= 400) return Promise.resolve(new Response('err', { status: s.nowplayingStatus }));
    return Promise.resolve(new Response(JSON.stringify(s.nowplaying ?? {}), { status: 200 }));
  });
}

const settle = () => new Promise((r) => setTimeout(r, 0));

async function render(config: PlayerWidgetConfig) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const w = mountPlayer(el, { fonts: 'none', ...config });
  await settle();
  await settle();
  return { el, w, text: () => el.shadowRoot?.textContent ?? '', root: () => el.shadowRoot! };
}

beforeEach(() => {
  resetRegistry();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  resetRegistry();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

const LIVE_TRACK = {
  station: { name: 'WVVY 96.7', description: 'No format. No playlist.', mounts: [{ is_default: true, url: 'https://radio.test/listen' }] },
  listeners: { current: 7 },
  now_playing: { song: { artist: 'The Blasters', title: 'I Wish You Would' } },
  live: { is_live: false }
};

describe('bar variant', () => {
  it('shows the status strip and the current track', async () => {
    stubStation({ nowplaying: LIVE_TRACK });
    const { text, w } = await render({ variant: 'bar', name: 'WVVY-LP', frequency: '96.7', tagline: 'Island Radio' });
    expect(text()).toContain('On Air · WVVY-LP 96.7 · Island Radio');
    expect(text()).toContain('The Blasters · I Wish You Would');
    w.destroy();
  });

  // During a live set AzuraCast usually reports a blank song; showing "—" there
  // would read as a broken widget.
  it('names the live DJ instead of showing empty track metadata', async () => {
    stubStation({ nowplaying: { live: { is_live: true, streamer_name: 'DJ Allen' } } });
    const { text, w } = await render({ variant: 'bar' });
    expect(text()).toContain('Live · DJ Allen');
    w.destroy();
  });

  it('says the station is off air once the feed reports nothing playing', async () => {
    stubStation({ nowplaying: { live: { is_live: false } } });
    const { text, w } = await render({ variant: 'bar' });
    expect(text()).toContain('Off Air');
    expect(text()).toContain('Off air right now');
    w.destroy();
  });

  it('omits the link button when no link is configured', async () => {
    stubStation({ nowplaying: LIVE_TRACK });
    const { root, w } = await render({ variant: 'bar' });
    expect(root().querySelector('a')).toBeNull();
    w.destroy();
  });

  it('renders the link with rel=noopener when one is configured', async () => {
    stubStation({ nowplaying: LIVE_TRACK });
    const { root, w } = await render({ variant: 'bar', link: 'https://wvvy.org', linkLabel: 'Listen live' });
    const a = root().querySelector('a')!;
    expect(a.getAttribute('href')).toBe('https://wvvy.org/');
    expect(a.getAttribute('rel')).toBe('noopener');
    expect(a.textContent?.trim()).toBe('Listen live');
    w.destroy();
  });
});

describe('card variant', () => {
  it('renders header, dial, description, and listener count', async () => {
    stubStation({ nowplaying: LIVE_TRACK });
    const { text, root, w } = await render({ variant: 'card', name: 'WVVY-LP', frequency: '96.7', location: "Tisbury · Martha's Vineyard · 100W" });
    expect(text()).toContain('WVVY-LP');
    expect(text()).toContain("Tisbury · Martha's Vineyard · 100W");
    expect(text()).toContain('No format. No playlist.');
    expect(text()).toContain('7 listening');
    expect(text()).toContain('96.7 MHz · Press play for the live stream');
    // Dial band labels are rendered only when a frequency is set.
    expect(root().textContent).toContain('108');
    w.destroy();
  });

  it('hides the dial when the station has no frequency', async () => {
    stubStation({ nowplaying: LIVE_TRACK });
    const { text, w } = await render({ variant: 'card' });
    expect(text()).not.toContain('108');
    w.destroy();
  });

  it('hides the listener count when the station does not publish one', async () => {
    stubStation({ nowplaying: { ...LIVE_TRACK, listeners: undefined } });
    const { text, w } = await render({ variant: 'card' });
    expect(text()).not.toContain('listening');
    w.destroy();
  });

  it('respects showListeners=false even when a count is available', async () => {
    stubStation({ nowplaying: LIVE_TRACK });
    const { text, w } = await render({ variant: 'card', showListeners: false });
    expect(text()).not.toContain('7 listening');
    w.destroy();
  });

  it("renders today's schedule when the station publishes one", async () => {
    const today = new Date();
    const at = (h: number) => Math.floor(new Date(today.getFullYear(), today.getMonth(), today.getDate(), h).getTime() / 1000);
    stubStation({
      nowplaying: LIVE_TRACK,
      schedule: [
        { name: 'Sunday Sessions', start_timestamp: at(12), streamer: 'DJ Ricky Prime' },
        { name: 'Open Yer Ears', start_timestamp: at(19), streamer: 'DJ Allen' }
      ]
    });
    const { text, w } = await render({ variant: 'card' });
    expect(text()).toContain('Sunday Sessions');
    expect(text()).toContain('DJ Ricky Prime');
    expect(text()).toContain('Open Yer Ears');
    w.destroy();
  });

  it('hides the schedule strip entirely when the station publishes none', async () => {
    stubStation({ nowplaying: LIVE_TRACK, schedule: [] });
    const { text, w } = await render({ variant: 'card' });
    expect(text()).not.toContain('Today');
    w.destroy();
  });
});

describe('degraded states', () => {
  it('still renders a usable player when the metadata feed is down', async () => {
    stubStation({ nowplayingStatus: 500 });
    const { root, w } = await render({ variant: 'card', name: 'WVVY-LP' });
    // The audio is independent of the metadata feed, so play must stay available.
    expect(root().querySelector('button')).not.toBeNull();
    expect(root().textContent).toContain('WVVY-LP');
    w.destroy();
  });

  it('labels the play button for assistive tech', async () => {
    stubStation({ nowplaying: LIVE_TRACK });
    const { root, w } = await render({ variant: 'bar', name: 'WVVY-LP' });
    const btn = root().querySelector('button')!;
    expect(btn.getAttribute('aria-label')).toBe('Play WVVY-LP');
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    w.destroy();
  });

  it('announces track changes politely rather than interrupting', async () => {
    stubStation({ nowplaying: LIVE_TRACK });
    const { root, w } = await render({ variant: 'card' });
    expect(root().querySelector('[aria-live="polite"]')).not.toBeNull();
    w.destroy();
  });
});

describe('theming', () => {
  it('passes an accent override through as a custom property', async () => {
    stubStation({ nowplaying: LIVE_TRACK });
    const { root, w } = await render({ variant: 'bar', accent: '#f0a500' });
    const wrapper = root().querySelector('.theme-brutalist') as HTMLElement;
    expect(wrapper.style.getPropertyValue('--wvvy-accent')).toBe('#f0a500');
    w.destroy();
  });

  it('drops an accent that tries to break out of the style attribute', async () => {
    stubStation({ nowplaying: LIVE_TRACK });
    const { root, w } = await render({ variant: 'bar', accent: 'red;background:url(evil)' });
    const wrapper = root().querySelector('.theme-brutalist') as HTMLElement;
    expect(wrapper.getAttribute('style')).toBeNull();
    w.destroy();
  });
});
