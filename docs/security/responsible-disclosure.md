# Responsible Disclosure Policy

Intellibiz takes security seriously. We appreciate the security research community's efforts to responsibly disclose vulnerabilities.

---

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Report vulnerabilities privately via **GitHub Security Advisories**:

1. Go to the Intellibiz repository on GitHub
2. Click **Security** → **Advisories** → **Report a vulnerability**
3. Fill in the vulnerability details

Alternatively, email the maintainer directly. Contact details are in `SECURITY.md`.

---

## What to Include

- A description of the vulnerability and its potential impact
- Step-by-step reproduction instructions
- The affected package(s) and version(s)
- Any proof-of-concept code (do not include working exploits)

---

## Response Timeline

| Milestone | Target |
|-----------|--------|
| Initial acknowledgement | Within 48 hours |
| Triage and severity assessment | Within 5 business days |
| Fix developed and tested | Within 30 days (critical: 7 days) |
| Patch released | Coordinated with reporter |
| Public disclosure | 90 days after initial report (or earlier if patch is released) |

---

## Severity Classification

| Severity | Examples |
|----------|---------|
| Critical | Cross-tenant data access, authentication bypass, payment manipulation |
| High | Information disclosure, privilege escalation, WAL tampering |
| Medium | Denial of service, rate limit bypass |
| Low | Minor information leakage, edge-case logic errors |

---

## Safe Harbor

Intellibiz will not pursue legal action against researchers who:

- Report vulnerabilities in good faith through this policy
- Do not access or modify data belonging to other users
- Do not disrupt production services
- Do not publicly disclose the vulnerability before a patch is released
