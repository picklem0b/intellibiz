# ADR-003: Apache License 2.0

**Status:** Accepted
**Date:** 2025
**Deciders:** chapter2

---

## Context

Intellibiz targets enterprise adoption. The license must be permissive enough for commercial use while providing protections that matter to enterprise legal teams.

---

## Decision

Intellibiz is licensed under **Apache License 2.0**.

---

## Evaluation

**MIT** was the initial choice. It was changed to Apache 2.0 because:
- MIT provides no explicit patent grant. Enterprise legal teams are increasingly concerned about patent risk when adopting open-source dependencies.
- Apache 2.0 includes an explicit patent license from every contributor to every downstream user.
- Apache 2.0 is OSI-approved, widely understood, and accepted by enterprise procurement processes.
- It remains permissive — commercial use, modification, and distribution are all permitted.

**GPL / LGPL** was rejected because copyleft licensing would prevent proprietary use of Intellibiz as a dependency — directly contradicting the goal of enterprise adoption.

---

## Consequences

- All contributors implicitly grant a patent license to downstream users.
- Downstream users who file patent claims against Intellibiz lose their patent license automatically.
- The `NOTICE` file must be preserved in derivative works.
