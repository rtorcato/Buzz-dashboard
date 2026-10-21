import type * as Preset from '@docusaurus/preset-classic'
import type { Config } from '@docusaurus/types'
import { GITHUB_PROFILE, footerCopyright, projectFamilyItems } from '@rtorcato/shared-docs'
import { themes as prismThemes } from 'prism-react-renderer'

const config: Config = {
	title: 'buzz-dashboard',
	tagline: 'A read-only dashboard for your Buzz hive: the GitHub ai-* pipeline, agent activity on the relay, and release health.',
	favicon: 'img/favicon.ico',

	url: 'https://docs.torcato.dev',
	baseUrl: '/buzz-dashboard/',

	organizationName: 'rtorcato',
	projectName: 'buzz-dashboard',

	onBrokenLinks: 'warn',

	markdown: {
		format: 'detect',
		hooks: {
			onBrokenMarkdownLinks: 'warn',
		},
	},

	i18n: {
		defaultLocale: 'en',
		locales: ['en'],
	},

	presets: [
		[
			'classic',
			{
				docs: {
					sidebarPath: './sidebars.ts',
					routeBasePath: '/docs',
					editUrl: 'https://github.com/rtorcato/buzz-dashboard/edit/main/apps/docs/',
				},
				blog: false,
				theme: {
					customCss: './src/css/custom.css',
				},
			} satisfies Preset.Options,
		],
	],

	plugins: [
		'@rtorcato/shared-docs/docusaurus',
		[
			'@easyops-cn/docusaurus-search-local',
			{
				hashed: true,
				indexDocs: true,
				indexBlog: false,
				docsRouteBasePath: '/docs',
				highlightSearchTermsOnTargetPage: true,
				searchBarShortcutHint: false,
			},
		],
	],

	themeConfig: {
		image: 'img/social-card.png',
		colorMode: {
			defaultMode: 'dark',
			respectPrefersColorScheme: true,
		},
		navbar: {
			title: 'buzz-dashboard',
			logo: { alt: 'buzz-dashboard', src: 'img/favicon.svg' },

			items: [
				{ to: '/docs', position: 'left', label: 'Docs' },
				{
					type: 'dropdown',
					label: 'Projects',
					position: 'left',
					items: [...projectFamilyItems(), { label: 'All on GitHub →', href: GITHUB_PROFILE }],
				},
				{ href: 'https://github.com/rtorcato/buzz-dashboard', label: 'GitHub', position: 'right' },
			],
		},
		footer: {
			style: 'dark',
			links: [
				{
					title: 'Docs',
					items: [
						{ label: 'Quick start', to: '/docs/quick-start' },
						{ label: 'Configuration', to: '/docs/configuration' },
						{ label: 'Security', to: '/docs/security' },
					],
				},
				{
					title: 'More',
					items: [
						{ label: 'GitHub', href: 'https://github.com/rtorcato/buzz-dashboard' },
						{ label: 'Issues', href: 'https://github.com/rtorcato/buzz-dashboard/issues' },
					],
				},
				{ title: 'Projects', items: projectFamilyItems() },
			],
			copyright: footerCopyright(),
		},
		// `theme` is the LIGHT-mode Prism theme and `darkTheme` the dark one; the
		// shared stylesheet assumes this pairing.
		prism: {
			theme: prismThemes.vsLight,
			darkTheme: prismThemes.vsDark,
			additionalLanguages: ['bash', 'json', 'typescript'],
		},
	} satisfies Preset.ThemeConfig,
}

export default config
