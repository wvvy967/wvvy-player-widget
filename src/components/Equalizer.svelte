<script lang="ts">
  let { active, bars = 5, height = 20 }: { active: boolean; bars?: number; height?: number } = $props();

  // Fixed heights and offsets rather than random ones: a widget that re-renders
  // shouldn't reshuffle its own EQ, and deterministic values keep tests stable.
  const shape = [0.55, 0.9, 0.4, 1, 0.7, 0.85, 0.45, 0.95, 0.6, 0.75, 0.35, 0.8];
  const speeds = [0.62, 0.83, 0.51, 0.94, 0.72, 0.88];

  let cells = $derived(
    Array.from({ length: bars }, (_, i) => ({
      h: shape[i % shape.length] ?? 0.6,
      duration: speeds[i % speeds.length] ?? 0.7,
      delay: ((i * 37) % 100) / 100
    }))
  );
</script>

<div class="flex items-end gap-[3px]" style="height:{height}px" aria-hidden="true">
  {#each cells as cell, i (i)}
    <span
      class="eq-bar bg-accent w-[3px] rounded-[1px]"
      data-active={active}
      style="height:{Math.round(cell.h * 100)}%; animation-duration:{cell.duration}s; animation-delay:{cell.delay}s; {active ? '' : 'transform:scaleY(0.2);opacity:0.4;'}"
    ></span>
  {/each}
</div>
