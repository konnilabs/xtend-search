# Contributing to XTend.search

Create a branch from `main`, make a focused change and open a pull request against `main` in [konnilabs/xtend-search](https://github.com/konnilabs/xtend-search).

1. Use Node 24.19.0 and npm 11.17.0 for the current baseline.
2. In `xtend/`, run `npm ci --ignore-scripts`, `npm run build:control` and `npm run test:control`.
3. Run relevant browser/Docker fixtures when changing navigation, streaming, preview, the Observatory or progressive enhancement.
4. Describe the concrete problem, resulting behavior and validation. Keep engine/capability policies, privacy limits and signed resume contracts intact.
5. Keep credentials, databases, private keys and image archives out of commits. Use releases for distributable Docker archives.

Fixture scripts use explicitly named test containers and mock OAuth accounts. Read their deployment assumptions before running them alongside an existing installation. Production Nextcloud credentials are not required by CI.

Framework defects belong in [konnilabs/xtend](https://github.com/konnilabs/xtend). Record local SDK overlays in `xtend/patches/`, with upstream references and checksums. Do not silently edit installed `node_modules` or remove checksum checks.

The checked-in SDK archive is a required build input. Treat replacement as a reviewed dependency update, with bundle/SSR and regression measurements. Preserve upstream licenses and notices.

The original `README.rst`, `CONTRIBUTING.rst` and `AI_POLICY.rst` describe SearXNG upstream. They are not this fork's GitHub automation. Follow the upstream project's own requirements when submitting changes there.
