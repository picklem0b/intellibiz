# Configuration Flags Reference

Complete technical reference for every flag available in `intellibiz.config.ts`. All flags are validated by Zod schemas at engine startup. The engine refuses to start if any schema validation or dependency check fails.

---

## Top-Level

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `modules` | `string[]` | `['core']` | Active Intellibiz modules. Options: `'commerce'`, `'finance'`, `'identity'`, `'legal'`, `'inventory'`, `'governance'`, `'db'` |
| `plugins` | `Plugin[]` | `[]` | Registered plugin instances from `definePlugin` |

---

## Database (`database`)

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `database.driver` | `'postgres' \| 'mysql' \| 'sqlite'` | `'postgres'` | Database protocol adapter |
| `database.url` | `string` | Required | Connection string URI |
| `database.pool.min` | `number` | `2` | Minimum pool connections |
| `database.pool.max` | `number` | `10` | Maximum pool connections |

---

## Multi-Tenancy (`tenancy`)

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `tenancy.strategy` | `'column' \| 'schema'` | `'column'` | Isolation model. `schema` requires Postgres |
| `tenancy.key` | `string` | `'org_id'` | Column name used for column strategy injection |
| `tenancy.type` | `'uuid' \| 'slug' \| 'int'` | `'uuid'` | Data type of the tenant identifier |
| `tenancy.strict` | `boolean` | `true` | Throw `StrictTenancyViolationError` if query executes with no active tenant |
| `tenancy.resolve` | `(req) => string` | `undefined` | Custom tenant resolution function |

---

## Currency (`currency`)

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `currency.base` | `string` | `'USD'` | Primary ISO-4217 base currency |
| `currency.rounding` | `'bankers' \| 'up' \| 'down'` | `'bankers'` | Rounding algorithm. `bankers` = round half to even |

---

## Taxation (`taxation`)

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `taxation.provider` | `'internal' \| 'stripe' \| 'avalara'` | `'internal'` | Tax calculation engine |
| `taxation.defaultRate` | `number` | `0` | Fallback VAT/GST rate |
| `taxation.validateVat` | `boolean` | `false` | Validate EU VIES VAT registration numbers |
| `taxation.autoCalculate` | `boolean` | `true` | Auto-calculate tax in `finance.calculateTotal()` |

---

## Ledger (`ledger`, `journaling`)

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `ledger.mode` | `'atomic' \| 'background'` | `'atomic'` | `atomic` writes WAL intent before execution |
| `ledger.sync` | `Array<'db' \| 's3'>` | `['db']` | Persistence targets for audit blocks |
| `ledger.retention` | `string` | `'7y'` | Audit log retention duration |
| `journaling.level` | `'full' \| 'minimal'` | `'full'` | WAL granularity |
| `journaling.recovery` | `'auto' \| 'manual'` | `'auto'` | Compensating action execution on startup |

---

## Commerce & Purchases (`commerce`, `purchases`, `webhooks`)

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `commerce.ledger.mode` | `'atomic' \| 'background'` | `'atomic'` | Ledger mode for commerce transactions |
| `commerce.invoicing` | `'auto' \| 'manual'` | `'auto'` | Auto-generate PDF invoices on settlement |
| `purchases.type` | `'one-time' \| 'subscription' \| 'mixed'` | `'mixed'` | Purchase type model |
| `purchases.multiCurrency` | `boolean` | `true` | Accept multi-currency payments |
| `webhooks.secret` | `string` | Required | HMAC secret for provider signature verification |
| `webhooks.dedupTtl` | `string` | `'24h'` | Deduplication cache TTL for webhook event IDs |
| `webhooks.retryStrategy` | `'exponential' \| 'linear'` | `'exponential'` | Retry backoff strategy |
| `webhooks.signatureHeader` | `string` | `'x-intellibiz-sig'` | Signature header name |

---

## Finance (`finance`)

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `finance.baseCurrency` | `string` | `'USD'` | Base currency for the finance module |
| `finance.taxation.provider` | `string` | `'internal'` | Tax provider for `finance.calculateTotal()` |
| `finance.taxation.autoCalculate` | `boolean` | `true` | Auto-apply tax in total calculations |

---

## Identity & Auth (`auth`, `sessions`, `rbac`)

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `auth.provider` | `'internal'` | `'internal'` | Authentication provider |
| `auth.jwtSecret` | `string` | `process.env.JWT_SECRET` | JWT signing secret |
| `auth.algorithm` | `'HS256' \| 'RS256'` | `'HS256'` | JWT signing algorithm |
| `sessions.concurrentLimit` | `number` | `5` | Max simultaneous sessions per user |
| `sessions.mfa` | `'optional' \| 'required'` | `'optional'` | MFA requirement |
| `rbac.strictScopes` | `boolean` | `true` | Reject tokens with unrecognized scope claims |
| `rbac.inheritance` | `boolean` | `true` | Role hierarchy — admin inherits member permissions |

---

## Legal & Privacy (`license`, `privacy`, `signature`)

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `license.engine` | `'jwt' \| 'db'` | `'db'` | License key storage backend |
| `license.autoRenew` | `boolean` | `true` | Schedule renewal before expiry |
| `license.gracePeriod` | `string` | `'3d'` | Access window after expiry during renewal |
| `privacy.gdpr` | `boolean` | `true` | Enable GDPR-compliant deletion workflows |
| `privacy.autoPurge` | `string` | `'after-3-years'` | Automatic data purge schedule |
| `privacy.dataSubjectAccess` | `boolean` | `true` | Enable DSAR endpoints |
| `signature.requiredFor` | `string[]` | `['purchases']` | Actions requiring EULA signature |
| `signature.provider` | `'internal'` | `'internal'` | Signature storage provider |

---

