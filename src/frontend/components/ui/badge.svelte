<script lang="ts">
	import type { Snippet } from 'svelte'

	type Props = {
		variant?: 'default' | 'outline'
		children: Snippet
	}

	let { variant = 'default', children }: Props = $props()
</script>

<span class="badge badge--{variant}">{@render children()}</span>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		height: 1rem;
		padding-inline: 0.375rem;
		border: 1px solid transparent;
		border-radius: 9999px;
		font-size: 10px;
		font-weight: 500;
		line-height: 1;
		white-space: nowrap;

		&--default {
			color: var(--primary-foreground);
			text-transform: uppercase;
			letter-spacing: 0.025em;
			background: var(--primary);
		}

		&--outline {
			border-color: var(--border);
			color: var(--foreground);
		}
	}
</style>
