import { Breadcrumbs } from "@/components/breadcrumbs";
import { Pagination } from "@/components/pagination";
import { CodeBlock, Callout } from "@/components/code-block";

export default function PluginsPage() {
  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Plugins & Extensions" },
          { label: "Plugin System" },
        ]}
      />

      <h1 className="text-3xl font-bold tracking-tight">Plugin System</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Extend IntelliBiz with new providers, services, and event listeners
        without modifying core packages.
      </p>

      <h2 className="mt-10 text-2xl font-bold tracking-tight">
        Defining a Plugin
      </h2>

      <CodeBlock
        code={`import { definePlugin } from 'intellibiz'
import { z } from 'zod'

export default definePlugin({
  name: 'razorpay-payment',
  version: '1.0.0',

  // What this plugin needs from the DI container
  dependencies: ['config', 'log', 'ledger'],

  // What this plugin contributes
  services: {
    'payment.provider': (deps) => new RazorpayProvider(deps.config),
  },

  // Lifecycle hooks
  hooks: {
    onInit: async (app) => {
      app.log.info('Razorpay plugin initialized')
    },
    onStop: async (app) => {
      await app.get('razorpay-payment.payment.provider').disconnect()
    },
  },

  // Config schema extension
  configSchema: z.object({
    razorpay: z.object({
      keyId: z.string(),
      keySecret: z.string(),
    }),
  }),
})`}
        language="typescript"
        filename="src/plugins/razorpay.ts"
        showLineNumbers
      />

      <h2 className="mt-10 text-2xl font-bold tracking-tight">
        Registering Plugins
      </h2>

      <CodeBlock
        code={`import { defineConfig } from 'intellibiz/config'
import razorpay from './src/plugins/razorpay'

export default defineConfig({
  plugins: [razorpay],
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID!,
    keySecret: process.env.RAZORPAY_KEY_SECRET!,
  },
})`}
        language="typescript"
        filename="intellibiz.config.ts"
      />

      <h2 className="mt-10 text-2xl font-bold tracking-tight">
        Sandboxing Rules
      </h2>
      <ul className="mt-4 space-y-2 text-muted-foreground">
        <li>Plugin service keys are namespaced: <code>&apos;{`{pluginName}.{serviceName}`}&apos;</code></li>
        <li>A plugin can only access services it declared in <code>dependencies</code></li>
        <li>Circular dependencies between plugins are detected at boot</li>
        <li>Plugin loading order: core services first, then plugins in array order</li>
      </ul>

      <Callout type="info">
        Official plugins are available as separate packages in the{" "}
        <code>plugins/</code> directory. See the{" "}
        <a href="/docs/plugins/official" className="text-brand-600 dark:text-brand-400 underline">
          Official Plugins
        </a>{" "}
        page for the full list.
      </Callout>

      <Pagination
        prev={{ title: "Developer Tools", href: "/docs/dev-tools" }}
        next={{ title: "Building Plugins", href: "/docs/plugins/building" }}
      />
    </>
  );
}
