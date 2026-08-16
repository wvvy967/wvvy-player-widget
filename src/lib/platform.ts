/**
 * iOS reserves media volume for the hardware buttons. It still lets JS read and
 * write `HTMLMediaElement.volume` — the value even sticks on read-back — but the
 * write has no audible effect, and the Web Audio GainNode workaround doesn't help
 * either (WebKit won't reroute a streaming <audio> element into the graph). The
 * limitation isn't observable via any property, so we key off the platform and
 * hide the slider rather than shipping a control that silently does nothing.
 */
export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ reports a desktop Safari UA; the touch-point count gives it away.
  return ua.includes('Macintosh') && typeof document !== 'undefined' && navigator.maxTouchPoints > 1;
}

export function canControlVolume(): boolean {
  return !isIos();
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
