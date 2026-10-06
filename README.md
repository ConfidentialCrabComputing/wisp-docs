# wisp-docs

The public documentation of [Wisp](https://usewisp.io), served at **docs.usewisp.io**. A
[Docusaurus](https://docusaurus.io/) site; every page is Markdown under `docs/`, in three
sections, each with its own sidebar: how Wisp works (`docs/how-it-works/`), the desktop app
(`docs/desktop/`) and the Runtime (the pages directly under `docs/`).

The repository is public on purpose: the site is what `usewisp.io` serves, and
`wisp-agent`'s CI clones this repository with no credential to check that every route,
subcommand and exit code it ships is named here.

```sh
npm ci
npm start      # dev server on localhost:3000
npm run build  # static site into build/
npm test       # build, then check the built site
npm run typecheck
```

`npm test` asserts what the site cannot be wrong about: that it is built for
`docs.usewisp.io` with no path prefix in its asset URLs, that `/quickstart` still takes a
reader from an empty machine to an answered `wisp run`, and that the look is Infima
variables with no ejected theme component under `src/theme/`.

Deployment is a Vercel project on this repository — a push to `main` publishes.
