import { siteChecks } from '@aimuzov-projects/infra-site-kit/playwright/checks'

// The shared checks of infra-site-kit over the sitemap (it holds only the index page): the page
// answers 200 without console errors and passes axe in both schemes. The theme buttons live on the
// settings screen, not on a page of their own, so settings.spec.ts checks them instead of the kit.
siteChecks({
	// The game is a full-screen PWA pinned to the visual viewport (the keyboard handling in
	// base.astro relies on it), a pinch zoom would tear the board and the buttons apart.
	// So the viewport forbids zoom on purpose, and axe's meta-viewport rule is off.
	a11y: { disableRules: ['meta-viewport'] },
})
