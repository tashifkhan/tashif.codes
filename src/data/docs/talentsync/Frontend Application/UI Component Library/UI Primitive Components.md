# UI primitive components

## Update summary
**Changes Made**
- Added new Command component for keyboard-driven search and selection
- Added new Popover component for modal-like interactions
- Improved Select component with haptic feedback integration
- Updated project structure diagram to include new components
- Added haptic feedback documentation and integration patterns

## Introduction
This page describes the foundational UI primitive components used across the frontend. It explains each component's purpose, props, styling options, accessibility features, and usage patterns. It also details how these primitives integrate with Radix UI and Tailwind CSS, and how they compose to form higher-level components. Where applicable, we include code-level diagrams and flowcharts to illustrate behavior and data flow.

**Updated** Added new Command component for keyboard-driven search and selection, Popover component for modal-like interactions, and improved Select component with haptic feedback integration.

## Project structure
The primitives live under the UI module and are thin wrappers around Radix UI primitives and Tailwind classes. They expose consistent props, variants, and slots for composition. The new Command and Popover components integrate smoothly with the existing component ecosystem.

```mermaid
graph TB
subgraph "UI Primitives"
Btn["Button"]
Inp["Input"]
TxtA["Textarea"]
Sld["Slider"]
Sw["Switch"]
Chk["Checkbox"]
Rg["RadioGroup"]
Pg["Progress"]
Lbl["Label"]
Av["Avatar"]
Bd["Badge"]
Dlg["Dialog"]
Card["Card"]
DM["DropdownMenu"]
Sel["Select"]
Tabs["Tabs"]
Scr["ScrollArea"]
Md["MarkdownRenderer"]
Ldr["Loader"]
Toast["Toast"]
Toaster["Toaster"]
Cmd["Command"]
Pop["Popover"]
end
Btn --> DM
Dlg --> Btn
Sel --> DM
Rg --> DM
Av --> Btn
Card --> Dlg
Tabs --> Card
Scr --> Card
Md --> Card
Ldr --> Dlg
Toast --> Toaster
Cmd --> Dlg
Cmd --> Sel
Pop --> Btn
Pop --> DM
```

## Core components
Below is a concise overview of each primitive, focusing on props, styling, accessibility, and typical usage patterns.

- Button
  - Purpose: Presents actionable controls with variants and sizes.
  - Props: Inherits native button attributes plus variant and size from its variant factory; supports asChild for composing with links or other elements.
  - Styling: Uses Tailwind classes via a variant factory; integrates with theme tokens.
  - Accessibility: Inherits focus-visible styles and disabled states from the variant factory.
  - Usage pattern: Wrap child content; pass onClick; optionally use asChild to render a link.

- Input
  - Purpose: Standard text input with consistent focus and disabled states.
  - Props: Inherits native input attributes; supports type.
  - Styling: Tailwind classes define focus rings, borders, and disabled behavior.
  - Accessibility: Focus-visible ring ensures keyboard operability.
  - Usage pattern: Controlled via useState; combine with Label for accessibility.

- Dialog
  - Purpose: Overlay modal with portal rendering and animated content.
  - Props: Root, Trigger, Portal, Overlay, Content, Close, Header, Footer, Title, Description.
  - Styling: Dark backdrop blur; slide/fade animations; responsive max-width and max-height.
  - Accessibility: Focus trapping via Radix; close button with aria-label; overlay click-to-close.
  - Usage pattern: Open/close via Trigger; render children inside Content; place actions in Footer.

- Card
  - Purpose: Container with header, title, description, content, and footer slots.
  - Props: Standard div attributes; composed via forwardRef.
  - Styling: Tailwind-based card background and shadows; spacing helpers for header/footer.
  - Accessibility: No special ARIA; rely on semantic headings and paragraphs.
  - Usage pattern: Nest Title/Description/Content/Footer inside Card.

- Avatar
  - Purpose: User avatar with fallback icon and optimized image loading.
  - Props: src, alt, size (sm/md/lg), className.
  - Styling: Size classes per variant; pulse loader overlay; brand accent borders.
  - Accessibility: Fallback icon; alt text passed to img.
  - Usage pattern: Provide src; handle optional alt; size affects visual weight.

