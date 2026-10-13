<script lang="ts">
	import type { Snippet } from 'svelte'

	let { children }: { children: Snippet } = $props()
</script>

<!-- Small caps section title inside a lobby card. -->
<h3 class="section-title">{@render children()}</h3>

<style>
	.section-title {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--muted-foreground);
		text-transform: uppercase;
		letter-spacing: 0.025em;
	}
</style>
