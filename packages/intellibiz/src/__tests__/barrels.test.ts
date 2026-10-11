import { describe, expect, it } from 'vitest';

// Every subpath barrel is imported eagerly. A broken re-export (the failure
// mode that previously crashed @intellibiz/commerce on import) throws here.
import * as root from '../index.js';
import * as commerceBarrel from '../commerce.js';
import * as financeBarrel from '../finance.js';
import * as identityBarrel from '../identity.js';
import * as httpBarrel from '../http.js';
import * as dbBarrel from '../db.js';
import * as configBarrel from '../config.js';
import * as testingBarrel from '../testing.js';

describe('intellibiz root barrel', () => {
	it('re-exports the core action API', () => {
		expect(typeof root.defineAction).toBe('function');
		expect(typeof root.isAction).toBe('function');
		expect(typeof root.defineConfig).toBe('function');
		expect(typeof root.definePlugin).toBe('function');
	});

	it('re-exports context accessors', () => {
		expect(typeof root.getContext).toBe('function');
		expect(typeof root.runWithContext).toBe('function');
		expect(typeof root.getTenantId).toBe('function');
		expect(typeof root.getTraceId).toBe('function');
	});

	it('re-exports context services and builders', () => {
		expect(typeof root.registerContextService).toBe('function');
		expect(typeof root.buildBaseContext).toBe('function');
		expect(typeof root.buildJobContext).toBe('function');
		expect(typeof root.buildTaskContext).toBe('function');
		expect(typeof root.buildSocketContext).toBe('function');
		expect(typeof root.createLogger).toBe('function');
	});

	it('re-exports the event bus', () => {
		expect(typeof root.emit).toBe('function');
		expect(typeof root.on).toBe('function');
		expect(typeof root.off).toBe('function');
		expect(typeof root.getDeadLetterQueue).toBe('function');
	});

	it('re-exports errors', () => {
		expect(typeof root.IntellibizError).toBe('function');
		expect(typeof root.ConfigValidationError).toBe('function');
		expect(typeof root.StrictTenancyViolationError).toBe('function');
	});

	it('re-exports the module namespaces', () => {
		expect(root.http).toBeDefined();
		expect(root.finance).toBeDefined();
		expect(root.money).toBeDefined();
		expect(root.Money).toBeDefined();
		expect(root.commerce).toBeDefined();
		expect(root.identity).toBeDefined();
		expect(typeof root.sql).toBe('function');
		expect(root.db).toBeDefined();
		expect(typeof root.createTraceId).toBe('function');
	});

	it('re-exports the payment providers from the metapackage', () => {
		expect(typeof root.StripeProvider).toBe('function');
		expect(typeof root.PayFastProvider).toBe('function');
		expect(typeof root.OzowProvider).toBe('function');
	});
});

describe('subpath barrels', () => {
	it('./commerce exposes the commerce namespace', () => {
		expect(commerceBarrel.commerce).toBeDefined();
	});

	it('./finance exposes finance, money and Money', () => {
		expect(financeBarrel.finance).toBeDefined();
		expect(financeBarrel.money).toBeDefined();
		expect(financeBarrel.Money).toBeDefined();
	});

	it('./identity exposes the identity namespace', () => {
		expect(identityBarrel.identity).toBeDefined();
	});

	it('./http exposes the router surface', () => {
		expect(httpBarrel.http).toBeDefined();
		expect(typeof httpBarrel.createRouter).toBe('function');
		expect(typeof httpBarrel.IntellibizRouter).toBe('function');
	});

	it('./db exposes sql and db', () => {
		expect(typeof dbBarrel.sql).toBe('function');
		expect(dbBarrel.db).toBeDefined();
	});

	it('./config exposes defineConfig', () => {
		expect(typeof configBarrel.defineConfig).toBe('function');
	});

	it('./testing exposes the testing helpers', () => {
		expect(typeof testingBarrel.withContext).toBe('function');
		expect(typeof testingBarrel.withTenant).toBe('function');
		expect(typeof testingBarrel.resetTestState).toBe('function');
		expect(testingBarrel.mockPayments).toBeDefined();
	});
});
