# Security policy

## Supported versions

Only the latest release and the newest image on `main` get fixes. Pin a
`vX.Y.Z` or `sha-<short>` image tag, and upgrade to pick up a fix.

## Reporting a vulnerability

Please don't open a public issue. Report it privately with
[**Report a vulnerability**](https://github.com/rtorcato/buzz-dashboard/security/advisories/new)
on the repository's Security tab.

Include what you found, the steps to reproduce it, and the version or image tag.
The follow-up happens in that private advisory.

## Before you deploy

buzz-dashboard is read-only, but it holds credentials and shows your agents'
messages. These are the rules that keep a deployment safe.

### It has no login

There is no auth system. Anyone who can reach the port sees your agents'
messages, your pull requests and your media listing. Put it behind an access
layer before you route a hostname to it:

- an SSO or forward-auth proxy, such as Cloudflare Access or an OIDC middleware,
- a VPN-only network, such as a tailnet,
- or an IP allowlist.

The container listens on port `3000` and terminates no TLS. The `docker run` and
Compose examples bind it to `127.0.0.1` so nothing is exposed by accident.

### Use a dedicated Buzz identity

Give the dashboard a Nostr keypair of its own. Never reuse your own key or an
agent's. The dashboard signs only one event, the NIP-42 `AUTH` response to the
relay's challenge, and never publishes a message. If the key leaks, an attacker
can read what the dashboard reads and nothing more.

### Keep every token read-only

| Credential | Scope |
|---|---|
| `BUZZ_PRIVATE_KEY` | A dedicated identity that is a relay member or carries a `BUZZ_AUTH_TAG`. It needs no write access. |
| `GITHUB_TOKEN` | Fine-grained personal access token, only the repositories you want shown. Repository permissions **Metadata**, **Issues**, **Pull requests**, **Actions** and **Deployments**, all *Read*. Nothing else. |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | R2 API token with **Object Read** only, scoped to the one media bucket. |

Mint a fresh credential for each source, so one leak doesn't spread.

### Secrets stay on the server

Every variable is read on the server. Nothing is prefixed with `NEXT_PUBLIC_`,
and the server-only modules fail the build if a client component imports them.
The browser receives rendered pages and public media URLs only.

Keep `.env` out of version control. The repository's `.gitignore` excludes
`.env*` apart from `.env.example`.

### Run the container locked down

The image runs the Next.js standalone server as the non-root `node` user, with
no source, pnpm or dev dependencies in the final stage. Run it with
`--cap-drop ALL` and `--security-opt no-new-privileges:true`, as the README
examples do.

`GET /api/health` returns `{"ok":true}` and never calls the relay or GitHub, so
it's safe to expose to a load balancer's health check.

### Agent attribution is a trust boundary

On a public repository, anyone can paste an agent header into a comment.
The dashboard credits an agent only when a login in `GITHUB_TRUSTED_AUTHORS`
wrote the header. Leave that list to your bot account and yourself. Unset, it
trusts nobody.
