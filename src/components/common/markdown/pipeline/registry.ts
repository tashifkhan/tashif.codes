/**
 * The component registry.
 *
 * One declarative table describing every component an author can reach, shared
 * by four consumers that would otherwise each hold their own copy of the rules:
 *
 *   - `directives.ts` — resolves `:::name` against it
 *   - `jsx.ts`        — resolves `<Name>` against it
 *   - `render.ts`     — dispatches `directive_open` through `render`
 *   - `validate.ts`   — walks `attrs` / `parents` / `children` to lint a draft
 *
 * Adding a component means adding one entry here. Nothing else has to learn
 * about it, and the editor's insert palette picks it up for free.
 *
 * This module must stay free of any markdown-it dependency: the editor's
 * publish route imports the validator server-side and must not pull in a
 * parser to do it.
 */

import { getIcon, ICON_NAMES, isIconName } from './icons'
import type { MarkdownTheme } from './theme'

export { ICON_NAMES, isIconName, getIcon } from './icons'

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (char) => HTML_ESCAPES[char])
}

export type AttrSpec = {
  type: 'string' | 'number' | 'boolean' | 'enum'
  /** Permitted values, for `type: 'enum'`. */
  values?: readonly string[]
  default?: string | number | boolean
  required?: boolean
  /** Shown in the editor palette and in validation messages. */
  describe?: string
}

export type AttrValues = Record<string, string | number | boolean | undefined>

export type HeadingEntry = { depth: number; text: string; slug: string }

export type RenderCtx = {
  /** Attributes after coercion, defaults applied. */
  attrs: AttrValues
  theme: MarkdownTheme
  /**
   * Headings of the document being rendered. Only populated when the source
   * actually uses a component that asks for them, so the common case does not
   * pay for a second parse.
   */
  headings: readonly HeadingEntry[]
  /**
   * True when this occurrence sits inside a paragraph. Components allowed in
   * both positions use it to pick an inline or a block element, since a `span`
   * cannot hold paragraphs and a `div` inside a `<p>` is invalid.
   */
  inline: boolean
}

export type ComponentSpec = {
  /** PascalCase tag name: `<Steps>`. */
  name: string
  /** Kebab-case directive name: `:::steps`. */
  directive: string
  /** Additional directive spellings kept working for already-published posts. */
  aliases?: readonly string[]
  /**
   * `block` — body is re-tokenized as Markdown
   * `raw`   — body is captured verbatim, for content Markdown would mangle
   * `none`  — no body; the tag is self-closing
   */
  body: 'block' | 'raw' | 'none'
  /**
   * Where the tag may appear. `block` components are claimed only on a line of
   * their own; `inline` ones only inside a paragraph. Defaults to `block`.
   */
  placement?: 'block' | 'inline' | 'both'
  attrs: Record<string, AttrSpec>
  /** Attribute a bare value maps to, so `:::note Heads up` needs no braces. */
  positional?: string
  /** Component must sit directly inside one of these (by `name`). */
  parents?: readonly string[]
  /** Direct-child requirement, enforced by the validator. */
  children?: { name: string; min?: number; max?: number }
  /** Set when `render` reads `ctx.headings`, so the renderer knows to fill it. */
  needsHeadings?: boolean
  /** One-line description for the editor palette. */
  describe: string
}

// ---------------------------------------------------------------------------
// Shared attribute shapes
// ---------------------------------------------------------------------------

/**
 * Track templates for `Cols`.
 *
 * Equal-column layouts are also available via the `cols` number attribute
 * (`cols={3}` → three equal tracks). Prefer `cols` when the tracks match; use
 * `ratio` when they should not.
 */
export const COLUMN_RATIOS = {
  '1:1': '1fr 1fr',
  '2:1': '2fr 1fr',
  '1:2': '1fr 2fr',
  '1:1:1': '1fr 1fr 1fr',
  '2:1:1': '2fr 1fr 1fr',
  '1:2:1': '1fr 2fr 1fr',
  '1:1:2': '1fr 1fr 2fr',
  '3:1:1': '3fr 1fr 1fr',
  '1:1:1:1': '1fr 1fr 1fr 1fr',
  '2:1:1:1': '2fr 1fr 1fr 1fr',
  '1:1:1:2': '1fr 1fr 1fr 2fr',
} as const

