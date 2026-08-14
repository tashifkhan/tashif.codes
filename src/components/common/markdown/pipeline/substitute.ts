/**
 * Swap `<astro-md-block>` placeholders for rendered Astro components.
 *
 * markdown-it's renderer rules are synchronous and emit strings, but an Astro
 * component is an async function returning a component instance. Bridging the
 * two directly is not possible, so the parse emits a placeholder per component
 * occurrence and this pass fills them in afterwards, once, on the finished
 * HTML.
 *
 * Order matters: a component's slot content is the HTML *inside* its
 * placeholder, so children must already be real markup when their parent is
 * rendered. The scan therefore resolves innermost-first.
 *
 * Cost: one container render per component occurrence. Documents with no
 * components — every project README, and all but one of the generated doc
 * pages — return on the first line without constructing a container at all.
 */

import { experimental_AstroContainer as AstroContainer } from "astro/container";

import { BLOCKS, extraPropsFor } from "../blocks/index";
import type { RenderCtx } from "./registry";

export type BlockRecord = { name: string; ctx: RenderCtx };

const OPEN = /<astro-md-block data-i="(\d+)">/;

/**
 * One container for the whole process.
 *
 * Creating it is the expensive part, and it holds no per-document state, so a
 * single lazily-created instance serves every page in a build.
 */
let containerPromise: Promise<AstroContainer> | null = null;
function getContainer(): Promise<AstroContainer> {
	containerPromise ??= AstroContainer.create();
	return containerPromise;
}

/**
 * Find the innermost placeholder: the last `<astro-md-block …>` that is
 * followed by its own closing tag before any further opening tag.
 *
 * Returns the span of the whole element plus its inner HTML.
 */
function findInnermost(
	html: string,
): { start: number; end: number; index: number; inner: string } | null {
	const CLOSE = "</astro-md-block>";
	let searchFrom = 0;
	let best: { start: number; end: number; index: number; inner: string } | null =
		null;

	while (true) {
		const rest = html.slice(searchFrom);
		const m = rest.match(OPEN);
		if (!m || m.index === undefined) break;

		const start = searchFrom + m.index;
		const contentStart = start + m[0].length;
		const nextOpen = html.slice(contentStart).search(OPEN);
		const nextClose = html.indexOf(CLOSE, contentStart);

		if (nextClose === -1) {
			// Unbalanced: no close for this open. Give up on it rather than loop.
			searchFrom = contentStart;
			continue;
		}

		// Innermost when the next thing is our own close, not another open.
		if (nextOpen === -1 || contentStart + nextOpen > nextClose) {
			best = {
				start,
				end: nextClose + CLOSE.length,
				index: Number(m[1]),
				inner: html.slice(contentStart, nextClose),
			};
			break;
		}
		searchFrom = contentStart + nextOpen;
	}

	return best;
}

export async function substituteBlocks(
	html: string,
	blocks: readonly BlockRecord[],
): Promise<string> {
	if (!blocks.length || !html.includes("<astro-md-block")) return html;

	const container = await getContainer();
	let out = html;

	// Bounded so a malformed document cannot spin here forever.
	for (let guard = 0; guard <= blocks.length && out.includes("<astro-md-block"); guard++) {
		const found = findInnermost(out);
		if (!found) break;

		const record = blocks[found.index];
		const Component = record && BLOCKS[record.name];

		let rendered: string;
		if (!Component) {
			// Unknown component: keep the body rather than dropping the author's
			// text on the floor. validate.ts blocks this at publish time, and
			// blog/[slug].astro warns when a post outruns this renderer.
			rendered = found.inner;
		} else {
			rendered = await container.renderToString(Component, {
				props: {
					attrs: record.ctx.attrs,
					theme: record.ctx.theme,
					headings: record.ctx.headings,
					inline: record.ctx.inline,
					...extraPropsFor(record.name),
				},
				slots: { default: found.inner },
			});
			// The container emits a doctype for page-level components; strip any
			// stray one so it cannot land mid-document.
			rendered = rendered.replace(/^<!DOCTYPE html>/i, "");
		}

		out = out.slice(0, found.start) + rendered + out.slice(found.end);
	}

	return stripStrays(out);
}

/**
 * Drop any placeholder the loop could not pair up.
 *
 * A component tag with no closing tag leaves an unmatched open. That happens
 * with prose that merely looks like a tag — the generated docs contain a JSON
 * example whose error string embeds a literal `<details>` — and the parser
 * claims it before anything knows it was meant as text.
 *
 * The old string renderer emitted that component's opening chrome with no
 * close, so the rest of the document got swallowed into it. Removing the
 * placeholder instead is strictly better: the stray tag text is still lost,
 * but the surrounding document survives intact.
 */
function stripStrays(html: string): string {
	if (!html.includes("astro-md-block")) return html;
	return html
		.replace(/<astro-md-block data-i="\d+">/g, "")
		.replace(/<\/astro-md-block>/g, "");
}
