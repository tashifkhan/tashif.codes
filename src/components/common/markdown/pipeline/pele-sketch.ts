/**
 * Excalidraw finish for Pele diagrams.
 *
 * Pele (see client.ts) lays the diagram out and draws clean SVG:
 * measured labels, smooth routed edges, filled arrowheads. This pass keeps
 * that layout and redraws the strokes the way Excalidraw draws them, with
 * rough.js:
 *
 * - box, diamond, cylinder, cluster, note and actor outlines get a
 *   hand-drawn double stroke (Excalidraw's "artist" roughness)
 * - edges get a lighter wobble that keeps their curve
 * - filled triangle arrowheads become Excalidraw's open two-stroke heads.
 *
 * Fills, labels and positions are untouched, so nothing moves or clips.
 * Strokes keep Pele's `var(--_*)` colors, so a theme switch recolors them
 * without a redraw. Seeds come from the diagram source, so a diagram looks
 * the same on every load. Charts (pie, xychart, quadrant, timeline...) keep
 * exact geometry.
 */
import rough from 'roughjs'

const SVG_NS = 'http://www.w3.org/2000/svg'
const gen = rough.generator()

/** Diagram types that get the sketch, by Pele's root class `pele-<type>`. */
const SKETCHED = /^pele-(flowchart|sequence|state|er|class|requirement|block|mindmap|architecture|c4|kanban)$/

/** Groups whose shapes are outlines worth sketching. */
const SHAPE_SCOPE = '.pele-nodes, .pele-clusters, .pele-notes, .pele-frames'

/** Excalidraw's stroke character, tuned down a little for small boxes. */
const SHAPE = { roughness: 1, bowing: 1, strokeWidth: 1.5 }
const EDGE = { roughness: 0.7, bowing: 0.5, strokeWidth: 1.4 }

function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * The stroke an element is drawn with, as written (so `var(--_b)` stays a
 * variable), walking up to the group that sets it. Null when unstroked.
 */
function strokeOf(el: Element, svg: SVGSVGElement): string | null {
  for (let node: Element | null = el; node && node !== svg; node = node.parentElement) {
    const inline = (node as SVGElement).style?.getPropertyValue('stroke')
    const value = inline || node.getAttribute('stroke')
    if (value) return value === 'none' || value === 'transparent' ? null : value
  }
  return null
}

function dashOf(el: Element, svg: SVGSVGElement): number[] | undefined {
  for (let node: Element | null = el; node && node !== svg; node = node.parentElement) {
    const value = (node as SVGElement).style?.getPropertyValue('stroke-dasharray') || node.getAttribute('stroke-dasharray')
    if (value && value !== 'none') {
      const parts = value.split(/[\s,]+/).map(parseFloat).filter((n) => n > 0)
      return parts.length ? parts : undefined
    }
  }
  return undefined
}

function roundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
  const rx = Math.min(r, w / 2, h / 2)
  return [
    `M${x + rx},${y}`,
    `H${x + w - rx}`,
    `Q${x + w},${y} ${x + w},${y + rx}`,
    `V${y + h - rx}`,
    `Q${x + w},${y + h} ${x + w - rx},${y + h}`,
    `H${x + rx}`,
    `Q${x},${y + h} ${x},${y + h - rx}`,
    `V${y + rx}`,
    `Q${x},${y} ${x + rx},${y}`,
    'Z',
  ].join(' ')
}

type Drawable = ReturnType<typeof gen.path>

function shapeDrawable(el: SVGElement, view: Window, options: object): Drawable | null {
  const tag = el.tagName.toLowerCase()
  if (tag === 'rect') {
    const r = el as SVGRectElement
    const w = r.width.baseVal.value
    const h = r.height.baseVal.value
    if (w < 6 || h < 6) return null
    const x = r.x.baseVal.value
    const y = r.y.baseVal.value
    const rx = parseFloat(view.getComputedStyle(el).getPropertyValue('rx')) || parseFloat(el.getAttribute('rx') ?? '') || 0
    return rx > 0.5 ? gen.path(roundedRectPath(x, y, w, h, rx), options) : gen.rectangle(x, y, w, h, options)
  }
  if (tag === 'polygon') {
    const list = (el as SVGPolygonElement).points
    if (!list || list.numberOfItems < 3) return null
    const points: [number, number][] = []
    for (let i = 0; i < list.numberOfItems; i++) points.push([list.getItem(i).x, list.getItem(i).y])
    return gen.polygon(points, options)
  }
  if (tag === 'circle') {
    const c = el as SVGCircleElement
    const r = c.r.baseVal.value
    if (r < 6) return null
    return gen.circle(c.cx.baseVal.value, c.cy.baseVal.value, r * 2, options)
  }
  if (tag === 'ellipse') {
    const e = el as SVGEllipseElement
    if (e.rx.baseVal.value < 6 || e.ry.baseVal.value < 6) return null
    return gen.ellipse(e.cx.baseVal.value, e.cy.baseVal.value, e.rx.baseVal.value * 2, e.ry.baseVal.value * 2, options)
  }
  if (tag === 'path' || tag === 'line') {
    const d = tag === 'line'
      ? `M${el.getAttribute('x1')},${el.getAttribute('y1')}L${el.getAttribute('x2')},${el.getAttribute('y2')}`
      : el.getAttribute('d')
    if (!d || d.length < 6) return null
    return gen.path(d, options)
  }
  return null
}

