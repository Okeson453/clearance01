import { encryptPassword, identifierKind } from "./crypto";
import type {
  AccountData,
  AmountRow,
  ApiEnvelope,
  CookieJar,
  HttpLoginFailure,
  HttpLoginSuccess,
  StoredSession,
} from "./types";
import { withWrUtils } from "./wasm.server";

export const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export const ORIGINS = [
  "https://bcgame.ke",
  "https://bcbet.ng",
  "https://bc.game",
] as const;

const LOGIN_TIMEOUT_MS = 18_000;

export class BcHttpError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
    this.name = "BcHttpError";
  }
}

export function jarFromCookieHeader(header: string): CookieJar {
  const jar: CookieJar = {};
  if (!header) return jar;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (name) jar[name] = value;
  }
  return jar;
}

export function cookieHeader(jar: CookieJar): string {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

export function applySetCookie(jar: CookieJar, headers: Headers) {
  const getter = headers.getSetCookie?.bind(headers);
  const list = getter ? getter() : [];
  if (list.length === 0) {
    const single = headers.get("set-cookie");
    if (single) list.push(single);
  }
  for (const line of list) {
    const nv = line.split(";", 1)[0];
    const eq = nv.indexOf("=");
    if (eq <= 0) continue;
    const name = nv.slice(0, eq).trim();
    const value = nv.slice(eq + 1).trim();
    if (name) jar[name] = value;
  }
}

function requestHeaders(session: Pick<StoredSession, "origin" | "userAgent" | "cookies">) {
  return {
    "user-agent": session.userAgent,
    origin: session.origin,
    referer: `${session.origin}/login/signin`,
    accept: "application/json, text/plain, */*",
    "content-type": "application/json",
    "accept-language": "en-US,en;q=0.9",
    cookie: cookieHeader(session.cookies),
  };
}

export async function bcFetch<T>(
  session: Pick<StoredSession, "origin" | "userAgent" | "cookies">,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<ApiEnvelope<T>> {
  const method = init.method ?? "GET";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOGIN_TIMEOUT_MS);
  try {
    const res = await fetch(`${session.origin}${path}`, {
      method,
      headers: requestHeaders(session),
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
      signal: controller.signal,
    });
    applySetCookie(session.cookies, res.headers);
    const text = await res.text();
    try {
      return JSON.parse(text) as ApiEnvelope<T>;
    } catch {
      throw new BcHttpError(res.status, "Unexpected response from BC.GAME");
    }
  } catch (error) {
    if (error instanceof BcHttpError) throw error;
    throw new BcHttpError(0, "Could not connect.");
  } finally {
    clearTimeout(timer);
  }
}

export function publicMessage(code: number, fallback: string): string {
  switch (code) {
    case 4113:
      return "Verification failed. Try again.";
    case 6003:
      return "Session handshake expired. Try again.";
    case 6005:
      return "BC.GAME is not available from this region.";
    case 6201:
    case 6212:
    case 6223:
      return "Incorrect account or password.";
    case 4001:
      return "Session expired.";
    case 0:
      return fallback;
    default:
      return fallback || "Could not connect.";
  }
}

export function isCredentialError(code: number): boolean {
  return code === 6201 || code === 6212 || code === 6223;
}

export function pickBalance(rows: AmountRow[] | null | undefined) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const usable = rows.filter((r) => r && r.abnormal !== true);
  const pool = usable.length ? usable : rows;
  const score = (row: AmountRow) => {
    const n = Number.parseFloat(row.generalAmount || row.amount || "0");
    return Number.isFinite(n) ? n : 0;
  };
  const preferred =
    pool.find((r) => (r.aliasCurrencyName || r.currencyName) === "USDT" && score(r) > 0) ||
    pool.find((r) => r.display && score(r) > 0) ||
    [...pool].sort((a, b) => score(b) - score(a))[0] ||
    pool[0];
  if (!preferred) return null;
  const amount = preferred.generalAmount || preferred.amount || "0";
  const currency = preferred.aliasCurrencyName || preferred.currencyName || "USDT";
  return { amount, currency };
}

export function formatAmount(amount: string, currency: string): string {
  const n = Number.parseFloat(amount);
  if (!Number.isFinite(n)) return `${amount} ${currency}`;
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: n !== 0 && Math.abs(n) < 1 ? 4 : 2,
    maximumFractionDigits: 8,
  }).format(n);
  return `${formatted} ${currency}`;
}

