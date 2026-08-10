import { reatomComponent } from '@reatom/react'
import { PlugZap, WifiOff } from 'lucide-react'
import { modeAtom } from '@/state/session.ts'
import { connStatusAtom, rosterAtom } from '@/state/net.ts'
import { goTo, goToJoin } from '@/state/ui.ts'
import { Button } from '@/components/ui/button'

/**
 * Полоска состояния связи над доской. Показывается только когда есть о чём сказать: гостю —
 * что канал с хостом оборвался (сон устройства, потеря сети) и как вернуться, хосту — кто из
 * игроков отвалился и как принять его обратно. Партию при обрыве не рвём: доска продолжает
 * показывать последнее известное состояние.
 */
export const ConnectionBar = reatomComponent(() => {
	const mode = modeAtom()
	const status = connStatusAtom()
	const roster = rosterAtom()

	if (mode === 'local') return null

	if (mode === 'guest') {
		if (status === 'connected') return null
		const connecting = status === 'connecting'
		return (
			<Bar
				icon={connecting ? <PlugZap /> : <WifiOff />}
				text={connecting ? 'Восстанавливаем связь…' : 'Связь с хостом потеряна'}
				action={connecting ? null : { label: 'Переподключиться', run: () => goToJoin('reconnect') }}
			/>
		)
	}

	const offline = roster.filter((p) => !p.connected)
	if (offline.length === 0) return null
	return (
		<Bar
			icon={<WifiOff />}
			text={`Не на связи: ${offline.map((p) => p.name).join(', ')}`}
			action={{ label: 'Подключить', run: () => goTo('host-add') }}
		/>
	)
})

function Bar({
	icon,
	text,
	action,
}: {
	icon: React.ReactNode
	text: string
	action: { label: string; run: () => void } | null
}) {
	return (
		<div className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2">
			<span className="text-destructive [&>svg]:size-4">{icon}</span>
			<span className="min-w-0 flex-1 truncate text-sm">{text}</span>
			{action && (
				<Button size="sm" variant="outline" className="shrink-0" onClick={action.run}>
					{action.label}
				</Button>
			)}
		</div>
	)
}
