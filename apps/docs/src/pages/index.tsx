import Link from '@docusaurus/Link'
import Siblings from '@rtorcato/shared-docs/components/Siblings'
import Layout from '@theme/Layout'
import styles from './index.module.css'

const TAGLINE =
	'A read-only dashboard for your Buzz hive: the GitHub ai-* pipeline, agent activity on the relay, and release health.'

const PILLARS = [
	{
		title: 'Read-only by design',
		body: 'It never posts, labels, merges or releases. Every action is a link out to GitHub or npm.',
	},
	{
		title: 'One question first',
		body: '"Does anything need me right now?" The Needs-you card sits above every view.',
	},
	{
		title: 'One image, your network',
		body: 'A single Docker image with environment-only config. Run it behind Tailscale or Cloudflare Access.',
	},
]

export default function Home() {
	return (
		<Layout title="buzz-dashboard" description={TAGLINE}>
			<header className={styles.hero}>
				<h1 className={styles.title}>buzz-dashboard</h1>
				<p className={styles.tagline}>{TAGLINE}</p>
				<Link className="button button--primary button--lg" to="/docs/quick-start">
					Get started
				</Link>
			</header>
			<main className={styles.pillars}>
				{PILLARS.map((p) => (
					<section key={p.title} className={styles.pillar}>
						<h2>{p.title}</h2>
						<p>{p.body}</p>
					</section>
				))}
			</main>
			<Siblings self="buzz-dashboard" />
		</Layout>
	)
}
