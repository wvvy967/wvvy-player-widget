<script lang="ts">
  import PlayButton from './PlayButton.svelte';
  import OnAirDot from './OnAirDot.svelte';
  import Equalizer from './Equalizer.svelte';
  import type { PlayerStore } from '@lib/player.svelte';
  import type { NowPlayingStore } from '@lib/nowplaying.svelte';
  import type { ResolvedConfig } from '@lib/config';
  import { trackLine } from '@lib/azuracast';
  import { statusLabel, type Status } from '@lib/status';

  let { player, feed, config, status, stationName }: { player: PlayerStore; feed: NowPlayingStore; config: ResolvedConfig; status: Status; stationName: string } = $props();

  let track = $derived(trackLine(feed.data?.nowPlaying));
  let liveDj = $derived(feed.data?.live.isLive ? feed.data.live.streamer : '');

  // The status strip reads "ON AIR · WVVY-LP 96.7 · ISLAND RADIO". Each piece is
  // optional, so build the list and join what survives rather than hardcoding
  // separators that would leave stray dots for a minimally configured station.
  let strip = $derived([statusLabel(status), config.frequency ? `${stationName} ${config.frequency}` : stationName, config.tagline].filter(Boolean).join(' · '));

  // What the second line says. A live DJ outranks track metadata: during a live
  // set AzuraCast usually reports a blank song, and "—" would read as broken.
  let headline = $derived.by(() => {
    if (status === 'offline') return 'No network connection';
    if (player.error && player.error !== 'reconnecting…') return player.error;
    if (player.error === 'reconnecting…') return 'Reconnecting…';
    if (liveDj) return `Live · ${liveDj}`;
    if (track) return track;
    if (status === 'off-air') return 'Off air right now';
    return stationName;
  });
</script>

<div class="surface bg-ink scanlines relative overflow-hidden">
  <div class="flex items-center gap-4 px-4 py-3.5 @[420px]:gap-5 @[420px]:px-6 @[420px]:py-4">
    <PlayButton {player} size="md" label={stationName} />

    <div class="min-w-0 flex-1">
      <div class="text-muted t-label flex items-center gap-2 text-[10px] @[420px]:text-[11px]">
        <OnAirDot {status} size={7} />
        <span class="truncate">{strip}</span>
      </div>
      <div class="t-display text-bone mt-1 truncate text-[15px] @[420px]:text-lg" title={headline}>
        {headline}
      </div>
    </div>

    {#if player.isPlaying}
      <div class="hidden shrink-0 @[560px]:block">
        <Equalizer active={true} bars={5} height={18} />
      </div>
    {/if}

    {#if config.link}
      <a
        href={config.link}
        target="_blank"
        rel="noopener"
        class="border-accent text-accent hover:bg-accent hover:text-accent-ink hidden shrink-0 border px-4 py-2 text-[13px] font-bold whitespace-nowrap transition-colors @[640px]:inline-block"
        style="border-radius:calc(var(--wvvy-radius) * 2);"
      >
        {config.linkLabel}
      </a>
    {/if}
  </div>
</div>
