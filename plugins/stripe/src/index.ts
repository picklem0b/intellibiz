/**
 * @intellibiz/plugin-stripe
 *
 * Stripe payment provider plugin for IntelliBiz.
 * Wraps the Stripe REST API with IntelliBiz's payment provider interface.
 *
 * @example
 * ```ts
 * import { stripePlugin } from '@intellibiz/plugin-stripe'
 *
 * // In intellibiz.config.ts
 * export default defineConfig({
 *   commerce: {
 *     paymentProvider: stripePlugin({
 *       secretKey: process.env.STRIPE_SECRET_KEY,
 *       webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
 *     }),
 *   },
 * })
 * ```
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface StripePluginConfig {
  /** Stripe secret API key (sk_test_... or sk_live_...) */
  secretKey: string;
  /** Stripe webhook signing secret (whsec_...) for signature verification */
  webhookSecret?: string;
  /** API version override (default: latest) */
  apiVersion?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeoutMs?: number;
  /** Maximum retry attempts for transient failures (default: 3) */
  maxRetries?: number;
}

export interface ChargeRequest {
  amount: number;           // Amount in minor units (cents)
  currency: string;         // ISO-4217 currency code
  customerId?: string;      // Stripe customer ID (cus_...)
  paymentMethodId?: string; // Payment method ID (pm_...)
  description?: string;
  metadata?: Record<string, string>;
  idempotencyKey?: string;
}

export interface ChargeResponse {
  id: string;               // Stripe payment intent ID (pi_...)
  status: 'succeeded' | 'pending' | 'failed' | 'requires_action';
  amount: number;
  currency: string;
  clientSecret?: string;    // For frontend confirmation
  error?: string;
  metadata?: Record<string, string>;
}

export interface RefundRequest {
  paymentIntentId: string;  // pi_... to refund
  amount?: number;          // Partial refund amount (minor units). Omit for full refund.
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
  metadata?: Record<string, string>;
}

export interface RefundResponse {
  id: string;               // Stripe refund ID (re_...)
  status: 'succeeded' | 'pending' | 'failed';
  amount: number;
  reason?: string;
}

export interface WebhookEvent {
  id: string;               // Stripe event ID (evt_...)
  type: string;             // e.g. 'payment_intent.succeeded'
  data: Record<string, unknown>;
  createdAt: number;        // Unix timestamp
}

export interface CheckoutSessionRequest {
  amount: number;
  currency: string;
  customerId?: string;
  successUrl: string;
  cancelUrl: string;
  lineItems?: Array<{
    name: string;
    amount: number;
    quantity: number;
  }>;
  metadata?: Record<string, string>;
}

export interface CheckoutSessionResponse {
  id: string;               // Stripe checkout session ID (cs_...)
  url: string;              // Redirect URL for the customer
  status: 'open' | 'complete' | 'expired';
}

export interface PaymentProvider {
  readonly name: string;
  charge(req: ChargeRequest): Promise<ChargeResponse>;
  refund(req: RefundRequest): Promise<RefundResponse>;
  verifyWebhookSignature(payload: string, signature: string): boolean;
  parseWebhookEvent(payload: string, signature: string): WebhookEvent;
  createCheckoutSession(req: CheckoutSessionRequest): Promise<CheckoutSessionResponse>;
}

// ─── Stripe API Client ───────────────────────────────────────────────────────

interface StripeApiError {
  message: string;
  type: string;
  code?: string;
  param?: string;
}

interface StripeApiResponse<T> {
  data?: T;
  error?: StripeApiError;
}

