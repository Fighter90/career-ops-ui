import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { appendFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { _electron as electron, expect } from "@playwright/test";

const ui = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporary = await mkdtemp(path.join(tmpdir(), "porch-ui-acceptance-"));
const evidence = path.join(ui, "test-results");
await mkdir(evidence, { recursive: true });
const worker = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });
let observer;
let app;
const runtimeErrors = [];
const brandedExecutable =
  process.platform === "darwin"
    ? execFileSync(
        "python3",
        [
          "-c",
          "from pathlib import Path; from ui.mac_app import executable; print(executable(Path('ui').resolve()))",
        ],
        {
          cwd: path.join(ui, ".."),
          env: { ...process.env, PYTHONPATH: path.join(ui, "..", "scripts", "lib") },
          encoding: "utf8",
        },
      ).trim()
    : undefined;

async function startObserver(args = [], env = {}) {
  observer = spawn(
    "python3",
    ["-m", "ui", "--registry-root", path.join(temporary, "registry"), ...args],
    {
      env: { ...process.env, ...env, PYTHONPATH: path.join(ui, "..", "scripts", "lib") },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => reject(new Error(`Observer did not start: ${stderr}`)), 10_000);
    observer.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    observer.stdout.on("data", (chunk) => {
      stdout += chunk;
      const match = stdout.match(/Porch UI: (http:\/\/[^\s]+)/);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
    observer.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Observer exited ${code}: ${stderr}`));
    });
  });
}

async function openWindow(url) {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  if (process.platform === "darwin") env.PORCH_UI_DISPLAY = "internal";
  app = await electron.launch({
    ...(brandedExecutable ? { executablePath: brandedExecutable } : {}),
    args: [
      path.join(ui, "electron", "main.cjs"),
      url,
      `--user-data-dir=${path.join(temporary, "electron")}`,
    ],
    env,
  });
  const page = await app.firstWindow();
  if (process.platform === "darwin") {
    const onLaptop = await app.evaluate(({ BrowserWindow, screen }) => {
      const internal = screen
        .getAllDisplays()
        .find((display) => /built-in|retina|internal|macbook/i.test(display.label));
      const bounds = BrowserWindow.getAllWindows()[0].getBounds();
      return (
        !!internal &&
        bounds.x >= internal.workArea.x &&
        bounds.x + bounds.width <= internal.workArea.x + internal.workArea.width &&
        bounds.y >= internal.workArea.y &&
        bounds.y + bounds.height <= internal.workArea.y + internal.workArea.height
      );
    });
    assert.equal(onLaptop, true, "Porch acceptance window must be on the laptop display");
  }
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /Content Security Policy|React error|Base UI/.test(message.text())
    )
      runtimeErrors.push(message.text());
  });
  await expect(page.getByRole("status")).toContainText("Connected");
  assert.equal(await page.title(), "Porch — Runs");
  assert.equal(await app.evaluate(({ app }) => app.getName()), "Porch");
  assert.match(
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getTitle()),
    /^Porch/,
  );
  assert.match(await page.evaluate(() => document.title), /^Porch/);
  return page;
}

try {
  const fixture = JSON.parse(
    execFileSync("python3", [path.join(ui, "tests", "fixture.py"), temporary, String(worker.pid)], {
      encoding: "utf8",
    }),
  );
  const metadataPath = path.join(temporary, "registry", "runs", fixture.run_id, "meta.json");
  const metadataBefore = await readFile(metadataPath, "utf8");
  const url = await startObserver();
  let page = await openWindow(url);
  await page.getByRole("button", { name: /inspect streaming/ }).click();
  await expect(page.locator(".run-row.selected .turn-count")).toContainText("4 turns");
  await page.getByText("Run information").click();
  await expect(page.getByText("thread-fixture-codex", { exact: true })).toBeVisible();
  await expect(page.locator(".run-info dd").filter({ hasText: /^4$/ })).toBeVisible();
  await page.getByRole("searchbox", { name: "Search runs" }).fill("thread-fixture-codex");
  await expect(page.locator(".run-row")).toHaveCount(1);
  await page.getByRole("searchbox", { name: "Search runs" }).fill("");
  await expect(page.locator(".answer-text")).toContainText("runtime remains the source of truth");
  // Launcher is independent from the executor: Claude launched the Codex worker.
  const claudeGroup = page
    .locator(".run-group")
    .filter({ has: page.locator("summary", { hasText: /^Claude/ }) });
  await expect(claudeGroup.getByRole("button", { name: /inspect streaming/ })).toBeVisible();
  await claudeGroup.locator("summary").click();
  await expect(claudeGroup.getByRole("button", { name: /inspect streaming/ })).toBeHidden();
  await claudeGroup.locator("summary").click();
  await expect(page.locator(".run-group > summary")).toHaveCount(3);
  await page.getByLabel("Theme", { exact: true }).selectOption("light");
  await page.screenshot({ path: path.join(evidence, "dashboard-light.png") });
  await page.getByLabel("Theme", { exact: true }).selectOption("dark");
  await expect
    .poll(() =>
      page.locator(".run-row.selected").evaluate((row) => getComputedStyle(row).backgroundColor),
    )
    .toBe("rgb(25, 28, 25)");
  await page.screenshot({ path: path.join(evidence, "dashboard-dark.png") });
  assert.equal(
    await page.locator("body").evaluate((e) => getComputedStyle(e).backgroundColor),
    "rgb(21, 23, 21)",
  );

  // Searchable dropdowns, keyboard selection and combined filtering.
  await page.locator(".filter-trigger").nth(0).click();
  await page.getByRole("combobox", { name: "Search launched by" }).fill("Claude");
  await expect(page.locator(".filter-popup").getByRole("option")).toHaveCount(1);
  await page.getByRole("combobox", { name: "Search launched by" }).press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.locator(".run-row")).toHaveCount(4);
  await page.locator(".filter-trigger").nth(1).click();
  await page.getByRole("combobox", { name: "Search executor" }).fill("cod");
  await page.locator(".filter-popup").getByRole("option", { name: "codex", exact: true }).click();
  await expect(page.locator(".run-row")).toHaveCount(1);
  await page.locator(".filter-trigger").nth(2).click();
  await expect(
    page
      .locator(".filter-popup")
      .getByRole("option", { name: "/projects/another/porch", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: path.join(evidence, "filters-dark.png") });
  await page.getByRole("combobox", { name: "Search project" }).fill("no-such-project");
  await expect(page.getByText("No matches.", { exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Search project" }).fill("another");
  await page
    .locator(".filter-popup")
    .getByRole("option", { name: "/projects/another/porch", exact: true })
    .click();
  await expect(page.getByText("No matching runs.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await expect(page.locator(".run-row")).toHaveCount(6);
  await page.getByLabel("Theme", { exact: true }).selectOption("light");
  const projectTrigger = page.locator(".filter-trigger").nth(2);
  await projectTrigger.focus();
  await projectTrigger.press("Enter");
  await page.screenshot({ path: path.join(evidence, "filters-light.png") });
  await page.keyboard.press("Escape");
  await expect(projectTrigger).toBeFocused();
  await page.getByLabel("Theme", { exact: true }).selectOption("system");
  await page.emulateMedia({ colorScheme: "dark" });
  assert.equal(
    await page.locator("body").evaluate((e) => getComputedStyle(e).backgroundColor),
    "rgb(21, 23, 21)",
  );
  await page.emulateMedia({ colorScheme: "light" });
  assert.equal(
    await page.locator("body").evaluate((e) => getComputedStyle(e).backgroundColor),
    "rgb(250, 250, 248)",
  );
  await page.getByLabel("Theme", { exact: true }).selectOption("dark");
  await page.reload();
  await expect(page.getByLabel("Theme", { exact: true })).toHaveValue("dark");
  await page.getByRole("button", { name: /inspect streaming/ }).click();

  // Actual append, not a mocked HTTP response.
  await appendFile(
    fixture.journal,
    `${JSON.stringify({ type: "answer_delta", data: "\nLive update: Привет, 世界." })}\n`,
  );
  await expect(page.locator(".answer-text")).toContainText("Live update: Привет, 世界.");
  assert.equal(await page.getByText("Live update: Привет, 世界.", { exact: false }).count(), 1);

  // Text from a worker cannot create elements, execute scripts, or fetch resources.
  await appendFile(
    fixture.journal,
    `${JSON.stringify({ type: "answer_delta", data: "\n<img src=x onerror=alert(1)>", raw: { private: "not-in-export" } })}\n`,
  );
  await expect(page.locator(".answer-text")).toContainText("<img src=x onerror=alert(1)>");
  assert.equal(await page.locator(".timeline img").count(), 0);
  const exported = path.join(temporary, "output.jsonl");
  await app.evaluate(({ session }, file) => {
    session.defaultSession.once("will-download", (_event, item) => item.setSavePath(file));
  }, exported);
  await page.getByRole("button", { name: "Save output" }).click();
  await expect
    .poll(async () => {
      try {
        return await readFile(exported, "utf8");
      } catch {
        return "";
      }
    })
    .toContain("Live update: Привет, 世界.");
  assert.equal((await readFile(exported, "utf8")).includes("not-in-export"), false);

  // Switching selection must abort old reads and keep authoritative final separate.
  await page.getByRole("button", { name: /review event contract/ }).click();
  await page.getByRole("button", { name: "Final answer" }).click();
  await expect(page.locator(".final-answer")).toContainText("The event contract is consistent.");
  await page.getByRole("button", { name: /^Errors/ }).click();
  await expect(page.locator(".run-row")).toHaveCount(2);
  await expect(page.locator(".run-row").filter({ hasText: "old supervisor" })).toContainText(
    "Supervisor stopped",
  );
  await page.getByRole("button", { name: /^All \d/ }).click();
  await page.getByLabel("Search runs", { exact: true }).fill("inspect-streaming");
  await expect(page.locator(".run-row")).toHaveCount(1);
  await page.getByLabel("Search runs", { exact: true }).fill("");
  await page.getByRole("button", { name: /inspect streaming/ }).click();

  // A burst grows the real scroll surface; scrolling up pauses following.
  const burst = Array.from({ length: 35 }, (_, n) =>
    JSON.stringify({ type: "progress", data: `Checkpoint ${n}: inspecting output continuity.` }),
  ).join("\n");
  await appendFile(fixture.journal, `${burst}\n`);
  await expect(page.locator(".timeline")).toContainText("Checkpoint 34");
  await page.locator(".output-scroll").evaluate((element) => {
    element.scrollTop = 0;
  });
  await expect(page.getByRole("button", { name: "Jump to latest" })).toBeVisible();
  await appendFile(
    fixture.journal,
    `${JSON.stringify({ type: "answer_delta", data: "Arrived while reading earlier output." })}\n`,
  );
  await expect(page.locator(".timeline")).toContainText("Arrived while reading earlier output.");
  assert.equal(await page.locator(".output-scroll").evaluate((element) => element.scrollTop), 0);
  await page.getByRole("button", { name: "Jump to latest" }).click();
  await expect
    .poll(() =>
      page
        .locator(".output-scroll")
        .evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop),
    )
    .toBeLessThan(60);

  // Connectivity is independent from the persisted run status.
  await app.context().setOffline(true);
  await expect(page.getByRole("status")).toContainText("Reconnecting", { timeout: 12_000 });
  await expect(page.locator(".timeline")).toContainText("Arrived while reading earlier output.");
  await app.context().setOffline(false);
  await expect(page.getByRole("status")).toContainText("Connected", { timeout: 12_000 });
  await page.setViewportSize({ width: 430, height: 900 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: path.join(evidence, "narrow.png"), fullPage: true });

  await app.close();
  app = null;
  process.kill(worker.pid, 0);
  assert.equal(await readFile(metadataPath, "utf8"), metadataBefore);
  observer.kill("SIGTERM");
  const restartedUrl = await startObserver();
  assert.notEqual(new URL(restartedUrl).port, new URL(url).port);
  page = await openWindow(restartedUrl);
  await expect(page.getByLabel("Theme", { exact: true })).toHaveValue("dark");
  await page.getByRole("button", { name: /inspect streaming/ }).click();
  await expect(page.locator(".timeline")).toContainText("Arrived while reading earlier output.");
  await app.close();
  app = null;
  observer.kill("SIGTERM");

  const claudeEnv = { PORCH_LAUNCHER: "claude", CLAUDE_CODE_SESSION_ID: "fixture-current" };
  const focusedUrl = await startObserver(["--mine"], claudeEnv);
  page = await openWindow(focusedUrl);
  await expect(page.locator(".scope-note")).toContainText("this agent session");
  await expect(page.getByRole("button", { name: /^Active/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: /^Active/ })).toContainText("2");
  await expect(page.locator(".run-row")).toHaveCount(2);
  await expect(page.locator(".detail-title h2")).toContainText("latest session worker");
  await page.screenshot({ path: path.join(evidence, "focused-session.png") });
  await page.getByRole("button", { name: "Show all Claude runs" }).click();
  await expect(page.locator(".run-row")).toHaveCount(3);
  await app.close();
  app = null;
  observer.kill("SIGTERM");

  const exactUrl = await startObserver(
    ["--mine", "--focus-run", "run_claude-review-event-contract"],
    { PORCH_LAUNCHER: "codex", CODEX_THREAD_ID: "fixture-codex" },
  );
  page = await openWindow(exactUrl);
  await expect(page.locator(".detail-title h2")).toContainText("review event contract");
  await expect(page.getByRole("button", { name: /^All/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".run-row")).toHaveCount(1);
  assert.deepEqual(runtimeErrors, []);
  console.log(
    "PASS: attach, Unicode streaming, selection, final answer, launcher grouping, combined searchable filters, keyboard navigation, light/dark/system themes and cross-port persistence, follow/pause, reconnect, close/reopen without worker mutation, current-session and exact-run focus.",
  );
} finally {
  if (app) await app.close();
  if (observer) observer.kill("SIGTERM");
  worker.kill("SIGTERM");
  await rm(temporary, { recursive: true, force: true });
}
