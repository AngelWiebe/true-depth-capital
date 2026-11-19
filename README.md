# True Depth Capital

The True Depth Capital website presents Canadian vehicle sourcing and wholesale enquiries from licensed U.S. dealers. It is a static HTML, CSS and JavaScript site built with Vite.

## Getting started

Use Node.js 20 or 22.

```sh
npm ci
npm run dev
```

Open the local address printed by Vite.

## Production build

```sh
npm run build
npm run preview
```

Publish the contents of `dist/`. Vite copies the files in `public/` into the build and bundles the scripts and styles. Generated files and installed dependencies are excluded from Git.

## Main files

| Location | Purpose |
| --- | --- |
| `index.html` | Page content, navigation, enquiry form, privacy policy and search metadata |
| `src/styles.css` | Layout, responsive styles and visual treatments |
| `src/journey.js` | Section navigation, scroll state and mobile menu |
| `src/app.js` | WebGL lake and underwater scene |
| `src/fallback.js` | Canvas 2D scene for browsers without WebGL |
| `src/artwork.js` | Image loading and responsive underwater artwork |
| `src/wildlife.js` | Pacific wildlife sprites and schooling animation |
| `src/motion.js` | Motion toggle and system reduced-motion preference |
| `src/enquiry.js` | Vehicle and dealer enquiry validation and delivery |
| `src/privacy.js` | Footer privacy dialog |
| `public/assets/` | Artwork, wildlife atlas, favicon and sharing image |
| `public/robots.txt`, `public/sitemap.xml` | Search discovery |

## Scene and accessibility

The mountain lake transitions into an underwater scene containing a wolf eel, giant Pacific octopus, China rockfish and a small school of Pacific herring. Their sizes, paths and movement are configured in `src/wildlife.js`.

The Motion control starts from the visitor’s reduced-motion preference. Turning it off displays a still mountain opening and underwater backdrop with the animated wildlife hidden. The underwater artwork switches between portrait and landscape crops at a viewport width of 600 pixels.

Navigation includes a skip link, visible keyboard focus, section links and a compact menu on phones and short landscape touchscreens. The privacy dialog supports keyboard dismissal and returns focus to its trigger. A static backdrop remains available if scene rendering fails.

## Enquiry delivery

Production builds use the public Formspree endpoint in `.env.production`:

```text
https://formspree.io/f/xgakkeep
```

The vehicle and dealer forms submit directly from the page. Successful requests display a confirmation. Failed requests retain the entered details for retry. Visitors can email vehicle photos separately after submitting.

Configure and verify the notification recipient in Formspree. The current contact address displayed on the site is `lance@dlrconsulting.ca`. Live delivery to the recipient inbox still needs an end-to-end check.

For direct submission during local development, create `.env.local`:

```dotenv
VITE_ENQUIRY_ENDPOINT=https://formspree.io/f/xgakkeep
```

Development without an endpoint uses an email draft fallback. Rebuild after changing the production endpoint. The endpoint is public and is included in the browser bundle. Keep account credentials out of `VITE_*` variables.

The privacy policy is in the footer markup in `index.html`. Its submission description updates when direct delivery is configured.

## Domains and search metadata

The configured primary address is `https://truedepthcapital.ca/`. Canonical metadata, structured data, the sharing preview and sitemap use that address.

The additional domains are intended to redirect permanently to the corresponding primary URL, preserving paths and query strings:

- `truedepthcap.ca`
- `truedepthcap.club`
- `truedepthcap.com`
- `truedepthcap.info`
- `truedepthcap.net`
- `truedepthcap.store`
- `truedepthcapital.com`

Set up redirects and HTTPS through the domain or hosting configuration. Include configured `www` variants. Submit `https://truedepthcapital.ca/sitemap.xml` to Search Console after publishing.

## Verification

`npm run build` verifies that Vite can produce the production bundle. Browser checks during development covered Chrome and macOS WebKit, responsive layouts, motion controls, artwork loading failures, orientation changes, menu focus and the privacy dialog. Form success and retry behaviour were checked using simulated service responses.

Physical iPhone and Android checks, live screen-reader testing, and live Formspree inbox delivery remain outstanding.
