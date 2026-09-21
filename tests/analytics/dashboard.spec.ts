import { test, expect, type Page } from "@playwright/test";

function result(views = 123, stale = false, refresh_error: string | null = null) {
  return { results: [{ slug: "dashboard", data: {
    metadata: { export_date: "2026-09-21T07:00:00Z", source: "test" },
    timeseries: [{ date: "2026-09-20T00:00:00Z", pageviews: views, visitors: 42, bounce_rate: 0 }],
    stats: { path: [], device_type: [], referrer: [], os_name: [], country: [] },
  }, error: null, cache: { stale, refreshing: false, refresh_error, retry_after: 0 } }] };
}

async function projects(page: Page) {
  await page.route("**/projects/stats/api/v1/projects", route => route.fulfill({ json: { projects: [{ slug: "dashboard", name: "tashif.codes" }, { slug: "blog", name: "Blog" }], total: 2 } }));
}

test("initial skeleton and slow message", async ({ page }) => {
  await projects(page);
  let finish!: () => void;
  const waiting = new Promise<void>(resolve => { finish = resolve; });
  await page.route("**/projects/stats/api/v1/stats?**", async route => { await waiting; await route.fulfill({ json: result() }); });
  await page.goto("/projects/stats?project=dashboard");
  await expect(page.getByLabel("Loading analytics charts")).toBeVisible();
  await expect(page.getByText("Fetching historical data. This is taking longer than usual.")).toBeVisible({ timeout: 10000 });
  finish();
  await expect(page.getByText("123", { exact: true })).toBeVisible();
});

test("stale snapshot appears before background refresh finishes", async ({ page }) => {
  await projects(page);
  let finish!: () => void;
  const waiting = new Promise<void>(resolve => { finish = resolve; });
  await page.route("**/projects/stats/api/v1/stats?**", async route => {
    if (new URL(route.request().url()).searchParams.has("refresh")) { await waiting; await route.fulfill({ json: result(456) }); }
    else await route.fulfill({ json: result(123, true) });
  });
  await page.goto("/projects/stats?project=dashboard");
  await expect(page.getByText("123", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Updating stats");
  await expect(page.getByLabel("Loading analytics charts")).toHaveCount(0);
  finish();
  await expect(page.getByText("456", { exact: true })).toBeVisible();
});

test("failed refresh preserves chart and original update time", async ({ page }) => {
  await projects(page);
  await page.route("**/projects/stats/api/v1/stats?**", route => route.fulfill({ json: new URL(route.request().url()).searchParams.has("refresh") ? result(123, true, "Analytics refresh failed. Try again shortly.") : result() }));
  await page.goto("/projects/stats?project=dashboard");
  await expect(page.getByText("123", { exact: true })).toBeVisible();
  const timestamp = await page.locator("time[datetime]").last().getAttribute("datetime");
  await page.getByRole("button", { name: "Refresh stats" }).click();
  await expect(page.getByRole("status")).toContainText("Analytics refresh failed");
  await expect(page.getByText("123", { exact: true })).toBeVisible();
  await expect(page.locator("time[datetime]").last()).toHaveAttribute("datetime", timestamp!);
});

test("period change keeps old data honestly labelled", async ({ page }) => {
  await projects(page);
  let finish!: () => void;
  const waiting = new Promise<void>(resolve => { finish = resolve; });
  await page.route("**/projects/stats/api/v1/stats?**", async route => {
    if (new URL(route.request().url()).searchParams.get("days") === "7") { await waiting; await route.fulfill({ json: result(7) }); }
    else await route.fulfill({ json: result() });
  });
  await page.goto("/projects/stats?project=dashboard");
  await expect(page.getByText("123", { exact: true })).toBeVisible();
  await page.getByRole("combobox").nth(1).click();
  await page.getByRole("option", { name: "Last 7 days", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Showing tashif.codes, lifetime");
  await expect(page.getByText("123", { exact: true })).toBeVisible();
  finish();
  await expect(page.locator("div.tabular-nums").filter({ hasText: /^7$/ })).toBeVisible();
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("cold 504 offers a working retry", async ({ page }) => {
  await projects(page);
  let failed = false;
  await page.route("**/projects/stats/api/v1/stats?**", route => {
    if (!failed) { failed = true; return route.fulfill({ status: 504, body: "timeout" }); }
    return route.fulfill({ json: result() });
  });
  await page.goto("/projects/stats?project=dashboard");
  await expect(page.getByText("Analytics took too long to respond. Try again.")).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("123", { exact: true })).toBeVisible();
});

test("mobile layout fits the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await projects(page);
  await page.route("**/projects/stats/api/v1/stats?**", route => route.fulfill({ json: result() }));
  await page.goto("/projects/stats?project=dashboard");
  await expect(page.getByText("123", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("a refresh owned by another visitor is polled without duplicate refreshes", async ({ page }) => {
  await projects(page);
  let calls = 0;
  await page.route("**/projects/stats/api/v1/stats?**", route => {
    expect(new URL(route.request().url()).searchParams.has("refresh")).toBe(false);
    const payload = result(++calls === 1 ? 123 : 456, calls === 1);
    payload.results[0].cache.refreshing = calls === 1;
    return route.fulfill({ json: payload });
  });
  await page.goto("/projects/stats?project=dashboard");
  await expect(page.getByText("123", { exact: true })).toBeVisible();
  await expect(page.getByText("456", { exact: true })).toBeVisible({ timeout: 10000 });
  expect(calls).toBe(2);
});

test("switching projects ignores the previous project's late refresh", async ({ page }) => {
  await projects(page);
  let finish!: () => void;
  const waiting = new Promise<void>(resolve => { finish = resolve; });
  await page.route("**/projects/stats/api/v1/stats?**", async route => {
    const query = new URL(route.request().url()).searchParams;
    if (query.get("slugs") === "blog") return route.fulfill({ json: result(789) });
    if (query.has("refresh")) { await waiting; await route.fulfill({ json: result(456) }); }
    else await route.fulfill({ json: result(123, true) });
  });
  await page.goto("/projects/stats?project=dashboard");
  await expect(page.getByText("123", { exact: true })).toBeVisible();
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Blog", exact: true }).click();
  await expect(page.getByText("789", { exact: true })).toBeVisible();
  finish();
  await expect(page.getByText("456", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Refresh stats" })).toBeEnabled();
});
