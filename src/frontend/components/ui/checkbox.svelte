<script lang="ts">
	import Check from '@lucide/svelte/icons/check'

	type Props = {
		id?: string
		checked: boolean
		onchange: (checked: boolean) => void
		'aria-label'?: string
	}

	let { id, checked, onchange, 'aria-label': label }: Props = $props()
</script>

<button
	{id}
	type="button"
	role="checkbox"
	class="checkbox"
	class:checkbox--checked={checked}
	aria-checked={checked}
	aria-label={label}
	onclick={() => onchange(!checked)}
>
	{#if checked}<Check size={14} strokeWidth={3} />{/if}
</button>

<style>
	.checkbox {
		display: grid;
		flex-shrink: 0;
		place-content: center;
		width: 1.25rem;
		height: 1.25rem;
		padding: 0;
		border: 1px solid var(--input);
		border-radius: 0.3rem;
		color: var(--primary-foreground);
		background: transparent;
		outline: none;
		transition: background-color 150ms;

		&:focus-visible {
			box-shadow: 0 0 0 3px color-mix(in oklch, var(--ring) 50%, transparent);
		}

		&--checked {
			border-color: var(--primary);
			background: var(--primary);
		}
	}
</style>
