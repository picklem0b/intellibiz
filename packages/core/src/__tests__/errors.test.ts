import { describe, it, expect } from 'vitest';
import {
	IntellibizError,
	ContextMissingError,
	ConfigValidationError,
	ConfigDependencyError,
	StrictTenancyViolationError,
	PluginLoadError,
	PluginCircularDependencyError,
	ActionValidationError
} from '../errors.js';

describe('IntellibizError', () => {
	it('creates an error with all fields', () => {
		const err = new IntellibizError({
			code: 'CUSTOM_ERROR',
			message: 'Something went wrong',
			status: 400,
			details: { key: 'value' }
		});

		expect(err).toBeInstanceOf(Error);
		expect(err).toBeInstanceOf(IntellibizError);
		expect(err.code).toBe('CUSTOM_ERROR');
		expect(err.message).toBe('Something went wrong');
		expect(err.status).toBe(400);
		expect(err.details).toEqual({ key: 'value' });
		expect(err.timestamp).toBeTypeOf('number');
	});

	it('serializes to JSON correctly', () => {
		const err = new IntellibizError({
			code: 'TEST',
			message: 'test message',
			status: 422,
			details: { field: 'name' }
		});

		const json = err.toJSON();
		expect(json).toEqual({
			error: 'TEST',
			message: 'test message',
			status: 422,
			details: { field: 'name' }
		});
	});

	it('serializes to JSON without details when undefined', () => {
		const err = new IntellibizError({
			code: 'TEST',
			message: 'test',
			status: 500
		});

		const json = err.toJSON();
		expect(json).not.toHaveProperty('details');
	});

	it('has a readable toString', () => {
		const err = new IntellibizError({
			code: 'MY_ERR',
			message: 'bad',
			status: 500
		});
		expect(err.toString()).toBe('IntellibizError[MY_ERR]: bad');
	});

	it('preserves cause', () => {
		const cause = new Error('root cause');
		const err = new IntellibizError({
			code: 'CHAIN',
			message: 'wrapped',
			status: 500,
			cause
		});
		expect(err.cause).toBe(cause);
	});

	it('captures stack trace', () => {
		const err = new IntellibizError({
			code: 'STACK',
			message: 'test',
			status: 500
		});
		expect(err.stack).toBeDefined();
		expect(err.stack).toContain('IntellibizError');
	});
});

describe('ContextMissingError', () => {
	it('has correct defaults', () => {
		const err = new ContextMissingError();
		expect(err.code).toBe('CONTEXT_MISSING');
		expect(err.status).toBe(500);
		expect(err.message).toContain('No active Intellibiz context');
	});

	it('includes hint when provided', () => {
		const err = new ContextMissingError('custom hint');
		expect(err.message).toContain('custom hint');
	});
});

describe('ConfigValidationError', () => {
	it('includes issue count and issues', () => {
		const err = new ConfigValidationError('validation failed', {
			issueCount: 2,
			issues: [
				{ path: 'tenancy.strategy', message: 'Invalid value' },
				{ path: 'finance.baseCurrency', message: 'Required' }
			]
		});

		expect(err.code).toBe('CONFIG_VALIDATION_ERROR');
		expect(err.status).toBe(500);
		expect(err.details?.issueCount).toBe(2);
	});
});

describe('ConfigDependencyError', () => {
	it('includes flag and requires', () => {
		const err = new ConfigDependencyError('tenancy', 'ledger.mode = "atomic"');
		expect(err.code).toBe('CONFIG_DEPENDENCY_ERROR');
		expect(err.message).toContain('tenancy');
		expect(err.message).toContain('ledger.mode = "atomic"');
		expect(err.details).toEqual({
			flag: 'tenancy',
			requires: 'ledger.mode = "atomic"'
		});
	});
});

describe('StrictTenancyViolationError', () => {
	it('has correct defaults without table', () => {
		const err = new StrictTenancyViolationError();
		expect(err.code).toBe('STRICT_TENANCY_VIOLATION');
		expect(err.status).toBe(500);
	});

	it('includes table name when provided', () => {
		const err = new StrictTenancyViolationError('orders');
		expect(err.message).toContain('orders');
		expect(err.details).toEqual({ table: 'orders' });
	});
});

describe('PluginLoadError', () => {
	it('includes plugin name and reason', () => {
		const err = new PluginLoadError('stripe', 'missing dependency');
		expect(err.code).toBe('PLUGIN_LOAD_ERROR');
		expect(err.message).toContain('stripe');
		expect(err.message).toContain('missing dependency');
		expect(err.details).toEqual({
			pluginName: 'stripe',
			reason: 'missing dependency'
		});
	});
});

describe('PluginCircularDependencyError', () => {
	it('includes the cycle path', () => {
		const err = new PluginCircularDependencyError(['a', 'b', 'c', 'a']);
		expect(err.code).toBe('PLUGIN_CIRCULAR_DEPENDENCY');
		expect(err.message).toContain('a → b → c → a');
		expect(err.details).toEqual({ cycle: ['a', 'b', 'c', 'a'] });
	});
});

describe('ActionValidationError', () => {
	it('includes structured issues', () => {
		const err = new ActionValidationError([
			{ path: 'name', message: 'Required' },
			{ path: 'email', message: 'Invalid email' }
		]);

		expect(err.code).toBe('ACTION_VALIDATION_ERROR');
		expect(err.status).toBe(422);
		expect(err.details?.issues).toHaveLength(2);
	});
});

describe('error hierarchy', () => {
	it('all custom errors extend IntellibizError', () => {
		expect(new ContextMissingError()).toBeInstanceOf(IntellibizError);
		expect(new ConfigValidationError('')).toBeInstanceOf(IntellibizError);
		expect(new ConfigDependencyError('', '')).toBeInstanceOf(IntellibizError);
		expect(new StrictTenancyViolationError()).toBeInstanceOf(IntellibizError);
		expect(new PluginLoadError('', '')).toBeInstanceOf(IntellibizError);
		expect(new PluginCircularDependencyError([])).toBeInstanceOf(IntellibizError);
		expect(new ActionValidationError([])).toBeInstanceOf(IntellibizError);
	});

	it('all custom errors extend Error', () => {
		expect(new ContextMissingError()).toBeInstanceOf(Error);
		expect(new IntellibizError({ code: '', message: '', status: 0 })).toBeInstanceOf(Error);
	});
});