export type ColumnRatio = keyof typeof COLUMN_RATIOS

/** Shared optional Lucide-style icon attribute used by several components. */
const ICON_ATTR: Record<string, AttrSpec> = {
  icon: {
    type: 'string',
    describe: `Lucide-style icon name (e.g. arrow-up-right, languages, zap). Known: ${ICON_NAMES.slice(0, 8).join(', ')}, …`,
  },
}

export const CALLOUT_NAMES = [
  'note',
  'tip',
  'important',
  'warning',
  'caution',
  'danger',
] as const

export type CalloutName = (typeof CALLOUT_NAMES)[number]

export const CALLOUT_LABELS: Record<string, string> = {
  note: 'Note',
  tip: 'Tip',
  important: 'Important',
  warning: 'Warning',
  caution: 'Caution',
  danger: 'Danger',
}

const TITLE_ATTR: Record<string, AttrSpec> = {
  title: { type: 'string', describe: 'Heading shown in the callout bar' },
}

/** Accent names components may tint themselves with, from the site's tokens. */
export const TONES = ['accent', 'alt', 'ok', 'warn', 'danger', 'muted'] as const

/** A callout entry, built the same way six times. */
function calloutSpec(name: CalloutName): ComponentSpec {
  const pascal = name[0].toUpperCase() + name.slice(1)
  return {
    name: pascal,
    directive: name,
    body: 'block',
    attrs: TITLE_ATTR,
    positional: 'title',
    describe: `${CALLOUT_LABELS[name]} callout`,
  }
}

// ---------------------------------------------------------------------------
// The registry
// ---------------------------------------------------------------------------

