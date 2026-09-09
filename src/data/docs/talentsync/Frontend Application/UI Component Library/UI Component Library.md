# UI component library

## Introduction
This page describes the UI component library architecture used in the frontend application. It covers the shared components system, reusable component patterns, and composition strategies. It also details the integration with Radix UI primitives, Tailwind CSS styling approach, and the design system implementation. The guide includes form components, data display components, and interactive elements, along with component props, customization options, accessibility features, state management, event handling, and testing strategies.

## Project structure
The UI component library is organized under the components/ui directory. Each component is self-contained with its own TypeScript/TSX file, styling via Tailwind CSS, and optional animations powered by Framer Motion. Shared utilities and design tokens are centralized in lib/utils.ts and configured in tailwind.config.ts. Global styles are defined in app/globals.css.

```mermaid
graph TB
subgraph "UI Components"
B["Button<br/>button.tsx"]
I["Input<br/>input.tsx"]
D["Dialog<br/>dialog.tsx"]
C["Card<br/>card.tsx"]
CB["Checkbox<br/>checkbox.tsx"]
AV["Avatar<br/>avatar.tsx"]
BD["Badge<br/>badge.tsx"]
DM["Dropdown Menu<br/>dropdown-menu.tsx"]
L["Label<br/>label.tsx"]
PR["Progress<br/>progress.tsx"]
RG["Radio Group<br/>radio-group.tsx"]
SA["Scroll Area<br/>scroll-area.tsx"]
MDR["Markdown Renderer<br/>markdown-renderer.tsx"]
LO["Loader<br/>loader.tsx"]
PL["Page Loader<br/>page-loader.tsx"]
MMM["Modern Mobile Menu<br/>modern-mobile-menu.tsx"]
TS["Toast<br/>toast.tsx"]
TSTR["Toaster<br/>toaster.tsx"]
end
subgraph "Styling & Utils"
TW["Tailwind Config<br/>tailwind.config.ts"]
GCSS["Globals CSS<br/>app/globals.css"]
U["Utils<br/>lib/utils.ts"]
end
subgraph "Hooks & Services"
UT["use-toast.ts"]
end
B --> U
I --> U
D --> U
C --> U
CB --> U
AV --> U
BD --> U
DM --> U
L --> U
PR --> U
RG --> U
SA --> U
MDR --> U
LO --> U
PL --> U
MMM --> U
TS --> U
TSTR --> U
B --> TW
I --> TW
D --> TW
C --> TW
CB --> TW
AV --> TW
BD --> TW
DM --> TW
L --> TW
PR --> TW
RG --> TW
SA --> TW
MDR --> TW
LO --> TW
PL --> TW
MMM --> TW
TS --> TW
TSTR --> TW
GCSS --> TW
UT --> TSTR
```

## Core components
This section documents the foundational UI components that form the shared component library.

- Button
  - Purpose: Base action element with variants and sizes.
  - Props: Inherits standard button attributes plus variant and size from class-variance-authority; supports asChild for composition.
  - Variants: default, destructive, outline, secondary, ghost, link.
  - Sizes: default, sm, lg, icon.
  - Accessibility: Inherits native button semantics; focus-visible ring via Tailwind utilities.
  - Composition: Uses Slot from @radix-ui/react-slot to wrap children when asChild is true.

- Input
  - Purpose: Text input field with consistent styling and focus states.
  - Props: Standard input attributes; integrates with Tailwind for focus, disabled, and placeholder states.
  - Accessibility: Native input semantics; focus-visible ring for keyboard navigation.

- Dialog
  - Purpose: Modal overlay with content area, header, footer, title, and description.
  - Components: Root, Trigger, Portal, Close, Overlay, Content, Header, Footer, Title, Description.
  - Accessibility: Built on @radix-ui/react-dialog; manages focus trapping and escape key handling.
  - Styling: Dark theme overlay with backdrop blur; slide/fade animations; close button with sr-only label.

- Card
  - Purpose: Container for grouping related content with header, title, description, content, and footer.
  - Components: Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter.
  - Styling: Background and border tokens; spacing and typography tokens.

- Checkbox
  - Purpose: Binary selection control with indicator.
  - Props: Inherits Radix checkbox attributes; styled with brand colors when checked.
  - Accessibility: Uses @radix-ui/react-checkbox; maintains keyboard and screen reader compatibility.

- Avatar
  - Purpose: User avatar with fallback icon and optimized image loading.
  - Props: src, alt, size (sm/md/lg), className.
  - Behavior: Optimizes Google and GitHub profile URLs via proxy; retries on failure; loading states with pulse effect.
  - Styling: Responsive sizing; border and color tokens.

- Badge
  - Purpose: Label or indicator with variants.
  - Props: Inherits standard div attributes plus variant from class-variance-authority.
  - Variants: default, secondary, destructive, outline.

- Dropdown Menu
  - Purpose: Context menu with items, checkboxes, radios, labels, separators, and submenus.
  - Components: Root, Trigger, Portal, Content, Item, CheckboxItem, RadioItem, Label, Separator, Shortcut, Group, Sub, SubContent, SubTrigger, RadioGroup.
  - Accessibility: Built on @radix-ui/react-dropdown-menu; supports nested menus and keyboard navigation.

