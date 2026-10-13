<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements'

	type Props = HTMLInputAttributes & {
		value: string
		/** Моноширинный крупный ввод: коды комнат. */
		code?: boolean
	}

	let { value = $bindable(), code = false, ...rest }: Props = $props()
</script>

<input class="input" class:input--code={code} bind:value {...rest} />

<style>
	.input {
		width: 100%;
		min-width: 0;
		height: 2.75rem;
		padding-inline: 0.75rem;
		border: 1px solid var(--input);
		border-radius: var(--radius-lg);
		font-size: 1rem;
		background: transparent;
		outline: none;
		transition: box-shadow 150ms;

		&::placeholder {
			color: var(--muted-foreground);
		}

		&:focus-visible {
			border-color: var(--ring);
			box-shadow: 0 0 0 3px color-mix(in oklch, var(--ring) 50%, transparent);
		}

		:global(.dark) & {
			background: color-mix(in oklch, var(--input) 30%, transparent);
		}

		&--code {
			font-family: ui-monospace, monospace;
			font-size: 1.25rem;
			text-align: center;
			text-transform: uppercase;
			letter-spacing: 0.3em;
		}
	}
</style>
