<script lang="ts" module>
	import { composerOpenAtom } from '#frontend/state/ui.ts'

	// Держатель смонтированного поля ввода: `openComposer` фокусирует его синхронно в рамках тапа --
	// иначе на iOS не поднимается клавиатура. Поле держим предмонтированным всё время, пока капитан
	// может давать подсказку: Svelte обновляет DOM микротаском, и открытие оверлея по атому
	// происходит уже после обработчика жеста.
	let clueInputEl: HTMLInputElement | null = null

	/** Открыть оверлей ввода подсказки и синхронно сфокусировать поле (см. коммент к `clueInputEl`). */
	export function openComposer() {
		composerOpenAtom.set(true)
		// preventScroll: иначе браузер дополнительно «подматывает» страницу к полю при фокусе. Бар и так
		// сидит над клавиатурой (оболочка #root прижата к visualViewport), поэтому подмотка не нужна.
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

	// Плашка композера проявляется через 250мс после открытия -- отдельным стейтом, а не CSS
	// transition-delay: тогда opacity меняется уже на видимом оверлее и переход не «проглатывается».
	$effect(() => {
		if (!open) {
			barShown = false
			return
		}
		const id = setTimeout(() => (barShown = true), 250)
		return () => clearTimeout(id)
	})

	// Сброс при выходе из режима подсказки (выдали подсказку / сменили роль / конец игры).
	$effect(() => {
		if (canCompose) return
		composerOpenAtom.set(false)
		word = ''
		num = 2
	})

	// Закрытие по Esc (десктоп).
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

	// Подсказка -- одно слово: оставляем только первый непробельный токен (пробел не проходит).
	// Значение поля переписываем руками: если токен не изменился, Svelte сам DOM не тронет.
	function oninput(event: Event & { currentTarget: HTMLInputElement }) {
		word = event.currentTarget.value.match(/\S+/)?.[0] ?? ''
		event.currentTarget.value = word
	}

	// Плашка счётчика плавно темнеет с ростом числа (1 -- светлая, 9 -- тёмная) на абсолютной шкале.
	const bgL = $derived(0.94 - ((num - 1) / 8) * (0.94 - 0.3))

	/**
	 * Выносит оверлей в `#root` -- оболочку, прижатую к `visualViewport` (см. app.svelte). Так оверлей
	 * отсчитывается от видимой области, строка композера у нижней кромки оказывается ровно над
	 * клавиатурой, а поле уходит из прокручиваемого контейнера экрана: iOS нечего проматывать.
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
		<!-- Затемнение растянуто далеко за пределы #root (вверх и вниз), чтобы под клавиатурой не
		     оставалось светлой полосы; края всё равно обрежет body. Тап закрывает. -->
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<div class="clue-composer__backdrop" onclick={close}></div>

		<!-- Строка композера у нижней кромки оболочки -- она же над клавиатурой. -->
		<div class="clue-composer__dock">
			<!-- Плашку проявляем целиком через 250мс (см. barShown): пауза скрывает мельтешение, пока
			     доезжает клавиатура. -->
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
				<!-- preventDefault на mousedown -- чтобы тап по ±-кнопкам не уводил фокус с поля подсказки
				     и не прятал клавиатуру (click при этом срабатывает как обычно). -->
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

		/* Кнопка «Дать» в цвет команды: перекрашиваем её через переменные primary. */
		&__send {
			--primary: var(--team);
			--primary-foreground: var(--team-fg);

			display: contents;
		}
	}
</style>
