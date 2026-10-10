import type { Config } from 'tailwindcss';

/**
 * Palette: ledger paper and ink.
 * Neutrals lean green-grey (the tint of fanfold ledger paper), the accent is a
 * deep bookkeeping green, and red/amber are reserved for debit and caution.
 * Everything routes through CSS variables so light and dark stay in lockstep.
 */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
	darkMode: 'class',
	content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
	theme: {
		extend: {
			colors: {
				background: token('background'),
				foreground: token('foreground'),
				muted: token('muted'),
				'muted-foreground': token('muted-foreground'),
				border: token('border'),
				ring: token('ring'),
				bar: token('bar'),
				debit: token('debit'),
				caution: token('caution'),
				brand: {
					50: '#EAF4EF',
					100: '#D3E8DE',
					200: '#A9D1BF',
					300: '#7FB9A0',
					400: '#52A07F',
					500: '#2E8264',
					600: '#1E6B52',
					700: '#185641',
					800: '#134334',
					900: '#0E3228',
					950: '#08201A'
				}
			},
			fontFamily: {
				sans: [
					'Schibsted Grotesk',
					'system-ui',
					'-apple-system',
					'Segoe UI',
					'sans-serif'
				],
				mono: [
					'Red Hat Mono',
					'ui-monospace',
					'SFMono-Regular',
					'Menlo',
					'monospace'
				]
			},
			maxWidth: { measure: '68ch' }
		}
	},
	plugins: []
};

export default config;
