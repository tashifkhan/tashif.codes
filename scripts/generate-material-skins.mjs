// Builds the Material skin's colour combos from seed colours, the way
// dump-lab does at runtime. Run `bun scripts/generate-material-skins.mjs`
// after changing SEEDS; it rewrites the generated block in
// src/styles/skins/material.css.
import { readFileSync, writeFileSync } from "node:fs";
import {
	argbFromHex,
	hexFromArgb,
	Hct,
	SchemeTonalSpot,
	MaterialDynamicColors,
} from "@material/material-color-utilities";

// The first seed is the default and needs no data-color attribute.
export const SEEDS = [
	{ id: "purple", hex: "#6750a4" },
	{ id: "blue", hex: "#0b57d0" },
	{ id: "teal", hex: "#006a6a" },
	{ id: "green", hex: "#386a20" },
	{ id: "amber", hex: "#8b5000" },
	{ id: "red", hex: "#b3261e" },
	{ id: "rose", hex: "#984061" },
];

const ROLES = [
	"primary",
	"onPrimary",
	"primaryContainer",
	"onPrimaryContainer",
	"secondaryContainer",
	"onSecondaryContainer",
	"error",
	"onError",
	"surface",
	"surfaceContainerLow",
	"surfaceContainer",
	"surfaceContainerHigh",
	"surfaceContainerHighest",
	"onSurface",
	"onSurfaceVariant",
	"outlineVariant",
];
const kebab = (role) => role.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

function block(seed, dark) {
	const scheme = new SchemeTonalSpot(Hct.fromInt(argbFromHex(seed)), dark, 0);
	return ROLES.map(
		(role) => `\t--md-${kebab(role)}: ${hexFromArgb(MaterialDynamicColors[role].getArgb(scheme))};`,
	).join("\n");
}

const css = SEEDS.map(({ id, hex }, i) => {
	const pick = i === 0 ? "" : `[data-color="${id}"]`;
	return `/* ${id}, seed ${hex} */\nhtml[data-skin="material"]${pick} {\n${block(hex, false)}\n}\nhtml[data-skin="material"]${pick}.dark {\n${block(hex, true)}\n}`;
}).join("\n");

const file = new URL("../src/styles/skins/material.css", import.meta.url);
const START = "/* generated:start */";
const END = "/* generated:end */";
const source = readFileSync(file, "utf8");
const a = source.indexOf(START);
const b = source.indexOf(END);
if (a === -1 || b === -1) throw new Error("material.css is missing its generated markers");
writeFileSync(file, `${source.slice(0, a)}${START}\n${css}\n${source.slice(b)}`);
console.log(`wrote ${SEEDS.length} palettes`);
