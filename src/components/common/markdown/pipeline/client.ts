import { trigger } from "@/lib/haptics"
import type { Mounted } from 'pele/lazy'
import { sketchPeleSvg } from './pele-sketch'

/**
 * Browser-side behaviour for rendered Markdown: copy buttons and diagrams.
 *
 * Diagrams are drawn by Pele (obsidianmd/pele), the Mermaid renderer T3 Code
 * uses, with an Excalidraw finish from pele-sketch.ts. Pele loads lazily, one
 * chunk per diagram type. Mermaid.js is passed in as a loader rather than
 * imported, and only loads for a diagram Pele can't parse.
 */

export type MermaidLike = {
  initialize: (config: Record<string, unknown>) => void
  render: (id: string, source: string) => Promise<{ svg: string }>
}

let copyDelegateInstalled = false

async function writeToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    return
  } catch {
    // Falls through: insecure contexts and older Safari reject the async API.
  }

  const fallback = document.createElement('textarea')
  fallback.value = text
  fallback.style.position = 'fixed'
  fallback.style.opacity = '0'
  document.body.appendChild(fallback)
  fallback.select()
  try {
    if (!document.execCommand('copy')) throw new Error('Copy failed')
  } finally {
    document.body.removeChild(fallback)
  }
}

/**
 * Install the copy-button handler.
 *
 * One delegated listener on the document rather than a listener per button:
 * the blog renders posts inside a `client:only` React island, so the buttons do
 * not exist yet when this module first runs, and the portfolio swaps the whole
 * article on view transitions. Delegation covers both without re-binding, and
 * the guard keeps repeat calls from stacking handlers.
 */
export function initCopyButtons(): void {
  if (copyDelegateInstalled) return
  copyDelegateInstalled = true

  document.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof Element)) return
    const button = target.closest<HTMLButtonElement>('.md-code-copy')
    if (!button) return

    const encoded = button.getAttribute('data-code')
    if (!encoded) return

    // `data-code` holds HTML-escaped source; decode it through the parser
    // rather than a hand-rolled entity table.
    const decoder = document.createElement('textarea')
    decoder.innerHTML = encoded

    void writeToClipboard(decoder.value).then(() => {
      trigger('success')
      button.setAttribute('aria-label', 'Copy code')
      button.dataset.copied = 'true'
      window.setTimeout(() => {
        delete button.dataset.copied
      }, 2000)
    }).catch(() => {
      trigger('error')
      button.setAttribute('aria-label', 'Copy failed. Select the code and copy manually.')
    })
  })
}

let tabsDelegateInstalled = false
let tabSequence = 0

/** The panels of one `<Tabs>` group, in document order. */
function tabPanels(group: Element): HTMLElement[] {
  return Array.from(group.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement && child.classList.contains('md-tab'),
  )
}

function selectTab(group: HTMLElement, index: number): void {
  const panels = tabPanels(group)
  const buttons = group.querySelectorAll<HTMLButtonElement>('.md-tab-button')

  panels.forEach((panel, position) => {
    panel.hidden = position !== index
  })
  buttons.forEach((button, position) => {
    const selected = position === index
    button.setAttribute('aria-selected', String(selected))
    // Roving tabindex: only the selected tab is a tab stop, so Tab moves past
    // the strip rather than through every label in it.
    button.tabIndex = selected ? 0 : -1
  })
}

/**
 * Build the tab strip for every `<Tabs>` group under `root`.
 *
 * The strip is generated here rather than rendered server-side because a
 * component's `render` sees only its own attributes, and the buttons have to
 * carry the titles of siblings that have not been rendered yet. Building it
 * client-side also means the no-JS fallback is the honest one: every panel
 * visible under its own heading, which reads as a document rather than as a
 * widget that failed to load.
 *
 * Groups are marked once built, so this is safe to call repeatedly alongside
 * `watchForContent`.
 */
