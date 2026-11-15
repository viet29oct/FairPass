import { defineConfig } from "@playwright/test";

/**
 * E2E FairPass — chạy trên chain local thật + backend + Vite dev server.
 * Yêu cầu đã chạy: `npx hardhat node`, deploy + seed, backend (`npm run dev`), frontend (`npm run dev`).
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 8 * 60_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "e2e/report" }]],
  outputDir: "e2e/test-results",
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:5173",
    channel: "chrome", // dùng Chrome cài sẵn trên máy
    headless: process.env.HEADED ? false : true,
    viewport: { width: 1366, height: 860 },
    locale: "vi-VN",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    actionTimeout: 20_000,
  },
});
