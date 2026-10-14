import { E2E } from '#frontend/lib/e2e.ts'
import { decodeSignal, encodeSignal } from '#frontend/signaling/codec.ts'
import type { SignalDescription } from '#frontend/signaling/types.ts'

/**
 * WebRTC over the local network (hotspot) with offline signaling via QR/string.
 * Non-trickle ICE: wait for candidate gathering, then serialize the full SDP.
 * No STUN/TURN: host candidates are enough on a single LAN.
 */
const RTC_CONFIG: RTCConfiguration = { iceServers: [] }
const CHANNEL = 'codenames'
const ICE_TIMEOUT_MS = 4000

type Unsub = () => void

/** Waits for ICE candidate gathering to finish (with a fallback timeout). */
function waitIceComplete(pc: RTCPeerConnection): Promise<void> {
	if (pc.iceGatheringState === 'complete') return Promise.resolve()

	return new Promise((resolve) => {
		const finish = () => {
			pc.removeEventListener('icegatheringstatechange', check)
			clearTimeout(timer)
			resolve()
		}
		const check = () => {
			if (pc.iceGatheringState === 'complete') finish()
		}
		const timer = setTimeout(finish, ICE_TIMEOUT_MS)

		pc.addEventListener('icegatheringstatechange', check)
	})
}

function localCode(pc: RTCPeerConnection): string {
	const desc = pc.localDescription

	if (!desc) throw new Error('Нет локального описания')

	return encodeSignal({ type: desc.type as 'offer' | 'answer', sdp: desc.sdp })
}

/**
 * e2e hook: on the receiving side, duplicates each host candidate with a copy on 127.0.0.1, same
 * port (the socket listens on 0.0.0.0). Both Playwright contexts are on one machine, but behind a VPN
 * the only host candidate becomes the VPN interface, over which the two sockets don't connect,
 * and Chromium doesn't offer loopback. Applied to the remote SDP before setRemoteDescription (not to
 * the outgoing code: the codec would filter loopback out, see isUsefulCandidate in sdp.ts). Only under
 * VITE_E2E; in prod the signal is left untouched.
 */
function patchSignalForE2E(desc: SignalDescription): SignalDescription {
	if (!E2E) return desc

	const out: string[] = []

	for (const line of desc.sdp.split('\r\n')) {
		out.push(line)
		const m = line.match(/^a=candidate:(\S+) (\d+) (udp|UDP) (\d+) (\S+) (\d+) typ host(.*)$/)

		if (m && m[5] !== '127.0.0.1') {
			out.push(`a=candidate:${m[1]}lo ${m[2]} ${m[3]} ${m[4]} 127.0.0.1 ${m[6]} typ host${m[7]}`)
		}
	}

	return { type: desc.type, sdp: out.join('\r\n') }
}

/** Thin wrapper over DataChannel: typed subscriptions and sending JSON. */
class Channel<TIn, TOut> {
	private messageCbs = new Set<(msg: TIn) => void>()
	private openCbs = new Set<() => void>()
	private closeCbs = new Set<() => void>()
	private channel: RTCDataChannel | null = null

	attach(channel: RTCDataChannel) {
		this.channel = channel
		channel.onopen = () => this.openCbs.forEach((cb) => cb())
		channel.onclose = () => this.closeCbs.forEach((cb) => cb())

		channel.onmessage = (e) => {
			const msg = JSON.parse(e.data as string) as TIn

			this.messageCbs.forEach((cb) => cb(msg))
		}

		if (channel.readyState === 'open') this.openCbs.forEach((cb) => cb())
	}

	get open() {
		return this.channel?.readyState === 'open'
	}

	send(msg: TOut) {
		if (this.channel?.readyState === 'open') this.channel.send(JSON.stringify(msg))
	}

	onMessage(cb: (msg: TIn) => void): Unsub {
		this.messageCbs.add(cb)

		return () => this.messageCbs.delete(cb)
	}
	onOpen(cb: () => void): Unsub {
		this.openCbs.add(cb)

		return () => this.openCbs.delete(cb)
	}
	onClose(cb: () => void): Unsub {
		this.closeCbs.add(cb)

		return () => this.closeCbs.delete(cb)
	}
}

/** Guest-side connection (initiator: creates the offer and the DataChannel). */
export class GuestConnection<TIn = unknown, TOut = unknown> {
	private pc = new RTCPeerConnection(RTC_CONFIG)
	private chan = new Channel<TIn, TOut>()

	constructor() {
		this.chan.attach(this.pc.createDataChannel(CHANNEL))
	}

	/** Creates the offer code to show the host (QR/string). */
	async createOfferCode(): Promise<string> {
		await this.pc.setLocalDescription(await this.pc.createOffer())
		await waitIceComplete(this.pc)

		return localCode(this.pc)
	}

	/** Accepts the answer code from the host; after that the channel opens. */
	async acceptAnswerCode(code: string): Promise<void> {
		await this.pc.setRemoteDescription(patchSignalForE2E(decodeSignal(code)))
	}

	send(msg: TOut) {
		this.chan.send(msg)
	}
	get open() {
		return this.chan.open
	}
	onMessage(cb: (msg: TIn) => void) {
		return this.chan.onMessage(cb)
	}
	onOpen(cb: () => void) {
		return this.chan.onOpen(cb)
	}
	onClose(cb: () => void) {
		return this.chan.onClose(cb)
	}
	close() {
		this.pc.close()
	}
}

/** Host-side connection to a specific guest (the answerer). */
export class HostConnection<TIn = unknown, TOut = unknown> {
	private pc = new RTCPeerConnection(RTC_CONFIG)
	private chan = new Channel<TIn, TOut>()
	readonly id: string

	constructor(id: string) {
		this.id = id
		this.pc.ondatachannel = (e) => this.chan.attach(e.channel)
	}

	/** Accepts the guest's offer code and returns the answer code to show them. */
	async acceptOfferCode(code: string): Promise<string> {
		await this.pc.setRemoteDescription(patchSignalForE2E(decodeSignal(code)))
		await this.pc.setLocalDescription(await this.pc.createAnswer())
		await waitIceComplete(this.pc)

		return localCode(this.pc)
	}

	send(msg: TOut) {
		this.chan.send(msg)
	}
	get open() {
		return this.chan.open
	}
	onMessage(cb: (msg: TIn) => void) {
		return this.chan.onMessage(cb)
	}
	onOpen(cb: () => void) {
		return this.chan.onOpen(cb)
	}
	onClose(cb: () => void) {
		return this.chan.onClose(cb)
	}
	close() {
		this.pc.close()
	}
}
