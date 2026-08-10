import { reatomComponent } from '@reatom/react'
import { useEffect, useState } from 'react'
import { modeAtom, myRoleAtom, myTeamAtom } from '@/state/session.ts'
import {
	HOST_ID,
	hostReshuffle,
	hostStartGame,
	leaveSession,
	roomCodeAtom,
	rosterAtom,
	setHostSetup,
	startHosting,
	transportAtom,
} from '@/state/net.ts'
import { isRosterReady, randomSetup, teamHasSpymaster } from '@/state/roster.ts'
import { goBack, goTo, selectedWordsAtom } from '@/state/ui.ts'
import { RELAY_AVAILABLE } from '@/lib/relay.ts'
import { Check, Dices, Play, QrCode as QrCodeIcon, UserPlus, Wifi } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Card, CardContent } from '@/components/ui/card'
import { QrCode } from '@/signaling/QrCode.tsx'
import { RippleButton } from '@/ui/components/RippleButton.tsx'
import { RosterList } from '@/ui/components/RosterList.tsx'
import { SetupPicker } from '@/ui/components/SetupPicker.tsx'
import { Screen } from '@/ui/components/Screen.tsx'
import { TopBar } from '@/ui/components/TopBar.tsx'

const SectionTitle = ({ children }: { children: string }) => (
	<h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
		{children}
	</h3>
)

export const HostLobby = reatomComponent(() => {
	// Запускаем хостинг при входе, но не при возврате с экрана «Добавить игрока»:
	// экран перемонтируется (key={screen}), а startHosting деструктивен (сбросил бы ростер).
	// По умолчанию — комната на сервере: она переживает сон телефона сама. Без сервера
	// (сборка без VITE_RELAY_URL) остаётся офлайновое рукопожатие по QR.
	useEffect(() => {
		if (modeAtom() !== 'host') {
			startHosting('Хост', 'red', 'spymaster', RELAY_AVAILABLE ? 'relay' : 'qr')
		}
	}, [])

	const transport = transportAtom()
	const roomCode = roomCodeAtom()
	const team = myTeamAtom()
	const role = myRoleAtom()
	const roster = rosterAtom()
	const words = selectedWordsAtom()
	const rosterReady = isRosterReady(roster)
	const spymasterDisabled = teamHasSpymaster(roster, team, HOST_ID)
	const canReshuffle = roster.filter((p) => p.connected).length >= 4

	const [showRosterAlert, setShowRosterAlert] = useState(false)

	const back = () => {
		leaveSession()
		goBack()
	}

	const handleStart = () => {
		if (!rosterReady) {
			setShowRosterAlert(true)
			return
		}
		hostStartGame({ words })
	}

	return (
		<Screen onBack={back} header={<TopBar title="Создание игры" onBack={back} />}>
			<Card>
				<CardContent className="flex flex-col gap-3">
					<SectionTitle>Вы</SectionTitle>
					<SetupPicker
						team={team}
						role={role}
						spymasterDisabled={spymasterDisabled}
						onChange={(t, r) => setHostSetup(t, r)}
						onRandom={() => {
							const s = randomSetup(roster, HOST_ID, { team, role })
							setHostSetup(s.team, s.role)
						}}
					/>
				</CardContent>
			</Card>

			{transport === 'relay' && (
				<Card>
					<CardContent className="flex flex-col items-center gap-3">
						<SectionTitle>Код комнаты</SectionTitle>
						{roomCode ? (
							<>
								<span data-testid="room-code" className="font-heading text-3xl tracking-[0.3em]">
									{roomCode}
								</span>
								<QrCode value={roomCode} />
								<p className="text-center text-sm text-muted-foreground">
									Продиктуйте код или дайте отсканировать. Игроки вернутся сами, даже если телефон
									уснёт.
								</p>
							</>
						) : (
							<p className="text-sm text-muted-foreground">Открываем комнату…</p>
						)}
						<Button
							variant="outline"
							className="w-full"
							onClick={() => startHosting('Хост', team, role, 'qr')}
						>
							<QrCodeIcon />
							Играть без интернета
						</Button>
					</CardContent>
				</Card>
			)}

			<Card>
				<CardContent className="flex flex-col gap-3">
					<SectionTitle>Игроки</SectionTitle>
					<RosterList />
					<div className="flex gap-2">
						{transport === 'qr' && (
							<Button variant="outline" className="flex-1" onClick={() => goTo('host-add')}>
								<UserPlus />
								Добавить игрока
							</Button>
						)}
						{canReshuffle && (
							<Button
								variant="outline"
								size="icon"
								aria-label="Перемешать игроков"
								onClick={() => hostReshuffle()}
							>
								<Dices />
							</Button>
						)}
					</div>
					{transport === 'qr' && RELAY_AVAILABLE && (
						<Button
							variant="ghost"
							className="w-full"
							onClick={() => startHosting('Хост', team, role, 'relay')}
						>
							<Wifi />
							Играть через интернет — по коду комнаты
						</Button>
					)}
				</CardContent>
			</Card>

			<div className="mt-auto flex flex-col gap-2.5">
				<RippleButton size="lg" className="w-full" onClick={handleStart}>
					<Play />
					Начать игру
				</RippleButton>
			</div>

			<AlertDialog open={showRosterAlert} onOpenChange={setShowRosterAlert}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Нельзя начать игру</AlertDialogTitle>
						<AlertDialogDescription>
							Нужно минимум по капитану и игроку в каждой команде.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogAction onClick={() => setShowRosterAlert(false)}>
							<Check />
							Понятно
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</Screen>
	)
})
