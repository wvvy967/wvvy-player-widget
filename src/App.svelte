<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import BarPlayer from './components/BarPlayer.svelte';
  import CardPlayer from './components/CardPlayer.svelte';
  import { PlayerStore } from '@lib/player.svelte';
  import { NowPlayingStore } from '@lib/nowplaying.svelte';
  import { deriveStatus } from '@lib/status';
  import type { ResolvedConfig } from '@lib/config';

  let { config }: { config: ResolvedConfig } = $props();

  let root: HTMLDivElement;

  // Config is resolved once at mount and never mutates, so reading it here is
  // deliberately non-reactive — untrack keeps Svelte from warning about it.
  const feed = untrack(
    () =>
      new NowPlayingStore({
        station: config.station,
        shortcode: config.shortcode,
        pollIntervalMs: config.pollInterval * 1000,
        withSchedule: config.showSchedule && config.variant === 'card'
      })
  );

  // Resolved lazily rather than captured: the station's default mount isn't
  // known until the first poll lands, and a listener can press play before then.
  let stationName = $derived(config.name ?? (feed.data?.stationName || 'Live Radio'));

  const player = new PlayerStore({
    streamUrl: () => config.stream ?? feed.data?.streamUrl ?? null,
    stationName: () => stationName
  });

  let status = $derived(deriveStatus(player, feed));

  onMount(() => {
    feed.start();
    feed.observe(root);
    return () => {
      feed.stop();
      player.destroy();
    };
  });

  // Keep the OS media controls in step with the metadata feed. The store filters
  // repeats, so this firing on every poll is cheap.
  $effect(() => {
    player.updateNowPlaying(feed.data?.nowPlaying);
  });
</script>

<div bind:this={root} class="@container theme-{config.theme}" style={config.accent ? `--wvvy-accent:${config.accent}` : undefined}>
  {#if config.variant === 'card'}
    <CardPlayer {player} {feed} {config} {status} {stationName} />
  {:else}
    <BarPlayer {player} {feed} {config} {status} {stationName} />
  {/if}
</div>
