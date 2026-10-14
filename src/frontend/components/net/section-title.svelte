<script lang="ts">
	import type { Snippet } from 'svelte'

	let { children }: { children: Snippet } = $props()
</script>

<!-- Мелкий капс-заголовок секции внутри карточки лобби. -->
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
