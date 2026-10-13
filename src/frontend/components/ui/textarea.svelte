<script lang="ts">
	import type { HTMLTextareaAttributes } from 'svelte/elements'

	type Props = HTMLTextareaAttributes & { value: string }

	let { value = $bindable(), ...rest }: Props = $props()
</script>

<textarea class="textarea" bind:value {...rest}></textarea>

<style>
	.textarea {
		resize: vertical;
		width: 100%;
		min-height: 4rem;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--input);
		border-radius: var(--radius-lg);
		font-size: 1rem;
		background: transparent;
		outline: none;

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
	}
</style>
