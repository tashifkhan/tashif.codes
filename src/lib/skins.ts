/**
 * The site's looks, as two choices: a style and a colour combo.
 *
 * A style is a design language: its type, corners, borders and shadows. A
 * colour combo is a palette inside that style. The first combo of each style
 * is its default and sets no attribute; the others set `data-color` on <html>.
 *
 * Classic and studio ship in the main stylesheet. The rest live in
 * src/styles/skins/<id>.css and load on demand (see Layout.astro).
 *
 * `paper` and `accent` here only paint the picker's previews. The real
 * palettes are in the stylesheets.
 */
export interface SkinColor {
	id: string;
	name: string;
	paper: string;
	accent: string;
}

export interface SkinStyle {
	id: "simple" | "studio" | "dump" | "sleeck" | "material";
	name: string;
	/** How the picker draws this style's sample card. */
	radius: number;
	edge: "hair" | "ink" | "none";
	stamp: boolean;
	colors: SkinColor[];
}

export const SKIN_STYLES: SkinStyle[] = [
	{
		id: "studio",
		name: "Studio",
		radius: 7,
		edge: "hair",
		stamp: false,
		colors: [
			{ id: "teal", name: "Teal", paper: "#f6f1e9", accent: "#0f7a6c" },
			{ id: "amber", name: "Amber", paper: "#f6f1e9", accent: "#b45309" },
			{ id: "indigo", name: "Indigo", paper: "#f6f1e9", accent: "#4338ca" },
			{ id: "rose", name: "Rose", paper: "#f6f1e9", accent: "#be123c" },
		],
	},
	{
		id: "simple",
		name: "Classic",
		radius: 5,
		edge: "hair",
		stamp: false,
		colors: [
			{ id: "orange", name: "Orange", paper: "#eceff1", accent: "#e8590c" },
			{ id: "blue", name: "Blue", paper: "#eceff1", accent: "#2563eb" },
			{ id: "violet", name: "Violet", paper: "#eceff1", accent: "#7c3aed" },
			{ id: "rose", name: "Rose", paper: "#eceff1", accent: "#e11d48" },
		],
	},
	{
		id: "dump",
		name: "Dump",
		radius: 3,
		edge: "ink",
		stamp: true,
		colors: [
			{ id: "pink", name: "Pink", paper: "#f6f3ea", accent: "#ff5d8f" },
			{ id: "blue", name: "Blue pen", paper: "#f6f3ea", accent: "#1d4ed8" },
			{ id: "moss", name: "Moss", paper: "#f6f3ea", accent: "#1f7a4c" },
			{ id: "rust", name: "Rust", paper: "#f6f3ea", accent: "#c2410c" },
		],
	},
	{
		id: "sleeck",
		name: "Sleeck",
		radius: 2,
		edge: "ink",
		stamp: true,
		colors: [
			{ id: "lavender", name: "Lavender and lime", paper: "#e0d6ff", accent: "#c4f042" },
			{ id: "sand", name: "Sand and tangerine", paper: "#efe6d5", accent: "#ff6a1f" },
			{ id: "fog", name: "Fog and coral", paper: "#e2e6ea", accent: "#ff4f6d" },
			{ id: "sage", name: "Sage and lemon", paper: "#dfe6d6", accent: "#f2d93b" },
		],
	},
	{
		id: "material",
		name: "Material",
		radius: 12,
		edge: "none",
		stamp: false,
		colors: [
			{ id: "purple", name: "Purple", paper: "#fdf7ff", accent: "#65558f" },
			{ id: "blue", name: "Blue", paper: "#faf8ff", accent: "#495d92" },
			{ id: "teal", name: "Teal", paper: "#f4fbfa", accent: "#006a6a" },
			{ id: "green", name: "Green", paper: "#f8faf0", accent: "#446732" },
			{ id: "amber", name: "Amber", paper: "#fff8f5", accent: "#865319" },
			{ id: "red", name: "Red", paper: "#fff8f7", accent: "#904a42" },
			{ id: "rose", name: "Rose", paper: "#fff8f8", accent: "#8c4a60" },
		],
	},
];

export type SkinId = SkinStyle["id"];

export const DEFAULT_SKIN: SkinId = "studio";
export const SKIN_KEY = "tashif-skin";
/** One saved colour combo per style, as JSON: { studio: "amber", ... }. */
export const SKIN_COLORS_KEY = "tashif-skin-colors";

/** Style id to its non-default colour ids, for the head script. */
export const SKIN_COLOR_IDS: Record<string, string[]> = Object.fromEntries(
	SKIN_STYLES.map((style) => [style.id, style.colors.slice(1).map((c) => c.id)]),
);
