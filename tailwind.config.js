/** @type {import('tailwindcss').Config} */
export default {
	content: [
		"./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}",
		"./src/components/ui/**/*.{ts,tsx,js,jsx,astro}",
	],
	safelist: [
		// Dynamic color utilities generated in Resume component (include gradient via-)
		{
			pattern:
				/(bg|text|border|from|to|via)-(orange|blue|green|purple|yellow|red|indigo|emerald|gray)-(50|100|200|300|400|500|600|700|800|900)/,
		},
		{
			pattern:
				/dark:(bg|text|border|from|to|via)-(orange|blue|green|purple|yellow|red|indigo|emerald|gray)-(50|100|200|300|400|500|600|700|800|900)/,
		},
		// Gradient helper width/position classes for streak line
		"w-[3px]",
		"w-10",
		"left-0",
		"top-2",
		"bottom-2",
		"top-4",
		"bottom-4",
		"-translate-x-1",
	],
	darkMode: "class",
	theme: {
		extend: {
			fontFamily: {
				sans: ["Lexend", "sans-serif"],
				mono: ["JetBrains Mono", "monospace"],
			},
		},
	},
	plugins: [
		require("@tailwindcss/typography"),
		// optional utility used by some shadcn components
		// install with: npm install tailwindcss-animate
		(function () {
			try {
				return require("tailwindcss-animate");
			} catch (e) {
				return () => {};
			}
		})(),
	],
};
