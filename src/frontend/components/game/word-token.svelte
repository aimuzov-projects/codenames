<script lang="ts">
	type Props = {
		/** Ring color; defaults to the text color. */
		color?: string
		size?: number
	}

	let { color = 'currentcolor', size = 14 }: Props = $props()
</script>

<!-- Found-word marker: a check in a thin ring. -->
<svg width={size} height={size} viewBox="0 0 13 13" aria-hidden="true">
	<circle cx="6.5" cy="6.5" r="6" fill="none" stroke={color} stroke-width="1.3" opacity="0.5" />
	<path
		d="M3.7 6.6 5.7 8.6 9.5 4.2"
		fill="none"
		stroke={color}
		stroke-width="1.5"
		stroke-linecap="round"
		stroke-linejoin="round"
	/>
</svg>
