import { shuffle, type Rng, type Role, type Team } from '#frontend/game/index.ts'
import type { PlayerInfo } from '#frontend/transport/messages.ts'

/**
 * Pure lobby logic: assigning new players to teams/roles,
 * the "one spymaster per team" rule and the roster readiness check.
 * No atoms, so the host, the guest and the UI can all reuse it.
 */

const TEAMS: readonly Team[] = ['red', 'blue']

/** Whether the team has a spymaster (other than the given player). */
export function teamHasSpymaster(roster: PlayerInfo[], team: Team, exceptId?: string): boolean {
	return roster.some((p) => p.team === team && p.role === 'spymaster' && p.id !== exceptId)
}

function teamSize(roster: PlayerInfo[], team: Team): number {
	return roster.reduce((n, p) => (p.team === team ? n + 1 : n), 0)
}

/**
 * Picks a seat for a new participant: the team with fewer players
 * (on a tie, the one without a spymaster yet, otherwise red); the role is spymaster
 * if the chosen team has none, otherwise operative.
 */
export function pickSlot(roster: PlayerInfo[]): { team: Team; role: Role } {
	const [a, b] = TEAMS as [Team, Team]
	let team: Team

	if (teamSize(roster, a) !== teamSize(roster, b)) {
		team = teamSize(roster, a) < teamSize(roster, b) ? a : b
	} else if (!teamHasSpymaster(roster, a)) {
		team = a
	} else if (!teamHasSpymaster(roster, b)) {
		team = b
	} else {
		team = a
	}

	return { team, role: teamHasSpymaster(roster, team) ? 'operative' : 'spymaster' }
}

/**
 * Brings the requested team/role to a valid one: if spymaster is requested but the
 * team already has another spymaster, the role is downgraded to operative.
 */
export function resolveSetup(roster: PlayerInfo[], selfId: string, team: Team, role: Role): { team: Team; role: Role } {
	if (role === 'spymaster' && teamHasSpymaster(roster, team, selfId)) {
		return { team, role: 'operative' }
	}

	return { team, role }
}

/**
 * Whether the roster is ready to start: among connected players every team has
 * at least one spymaster and at least one operative.
 */
export function isRosterReady(roster: PlayerInfo[]): boolean {
	const online = roster.filter((p) => p.connected)

	return TEAMS.every(
		(team) =>
			online.some((p) => p.team === team && p.role === 'spymaster') &&
			online.some((p) => p.team === team && p.role === 'operative'),
	)
}

/**
 * Fully reshuffles the roster: randomly splits all connected players (host included)
 * evenly between teams and makes exactly one spymaster per team with the rest as
 * operatives, so the result always passes {@link isRosterReady}.
 * Offline participants stay in their teams but are downgraded to operatives, so they
 * don't hold a "phantom" spymaster seat. With fewer than 4 connected the roster is unchanged.
 */
export function reshuffleRoster(roster: PlayerInfo[], rng: Rng = Math.random): PlayerInfo[] {
	const connected = roster.filter((p) => p.connected)

	if (connected.length < 4) return roster

	const shuffled = shuffle(connected, rng)
	const redCount = Math.ceil(shuffled.length / 2)
	const slots = new Map<string, { team: Team; role: Role }>()

	shuffled.forEach((p, i) => {
		const team: Team = i < redCount ? 'red' : 'blue'
		const isFirstOfTeam = i === 0 || i === redCount

		slots.set(p.id, { team, role: isFirstOfTeam ? 'spymaster' : 'operative' })
	})

	return roster.map((p) => {
		const slot = slots.get(p.id)

		if (slot) return { ...p, ...slot }

		return p.role === 'spymaster' ? { ...p, role: 'operative' } : p
	})
}

/** Random valid setup different from the current one (spymaster only if the seat is free). */
export function randomSetup(
	roster: PlayerInfo[],
	selfId: string,
	current: { team: Team; role: Role },
	rng: Rng = Math.random,
): { team: Team; role: Role } {
	const candidates: { team: Team; role: Role }[] = []

	for (const team of TEAMS) {
		candidates.push({ team, role: 'operative' })

		if (!teamHasSpymaster(roster, team, selfId)) candidates.push({ team, role: 'spymaster' })
	}

	const others = candidates.filter((c) => c.team !== current.team || c.role !== current.role)
	const pool = others.length > 0 ? others : candidates

	return pool[Math.floor(rng() * pool.length)]!
}