async function stripeRequest<T>(
  config: StripePluginConfig,
  method: string,
  path: string,
  body?: Record<string, unknown>,
  idempotencyKey?: string
): Promise<T> {
  const url = `https://api.stripe.com${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.secretKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  if (config.apiVersion) {
    headers['Stripe-Version'] = config.apiVersion;
  }

  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  const fetchOptions: RequestInit = {
    method,
    headers,
  };

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    fetchOptions.body = encodeFormData(body);
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    config.timeoutMs ?? 30_000
  );
  fetchOptions.signal = controller.signal;

  try {
    const response = await fetch(url, fetchOptions);
    clearTimeout(timeout);

    const json: StripeApiResponse<T> = await response.json() as StripeApiResponse<T>;

    if (json.error) {
      throw new StripePaymentError(
        json.error.message,
        json.error.code ?? 'stripe_error',
        response.status,
        json.error.type
      );
    }

    return json.data as T;
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof StripePaymentError) throw err;

    if (err instanceof Error && err.name === 'AbortError') {
      throw new StripePaymentError(
        'Request timed out',
        'timeout',
        408,
        'api_error'
      );
    }

    throw new StripePaymentError(
      `Stripe API request failed: ${(err as Error).message}`,
      'network_error',
      500,
      'api_error'
    );
  }
}

function encodeFormData(obj: Record<string, unknown>, prefix = ''): string {
  const parts: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}[${key}]` : key;

    if (value === null || value === undefined) continue;

    if (typeof value === 'object' && !Array.isArray(value)) {
      parts.push(encodeFormData(value as Record<string, unknown>, fullKey));
    } else if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const itemPrefix = `${fullKey}[${i}]`;
        if (typeof value[i] === 'object') {
          parts.push(
            encodeFormData(value[i] as Record<string, unknown>, itemPrefix)
          );
        } else {
          parts.push(
            `${encodeURIComponent(itemPrefix)}=${encodeURIComponent(String(value[i]))}`
          );
        }
      }
    } else {
      parts.push(
        `${encodeURIComponent(fullKey)}=${encodeURIComponent(String(value))}`
      );
    }
  }

  return parts.filter(Boolean).join('&');
}

// ─── Stripe Error ────────────────────────────────────────────────────────────

export class StripePaymentError extends Error {
  readonly code: string;
  readonly status: number;
  readonly stripeType: string;

  constructor(message: string, code: string, status: number, stripeType: string) {
    super(message);
    this.name = 'StripePaymentError';
    this.code = code;
    this.status = status;
    this.stripeType = stripeType;
  }
}

// ─── Webhook Signature Verification ──────────────────────────────────────────

function verifyStripeSignature(
  payload: string,
  signatureHeader: string,
  secret: string
): { verified: boolean; event?: WebhookEvent } {
  // Parse the Stripe-Signature header
  // Format: t=timestamp,v1=signature[,v1=signature...]
  const parts = signatureHeader.split(',');
  let timestamp = '';
  const signatures: string[] = [];

  for (const part of parts) {
    const [key, value] = part.split('=');
    if (key === 't') timestamp = value;
    if (key === 'v1') signatures.push(value);
  }

  if (!timestamp || signatures.length === 0) {
    return { verified: false };
  }

  // Compute expected signature using HMAC-SHA256
  // In production this uses Node.js crypto — simplified for browser compat
  const signedPayload = `${timestamp}.${payload}`;

  // Use a simplified check — real implementation uses crypto.timingSafeEqual
  // For production, import { createHmac, timingSafeEqual } from 'node:crypto'
  try {
    const { createHmac, timingSafeEqual } = require('node:crypto') as typeof import('node:crypto');
    const expectedSig = createHmac('sha256', secret)
      .update(signedPayload, 'utf-8')
      .digest('hex');

    const matched = signatures.some((sig) => {
      try {
        const expected = Buffer.from(expectedSig, 'hex');
        const actual = Buffer.from(sig, 'hex');
        return expected.length === actual.length && timingSafeEqual(expected, actual);
      } catch {
        return false;
      }
    });

    if (!matched) return { verified: false };

    const event: WebhookEvent = {
      id: `evt_${timestamp}`,
      type: 'unknown',
      data: JSON.parse(payload) as Record<string, unknown>,
      createdAt: parseInt(timestamp, 10),
    };

    // Try to extract type from the parsed payload
    const parsed = JSON.parse(payload) as Record<string, unknown>;
    if (parsed.type) event.type = parsed.type as string;
    if (parsed.id) event.id = parsed.id as string;

    return { verified: true, event };
  } catch {
    return { verified: false };
  }
}

// ─── Retry Logic ─────────────────────────────────────────────────────────────

const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;

      if (err instanceof StripePaymentError && RETRYABLE_STATUS_CODES.has(err.status)) {
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10_000);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }

      throw err;
    }
  }

  throw lastError;
}

// ─── Plugin Factory ──────────────────────────────────────────────────────────

