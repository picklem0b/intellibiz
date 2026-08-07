# ADR-002: Kysely Over Prisma and Drizzle

**Status:** Accepted
**Date:** 2025
**Deciders:** chapter2

---

## Context

Intellibiz requires a database query layer that can be intercepted at the AST level to inject tenancy filters, soft-delete clauses, and permission scope guards — automatically, without developer involvement.

Three options were evaluated: Prisma, Drizzle, and Kysely.

---

## Decision

**Kysely** is the database query builder for Intellibiz.

---

## Evaluation

**Prisma** was rejected because:
- The generated client is opaque — its internal query construction cannot be intercepted at the AST level.
- It ships a query engine binary (~50MB) that adds significant install weight.
- Schema-first workflow is too rigid for the override and plugin system Intellibiz requires.

**Drizzle** was considered but rejected because:
- AST interception is possible but requires deeper integration work than Kysely.
- The plugin ecosystem for Drizzle is less mature.
- Kysely's query builder API is more amenable to proxy-based wrapping.

**Kysely** was chosen because:
- It is a pure TypeScript query builder with a fully inspectable and interceptable AST.
- Tenancy and soft-delete injection can be applied as a transformation step before SQL compilation.
- It has no runtime binary, no schema generation step, and no code generation.
- It supports PostgreSQL, MySQL, and SQLite dialects via swappable adapters.

---

## Consequences

- The Rust Query Planner receives Kysely AST objects and transforms them before SQL compilation.
- Developers write `sql` tagged templates or Kysely's fluent API — both are intercepted by the same planner.
- Raw SQL via `db.raw()` bypasses the planner entirely and is recorded as a governance warning.
