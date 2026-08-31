# Intellibiz DSL — Formal Grammar Specification

**Version:** 1.0.0 | **Status:** Specification
**Supersedes:** `SYNTAX_AND_LIBRARIES.md` (syntax rules) and scattered RFC references

---

## 1. Overview

Intellibiz defines a **Domain-Specific Language (DSL)** embedded in TypeScript for expressing business logic, database queries, financial operations, and plugin composition. The DSL is not a separate language — it is a set of constrained TypeScript patterns enforced by the type system, Zod validation, and runtime guards.

This document specifies the grammar formally. Every valid Intellibiz program can be derived from the productions below. Deviations are type errors or runtime violations.

---

## 2. Lexical Conventions

### 2.1 Identifiers

| Category | Convention | Example |
|----------|-----------|---------|
| Files / directories | `kebab-case` | `define-action.ts`, `context/store.ts` |
| Classes / types / interfaces | `PascalCase` | `Money`, `RequestContext`, `TransactionState` |
| Functions / variables | `camelCase` | `getContext()`, `processCheckout` |
| Constants | `SCREAMING_SNAKE_CASE` | `DEFAULT_MAX_RETRIES`, `EU_VAT_BP` |
| Trace IDs | `ibiz_trc_{28 hex chars}` | `ibiz_trc_0192ab3d8f4c1e2d9a7b3c4d` |
| Event IDs | `ibiz_evt_{hex}{trace fragment}` | `ibiz_evt_6654abc0...` |
| Ledger entries | `ibiz_txn_{tenant}_{trace}_{ts}` | `ibiz_txn_org_abc_ibiz_trc_..._1710...` |

### 2.2 Import Hierarchy

```
import_path ::=
  | "'intellibiz'"                    // metapackage barrel (99% of app code)
  | "'intellibiz/" module_name "'"   // subpath (tree-shaking, microservices)
  | "'@intellibiz/" package "'"      // workspace (internal development only)

module_name ::= 'db' | 'finance' | 'commerce' | 'identity' | 'config' | 'http'
package     ::= 'core' | 'db' | 'finance' | 'commerce' | 'identity'
```