## Governance & Overrides (`governance`, `overrides`)

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `governance.auditAll` | `boolean` | `true` | Record all state changes to the Rust ledger |
| `governance.allowSudo` | `boolean` | `false` | Permit `db.sudo()` — always creates audit entry |
| `governance.excludeSensitive` | `string[]` | `['password']` | Fields redacted from logs and ledger entries |
| `overrides.path` | `string` | `'./intellibiz'` | Directory for override files |
| `overrides.autoScaffold` | `boolean` | `true` | Auto-generate missing override files on dev start |
| `overrides.taxCalculation` | `boolean` | `false` | Enable custom tax logic |
| `overrides.shippingCalculator` | `boolean` | `false` | Enable custom shipping rates |
| `overrides.dbQueryLogic` | `boolean` | `false` | Enable custom query transforms |
| `overrides.invoiceTemplate` | `boolean` | `false` | Enable custom invoice format |
| `overrides.fraudDetection` | `boolean` | `false` | Enable custom fraud signals |

---

## Inventory & Warehousing (`inventory`, `warehousing`, `shipping`, `returns`)

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `inventory.mode` | `'strict' \| 'loose'` | `'strict'` | `strict` throws on negative stock |
| `inventory.lowStockThreshold` | `number` | `10` | Units before `stock.low` event fires |
| `warehousing.strategy` | `'FIFO' \| 'LIFO' \| 'nearest'` | `'FIFO'` | Stock commitment strategy |
| `warehousing.multiLocation` | `boolean` | `false` | Enable multi-warehouse routing |
| `shipping.carriers` | `string[]` | `['internal']` | Enabled shipping carriers |
| `shipping.calculation` | `'weight' \| 'flat'` | `'weight'` | Shipping rate calculation method |
| `returns.window` | `string` | `'30d'` | Return acceptance window |
| `returns.restockingFee` | `number` | `0` | Restocking fee percentage |

---

## Growth & Marketing (`growth`, `referrals`, `ab_testing`, `loyalty_program`)

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `growth.referrals` | `boolean` | `false` | Enable referral tracking |
| `growth.coupons` | `boolean` | `false` | Enable coupon engine |
| `referrals.commission` | `string` | `'10%'` | Default commission rate |
| `referrals.type` | `'credit' \| 'cash'` | `'credit'` | Commission payment type |
| `ab_testing.target` | `'session' \| 'user'` | `'session'` | A/B test assignment target |
| `loyalty_program.pointsPerDollar` | `number` | `1` | Points earned per USD spent |
| `loyalty_program.redemptionRate` | `number` | `0.01` | Point dollar value on redemption |

---

## Reporting & Versioning (`reporting`, `versioning`)

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `reporting.autoGenerate` | `string[]` | `['p&l']` | Auto-generated reports. Options: `'p&l'`, `'taxes'`, `'sales'` |
| `reporting.frequency` | `'daily' \| 'weekly' \| 'monthly'` | `'daily'` | Report generation schedule |
| `versioning.policy` | `'snapshot'` | `'snapshot'` | Snapshot policy for price/product history |
| `versioning.tables` | `string[]` | `['prices', 'products']` | Tables with snapshot versioning |

---

## Infrastructure (`eventBus`, `cache`, `governanceStore`)

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `eventBus.provider` | `'memory' \| 'redis' \| 'nats'` | `'memory'` | Event bus transport |
| `eventBus.maxRetries` | `number` | `3` | Max delivery retries before dead letter queue |
| `cache.provider` | `'memory' \| 'redis'` | `'memory'` | Cache backend |
| `cache.defaultTtl` | `string` | `'5m'` | Default cache entry TTL |
| `governanceStore.provider` | `'s3' \| 'postgres'` | `undefined` | Central ledger mirror for multi-node |
| `governanceStore.endpoint` | `string` | `undefined` | S3 bucket URL or Postgres connection string |

---

## Observability & Security (`metrics`, `health_check`, `rate_limiting`)

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `metrics.prometheus` | `boolean` | `false` | Expose `/metrics` Prometheus endpoint |
| `metrics.openTelemetry` | `boolean` | `false` | Enable OpenTelemetry trace export |
| `health_check.path` | `string` | `'/health'` | Health check endpoint path |
| `health_check.detailed` | `boolean` | `true` | Include subsystem status in health response |
| `rate_limiting.points` | `number` | `100` | Max requests per duration window |
| `rate_limiting.duration` | `string` | `'1m'` | Rate limit window |
| `bot_protection.captchaThreshold` | `number` | `0.5` | Bot score threshold for CAPTCHA |

---

## Developer Tools (`environment`, `dashboard`)

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `environment.dryRun` | `boolean` | `false` | Run logic without side effects — no payments, emails, or external API calls |
| `environment.trace` | `boolean` | `true` | Enable request trace logging |
| `dashboard.enabled` | `boolean` | `true` | Enable admin dashboard |
| `dashboard.path` | `string` | `'/admin-panel'` | Dashboard mount path |
| `dashboard.auth` | `'admin-only' \| 'none'` | `'admin-only'` | Dashboard access control |

---

## Dependency Rules

Flags that require other flags to be present. Violation throws `ConfigDependencyError` at boot:

| If you set | You must also have |
|-----------|-------------------|
| `ledger.sync: ['s3']` | `s3: { bucket, region }` config block |
| `governanceStore.provider: 's3'` | `s3: { bucket, region }` config block |
| `eventBus.provider: 'redis'` | `REDIS_URL` environment variable |
| `cache.provider: 'redis'` | `REDIS_URL` environment variable |
| `governance.allowSudo: true` | Governance warning emitted at boot |
| Commerce module active | `webhooks.secret` set |
| `tenancy.strategy: 'schema'` | PostgreSQL driver only |
