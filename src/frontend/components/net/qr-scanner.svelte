<script lang="ts">
	import type { IScannerControls } from '@zxing/browser'

	import Button from '#frontend/components/ui/button.svelte'
	import Textarea from '#frontend/components/ui/textarea.svelte'
	import { E2E } from '#frontend/lib/e2e.ts'

	/** Сканер QR через камеру. */
	let { onscan }: { onscan: (text: string) => void } = $props()

	let video: HTMLVideoElement
	let error = $state('')
	let manualCode = $state('')

	$effect(() => {
		let controls: IScannerControls | null = null
		let stream: MediaStream | null = null
		let cancelled = false

		void (async () => {
			// Камера доступна только в защищённом контексте (HTTPS или localhost).
			if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
				error = 'Камера работает только по HTTPS. Откройте https-адрес.'
				return
			}
			try {
				// Явный запрос разрешения + задняя камера + высокое разрешение (плотные QR).
				stream = await navigator.mediaDevices.getUserMedia({
					video: {
						facingMode: { ideal: 'environment' },
						width: { ideal: 1920 },
						height: { ideal: 1080 },
					},
					audio: false,
				})
				if (cancelled) {
					stream.getTracks().forEach((t) => t.stop())
					return
				}
				// zxing грузится лениво -- не утяжеляет основной бандл.
				const [{ BrowserQRCodeReader }, { DecodeHintType }] = await Promise.all([
					import('@zxing/browser'),
					import('@zxing/library'),
				])
				if (cancelled) return
				// TRY_HARDER -- настойчивее ищет код; чаще опрашиваем кадры.
				const hints = new Map([[DecodeHintType.TRY_HARDER, true]])
				const reader = new BrowserQRCodeReader(hints, { delayBetweenScanAttempts: 120 })
				controls = await reader.decodeFromStream(stream, video, (result, _err, ctrl) => {
					if (result && !cancelled) {
						cancelled = true
						ctrl.stop()
						onscan(result.getText())
					}
				})
				// Экран успели закрыть, пока поднимался сканер.
				if (cancelled) controls.stop()
			} catch (e) {
				if (cancelled) return
				const name = (e as DOMException)?.name
				if (name === 'NotAllowedError' || name === 'SecurityError') {
					error = 'Доступ к камере запрещён. Разрешите камеру в настройках браузера и обновите страницу.'
				} else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
					error = 'Камера не найдена.'
				} else {
					error = 'Камера недоступна.'
				}
			}
		})()

		return () => {
			cancelled = true
			controls?.stop()
			stream?.getTracks().forEach((t) => t.stop())
		}
	})

	function submitManual() {
		const code = manualCode.trim()
		if (code) onscan(code)
	}
</script>

<div class="qr-scanner">
	<video bind:this={video} class="qr-scanner__video" muted playsinline autoplay></video>
	{#if error}<p class="qr-scanner__error">{error}</p>{/if}
	<!-- e2e-хук: вставка кода строкой вместо съёмки QR камерой (в headless камеры нет). -->
	{#if E2E}
		<div class="qr-scanner__manual">
			<Textarea data-testid="signal-in" bind:value={manualCode} rows={2} />
			<Button variant="outline" size="sm" data-testid="signal-submit" onclick={submitManual}>
				Применить код
			</Button>
		</div>
	{/if}
</div>

<style>
	.qr-scanner {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;

		&__video {
			aspect-ratio: 1;
			width: 100%;
			border-radius: var(--radius-xl);
			object-fit: cover;
			background: #000;
		}

		&__error {
			font-size: 0.875rem;
			color: var(--destructive);
		}

		&__manual {
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
		}
	}
</style>