- Badge
  - Purpose: Small status or metadata indicator.
  - Props: Inherits HTML div attributes plus variant from its variant factory.
  - Styling: Rounded pill shape; variant tokens for color.
  - Accessibility: Stateless; ensure sufficient color contrast.
  - Usage pattern: Render with text content; choose variant for semantic meaning.

- Checkbox
  - Purpose: Binary selection with visual indicator.
  - Props: Inherits Radix checkbox attributes; styled with Tailwind.
  - Styling: Brand-checked state; focus-visible ring; disabled opacity.
  - Accessibility: Works with Label; supports keyboard activation.
  - Usage pattern: Controlled via checked prop; pair with Label.

- DropdownMenu
  - Purpose: Menu with nested submenus, checkboxes, radios, and shortcuts.
  - Props: Root, Trigger, Group, Portal, Sub, SubTrigger, SubContent, Content, Item, CheckboxItem, RadioItem, Label, Separator, Shortcut, RadioGroup.
  - Styling: Popover-like content with transitions; inset support for nested items.
  - Accessibility: Keyboard navigation; focus management; open/close states handled by Radix.
  - Usage pattern: Compose Trigger with Content; nest Sub* for hierarchical menus.

- Label
  - Purpose: Associates text with form controls.
  - Props: Inherits Radix label attributes plus variant from its variant factory.
  - Styling: Peer-disabled cursor and opacity; integrates with form controls.
  - Accessibility: Essential for screen readers; clicking label toggles associated control.
  - Usage pattern: Wrap input/control; apply for-labelledby relationships.

- Loader
  - Purpose: Animated loading indicators with multiple variants and overlay mode.
  - Props: size (sm/md/lg/xl), variant (default/dots/pulse/spinner), className, text.
  - Styling: Motion-based animations; brand color accents; centered layout.
  - Accessibility: Not inherently interactive; consider aria-live regions when used in pages.
  - Usage pattern: Render inline or via LoaderOverlay for full-screen blocking.

- MarkdownRenderer
  - Purpose: Renders markdown with custom GFM-style callouts and details/summary support.
  - Props: content (unknown), className.
  - Styling: Utility-first Tailwind classes targeting details, callouts, and task lists.
  - Accessibility: Ensures semantic headings and lists; details/summary supported.
  - Usage pattern: Pass raw markdown; style via className overrides.

- Progress
  - Purpose: Visual progress bar with numeric value.
  - Props: Inherits Radix progress attributes; value prop drives width.
  - Styling: Background track and animated indicator; transforms based on percentage.
  - Accessibility: Announce progress changes via ARIA if needed.
  - Usage pattern: Bind value to completion percentage.

- RadioGroup
  - Purpose: Single-selection group with visual indicators.
  - Props: Root and Item inherit Radix attributes; styled with Tailwind.
  - Styling: Circular items with focus ring; indicator uses a small circle.
  - Accessibility: Keyboard navigation; checked state managed by Radix.
  - Usage pattern: Use RadioGroup.Root with RadioGroup.Item children.

- ScrollArea
  - Purpose: Adds custom scrollbar to overflow content.
  - Props: Root and ScrollBar inherit Radix attributes; orientation defaults vertical.
  - Styling: Track and thumb with transparency; handles horizontal/vertical modes.
  - Accessibility: Preserves native scrolling semantics.
  - Usage pattern: Wrap content in viewport; ScrollBar is auto-added.

- Select
  - Purpose: Customizable single/multi-select with scroll buttons and popper positioning.
  - Props: Root, Group, Value, Trigger, Content, Label, Item, Separator, ScrollUp/DownButton.
  - Styling: Trigger mimics input; Content uses popover styles; item indicators.
  - Accessibility: Keyboard navigation; focus management; viewport sizing.
  - Usage pattern: Compose Trigger with Content and Item children.
  - **Improved** Now includes haptic feedback integration for improved tactile experience.

- Slider
  - Purpose: Range selector with draggable thumb.
  - Props: Inherits Radix slider attributes; styled with Tailwind.
  - Styling: Track and range; thumb with focus ring.
  - Accessibility: Keyboard and mouse; supports disabled state.
  - Usage pattern: Controlled via value prop; bind onChangeEnd for final updates.