export const COMPONENTS: readonly ComponentSpec[] = [
  {
    name: 'Cols',
    directive: 'cols',
    aliases: ['two-col'],
    body: 'block',
    attrs: {
      cols: {
        type: 'number',
        default: 2,
        describe: 'Equal columns, 2 to 4 (ignored when ratio is set)',
      },
      ratio: {
        type: 'enum',
        values: Object.keys(COLUMN_RATIOS),
        describe: 'Relative track widths; overrides equal cols when set. Positional: ::::cols 2:1',
      },
    },
    // Positional stays `ratio` so published posts (`::::cols 2:1`) keep working.
    // Equal multi-column layouts use the explicit attribute: `<Cols cols={3}>`.
    positional: 'ratio',
    children: { name: 'Col', min: 2, max: 4 },
    describe: 'Responsive multi-column grid (2–4 cols) that stacks on narrow containers',
  },
  {
    name: 'Col',
    directive: 'col',
    body: 'block',
    attrs: {},
    parents: ['Cols'],
    describe: 'One column inside Cols',
  },
  ...CALLOUT_NAMES.map(calloutSpec),

  // ---- layout -------------------------------------------------------------
  {
    name: 'Panel',
    directive: 'panel',
    body: 'block',
    attrs: {
      title: { type: 'string', describe: 'Optional heading above the body' },
      ...ICON_ATTR,
      tape: { type: 'boolean', describe: 'Draw a strip of masking tape on top' },
      tilt: { type: 'number', describe: 'Rotation in degrees, -15 to 15' },
      tone: { type: 'enum', values: TONES, describe: 'Accent colour' },
    },
    positional: 'title',
    describe: 'Bordered card, optionally with a Lucide icon, taped and tilted',
  },
  {
    name: 'Icon',
    directive: 'icon',
    body: 'none',
    placement: 'both',
    attrs: {
      name: {
        type: 'string',
        required: true,
        describe: 'Lucide-style icon name (arrow-up-right, languages, zap, …)',
      },
      size: {
        type: 'number',
        default: 24,
        describe: 'Pixel size, 12 to 64',
      },
    },
    positional: 'name',
    describe: 'Inline Lucide-style SVG icon',
  },
  {
    name: 'InkBand',
    directive: 'ink-band',
    body: 'block',
    attrs: {
      title: { type: 'string', describe: 'Optional heading' },
    },
    positional: 'title',
    describe: 'Inverted full-width section, for a break in the page',
  },
  {
    name: 'Strips',
    directive: 'strips',
    body: 'block',
    attrs: {},
    describe: 'Turns a list into offset cards',
  },

  // ---- document structure -------------------------------------------------
  {
    name: 'Toc',
    directive: 'toc',
    body: 'none',
    needsHeadings: true,
    attrs: {
      title: { type: 'string', default: 'Contents', describe: 'Heading above the list' },
      depth: {
        type: 'number',
        default: 3,
        describe: 'Deepest heading level to include, 2 to 6',
      },
      from: {
        type: 'number',
        default: 2,
        describe: 'Shallowest heading level to include',
      },
    },
    describe: 'Table of contents, built from the document’s own headings',
  },
  {
    name: 'Steps',
    directive: 'steps',
    body: 'block',
    attrs: {},
    children: { name: 'Step', min: 1 },
    describe: 'Numbered sequence of instructions',
  },
  {
    name: 'Step',
    directive: 'step',
    body: 'block',
    parents: ['Steps'],
    attrs: {
      title: { type: 'string', describe: 'Short label for the step' },
      ...ICON_ATTR,
    },
    positional: 'title',
    describe: 'One step; numbering is automatic',
  },
  {
    name: 'Phases',
    directive: 'phases',
    body: 'block',
    attrs: {},
    children: { name: 'Phase', min: 1 },
    describe: 'Rollout phases or a timeline',
  },
  {
    name: 'Phase',
    directive: 'phase',
    body: 'block',
    parents: ['Phases'],
    attrs: {
      title: { type: 'string', required: true, describe: 'Phase name' },
      tag: { type: 'string', describe: 'Short chip, e.g. a date or "now"' },
      tone: { type: 'enum', values: TONES, describe: 'Accent colour' },
      ...ICON_ATTR,
    },
    positional: 'title',
    describe: 'One phase, with an optional chip and Lucide icon',
  },
  {
    name: 'Checklist',
    directive: 'checklist',
    body: 'block',
    attrs: {
      title: { type: 'string', describe: 'Optional heading' },
    },
    positional: 'title',
    describe: 'Framed task list',
  },
  {
    name: 'Lede',
    directive: 'lede',
    body: 'block',
    attrs: {},
    describe: 'Opening paragraph, set larger than body text',
  },

  // ---- data ---------------------------------------------------------------
  {
    name: 'Meters',
    directive: 'meters',
    body: 'block',
    attrs: {},
    children: { name: 'Meter', min: 1 },
    describe: 'Scored rubric, e.g. a risk register',
  },
  {
    name: 'Meter',
    directive: 'meter',
    body: 'block',
    parents: ['Meters'],
    attrs: {
      label: { type: 'string', required: true, describe: 'What is being scored' },
      level: {
        type: 'enum',
        values: ['high', 'mid', 'low'],
        default: 'mid',
        describe: 'Severity band, which sets the colour',
      },
      score: { type: 'number', default: 5, describe: 'Score out of 10' },
    },
    positional: 'label',
    describe: 'One scored row; the body is the explanation',
  },
  {
    name: 'Kpi',
    directive: 'kpi',
    body: 'block',
    attrs: {
      cols: { type: 'number', default: 3, describe: 'Columns, 2 to 4' },
    },
    positional: 'cols',
    children: { name: 'Stat', min: 1 },
    describe: 'Row of headline numbers',
  },
  {
    name: 'Stat',
    directive: 'stat',
    body: 'none',
    parents: ['Kpi'],
    attrs: {
      value: { type: 'string', required: true, describe: 'The number itself' },
      label: { type: 'string', required: true, describe: 'What it measures' },
      tone: { type: 'enum', values: TONES, describe: 'Accent colour' },
      ...ICON_ATTR,
    },
    describe: 'One headline number inside Kpi',
  },
  {
    name: 'Bars',
    directive: 'bars',
    body: 'block',
    attrs: {
      title: { type: 'string', describe: 'Optional heading' },
    },
    positional: 'title',
    describe: 'Horizontal bar chart',
  },
  {
    name: 'Bar',
    directive: 'bar',
    body: 'none',
    parents: ['Bars'],
    attrs: {
      label: { type: 'string', required: true, describe: 'Row label' },
      value: { type: 'number', required: true, describe: 'Bar length' },
      max: { type: 'number', default: 100, describe: 'Value at full width' },
      display: { type: 'string', describe: 'Text to show instead of the raw value' },
      tone: { type: 'enum', values: TONES, describe: 'Bar colour' },
    },
    describe: 'One bar inside Bars',
  },
  {
    name: 'Legend',
    directive: 'legend',
    body: 'block',
    attrs: {},
    describe: 'Turns a list into inline legend chips',
  },

  // ---- marginalia ---------------------------------------------------------
  {
    name: 'Sticker',
    directive: 'sticker',
    body: 'block',
    placement: 'both',
    attrs: {
      shape: {
        type: 'enum',
        values: ['round', 'rect'],
        default: 'rect',
        describe: 'Sticker outline',
      },
      tone: { type: 'enum', values: TONES, describe: 'Fill colour' },
      rotate: { type: 'number', describe: 'Rotation in degrees, -15 to 15' },
    },
    positional: 'shape',
    describe: 'Small stamped label',
  },
  {
    name: 'Hand',
    directive: 'hand',
    body: 'block',
    placement: 'both',
    attrs: {},
    describe: 'Handwritten aside',
  },
  {
    name: 'Tape',
    directive: 'tape',
    body: 'none',
    placement: 'both',
    attrs: {
      rotate: { type: 'number', describe: 'Rotation in degrees, -15 to 15' },
    },
    describe: 'Decorative strip of masking tape',
  },
  {
    name: 'Mark',
    directive: 'mark',
    body: 'block',
    placement: 'inline',
    attrs: {
      tone: { type: 'enum', values: TONES, describe: 'Highlighter colour' },
    },
    positional: 'tone',
    describe: 'Highlighter pen',
  },

  // ---- media --------------------------------------------------------------
  {
    name: 'Figure',
    directive: 'figure',
    body: 'block',
    attrs: {
      caption: { type: 'string', describe: 'Caption below the content' },
      credit: { type: 'string', describe: 'Attribution, shown after the caption' },
      full: { type: 'boolean', describe: 'Break out to the full content width' },
    },
    positional: 'caption',
    describe: 'Captioned figure around an image, table or diagram',
  },
  {
    name: 'Ascii',
    directive: 'ascii',
    body: 'raw',
    attrs: {
      label: {
        type: 'string',
        required: true,
        describe: 'Description of the diagram, for screen readers',
      },
    },
    positional: 'label',
    describe: 'Monospaced diagram, kept exactly as written',
  },
  {
    name: 'Embed',
    directive: 'embed',
    body: 'none',
    attrs: {
      type: {
        type: 'enum',
        values: ['youtube', 'vimeo', 'gist', 'codepen'],
        required: true,
        describe: 'Which provider',
      },
      id: { type: 'string', required: true, describe: 'Provider id or user/hash' },
      title: { type: 'string', describe: 'Accessible title for the frame' },
    },
    describe: 'Embedded video or snippet from an allowed provider',
  },

  // ---- interaction --------------------------------------------------------
  {
    name: 'Tabs',
    directive: 'tabs',
    body: 'block',
    attrs: {},
    children: { name: 'Tab', min: 1 },
    describe: 'Tabbed panels; falls back to stacked sections without JS',
  },
  {
    name: 'Tab',
    directive: 'tab',
    body: 'block',
    parents: ['Tabs'],
    attrs: {
      title: { type: 'string', required: true, describe: 'Tab label' },
    },
    positional: 'title',
    describe: 'One panel inside Tabs',
  },
  {
    name: 'Details',
    directive: 'details',
    body: 'block',
    attrs: {
      summary: {
        type: 'string',
        required: true,
        describe: 'The always-visible line',
      },
      open: { type: 'boolean', describe: 'Start expanded' },
    },
    positional: 'summary',
    describe: 'Collapsible section',
  },
]

