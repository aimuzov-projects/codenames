import { reatomComponent } from '@reatom/react'
import { BookOpen, Play, RotateCcw, ScrollText } from 'lucide-react'
import { resumeSession, savedSessionAtom } from '@/state/net.ts'
import { goTo } from '@/state/ui.ts'
import { Footer } from '@/ui/components/Footer.tsx'
import { MenuButton } from '@/ui/components/MenuButton.tsx'
import { MenuLayout } from '@/ui/components/MenuLayout.tsx'
import { Screen } from '@/ui/components/Screen.tsx'
import { TopBar } from '@/ui/components/TopBar.tsx'

export const Home = reatomComponent(() => {
	// Сетевая партия, не закрытая явно (приложение выгрузили из памяти или закрыли по ошибке).
	const saved = savedSessionAtom()

	return (
		<Screen staticBody header={<TopBar />}>
			<MenuLayout>
				{saved && (
					<MenuButton icon={<RotateCcw />} accent onClick={() => resumeSession()}>
						Вернуться в игру
					</MenuButton>
				)}
				<MenuButton icon={<Play />} accent={!saved} onClick={() => goTo('play')}>
					Играть
				</MenuButton>
				<MenuButton icon={<BookOpen />} variant="outline" onClick={() => goTo('dicts')}>
					Словари
				</MenuButton>
				<MenuButton icon={<ScrollText />} variant="outline" onClick={() => goTo('rules')}>
					Правила
				</MenuButton>
			</MenuLayout>
			<Footer />
		</Screen>
	)
})
