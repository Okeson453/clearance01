import { t as wrapper_default } from "../_libs/ws.mjs";
import { createHash, createHmac } from "node:crypto";
import { existsSync, promises } from "node:fs";
import { join } from "node:path";
//#region node_modules/.nitro/vite/services/ssr/assets/orchestrator.server-I91u8m1B.js
/** BC.Game login password: HMAC-SHA256(MD5(plain), timestamp). */
function encryptPassword(plain, timestamp = String(Date.now())) {
	const md5 = createHash("md5").update(plain, "utf8").digest("hex");
	return {
		timestamp,
		password: createHmac("sha256", timestamp).update(md5, "utf8").digest("hex")
	};
}
function identifierKind(raw) {
	const value = raw.trim();
	if (value.includes("@")) return "email";
	if (/^\+?\d[\d\s-]{6,}$/.test(value)) return "phone";
	return "username";
}
var loaded = null;
var chain = Promise.resolve();
function loadWrUtils() {
	if (!loaded) loaded = import("./wr_utils-DsxF6bfW.mjs").then((mod) => {
		const value = mod.default;
		return Promise.resolve(value);
	});
	return loaded;
}
/** WASM memory is shared — never overlap t1/t2. */
function withWrUtils(fn) {
	const run = chain.then(async () => {
		return fn(await loadWrUtils());
	});
	chain = run.then(() => void 0, () => void 0);
	return run;
}
var DEFAULT_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
var ORIGINS = [
	"https://bcgame.ke",
	"https://bcbet.ng",
	"https://bc.game"
];
var LOGIN_TIMEOUT_MS = 18e3;
var BcHttpError = class extends Error {
	code;
	constructor(code, message) {
		super(message);
		this.code = code;
		this.name = "BcHttpError";
	}
};
function cookieHeader(jar) {
	return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
}
function applySetCookie(jar, headers) {
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
function requestHeaders(session) {
	return {
		"user-agent": session.userAgent,
		origin: session.origin,
		referer: `${session.origin}/login/signin`,
		accept: "application/json, text/plain, */*",
		"content-type": "application/json",
		"accept-language": "en-US,en;q=0.9",
		cookie: cookieHeader(session.cookies)
	};
}
async function bcFetch(session, path, init = {}) {
	const method = init.method ?? "GET";
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), LOGIN_TIMEOUT_MS);
	try {
		const res = await fetch(`${session.origin}${path}`, {
			method,
			headers: requestHeaders(session),
			body: init.body === void 0 ? void 0 : JSON.stringify(init.body),
			cache: "no-store",
			signal: controller.signal
		});
		applySetCookie(session.cookies, res.headers);
		const text = await res.text();
		try {
			return JSON.parse(text);
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
function publicMessage(code, fallback) {
	switch (code) {
		case 4113: return "Verification failed. Try again.";
		case 6003: return "Session handshake expired. Try again.";
		case 6005: return "BC.GAME is not available from this region.";
		case 6201:
		case 6212:
		case 6223: return "Incorrect account or password.";
		case 4001: return "Session expired.";
		case 0: return fallback;
		default: return fallback || "Could not connect.";
	}
}
function isCredentialError(code) {
	return code === 6201 || code === 6212 || code === 6223;
}
function pickBalance(rows) {
	if (!Array.isArray(rows) || rows.length === 0) return null;
	const usable = rows.filter((r) => r && r.abnormal !== true);
	const pool = usable.length ? usable : rows;
	const score = (row) => {
		const n = Number.parseFloat(row.generalAmount || row.amount || "0");
		return Number.isFinite(n) ? n : 0;
	};
	const preferred = pool.find((r) => (r.aliasCurrencyName || r.currencyName) === "USDT" && score(r) > 0) || pool.find((r) => r.display && score(r) > 0) || [...pool].sort((a, b) => score(b) - score(a))[0] || pool[0];
	if (!preferred) return null;
	return {
		amount: preferred.generalAmount || preferred.amount || "0",
		currency: preferred.aliasCurrencyName || preferred.currencyName || "USDT"
	};
}
function formatAmount(amount, currency) {
	const n = Number.parseFloat(amount);
	if (!Number.isFinite(n)) return `${amount} ${currency}`;
	return `${new Intl.NumberFormat("en-US", {
		minimumFractionDigits: n !== 0 && Math.abs(n) < 1 ? 4 : 2,
		maximumFractionDigits: 8
	}).format(n)} ${currency}`;
}
function isAuthenticatedAccount(data) {
	return Boolean(data && typeof data.userId === "number" && data.userId > 0);
}
async function verifyAndBalance(session) {
	try {
		const [account, amount] = await Promise.all([bcFetch(session, "/api/account/get/"), bcFetch(session, "/api/user/amount/")]);
		if (account.code !== 0 || !isAuthenticatedAccount(account.data)) return {
			ok: false,
			code: account.code || 4001,
			message: publicMessage(account.code, "Session is not authenticated."),
			network: false
		};
		if (amount.code !== 0 || !Array.isArray(amount.data)) return {
			ok: false,
			code: amount.code || 4001,
			message: publicMessage(amount.code, "Could not read balance."),
			network: false
		};
		const balance = pickBalance(amount.data);
		if (!balance) return {
			ok: false,
			code: 4001,
			message: "Could not read balance.",
			network: false
		};
		return {
			ok: true,
			balance
		};
	} catch {
		return {
			ok: false,
			code: 0,
			message: "Could not connect.",
			network: true
		};
	}
}
async function loginPre(session) {
	return withWrUtils(async (wr) => {
		const pre = await bcFetch(session, `/api/account/login-pre/?p=${encodeURIComponent(wr.t1(session.userAgent))}`, {
			method: "POST",
			body: {}
		});
		if (pre.code !== 0) return {
			ok: false,
			code: pre.code,
			message: pre.msg || "Handshake failed."
		};
		return {
			ok: true,
			random: wr.t2(pre.data?.random || "", session.userAgent)
		};
	});
}
function loginPathAndPayload(identifier, password, random, captchaCode, captchaType) {
	const enc = encryptPassword(password);
	const kind = identifierKind(identifier);
	const payload = {
		password: enc.password,
		timestamp: enc.timestamp,
		random,
		codeType: captchaType || "reCAPTCHA",
		code: captchaCode || "test"
	};
	let path = "/api/account/login/";
	if (kind === "username") {
		path = "/api/account/username/login/";
		payload.loginName = identifier.trim();
	} else if (kind === "phone") {
		path = "/api/account/phone/login/";
		payload.phone = identifier.trim();
	} else payload.loginName = identifier.trim();
	return {
		path,
		payload
	};
}
async function httpLogin(opts) {
	const session = {
		origin: opts.origin ?? ORIGINS[0],
		userAgent: opts.userAgent ?? "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
		cookies: { ...opts.cookies ?? {} },
		connectedAt: Date.now()
	};
	const attempt = async () => {
		const pre = await loginPre(session);
		if (!pre.ok) return {
			ok: false,
			code: pre.code,
			message: publicMessage(pre.code, "Handshake failed.")
		};
		const { path, payload } = loginPathAndPayload(opts.identifier, opts.password, pre.random, opts.captchaCode || "test", opts.captchaType || "reCAPTCHA");
		const login = await bcFetch(session, path, {
			method: "POST",
			body: payload
		});
		if (login.code !== 0) return {
			ok: false,
			code: login.code,
			message: publicMessage(login.code, login.msg || "Login failed.")
		};
		return {
			ok: true,
			session
		};
	};
	try {
		let result = await attempt();
		if (!result.ok && result.code === 6003) result = await attempt();
		return result;
	} catch (error) {
		const code = error instanceof BcHttpError ? error.code : 0;
		return {
			ok: false,
			code,
			message: publicMessage(code, "Could not connect.")
		};
	}
}
var NAV_TIMEOUT = 22e3;
var LOGIN_WAIT = 4e4;
var CHROME = "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome";
var queue = Promise.resolve();
function enqueue(fn) {
	const run = queue.then(fn, fn);
	queue = run.then(() => void 0, () => void 0);
	return run;
}
async function launchBrowser() {
	const { chromium } = await import("playwright");
	return chromium.launch({
		headless: true,
		executablePath: existsSync(CHROME) ? CHROME : void 0,
		ignoreDefaultArgs: ["--enable-automation"],
		args: [
			"--no-sandbox",
			"--disable-dev-shm-usage",
			"--disable-blink-features=AutomationControlled",
			"--headless=new",
			"--window-size=1440,900"
		]
	});
}
async function dismissNoise(page) {
	const dialog = page.locator(".dialog-root");
	for (const name of [
		/^Accept All$/i,
		/^Accept$/i,
		/^Agree$/i,
		/^Got it$/i
	]) {
		const btn = page.getByRole("button", { name }).first();
		if (await btn.count()) await btn.click({
			force: true,
			timeout: 1200
		}).catch(() => void 0);
	}
	const tab = dialog.locator("button.tabs-btn", { hasText: /^Sign In$/ });
	if (await tab.count()) await tab.first().click({
		force: true,
		timeout: 2500
	}).catch(() => void 0);
}
async function fillCredentials(page, identifier, password) {
	const dialog = page.locator(".dialog-root");
	const root = await dialog.count() ? dialog : page;
	const email = root.locator("input").first();
	const pw = root.locator("input[type=\"password\"]").first();
	await email.waitFor({
		state: "attached",
		timeout: 1e4
	});
	await email.click({ force: true }).catch(() => void 0);
	await email.fill(identifier, { force: true });
	await pw.fill(password, { force: true });
}
async function cookiesFromContext(page, origin) {
	const cookies = await page.context().cookies(origin);
	const jar = {};
	for (const c of cookies) jar[c.name] = c.value;
	return jar;
}
async function waitForHcaptcha(page) {
	for (let i = 0; i < 20; i += 1) {
		if (await page.evaluate(() => Boolean(window.hcaptcha))) return true;
		if (await page.locator("iframe[src*=\"hcaptcha\"]").count()) return true;
		await page.waitForTimeout(250);
	}
	return false;
}
async function clickHcaptchaCheckbox(page) {
	const frames = page.frames();
	for (const frame of frames) {
		if (!frame.url().includes("hcaptcha")) continue;
		const checkbox = frame.locator("#checkbox, [role='checkbox'], #anchor, .check");
		if (await checkbox.count()) await checkbox.first().click({ timeout: 2500 }).catch(() => void 0);
	}
}
async function readCaptchaToken(page) {
	return page.evaluate(async () => {
		const wait = (ms) => new Promise((r) => setTimeout(r, ms));
		const readHidden = () => {
			const hidden = document.querySelector("[name='h-captcha-response'], [name='g-recaptcha-response'], textarea[name*='captcha']");
			return hidden?.value && hidden.value !== "test" ? hidden.value : "";
		};
		for (let i = 0; i < 24; i += 1) {
			const fromDom = readHidden();
			if (fromDom) return {
				type: "reCAPTCHA",
				code: fromDom
			};
			const h = window.hcaptcha;
			if (h?.getResponse) try {
				const existing = h.getResponse();
				if (existing && existing !== "test") return {
					type: "reCAPTCHA",
					code: existing
				};
			} catch {}
			if (h?.execute && i === 4) try {
				const result = await Promise.race([h.execute({ async: true }), wait(8e3).then(() => null)]);
				const code = result && typeof result === "object" ? result.response : typeof result === "string" ? result : "";
				if (code && code !== "test") return {
					type: "reCAPTCHA",
					code
				};
			} catch {}
			await wait(400);
		}
		return null;
	}).catch(() => null);
}
async function loginOnOrigin(page, origin, identifier, password) {
	page.setDefaultTimeout(12e3);
	const loginResponse = page.waitForResponse((r) => {
		if (r.request().method() !== "POST") return false;
		try {
			const path = new URL(r.url()).pathname;
			return /\/api\/account\/(username\/)?(phone\/)?login\/?$/.test(path);
		} catch {
			return false;
		}
	}, { timeout: LOGIN_WAIT }).then(async (resp) => {
		try {
			return await resp.json();
		} catch {
			return null;
		}
	}).catch(() => null);
	await page.goto(`${origin}/login/signin`, {
		waitUntil: "domcontentloaded",
		timeout: NAV_TIMEOUT
	});
	await page.waitForTimeout(1600);
	await dismissNoise(page);
	if (!await page.locator("input[type=\"password\"]").count()) return null;
	await fillCredentials(page, identifier, password);
	const submit = page.locator("button[type='submit'], button.button-brand", { hasText: /(log\s*in|sign\s*in)/i });
	if (await submit.count()) await submit.first().click({
		force: true,
		timeout: 5e3
	}).catch(() => void 0);
	else await page.getByRole("button", { name: /(log\s*in|sign\s*in)/i }).last().click({
		force: true,
		timeout: 5e3
	}).catch(() => void 0);
	await waitForHcaptcha(page);
	await clickHcaptchaCheckbox(page);
	const token = await readCaptchaToken(page);
	if (token) {
		const jar = await cookiesFromContext(page, origin);
		const http = await httpLogin({
			identifier,
			password,
			origin,
			userAgent: await page.evaluate(() => navigator.userAgent) || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
			cookies: jar,
			captchaCode: token.code,
			captchaType: token.type
		});
		if (http.ok) return http.session;
		if (http.code === 6201 || http.code === 6212 || http.code === 6223) return null;
	}
	const loginBody = await loginResponse;
	if (loginBody && loginBody.code === 0) {
		const jar = await cookiesFromContext(page, origin);
		return {
			origin,
			userAgent: await page.evaluate(() => navigator.userAgent) || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
			cookies: jar,
			connectedAt: Date.now()
		};
	}
	if (loginBody && loginBody.code && loginBody.code !== 0) return null;
	await page.waitForTimeout(2e3);
	const jar = await cookiesFromContext(page, origin);
	if (jar.SESSION) {
		const probe = await httpLogin({
			identifier,
			password,
			origin,
			userAgent: await page.evaluate(() => navigator.userAgent) || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
			cookies: jar,
			captchaCode: token?.code,
			captchaType: token?.type
		});
		if (probe.ok) return probe.session;
	}
	return null;
}
async function playwrightAvailable() {
	try {
		await import("playwright");
		return true;
	} catch {
		return false;
	}
}
async function playwrightLogin(identifier, password) {
	if (!await playwrightAvailable()) return null;
	return enqueue(async () => {
		let browser = null;
		try {
			browser = await launchBrowser();
			const context = await browser.newContext({
				viewport: {
					width: 1440,
					height: 900
				},
				userAgent: DEFAULT_UA,
				locale: "en-KE",
				timezoneId: "Africa/Nairobi",
				colorScheme: "dark"
			});
			await context.addInitScript(() => {
				Object.defineProperty(navigator, "webdriver", { get: () => void 0 });
				window.chrome = {
					runtime: {},
					loadTimes: () => ({}),
					csi: () => ({})
				};
				Object.defineProperty(navigator, "plugins", { get: () => [
					1,
					2,
					3,
					4,
					5
				] });
				Object.defineProperty(navigator, "languages", { get: () => [
					"en-KE",
					"en-US",
					"en"
				] });
				Object.defineProperty(navigator, "platform", { get: () => "Win32" });
				Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 8 });
			});
			const page = await context.newPage();
			for (const origin of ORIGINS.slice(0, 2)) try {
				const session = await loginOnOrigin(page, origin, identifier, password);
				if (session) return session;
			} catch {}
			return null;
		} finally {
			await browser?.close().catch(() => void 0);
		}
	});
}
var SESSION_FILE = join(process.cwd(), ".grok", "bcgame_session.json");
async function writeSession(session) {
	try {
		await promises.mkdir(join(process.cwd(), ".grok"), { recursive: true });
		await promises.writeFile(SESSION_FILE, JSON.stringify(session, null, 2), "utf-8");
	} catch (err) {
		console.error("[Session] Failed to write session file", err);
	}
}
async function readSession() {
	try {
		const text = await promises.readFile(SESSION_FILE, "utf-8");
		const payload = JSON.parse(text);
		if (!payload.origin || !payload.cookies) return null;
		return payload;
	} catch {
		return null;
	}
}
async function clearSession() {
	try {
		await promises.unlink(SESSION_FILE);
	} catch {}
}
var POLL_INTERVAL = 15e3;
var RECONNECT_DELAY_BASE = 2e3;
var MAX_RECONNECT_DELAY = 6e4;
var SessionWorker = class {
	running = false;
	socket = null;
	watchdogTimer = null;
	reconnectAttempts = 0;
	currentSession = null;
	async start() {
		if (this.running) return;
		this.running = true;
		console.log("[Worker] Background session worker started.");
		this.loop();
	}
	stop() {
		this.running = false;
		this.cleanup();
		console.log("[Worker] Background session worker stopped.");
	}
	cleanup() {
		if (this.watchdogTimer) clearTimeout(this.watchdogTimer);
		if (this.socket) {
			try {
				this.socket.close();
			} catch {}
			this.socket = null;
		}
	}
	async loop() {
		while (this.running) {
			try {
				await this.checkAndMaintain();
			} catch (err) {
				console.error("[Worker] Error in loop:", err);
			}
			await this.sleep(POLL_INTERVAL);
		}
	}
	async checkAndMaintain() {
		const session = await readSession();
		if (!session) {
			this.cleanup();
			return;
		}
		const verified = await verifyAndBalance(session);
		if (!verified.ok) {
			if (verified.network) {
				console.log("[Worker] Network error, will retry later.");
				return;
			}
			console.log("[Worker] Session expired or invalid:", verified.message);
			if (session.credentials) {
				console.log("[Worker] Attempting legitimate session recovery...");
				const result = await loginWithCredentials(session.credentials.identifier, session.credentials.password);
				if (result.status === "CONNECTED") console.log("[Worker] Session successfully recovered.");
				else console.error("[Worker] Session recovery failed:", result.error);
			} else {
				console.log("[Worker] No credentials available for recovery. Clearing session.");
				await clearSession();
				this.cleanup();
			}
			return;
		}
		this.currentSession = session;
		if (!this.socket || this.socket.readyState === wrapper_default.CLOSED) this.connectWebSocket(session);
	}
	connectWebSocket(session) {
		if (!this.running) return;
		this.cleanup();
		const wsUrl = session.origin.replace("https://", "wss://").replace("http://", "ws://") + "/socket.io/?EIO=3&transport=websocket";
		console.log(`[Worker] Connecting to realtime endpoint: ${wsUrl}`);
		try {
			this.socket = new wrapper_default(wsUrl, { headers: {
				"User-Agent": session.userAgent,
				"Origin": session.origin,
				"Cookie": cookieHeader(session.cookies)
			} });
			this.socket.on("open", () => {
				console.log("[Worker] Realtime connection established.");
				this.reconnectAttempts = 0;
				this.startWatchdog();
			});
			this.socket.on("message", (data) => {
				this.resetWatchdog();
				const msg = data.toString();
				if (typeof msg === "string") {
					if (msg.startsWith("2")) this.socket?.send("3");
					else if (msg.startsWith("0")) console.log("[Worker] Socket.io connected successfully.");
				}
			});
			this.socket.on("close", (code) => {
				console.log(`[Worker] Realtime connection closed (Code: ${code}).`);
				this.handleDisconnect();
			});
			this.socket.on("error", (error) => {
				console.error("[Worker] Realtime connection error:", error);
			});
		} catch (err) {
			console.error("[Worker] Failed to setup WebSocket:", err);
			this.handleDisconnect();
		}
	}
	handleDisconnect() {
		this.cleanup();
		if (!this.running) return;
		this.reconnectAttempts++;
		const delay = Math.min(RECONNECT_DELAY_BASE * Math.pow(1.5, this.reconnectAttempts - 1), MAX_RECONNECT_DELAY);
		console.log(`[Worker] Reconnecting in ${Math.round(delay / 1e3)}s (Attempt ${this.reconnectAttempts})...`);
		setTimeout(() => {
			if (this.running) this.checkAndMaintain();
		}, delay);
	}
	startWatchdog() {
		this.resetWatchdog();
	}
	resetWatchdog() {
		if (this.watchdogTimer) clearTimeout(this.watchdogTimer);
		this.watchdogTimer = setTimeout(() => {
			console.log("[Worker] Watchdog timeout: No ping received. Restarting connection.");
			this.handleDisconnect();
		}, 45e3);
	}
	sleep(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
};
var sessionWorker = new SessionWorker();
function initWorker() {
	sessionWorker.start();
}
initWorker();
var disconnected = {
	status: "DISCONNECTED",
	balance: null
};
var LOGIN_BUDGET_MS = 75e3;
function connectedView(amount, currency) {
	return {
		status: "CONNECTED",
		balance: {
			amount: formatAmount(amount, currency),
			currency
		}
	};
}
function withTimeout(promise, ms) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(/* @__PURE__ */ new Error("timeout")), ms);
		promise.then((value) => {
			clearTimeout(timer);
			resolve(value);
		}, (error) => {
			clearTimeout(timer);
			reject(error);
		});
	});
}
async function persistIfLive(session, identifier, password) {
	const verified = await verifyAndBalance(session);
	if (!verified.ok) return null;
	if (identifier && password) session.credentials = {
		identifier,
		password
	};
	await writeSession(session);
	return connectedView(verified.balance.amount, verified.balance.currency);
}
async function currentView() {
	const stored = await readSession();
	if (!stored) return disconnected;
	try {
		const verified = await verifyAndBalance(stored);
		if (verified.ok) {
			await writeSession(stored);
			return connectedView(verified.balance.amount, verified.balance.currency);
		}
		if (verified.network) return disconnected;
		await clearSession();
		return disconnected;
	} catch {
		return disconnected;
	}
}
async function loginAttempt(identifier, password) {
	let lastMessage = "Could not connect.";
	let captchaBlocked = false;
	for (const origin of ORIGINS) try {
		const result = await httpLogin({
			identifier,
			password,
			origin
		});
		if (result.ok) {
			const view = await persistIfLive(result.session, identifier, password);
			if (view) return view;
			lastMessage = "Could not read balance.";
			continue;
		}
		lastMessage = publicMessage(result.code, result.message);
		if (isCredentialError(result.code)) {
			await clearSession();
			return {
				...disconnected,
				error: lastMessage
			};
		}
		if (result.code === 4113) captchaBlocked = true;
	} catch {
		lastMessage = "Could not connect.";
	}
	if (captchaBlocked && await playwrightAvailable()) try {
		const session = await playwrightLogin(identifier, password);
		if (session) {
			const view = await persistIfLive(session, identifier, password);
			if (view) return view;
			lastMessage = "Could not read balance.";
		} else lastMessage = "Verification failed. Try again.";
	} catch {
		lastMessage = "Could not connect.";
	}
	await clearSession();
	return {
		...disconnected,
		error: lastMessage
	};
}
async function loginWithCredentials(identifier, password) {
	const id = identifier.trim();
	if (!id || !password) return {
		...disconnected,
		error: "Enter your email/username and password."
	};
	try {
		return await withTimeout(loginAttempt(id, password), LOGIN_BUDGET_MS);
	} catch {
		await clearSession();
		return {
			...disconnected,
			error: "Could not connect."
		};
	}
}
async function logout() {
	await clearSession();
	return disconnected;
}
//#endregion
export { currentView, loginWithCredentials, logout };