/** Provider id patterns, kept next to the URLs they build. */
const EMBED_PROVIDERS: Record<
  string,
  { pattern: RegExp; url: (id: string) => string }
> = {
  youtube: {
    pattern: /^[A-Za-z0-9_-]{6,20}$/,
    // The -nocookie host so an embedded video does not set a tracking cookie
    // on a reader who never pressed play.
    url: (id) => `https://www.youtube-nocookie.com/embed/${id}`,
  },
  vimeo: {
    pattern: /^\d{6,12}$/,
    url: (id) => `https://player.vimeo.com/video/${id}`,
  },
  gist: {
    pattern: /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[0-9a-f]{20,40}$/,
    url: (id) => `https://gist.github.com/${id}.pibb`,
  },
  codepen: {
    pattern: /^[A-Za-z0-9_-]{1,40}\/[A-Za-z0-9]{5,12}$/,
    url: (id) => `https://codepen.io/${id.replace('/', '/embed/')}`,
  },
}

/** The embed URL for a provider and id, or `null` if either is not allowed. */
export function embedUrl(provider: string, id: string): string | null {
  const entry = EMBED_PROVIDERS[provider]
  if (!entry || !entry.pattern.test(id)) return null
  return entry.url(id)
}

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

const BY_NAME = new Map<string, ComponentSpec>()
const BY_DIRECTIVE = new Map<string, ComponentSpec>()

