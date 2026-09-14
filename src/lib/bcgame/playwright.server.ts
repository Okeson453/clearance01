import { existsSync } from "node:fs";
import type { Browser, Page } from "playwright";
import { DEFAULT_UA, ORIGINS, httpLogin } from "./http.server";
import type { CookieJar, StoredSession } from "./types";

const NAV_TIMEOUT = 22_000;
const LOGIN_WAIT = 40_000;
const CHROME = "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome";

let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function launchBrowser(): Promise<Browser> {
  const { chromium } = await import("playwright");
  return chromium.launch({
    headless: true,
    executablePath: existsSync(CHROME) ? CHROME : undefined,
    ignoreDefaultArgs: ["--enable-automation"],
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
      "--headless=new",
      "--window-size=1440,900",
    ],
  });
}

async function dismissNoise(page: Page) {
  const dialog = page.locator(".dialog-root");
  for (const name of [/^Accept All$/i, /^Accept$/i, /^Agree$/i, /^Got it$/i]) {
    const btn = page.getByRole("button", { name }).first();
    if (await btn.count()) {
      await btn.click({ force: true, timeout: 1200 }).catch(() => undefined);
    }
  }
  const tab = dialog.locator("button.tabs-btn", { hasText: /^Sign In$/ });
  if (await tab.count()) {
    await tab.first().click({ force: true, timeout: 2500 }).catch(() => undefined);
  }
}

async function fillCredentials(page: Page, identifier: string, password: string) {
  const dialog = page.locator(".dialog-root");
  const root = (await dialog.count()) ? dialog : page;
  const email = root.locator("input").first();
  const pw = root.locator('input[type="password"]').first();
  await email.waitFor({ state: "attached", timeout: 10_000 });
  await email.click({ force: true }).catch(() => undefined);
  await email.fill(identifier, { force: true });
  await pw.fill(password, { force: true });
}

async function cookiesFromContext(page: Page, origin: string): Promise<CookieJar> {
  const cookies = await page.context().cookies(origin);
  const jar: CookieJar = {};
  for (const c of cookies) jar[c.name] = c.value;
  return jar;
}

async function waitForHcaptcha(page: Page) {
  for (let i = 0; i < 20; i += 1) {
    const ready = await page.evaluate(() => Boolean((window as unknown as { hcaptcha?: unknown }).hcaptcha));
    if (ready) return true;
    const iframe = await page.locator('iframe[src*="hcaptcha"]').count();
    if (iframe) return true;
    await page.waitForTimeout(250);
  }
  return false;
}

async function clickHcaptchaCheckbox(page: Page) {
  const frames = page.frames();
  for (const frame of frames) {
    const url = frame.url();
    if (!url.includes("hcaptcha")) continue;
    const checkbox = frame.locator("#checkbox, [role='checkbox'], #anchor, .check");
    if (await checkbox.count()) {
      await checkbox.first().click({ timeout: 2500 }).catch(() => undefined);
    }
  }
}

async function readCaptchaToken(page: Page): Promise<{ type: string; code: string } | null> {
  return page
    .evaluate(async () => {
      const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const readHidden = () => {
        const hidden = document.querySelector<HTMLTextAreaElement>(
          "[name='h-captcha-response'], [name='g-recaptcha-response'], textarea[name*='captcha']",
        );
        return hidden?.value && hidden.value !== "test" ? hidden.value : "";
      };
      for (let i = 0; i < 24; i += 1) {
        const fromDom = readHidden();
        if (fromDom) return { type: "reCAPTCHA", code: fromDom };
        const h = (window as unknown as {
          hcaptcha?: {
            execute?: (opts?: { async: boolean }) => Promise<{ response?: string } | string>;
            getResponse?: () => string;
          };
        }).hcaptcha;
        if (h?.getResponse) {
          try {
            const existing = h.getResponse();
            if (existing && existing !== "test") return { type: "reCAPTCHA", code: existing };
          } catch {
            /* continue */
          }
        }
        if (h?.execute && i === 4) {
          try {
            const result = await Promise.race([
              h.execute({ async: true }),
              wait(8_000).then(() => null),
            ]);
            const code =
              result && typeof result === "object"
                ? (result as { response?: string }).response
                : typeof result === "string"
                  ? result
                  : "";
            if (code && code !== "test") return { type: "reCAPTCHA", code };
          } catch {
            /* visual challenge */
          }
        }
        await wait(400);
      }
      return null;
    })
    .catch(() => null);
}