- Switch
  - Purpose: Toggle control with visual knob.
  - Props: Inherits Radix switch attributes; styled with Tailwind.
  - Styling: Track and thumb; focus ring; disabled opacity.
  - Accessibility: Toggle semantics; keyboard activation.
  - Usage pattern: Controlled via checked prop; pair with Label.

- Tabs
  - Purpose: Organizes content into selectable panels.
  - Props: Inherits Radix tabs attributes; styled with Tailwind.
  - Styling: Indicator and panel transitions; focus ring.
  - Accessibility: Keyboard navigation; selected tab receives focus.
  - Usage pattern: Compose List, Trigger, Content; ensure unique ids.

- Textarea
  - Purpose: Multi-line text input with consistent focus/disabled styling.
  - Props: Inherits native textarea attributes.
  - Styling: Tailwind classes mirror Input but for multiline.
  - Accessibility: Focus-visible ring; label association recommended.
  - Usage pattern: Controlled via useState; resize via CSS if needed.

- Toast
  - Purpose: Non-blocking notifications.
  - Props: Inherits attributes appropriate for transient messages.
  - Styling: Tailwind-based; integrates with Toaster.
  - Accessibility: Consider aria-live and role; avoid auto-dismiss for critical info.
  - Usage pattern: Trigger via hook; manage queue via Toaster.

- Toaster
  - Purpose: Container for Toast notifications with queue management.
  - Props: Inherits attributes for toast container.
  - Styling: Tailwind-based; manages stacking and transitions.
  - Accessibility: Ensure sufficient time for reading; allow manual dismissal.
  - Usage pattern: Render once; trigger toasts via hook.

- Command
  - Purpose: Keyboard-driven search and selection interface with instant results.
  - Props: Command, CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandSeparator, CommandShortcut.
  - Styling: Popover-based container with focused styling for selected items.
  - Accessibility: Keyboard navigation with arrow keys, Enter to select, Escape to close.
  - Usage pattern: Wrap search interface with CommandDialog; use CommandInput for search; populate CommandList with CommandItem entries.

- Popover
  - Purpose: Modal-like overlay content positioned relative to a trigger element.
  - Props: Root, Trigger, Content, Anchor with alignment and offset options.
  - Styling: Z-index stacking with fade and slide animations; responsive positioning.
  - Accessibility: Focus management and keyboard interaction; supports align and sideOffset props.
  - Usage pattern: Compose PopoverTrigger with PopoverContent; use PopoverAnchor for precise positioning.

## Architecture overview
These primitives are thin wrappers around Radix UI primitives, exposing a consistent API and styling via Tailwind. They promote composition and accessibility by forwarding refs, preserving event handlers, and integrating with theme tokens. The new Command component integrates with the cmdk library for keyboard-driven interactions, while Popover provides modal-like positioning capabilities.

```mermaid
graph LR
subgraph "Radix UI"
R_Button["@radix-ui/react-button"]
R_Dialog["@radix-ui/react-dialog"]
R_Label["@radix-ui/react-label"]
R_Checkbox["@radix-ui/react-checkbox"]
R_DropDown["@radix-ui/react-dropdown-menu"]
R_Progress["@radix-ui/react-progress"]
R_Radio["@radix-ui/react-radio-group"]
R_Scroll["@radix-ui/react-scroll-area"]
R_Select["@radix-ui/react-select"]
R_Slider["@radix-ui/react-slider"]
R_Switch["@radix-ui/react-switch"]
R_Tabs["@radix-ui/react-tabs"]
R_Popover["@radix-ui/react-popover"]
end
subgraph "Third-party Libraries"
CMDK["cmdk"]
HAPTICS["web-haptics"]
end
subgraph "Tailwind"
TW["Tailwind CSS"]
end
Btn["Button"] --> R_Button
Dlg["Dialog"] --> R_Dialog
Lbl["Label"] --> R_Label
Chk["Checkbox"] --> R_Checkbox
DM["DropdownMenu"] --> R_DropDown
Pg["Progress"] --> R_Progress
Rg["RadioGroup"] --> R_Radio
Scr["ScrollArea"] --> R_Scroll
Sel["Select"] --> R_Select
Sld["Slider"] --> R_Slider
Sw["Switch"] --> R_Switch
Tabs["Tabs"] --> R_Tabs
Pop["Popover"] --> R_Popover
Cmd["Command"] --> CMDK
Sel --> HAPTICS
Btn --> TW
Dlg --> TW
Lbl --> TW
Chk --> TW
DM --> TW
Pg --> TW
Rg --> TW
Scr --> TW
Sel --> TW
Sld --> TW
Sw --> TW
Tabs --> TW
Pop --> TW
Cmd --> TW
```

