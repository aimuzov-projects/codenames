import { useEffect, useRef, useState } from 'react'
import type { IScannerControls } from '@zxing/browser'
import { E2E } from '@/lib/e2e.ts'

/** Сканер QR через камеру. */
export function QrScanner({ onScan }: { onScan: (text: string) => void }) {
	const videoRef = useRef<HTMLVideoElement>(null)
	const [error, setError] = useState('')
	const [manualCode, setManualCode] = useState('')

	useEffect(() => {
		let controls: IScannerControls | null = null
		let stream: MediaStream | null = null
		let cancelled = false
		setError('')

		void (async () => {
			// Камера доступна только в защищённом контексте (HTTPS или localhost).
			if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
				setError('Камера работает только по HTTPS. Откройте https-адрес.')
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
				// zxing грузится лениво — не утяжеляет основной бандл.
				const [{ BrowserQRCodeReader }, { DecodeHintType }] = await Promise.all([
					import('@zxing/browser'),
					import('@zxing/library'),
				])
				if (cancelled) return
				// TRY_HARDER — настойчивее ищет код; чаще опрашиваем кадры.
				const hints = new Map([[DecodeHintType.TRY_HARDER, true]])
				const reader = new BrowserQRCodeReader(hints, { delayBetweenScanAttempts: 120 })
				controls = await reader.decodeFromStream(
					stream,
					videoRef.current ?? undefined,
					(result, _err, ctrl) => {
						if (result && !cancelled) {
							cancelled = true
							ctrl.stop()
							onScan(result.getText())
						}
					},
				)
			} catch (e) {
				if (cancelled) return
				const name = (e as DOMException)?.name
				if (name === 'NotAllowedError' || name === 'SecurityError') {
					setError(
						'Доступ к камере запрещён. Разрешите камеру в настройках браузера и обновите страницу.',
					)
				} else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
					setError('Камера не найдена.')
				} else {
					setError('Камера недоступна.')
				}
			}
		})()

		return () => {
			cancelled = true
			controls?.stop()
			stream?.getTracks().forEach((t) => t.stop())
		}
	}, [onScan])

	return (
		<div className="flex flex-col gap-2">
			<video
				ref={videoRef}
				className="aspect-square w-full rounded-xl bg-black object-cover"
				muted
				playsInline
				autoPlay
			/>
			{error && <p className="text-sm text-destructive">{error}</p>}
			{/* e2e-хук: вставка кода строкой вместо съёмки QR камерой (в headless камеры нет). */}
			{E2E && (
				<div className="flex flex-col gap-2">
					<textarea
						data-testid="signal-in"
						value={manualCode}
						onChange={(e) => setManualCode(e.target.value)}
						className="rounded border p-1 text-xs"
						rows={2}
					/>
					<button
						type="button"
						data-testid="signal-submit"
						onClick={() => manualCode.trim() && onScan(manualCode.trim())}
					>
						Применить код
					</button>
				</div>
			)}
		</div>
	)
}
