/**
 * Pure helpers behind `intellibiz generate *`.
 *
 * Kept free of CLI/console concerns so the generated output can be
 * unit-tested directly instead of snapshotting terminal colours.
 */

/** `order-items` → `orderItems` */
export function toCamelCase(name: string): string {
	return name
		.trim()
		.replace(/[-_\s]+([a-zA-Z0-9])/g, (_, c: string) => c.toUpperCase())
		.replace(/^[^a-zA-Z_$]+/, '')
		.replace(/^([a-z])/, (m) => m);
}

/** `order-items` → `OrderItems` */
export function toPascalCase(name: string): string {
	const camel = toCamelCase(name);
	return camel.charAt(0).toUpperCase() + camel.slice(1);
}

/** `order-items` → `order-items` (normalised, kebab-case, filename-safe) */
export function toKebabCase(name: string): string {
	return name
		.trim()
		.replace(/([a-z0-9])([A-Z])/g, '$1-$2')
		.replace(/[\s_]+/g, '-')
		.replace(/[^a-zA-Z0-9-]+/g, '')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '')
		.toLowerCase();
}

export interface ScaffoldedAction {
	/** Normalised kebab-case file name, e.g. `order-items` */
	file: string;
	/** Exported const name, e.g. `orderItems` */
	exportName: string;
	/** Input schema const name, e.g. `OrderItemsInput` */
	schemaName: string;
	/** Full source of the generated action file */
	source: string;
}

/**
 * Generates the source for a new `defineAction` handler.
 *
 * Throws when the provided name has no usable identifier characters.
 */
export function scaffoldAction(rawName: string): ScaffoldedAction {
	const file = toKebabCase(rawName);
	const exportName = toCamelCase(rawName);
	const schemaName = `${toPascalCase(rawName)}Input`;

	if (!file || !exportName) {
		throw new Error(
			`Invalid action name "${rawName}": must contain at least one letter or digit.`
		);
	}

	const source = `import { defineAction } from 'intellibiz';
import { z } from 'zod';

const ${schemaName} = z.object({
	// define your input schema
});

export const ${exportName} = defineAction({
	input: ${schemaName},
	async handler(action) {
		// action.data is fully typed from ${schemaName}
		// action.db / action.log / action.emit are available
		return {};
	}
});
`;

	return { file, exportName, schemaName, source };
}

export interface ScaffoldedOverride {
	file: string;
	flag: string;
	source: string;
}

/** Generates an `intellibiz/<flag>.ts` config override file. */
export function scaffoldOverride(rawFlag: string): ScaffoldedOverride {
	const flag = toKebabCase(rawFlag);
	if (!flag) {
		throw new Error(`Invalid override flag "${rawFlag}".`);
	}

	const source = `import { defineConfigOverride } from 'intellibiz';

/**
 * Overrides applied when the \`${flag}\` flag is active.
 * Registered in intellibiz.config.ts via \`overrides: { ${flag} }\`.
 */
export default defineConfigOverride({
	${toCamelCase(flag)}: {
		// override values here
	}
});
`;

	return { file: flag, flag, source };
}

/** Generates a skeleton package.json for a new plugin package. */
export function scaffoldPlugin(rawName: string): {
	dir: string;
	name: string;
	source: string;
} {
	const dir = toKebabCase(rawName);
	if (!dir) {
		throw new Error(`Invalid plugin name "${rawName}".`);
	}

	const source = JSON.stringify(
		{
			name: `@intellibiz/${dir}`,
			version: '0.0.0',
			private: true,
			type: 'module',
			main: './dist/index.cjs',
			module: './dist/index.mjs',
			types: './dist/index.d.mts',
			exports: {
				'.': {
					import: {
						types: './dist/index.d.mts',
						default: './dist/index.mjs'
					},
					require: {
						types: './dist/index.d.cts',
						default: './dist/index.cjs'
					}
				}
			},
			scripts: {
				build:
					'tsdown src/index.ts --format esm,cjs --dts --clean --sourcemap --target es2022',
				test: 'vitest run',
				typecheck: 'tsc --noEmit',
				clean: 'rm -rf dist'
			},
			peerDependencies: {
				'@intellibiz/core': 'workspace:*'
			}
		},
		null,
		'\t'
	);

	return { dir, name: `@intellibiz/${dir}`, source: source + '\n' };
}

/** `1700000000000_add-users` — sortable migration file name. */
export function scaffoldMigration(
	name: string,
	now: number = Date.now()
): string {
	const slug = toKebabCase(name) || 'migration';
	return `${now}_${slug}`;
}
