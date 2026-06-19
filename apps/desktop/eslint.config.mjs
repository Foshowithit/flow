import js from "@eslint/js";
import globals from "globals";

export default [
	{
		ignores: [
			"**/.next/**",
			"**/node_modules/**",
			"**/public/**",
			"**/.clerk/**",
			"**/.vercel/**",
			"**/out/**",
			"**/src-tauri/target/**",
			"**/src-tauri/gen/**",
		],
	},
	js.configs.recommended,
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
				...globals.es2021,
			},
			ecmaVersion: "latest",
			sourceType: "module",
		},
		rules: {
			"no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
			"no-console": "off",
		},
	},
];
