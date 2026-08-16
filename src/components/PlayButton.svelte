<script lang="ts">
  import type { PlayerStore } from '@lib/player.svelte';

  let { player, size = 'md', label }: { player: PlayerStore; size?: 'sm' | 'md' | 'lg'; label: string } = $props();

  const dims = { sm: 'h-11 w-11', md: 'h-14 w-14', lg: 'h-20 w-20' } as const;
  const glyph = { sm: 'text-[11px]', md: 'text-sm', lg: 'text-xl' } as const;

  let busy = $derived(player.loading);
  let action = $derived(player.isPlaying ? `Pause ${label}` : `Play ${label}`);
</script>

<button
  type="button"
  onclick={() => player.toggle()}
  disabled={busy}
  aria-label={action}
  aria-pressed={player.isPlaying}
  class="border-accent text-accent hover:bg-accent hover:text-accent-ink group relative grid shrink-0 place-items-center rounded-full border-2 transition-colors duration-150 disabled:cursor-wait disabled:opacity-60 {dims[
    size
  ]}"
>
  {#if busy}
    <!-- Ring segment that spins: reads as "connecting" without a text label. -->
    <span class="spinner border-accent/25 border-t-accent absolute inset-1.5 rounded-full border-2"></span>
  {:else if player.isPlaying}
    <!-- Pause: two bars. Drawn rather than glyphs so they align optically. -->
    <span class="flex items-center gap-[3px] {glyph[size]}" aria-hidden="true">
      <span class="h-[1.15em] w-[0.28em] bg-current"></span>
      <span class="h-[1.15em] w-[0.28em] bg-current"></span>
    </span>
  {:else}
    <!-- Play: a CSS triangle, nudged right so it sits optically centred in the circle. -->
    <span
      class="ml-[0.18em] {glyph[size]}"
      style="width:0;height:0;border-style:solid;border-width:0.62em 0 0.62em 1.02em;border-color:transparent transparent transparent currentColor;"
      aria-hidden="true"
    ></span>
  {/if}
</button>
