<script lang="ts">
	type Props = {
		id?: string
		checked: boolean
		/** Called with the new value; the switch itself doesn't hold state. */
		onchange: (checked: boolean) => void
		'aria-label'?: string
	}

	let { id, checked, onchange, 'aria-label': label }: Props = $props()
</script>

<button
	{id}
	type="button"
	role="switch"
	class="switch"
	class:switch--checked={checked}
	aria-checked={checked}
	aria-label={label}
	onclick={() => onchange(!checked)}
>
	<span class="switch__thumb"></span>
</button>

<style>
	.switch {
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
		width: 3rem;
		height: 1.75rem;
		padding: 1px;
		border: 1px solid transparent;
		border-radius: 9999px;
		background: var(--input);
		outline: none;
		transition: background-color 150ms;

		&:focus-visible {
			box-shadow: 0 0 0 3px color-mix(in oklch, var(--ring) 50%, transparent);
		}

		&--checked {
			background: var(--primary);
		}

		&__thumb {
			pointer-events: none;
			display: block;
			width: 1.5rem;
			height: 1.5rem;
			border-radius: 9999px;
			background: var(--background);
			transition: transform 150ms;

			:global(.dark) .switch:not(.switch--checked) &:not(:global(.dark .light *)) {
				background: var(--foreground);
			}

			.switch--checked & {
				transform: translateX(calc(100% - 4px));
			}

			:global(.dark) .switch--checked &:not(:global(.dark .light *)) {
				background: var(--primary-foreground);
			}
		}
	}
</style>
