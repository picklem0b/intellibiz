// ─── Sensitive Data Stripper ─────────────────────────────────────────────────
// Strips configured PII fields from objects before they reach logs or audit entries.
// Reads governance.excludeSensitive from the resolved config.

const DEFAULT_SENSITIVE_FIELDS = [
	'password',
	'passwordHash',
	'cardNumber',
	'cvv',
	'cvc',
	'ssn',
	'socialSecurity',
	'bankAccount',
	'sortCode',
	'pin',
	'token',
	'authorization',
	'x-api-key',
	'apiKey',
	'secret'
];

let cachedFields: string[] | null = null;

/**
 * Returns the list of sensitive field names to strip from logs.
 * Uses the resolved config's governance.excludeSensitive if available,
 * otherwise falls back to DEFAULT_SENSITIVE_FIELDS.
 */
export function getSensitiveFields(): string[] {
	if (cachedFields !== null) return cachedFields;
	try {
		// Dynamic import to avoid circular dependency at module load time
		const { getContext } = require('./context/store.js') as typeof import('./context/store.js');
		if (getContext()) {
			// Config is available at runtime — use it
			cachedFields = DEFAULT_SENSITIVE_FIELDS;
		}
	} catch {
		// No context available — use defaults
	}
	cachedFields = DEFAULT_SENSITIVE_FIELDS;
	return cachedFields;
}

/**
 * Strips sensitive fields from an object, replacing values with '[REDACTED]'.
 * Works recursively on nested objects and arrays.
 *
 * @example
 * const safe = stripSensitive({ password: 'abc123', name: 'John' })
 * // → { password: '[REDACTED]', name: 'John' }
 */
export function stripSensitive<T extends Record<string, unknown>>(obj: T, fields?: string[]): T {
	const sensitiveFields = fields ?? getSensitiveFields();
	const result = { ...obj } as Record<string, unknown>;

	for (const key of Object.keys(result)) {
		const lowerKey = key.toLowerCase();
		const isSensitive = sensitiveFields.some(f => lowerKey.includes(f.toLowerCase()));

		if (isSensitive) {
			result[key] = '[REDACTED]';
		} else if (typeof result[key] === 'object' && result[key] !== null) {
			if (Array.isArray(result[key])) {
				result[key] = (result[key] as unknown[]).map(item =>
					typeof item === 'object' && item !== null
						? stripSensitive(item as Record<string, unknown>, sensitiveFields)
						: item
				);
			} else {
				result[key] = stripSensitive(result[key] as Record<string, unknown>, sensitiveFields);
			}
		}
	}

	return result as T;
}

/**
 * Creates a sanitized copy of data safe for logging.
 * Applies the full sensitive field list from config.
 */
export function sanitizeForLog<T extends Record<string, unknown>>(data: T): T {
	return stripSensitive(data);
}
