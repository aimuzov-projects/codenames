import { reatomComponent } from '@reatom/react'
import { useEffect, useRef, useState } from 'react'
import { acceptGuestOffer, joinedConnIdsAtom } from '@/state/net.ts'
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
	const [pendingConnId, setPendingConnId] = useState<string | null>(null)

	const joined = joinedConnIdsAtom()
	// Защита от повторного возврата: список подключившихся может обновиться ещё раз до того,
	// как экран успеет размонтироваться — тогда вышло бы два goBack подряд (за HostLobby
	// улетели бы и в Lobby).
	const leftRef = useRef(false)

	// Как только гость представился (`hello`) — возвращаемся к настройке игры. Ждём именно
	// `hello`, а не появления в ростере: игрок мог подключаться повторно и уже быть в списке.
	// Сессию не рвём: ростер сохраняется, HostLobby его покажет.
	useEffect(() => {
		if (!leftRef.current && pendingConnId && joined.includes(pendingConnId)) {
			leftRef.current = true
			goBack()
		}
	}, [joined, pendingConnId])

	const onScanOffer = async (offerCode: string) => {
		try {
			const { connId, answerCode } = await acceptGuestOffer(offerCode)
			setPendingConnId(connId)
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
