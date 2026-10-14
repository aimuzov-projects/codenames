<script lang="ts">
	type Props = {
		/** Заполненность от 0 до 100. */
		value: number
		'aria-label'?: string
	}

	let { value, 'aria-label': label }: Props = $props()
</script>

<div
	class="progress"
	role="progressbar"
	aria-label={label}
	aria-valuemin={0}
	aria-valuemax={100}
	aria-valuenow={Math.round(value)}
>
	<div class="progress__bar" style:width="{Math.max(0, Math.min(100, value))}%"></div>
</div>

<style>
	.progress {
		position: relative;
		overflow: hidden;
		width: 100%;
		height: 0.5rem;
		border-radius: 9999px;
		background: color-mix(in oklch, var(--primary) 20%, transparent);

		&__bar {
			height: 100%;
			background: var(--primary);
			transition: width 200ms linear;
		}
	}
</style>
