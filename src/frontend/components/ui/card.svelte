<script lang="ts">
	import type { Snippet } from 'svelte'

	type Props = {
		/** Content layout: stacked (default) or a row "label -- control". */
		layout?: 'stack' | 'row'
		children: Snippet
	}

	let { layout = 'stack', children }: Props = $props()
</script>

<section class="card card--{layout}">
	{@render children()}
</section>

<style>
	.card {
		display: flex;
		gap: 0.75rem;
		padding: 1rem;
		border-radius: var(--radius-xl);
		color: var(--card-foreground);
		background: var(--card);
		box-shadow: 0 0 0 1px color-mix(in oklch, var(--foreground) 10%, transparent);

		&--stack {
			flex-direction: column;
		}

		&--row {
			align-items: center;
			justify-content: space-between;
		}
	}
</style>
