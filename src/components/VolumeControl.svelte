<script lang="ts">
  import type { PlayerStore } from '@lib/player.svelte';

  let { player }: { player: PlayerStore } = $props();
</script>

{#if player.canSetVolume}
  <input class="vol accent-accent w-full min-w-[70px]" type="range" min="0" max="1" step="0.01" value={player.volume} oninput={(e) => player.setVolume(+e.currentTarget.value)} aria-label="Volume" />
{:else}
  <!-- iOS reserves volume for the hardware buttons and gives JS no way to detect
       that beyond the platform itself, so we hide the control rather than ship a
       slider that silently does nothing. -->
  <span class="text-muted text-[11px]">Use device volume</span>
{/if}
