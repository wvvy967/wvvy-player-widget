<script lang="ts">
  // FM band dial. Purely decorative — it shows where the station sits on the
  // band, it isn't a control. Hidden from assistive tech; the frequency is
  // already announced in the card's text.

  let { frequency, playing }: { frequency: string | undefined; playing: boolean } = $props();

  const LO = 88;
  const HI = 108;
  const ticks = Array.from({ length: 41 }, (_, i) => i);
  const labels = [88, 90, 92, 94, 96, 98, 100, 102, 104, 106, 108];

  let freq = $derived.by(() => {
    const n = Number(frequency);
    return Number.isFinite(n) && n >= LO && n <= HI ? n : null;
  });
  let pos = $derived(freq == null ? null : ((freq - LO) / (HI - LO)) * 100);
</script>

<div class="relative" aria-hidden="true">
  {#if pos != null}
    <!-- Frequency badge, centred on the needle and clamped inside the track so
         it never hangs off the edge for stations near 88 or 108. -->
    <div class="relative mb-1 h-6">
      <span
        class="border-accent text-accent bg-ink absolute top-0 -translate-x-1/2 border px-1.5 py-0.5 font-mono text-[11px] font-bold"
        style="left:clamp(1.6rem, {pos}%, calc(100% - 1.6rem)); border-radius:calc(var(--wvvy-radius) / 2);"
      >
        {frequency}
      </span>
    </div>
  {/if}

  <div class="surface bg-panel relative h-[74px] overflow-hidden">
    <!-- tick marks -->
    <div class="absolute inset-x-0 top-0 flex h-8 items-start">
      {#each ticks as tick (tick)}
        <div class="flex flex-1 justify-center">
          <span class="bg-bone/25 block w-px {tick % 5 === 0 ? 'h-5' : 'h-2.5'}"></span>
        </div>
      {/each}
    </div>

    <!-- band labels -->
    <div class="text-muted absolute inset-x-0 bottom-0 flex h-8 items-center font-mono text-[11px]">
      {#each labels as label (label)}
        <span class="flex-1 text-center">{label}</span>
      {/each}
    </div>

    <!-- slow analog sweep while idle; the needle takes over once audio is flowing -->
    {#if !playing}
      <div class="bg-accent/30 dial-sweep absolute inset-y-0 w-[2px]"></div>
    {/if}

    {#if pos != null}
      <div class="bg-accent absolute inset-y-0 w-[2px]" style="left:calc({pos}% - 1px); box-shadow:0 0 10px var(--color-accent);"></div>
    {/if}
  </div>
</div>
