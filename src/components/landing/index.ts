/**
 * The landing kit. A file in src/landings/ wraps its page in <Landing>,
 * composes these, and adds its own markup where the kit stops. Every piece
 * reads the `--ld-*` tokens in landing.css, which resolve from the site's
 * theme, so a landing follows the active skin and the light or dark mode.
 */
export { default as Landing } from "./Landing.astro";
export { default as LandingHero } from "./LandingHero.astro";
export { default as Section } from "./Section.astro";
export { default as Shot } from "./Shot.astro";
export { default as LandingVideo } from "./LandingVideo.astro";
export { default as Pinned } from "./Pinned.astro";
export { default as MediaSwitcher } from "./MediaSwitcher.astro";
export { default as Rows } from "./Rows.astro";
export { default as Rail } from "./Rail.astro";
export { default as Deck } from "./Deck.astro";
export { default as DeckOpen } from "./DeckOpen.astro";
export { default as Faq } from "./Faq.astro";
export { default as Routes } from "./Routes.astro";
export { default as StatsApi } from "./StatsApi.astro";
export { default as ApiUsage } from "./ApiUsage.astro";
