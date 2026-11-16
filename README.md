# tashif.codes

my lil corner of the internet. lives at [tashif.codes](https://tashif.codes).

started as a portfolio, then it ate a blog, a docs site, a url shortener, an analytics api and an f-droid repo. send help.

## what even is this

- **projects**, every repo i've shipped, with search, filters and live github stats. plus a [stats page](https://tashif.codes/projects/stats) so you can watch me check my own analytics
- **blog**, pulled from [blog.tashif.codes](https://blog.tashif.codes), with rss in every flavour you could want (`/rss.xml`, `/feed.xml`, `/blog/feed`, i got carried away)
- **docs** for my projects at `/docs`, for the three people who read docs before opening an issue
- **github + leetcode**, contribution graphs and problem counts. yes the leetcode tab is a cry for help
- **resume**, and `/resume:pdf` for a pdf one. recruiters, this one's for you
- **connect**, all the places you can find me
- **downloads** at `/download/<app>`, which bounce you to the latest release
- **f-droid repo** at [`/fdroid`](https://tashif.codes/fdroid) for my android apps, because the play store wanted $25 and my dignity

## features (a subset, it keeps eating more)

- two whole design skins. **simple** is the original orange dashboard, **studio** is warm paper and teal ink borrowed from [taf.sh](https://taf.sh). studio is the default now, simple is there for nostalgia
- light and dark for both, because two skins wasn't enough decisions
- a settings dock that holds the theme, the skin, haptics and a reduce motion switch
- any path the site doesn't know gets checked against my shortener at [u.tashif.codes](https://u.tashif.codes). so `tashif.codes/<anything>` might take you somewhere. or a 404. live a little
- live refresh on the stats, proxied through `/proxy/*` so nobody's ad blocker or cors policy gets a vote
- posthog analytics through `/ph/*`, same reason
- haptics on mobile, because buttons should feel like buttons
- generated og images for every page, so the link previews look like i tried

## a cry for help

this site has been redesigned more times than i'd like to admit.

- [portfolio.tashif.codes](https://portfolio.tashif.codes), the og one, built while i was still learning frontend. it's still up as a testament to growth or some shit, idk why
- the simple dashboard, orange, tabs everywhere
- the studio skin, which is basically taf.sh moved in and repainted the place
- 550+ commits, a good chunk of which say `fix(theme)`

if you see me open a branch called `redesign`, please stop me.

## stack

- astro 5 + react 19 for the bits that need it
- tailwind v4, radix, lucide
- a fastapi analytics api in `api/` that merges old vercel data with live posthog numbers (python on vercel, it works, don't ask)
- vercel for hosting
- an unhealthy number of `*-stats.tashif.codes` subdomains

## run it

```sh
bun install
bun dev                  # localhost:4321
bun run build            # generates og images first, then builds
bun run og:generate      # just the og images
bun run test:analytics   # playwright checks for the analytics wiring
```

the analytics api has its own readme in [`api/README.md`](api/README.md).

## giving a project its own landing page

every project page is its github readme by default. to replace one, add `src/landings/<project-slug>.astro`. that file now renders at `/projects/<slug>`, and the readme moves to `/projects/<slug>/readme` with a tab linking the two. nothing to register, the file name is the switch.

the header, tabs and sticky bar stay the same on every project. the part below them is yours. `src/components/landing` has the pieces most pages want (hero, framed screenshots, lazy videos, pinned feature chapters, a clip switcher, rows, a sideways rail, faq), and plain markup works wherever those run out. they read the `--ld-*` tokens in `landing.css`, which come from the site theme, so a landing follows the accent and light or dark mode on its own.

a landing can also `export const landing` to set a tagline and the header button. colours always come from the visitor's theme and accent. [`src/landings/paisa.astro`](src/landings/paisa.astro) is the one to copy. its media lives in `public/landings/paisa`.

## f-droid, for the curious

paste `https://tashif.codes/fdroid/repo?fingerprint=568557c435bdf555725de95de596a90d6fa964d4bf0b71874f254cd0be7e94c9` into f-droid (the fingerprint makes f-droid check the repo is really mine) and you get [Paisa](https://github.com/tashifkhan/Paisa), [Patchwork](https://github.com/tashifkhan/Patchwork) and [Delhi Metro](https://github.com/tashifkhan/delhi-metro). each app's release workflow pokes `publish-fdroid.yml` here, which grabs the apk, signs the index and commits it.

secrets, keystore setup and manual re-imports live in [`public/fdroid/README.md`](public/fdroid/README.md). don't lose the keystore. i will cry.

## roadmap

- ship more projects so the projects page keeps scrolling
- solve leetcode daily (lol)
- one more subdomain, i swear it's the last one

## say hi

[tashif.codes/connect](https://tashif.codes/connect). or just star the repo, parasocial validation accepted.
