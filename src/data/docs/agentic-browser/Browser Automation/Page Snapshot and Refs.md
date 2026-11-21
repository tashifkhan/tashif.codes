# Page snapshot and refs

A page snapshot is a compact text outline of what a user can see and operate, with a stable ref attached to every interactive element. `clients/browser-extension/entrypoints/utils/bridge/page-agent.ts` builds it inside the page, `utils/bridge/handlers.ts` stitches frames together and adds tab metadata, and `services/browser_runtime_page.py` converts a client DOM payload into the backend's `PageSnapshot` model for the planner.

Refs are the contract between looking and acting. A snapshot line such as `button "Sign in" [ref=e12]` can be passed back as `target="e12"` to a click, type, or check. A navigation destroys the document and the ref map with it, so old refs fail instead of hitting whatever element now occupies the same place.

Key capabilities:
- Accessibility roles inferred from tags, input types, and explicit `role` attributes.
- Refs allocated only to interactive roles, with a per-frame prefix such as `f12e5`.
- Visibility checks that respect CSS, `aria-hidden`, and `display: contents`.
- A character budget for the outline, defaulting to 25000.
- Selector, text, and ref targets resolved by one `find` function.
- Frame stitching for up to eight HTTP subframes.

## Repository layout

The in-page agent is deliberately self-contained because `executeScript` serialises the function source. The handler layer owns frames, tabs, screenshots, and timeouts. The backend builder is a separate, smaller path used by `browser_action_agent`.

```mermaid
graph TB
  subgraph Bridge
    Handlers["utils/bridge/handlers.ts"]
    PageAgent["utils/bridge/page-agent.ts"]
    Cdp["utils/bridge/cdp.ts"]
  end
  subgraph PageDom
    Walk["walk and render"]
    Roles["roleOf, nameOf, visible"]
    Refs["refs Map and byEl WeakMap"]
    Find["find and geometry"]
  end
  subgraph Backend
    Builder["services/browser_runtime_page.py"]
    Model["models/requests/automation.py<br/>PageSnapshot, ElementSnapshot"]
  end
  Handlers --> PageAgent
  Handlers --> Cdp
  PageAgent --> Walk
  PageAgent --> Roles
  PageAgent --> Refs
  PageAgent --> Find
  Builder --> Model
```

## Building blocks

- `page-agent.ts`: exports `PageOp` and `pageAgent(op, args)`, which returns `{ok: true, v}` or `{ok: false, e}`.
- Ref state: `globalThis.__agenticBrowser` holds `{refs: Map<string, WeakRef<Element>>, byEl: WeakMap<Element, string>, next: number}`.
- `roleOf`: explicit role first, then `INPUT_ROLES` for inputs, then `IMPLICIT` for tags. A `section` with an accessible name becomes `region`; contenteditable becomes `textbox`; an SVG with a label becomes `img`.
- `nameOf`: `aria-labelledby`, `aria-label`, associated labels, button value, placeholder, image alt, then text content.
- `visible`: `checkVisibility({checkOpacity, checkVisibilityCSS})` when available, with a `display: contents` exception, otherwise computed style checks.
- `handlers.ts`: `snapshotFrame`, `pageSnapshot`, `frameOf`, `refCounters`, and the `page.act` router that sends frame refs to the right frame.

## How it fits together

`pageSnapshot` resolves the tab, rejects restricted URLs, clamps `maxChars` between 2000 and 100000, snapshots the main frame, then adds sections for up to eight HTTP subframes. Each frame keeps its own ref counter, so a ref is unique within the page even when several documents contribute lines.

```mermaid
sequenceDiagram
  participant M as MCP or runtime client
  participant H as handlers.ts
  participant T as browser.tabs
  participant P as page-agent.ts
  participant W as browser.webNavigation
  M->>H: page.snapshot {tabId, maxChars, screenshot}
  H->>T: get(tabId) and assertScriptable
  H->>P: snapshot(op, {maxChars, prefix, startAt})
  P-->>H: {text, url, title, scroll, truncated, next}
  H->>W: getAllFrames(tabId)
  H->>P: snapshot per HTTP frame, maxChars/3
  H->>H: join url, title, scroll, text, frame sections
  opt screenshot
    H->>T: captureVisibleTab or CDP captureScreenshot
  end
  H-->>M: {tabId, url, title, text, screenshot?}
```