async function loginOnOrigin(
  page: Page,
  origin: string,
  identifier: string,
  password: string,
): Promise<StoredSession | null> {
  page.setDefaultTimeout(12_000);
  const loginResponse = page
    .waitForResponse(
      (r) => {
        if (r.request().method() !== "POST") return false;
        try {
          const path = new URL(r.url()).pathname;
          return /\/api\/account\/(username\/)?(phone\/)?login\/?$/.test(path);
        } catch {
          return false;
        }
      },
      { timeout: LOGIN_WAIT },
    )
    .then(async (resp) => {
      try {
        return (await resp.json()) as { code?: number };
      } catch {
        return null;
      }
    })
    .catch(() => null);

  await page.goto(`${origin}/login/signin`, {
    waitUntil: "domcontentloaded",
    timeout: NAV_TIMEOUT,
  });
  await page.waitForTimeout(1600);
  await dismissNoise(page);

  const hasPassword = await page.locator('input[type="password"]').count();
  if (!hasPassword) return null;

  await fillCredentials(page, identifier, password);

  const submit = page.locator("button[type='submit'], button.button-brand", { hasText: /(log\s*in|sign\s*in)/i });
  if (await submit.count()) {
    await submit.first().click({ force: true, timeout: 5000 }).catch(() => undefined);
  } else {
    await page.getByRole("button", { name: /(log\s*in|sign\s*in)/i }).last().click({ force: true, timeout: 5000 }).catch(() => undefined);
  }

  await waitForHcaptcha(page);
  await clickHcaptchaCheckbox(page);
  const token = await readCaptchaToken(page);

  if (token) {
    const jar = await cookiesFromContext(page, origin);
    const ua = await page.evaluate(() => navigator.userAgent);
    const http = await httpLogin({
      identifier,
      password,
      origin,
      userAgent: ua || DEFAULT_UA,
      cookies: jar,
      captchaCode: token.code,
      captchaType: token.type,
    });
    if (http.ok) return http.session;
    if (http.code === 6201 || http.code === 6212 || http.code === 6223) {
      return null;
    }
  }

  const loginBody = await loginResponse;
  if (loginBody && loginBody.code === 0) {
    const jar = await cookiesFromContext(page, origin);
    const ua = await page.evaluate(() => navigator.userAgent);
    return {
      origin,
      userAgent: ua || DEFAULT_UA,
      cookies: jar,
      connectedAt: Date.now(),
    };
  }
  if (loginBody && loginBody.code && loginBody.code !== 0) {
    return null;
  }

  await page.waitForTimeout(2000);
  const jar = await cookiesFromContext(page, origin);
  if (jar.SESSION) {
    const ua = await page.evaluate(() => navigator.userAgent);
    const probe = await httpLogin({
      identifier,
      password,
      origin,
      userAgent: ua || DEFAULT_UA,
      cookies: jar,
      captchaCode: token?.code,
      captchaType: token?.type,
    });
    if (probe.ok) return probe.session;
  }
  return null;
}

export async function playwrightAvailable(): Promise<boolean> {
  try {
    await import("playwright");
    return true;
  } catch {
    return false;
  }
}

export async function playwrightLogin(
  identifier: string,
  password: string,
): Promise<StoredSession | null> {
  if (!(await playwrightAvailable())) return null;
  return enqueue(async () => {
    let browser: Browser | null = null;
    try {
      browser = await launchBrowser();
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        userAgent: DEFAULT_UA,
        locale: "en-KE",
        timezoneId: "Africa/Nairobi",
        colorScheme: "dark",
      });
      await context.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver", { get: () => undefined });
        (window as unknown as { chrome: Record<string, unknown> }).chrome = {
          runtime: {},
          loadTimes: () => ({}),
          csi: () => ({}),
        };
        Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
        Object.defineProperty(navigator, "languages", { get: () => ["en-KE", "en-US", "en"] });
        Object.defineProperty(navigator, "platform", { get: () => "Win32" });
        Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 8 });
      });
      const page = await context.newPage();
      for (const origin of ORIGINS.slice(0, 2)) {
        try {
          const session = await loginOnOrigin(page, origin, identifier, password);
          if (session) return session;
        } catch {
          /* try next origin */
        }
      }
      return null;
    } finally {
      await browser?.close().catch(() => undefined);
    }
  });
}