## Detailed component analysis

### Button
- Composition: Uses a variant factory for consistent variants and sizes; supports asChild to render as a slot element.
- Accessibility: Focus-visible ring and disabled pointer-events.
- Usage patterns: Use variant for semantic intent (default, destructive, outline, secondary, ghost, link); size for density; asChild for anchor tags.

```mermaid
classDiagram
class Button {
+ButtonProps
+forwardRef<HTMLButtonElement>
+asChild? : boolean
+variant : "default"|"destructive"|"outline"|"secondary"|"ghost"|"link"
+size : "default"|"sm"|"lg"|"icon"
}
```

### Dialog
- Composition: Root, Trigger, Portal, Overlay, Content, Close, Header, Footer, Title, Description.
- Accessibility: Focus trap via Radix; overlay click-to-close; close button with aria-label.
- Usage patterns: Open via Trigger; render structured content inside Content; place actions in Footer.

```mermaid
sequenceDiagram
participant U as "User"
participant T as "DialogTrigger"
participant P as "DialogPortal"
participant O as "DialogOverlay"
participant C as "DialogContent"
U->>T : Click
T->>P : Open
P->>O : Render overlay
O->>C : Render content
U->>C : Close via X
C-->>P : Close
```

### Card
- Composition: Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter.
- Accessibility: Semantic headings and paragraphs; ensure contrast.
- Usage patterns: Use CardHeader/Title/Description for metadata; CardContent for body; CardFooter for actions.

```mermaid
classDiagram
class Card {
+HTMLAttributes<HTMLDivElement>
}
class CardHeader
class CardTitle
class CardDescription
class CardContent
class CardFooter
Card <|-- CardHeader
Card <|-- CardTitle
Card <|-- CardDescription
Card <|-- CardContent
Card <|-- CardFooter
```

### Avatar
- Composition: Image with fallback icon; optimized URL handling for external providers; loading/error states.
- Accessibility: Alt text; fallback icon when image fails.
- Usage patterns: Provide src; size affects visual weight; alt text improves accessibility.

```mermaid
flowchart TD
Start(["Render Avatar"]) --> HasSrc{"Has src?"}
HasSrc --> |No| Fallback["Show icon with size classes"]
HasSrc --> |Yes| Load["Show loading overlay"]
Load --> Img["Render img with optimized URL"]
Img --> OnLoad["onLoad hide overlay"]
Img --> OnError{"Error and retry < 2?"}
OnError --> |Yes| Retry["Force re-render with direct URL"]
OnError --> |No| Fallback
OnLoad --> End(["Done"])
Retry --> End
Fallback --> End
```

### Badge
- Composition: Variant factory for default, secondary, destructive, outline.
- Accessibility: Stateless; ensure contrast with background.
- Usage patterns: Use variant to reflect status or category.

```mermaid
classDiagram
class Badge {
+BadgeProps
+variant : "default"|"secondary"|"destructive"|"outline"
}
```

### Checkbox
- Composition: Radix Checkbox with styled indicator.
- Accessibility: Works with Label; keyboard activation.
- Usage patterns: Controlled via checked; pair with Label.

```mermaid
classDiagram
class Checkbox {
+ComponentPropsWithoutRef
+className
}
```

### DropdownMenu
- Composition: Root, Trigger, Portal, Sub, SubTrigger, SubContent, Content, Item, CheckboxItem, RadioItem, Label, Separator, Shortcut, RadioGroup.
- Accessibility: Keyboard navigation; focus management.
- Usage patterns: Compose Trigger with Content; nest Sub* for hierarchical menus.

