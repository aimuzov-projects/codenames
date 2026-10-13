import { site } from '#frontend/data/site.ts'

/** Page title: its own name, then a dash and the site name; the home page gets just the site name. */
export function pageTitle(title?: string) {
	return title ? `${title} — ${site.name}` : site.name
}
