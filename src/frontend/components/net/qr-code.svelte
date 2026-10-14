<script lang="ts">
	import QRCode from 'qrcode'

	import { E2E } from '#frontend/lib/e2e.ts'

	/** Показывает строку как QR-код -- его сканирует камера другого игрока. */
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
	QR всегда чёрный на белом в обеих темах: встроенный сканер (zxing) читает только тёмные модули
	на светлом фоне.
-->
<div class="qr-code">
	<!-- SVG собирает библиотека qrcode локально из строки кода -- внешней разметки тут нет. -->
	<div class="qr-code__image" role="img" aria-label="QR-код">{@html svg}</div>
	<!-- e2e-хук: тот же код строкой, чтобы тест передал его другому контексту вместо съёмки QR. -->
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
