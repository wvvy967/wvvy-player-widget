import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mountPlayer } from '@lib/mount';
import { reset as resetRegistry } from '@lib/registry';

const payload = {
  station: { name: 'Test Radio', description: 'A station', mounts: [{ is_default: true, url: 'https://radio.test/listen' }] },
  listeners: { current: 4 },
  now_playing: { song: { artist: 'The Blasters', title: 'I Wish You Would' } },
  live: { is_live: false }
};

beforeEach(() => {
  resetRegistry();
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = String(input);
    return Promise.resolve(url.includes('/schedule') ? new Response('[]', { status: 200 }) : new Response(JSON.stringify(payload), { status: 200 }));
  });
});

afterEach(() => {
  resetRegistry();
  vi.restoreAllMocks();
  document.body.replaceChildren();
  document.getElementById('wvvy-player-widget-fonts')?.remove();
});

function host() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

/** Wait for the microtask queue plus a tick so Svelte flushes and fetches settle. */
const settle = () => new Promise((r) => setTimeout(r, 0));

describe('mountPlayer', () => {
  it('renders into a shadow root, leaving the host page DOM untouched', async () => {
    const el = host();
    el.textContent = 'fallback content';
    const w = mountPlayer(el, { fonts: 'none' });
    await settle();

    expect(el.shadowRoot).not.toBeNull();
    expect(el.shadowRoot!.querySelector('button')).not.toBeNull();
    // The widget's markup must not be reachable from the light DOM.
    expect(el.querySelector('button')).toBeNull();
    w.destroy();
  });

  it('applies the theme class inside the shadow root rather than mutating the host element', async () => {
    const el = host();
    const w = mountPlayer(el, { theme: 'modern', fonts: 'none' });
    await settle();

    expect(el.shadowRoot!.querySelector('.theme-modern')).not.toBeNull();
    expect(el.className).toBe('');
    expect(el.getAttribute('data-theme')).toBeNull();
    w.destroy();
  });

  it('renders the card variant with now-playing metadata from the API', async () => {
    const el = host();
    const w = mountPlayer(el, { variant: 'card', frequency: '96.7', fonts: 'none' });
    await settle();
    await settle();

    const text = el.shadowRoot!.textContent ?? '';
    expect(text).toContain('The Blasters · I Wish You Would');
    expect(text).toContain('4 listening');
    w.destroy();
  });

  it('refuses to mount twice over a live widget instead of leaking the first', async () => {
    const el = host();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const a = mountPlayer(el, { fonts: 'none' });
    await settle();
    const b = mountPlayer(el, { fonts: 'none' });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('already has a mounted widget'));
    b.destroy();
    a.destroy();
  });

  it('clears the shadow root on destroy', async () => {
    const el = host();
    const w = mountPlayer(el, { fonts: 'none' });
    await settle();
    w.destroy();
    expect(el.shadowRoot!.childElementCount).toBe(0);
  });

  it('injects font faces into the host document, since @font-face is ignored inside a shadow root', async () => {
    const el = host();
    const w = mountPlayer(el, { fonts: 'auto', assetBase: 'https://cdn.test/widget' });
    await settle();

    const style = document.getElementById('wvvy-player-widget-fonts');
    expect(style).not.toBeNull();
    expect(style!.textContent).toContain("src:url('https://cdn.test/widget/fonts/jetbrains-mono-latin-400.woff2')");
    w.destroy();
  });

  it('makes no font request when fonts are disabled', async () => {
    const el = host();
    const w = mountPlayer(el, { fonts: 'none' });
    await settle();
    expect(document.getElementById('wvvy-player-widget-fonts')).toBeNull();
    w.destroy();
  });
});
