import { reatomComponent } from '@reatom/react'
import { useEffect, useRef, useState } from 'react'
import { acceptGuestOffer, rosterAtom } from '@/state/net.ts'
import { goBack } from '@/state/ui.ts'
import { Card, CardContent } from '@/components/ui/card'
import { QrCode } from '@/signaling/QrCode.tsx'
import { QrScanner } from '@/signaling/QrScanner.tsx'
import { Screen } from '@/ui/components/Screen.tsx'
import { TopBar } from '@/ui/components/TopBar.tsx'

const SectionTitle = ({ children }: { children: string }) => (
	<h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
		{children}
	</h3>
)

export const AddPlayer = reatomComponent(() => {
	const [answer, setAnswer] = useState<string | null>(null)
	const [pendingId, setPendingId] = useState<string | null>(null)

	const roster = rosterAtom()
	// Защита от повторного возврата: подключение и следующее за ним `hello` обновляют ростер
	// почти одновременно, и оба прошли бы условие до того, как экран успеет размонтироваться —
	// тогда вышло бы два goBack подряд (за HostLobby улетели бы и в Lobby).
	const leftRef = useRef(false)

	// Как только ожидаемый игрок реально подключился — возвращаемся к настройке игры.
	// Сессию не рвём: ростер сохраняется, HostLobby его покажет.
	useEffect(() => {
		if (!leftRef.current && pendingId && roster.some((p) => p.id === pendingId && p.connected)) {
			leftRef.current = true
			goBack()
		}
	}, [roster, pendingId])

	const onScanOffer = async (offerCode: string) => {
		try {
			const { id, answerCode } = await acceptGuestOffer(offerCode)
			setPendingId(id)
			setAnswer(answerCode)
		} catch {
			setAnswer(null)
		}
	}

	return (
		<Screen onBack={goBack} header={<TopBar title="Добавить игрока" onBack={goBack} />}>
			<Card>
				<CardContent className="flex flex-col gap-3">
					{answer ? (
						<>
							<SectionTitle>Покажите QR игроку</SectionTitle>
							<p className="text-sm text-muted-foreground">
								Покажите этот QR игроку — пусть отсканирует его.
							</p>
							<div className="flex justify-center">
								<QrCode value={answer} />
							</div>
							<p className="text-sm text-muted-foreground">
								Экран закроется сам, когда игрок подключится…
							</p>
						</>
					) : (
						<>
							<SectionTitle>Отсканируйте QR игрока</SectionTitle>
							<p className="text-sm text-muted-foreground">
								Отсканируйте QR-код игрока (его offer).
							</p>
							<QrScanner onScan={onScanOffer} />
						</>
					)}
				</CardContent>
			</Card>
		</Screen>
	)
})
