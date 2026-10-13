<script lang="ts" generics="T extends string | number">
	import type { Snippet } from 'svelte'

	type Option = { value: T; label: string }

	type Props = {
		options: Option[]
		value: T
		onchange: (value: T) => void
		'aria-label'?: string
		/** Custom rendering of an item label, e.g. with a font size preview. */
		item?: Snippet<[Option]>
	}

	let { options, value, onchange, 'aria-label': label, item }: Props = $props()
</script>

<div class="toggle-group" role="radiogroup" aria-label={label}>
	{#each options as option (option.value)}
		<button
			type="button"
			role="radio"
			class="toggle-group__item"
			class:toggle-group__item--on={option.value === value}
			aria-checked={option.value === value}
			onclick={() => onchange(option.value)}
		>
			{#if item}{@render item(option)}{:else}{option.label}{/if}
		</button>
	{/each}
</div>

<style>
	.toggle-group {
		display: flex;
		width: 100%;
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);

		&__item {
			display: inline-flex;
			flex: 1;
			align-items: center;
			justify-content: center;
			min-width: 0;
			height: 2.75rem;
			padding-inline: 0.5rem;
			border: 0;
			font-size: 0.875rem;
			font-weight: 500;
			background: transparent;
			outline: none;
			transition:
				background-color 150ms,
				color 150ms;

			&:first-child {
				border-radius: var(--radius-lg) 0 0 var(--radius-lg);
			}

			&:last-child {
				border-radius: 0 var(--radius-lg) var(--radius-lg) 0;
			}

			& + & {
				border-left: 1px solid var(--border);
			}

			&:hover {
				background: var(--muted);
			}

			&:focus-visible {
				box-shadow: inset 0 0 0 2px color-mix(in oklch, var(--ring) 50%, transparent);
			}

			&--on,
			&--on:hover {
				color: var(--primary-foreground);
				background: var(--primary);
			}
		}
	}
</style>