for (const spec of COMPONENTS) {
  BY_NAME.set(spec.name.toLowerCase(), spec)
  BY_DIRECTIVE.set(spec.directive, spec)
  for (const alias of spec.aliases ?? []) BY_DIRECTIVE.set(alias, spec)
}

/** Resolve a `:::name` directive, including back-compat aliases. */
export function findByDirective(name: string): ComponentSpec | undefined {
  return BY_DIRECTIVE.get(name.toLowerCase())
}

/** Resolve a `<Name>` tag. Case-insensitive, so `<cols>` also works. */
export function findByTag(name: string): ComponentSpec | undefined {
  return BY_NAME.get(name.toLowerCase()) ?? BY_DIRECTIVE.get(name.toLowerCase())
}

/** Every spelling the parsers accept, for error messages. */
export const DIRECTIVE_NAMES: readonly string[] = COMPONENTS.flatMap((spec) => [
  spec.directive,
  ...(spec.aliases ?? []),
])

export const COMPONENT_NAMES: readonly string[] = COMPONENTS.map(
  (spec) => spec.name,
)

export function isCalloutName(name: string): boolean {
  return (CALLOUT_NAMES as readonly string[]).includes(name)
}

// ---------------------------------------------------------------------------
// Attribute coercion
// ---------------------------------------------------------------------------

/**
 * Coerce raw string attributes against a spec and apply defaults.
 *
 * Rendering is forgiving on purpose: a bad enum value falls back to its default
 * rather than throwing, because a post that reaches a reader with one wrong
 * attribute should still render. `validate.ts` is what turns the same mistake
 * into a publish blocker, where it can still be fixed.
 */
export function resolveAttrs(
  spec: ComponentSpec,
  raw: Record<string, string>,
): AttrValues {
  const out: AttrValues = {}

  for (const [key, attr] of Object.entries(spec.attrs)) {
    const value = raw[key]

    if (value === undefined) {
      if (attr.default !== undefined) out[key] = attr.default
      else if (attr.type === 'boolean') out[key] = false
      continue
    }

    switch (attr.type) {
      case 'number': {
        const parsed = Number(value)
        out[key] = Number.isFinite(parsed) ? parsed : attr.default
        break
      }
      case 'boolean':
        // A bare `<Panel tilt>` parses to the empty string, which reads as on.
        out[key] = value === '' || value === 'true' || value === 'yes'
        break
      case 'enum':
        out[key] = attr.values?.includes(value) ? value : attr.default
        break
      default:
        out[key] = value
    }
  }

  return out
}
