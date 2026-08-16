/**
 * Public configuration for the WVVY player widget.
 *
 * Every field is optional except `station`. Values map 1:1 to the `data-*`
 * attributes accepted by the drop-in script bundle — `data-station` →
 * `station`, `data-show-listeners` → `showListeners`, and so on.
 */
export interface PlayerWidgetConfig {
  /**
   * Base URL of the AzuraCast install, e.g. `https://radio.wvvy.org`.
   * Trailing slashes are trimmed.
   */
  station?: string;
  /** Station shortcode within that install, e.g. `wvvy`. Defaults to `wvvy`. */
  shortcode?: string;
  /** Layout. `bar` is a single-line strip; `card` is the full console. */
  variant?: Variant;
  /** Visual theme. `brutalist` matches wvvy.org; `modern` is the softer dark card. */
  theme?: Theme;
  /**
   * Accent colour override (any CSS colour). Drives the play button, on-air
   * dot, EQ bars, and dial needle.
   */
  accent?: string;
  /**
   * Explicit stream URL. When omitted the widget uses the station's default
   * mount as reported by the now-playing API.
   */
  stream?: string;
  /** Station display name — the card's header and the bar's status strip. Defaults to the name AzuraCast reports. */
  name?: string;
  /** Headline beside the card's play button, e.g. `Martha's Vineyard Community Radio`. Defaults to the AzuraCast station name. */
  tagline?: string;
  /** Small line under that headline. Defaults to the AzuraCast station description. */
  description?: string;
  /** Broadcast frequency, e.g. `96.7`. Shown on the dial and in the bar's status line. */
  frequency?: string;
  /** Location line on the card, e.g. `Tisbury · Martha's Vineyard · 100W`. */
  location?: string;
  /** Target for the widget's outbound link. Omit to hide the link entirely. */
  link?: string;
  /** Label for that link. Defaults to `Full player and schedule →`. */
  linkLabel?: string;
  /** Show the FM dial on the card. Default true. */
  showDial?: boolean;
  /** Show today's schedule strip on the card. Default true; hides itself when the station has no schedule. */
  showSchedule?: boolean;
  /** Show the live listener count. Default false — opt in per embed. Hides itself anyway when the station doesn't publish one. */
  showListeners?: boolean;
  /** Show the volume slider. Default true (always hidden on iOS, which reserves volume for hardware buttons). */
  showVolume?: boolean;
  /** Metadata poll interval in seconds. Clamped to a 10s floor. Default 20. */
  pollInterval?: number;
  /**
   * Web font loading. `auto` injects self-hosted @font-face rules into the host
   * document; `none` falls back to system fonts and makes zero extra requests.
   */
  fonts?: FontMode;
  /** Base URL the widget's own assets (fonts) are served from. Auto-detected from the script tag. */
  assetBase?: string;
}

export type Variant = 'bar' | 'card';
export type Theme = 'brutalist' | 'modern';
export type FontMode = 'auto' | 'none';

/** Returned by `mountPlayerWidget`. Keep a reference to tear the widget down. */
export interface WidgetHandle {
  /** Remove the widget, stop polling, and release the audio element. */
  destroy(): void;
}