- Label
  - Purpose: Associated label for form controls.
  - Props: Inherits Radix label attributes plus variant from class-variance-authority.
  - Accessibility: Peer-based disabled state handling; integrates with form controls.

- Progress
  - Purpose: Visual progress bar.
  - Props: Inherits Radix progress attributes; value determines indicator width.
  - Accessibility: Semantic progress indication; integrates with screen readers.

- Radio Group
  - Purpose: Group of radio buttons with consistent styling.
  - Components: RadioGroup, RadioGroupItem.
  - Accessibility: Built on @radix-ui/react-radio-group; maintains group semantics.

- Scroll Area
  - Purpose: Customizable scrollbars with viewport and corner.
  - Components: ScrollArea, ScrollBar.
  - Accessibility: Preserves native scrolling semantics; styled scrollbar thumb.

- Loader and Page Loader
  - Purpose: Loading indicators with multiple variants and full-screen overlay.
  - Variants: dots, pulse, spinner, default.
  - Props: size (sm/md/lg/xl), variant, className, text; PageLoader adds motion transitions.
  - Integration: Reuses Loader in PageLoader for consistent UX.

- Markdown Renderer
  - Purpose: Render markdown content with custom GFM-style callouts and details/summary support.
  - Props: content (unknown), className.
  - Styling: Extensive Tailwind utilities for headings, lists, callouts, and interactive elements.

- Modern Mobile Menu
  - Purpose: Interactive bottom navigation with animated underline and dynamic width calculation.
  - Props: items (array of label/icon), accentColor (CSS variable).
  - Behavior: Validates items length, calculates active line width, handles click events.

- Toast and Toaster
  - Purpose: Non-blocking notifications with queue management.
  - Integration: use-toast hook provides toast creation; Toaster renders queued toasts.

## Architecture overview
The component library follows a modular, composition-first architecture:
- Each component encapsulates styling, behavior, and accessibility.
- Radix UI primitives provide accessible base behaviors (focus management, ARIA, keyboard interactions).
- Tailwind CSS provides atomic, themeable styling with design tokens.
- Utilities in lib/utils.ts centralize class merging and shared helpers.
- Framer Motion enables smooth, declarative animations for loaders and page transitions.

```mermaid
graph TB
RUP["@radix-ui/react-*<br/>Primitives"]
FM["framer-motion<br/>Animations"]
TW["Tailwind CSS<br/>Utilities"]
U["lib/utils.ts<br/>cn() & helpers"]
subgraph "Components"
BTN["Button"]
DLG["Dialog"]
DDL["Dropdown Menu"]
AV["Avatar"]
LDR["Loader/Page Loader"]
MDR["Markdown Renderer"]
TST["Toast/Toaster"]
end
BTN --> RUP
BTN --> TW
BTN --> U
DLG --> RUP
DLG --> TW
DLG --> U
DDL --> RUP
DDL --> TW
DDL --> U
AV --> TW
AV --> U
LDR --> FM
LDR --> TW
MDR --> TW
TST --> U
```

## Detailed component analysis

### Button component
The Button component demonstrates variant-driven styling with class-variance-authority and composable rendering via Radix Slot.

```mermaid
classDiagram
class Button {
+ButtonProps props
+forwardRef<HTMLButtonElement>
+asChild? : boolean
+variant : "default"|"destructive"|"outline"|"secondary"|"ghost"|"link"
+size : "default"|"sm"|"lg"|"icon"
}
class buttonVariants {
+defaultVariants
+variants
}
Button --> buttonVariants : "uses"
```

### Dialog component
The Dialog stack composes multiple Radix UI parts into a cohesive modal experience with animations and accessibility.

```mermaid
sequenceDiagram
participant User as "User"
participant Trigger as "DialogTrigger"
participant Portal as "DialogPortal"
participant Overlay as "DialogOverlay"
participant Content as "DialogContent"
participant Close as "DialogClose"
User->>Trigger : Click
Trigger->>Portal : Open dialog
Portal->>Overlay : Render backdrop
Overlay->>Content : Render content with animations
User->>Close : Click close
Close->>Portal : Close dialog
Portal->>Overlay : Unmount backdrop
```

### Avatar component
The Avatar component handles image loading, error fallbacks, and proxy optimization for external images.

```mermaid
flowchart TD
Start(["Render Avatar"]) --> HasSrc{"Has src?"}
HasSrc --> |No| Fallback["Show fallback icon<br/>with size classes"]
HasSrc --> |Yes| LoadState["Set isLoading=true"]
LoadState --> ProxyCheck{"Google/GitHub URL?"}
ProxyCheck --> |Yes| UseProxy["Use proxy endpoint"]
ProxyCheck --> |No| UseDirect["Use direct URL"]
UseProxy --> Image["Render img with onLoad/onError"]
UseDirect --> Image
Image --> OnLoad["onLoad -> isLoading=false"]
Image --> OnError{"Retry < 2 and external?"}
OnError --> |Yes| Retry["Increment retry, force re-render"]
OnError --> |No| ErrorState["Set imageError=true"]
Fallback --> End(["Done"])
OnLoad --> End
Retry --> End
ErrorState --> End
```

