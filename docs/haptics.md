# Haptics policy

Haptics accompany deliberate interactions across Astro pages and React islands.
Every effect is a single pulse, with no delayed second beat.

| Interaction | Requested pulse |
| --- | --- |
| Theme, filters, tabs, toggles, selections | 4 ms |
| Navigation, links, buttons, menu opening/dismissal | 6 ms |
| Medium actions and successful copy, submission, or refresh | 8 ms |
| Failed actions and invalid submissions | 10 ms |
| Typing, hover, scrolling, loading, current-tab selection | Silent |

One lazy WebHaptics instance handles all feedback. A 100 ms guard prevents
handlers and immediate outcomes from stacking. Outcomes suppress trailing
feedback for 180 ms. Later async results can provide their own confirmation.

Links, buttons, summaries, and common ARIA controls receive delegated click
feedback. Native form controls receive feedback on change. Explicit handlers
use `trigger` from `@/lib/haptics`; inline scripts dispatch `site:haptic` with
the semantic kind in `detail`.

Use `data-haptic="manual"` when an action handler owns feedback, such as a copy
button waiting for its result. `data-haptic="off"` suppresses delegated feedback
for an element or subtree. Disabled controls and modified clicks stay silent.

The haptic preference button saves the visitor's choice. Reduced motion
initially defaults to silence. Disabling feedback, hiding the page, or navigating
cancels active patterns. Unsupported hardware never blocks an action.

Intensity 1 preserves pulse timing rather than simulating amplitude through
on/off timing. Browsers cannot control motor amplitude or damping, and devices
may clamp short pulses. The sensation still needs testing on a physical phone.

`bun test tests/haptics.test.js` checks active feedback, duplicate suppression,
result spacing, preferences, cancellation, SSR, and unavailable hardware.
