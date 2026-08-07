# Upgrade Policy

This document defines how Intellibiz handles versioning, breaking changes, deprecations, and long-term support.

---

## Versioning

Intellibiz follows [Semantic Versioning](https://semver.org/) strictly:

| Version | When |
|---------|------|
| `PATCH` (0.0.x) | Bug fixes, security patches, documentation corrections — no API changes |
| `MINOR` (0.x.0) | New features, new packages, new flags — fully backward compatible |
| `MAJOR` (x.0.0) | Breaking API changes — migration guide provided |

---

## Breaking Change Definition

A breaking change is any change that requires existing application code to be modified to continue working:

- Renaming or removing a public function, class, or type
- Changing a function's parameter types or return type
- Changing a flag's type, name, or valid values in `intellibiz.config.ts`
- Removing a package or moving its exports to a different location
- Changing context property names or shared service APIs

Breaking changes never appear in `MINOR` or `PATCH` releases.

---

## Deprecation Policy

Before removing or changing a public API:

1. The deprecated API is marked with a `@deprecated` JSDoc comment in the next `MINOR` release
2. A `DeprecationWarning` is logged at runtime when the deprecated API is used
3. The deprecation is documented in `CHANGELOG.md` with the target removal version
4. The API is removed in the next `MAJOR` release — at minimum one `MINOR` release after deprecation

Deprecation windows are at minimum 3 months before removal.

---

## Long-Term Support (LTS)

| Branch | Support Type | Duration |
|--------|-------------|---------|
| `main` (latest `MAJOR`) | Active development | Until next `MAJOR` |
| `v1.x` | LTS — security patches and critical bug fixes only | 18 months after `v2.0.0` release |
| Older branches | End of life — no patches | — |

LTS branches receive:
- Security vulnerability patches
- Critical bug fixes that cause data loss or incorrect financial calculations
- No new features, no API changes

---

## Release Cadence

- `PATCH` releases: as needed for security and critical bugs
- `MINOR` releases: approximately every 6–8 weeks
- `MAJOR` releases: no fixed cadence — only when breaking changes accumulate sufficient value

---

## Pre-Release Versions

`alpha` and `beta` releases (`v1.0.0-alpha.1`, `v1.0.0-beta.2`) are used for major changes before stabilization. Pre-release versions may have breaking changes between them without a `MAJOR` bump.
