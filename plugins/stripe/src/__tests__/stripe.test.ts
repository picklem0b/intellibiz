import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  stripePlugin,
  StripePaymentError,
  type PaymentProvider,
  type ChargeRequest,
  type RefundRequest,
} from '../index';

// ─── Mock fetch ──────────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockStripeResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ data }),
  };
}

function mockStripeError(message: string, type = 'card_error', code?: string, status = 402) {
  return {
    ok: false,
    status,
    json: async () => ({
      error: { message, type, code, param: undefined },
    }),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('stripePlugin', () => {
  let provider: PaymentProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = stripePlugin({
      secretKey: 'sk_test_1234567890',
      webhookSecret: 'whsec_test_secret',
      maxRetries: 0, // No retries for tests
    });
  });

  describe('charge', () => {
    it('creates a payment intent and returns charge response', async () => {
      mockFetch.mockResolvedValueOnce(
        mockStripeResponse({
          id: 'pi_3abc123',
          status: 'succeeded',
          amount: 1999,
          currency: 'usd',
          metadata: { orderId: 'ord_001' },
        })
      );

      const result = await provider.charge({
        amount: 1999,
        currency: 'USD',
        customerId: 'cus_test123',
        metadata: { orderId: 'ord_001' },
      });

      expect(result.id).toBe('pi_3abc123');
      expect(result.status).toBe('succeeded');
      expect(result.amount).toBe(1999);
      expect(result.currency).toBe('USD');

      // Verify correct API call
      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.stripe.com/v1/payment_intents');
      expect(opts.method).toBe('POST');
      expect(opts.headers).toMatchObject({
        Authorization: 'Bearer sk_test_1234567890',
      });
    });

    it('maps requires_action status correctly', async () => {
      mockFetch.mockResolvedValueOnce(
        mockStripeResponse({
          id: 'pi_3dsv456',
          status: 'requires_action',
          amount: 5000,
          currency: 'zar',
          client_secret: 'pi_3dsv456_secret_abc',
        })
      );

      const result = await provider.charge({
        amount: 5000,
        currency: 'ZAR',
        paymentMethodId: 'pm_card_3dsecure',
      });

      expect(result.status).toBe('requires_action');
      expect(result.clientSecret).toBe('pi_3dsv456_secret_abc');
    });

    it('throws StripePaymentError on Stripe errors', async () => {
      mockFetch.mockResolvedValueOnce(
        mockStripeError('Your card was declined', 'card_error', 'card_declined')
      );

      await expect(
        provider.charge({
          amount: 1000,
          currency: 'USD',
          paymentMethodId: 'pm_card_declined',
        })
      ).rejects.toThrow(StripePaymentError);
    });

    it('throws on timeout', async () => {
      // Mock a delayed abort
      mockFetch.mockImplementationOnce(() =>
        new Promise((_resolve, reject) => {
          setTimeout(() => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          }, 50);
        })
      );

      const fastProvider = stripePlugin({
        secretKey: 'sk_test_1234567890',
        timeoutMs: 10,
        maxRetries: 0,
      });

      await expect(
        fastProvider.charge({ amount: 1000, currency: 'USD' })
      ).rejects.toThrow(StripePaymentError);
    });
  });

  describe('refund', () => {
    it('creates a full refund', async () => {
      mockFetch.mockResolvedValueOnce(
        mockStripeResponse({
          id: 're_abc123',
          status: 'succeeded',
          amount: 1999,
          reason: null,
        })
      );

      const result = await provider.refund({
        paymentIntentId: 'pi_3abc123',
      });

      expect(result.id).toBe('re_abc123');
      expect(result.status).toBe('succeeded');
      expect(result.amount).toBe(1999);
    });

    it('creates a partial refund with reason', async () => {
      mockFetch.mockResolvedValueOnce(
        mockStripeResponse({
          id: 're_partial1',
          status: 'succeeded',
          amount: 500,
          reason: 'requested_by_customer',
        })
      );

      const result = await provider.refund({
        paymentIntentId: 'pi_3abc123',
        amount: 500,
        reason: 'requested_by_customer',
      });

      expect(result.amount).toBe(500);
      expect(result.reason).toBe('requested_by_customer');
    });
  });

  describe('verifyWebhookSignature', () => {
    it('throws if webhook secret is not configured', () => {
      const noSecretProvider = stripePlugin({
        secretKey: 'sk_test_123',
      });

      expect(() => {
        noSecretProvider.verifyWebhookSignature('payload', 'sig');
      }).toThrow(StripePaymentError);
    });

    it('returns false for invalid signatures', () => {
      const result = provider.verifyWebhookSignature(
        'some payload',
        't=123,v1=invalid_signature'
      );
      expect(result).toBe(false);
    });

    it('returns true for valid signatures', async () => {
      const { createHmac } = await import('node:crypto');
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = '{"type":"payment_intent.succeeded"}';
      const signedPayload = `${timestamp}.${payload}`;
      const signature = createHmac('sha256', 'whsec_test_secret')
        .update(signedPayload, 'utf-8')
        .digest('hex');

      const result = provider.verifyWebhookSignature(
        payload,
        `t=${timestamp},v1=${signature}`
      );
      expect(result).toBe(true);
    });
  });

  describe('parseWebhookEvent', () => {
    it('parses a valid webhook event', async () => {
      const { createHmac } = await import('node:crypto');
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = JSON.stringify({
        id: 'evt_test123',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_abc' } },
      });
      const signedPayload = `${timestamp}.${payload}`;
      const signature = createHmac('sha256', 'whsec_test_secret')
        .update(signedPayload, 'utf-8')
        .digest('hex');

      const event = provider.parseWebhookEvent(
        payload,
        `t=${timestamp},v1=${signature}`
      );

      expect(event.id).toBe('evt_test123');
      expect(event.type).toBe('payment_intent.succeeded');
    });

    it('throws on invalid signature', () => {
      expect(() => {
        provider.parseWebhookEvent(
          '{"type":"test"}',
          't=123,v1=badsig'
        );
      }).toThrow(StripePaymentError);
    });
  });

  describe('createCheckoutSession', () => {
    it('creates a checkout session', async () => {
      mockFetch.mockResolvedValueOnce(
        mockStripeResponse({
          id: 'cs_test123',
          url: 'https://checkout.stripe.com/c/pay/cs_test123',
          status: 'open',
        })
      );

      const result = await provider.createCheckoutSession({
        amount: 2500,
        currency: 'USD',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      });

      expect(result.id).toBe('cs_test123');
      expect(result.url).toContain('checkout.stripe.com');
      expect(result.status).toBe('open');
    });
  });

  describe('plugin identity', () => {
    it('has the correct name', () => {
      expect(provider.name).toBe('stripe');
    });
  });
});
