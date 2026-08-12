import { spawnSync } from "node:child_process";

const result = spawnSync("npx", ["buf", "generate"], {
  stdio: "inherit",
  shell: true,
});

process.exit(result.status ?? 1);