export function stripePlugin(config: StripePluginConfig): PaymentProvider {
  const cfg: StripePluginConfig = {
    timeoutMs: 30_000,
    maxRetries: 3,
    ...config,
  };

  return {
    name: 'stripe',

    async charge(req: ChargeRequest): Promise<ChargeResponse> {
      return withRetry(async () => {
        const params: Record<string, unknown> = {
          amount: req.amount,
          currency: req.currency.toLowerCase(),
          confirm: true,
          automatic_payment_methods: { enabled: true },
        };

        if (req.customerId) params.customer = req.customerId;
        if (req.paymentMethodId) params.payment_method = req.paymentMethodId;
        if (req.description) params.description = req.description;
        if (req.metadata) params.metadata = req.metadata;

        const pi = await stripeRequest<{
          id: string;
          status: string;
          amount: number;
          currency: string;
          client_secret?: string;
          last_payment_error?: { message?: string };
          metadata?: Record<string, string>;
        }>(cfg, 'POST', '/v1/payment_intents', params, req.idempotencyKey);

        const statusMap: Record<string, ChargeResponse['status']> = {
          succeeded: 'succeeded',
          requires_payment_method: 'pending',
          requires_confirmation: 'pending',
          requires_action: 'requires_action',
          processing: 'pending',
          canceled: 'failed',
          requires_capture: 'pending',
        };

        return {
          id: pi.id,
          status: statusMap[pi.status] ?? 'failed',
          amount: pi.amount,
          currency: pi.currency.toUpperCase(),
          clientSecret: pi.client_secret,
          error: pi.last_payment_error?.message,
          metadata: pi.metadata,
        };
      }, cfg.maxRetries!);
    },

    async refund(req: RefundRequest): Promise<RefundResponse> {
      return withRetry(async () => {
        const params: Record<string, unknown> = {
          payment_intent: req.paymentIntentId,
        };

        if (req.amount !== undefined) params.amount = req.amount;
        if (req.reason) params.reason = req.reason;
        if (req.metadata) params.metadata = req.metadata;

        const refund = await stripeRequest<{
          id: string;
          status: string;
          amount: number;
          reason?: string;
        }>(cfg, 'POST', '/v1/refunds', params);

        return {
          id: refund.id,
          status: refund.status === 'succeeded' ? 'succeeded' :
                  refund.status === 'pending' ? 'pending' : 'failed',
          amount: refund.amount,
          reason: refund.reason,
        };
      }, cfg.maxRetries!);
    },

    verifyWebhookSignature(payload: string, signature: string): boolean {
      if (!cfg.webhookSecret) {
        throw new StripePaymentError(
          'Webhook secret not configured',
          'webhook_secret_missing',
          500,
          'invalid_request_error'
        );
      }
      return verifyStripeSignature(payload, signature, cfg.webhookSecret).verified;
    },

    parseWebhookEvent(payload: string, signature: string): WebhookEvent {
      if (!cfg.webhookSecret) {
        throw new StripePaymentError(
          'Webhook secret not configured',
          'webhook_secret_missing',
          500,
          'invalid_request_error'
        );
      }

      const result = verifyStripeSignature(payload, signature, cfg.webhookSecret);
      if (!result.verified || !result.event) {
        throw new StripePaymentError(
          'Invalid webhook signature',
          'webhook_signature_invalid',
          400,
          'invalid_request_error'
        );
      }

      return result.event;
    },

    async createCheckoutSession(
      req: CheckoutSessionRequest
    ): Promise<CheckoutSessionResponse> {
      return withRetry(async () => {
        const params: Record<string, unknown> = {
          mode: 'payment',
          success_url: req.successUrl,
          cancel_url: req.cancelUrl,
          line_items: [
            {
              price_data: {
                currency: req.currency.toLowerCase(),
                unit_amount: req.amount,
                product_data: {
                  name: 'Purchase',
                },
              },
              quantity: 1,
            },
          ],
        };

        if (req.customerId) params.customer = req.customerId;
        if (req.metadata) params.metadata = req.metadata;

        const session = await stripeRequest<{
          id: string;
          url: string;
          status: string;
        }>(cfg, 'POST', '/v1/checkout/sessions', params);

        return {
          id: session.id,
          url: session.url,
          status: session.status as CheckoutSessionResponse['status'],
        };
      }, cfg.maxRetries!);
    },
  };
}

// ─── IntelliBiz Plugin Registration ──────────────────────────────────────────

export function intellibizStripePlugin(config: StripePluginConfig) {
  return {
    name: '@intellibiz/plugin-stripe',
    version: '1.0.0',
    provider: stripePlugin(config),
  };
}

export default stripePlugin;
