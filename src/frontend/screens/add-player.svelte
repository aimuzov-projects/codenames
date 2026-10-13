<script lang="ts">
	import QrCode from '#frontend/components/net/qr-code.svelte'
	import QrScanner from '#frontend/components/net/qr-scanner.svelte'
	import SectionTitle from '#frontend/components/net/section-title.svelte'
	import Screen from '#frontend/components/screen.svelte'
	import TopBar from '#frontend/components/top-bar.svelte'
	import Card from '#frontend/components/ui/card.svelte'
	import { acceptGuestOffer, joinedConnIdsAtom } from '#frontend/state/net.ts'
	import { goBack } from '#frontend/state/ui.ts'

	let answer = $state<string | null>(null)
	let pendingConnId = $state<string | null>(null)

	// Guard against a double return: the list of connected players may update once more before
	// the screen gets to unmount -- that would mean two goBack calls in a row (we'd fly past HostLobby
	// into Lobby too).
	let left = false

	// As soon as the guest introduces itself (`hello`), go back to game setup. We wait for
	// `hello` specifically, not for a roster entry: the player may be reconnecting and already listed.
	// The session stays up: the roster is kept and HostLobby will show it.
	$effect(() => {
		if (!left && pendingConnId && $joinedConnIdsAtom.includes(pendingConnId)) {
			left = true
			goBack()
		}
	})

	async function onScanOffer(offerCode: string) {
		try {
			const { connId, answerCode } = await acceptGuestOffer(offerCode)
			pendingConnId = connId
			answer = answerCode
		} catch {
			answer = null
		}
	}
</script>

<Screen onback={goBack}>
	{#snippet header()}<TopBar title="Добавить игрока" onback={goBack} />{/snippet}
	<Card>
		{#if answer}
			<SectionTitle>Покажите QR игроку</SectionTitle>
			<p class="add-player__hint">Покажите этот QR игроку — пусть отсканирует его.</p>
			<QrCode value={answer} />
			<p class="add-player__hint">Экран закроется сам, когда игрок подключится…</p>
		{:else}
			<SectionTitle>Отсканируйте QR игрока</SectionTitle>
			<p class="add-player__hint">Отсканируйте QR-код игрока (его offer).</p>
			<QrScanner onscan={onScanOffer} />
		{/if}
	</Card>
</Screen>

<style>
	.add-player__hint {
		font-size: 0.875rem;
		color: var(--muted-foreground);
	}
</style>
