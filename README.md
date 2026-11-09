# appolino.com

The marketing site for **appolino**, the data platform for business teams, live at
[www.appolino.com](https://www.appolino.com).

It is a single page: a light hero with the slogan and, right under it, a live product demo that runs in the browser
on example data (Extract, Transform, Validate, Deliver and Ask), and sections on delivery,
solutions, trust and contact. All figures on the site are examples, not customer data.

## Tech stack

- **React 18** and **TypeScript 5**, built with **Vite 5**.
- Plain CSS with custom properties, no CSS framework: `src/index.css` (tokens and the page),
  `src/features.css`, and `src/app/app.css` for the demo window.
- Fonts are vendored, nothing is loaded from another site: Google Sans Flex (`src/assets/`) and a
  subset of Tabler Icons (`src/app/fonts/`).
- **Playwright** and **axe-core** for the end-to-end, layout and accessibility tests.

## Getting started

Requires Node.js 18 or newer (CI uses Node 22).

```sh
npm install
npm run dev        # development server on http://localhost:5174
npm run build      # type-checks (tsc -b), then writes the production bundle to dist/
npm run preview    # serves dist/ locally
```

The dev server runs on 5174 so it can run beside the appolino app on 5173.

## Project structure

```text
src/
  main.tsx, App.tsx    entry point and the page, section by section
  index.css            design tokens (colour, type, elevation, motion) and the page's styles
  features.css         Trust's masking box and shared status colours
  i18n.tsx             English and Czech, each text beside its translation: t("English", "Česky")
  flags.ts             feature flags (see below)
  motion.ts            reduced-motion check and in-view helper
  czech.ts             readers for local dates, numbers, yes/no and IDs, shared by the page and the demo
  components/          the page's sections (Header, Hero, Showcase, Statement, Platform, Benefits,
                       Trust, Changelog, Contact)
  app/                 the demo window: kit.tsx (shared parts), one *Screen.tsx per tab,
                       planSteps.tsx (Transform's steps), app.css, the icon font
  assets/              the logo (appolino-sun.svg) and the vendored fonts
public/                the browser-tab icon (appolino-icon.svg)
scripts/               build-time generators (see below)
tests/e2e/             the Playwright suite; playwright.config.ts at the root
.github/workflows/     CI (e2e.yml)
```

### Scripts

Run by hand when their source changes; their output is committed.

| Command | What it does |
|---|---|
| `node scripts/tab-icon.mjs` | Writes `public/appolino-icon.svg` from the logo file. Run it whenever the logo changes |

## Feature flags

Parts that are built but not shown yet sit behind a flag in `src/flags.ts`. Each is read at build
time and is **off unless set to `1`**; a part that is off is left out of the bundle.

| Variable | On, it shows |
| --- | --- |
| `VITE_FLAG_CHANGELOG` | the Changelog section and its footer link |
| `VITE_FLAG_CZECH` | the Czech version and the language menu in the header (off: English for everyone) |
| `VITE_FLAG_ROAD` | the "How you work in appolino" strip at the foot of Solutions |

Set a flag in `.env.local` to see it while developing (restart `npm run dev`), or in the Vercel
project's environment variables to release it. Either way it takes a new build.

## Deployment

The site is hosted on **Vercel**.

- **Domain.** The appolino.com DNS is managed in Cloudflare (DNS only, not proxied) and points at
  Vercel. The apex `appolino.com` redirects (308) to `www.appolino.com`.
- **Production.** Every push to `main` builds the site (`npm run build`, output `dist`) and deploys
  it to www.appolino.com.
- **Previews.** Every other branch gets a preview deployment of its own.
- **Failed builds.** If a build fails, nothing is deployed and the previous version stays live.
- **Status.** Check each deployment, its build log and its preview URL in the Vercel dashboard
  under **Deployments**.

### Contact form

The form posts to a **Cloudflare Worker**, `cloudflare/contact-worker.js`. The Worker emails each
message to the addresses in its `TO` variable, with the visitor's address as Reply-To. Cloudflare
sends a Worker's mail only to addresses verified in the account's Email Routing. The setup steps
are at the top of the file.

The site reads the Worker's URL at build time from `VITE_CONTACT_URL`, kept in `.env.production`.
A build without that URL, such as `npm run dev`, does not send: the form ends with the message for
the visitor to copy. The visitor gets the same copy screen when a send fails. The tests build with
a stand-in URL that a fake inbox answers, so they never send real mail.

## Tests

See below; run `npm run test:e2e`.

| Command | What it runs |
| --- | --- |
| `npm run test:e2e` | the end-to-end suite (`playwright test`) |
| `npm run test:e2e:ui` | the same, in Playwright's UI mode |
| `npm run test:e2e:docker` | the whole suite, screenshots included, in the Linux Playwright image (needs Docker) |
| `npm run test:e2e:update` | remakes the screenshot baselines in the Linux image |
