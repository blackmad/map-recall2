# Deploying

Two games ship from this repo, and they are two hosts, not two entry points on
one site:

| Hostname | Firebase site | Serves | Built from |
| --- | --- | --- | --- |
| `edumap.blackmad.com` | `edumap-blackmad` | Map Quest | `dist/` |
| `mapquest.blackmad.com` | `canalrecall-blackmad` | Canal Recall | `dist-canalrecall/` |
| `canalrecall.blackmad.com` | `canalrecall-blackmad` | Canal Recall | `dist-canalrecall/` |

Both sites live in the existing `map-recall2-blackmad` Firebase project, which
also holds Firestore. `FIREBASE_SETUP.md` covers the Firestore side.

Until the custom domains are attached, both are reachable at their default URLs:

- https://edumap-blackmad.web.app
- https://canalrecall-blackmad.web.app

GitHub Pages is still wired up in `.github/workflows/deploy-pages.yml` and still
publishes https://blackmad.github.io/map-recall2/. It cannot serve this layout:
Pages allows exactly one custom domain per repository, so it has no way to tell
the two games apart by host. Retire it once the domains are live.

## Why Canal Recall gets its own build directory

`public/canal-drive/index.html` loads its scripts relatively (`js/game.js`) and
its extracts one level up (`../data/extracts/...`). Serving it from a domain
root cannot be done with a Hosting rewrite, because a rewrite maps to a single
file: a `**` rewrite answers `/js/game.js` with `index.html` at status 200, and
the browser refuses to execute HTML as a script.

So `scripts/assemble-canalrecall-site.mjs` (`npm run build:canalrecall-site`)
hoists `dist/canal-drive` into `dist-canalrecall/` and copies `dist/data`
alongside it. At that point every relative path in the page resolves the way it
already expected to, with no rewrites at all.

Two Firebase Hosting behaviours are worth knowing before editing
`firebase.json`, because each one cost a deploy to discover:

- `ignore` globs are matched **relative to the site's `public` directory**, not
  the project root, despite the project-root-looking defaults.
- A matching **static file is served before any rewrite is consulted**. This is
  what had Map Quest's `index.html` winning `/` on the Canal Recall site.

Both sites ignore `**/*.md`. `TODO.md`, `WIP.md` and `HISTORY.md` live inside
`public/canal-drive`, so without that they are served as public pages.

## Deploying by hand

```sh
npm run build                     # writes dist/
npm run build:canalrecall-site    # writes dist-canalrecall/ from dist/
npx firebase-tools@15 deploy --only hosting --project map-recall2-blackmad
```

Set `VITE_CANAL_RECALL_URL` on the build to point Map Quest's "Canal Recall →"
link at the other host. Without it the link falls back to the sibling
`canal-drive/` path, which only exists on a build that serves both from one
origin.

To publish one site only, use `--only hosting:edumap` or
`--only hosting:canalrecall`. The target names are mapped to site IDs in
`.firebaserc`.

**Use `npx firebase-tools`, not a Homebrew-installed `firebase`.** On this
machine the Homebrew CLI is SIGKILLed instantly on any `deploy` — exit 137, no
output, even when detached from the shell — while every read-only command
works. `superstatic` declares support for Node 20/22/24 and Homebrew's CLI runs
on Node 26, which is the likeliest cause. CI pins Node 24.

## Automatic deploys from `main`

`.github/workflows/deploy-firebase.yml` builds, assembles, and publishes both
sites on every push to `main`. It needs one secret that is not yet set:

1. Firebase console → Project settings → Service accounts → **Generate new
   private key**.
2. `gh secret set FIREBASE_SERVICE_ACCOUNT < path/to/key.json`

The workflow writes that JSON to a temp file, points
`GOOGLE_APPLICATION_CREDENTIALS` at it, and removes it afterwards.

## Attaching the custom domains

DNS for `blackmad.com` is **not** in Route53. The domain is registered at
Namecheap and its zone is served by Namecheap BasicDNS
(`dns1`/`dns2.registrar-servers.com`), so records are edited in the Namecheap
dashboard. The only Route53 hosted zone on the AWS account is `whizziwig.com`.

### 1. Firebase console

For each row of the table at the top of this file: Hosting → select the site →
**Add custom domain**. Each domain yields a TXT verification value and then two
A records. These are generated per domain and cannot be predicted in advance.

### 2. Namecheap

Domain List → `blackmad.com` → **Manage** → **Advanced DNS** → **Add New
Record**. The Host field takes only the label, not the fully-qualified name:

| Type | Host | Value | TTL |
| --- | --- | --- | --- |
| TXT | `edumap` | *(verification value from the console)* | Automatic |
| A | `edumap` | *(A record 1 from the console)* | Automatic |
| A | `edumap` | *(A record 2 from the console)* | Automatic |

Repeat for `mapquest` and `canalrecall`. Firebase currently hands out
`199.36.158.100`, but use whatever the console shows rather than that value from
memory.

TTL "Automatic" is 30 minutes at Namecheap. Drop it to 1 minute while verifying
and restore it afterwards.

### The wildcard

The zone has a wildcard `*.blackmad.com` A record pointing at `45.63.21.43`, a
Vultr host that times out on both :80 and :443. It is why every unclaimed
subdomain — `edumap`, `mapquest`, `canalrecall`, and anything else — already
resolves to nothing rather than failing to resolve.

Explicit host records take precedence over a wildcard, so the records above work
without touching it. It is still a dead catch-all for the whole domain and worth
deleting once nothing else is found to depend on it.

### Namecheap from the CLI

There is no official Namecheap CLI. Their XML API can do it, but it needs API
access enabled on the account (which has an eligibility bar: 20+ domains, $50+
balance, or $50+ spent in the last two years), an API key, and your current
public IP allow-listed. The important trap: `namecheap.domains.dns.setHosts`
**replaces the entire record set**. Any script has to `getHosts` first and
re-send every existing record alongside the new ones, or it silently wipes the
zone — including the apex Vercel records and any MX.

Moving the zone to Route53 is the better path if CLI-managed DNS matters, since
the AWS credentials on this machine already work.
