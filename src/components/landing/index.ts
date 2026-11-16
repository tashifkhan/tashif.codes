/**
 * The landing kit. A file in src/landings/ composes these and adds its own
 * markup where the kit stops. Every piece reads the theme tokens, so a landing
 * follows the active skin and the light or dark mode without extra work.
 */
export { default as Section } from "./Section.astro";
export { default as LandingHero } from "./LandingHero.astro";
export { default as DeviceFrame } from "./DeviceFrame.astro";
export { default as LandingVideo } from "./LandingVideo.astro";
export { default as MediaTabs } from "./MediaTabs.astro";
export { default as PanelCarousel } from "./PanelCarousel.astro";
export { default as FeatureRow } from "./FeatureRow.astro";
export { default as FeatureGrid } from "./FeatureGrid.astro";
export { default as Faq } from "./Faq.astro";
export { default as CtaBand } from "./CtaBand.astro";
