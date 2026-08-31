import { IntellibizRouter } from './router.js';
import type { MiddlewareOptions } from './middleware.js';

export { IntellibizRouter } from './router.js';
export { kernelMiddleware, resolveTenant } from './middleware.js';
export type { MiddlewareOptions } from './middleware.js';

/**
 * The default singleton router instance.
 * For most applications, import `http` and call methods on it directly.
 *
 * @example
 * import { http } from '@intellibiz/http'
 *
 * http.get('/orders', async (req) => {
 *   return { tenantId: req.tenantId }
 * })
 *
 * http.listen(3000, () => console.log('Running on :3000'))
 */
export const http = new IntellibizRouter();

/**
 * Creates a new router with custom middleware options.
 * Use when you need multiple router instances or custom JWT config.
 */
export function createRouter(opts?: MiddlewareOptions): IntellibizRouter {
	return new IntellibizRouter(opts);
}
