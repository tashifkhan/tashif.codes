# Motion

The site uses CSS for control feedback, card hover, and menu transitions.
No animation runtime or JavaScript listeners were added for these effects.

Shared timing lives in `src/styles/global.css`: 80 ms for a press, 140 ms for
controls and menu entrances, and 200 ms for cards. Navigation uses a 120/180 ms
crossfade through the existing Astro router, without vertical page movement.

- `motion-control` supports buttons rendered as links and tab controls.
  Enabled buttons also receive a small pressed state. Layout dimensions stay fixed.
- `motion-card` lifts 2 px only with a fine pointer, hover support, and no
  reduced-motion preference. Blog cards appear immediately without staggered reveals.
- `motion-card-arrow` remains visible on touch and keyboard focus.
- `motion-menu` uses a short fade and 2 px entrance offset, without zoom or spring.
- Reduced motion removes transition timing and makes CSS animations finish
  immediately while preserving completion events used by overlays. Decorative
  pings are enabled only when motion is allowed.

Existing typewriter/count-up scripts and the tooltip runtime remain in place.
The tooltip's transform is suppressed under reduced motion. Haptics are unchanged.

Validation covered the production build and Chromium desktop/touch rendering:
card hover, button press, keyboard focus, immediate blog content, menu opening
and dismissal with and without reduced motion, visible touch arrows, and mobile
horizontal overflow. Physical phone feel still benefits from user testing.
