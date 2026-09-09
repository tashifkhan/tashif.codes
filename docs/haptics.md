# Haptics audit

The site uses one lazy `WebHaptics` instance through `src/lib/haptics.ts`.
Astro markup, React islands, menus rendered in portals, and generated Markdown
share its patterns and rate limit.

## Feedback levels

| Interaction | Feedback |
| --- | --- |
| Theme, filter, tab, year or contribution-day selection | Short selection tick |
| Navigation, links, menu opening/dismissal, action buttons | Light tap |
| Copy completed, comment/reply posted, refresh completed | Short rising pair |
| Copy failed, invalid comment, rejected reply, failed refresh/like | Short equal pair |
| Typing, hover, scrolling, loading, selecting the current tab | Silent |

Social links use the same light tap as other links. Opening an email client is
an action tap, since the site cannot confirm that an email was sent. Clipboard
feedback follows completion, including the legacy copy fallback's return value.

The haptic button beside the theme button saves the visitor's preference.
Without an explicit preference, reduced motion defaults to silence. Turning
feedback off cancels a running pattern. Hidden pages and page transitions cancel
patterns too. Unsupported hardware and rejected vibration calls never block UI.

## Integration rules

- Import `trigger` from `@/lib/haptics` for state changes and async outcomes.
  Do not instantiate the library in components or use its per-component hook.
- Plain links, buttons, summaries and common ARIA controls receive delegated
  feedback. Use `data-haptic="selection"` to specify a tick.
- Use `data-haptic="manual"` when the action handler owns feedback. Copy buttons
  use it to avoid an extra click pulse before their result. Select triggers use
  it because their open-state callback runs on pointer-down or keyboard input.
- `data-haptic="off"` silences delegated feedback for an element/subtree.
- Inline Astro scripts dispatch `site:haptic` with a semantic kind in `detail`.
- Explicit feedback takes precedence over delegated clicks. A 70 ms guard
  coalesces ordinary feedback; outcome patterns have 160 ms of protection.
- Never trigger feedback from a render, background fetch, hover or scroll.

## Validation

`bun test tests/haptics.test.js` checks shared-instance deduplication, outcome
priority, cancellation, preferences, SSR and unavailable hardware.

The browser audit uses Chromium at a 390 × 844 touch viewport with
`navigator.vibrate` instrumented. It checks actual React controls, Astro tabs,
menu open/dismissal, silent typing, preference persistence, native disclosures,
copy outcomes, delegated opt-outs, synthetic/modified clicks and reduced motion.
Blog API requests are intercepted when testing comments, so no real comments
or likes are created.

A real Pixel pass remains necessary to judge the sensation. Web vibration uses
timing patterns and cannot invoke Android's native tick/click primitives or
control motor amplitude directly. The intent follows Android's haptics design
principles: brief, consistent feedback whose strength matches the action.

References:
- https://developer.android.com/develop/ui/views/haptics/haptics-principles
- https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API