export function initTabs(root: ParentNode = document): void {
  const groups = root.querySelectorAll<HTMLElement>(
    '[data-md-tabs]:not([data-md-tabs-ready])',
  )

  for (const group of groups) {
    const panels = tabPanels(group)
    if (!panels.length) continue

    const groupId = `md-tabs-${++tabSequence}`
    const strip = document.createElement('div')
    strip.className = 'md-tab-strip'
    strip.setAttribute('role', 'tablist')

    panels.forEach((panel, index) => {
      const title = panel.dataset.mdTabTitle ?? `Tab ${index + 1}`
      const panelId = `${groupId}-panel-${index}`
      const buttonId = `${groupId}-tab-${index}`

      panel.id = panelId
      panel.setAttribute('role', 'tabpanel')
      panel.setAttribute('aria-labelledby', buttonId)

      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'md-tab-button'
      button.id = buttonId
      button.textContent = title
      button.setAttribute('role', 'tab')
      button.setAttribute('aria-controls', panelId)
      strip.appendChild(button)
    })

    group.prepend(strip)
    group.dataset.mdTabsReady = 'true'
    selectTab(group, 0)
  }

  if (tabsDelegateInstalled) return
  tabsDelegateInstalled = true

  document.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof Element)) return
    const button = target.closest<HTMLButtonElement>('.md-tab-button')
    const group = button?.closest<HTMLElement>('[data-md-tabs]')
    if (!button || !group || button.getAttribute('aria-selected') === 'true') return
    trigger('selection')

    const buttons = Array.from(group.querySelectorAll('.md-tab-button'))
    selectTab(group, buttons.indexOf(button))
  })

  // Left/right to move between tabs, Home/End to jump to the ends, as the
  // WAI-ARIA tabs pattern expects.
  document.addEventListener('keydown', (event) => {
    const target = event.target
    if (!(target instanceof Element)) return
    const button = target.closest<HTMLButtonElement>('.md-tab-button')
    const group = button?.closest<HTMLElement>('[data-md-tabs]')
    if (!button || !group) return

    const buttons = Array.from(
      group.querySelectorAll<HTMLButtonElement>('.md-tab-button'),
    )
    const current = buttons.indexOf(button)
    const last = buttons.length - 1

    let next = current
    if (event.key === 'ArrowRight') next = current === last ? 0 : current + 1
    else if (event.key === 'ArrowLeft') next = current === 0 ? last : current - 1
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = last
    else return

    event.preventDefault()
    if (next !== current) trigger('selection')
    selectTab(group, next)
    buttons[next].focus()
  })
}

/**
 * Diagram labels use Excalifont, Excalidraw's handwriting face, to match the
 * rough.js strokes from pele-sketch.ts. Self-hosted from
 * public/fonts/excalifont (OFL), declared in markdown.css. Pele reads it from
 * --pele-font; the Mermaid fallback takes it from here.
 */
export const MERMAID_FONT = "'Excalifont', var(--font-sans, 'Lexend'), cursive"

// Mermaid fallback palettes. Pele takes the same colors from the --pele-*
// variables in markdown.css.
export const MERMAID_DARK: Record<string, unknown> = {
  darkMode: true,
  background: '#0d0e15',
  mainBkg: '#11131c',
  primaryColor: '#11131c',
  primaryTextColor: '#dce1ec',
  primaryBorderColor: '#8b93ab',
  nodeTextColor: '#dce1ec',
  lineColor: '#9aa2b8',
  secondaryColor: '#1a1d2a',
  tertiaryColor: '#151827',
  clusterBkg: '#0b0c12',
  clusterBorder: '#3a4058',
  edgeLabelBackground: '#11131c',
  noteBkgColor: '#1a1d2a',
  noteTextColor: '#dce1ec',
  noteBorderColor: '#2a2f42',
  defaultLinkColor: '#9aa2b8',
  fontFamily: MERMAID_FONT,
}

export const MERMAID_LIGHT: Record<string, unknown> = {
  darkMode: false,
  background: '#ffffff',
  mainBkg: '#f8fafc',
  primaryColor: '#f1f5f9',
  primaryTextColor: '#1e293b',
  primaryBorderColor: '#334155',
  nodeTextColor: '#1e293b',
  lineColor: '#334155',
  secondaryColor: '#e2e8f0',
  tertiaryColor: '#f8fafc',
  clusterBkg: '#f8fafc',
  clusterBorder: '#94a3b8',
  edgeLabelBackground: '#ffffff',
  noteBkgColor: '#fff7ed',
  noteTextColor: '#7c2d12',
  noteBorderColor: '#fed7aa',
  defaultLinkColor: '#334155',
  fontFamily: MERMAID_FONT,
}

