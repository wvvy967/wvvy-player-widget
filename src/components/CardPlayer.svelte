<script lang="ts">
  import PlayButton from './PlayButton.svelte';
  import OnAirDot from './OnAirDot.svelte';
  import Equalizer from './Equalizer.svelte';
  import VolumeControl from './VolumeControl.svelte';
  import Dial from './Dial.svelte';
  import type { PlayerStore } from '@lib/player.svelte';
  import type { NowPlayingStore } from '@lib/nowplaying.svelte';
  import type { ResolvedConfig } from '@lib/config';
  import { trackLine } from '@lib/azuracast';
  import { statusLabel, type Status } from '@lib/status';

  let { player, feed, config, status, stationName }: { player: PlayerStore; feed: NowPlayingStore; config: ResolvedConfig; status: Status; stationName: string } = $props();

  let track = $derived(trackLine(feed.data?.nowPlaying));
  let art = $derived(feed.data?.nowPlaying.art);
  let liveDj = $derived(feed.data?.live.isLive ? feed.data.live.streamer : '');
  let listeners = $derived(feed.data?.listeners ?? null);
  let heading = $derived(config.tagline ?? feed.data?.stationName ?? stationName);
  let description = $derived(config.description ?? feed.data?.stationDescription ?? '');
  let schedule = $derived(feed.schedule);

  let hint = $derived.by(() => {
    if (status === 'offline') return 'No network connection';
    if (player.error === 'reconnecting…') return 'Reconnecting…';
    if (player.error) return player.error;
    if (status === 'off-air') return 'Off air right now';
    if (player.isPlaying) return `${config.frequency ? `${config.frequency} MHz · ` : ''}Streaming live`;
    return `${config.frequency ? `${config.frequency} MHz · ` : ''}Press play for the live stream`;
  });

  let nowLabel = $derived(liveDj ? 'On now' : feed.feedState === 'stale' ? 'Last known' : 'Now playing');
  let nowText = $derived(liveDj ? `Live · ${liveDj}` : track);
</script>

<div class="surface bg-ink scanlines relative overflow-hidden p-4 @[440px]:p-6">
  <!-- Header -->
  <div class="flex items-start justify-between gap-4">
    <div class="min-w-0">
      <div class="t-display text-bone truncate text-xl tracking-[0.16em] @[440px]:text-2xl">{stationName}</div>
      {#if config.location}
        <div class="t-label text-muted mt-1.5 truncate text-[10px] @[440px]:text-[11px]">{config.location}</div>
      {/if}
    </div>
    <div class="t-label text-muted flex shrink-0 items-center gap-2 text-[10px] @[440px]:text-[11px]">
      <OnAirDot {status} size={8} />
      <span>{statusLabel(status)}</span>
    </div>
  </div>

  {#if config.showDial && config.frequency}
    <div class="mt-5">
      <Dial frequency={config.frequency} playing={player.isPlaying} />
    </div>
  {/if}

  <!-- Transport -->
  <div class="mt-6 flex items-center gap-4 @[440px]:gap-6">
    <PlayButton {player} size="lg" label={stationName} />

    <div class="min-w-0 flex-1">
      <div class="t-display text-bone text-lg @[440px]:text-2xl">{heading}</div>
      {#if description}
        <div class="text-muted mt-1.5 line-clamp-2 text-[13px] @[440px]:text-sm">{description}</div>
      {/if}
      <div class="t-label text-accent mt-2 text-[10px] @[440px]:text-[11px]">{hint}</div>
    </div>

    <div class="hidden shrink-0 items-center gap-4 @[560px]:flex">
      <Equalizer active={player.isPlaying} bars={6} height={26} />
      {#if config.showVolume}
        <div class="w-24">
          <VolumeControl {player} />
        </div>
      {/if}
    </div>
  </div>

  <!-- Volume drops below the transport row when the card is too narrow for it -->
  {#if config.showVolume}
    <div class="mt-4 flex items-center gap-3 @[560px]:hidden">
      <Equalizer active={player.isPlaying} bars={5} height={18} />
      <VolumeControl {player} />
    </div>
  {/if}

  <!-- Now playing -->
  {#if nowText || feed.feedState === 'loading'}
    <div class="surface bg-panel mt-5 flex items-center gap-3 p-3 @[440px]:gap-4 @[440px]:p-4">
      {#if art}
        <img src={art} alt="" loading="lazy" class="bg-raised h-12 w-12 shrink-0 object-cover @[440px]:h-14 @[440px]:w-14" style="border-radius:calc(var(--wvvy-radius) / 2);" />
      {:else}
        <div class="bg-raised text-accent grid h-12 w-12 shrink-0 place-items-center text-lg @[440px]:h-14 @[440px]:w-14" style="border-radius:calc(var(--wvvy-radius) / 2);" aria-hidden="true">♪</div>
      {/if}
      <div class="min-w-0 flex-1">
        <div class="t-label text-muted text-[9px] @[440px]:text-[10px]">{nowLabel}</div>
        <!-- aria-live so a listener using a screen reader hears track changes
             without having to re-navigate to the widget. -->
        <div class="t-display text-bone mt-1 truncate text-sm @[440px]:text-base" title={nowText} aria-live="polite">
          {nowText || '—'}
        </div>
      </div>
      {#if config.showListeners && listeners != null}
        <div class="t-label text-muted shrink-0 text-[10px] whitespace-nowrap @[440px]:text-[11px]">
          {listeners} listening
        </div>
      {/if}
    </div>
  {/if}

  <!-- Today's schedule. Hides itself when the station doesn't publish one
       through AzuraCast, which is common — plenty of stations keep the schedule
       somewhere else entirely. -->
  {#if config.showSchedule && schedule.length > 0}
    <div class="border-accent/40 mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border px-3 py-2.5" style="border-radius:var(--wvvy-radius);">
      <span class="t-label text-accent shrink-0 text-[10px]">Today</span>
      {#each schedule as entry, i (entry.name + entry.start)}
        {#if i > 0}
          <span class="text-muted" aria-hidden="true">·</span>
        {/if}
        <span class="text-bone/85 text-[12px] @[440px]:text-[13px]">
          {#if entry.start}<span class="text-muted">{entry.start}</span>{/if}
          {entry.name}{#if entry.presenter}<span class="text-muted"> · {entry.presenter}</span>{/if}
        </span>
      {/each}
    </div>
  {/if}

  {#if config.link}
    <a
      href={config.link}
      target="_blank"
      rel="noopener"
      class="border-accent text-accent hover:bg-accent hover:text-accent-ink mt-4 inline-block border px-4 py-2 text-[13px] font-bold transition-colors"
      style="border-radius:calc(var(--wvvy-radius) * 2);"
    >
      {config.linkLabel}
    </a>
  {/if}
</div>
