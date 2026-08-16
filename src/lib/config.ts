import type { PlayerWidgetConfig, Variant, Theme, FontMode } from '@/types';

/**
 * Defaults. The station points at WVVY because that's who ships this, but every
 * value is overridable — nothing below is load-bearing for other AzuraCast installs.
 */
export const CONFIG_DEFAULTS = {
  station: 'https://radio.wvvy.org',
  shortcode: 'wvvy',
  variant: 'bar' as Variant,
  theme: 'brutalist' as Theme,
  linkLabel: 'Full player and schedule →',
  showDial: true,
  showSchedule: true,
  // Off by default: a low listener count on a community station reads as
  // "nobody's here" to a first-time visitor, so it's opt-in per embed.
  showListeners: false,
  showVolume: true,
  pollInterval: 20,
  fonts: 'auto' as FontMode
} as const;

/** Poll floor. Below this the widget is just hammering someone else's server. */
const MIN_POLL_SECONDS = 10;

const VARIANTS: Variant[] = ['bar', 'card'];
const THEMES: Theme[] = ['brutalist', 'modern'];
const FONT_MODES: FontMode[] = ['auto', 'none'];

function warn(msg: string): void {
  console.warn(`[wvvy-player-widget] ${msg}`);
}

/** Accept a value only when it's one of the known options; otherwise warn and fall back. */
function oneOf<T extends string>(name: string, value: unknown, allowed: T[], fallback: T): T {
  if (value == null || value === '') return fallback;
  const v = String(value).trim().toLowerCase() as T;
  if (allowed.includes(v)) return v;
  warn(`${name}="${String(value)}" is not one of ${allowed.join(' | ')} — using "${fallback}".`);
  return fallback;
}

/** `data-*` attributes arrive as strings; treat presence-without-value as true. */
export function validBoolean(name: string, value: unknown, fallback: boolean): boolean {
  if (value == null) return fallback;
  if (typeof value === 'boolean') return value;
  const v = String(value).trim().toLowerCase();
  if (v === '' || v === 'true' || v === '1' || v === 'yes') return true;
  if (v === 'false' || v === '0' || v === 'no') return false;
  warn(`${name}="${String(value)}" is not a boolean — using ${fallback}.`);
  return fallback;
}

export function validPollInterval(value: unknown, fallback: number): number {
  if (value == null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    warn(`pollInterval="${String(value)}" is not a positive number — using ${fallback}s.`);
    return fallback;
  }
  if (n < MIN_POLL_SECONDS) {
    warn(`pollInterval=${n}s is below the ${MIN_POLL_SECONDS}s floor — using ${MIN_POLL_SECONDS}s.`);
    return MIN_POLL_SECONDS;
  }
  return n;
}

/**
 * Only http(s) URLs are allowed through. This blocks `javascript:` and `data:`
 * URLs reaching an `href` or an `<audio src>` — the widget takes its config from
 * host-page markup, and on a CMS that markup may be author-editable by someone
 * who shouldn't get script execution for free.
 */
export function validUrl(name: string, value: unknown): string | undefined {
  if (value == null || value === '') return undefined;
  const raw = String(value).trim();
  let parsed: URL;
  try {
    parsed = new URL(raw, typeof window === 'undefined' ? 'https://localhost' : window.location.href);
  } catch {
    warn(`${name}="${raw}" is not a valid URL — ignoring.`);
    return undefined;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    warn(`${name} must be an http(s) URL — ignoring "${raw}".`);
    return undefined;
  }
  return parsed.href;
}

/**
 * Accent is interpolated into a CSS custom property, so it must not be able to
 * close the declaration and inject further rules. Reject anything with the
 * punctuation needed to break out.
 */
export function validColor(name: string, value: unknown): string | undefined {
  if (value == null || value === '') return undefined;
  const raw = String(value).trim();
  if (/[;{}<>()\\]/.test(raw) || raw.length > 64) {
    warn(`${name}="${raw}" is not a usable CSS colour — ignoring.`);
    return undefined;
  }
  return raw;
}

function text(value: unknown): string | undefined {
  if (value == null) return undefined;
  const v = String(value).trim();
  return v === '' ? undefined : v;
}

export type ResolvedConfig = Required<
  Pick<PlayerWidgetConfig, 'station' | 'shortcode' | 'variant' | 'theme' | 'linkLabel' | 'showDial' | 'showSchedule' | 'showListeners' | 'showVolume' | 'pollInterval' | 'fonts'>
> &
  Pick<PlayerWidgetConfig, 'accent' | 'stream' | 'name' | 'tagline' | 'description' | 'frequency' | 'location' | 'link' | 'assetBase' | 'scheduleUrl'>;

/** Normalise raw config (from `data-*` attributes or a JS object) into resolved, validated values. */
export function resolveConfig(input: PlayerWidgetConfig = {}): ResolvedConfig {
  return {
    station: validUrl('station', input.station) ?? CONFIG_DEFAULTS.station,
    shortcode: text(input.shortcode) ?? CONFIG_DEFAULTS.shortcode,
    variant: oneOf('variant', input.variant, VARIANTS, CONFIG_DEFAULTS.variant),
    theme: oneOf('theme', input.theme, THEMES, CONFIG_DEFAULTS.theme),
    accent: validColor('accent', input.accent),
    stream: validUrl('stream', input.stream),
    name: text(input.name),
    tagline: text(input.tagline),
    description: text(input.description),
    frequency: text(input.frequency),
    location: text(input.location),
    link: validUrl('link', input.link),
    scheduleUrl: validUrl('scheduleUrl', input.scheduleUrl),
    linkLabel: text(input.linkLabel) ?? CONFIG_DEFAULTS.linkLabel,
    showDial: validBoolean('showDial', input.showDial, CONFIG_DEFAULTS.showDial),
    showSchedule: validBoolean('showSchedule', input.showSchedule, CONFIG_DEFAULTS.showSchedule),
    showListeners: validBoolean('showListeners', input.showListeners, CONFIG_DEFAULTS.showListeners),
    showVolume: validBoolean('showVolume', input.showVolume, CONFIG_DEFAULTS.showVolume),
    pollInterval: validPollInterval(input.pollInterval, CONFIG_DEFAULTS.pollInterval),
    fonts: oneOf('fonts', input.fonts, FONT_MODES, CONFIG_DEFAULTS.fonts),
    assetBase: text(input.assetBase)
  };
}

/** `data-show-listeners` → `showListeners`. */
function camel(attr: string): string {
  return attr.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

/** Read every `data-*` attribute off the host element into a raw config object. */
export function configFromDataset(el: HTMLElement): PlayerWidgetConfig {
  const out: Record<string, string> = {};
  for (const { name, value } of Array.from(el.attributes)) {
    if (!name.startsWith('data-')) continue;
    out[camel(name.slice(5))] = value;
  }
  return out as PlayerWidgetConfig;
}