The returned text always begins with `url:`, `title:`, and a scroll line such as `scroll 0,0 of 0,7400; viewport 1440x900`. A truncated outline appends a note telling the caller to scroll, raise `max_chars`, or use evaluate. An open JavaScript dialog appends a line saying to answer it with `action=dialog`.

## How the outline is built

The walker starts at `document.body`, descends through child nodes, and skips `script`, `style`, `noscript`, `template`, `head`, `meta`, and `link`. It does not descend into an `iframe` or `frame`; it emits a note pointing at the frame sections. It skips invisible elements and anything with `aria-hidden="true"`. Text nodes become `text: ...` lines. Elements with no role are transparent: the walker recurses into them without emitting a line.

```mermaid
flowchart TD
  A["walk(root, out, budget)"] --> B{"text node?"}
  B -->|yes| C{"label control?"}
  C -->|yes| D["skip, control already named"]
  C -->|no| E["emit text line, budget -= length"]
  B -->|no| F{"iframe or frame?"}
  F -->|yes| G["emit iframe note, no recursion"]
  F -->|no| H{"skip tag, aria-hidden, invisible?"}
  H -->|yes| I["continue"]
  H -->|no| J["role = roleOf(el)"]
  J --> K{"role empty and pointer style?"}
  K -->|yes| L["role = clickable"]
  K -->|no| M{"role empty?"}
  M -->|yes| N["recurse into children"]
  M -->|no| O["line = role + quoted name + attrs"]
  O --> P{"INTERACTIVE role?"}
  P -->|yes| Q["append ref, assign if new"]
  P -->|no| R["no ref"]
  Q --> S["append value and link href"]
  R --> S
  S --> T["recurse unless LEAF or clickable"]
  T --> U["drop unnamed empty structural nodes"]
```

The character budget is global across the walk. Every emitted line subtracts its length, and the walk returns as soon as the budget reaches zero. The result reports `truncated: budget.n <= 0`, `refs: lines.length`, and `next: state.next` so the handler can continue numbering on a later snapshot. `attrs` adds state that matters for acting: `[checked]`, `[disabled]`, `[expanded]` or `[collapsed]`, `[selected]`, `[pressed]`, `[required]`, and `[level=N]` for headings. `valueOf` adds the current value for selects, text inputs, and contenteditable nodes, and masks passwords with up to 12 bullets.

## Ref lifetime

Refs are assigned the first time an interactive element appears in a snapshot. `refFor` checks the `byEl` WeakMap, allocates `prefix + "e" + next` when absent, and stores a WeakRef in the forward map. Repeated snapshots are stable while the document lives. A frame snapshot uses a prefix such as `f3`, producing refs like `f3e7`.

```mermaid
stateDiagram-v2
  [*] --> DocumentLoad
  DocumentLoad --> Snapshot: walk assigns e1, e2, ...
  Snapshot --> Snapshot: same element gets same ref
  Snapshot --> Stale: navigation or reload
  Stale --> DocumentLoad: new document, refs empty
  Snapshot --> Stale: element removed from DOM
  Stale --> Error: find(ref) sees missing or disconnected element
  Error --> [*]
```

`find` treats a ref as stale when the WeakRef dereferences to nothing or `isConnected` is false. The error text is `Ref e12 is stale or unknown. Take a new snapshot and use a ref from it.` The MCP instructions therefore tell callers to take a new snapshot after navigation. The `startAt` argument seeds `next` for a frame. `handlers.ts` keeps `refCounters` keyed by `tabId:frameId` and passes the previous `next` on the following call, so refs from earlier snapshots do not collide with new ones.

## Target resolution

`page.act` accepts a ref, `text=Visible text`, or a CSS selector. `frameOf` extracts the frame number from a ref and defaults to frame 0 for everything else. The same target string then reaches `find` in the selected frame.

```mermaid
flowchart TD
  T["target string"] --> R{"matches ref pattern?"}
  R -->|yes| R1["refs.get(name).deref()"]
  R1 --> R2{"element connected?"}
  R2 -->|no| E1["throw stale ref"]
  R2 -->|yes| OUT["Element"]
  R -->|no| X{"starts with text=?"}
  X -->|yes| X1["pool of links, buttons, labels, roles"]
  X1 --> X2["exact text match, then includes"]
  X2 --> X3["fallback: smallest visible containing element"]
  X -->|no| C{"valid CSS selector?"}
  C -->|no| E2["throw not a ref, text= or selector"]
  C -->|yes| C1["querySelectorAll"]
  C1 --> C2["first visible, else first"]
  C2 --> OUT
```

