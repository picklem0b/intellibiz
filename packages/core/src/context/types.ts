import type { IntellibizStore, ContextOrigin } from './store.js';

// ─── Module Augmentation Interfaces ──────────────────────────────────────────

/**
 * Shared service surface available on every context type.
 *
 * Packages extend this interface via TypeScript module augmentation.
 * Developers never write this — each @intellibiz/* package declares its contribution.
 *
 * @example
 * // packages/commerce/src/types.ts
 * declare module '@intellibiz/core' {
 *   interface SharedServices {
 *     payments: PaymentService
 *     subscriptions: SubscriptionService
 *   }
 * }
 *
 * // This makes req.payments autocomplete in every handler without manual imports.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SharedServices {}

/**
 * Typed event registry. Extend via module augmentation in your application.
 *
 * @example
 * // src/types/events.ts
 * declare module '@intellibiz/core' {
 *   interface IntellibizEvents {
 *     'order.placed': { orderId: string; total: string }
 *     'user.signup':  { userId: string; email: string }
 *     'license.expired': { licenseId: string; plan: string }
 *   }
 * }
 *
 * // Now emit() and on() are fully type-checked and autocompleted.
 * await emit('order.placed', { orderId: 'ord_123', total: '49.99' })
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface IntellibizEvents {}

// ─── Base Context ─────────────────────────────────────────────────────────────

/**
 * The common base for all six specialized execution contexts.
 * Carries the full ALS store plus the shared service surface.
 */
type BaseContext = Readonly<IntellibizStore> & Readonly<SharedServices>;

// ─── RFC-001: The Six Specialized Execution Contexts ──────────────────────────

/**
 * HTTP request context. Parameter name: `req` — never `ctx`.
 *
 * Unique properties: body, headers, params, query, ip, method, url, status(), header()
 *
 * @example
 * http.get('/orders/:id', async (req) => {
 *   const order = await req.db.selectFrom('orders').where('id', '=', req.params.id).executeTakeFirst()
 *   if (!order) throw new IntellibizError({ code: 'ORDER_NOT_FOUND', status: 404, message: 'Order not found.' })
 *   return order
 * })
 */
export interface RequestContext extends BaseContext {
	readonly body: unknown;
	readonly headers: Record<string, string>;
	readonly params: Record<string, string>;
	readonly query: Record<string, string>;
	readonly ip: string;
	readonly method: string;
	readonly url: string;
	/** Override the inferred HTTP response status code. */
	status(code: number): void;
	/** Set a response header. */
	header(key: string, value: string): void;
}

/**
 * Business action context. Parameter name: `action` — never `ctx`.
 *
 * Unique properties: data (typed to the Zod schema), origin
 *
 * @example
 * export const processCheckout = defineAction({
 *   input: CheckoutSchema,
 *   handler: async (action) => {
 *     const { cartItems, shippingAddress } = action.data
 *     return await commerce.transaction(async (tx) => {
 *       const total = await finance.calculateTotal({ items: cartItems })
 *       return await tx.payments.charge({ amount: total.grandTotal })
 *     })
 *   },
 * })
 */
export interface ActionContext<TData = unknown> extends BaseContext {
	readonly data: TData;
	readonly origin: ContextOrigin;
}

/**
 * Event bus delivery context. Parameter name: `event` — never `ctx`.
 *
 * Unique properties: payload (typed to the event registry), source, timestamp, eventId
 *
 * @example
 * on('order.placed', async (event) => {
 *   event.log.info(`Order placed: ${event.payload.orderId}`)
 * })
 */
export interface EventContext<TPayload = unknown> extends BaseContext {
	readonly payload: TPayload;
	readonly source: string;
	readonly timestamp: number;
	readonly eventId: string;
	readonly deliveryAttempt: number;
}

/**
 * Queue worker context. Parameter name: `job` — never `ctx`.
 *
 * Unique properties: data, jobId, attempt, maxAttempts, retry(), fail()
 *
 * @example
 * on('send-invoice', async (job) => {
 *   if (job.attempt > 3) return job.fail('Too many retries')
 *   await generateAndSendInvoice(job.data.orderId)
 * })
 */
export interface JobContext<TData = unknown> extends BaseContext {
	readonly data: TData;
	readonly jobId: string;
	readonly attempt: number;
	readonly maxAttempts: number;
	readonly queue: string;
	/** Schedules this job for retry with exponential backoff. */
	retry(delayMs?: number): void;
	/** Permanently fails this job and moves it to the dead letter queue. */
	fail(reason: string): void;
}

/**
 * Scheduled cron task context. Parameter name: `task` — never `ctx`.
 *
 * @example
 * schedule('0 0 * * *', async (task) => {
 *   task.log.info('Running daily invoice generation')
 * })
 */
export interface TaskContext extends BaseContext {
	readonly scheduledAt: Date;
	readonly jobId: string;
	readonly cronExpression: string;
}

/**
 * WebSocket message context. Parameter name: `socket` — never `ctx`.
 *
 * @example
 * http.socket('order.subscribe', async (socket) => {
 *   socket.join(`order:${socket.data.orderId}`)
 *   socket.send('subscribed', { orderId: socket.data.orderId })
 * })
 */
export interface SocketContext<TData = unknown> extends BaseContext {
	readonly data: TData;
	readonly connectionId: string;
	readonly roomId: string | null;
	send(event: string, payload: unknown): void;
	broadcast(event: string, payload: unknown): void;
	join(room: string): void;
	leave(room: string): void;
	disconnect(): void;
}

/**
 * Plugin / application lifecycle context. Parameter name: `app` — never `ctx`.
 *
 * @example
 * definePlugin({
 *   hooks: {
 *     onInit: async (app) => {
 *       app.log.info('Plugin initialized')
 *       app.register('myService.client', new MyClient())
 *     },
 *   },
 * })
 */
export interface ApplicationContext {
	readonly log: Console;
	register(name: string, value: unknown): void;
	get<T>(name: string): T;
}
