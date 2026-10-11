# @intellibiz/create-intellibiz

Scaffold a new [IntelliBiz](https://github.com/picklem0b/intellibiz) application.

Generates a project that actually runs — a validated config, typed actions and
an HTTP entry point — with no database or API keys required to start. Pick a
template, choose which engine modules to enable, and optionally add a test
suite, Postgres via Docker and a CI workflow.

## Usage

```bash
# npm
npm create @intellibiz/intellibiz@latest my-shop

# pnpm
pnpm create @intellibiz/intellibiz my-shop

# or run the generator directly
npx @intellibiz/create-intellibiz my-shop
```

Then:

```bash
cd my-shop
pnpm install
pnpm dev
```

```
GET  /        → service banner
GET  /health  → health probe with the request trace id
POST /greet   → a validated defineAction handler
```

```bash
curl -X POST localhost:3000/greet \
  -H 'content-type: application/json' \
  -d '{"name":"Ada","enthusiasm":3}'
```

Pass no options and the generator prompts: choose a template, tick the engine
modules and confirm the extras. Pass any option (or `--yes`) and it runs
non-interactively — handy in scripts and CI.

## Options

| Argument | Description |
| --- | --- |
| `<dir>` | Directory to create. Defaults to `my-intellibiz-app`. |
| `--template <name>` | `minimal`, `api` or `store`. Defaults to `store`. |
| `--modules <a,b,c>` | Engine modules to enable, e.g. `commerce,db`. |
| `--features <a,b,c>` | Extra features: `tests`, `docker`, `ci`. |
| `-y`, `--yes` | Accept the template defaults without prompting. |
| `-f`, `--force` | Write into a directory that already has files. |
| `-h`, `--help` | Show usage. |

The generator refuses to overwrite a non-empty directory unless `--force` is
passed.

## Templates

| Template | Modules | What it shows |
| --- | --- | --- |
| `minimal` | none | Health check and one typed action. |
| `api` | `db`, `identity` | A multi-tenant HTTP API with Postgres, tests and CI. |
| `store` | `commerce`, `finance`, `db`, `identity` | Orders, exact money math, a compensating charge transaction and an HMAC-verified webhook. |

```bash
# Scaffold with prompts
npx @intellibiz/create-intellibiz my-shop

# Or pick everything up front
npx @intellibiz/create-intellibiz my-shop --template=api --modules=db,identity

# Minimal, no prompts, no extras
npx @intellibiz/create-intellibiz my-service --template=minimal --yes
```

Individual options override the template, so `--template=store --modules=db`
gives you the store file layout with only the `db` module enabled.

## What you get

The `store` template (the default):

```
my-shop/
├── intellibiz.config.ts        # validated at boot — a typo stops the process
├── package.json
├── tsconfig.json
├── .env.example
├── docker-compose.yml          # local Postgres (with `docker`)
├── .github/workflows/ci.yml    # typecheck + test on push (with `ci`)
├── tests/
│   └── app.test.ts             # @intellibiz/testing (with `tests`)
└── src/
    ├── index.ts                # http routes + server
    ├── types.ts                # typed event registry
    ├── actions/
    │   ├── greet.ts            # a validated defineAction
    │   ├── quote.ts            # exact money math
    │   ├── whoami.ts           # the ambient tenant/user context
    │   └── create-order.ts     # a compensating charge + license transaction
    ├── payments/
    │   ├── dev-provider.ts     # in-memory provider, so it runs with no gateway
    │   └── register.ts
    └── webhooks/
        └── payment.ts          # HMAC-verified Stripe webhook
```

Smaller templates omit the parts you did not select. The config is checked
against the core schema at startup, so mistakes surface immediately rather than
as a runtime surprise. Action inputs are inferred from their Zod schemas, and
`action.log`, `action.emit` and `action.db` are available on every context.

## Requirements

- Node.js **22+**
- Any of npm, pnpm, yarn or bun

## Same templates as the CLI

The generator and `intellibiz init` share one template module in
`@intellibiz/cli`, so both paths produce an identical project. If you already
have the CLI:

```bash
npx intellibiz init my-shop
```

## Links

- [Documentation](https://github.com/picklem0b/intellibiz#readme)
- [Quick start](https://github.com/picklem0b/intellibiz/blob/main/docs/guides/getting-started.md)
- [Releasing guide](https://github.com/picklem0b/intellibiz/blob/main/docs/contributing/releasing.md)

## License

Apache-2.0