/** Append rough.js output after `anchor`, stroked as the original was. */
function place(anchor: Element, drawable: Drawable, stroke: string, width: number, dash?: number[]): void {
  const doc = anchor.ownerDocument
  const group = doc.createElementNS(SVG_NS, 'g')
  group.setAttribute('class', 'pele-sketch')
  group.setAttribute('aria-hidden', 'true')
  group.setAttribute('fill', 'none')
  const transform = anchor.getAttribute('transform')
  if (transform) group.setAttribute('transform', transform)
  for (const info of gen.toPaths(drawable)) {
    const path = doc.createElementNS(SVG_NS, 'path')
    path.setAttribute('d', info.d)
    path.setAttribute('stroke', stroke)
    path.setAttribute('stroke-width', String(width))
    path.setAttribute('stroke-linecap', 'round')
    path.setAttribute('stroke-linejoin', 'round')
    if (dash) path.setAttribute('stroke-dasharray', dash.join(' '))
    group.appendChild(path)
  }
  if (group.childNodes.length) anchor.after(group)
}

function hideStroke(el: SVGElement): void {
  el.setAttribute('stroke', 'none')
  el.style.setProperty('stroke', 'none', 'important')
}

const TRIANGLE = /^M\s*([-\d.e]+)[ ,]([-\d.e]+)\s*L\s*([-\d.e]+)[ ,]([-\d.e]+)\s*L\s*([-\d.e]+)[ ,]([-\d.e]+)\s*Z$/i

/**
 * Redraw the strokes of a Pele SVG in Excalidraw style. Idempotent: an SVG
 * that was already sketched is left alone.
 */
export function sketchPeleSvg(svg: SVGSVGElement, source: string): void {
  if (svg.dataset.sketched) return
  if (![...svg.classList].some((c) => SKETCHED.test(c))) return
  svg.dataset.sketched = '1'
  const view = svg.ownerDocument.defaultView ?? window
  let seed = hash(source) % 2147480000
  const next = () => (seed = (seed + 7919) % 2147483646) + 1

  // Outlines.
  for (const el of svg.querySelectorAll<SVGElement>(
    `:is(${SHAPE_SCOPE}) :is(rect, polygon, circle, ellipse, path, line)`,
  )) {
    if (el.closest('.pele-sketch, .pele-er-stripes, .pele-edge-label, text')) continue
    const stroke = strokeOf(el, svg)
    if (!stroke) continue
    const width = Math.max(SHAPE.strokeWidth, parseFloat(view.getComputedStyle(el).strokeWidth) || 0)
    const dash = dashOf(el, svg)
    const drawable = shapeDrawable(el, view, {
      ...SHAPE,
      strokeWidth: width,
      seed: next(),
      preserveVertices: true,
      ...(dash ? { disableMultiStroke: true } : {}),
    })
    if (!drawable) continue
    place(el, drawable, stroke, width, dash)
    hideStroke(el)
  }

  // Edges and sequence lifelines: a lighter hand that keeps the curve.
  for (const el of svg.querySelectorAll<SVGElement>('.pele-edge > path:not(.pele-marker), .pele-lifeline')) {
    const stroke = strokeOf(el, svg)
    const d = el.getAttribute('d')
    if (!stroke || !d) continue
    const width = Math.max(EDGE.strokeWidth, parseFloat(view.getComputedStyle(el).strokeWidth) || 0)
    const dash = dashOf(el, svg)
    const drawable = gen.path(d, { ...EDGE, strokeWidth: width, seed: next(), preserveVertices: true, ...(dash ? { disableMultiStroke: true } : {}) })
    place(el, drawable, stroke, width, dash)
    hideStroke(el)
  }

  // Filled triangle heads become Excalidraw's open arrowhead.
  for (const el of svg.querySelectorAll<SVGPathElement>('.pele-edge path.pele-marker')) {
    const m = TRIANGLE.exec((el.getAttribute('d') ?? '').trim())
    if (!m) continue
    const [tx, ty, ax, ay, bx, by] = m.slice(1).map(Number)
    // Pele's heads are short and wide; Excalidraw's are longer barbs.
    const barb = (x: number, y: number): [number, number] => [tx + (x - tx) * 1.35, ty + (y - ty) * 1.35]
    const [x1, y1] = barb(ax, ay)
    const [x2, y2] = barb(bx, by)
    const stroke = el.getAttribute('fill') && el.getAttribute('fill') !== 'none' ? el.getAttribute('fill')! : strokeOf(el, svg) ?? 'currentColor'
    const drawable = gen.path(`M${x1},${y1} L${tx},${ty} L${x2},${y2}`, { roughness: 0.6, bowing: 0.3, strokeWidth: EDGE.strokeWidth, seed: next(), preserveVertices: true })
    place(el, drawable, stroke, EDGE.strokeWidth)
    el.setAttribute('display', 'none')
  }
}
