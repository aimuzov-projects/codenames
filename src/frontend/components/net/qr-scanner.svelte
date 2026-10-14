<script lang="ts">
	import type { IScannerControls } from '@zxing/browser'

	import Button from '#frontend/components/ui/button.svelte'
	import Textarea from '#frontend/components/ui/textarea.svelte'
	import { E2E } from '#frontend/lib/e2e.ts'

	/** QR scanner via the camera. */
	let { onscan }: { onscan: (text: string) => void } = $props()

	let video: HTMLVideoElement
	let error = $state('')
	let manualCode = $state('')

	$effect(() => {
		let controls: IScannerControls | null = null
		let stream: MediaStream | null = null
		let cancelled = false

		void (async () => {
			// The camera is only available in a secure context (HTTPS or localhost).
			if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
				error = 'Камера работает только по HTTPS. Откройте https-адрес.'

				return
			}

			try {
				// Explicit permission request + rear camera + high resolution (dense QR codes).
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

				// zxing is loaded lazily -- doesn't weigh down the main bundle.
				const [{ BrowserQRCodeReader }, { DecodeHintType }] = await Promise.all([
					import('@zxing/browser'),
					import('@zxing/library'),
				])

				if (cancelled) return

				// TRY_HARDER -- searches harder for a code; we also poll frames more often.
				const hints = new Map([[DecodeHintType.TRY_HARDER, true]])
				const reader = new BrowserQRCodeReader(hints, { delayBetweenScanAttempts: 120 })

				controls = await reader.decodeFromStream(stream, video, (result, _err, ctrl) => {
					if (result && !cancelled) {
						cancelled = true
						ctrl.stop()
						onscan(result.getText())
					}
				})

				// The screen was closed while the scanner was starting.
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
	<!-- e2e hook: paste the code as a string instead of scanning the QR with the camera (headless has none). -->
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
