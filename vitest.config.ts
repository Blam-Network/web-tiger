import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // Published blf ESM has directory imports; Nest uses CJS which is fine.
      "@blamnetwork/blf": path.join(
        root,
        "node_modules/@blamnetwork/blf/dist-cjs/index.js"
      ),
      // Published cstruct ESM omits .js extensions; use CJS for vitest.
      "@craftycodie/cstruct": path.join(
        root,
        "node_modules/@craftycodie/cstruct/dist-cjs/index.js"
      ),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