```mermaid
classDiagram
class DropdownMenu {
+Root
+Trigger
+Portal
+Sub
+SubTrigger
+SubContent
+Content
+Item
+CheckboxItem
+RadioItem
+Label
+Separator
+Shortcut
+RadioGroup
}
```

### Label
- Composition: Radix Label with variant factory.
- Accessibility: Essential for screen readers; clicking toggles associated control.
- Usage patterns: Wrap input/control; apply for-labelledby relationships.

```mermaid
classDiagram
class Label {
+ComponentPropsWithoutRef
+className
}
```

### Loader
- Composition: Multiple variants (default/dots/pulse/spinner) with optional text; overlay mode.
- Accessibility: Not inherently interactive; consider aria-live regions.
- Usage patterns: Render inline or via LoaderOverlay for full-screen blocking.

```mermaid
flowchart TD
Start(["Render Loader"]) --> Variant{"Variant"}
Variant --> |dots| Dots["Three pulsing dots"]
Variant --> |pulse| Pulse["Pulsing gradient circle"]
Variant --> |spinner| Spinner["Rotating border"]
Variant --> |default| Default["Dual-ring + center dot"]
Dots --> Text{"Has text?"}
Pulse --> Text
Spinner --> Text
Default --> Text
Text --> |Yes| WithText["Render text with fade animation"]
Text --> |No| End(["Done"])
WithText --> End
```

### MarkdownRenderer
- Composition: Uses a hook to produce rendered parts; applies Tailwind utilities for details/summaries, callouts, and task lists.
- Accessibility: Ensures semantic headings and lists; details/summary supported.
- Usage patterns: Pass raw markdown; style via className overrides.

```mermaid
flowchart TD
Start(["Render MarkdownRenderer"]) --> Hook["useMarkdown(content)"]
Hook --> Parts{"renderedParts"}
Parts --> |null| Null["Return null"]
Parts --> |exists| Container["Render container with utilities"]
Container --> End(["Done"])
Null --> End
```

### Progress
- Composition: Radix Progress with styled indicator.
- Accessibility: Announce progress changes via ARIA if needed.
- Usage patterns: Bind value to completion percentage.

```mermaid
classDiagram
class Progress {
+ComponentPropsWithoutRef
+value : number
}
```

### RadioGroup
- Composition: Radix RadioGroup with styled items.
- Accessibility: Keyboard navigation; checked state managed by Radix.
- Usage patterns: Use RadioGroup.Root with RadioGroup.Item children.

```mermaid
classDiagram
class RadioGroup {
+Root
+Item
}
```

### ScrollArea
- Composition: Radix ScrollArea with styled scrollbar.
- Accessibility: Preserves native scrolling semantics.
- Usage patterns: Wrap content in viewport; ScrollBar is auto-added.

```mermaid
classDiagram
class ScrollArea {
+Root
+ScrollBar
}
```

### Select
- Composition: Root, Trigger, Content, Item, Label, Separator, ScrollUp/DownButton.
- Accessibility: Keyboard navigation; focus management; viewport sizing.
- Usage patterns: Compose Trigger with Content and Item children.
- **Improved** Integrated haptic feedback for improved tactile experience during interactions.

**Updated** Improved Select component now includes haptic feedback integration through the haptic utility. The SelectTrigger and SelectItem components now trigger haptic pulses on user interactions:
- SelectTrigger triggers "medium" haptic feedback when opening the dropdown
- SelectItem triggers "selection" haptic feedback when selecting an option

```mermaid
flowchart TD
Start(["Select Interaction"]) --> Trigger{"SelectTrigger clicked?"}
Trigger --> |Yes| MediumHaptic["Trigger 'medium' haptic"]
MediumHaptic --> Open["Open dropdown"]
Trigger --> |No| Item{"SelectItem clicked?"}
Item --> |Yes| SelectionHaptic["Trigger 'selection' haptic"]
SelectionHaptic --> Select["Select option"]
Item --> |No| End(["No action"])
Open --> End
Select --> End
```

### Slider
- Composition: Radix Slider with styled track and thumb.
- Accessibility: Keyboard and mouse; supports disabled state.
- Usage patterns: Controlled via value prop; bind onChangeEnd for final updates.

```mermaid
classDiagram
class Slider {
+ComponentPropsWithoutRef
}
```