export function isAuthenticatedAccount(data: AccountData | null | undefined): boolean {
  return Boolean(data && typeof data.userId === "number" && data.userId > 0);
}

export async function verifyAndBalance(session: StoredSession) {
  try {
    const [account, amount] = await Promise.all([
      bcFetch<AccountData>(session, "/api/account/get/"),
      bcFetch<AmountRow[]>(session, "/api/user/amount/"),
    ]);
    if (account.code !== 0 || !isAuthenticatedAccount(account.data)) {
      return {
        ok: false as const,
        code: account.code || 4001,
        message: publicMessage(account.code, "Session is not authenticated."),
        network: false,
      };
    }
    if (amount.code !== 0 || !Array.isArray(amount.data)) {
      return {
        ok: false as const,
        code: amount.code || 4001,
        message: publicMessage(amount.code, "Could not read balance."),
        network: false,
      };
    }
    const balance = pickBalance(amount.data);
    if (!balance) {
      return {
        ok: false as const,
        code: 4001,
        message: "Could not read balance.",
        network: false,
      };
    }
    return { ok: true as const, balance };
  } catch {
    return {
      ok: false as const,
      code: 0,
      message: "Could not connect.",
      network: true,
    };
  }
}

async function loginPre(session: StoredSession) {
  return withWrUtils(async (wr) => {
    const p = encodeURIComponent(wr.t1(session.userAgent));
    const pre = await bcFetch<{ random?: string | null }>(
      session,
      `/api/account/login-pre/?p=${p}`,
      { method: "POST", body: {} },
    );
    if (pre.code !== 0) {
      return { ok: false as const, code: pre.code, message: pre.msg || "Handshake failed." };
    }
    const random = wr.t2(pre.data?.random || "", session.userAgent);
    return { ok: true as const, random };
  });
}

function loginPathAndPayload(
  identifier: string,
  password: string,
  random: string,
  captchaCode: string,
  captchaType: string,
) {
  const enc = encryptPassword(password);
  const kind = identifierKind(identifier);
  const payload: Record<string, unknown> = {
    password: enc.password,
    timestamp: enc.timestamp,
    random,
    codeType: captchaType || "reCAPTCHA",
    code: captchaCode || "test",
  };
  let path = "/api/account/login/";
  if (kind === "username") {
    path = "/api/account/username/login/";
    payload.loginName = identifier.trim();
  } else if (kind === "phone") {
    path = "/api/account/phone/login/";
    payload.phone = identifier.trim();
  } else {
    payload.loginName = identifier.trim();
  }
  return { path, payload };
}

export async function httpLogin(opts: {
  identifier: string;
  password: string;
  origin?: string;
  userAgent?: string;
  cookies?: CookieJar;
  captchaCode?: string;
  captchaType?: string;
}): Promise<HttpLoginSuccess | HttpLoginFailure> {
  const origin = opts.origin ?? ORIGINS[0];
  const userAgent = opts.userAgent ?? DEFAULT_UA;
  const cookies: CookieJar = { ...(opts.cookies ?? {}) };
  const session: StoredSession = {
    origin,
    userAgent,
    cookies,
    connectedAt: Date.now(),
  };

  const attempt = async () => {
    const pre = await loginPre(session);
    if (!pre.ok) {
      return {
        ok: false as const,
        code: pre.code,
        message: publicMessage(pre.code, "Handshake failed."),
      };
    }
    const { path, payload } = loginPathAndPayload(
      opts.identifier,
      opts.password,
      pre.random,
      opts.captchaCode || "test",
      opts.captchaType || "reCAPTCHA",
    );
    const login = await bcFetch<unknown>(session, path, {
      method: "POST",
      body: payload,
    });
    if (login.code !== 0) {
      return {
        ok: false as const,
        code: login.code,
        message: publicMessage(login.code, login.msg || "Login failed."),
      };
    }
    return { ok: true as const, session };
  };

  try {
    let result = await attempt();
    if (!result.ok && result.code === 6003) {
      result = await attempt();
    }
    return result;
  } catch (error) {
    const code = error instanceof BcHttpError ? error.code : 0;
    return {
      ok: false,
      code,
      message: publicMessage(code, "Could not connect."),
    };
  }
}