### Loader component
The Loader component provides multiple animation variants and a full-screen overlay.

```mermaid
flowchart TD
Start(["Render Loader"]) --> Variant{"Variant"}
Variant --> |dots| Dots["Three pulsing dots"]
Variant --> |pulse| Pulse["Pulsing gradient circle"]
Variant --> |spinner| Spinner["Rotating border"]
Variant --> |default| Default["Dual-ring + center dot"]
Dots --> OptionalText{"Has text?"}
Pulse --> OptionalText
Spinner --> OptionalText
Default --> OptionalText
OptionalText --> |Yes| AddText["Animate text opacity"]
OptionalText --> |No| End(["Done"])
AddText --> End
```

### Toast system
The toast system integrates with a hook to manage toasts and a renderer to display them.

```mermaid
sequenceDiagram
participant Hook as "use-toast.ts"
participant Toaster as "Toaster"
participant Toast as "Toast"
Hook->>Hook : createToast(options)
Hook->>Toaster : enqueue toast
Toaster->>Toast : render queued toast
Toast->>Toaster : dismiss
Toaster->>Hook : remove from queue
```

## Dependency analysis
The component library exhibits low coupling and high cohesion:
- Components depend on Radix UI primitives for accessibility and behavior.
- Styling is centralized via Tailwind utilities and design tokens.
- Utilities in lib/utils.ts provide shared helpers like cn() for class merging.
- Animations rely on Framer Motion for consistent motion design.

```mermaid
graph LR
U["lib/utils.ts"] --> BTN["Button"]
U --> DLG["Dialog"]
U --> DDL["Dropdown Menu"]
U --> AV["Avatar"]
U --> LDR["Loader"]
U --> MDR["Markdown Renderer"]
U --> TST["Toast/Toaster"]
TW["tailwind.config.ts"] --> BTN
TW --> DLG
TW --> DDL
TW --> AV
TW --> LDR
TW --> MDR
TW --> TST
RUP["@radix-ui/*"] --> BTN
RUP --> DLG
RUP --> DDL
RUP --> AV
RUP --> LDR
RUP --> MDR
RUP --> TST
```

## Performance considerations
- Prefer variant props over inline styles to use Tailwind's efficient class generation.
- Use memoization for derived values (e.g., useMemo in interactive menu) to avoid unnecessary recalculations.
- Lazy-load heavy assets (images) and use optimized URLs to reduce bandwidth and improve CLS.
- Keep animations minimal and scoped to avoid layout thrashing; use transform and opacity where possible.
- Consolidate animations through shared components (Loader) to reduce duplication.

## Accessibility features
- Focus management: Components built on Radix UI ensure focus trapping, escape key handling, and proper focus order.
- Keyboard navigation: Dropdowns, dialogs, and radio groups support keyboard interactions.
- Screen reader support: Proper ARIA roles and labels are applied via Radix primitives and semantic HTML.
- Contrast and visibility: Tailwind utilities enforce sufficient contrast and readable text sizes.
- Form controls: Labels associate with inputs; disabled states are communicated clearly.

## Component composition strategies
- Composition over inheritance: Use asChild patterns (e.g., Button with Slot) to wrap other components.
- Slot pattern: Enables flexible DOM structure while preserving component behavior.
- Compound components: Dialog exposes multiple subcomponents (Content, Header, Footer) for structured markup.
- Variant systems: class-variance-authority allows consistent, extensible styling across components.
- Theme tokens: Centralized design tokens in Tailwind config enable consistent theming.

## Testing strategies
- Unit tests: Verify component rendering with different props (variants, sizes, states).
- Accessibility tests: Use axe-core or similar tools to check ARIA attributes and keyboard navigation.
- Interaction tests: Simulate user actions (clicks, focus, keyboard) to validate behavior.
- Snapshot tests: Capture component output to prevent regressions.
- Integration tests: Test composed components (e.g., Dialog with Button trigger) to ensure interoperability.

## Documentation standards
- Component READMEs: Describe purpose, props, variants, and usage examples.
- Storybook stories: Visualize component states and variants.
- Type documentation: Exported props should be typed and documented.
- Accessibility checklist: Include accessibility notes per component.
- Migration guides: Document breaking changes and upgrade steps for major updates.

## Troubleshooting guide
- Dialog not closing: Ensure DialogClose is used and that the portal mounts correctly.
- Avatar flickering: Confirm image load/error handlers and retry logic are functioning.
- Loader not animating: Verify Framer Motion is imported and animations are enabled.
- Toast not appearing: Check use-toast hook and Toaster registration.
- Styles not applying: Confirm Tailwind utilities and design tokens are present in the build.

## Conclusion
The UI component library uses Radix UI for accessibility, Tailwind CSS for styling, and Framer Motion for animations to deliver a consistent, themeable, and accessible design system. Components are designed for composition, extensibility, and maintainability, with clear patterns for state management, event handling, and integration across the application.