### Switch
- Composition: Radix Switch with styled thumb.
- Accessibility: Toggle semantics; keyboard activation.
- Usage patterns: Controlled via checked prop; pair with Label.

```mermaid
classDiagram
class Switch {
+ComponentPropsWithoutRef
}
```

### Tabs
- Composition: Radix Tabs with styled triggers and content.
- Accessibility: Keyboard navigation; selected tab receives focus.
- Usage patterns: Compose List, Trigger, Content; ensure unique ids.

```mermaid
classDiagram
class Tabs {
+Root
+List
+Trigger
+Content
}
```

### Textarea
- Composition: Native textarea with consistent focus/disabled styling.
- Accessibility: Focus-visible ring; label association recommended.
- Usage patterns: Controlled via useState; resize via CSS if needed.

```mermaid
classDiagram
class Textarea {
+InputHTMLAttributes
}
```

### Toast and toaster
- Composition: Toast is a transient message; Toaster manages queue and presentation.
- Accessibility: Consider aria-live and role; avoid auto-dismiss for critical info.
- Usage patterns: Trigger via hook; manage queue via Toaster.

```mermaid
sequenceDiagram
participant App as "App"
participant Hook as "useToast()"
participant Toaster as "Toaster"
participant Toast as "Toast"
App->>Hook : Trigger toast
Hook->>Toaster : Enqueue toast
Toaster->>Toast : Render toast
Toast-->>Toaster : Dismiss
Toaster-->>App : Update queue
```

### Command
- Composition: Command, CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandSeparator, CommandShortcut.
- Accessibility: Keyboard navigation with arrow keys, Enter to select, Escape to close.
- Usage patterns: Wrap search interface with CommandDialog; use CommandInput for search; populate CommandList with CommandItem entries.

**New Component** The Command component provides a keyboard-driven search and selection interface inspired by applications like Spotlight and Alfred. It integrates with the cmdk library for instant search results and keyboard navigation.

```mermaid
flowchart TD
Start(["Command Interface"]) --> Open["Open CommandDialog"]
Open --> Input["Type in CommandInput"]
Input --> Results["Filter CommandList"]
Results --> Navigate{"Keyboard navigation?"}
Navigate --> |Arrow Keys| Move["Move selection"]
Navigate --> |Enter| Select["Select CommandItem"]
Navigate --> |Escape| Close["Close dialog"]
Move --> Results
Select --> Action["Execute action"]
Action --> Close
Close --> End(["Done"])
```

### Popover
- Composition: Root, Trigger, Content, Anchor with alignment and offset options.
- Accessibility: Focus management and keyboard interaction; supports align and sideOffset props.
- Usage patterns: Compose PopoverTrigger with PopoverContent; use PopoverAnchor for precise positioning.

**New Component** The Popover component provides modal-like overlay content positioned relative to a trigger element. It offers flexible positioning with alignment options and smooth animations.

```mermaid
classDiagram
class Popover {
+Root
+Trigger
+Content
+Anchor
}
class PopoverContent {
+align : "start"|"center"|"end"
+sideOffset : number
}
Popover <|-- PopoverContent
```

## Dependency analysis
- Radix UI integration: All interactive primitives depend on Radix UI for state, focus, and accessibility semantics.
- Tailwind CSS integration: Primitives apply consistent utility classes for colors, spacing, typography, and motion.
- Third-party library integration: Command component integrates with cmdk for keyboard-driven interactions; haptic feedback integrates with web-haptics library.
- Composition patterns: Many components expose subcomponents (e.g., Dialog, DropdownMenu, Select, Tabs, Command, Popover) enabling modular composition.

