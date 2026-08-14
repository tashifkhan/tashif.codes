/**
 * Directive name → Astro component.
 *
 * The renderer no longer knows what a Panel looks like. It emits a placeholder
 * carrying the component name and its resolved attributes, and the
 * substitution pass in `../pipeline/substitute.ts` looks the name up here and
 * renders the real component.
 *
 * Adding a component means adding an entry to `pipeline/registry.ts` (which
 * owns parsing, attributes and validation) and a file here (which owns how it
 * looks). Nothing else has to learn about it.
 */

import Ascii from "./Ascii.astro";
import Bar from "./Bar.astro";
import Bars from "./Bars.astro";
import Callout from "./Callout.astro";
import Checklist from "./Checklist.astro";
import Col from "./Col.astro";
import Cols from "./Cols.astro";
import Details from "./Details.astro";
import Embed from "./Embed.astro";
import Figure from "./Figure.astro";
import Hand from "./Hand.astro";
import Icon from "./Icon.astro";
import InkBand from "./InkBand.astro";
import Kpi from "./Kpi.astro";
import Lede from "./Lede.astro";
import Legend from "./Legend.astro";
import Mark from "./Mark.astro";
import Meter from "./Meter.astro";
import Meters from "./Meters.astro";
import Panel from "./Panel.astro";
import Phase from "./Phase.astro";
import Phases from "./Phases.astro";
import Stat from "./Stat.astro";
import Step from "./Step.astro";
import Steps from "./Steps.astro";
import Sticker from "./Sticker.astro";
import Strips from "./Strips.astro";
import Tab from "./Tab.astro";
import Tabs from "./Tabs.astro";
import Tape from "./Tape.astro";
import Toc from "./Toc.astro";

import { CALLOUT_NAMES } from "../pipeline/registry";

/** Keyed by the registry's PascalCase `name`. */
export const BLOCKS: Record<string, any> = {
	Cols,
	Col,
	Panel,
	Icon,
	InkBand,
	Strips,
	Toc,
	Steps,
	Step,
	Phases,
	Phase,
	Checklist,
	Lede,
	Meters,
	Meter,
	Kpi,
	Stat,
	Bars,
	Bar,
	Legend,
	Sticker,
	Hand,
	Tape,
	Mark,
	Figure,
	Ascii,
	Embed,
	Tabs,
	Tab,
	Details,
};

// The six callouts share one component; only the modifier differs, so they are
// registered from the same list the registry builds their specs from.
for (const name of CALLOUT_NAMES) {
	BLOCKS[name[0].toUpperCase() + name.slice(1)] = Callout;
}

/** Extra props a component needs beyond `attrs`/`theme`/`headings`/`inline`. */
export function extraPropsFor(name: string): Record<string, unknown> {
	const lower = name.toLowerCase();
	return (CALLOUT_NAMES as readonly string[]).includes(lower)
		? { name: lower }
		: {};
}