Before a CDP click, `geometry` scrolls the element to the center, computes the viewport point, and calls `elementFromPoint`. If another element covers the target, the result carries `covered` with a description of the blocker, except when that element is a label bound to the control. `trustedClick` then either dispatches a real mouse event at the point or falls back to `domClick`.

## Backend snapshot builder

`services/browser_runtime_page.py` serves the planner path where the client sends DOM data rather than the page agent. It maps up to 80 `interactive` entries into `ElementSnapshot`, accepting both snake_case and camelCase fields (`aria_label` or `ariaLabel`, `input_type` or `type`). `visible_text` prefers `client_markdown` truncated to 5000 characters, then `dom_structure["visible_text"]`. The title defaults to `Current Page`.

```mermaid
graph LR
  subgraph ClientPayload
    Dom["dom_structure"]
    Md["client_markdown"]
    Url["target_url"]
  end
  subgraph Builder
    Map["interactive[:80] to ElementSnapshot"]
    Text["visible_text[:5000]"]
    Title["title or Current Page"]
  end
  subgraph Model
    Snap["PageSnapshot"]
  end
  Dom --> Map --> Snap
  Md --> Text --> Snap
  Dom --> Text
  Url --> Snap
  Title --> Snap
```

## Dependencies

The page agent imports nothing. That is a hard requirement, not a style choice: `browser.scripting.executeScript` serialises the function body, so any outer reference would be undefined in the page. The handler layer imports `browser` from `wxt/browser`, the CDP wrapper, and the page agent.

```mermaid
graph TB
  subgraph Callers
    Mcp["mcp_server/server.py<br/>browser_snapshot, browser_act"]
    Route["bridge handlers page.read"]
    Runtime["services/browser_runtime_page.py"]
  end
  subgraph Extension
    Handler["handlers.ts"]
    Agent["page-agent.ts"]
    Cdp["cdp.ts"]
    Glow["pageGlow.ts"]
  end
  subgraph Platform
    Script["browser.scripting.executeScript"]
    Frames["browser.webNavigation.getAllFrames"]
    Shot["browser.tabs.captureVisibleTab"]
  end
  Mcp --> Handler
  Route --> Handler
  Handler --> Agent
  Handler --> Cdp
  Handler --> Glow
  Agent --> Script
  Handler --> Frames
  Handler --> Shot
  Runtime --> Model["PageSnapshot"]
```

## Performance

The default outline budget is 25000 characters, shared across the whole document walk. Main frame snapshots time out at 10 seconds in `runPage`, subframes at 4 seconds, and `page.snapshot` splits `maxChars` three ways for frames. Subframes are limited to eight, must be HTTP or HTTPS, and must cover at least 120 by 60 pixels. `page.read` truncates at 50000 characters. Active tab screenshots are captured at JPEG quality 70, then downscaled to 1280 pixels wide; background tabs need CDP.

## Troubleshooting

- `Ref e12 is stale or unknown`: the document changed or the element was removed. Take a new snapshot.
- A snapshot line is missing an expected button: the element failed the visibility or clickability test, or it sits inside a shadow root the walker did not enter. The walker does enter `shadowRoot` when a host has a role.
- `No element with text "..."`: `text=` matched nothing visible in the clickable pool or among containing elements. Try a CSS selector or a fresh ref.
- A click reports the target is covered: an overlay, sticky header, or cookie banner occupies the center point. Close it or use a different target.
- The snapshot is empty for a PDF or viewer: the document has no DOM outline the walker recognises. Use `page.screenshot` instead.
- Frame refs are not resolving: the ref must keep its `f<number>` prefix. `frameOf` routes on it; stripping the prefix sends the action to frame 0.

## Appendix

### Implementation examples

- `pageAgent("snapshot", {maxChars, prefix, startAt})`: returns the outline, scroll position, truncation flag, and next ref number.
- `pageAgent("resolve", {target})`: returns geometry, description, coverage, and editability.
- `handlers.snapshotFrame(tabId, frameId, maxChars)`: one frame plus its ref counter update.
- `build_page_snapshot_from_dom(dom_structure, target_url, client_markdown)`: backend conversion used by `browser_action_agent`.

### Source files

- `clients/browser-extension/entrypoints/utils/bridge/page-agent.ts`
- `clients/browser-extension/entrypoints/utils/bridge/handlers.ts`
- `services/browser_runtime_page.py`
- `models/requests/automation.py`
