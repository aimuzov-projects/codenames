<script lang="ts" module>
	import { composerOpenAtom } from '#frontend/state/ui.ts'

	// Holder of the mounted input: `openComposer` focuses it synchronously within the tap --
	// otherwise iOS doesn't raise the keyboard. The input stays premounted the whole time the spymaster
	// can give a clue: Svelte updates the DOM in a microtask, and opening the overlay via the atom
	// happens after the gesture handler is already done.
	let clueInputEl: HTMLInputElement | null = null

	/** Open the clue input overlay and focus the field synchronously (see the comment on `clueInputEl`). */
	export function openComposer() {
		composerOpenAtom.set(true)
		// preventScroll: otherwise the browser also "scrolls" the page to the field on focus. The bar already
		// sits above the keyboard (the #root shell is pinned to visualViewport), so that scroll isn't needed.
		clueInputEl?.focus({ preventScroll: true })
	}
</script>

<script lang="ts">
	import CornerDownLeft from '@lucide/svelte/icons/corner-down-left'
	import Minus from '@lucide/svelte/icons/minus'
	import Plus from '@lucide/svelte/icons/plus'

	import Button from '#frontend/components/ui/button.svelte'
	import { giveClue, modeAtom, myRoleAtom, myTeamAtom, viewAtom, viewRoleAtom } from '#frontend/state/session.ts'

	let word = $state('')
	let num = $state(2)
	let barShown = $state(false)

	const team = $derived($viewAtom?.currentTeam ?? 'red')
	const canCompose = $derived(
		$viewAtom?.phase === 'clue' &&
			($modeAtom === 'local'
				? $viewRoleAtom === 'spymaster'
				: $myTeamAtom === team && $myRoleAtom === 'spymaster'),
	)
	const open = $derived($composerOpenAtom)

	// The composer bar fades in 250ms after opening -- via separate state, not CSS transition-delay:
	// that way opacity changes on an already visible overlay and the transition isn't "swallowed".
	$effect(() => {
		if (!open) {
			barShown = false

			return
		}

		const id = setTimeout(() => (barShown = true), 250)

		return () => clearTimeout(id)
	})

	// Reset on leaving clue mode (clue given / role changed / game over).
	$effect(() => {
		if (canCompose) return

		composerOpenAtom.set(false)
		word = ''
		num = 2
	})

	// Close on Esc (desktop).
	$effect(() => {
		if (!open) return

		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') composerOpenAtom.set(false)
		}

		window.addEventListener('keydown', onKey)

		return () => window.removeEventListener('keydown', onKey)
	})

	const close = () => composerOpenAtom.set(false)

	function submit() {
		const w = word.trim()

		if (!w) return

		giveClue(w, num)
		word = ''
		num = 2
		composerOpenAtom.set(false)
	}

	// A clue is one word: keep only the first non-whitespace token (a space doesn't get through).
	// The field value is rewritten by hand: if the token didn't change, Svelte won't touch the DOM itself.
	function oninput(event: Event & { currentTarget: HTMLInputElement }) {
		word = event.currentTarget.value.match(/\S+/)?.[0] ?? ''
		event.currentTarget.value = word
	}

	// The counter chip darkens smoothly as the number grows (1 -- light, 9 -- dark) on an absolute scale.
	const bgL = $derived(0.94 - ((num - 1) / 8) * (0.94 - 0.3))

	/**
	 * Moves the overlay into `#root` -- the shell pinned to `visualViewport` (see app.svelte). The overlay
	 * is then positioned against the visible area, the composer row at the bottom edge sits right above
	 * the keyboard, and the field leaves the screen's scroll container: iOS has nothing to scroll.
	 */
	function portal(node: HTMLElement) {
		;(document.getElementById('root') ?? document.body).append(node)

		return () => node.remove()
	}

	function inputRef(node: HTMLInputElement) {
		clueInputEl = node

		return () => {
			if (clueInputEl === node) clueInputEl = null
		}
	}
