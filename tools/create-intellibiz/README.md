# @intellibiz/create-intellibiz

Scaffold a new [IntelliBiz](https://github.com/picklem0b/intellibiz) application.

Generates a small project that actually runs — a validated config, a typed
action and an HTTP entry point — with no database or API keys required to start.

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

## Options

| Argument | Description |
| --- | --- |
| `<dir>` | Directory to create. Defaults to `my-intellibiz-app`. |
| `--force`, `-f` | Write into a directory that already has files. |

The generator refuses to overwrite a non-empty directory unless `--force` is
passed.

## What you get

```
my-shop/
├── intellibiz.config.ts   # validated at boot — a typo stops the process
├── package.json
├── tsconfig.json
├── .env.example
└── src/
    ├── index.ts           # http routes + server
    └── actions/
        └── greet.ts       # defineAction with a Zod input schema
```

The config is checked against the core schema at startup, so mistakes surface
immediately rather than as a runtime surprise. The action's `action.data` is
fully inferred from its Zod schema, and `action.log`, `action.emit` and
`action.db` are available on the context.

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