```mermaid
graph TB
Btn["Button"] --> R_B["@radix-ui/react-button"]
Dlg["Dialog"] --> R_D["@radix-ui/react-dialog"]
Lbl["Label"] --> R_L["@radix-ui/react-label"]
Chk["Checkbox"] --> R_C["@radix-ui/react-checkbox"]
DM["DropdownMenu"] --> R_DM["@radix-ui/react-dropdown-menu"]
Pg["Progress"] --> R_P["@radix-ui/react-progress"]
Rg["RadioGroup"] --> R_RG["@radix-ui/react-radio-group"]
Scr["ScrollArea"] --> R_SA["@radix-ui/react-scroll-area"]
Sel["Select"] --> R_S["@radix-ui/react-select"]
Sld["Slider"] --> R_Sl["@radix-ui/react-slider"]
Sw["Switch"] --> R_Sw["@radix-ui/react-switch"]
Tabs["Tabs"] --> R_T["@radix-ui/react-tabs"]
Pop["Popover"] --> R_Pop["@radix-ui/react-popover"]
Cmd["Command"] --> CMDK["cmdk"]
Sel --> HAPTICS["web-haptics"]
Btn --> TW["Tailwind CSS"]
Dlg --> TW
Lbl --> TW
Chk --> TW
DM --> TW
Pg --> TW
Rg --> TW
Scr --> TW
Sel --> TW
Sld --> TW
Sw --> TW
Tabs --> TW
Pop --> TW
Cmd --> TW
```

## Performance considerations
- Prefer variant factories for consistent styling to reduce runtime style computations.
- Use asChild where appropriate to avoid unnecessary DOM nodes.
- Keep animations minimal; use motion libraries only when necessary.
- Defer heavy computations in render-heavy components like MarkdownRenderer.
- Use portals judiciously to avoid layout thrashing.
- **New** Consider haptic feedback performance implications - haptic pulses are brief but should be throttled to prevent excessive vibration.
- **New** Command component performance: Use virtualized lists for large datasets to maintain smooth keyboard navigation.

## Troubleshooting guide
- Dialog does not close on overlay click:
  - Ensure Overlay and Content are both rendered and that Close is reachable.
- Checkbox or RadioGroup not reflecting state:
  - Verify controlled props (checked/value) are bound correctly.
- Select menu appears off-screen:
  - Adjust container prop and ensure parent has overflow visible.
- Avatar flickers or shows fallback:
  - Confirm src URL validity; check network errors and retry logic.
- Loader not visible:
  - Verify variant and size combinations; ensure className overrides do not hide elements.
- MarkdownRenderer styles not applied:
  - Confirm className concatenation and that utility classes are not overridden by conflicting styles.
- **New** Command component issues:
  - Ensure cmdk is properly installed and imported; verify keyboard navigation works with arrow keys and Enter.
  - Check that CommandDialog wraps CommandInput and CommandList correctly.
- **New** Popover positioning problems:
  - Adjust align and sideOffset props; ensure parent has proper positioning context.
  - Verify PopoverAnchor is positioned correctly relative to trigger.
- **New** Haptic feedback not working:
  - Check browser support for Vibration API; verify user hasn't disabled haptics in preferences.
  - Ensure haptic utility is imported and called with valid intensity levels.

## Conclusion
These primitives form a cohesive foundation for building accessible, consistent, and maintainable UI surfaces. By using Radix UI for behavior and Tailwind for styling, components remain composable, customizable, and aligned with platform best practices. The addition of the Command component improves keyboard-driven workflows, while the Popover component provides flexible modal-like interactions. The improved Select component with haptic feedback creates a more engaging user experience through tactile responses. Use the provided patterns to construct higher-level components while preserving accessibility and performance.

## Appendices
- Customization guidelines:
  - Use variant factories for semantic variants.
  - Apply className to augment Tailwind utilities without overriding core styles.
  - Pair form controls with Label for accessibility.
  - Test keyboard navigation and focus states across components.
  - **New** For Command components, ensure proper keyboard accessibility and screen reader support.
  - **New** For Popover components, test positioning across different screen sizes and orientations.
- State management:
  - Control interactive components via React state.
  - Use hooks for toast queues and markdown rendering.
  - Avoid excessive re-renders by memoizing derived values.
  - **New** Implement debouncing for Command search inputs to improve performance.
  - **New** Manage haptic feedback preferences through localStorage persistence.
- **New** Haptic Feedback Integration:
  - Use semantic intensity levels: "selection", "light", "medium", "heavy", "success", "error", "tick"
  - Integrate haptic feedback for key interactions: dropdown opens, option selections, form submissions
  - Respect user preferences and gracefully handle unsupported devices
  - Test haptic feedback across different devices and browsers