const WARN_ICON =
  '<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>'

let diagramSequence = 0

export function isDarkTheme(): boolean {
  return document.documentElement.classList.contains('dark')
}

let colorProbe: CanvasRenderingContext2D | null | undefined

/**
 * Resolve any CSS color (color-mix, oklab, var-free) to `#rrggbb`. Mermaid
 * parses colors itself and only understands hex/rgb/hsl, so the skin tokens
 * have to be flattened first. Paints one pixel and reads it back.
 */
function toHex(value: string, backdrop: string): string | null {
  if (colorProbe === undefined) {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    colorProbe = canvas.getContext('2d', { willReadFrequently: true })
  }
  const ctx = colorProbe
  if (!ctx || !value) return null
  ctx.clearRect(0, 0, 1, 1)
  ctx.fillStyle = '#000'
  ctx.fillStyle = backdrop || '#000'
  ctx.fillRect(0, 0, 1, 1)
  const sentinel = '#010203'
  ctx.fillStyle = sentinel
  ctx.fillStyle = value
  if (ctx.fillStyle === sentinel && value.trim().toLowerCase() !== sentinel) return null
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`
}

/**
 * Build the Mermaid palette from the same --pele-* variables Pele uses, so the
 * fallback follows the active style and colour too. Falls back to the fixed
 * palettes when a color can't be resolved.
 */
function skinPalette(target: HTMLElement, dark: boolean): Record<string, unknown> {
  const base = dark ? MERMAID_DARK : MERMAID_LIGHT
  // A probe child resolves var()/currentColor in the diagram's own context.
  const probe = document.createElement('span')
  probe.style.display = 'none'
  target.appendChild(probe)
  const read = (prop: string): string | null => {
    probe.style.color = ''
    probe.style.color = `var(${prop})`
    return getComputedStyle(probe).color || null
  }
  const pageBg = getComputedStyle(document.body).backgroundColor
  const raw = {
    bg: read('--pele-bg'),
    fg: read('--pele-fg'),
    muted: read('--pele-muted'),
    line: read('--pele-line'),
    surface: read('--pele-surface'),
    surfaceAlt: read('--pele-surface-alt'),
    border: read('--pele-border'),
  }
  probe.remove()

  const bg = raw.bg ? toHex(raw.bg, pageBg) : null
  const hex = (v: string | null) => (v ? toHex(v, bg ?? pageBg) : null)
  const fg = hex(raw.fg)
  const line = hex(raw.line)
  const surface = hex(raw.surface)
  const surfaceAlt = hex(raw.surfaceAlt)
  const border = hex(raw.border)
  const muted = hex(raw.muted)
  if (!bg || !fg || !line || !surface || !border) return base

  return {
    ...base,
    background: bg,
    mainBkg: surface,
    primaryColor: surface,
    primaryTextColor: fg,
    primaryBorderColor: border,
    nodeTextColor: fg,
    lineColor: line,
    secondaryColor: surfaceAlt ?? surface,
    tertiaryColor: surface,
    clusterBkg: bg,
    clusterBorder: muted ?? border,
    edgeLabelBackground: bg,
    noteBkgColor: surfaceAlt ?? surface,
    noteTextColor: fg,
    noteBorderColor: border,
    defaultLinkColor: line,
    actorBkg: surface,
    actorBorder: border,
    actorTextColor: fg,
    actorLineColor: line,
    signalColor: line,
    signalTextColor: fg,
    labelBoxBkgColor: surface,
    labelBoxBorderColor: border,
    labelTextColor: fg,
    loopTextColor: fg,
    sequenceNumberColor: bg,
  }
}

/**
 * Normalize the rendered SVG so CSS can scale it with max-width.
 *
 * Mermaid often sets width="100%" when useMaxWidth is on, which fights the
 * column layout. Prefer the viewBox intrinsic size as attributes, then let
 * `.md-mermaid-render > svg { max-width: 100%; height: auto }` fit the phone.
 */
function normalizeDiagramSvg(target: HTMLElement): void {
  const svg = target.querySelector('svg')
  if (!svg) return

  const vb = svg.viewBox?.baseVal
  const vbWidth = vb?.width
  const vbHeight = vb?.height
  if (vbWidth && vbHeight) {
    svg.setAttribute('width', String(Math.round(vbWidth)))
    svg.setAttribute('height', String(Math.round(vbHeight)))
    target.style.setProperty('--md-diagram-width', `${Math.round(vbWidth)}px`)
  }

  svg.removeAttribute('style')
  svg.style.maxWidth = '100%'
  svg.style.height = 'auto'
}

type Pele = typeof import('pele/lazy')

let peleLoad: Promise<Pele> | null = null

function loadPele(): Promise<Pele> {
  peleLoad ??= import('pele/lazy')
  return peleLoad
}

/** Live Pele mounts, so a redraw tears down the old resize observer first. */
const mounts = new WeakMap<Element, Mounted>()

/**
 * Draw `source` into `target` with Pele, then sketch it. Returns null on
 * success or the reason Pele couldn't draw it.
 */
async function renderWithPele(target: HTMLElement, source: string): Promise<string | null> {
  let pele: Pele
  try {
    pele = await loadPele()
  } catch (err) {
    return err instanceof Error ? err.message : String(err)
  }
  let type: ReturnType<Pele['detectType']>
  try {
    type = pele.detectType(source)
  } catch (err) {
    return err instanceof Error ? err.message : String(err)
  }
  if (!type) return 'No diagram type detected'
  if (!(await pele.load(type).catch(() => false))) return `Pele could not load the ${type} renderer`

  mounts.get(target)?.destroy()
  mounts.delete(target)
  target.replaceChildren()
  try {
    const mounted = await pele.mountAsync(target, source, {
      links: false,
      images: false,
      zoom: false,
      // Keep the author's direction. A wide diagram scales down to fit
      // instead of turning vertical (same choice as T3 Code).
      autoDirection: false,
      // Pele redraws when the column width changes, so sketch every render.
      onRender: () => {
        const svg = target.querySelector('svg')
        if (!svg) return
        try {
          sketchPeleSvg(svg, source)
        } catch (err) {
          // Clean Pele strokes are still a readable diagram.
          console.warn('Pele sketch skipped:', err)
        }
      },
    })
    if (mounted.error || !target.querySelector('svg')) {
      mounted.destroy()
      const err = mounted.error
      return err instanceof Error ? err.message : err ? String(err) : 'Pele produced no SVG'
    }
    mounts.set(target, mounted)
    return null
  } catch (err) {
    return err instanceof Error ? err.message : String(err)
  }
}

function showSource(target: HTMLElement, source: string): void {
  target.innerHTML = `<div class="md-mermaid-fallback">${WARN_ICON}<span>Diagram preview unavailable — showing source</span></div><pre class="md-code-pre"><code></code></pre>`
  const code = target.querySelector('code')
  if (code) code.textContent = source
}

/**
 * Render every `.md-mermaid` block under `root`.
 *
 * Blocks are marked once drawn so this is safe to call repeatedly — the blog
 * watches for content appearing inside a React island and would otherwise
 * redraw every diagram on each mutation. Pass `force` when the theme flips.
 * Pele's colors are CSS variables, so a theme flip only matters for the
 * Mermaid fallback, which bakes its palette into the SVG.
 */
export async function renderMermaidBlocks(
  loadMermaid: () => Promise<MermaidLike>,
  options: { dark?: boolean; root?: ParentNode; force?: boolean } = {},
): Promise<void> {
  const root = options.root ?? document
  const selector = options.force
    ? '.md-mermaid:not([data-md-renderer="pele"])'
    : '.md-mermaid:not([data-md-diagram])'
  const blocks = root.querySelectorAll<HTMLElement>(selector)
  if (!blocks.length) return

  const dark = options.dark ?? isDarkTheme()

  // Excalifont only appears inside diagrams, so nothing on the page has
  // requested it yet. Load it before Pele measures labels, or every box is
  // sized for the fallback font.
  try {
    await document.fonts?.load("16px 'Excalifont'")
  } catch {}

  for (const block of blocks) {
    const source = block
      .querySelector('.md-mermaid-source')
      ?.textContent?.trim()
    const target = block.querySelector<HTMLElement>('.md-mermaid-render')
    if (!source || !target) continue
    block.dataset.mdDiagram = 'done'

    const problem = await renderWithPele(target, source)
    if (!problem) {
      block.dataset.mdRenderer = 'pele'
      continue
    }

    // Fallback: Mermaid.js, loaded only when a diagram needs it.
    block.dataset.mdRenderer = 'mermaid'
    const id = `md-mermaid-${++diagramSequence}`
    try {
      const mermaid = await loadMermaid()
      mermaid.initialize({
        startOnLoad: false,
        theme: 'base',
        themeVariables: skinPalette(target, dark),
        fontFamily: MERMAID_FONT,
        // Classic look: Mermaid's handDrawn mode kinks every edge.
        look: 'classic',
        sequence: { useMaxWidth: false, diagramMarginX: 16, diagramMarginY: 16 },
        flowchart: { useMaxWidth: false, curve: 'basis' },
        er: { useMaxWidth: false, diagramPadding: 20 },
      })
      const { svg } = await mermaid.render(id, source)
      target.innerHTML = svg
      normalizeDiagramSvg(target)
    } catch {
      // mermaid leaves orphaned nodes behind when a parse fails.
      document.getElementById(id)?.remove()
      document.getElementById(`d${id}`)?.remove()
      showSource(target, source)
    }
  }
}

/**
 * Run `draw` once now, then again whenever new content appears.
 *
 * The blog renders posts inside a `client:only` React island, so the markup
 * does not exist yet when this module first runs and neither `DOMContentLoaded`
 * nor a one-shot call would find anything. Watching the document covers that
 * without the caller having to know how the page is hydrated.
 */
export function watchForContent(draw: () => void): () => void {
  draw()

  let queued = false
  const observer = new MutationObserver(() => {
    if (queued) return
    queued = true
    // Coalesce the burst of mutations a framework emits while mounting.
    window.requestAnimationFrame(() => {
      queued = false
      draw()
    })
  })

  observer.observe(document.body, { childList: true, subtree: true })
  return () => observer.disconnect()
}

/**
 * Call `onChange` when light/dark, the style or the colour combo changes, so
 * Mermaid fallback diagrams (which bake colors into the SVG) can be redrawn.
 */
export function watchThemeChanges(onChange: (dark: boolean) => void): () => void {
  const root = document.documentElement
  const key = () => `${isDarkTheme()}|${root.dataset.skin ?? ''}|${root.dataset.color ?? ''}`
  let last = key()
  const observer = new MutationObserver(() => {
    const next = key()
    if (next === last) return
    last = next
    onChange(isDarkTheme())
  })
  observer.observe(root, {
    attributes: true,
    attributeFilter: ['class', 'data-skin', 'data-color'],
  })
  return () => observer.disconnect()
}

/**
 * Upgrade YouTube video links from their id to the video's title.
 *
 * A `yt:ID`, `youtu.be/ID` or `youtube.com/watch?v=ID` link renders with the
 * id as its label; this swaps that text for the title from YouTube's oEmbed
 * endpoint, which needs no API key. The brand icon and href are left alone, and
 * a failed fetch (offline, blocked) keeps the id as the fallback.
 */
export async function initYtTitles(root: ParentNode = document): Promise<void> {
  const links = [
    ...root.querySelectorAll<HTMLAnchorElement>('a[data-md-yt]'),
  ]
  if (!links.length) return

  const titles = new Map<string, string>()
  await Promise.all(
    [...new Set(links.map((link) => link.dataset.mdYt || '').filter(Boolean))].map(
      async (id) => {
        try {
          const res = await fetch(
            `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`,
          )
          if (!res.ok) return
          const data = await res.json()
          if (typeof data.title === 'string' && data.title.trim()) {
            titles.set(id, data.title.trim())
          }
        } catch {
          // Offline or blocked — keep the id label.
        }
      },
    ),
  )

  for (const link of links) {
    const title = titles.get(link.dataset.mdYt || '')
    if (!title) continue
    const text = [...link.childNodes].find(
      (node) => node.nodeType === Node.TEXT_NODE,
    )
    if (text) text.textContent = title
  }
}
