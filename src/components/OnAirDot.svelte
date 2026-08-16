<script lang="ts">
  import type { Status } from '@lib/status';

  let { status, size = 8 }: { status: Status; size?: number } = $props();

  let tone = $derived(status === 'on-air' ? 'var(--color-live)' : status === 'standby' ? 'var(--color-muted)' : 'var(--color-warn)');
</script>

<span class="on-air-dot inline-block shrink-0 rounded-full" data-live={status === 'on-air'} style="width:{size}px;height:{size}px;background:{tone};" aria-hidden="true"></span>
