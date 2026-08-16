import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveConfig, configFromDataset, validBoolean, validPollInterval, validUrl, validColor, CONFIG_DEFAULTS } from '@lib/config';

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('validUrl', () => {
  it('accepts http and https', () => {
    expect(validUrl('link', 'https://wvvy.org/')).toBe('https://wvvy.org/');
    expect(validUrl('link', 'http://example.test/')).toBe('http://example.test/');
  });

  // The widget reads config out of host-page markup, which on a CMS may be
  // editable by someone who shouldn't get script execution for free.
  it('rejects javascript: and data: URLs', () => {
    expect(validUrl('link', 'javascript:alert(1)')).toBeUndefined();
    expect(validUrl('link', 'data:text/html,<script>alert(1)</script>')).toBeUndefined();
  });

  it('rejects unparseable values', () => {
    expect(validUrl('link', 'http://[bad')).toBeUndefined();
  });

  it('treats empty as unset', () => {
    expect(validUrl('link', '')).toBeUndefined();
    expect(validUrl('link', null)).toBeUndefined();
  });
});

describe('validColor', () => {
  it('passes ordinary CSS colours through', () => {
    expect(validColor('accent', '#c4ff3d')).toBe('#c4ff3d');
    expect(validColor('accent', 'rebeccapurple')).toBe('rebeccapurple');
  });

  // The accent lands in a style attribute, so it must not be able to close the
  // declaration and append rules.
  it('rejects values that could break out of the declaration', () => {
    expect(validColor('accent', 'red;background:url(x)')).toBeUndefined();
    expect(validColor('accent', 'red}body{display:none')).toBeUndefined();
    expect(validColor('accent', 'a'.repeat(80))).toBeUndefined();
  });
});

describe('validBoolean', () => {
  it('reads the usual truthy and falsy spellings', () => {
    for (const v of ['true', '1', 'yes', '']) expect(validBoolean('x', v, false)).toBe(true);
    for (const v of ['false', '0', 'no']) expect(validBoolean('x', v, true)).toBe(false);
  });

  it('falls back and warns on nonsense', () => {
    expect(validBoolean('x', 'maybe', true)).toBe(true);
    expect(console.warn).toHaveBeenCalled();
  });
});

describe('validPollInterval', () => {
  it('enforces the 10s floor so the widget cannot hammer a station', () => {
    expect(validPollInterval(2, 20)).toBe(10);
    expect(validPollInterval(30, 20)).toBe(30);
  });

  it('falls back on non-numeric or non-positive input', () => {
    expect(validPollInterval('soon', 20)).toBe(20);
    expect(validPollInterval(-5, 20)).toBe(20);
    expect(validPollInterval('', 20)).toBe(20);
  });
});

describe('resolveConfig', () => {
  it('defaults to WVVY with a bar in the brutalist theme', () => {
    const c = resolveConfig();
    expect(c.station).toBe(CONFIG_DEFAULTS.station);
    expect(c.shortcode).toBe('wvvy');
    expect(c.variant).toBe('bar');
    expect(c.theme).toBe('brutalist');
    expect(c.pollInterval).toBe(20);
  });

  it('falls back on unknown enum values rather than rendering nothing', () => {
    const c = resolveConfig({ variant: 'hologram' as never, theme: 'neon' as never });
    expect(c.variant).toBe('bar');
    expect(c.theme).toBe('brutalist');
  });

  it('normalises case for enums', () => {
    expect(resolveConfig({ variant: 'CARD' as never }).variant).toBe('card');
  });

  it('keeps an explicit stream override', () => {
    expect(resolveConfig({ stream: 'https://radio.test/listen' }).stream).toBe('https://radio.test/listen');
  });
});

describe('configFromDataset', () => {
  it('converts data-* attributes to camelCase keys', () => {
    const el = document.createElement('div');
    el.setAttribute('data-variant', 'card');
    el.setAttribute('data-show-listeners', 'false');
    el.setAttribute('data-poll-interval', '45');
    el.setAttribute('class', 'ignored');
    expect(configFromDataset(el)).toEqual({ variant: 'card', showListeners: 'false', pollInterval: '45' });
  });

  it('round-trips through resolveConfig', () => {
    const el = document.createElement('div');
    el.setAttribute('data-show-listeners', 'false');
    el.setAttribute('data-poll-interval', '45');
    const c = resolveConfig(configFromDataset(el));
    expect(c.showListeners).toBe(false);
    expect(c.pollInterval).toBe(45);
  });
});