**Rule:** Named imports only. `import * as X` is forbidden (Rule #8 in The Never List).

### 2.3 String Literal Conventions

| Context | Format | Example |
|---------|--------|---------|
| Money amounts | String or number literal | `'19.99'`, `19.99` |
| Currency codes | Uppercase ISO-4217 | `'USD'`, `'JPY'`, `'BHD'` |
| Duration strings | `{N}{unit}` | `'30d'`, `'2h'`, `'15m'`, `'1y'` |
| Cron expressions | Standard 5-field | `'0 0 * * *'` |
| SQL tagged templates | Template literal | `` sql`SELECT * FROM users` `` |

---

## 3. Core Grammar Productions

### 3.1 Configuration Definition

```
config_definition ::=
  "export default" "defineConfig(" config_object ")"

config_object ::=
  "{" config_field ("," config_field)* "}"

config_field ::=
  "tenancy:" tenancy_schema
  | "finance:" finance_schema
  | "commerce:" commerce_schema
  | "ledger:" ledger_schema
  | "governance:" governance_schema
  | "auth:" auth_schema
  | "environment:" environment_schema
  | "eventBus:" eventbus_schema
  | "database:" database_schema
  | "plugins:" "[" plugin_list "]"
  | "overrides:" "{" override_entry ("," override_entry)* "}"

tenancy_schema ::=
  "{" "strategy:" ("'column'" | "'schema'")
    ("," "key:" string_literal)?
    ("," "type:" ("'uuid'" | "'string'"))?
    ("," "strict:" boolean_literal)?
    ("," "resolve:" function_literal)? "}"

finance_schema ::=
  "{" "baseCurrency:" string_3char
    ("," "rounding:" ("'bankers'" | "'half-up'" | "'truncate'"))?
    ("," "taxation:" taxation_subschema)?
    ("," "exchangeRates:" exchange_subschema)? "}"

commerce_schema ::=
  "{" ("," "ledger:" ledger_subschema)?
    ("," "invoicing:" ("'auto'" | "'manual'"))?
    ("," "webhookDedup:" webhook_subschema)? "}"

ledger_schema ::=
  "{" "mode:" ("'atomic'" | "'background'")
    ("," "sync:" "[" string_list "]")?
    ("," "retention:" duration_string)?
    ("," "signatureAlgorithm:" ("'ed25519'" | "'sha256'"))? "}"
```

### 3.2 Action Definition

```
action_definition ::=
  inline_action
  | schema_action

inline_action ::=
  "export const" identifier "= defineAction(" async_handler ")"

schema_action ::=
  "export const" identifier "= defineAction({"
    "input:" schema_reference ","
    "handler:" async_handler
    ("," "journal:" boolean_literal)?
  "})"

async_handler ::=
  "async (" context_param ") =>" statement_block

context_param ::=
  "action"                    // for defineAction
  | "req"                     // for HTTP handlers
  | "event"                   // for event listeners
  | "job"                     // for queue workers
  | "socket"                  // for WebSocket handlers
  | "task"                    // for cron schedulers
  | "app"                     // for plugin lifecycle hooks

statement_block ::=
  "{" statement* "}"

statement ::=
  expression_statement
  | variable_declaration
  | return_statement
  | throw_statement
  | if_statement
  | for_statement
  | await_expression
```

**Constraint:** The `context_param` identifier MUST match the trigger type. Using `ctx` is a compile-time style violation (The Never List, Rule #2).

### 3.3 SQL Tagged Template

```
sql_template ::=
  "await sql`" sql_body "`"

sql_body ::=
  sql_text (interpolation sql_text)*

interpolation ::=
  "${" expression "}"
  | "${" expression "." "fragment" "}"    // fragment composition

sql_fragment ::=
  "sql.fragment`" sql_body "`"

sql_join ::=
  "sql.join(" fragment_list "," separator ")"

fragment_list ::=
  "[" (sql_fragment ("," sql_fragment)*)? "]"

separator ::=
  sql_fragment                             // e.g. sql.fragment` AND `
```

**Transformation Rules:**

1. Each `${value}` in a `sql` template becomes `$N` (parameterized placeholder)
2. Fragments are inlined with param index offsets
3. SELECT queries automatically receive tenant injection: `WHERE org_id = '{tenantId}' AND deleted_at IS NULL`
4. If the query already contains `org_id`, injection is skipped
5. `db.sudo().sql` bypasses injection (writes `GOVERNANCE_SUDO_ACCESS` to ledger)
6. `db.raw(sql)` executes unmodified (writes `GOVERNANCE_RAW_QUERY` to ledger)

### 3.4 Money & Financial Operations

```
money_expression ::=
  "money(" amount "," currency ")"
  | "finance.money(" amount "," currency ")"

amount ::=
  numeric_literal                            // e.g. 19.99
  | string_literal                           // e.g. '19.99'

currency ::=
  string_3char                               // e.g. 'USD', 'JPY'

money_operation ::=
  money_expression "." arithmetic_method "(" factor ")"
  | money_expression "." comparison_method "(" money_expression ")"
  | money_expression "." allocation_method "(" ratio_list ")"
  | money_expression "." display_method "(" locale? ")"

arithmetic_method ::=
  "add" | "subtract" | "multiply"

comparison_method ::=
  "equals" | "greaterThan" | "lessThan" | "isZero" | "isNegative"

allocation_method ::=
  "allocate"

display_method ::=
  "amount"                                   // property, not method
  | "format"
  | "toString"
  | "toMinorUnits"
  | "toJSON"

factor ::=
  numeric_literal
  | string_literal

ratio_list ::=
  "[" numeric_literal ("," numeric_literal)* "]"

locale ::=
  string_literal                             // e.g. 'en-US', 'de-DE', 'ja-JP'
```

**Invariants:**

1. All arithmetic executes in Rust via `rust_decimal` (128-bit fixed-point) or `decimal.js` (TS fallback)
2. Floating-point `number` is forbidden for money values in business logic
3. Currency mismatch throws `CurrencyMismatchError`
4. Pro-rata allocation never loses a cent — remainder goes to first bucket

### 3.5 Event Bus

```
event_declaration ::=
  "declare module" module_name "{" "interface IntellibizEvents {" event_entries "}" "}"

event_entries ::=
  event_entry ("," event_entry)*

event_entry ::=
  string_literal ":" type_literal

event_emission ::=
  "await emit(" event_name "," payload ")"

event_subscription ::=
  "on(" event_name "," async_handler ("," options_object)?)"

options_object ::=
  "{" "maxRetries:" numeric_literal "}"
```

**Delivery Semantics:**

1. Synchronous fan-out to all listeners in the same process tick
2. Each listener that throws is retried with exponential backoff (base 1s, max 30s)
3. After max retries (default 3), event moves to the dead letter queue
4. The traceId from the active ALS context is forwarded automatically

### 3.6 Transaction Composition

```
transaction ::=
  "await commerce.transaction(" async_handler ")"

tx_operation ::=
  "tx.payments.charge(" charge_params ")"
  | "tx.payments.refund(" refund_params ")"
  | "tx.licenses.issue(" license_params ")"
  | "tx.licenses.grant(" license_params ")"
  | "tx.licenses.revoke(" revoke_params ")"
  | "tx.sql`" sql_body "`"

charge_params ::=
  "{" "amount:" money_expression
    "," "orderId:" string_or_variable
    "," "customerEmail:" string_or_variable
    ("," "paymentMethodId:" string_or_variable)? "}"

refund_params ::=
  "{" "paymentId:" string_or_variable
    ("," "amount:" money_expression)? "}"
```

**Saga Pattern:**

1. Each `tx.*` call registers its compensating action BEFORE execution
2. On failure, compensating actions run in LIFO (reverse) order
3. Transaction states: `PENDING` → `COMMITTED` | `ROLLED_BACK` | `MANUAL_REVIEW` | `PENDING_BANK_RECONCILIATION`

### 3.7 Plugin Definition

```
plugin_definition ::=
  "export default definePlugin(" plugin_object ")"

plugin_object ::=
  "{"
    "name:" string_literal ","
    "version:" string_literal ","
    ("description:" string_literal ",")?
    ("dependencies:" "[" dependency_list "]" ",")?
    ("services:" services_object ",")?
    ("hooks:" hooks_object ",")?
    ("configSchema:" schema_reference)?
  "}"

services_object ::=
  "{" service_entry ("," service_entry)* "}"

service_entry ::=
  string_literal ":" "(" deps_param ")" "=>" expression

hooks_object ::=
  "{"
    ("onInit:" async_handler ",")?
    ("onStart:" async_handler ",")?
    ("onStop:" async_handler)?
  "}"

dependency_list ::=
  string_literal ("," string_literal)*
```

**Sandboxing Rules:**

1. Plugin service keys are namespaced: `'{pluginName}.{serviceName}'`
2. A plugin can only access services it declared in `dependencies`
3. Circular dependencies between plugins are detected at boot and throw `PluginCircularDependencyError`
4. Plugin loading order: core services first, then plugins in `plugins` array order

### 3.8 Error Throwing

```
throw_statement ::=
  "throw" error_expression

error_expression ::=
  "new IntellibizError(" error_options ")"
  | domain_error_factory

error_options ::=
  "{"
    "code:" string_literal ","
    "message:" string_literal ","
    "status:" numeric_literal
    ("," "details:" object_literal)?
    ("," "cause:" expression)?
  "}"

domain_error_factory ::=
  module "." error_name "(" args? ")"

error_name ::=
  "SignatureRequiredError"                  // legal module → 403
  | "InsufficientFundsError"               // finance module → 422
  | "UnauthenticatedError"                 // identity module → 401
  | "ForbiddenError"                       // identity module → 403
  | "InsufficientStockError"               // inventory module → 422
```

**Mapping:** Domain errors carry `code` and `status` fields. The HTTP layer serializes them as:
```json
{ "error": "CART_EXPIRED", "message": "...", "status": 400, "details": { ... } }
```

### 3.9 Context Access Patterns

```
context_service_access ::=
  context_param "." service_name

service_name ::=
  "db" | "log" | "ledger" | "cache" | "money" | "tax" | "auth" | "config"
  | "emit"                                   // method
  | trace_accessor
  | identity_accessor
  | http_accessor

trace_accessor ::=
  "traceId" | "tenantId" | "userId" | "role" | "startTime" | "origin"

identity_accessor ::=
  "getActiveUser" | "getActiveTenant" | "can" | "canAll" | "canAny"

http_accessor ::=
  "body" | "headers" | "params" | "query" | "ip" | "method" | "url"
  | "status" | "header"
```

---

## 4. The Never List (Grammar Violations)

| # | Violation | Grammar Rule |
|---|-----------|-------------|
| 1 | `number` or `float` for money | §3.4 — must use `money()` |
| 2 | Context param named `ctx` | §3.2 — must use trigger-specific name |
| 3 | `res.send()` or `res.json()` | §3.2 — handlers return values directly |
| 4 | String concatenation in SQL | §3.3 — must use `` sql`...` `` |
| 5 | Unfiltered cross-tenant queries | §3.3 — requires `db.sudo()` |
| 6 | Prisma or TypeORM | §3.3 — use `sql` + Kysely |
| 7 | Hardcoded secrets | §3.1 — use `process.env` |
| 8 | `import * as X` | §2.2 — named imports only |
| 9 | Default exports in library code | §3.2 — named exports (except config/plugins) |
| 10 | Blocking event loop with CPU work | §3.6 — NAPI-RS async workers |

---

## 5. Type Augmentation Protocol

Packages extend the core type surface via TypeScript module augmentation:

```
type_augmentation ::=
  "declare module" module_name "{"
    "interface" extension_target "{" members "}"
  "}"

extension_target ::=
  "SharedServices"                          // adds services to all contexts
  | "IntellibizEvents"                      // adds typed event keys
```

**Example:**
```typescript
// packages/commerce/src/types.ts
declare module '@intellibiz/core' {
  interface SharedServices {
    payments: PaymentService
    subscriptions: SubscriptionService
  }
}
```

This makes `req.payments` and `action.payments` fully autocompleted in the IDE without manual imports.

---

## 6. Runtime Execution Pipeline

```
INBOUND TRIGGER (HTTP / Queue / Event / Cron / WebSocket)
    │
    ▼
KERNEL: Generate traceId, resolve tenantId & userId from JWT/headers
    │
    ▼
KERNEL: Create specialized context (req / action / event / job / task / socket)
    │
    ▼
KERNEL: Run handler inside AsyncLocalStorage
    │
    ├──► SQL queries → Query Planner injects tenant filters
    ├──► Money operations → Rust decimal engine (NAPI-RS)
    ├──► Ledger writes → WAL journal with SHA-256 block chaining
    ├──► Event emissions → Fan-out with retry + dead letter queue
    └──► Transaction steps → Compensating action registration
    │
    ▼
RESPONSE: Return value → HTTP 200 JSON / 204 / error status
    │
    ▼
LEDGER: WAL block flushed and signed to disk
```

---

## 7. Formal Grammar Summary (EBNF)

```ebnf
(* Intellibiz DSL - EBNF Grammar *)

program              = config_definition | action_definition | plugin_definition ;

(* Configuration *)
config_definition    = "export default" "defineConfig" "(" config_object ")" ;
config_object        = "{" config_field { "," config_field } "}" ;
config_field         = "tenancy:" tenancy_schema
                     | "finance:" finance_schema
                     | "commerce:" commerce_schema
                     | "ledger:" ledger_schema
                     | "governance:" governance_schema
                     | "auth:" auth_schema
                     | "database:" database_schema
                     | "environment:" environment_schema
                     | "plugins:" "[" plugin_list "]"
                     | "overrides:" "{" override_entry { "," override_entry } "}" ;

(* Actions *)
action_definition    = "export const" IDENTIFIER "=" "defineAction" "(" handler ")" ;
handler              = async_function | action_object ;
action_object        = "{" "input:" schema "," "handler:" async_function
                     { "," "journal:" BOOLEAN } "}" ;
async_function       = "async" "(" context_param ")" "=>" block ;
context_param        = "req" | "action" | "event" | "job" | "socket" | "task" | "app" ;

(* SQL *)
sql_tag              = "sql" BACKTICK sql_body BACKTICK ;
sql_body             = SQL_TEXT { interpolation SQL_TEXT } ;
interpolation        = "${" expression "}" ;
sql_fragment         = "sql.fragment" BACKTICK sql_body BACKTICK ;
sql_join             = "sql.join" "(" fragment_list "," sql_fragment ")" ;

(* Money *)
money_expression     = "money" "(" amount "," currency ")" ;
amount               = NUMBER | STRING ;
currency             = STRING_3CHAR ;
money_method         = "add" | "subtract" | "multiply" | "allocate"
                     | "equals" | "greaterThan" | "lessThan"
                     | "format" | "toMinorUnits" ;

(* Events *)
emit_statement       = "await" "emit" "(" STRING "," payload ")" ;
on_statement         = "on" "(" STRING "," async_function
                     { "," options } ")" ;

(* Transactions *)
transaction          = "await" "commerce.transaction" "(" async_function ")" ;
tx_call              = "tx" "." module "." method "(" params ")" ;

(* Plugins *)
plugin_definition    = "export default" "definePlugin" "(" plugin_object ")" ;
plugin_object        = "{" "name:" STRING "," "version:" STRING
                     { "," "dependencies:" "[" dep_list "]" }
                     { "," "services:" services_obj }
                     { "," "hooks:" hooks_obj }
                     { "," "configSchema:" schema } "}" ;

(* Errors *)
throw_statement      = "throw" ( "new" error_class "(" error_opts ")"
                     | domain_error "(" args ")" ) ;
error_class          = "IntellibizError" ;
domain_error         = MODULE "." ERROR_NAME ;
```

---

*End of Grammar Specification — Version 1.0.0*
