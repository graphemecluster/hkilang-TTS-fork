import daisyui from "daisyui";

import type { Config as DaisyUIConfig } from "daisyui";
import type { Config } from "tailwindcss";

export default {
	important: true,
	content: ["./index.html", "./src/**/*"],
	theme: {
		extend: {
			fontFamily: {
				serif: [
					// "Chiron Sung HK",
					"Chiron Sung HK WS",
					"Times New Roman",
					"Times",
					"Georgia",
					"Cambria",
					"Noto Serif",
					"MingLiU_HKSCS",
					"MingLiU_HKSCS-ExtB",
					"MingLiU",
					"MingLiU-ExtB",
					"PMingLiU",
					"PMingLiU-ExtB",
					"Noto Serif HK",
					"Noto Serif CJK HK",
					"serif",
					"Apple Color Emoji",
					"Segoe UI Emoji",
					"Segoe UI Symbol",
					"Noto Color Emoji",
				],
			},
			screens: {
				xs: "440px",
				sm: "540px",
				md: "640px",
			},
			fontSize: {
				"1.5xl": ["1.375rem", "1.875rem"],
				"2.5xl": ["1.6875rem", "2.125rem"],
				"3.5xl": ["2rem", "2.375rem"],
				"4.5xl": ["2.5rem", "2.75rem"],
			},
			spacing: {
				"4.5": "1.125rem",
				"5.5": "1.375rem",
				"6.5": "1.625rem",
				"7.5": "1.875rem",
				"13": "3.25rem",
				"15": "3.75rem",
			},
		},
	},
	plugins: [daisyui],
	daisyui: {
		themes: [
			{
				light: {
					"primary": "#139ee6",
					"primary-content": "#fefefe",
					"secondary": "#0fccab",
					"secondary-content": "#fefefe",
					"accent": "#1da0bf",
					"accent-content": "#fefefe",
					"neutral": "#262c3d",
					"neutral-content": "#fefefe",
					"base-100": "#fefefe",
					"base-200": "#f1ede3",
					"base-300": "#dcd1b9",
					"base-content": "#262c3d",
					"info": "#3974f0",
					"success": "#16a34a",
					"warning": "#f0c373",
					"error": "#da3b43",
				},
			},
		],
	} satisfies DaisyUIConfig,
} satisfies Config;
