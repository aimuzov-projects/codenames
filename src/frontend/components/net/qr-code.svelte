<script lang="ts">
	import QRCode from 'qrcode'

	import { E2E } from '#frontend/lib/e2e.ts'

	/** Shows a string as a QR code -- the other player's camera scans it. */
	let { value }: { value: string } = $props()

	let svg = $state('')

	$effect(() => {
		let cancelled = false
		void QRCode.toString(value, { type: 'svg', margin: 0, errorCorrectionLevel: 'L' }).then((markup) => {
			if (!cancelled) svg = markup
		})
		return () => {
			cancelled = true
		}
	})
</script>

<!--
	The QR is always black on white in both themes: the built-in scanner (zxing) only reads dark modules
	on a light background.
-->
<div class="qr-code">
	<!-- The qrcode library builds the SVG locally from the code string -- no external markup here. -->
	<div class="qr-code__image" role="img" aria-label="QR-код">{@html svg}</div>
	<!-- e2e hook: the same code as a string, so the test hands it to another context instead of scanning the QR. -->
	{#if E2E}
		<span data-testid="signal-out" hidden>{value}</span>
	{/if}
</div>

<style>
	.qr-code {
		display: flex;
		align-items: center;
		justify-content: center;
		aspect-ratio: 1;
		width: 100%;
		max-width: 24rem;
		margin-inline: auto;
		padding: 0.75rem;
		border-radius: var(--radius-xl);
		background: #fff;
		box-shadow: 0 0 0 1px color-mix(in oklch, var(--foreground) 10%, transparent);

		&__image {
			display: flex;
			width: 100%;

			& > :global(*) {
				width: 100%;
				height: auto;
			}
		}
	}
</style>
