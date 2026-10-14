<script lang="ts">
	import PlugZap from '@lucide/svelte/icons/plug-zap'
	import WifiOff from '@lucide/svelte/icons/wifi-off'

	import Button from '#frontend/components/ui/button.svelte'
	import { connStatusAtom, guestReconnect, rosterAtom, transportAtom } from '#frontend/state/net.ts'
	import { modeAtom } from '#frontend/state/session.ts'
	import { goTo, goToJoin } from '#frontend/state/ui.ts'

	type Bar = { connecting: boolean; text: string; action: { label: string; run: () => void } | null }

	const bar = $derived.by<Bar | null>(() => {
		if ($modeAtom === 'local') return null

		if ($modeAtom === 'guest') {
			if ($connStatusAtom === 'connected') return null

			const connecting = $connStatusAtom === 'connecting'
			// In a relay room the channel comes back by itself -- the button only hurries the next attempt.
			// Over QR the only way back is a new handshake, so we send them to the join screen.
			const retry = $transportAtom === 'relay' ? () => guestReconnect() : () => goToJoin('reconnect')

			return {
				connecting,
				text: connecting ? 'Восстанавливаем связь…' : 'Связь с хостом потеряна',
				action: connecting ? null : { label: 'Переподключиться', run: retry },
			}
		}

		const offline = $rosterAtom.filter((p) => !p.connected)

		if (offline.length === 0) return null

		return {
			connecting: false,
			text: `Не на связи: ${offline.map((p) => p.name).join(', ')}`,
			action: { label: 'Подключить', run: () => goTo('host-add') },
		}
	})
</script>

<!--
	Connection status strip above the board. Shown only when there's something to say: to a guest -- that
	the channel to the host dropped (device sleep, network loss) and how to get back; to the host -- which
	players dropped off and how to take them back. The game isn't torn down on a drop: the board keeps
	showing the last known state.
-->
{#if bar}
	<div class="connection-bar">
		<span class="connection-bar__icon">
			{#if bar.connecting}<PlugZap size={16} />{:else}<WifiOff size={16} />{/if}
		</span>
		<span class="connection-bar__text">{bar.text}</span>
		{#if bar.action}
			<Button size="sm" variant="outline" onclick={bar.action.run}>{bar.action.label}</Button>
		{/if}
	</div>
{/if}

<style>
	.connection-bar {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		padding: 0.5rem 0.75rem;
		border: 1px solid color-mix(in oklch, var(--destructive) 40%, transparent);
		border-radius: var(--radius-xl);
		background: color-mix(in oklch, var(--destructive) 10%, transparent);

		&__icon {
			color: var(--destructive);
		}

		&__text {
			overflow: hidden;
			flex: 1;
			min-width: 0;
			font-size: 0.875rem;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
	}
</style>
