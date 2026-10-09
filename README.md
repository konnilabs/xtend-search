# XTend.search

Meta search engine powered by SearXNG and XTend/Maraca.

XTend.search provides server-rendered, resumable search, XScaler result streaming and a separate operations dashboard. SearXNG remains the Python search core; the public interface and Observatory run in their own XTend/Node container.

Current baseline: **frontend 0.4.2**, **SearXNG adapter 0.4.2**, **XTend 0.8.0 / Hydrangea**.

## Features

- Search modes, filters, browser history and progressively enhanced native forms.
- Streaming results, knowledge cards, result favicons, image preview and XLightbox carousel.
- Nextcloud OAuth2 login with viewer, operator and administrator roles.
- Engine/capability approvals, budgets, diagnostics, quality reports and opt-in cooldown rules.
- Signed SSR resume with descriptor recovery; 0.4.1 fixes native input attributes and removes duplicate HTML from the initial page wire.

New sources require explicit administrative approval. Automatic quality cooldowns are disabled by default.

## Run locally

Prerequisites: Docker Engine with Compose and Node.js 24.18 or newer. The tested build uses Node 24.19.0 and npm 11.17.0.

```sh
git clone https://github.com/konnilabs/xtend-search.git
cd xtend-search
node xtend/scripts/setup-control.mjs
```

Complete the generated, ignored `.env.control` with the Nextcloud OAuth2 client and exact user-to-role mapping. The local callback is `http://localhost:8090/admin/oauth/callback`; on a server use the externally reachable HTTPS base URL followed by `/admin/oauth/callback`.

```sh
docker compose --env-file .env.control -f compose.control.yml up -d --build
curl --fail http://localhost:8090/health/ready
```

Open [localhost:8090](http://localhost:8090) and [the Observatory](http://localhost:8090/admin). The backend uses the private Compose network. Set `XTEND_PORT` to choose another host port.

The pinned SDK archive in `xtend/vendor-inputs/` is required for reproducible builds. The reviewed SSR overlay is checksum-verified before both Maraca build paths.

## Development

Run inside `xtend/`, using the tested Node/npm versions:

```sh
npm ci --ignore-scripts
npm run build:control
npm run test:control
```

GitHub Actions runs this build and test sequence on pushes and pull requests to `main`. It requires no production credentials and publishes no images automatically. Development continues through branches and pull requests; see [CONTRIBUTING.md](CONTRIBUTING.md).

| Path | Purpose |
|---|---|
| `xtend/frontend/`, `xtend/admin/` | Search and Observatory RMT, browser services and styles |
| `xtend/server/` | Standalone host, authentication, control plane and backend integration |
| `xtend/patches/` | Reviewed framework overlays |
| `xtend/tests/` | Unit, contract and browser tests |
| `xtend/docs/`, `xtend/evidence/` | Architecture, operations and measured release evidence |
| `searx/` | Preserved SearXNG Python core and integration adapter |
| `compose.control.yml`, `compose.portainer.yml` | Local builds and deployment of imported images |

## Documentation

- [0.4.2 corporate shell and reviewed core update](xtend/docs/RELEASE-0.4.2.md)
- [Upgrade and rollback](xtend/docs/UPGRADE-0.4.2.md)
- [Operations and Nextcloud configuration](xtend/docs/CONTROL-PLANE-OPERATIONS.md)
- [Quality-report architecture](xtend/docs/ADR-XSEARCH-QUALITY-004.md)
- [Original XTend development notes, in German](README-XTEND.md)
- [Preserved SearXNG documentation](README.rst)

Local environment files, private keys, databases and Docker exports are excluded from Git. Configure secrets through local environment files, Docker/Portainer variables or CI secrets.

## License and upstream

The SearXNG-derived codebase retains its [GNU Affero General Public License v3](LICENSE). Third-party dependencies, including the pinned XTend SDK, retain their own license files and notices. This import does not relicense those dependencies.

SearXNG baseline: `9f042d2f67666f86204d6874488880a23ba81a8f`. Framework fixes are tracked in [konnilabs/xtend#84](https://github.com/konnilabs/xtend/pull/84); the local overlay remains necessary until a compatible framework package is deliberately adopted.

The original SearXNG history is preserved. Its publishing, translation and issue-closing workflows are not active in this repository.