</script>

{#if canCompose}
	<div class="clue-composer clue-composer--{team}" class:clue-composer--open={open} {@attach portal}>
		<!-- The backdrop stretches far beyond #root (up and down) so no light strip is left under the
		     keyboard; body clips the edges anyway. A tap closes it. -->
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<div class="clue-composer__backdrop" onclick={close}></div>

		<!-- Composer row at the bottom edge of the shell -- which is also right above the keyboard. -->
		<div class="clue-composer__dock">
			<!-- The bar fades in as a whole after 250ms (see barShown): the pause hides the jitter while
			     the keyboard slides in. -->
			<div class="clue-composer__bar" class:clue-composer__bar--shown={barShown}>
				<input
					class="clue-composer__input"
					value={word}
					{oninput}
					onkeydown={(event) => event.key === 'Enter' && submit()}
					autocapitalize="none"
					enterkeyhint="send"
					{@attach inputRef}
				/>
				<!-- preventDefault on mousedown so a tap on the ± buttons doesn't take focus from the clue field
				     and hide the keyboard (click still fires as usual). -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="clue-composer__stepper"
					style:background-color="oklch({bgL} 0.008 60)"
					style:color="oklch({bgL > 0.62 ? 0.22 : 0.97} 0.005 60)"
					onmousedown={(event) => event.preventDefault()}
				>
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label="Меньше"
						onclick={() => (num = Math.max(1, num - 1))}
					>
						<Minus />
					</Button>
					<span class="clue-composer__count" data-testid="clue-count">{num}</span>
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label="Больше"
						onclick={() => (num = Math.min(9, num + 1))}
					>
						<Plus />
					</Button>
				</div>
				<span class="clue-composer__send">
					<Button size="icon" ripple onclick={submit} disabled={!word.trim()} aria-label="Дать">
						<CornerDownLeft />
					</Button>
				</span>
			</div>
		</div>
	</div>
{/if}

<style>
	.clue-composer {
		--team: var(--team-red);
		--team-fg: var(--team-red-foreground);

		pointer-events: none;
		position: absolute;
		z-index: 50;
		inset: 0;
		opacity: 0;
		transition: opacity 200ms;

		&--blue {
			--team: var(--team-blue);
			--team-fg: var(--team-blue-foreground);
		}

		&--open {
			pointer-events: auto;
			opacity: 1;
		}

		&__backdrop {
			position: absolute;
			inset-inline: 0;
			top: -50vh;
			height: 250vh;
			background: oklch(0 0 0 / 20%);
		}

		&__dock {
			position: absolute;
			inset-inline: 0;
			bottom: 0;
			padding: 0 0.75rem 0.75rem;
		}

		&__bar {
			position: relative;
			display: flex;
			gap: 0.5rem;
			align-items: center;
			height: 70px;
			padding-inline: 0.75rem;
			border: 1px solid var(--border);
			border-left: 4px solid var(--team);
			border-radius: var(--radius-xl);
			opacity: 0;
			background: var(--card);
			transition: opacity 500ms;

			&--shown {
				opacity: 1;
			}
		}

		&__input {
			flex: 1;
			min-width: 0;
			padding-inline: 0.5rem;
			border: 0;
			font-size: 1rem;
			font-weight: 600;
			text-transform: lowercase;
			letter-spacing: 0.025em;
			background: transparent;
			outline: none;
		}

		&__stepper {
			display: flex;
			gap: 0.25rem;
			align-items: center;
			padding: 0.25rem 0.375rem;
			border-radius: var(--radius-lg);
			transition:
				background-color 300ms,
				color 300ms;
		}

		&__count {
			min-width: 1rem;
			font-weight: 700;
			text-align: center;
		}

		/* The "Give" button in the team color: repaint it via the primary variables. */
		&__send {
			--primary: var(--team);
			--primary-foreground: var(--team-fg);

			display: contents;
		}
	}
</style>
