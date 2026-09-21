import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/analytics",
  fullyParallel: true,
  use: { baseURL: "http://127.0.0.1:4321", browserName: "chromium" },
  webServer: {
    command: "bun run dev --host 127.0.0.1",
    url: "http://127.0.0.1:4321/favicon.png",
    reuseExistingServer: !process.env.CI,
  },
});
