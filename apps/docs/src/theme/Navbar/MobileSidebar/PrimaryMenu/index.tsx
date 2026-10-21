import Link from '@docusaurus/Link'
import { useLocation } from '@docusaurus/router'
import useBaseUrl from '@docusaurus/useBaseUrl'
import { projectFamilyItems } from '@rtorcato/shared-docs'
import { type ReactElement, useEffect, useRef } from 'react'

/**
 * Swizzled (replace) theme/Navbar/MobileSidebar/PrimaryMenu: a single flat
 * list instead of the primary→secondary drawer flow. Keep ITEMS in step with the
 * navbar in docusaurus.config.ts by hand.
 *
 * On doc pages the doc plugin's mobile-sidebar filler makes Layout set `inert`
 * on the primary panel, which leaves these links unclickable — a
 * MutationObserver strips it. The drawer also stops auto-closing after the
 * swizzle, so each link tap clicks `.navbar-sidebar__close` on the next tick.
 */
const ITEMS: Array<{ label: string; to?: string; href?: string }> = [
	{ label: 'Docs', to: '/docs' },
	...projectFamilyItems(),
	{ label: 'GitHub', href: 'https://github.com/rtorcato/buzz-dashboard' },
]

function closeDrawer(): void {
	setTimeout(() => document.querySelector<HTMLButtonElement>('.navbar-sidebar__close')?.click(), 0)
}

function MenuLink({ item }: { item: (typeof ITEMS)[number] }): ReactElement {
	const { pathname } = useLocation()
	const resolved = useBaseUrl(item.to ?? '/')
	const isActive = item.to !== undefined && pathname === resolved
	const className = [
		'jt-mobile-menu__link',
		isActive && 'jt-mobile-menu__link--active',
		item.href && 'jt-mobile-menu__external',
	]
		.filter(Boolean)
		.join(' ')
	const linkProps = item.href ? { href: item.href } : { to: item.to ?? '/' }
	return (
		<li>
			<Link
				className={className}
				{...linkProps}
				onClick={closeDrawer}
				aria-current={isActive ? 'page' : undefined}
			>
				{item.label}
			</Link>
		</li>
	)
}

export default function NavbarMobilePrimaryMenu(): ReactElement {
	const ref = useRef<HTMLUListElement>(null)

	useEffect(() => {
		const panel = ref.current?.closest<HTMLElement>('.navbar-sidebar__item')
		if (!panel) return
		const strip = () => panel.removeAttribute('inert')
		strip()
		const observer = new MutationObserver(strip)
		observer.observe(panel, { attributes: true, attributeFilter: ['inert'] })
		return () => observer.disconnect()
	}, [])

	return (
		<ul ref={ref} className="jt-mobile-menu">
			{ITEMS.map((item) => (
				<MenuLink key={item.label} item={item} />
			))}
		</ul>
	)
}
