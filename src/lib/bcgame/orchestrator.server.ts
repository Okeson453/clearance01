import {
  formatAmount,
  httpLogin,
  isCredentialError,
  ORIGINS,
  publicMessage,
  verifyAndBalance,
} from "./http.server";
import { playwrightAvailable, playwrightLogin } from "./playwright.server";
import { clearSession, readSession, writeSession } from "./session.server";
import type { LoginResult, SessionView, StoredSession } from "./types";

const disconnected: SessionView = { status: "DISCONNECTED", balance: null };
const LOGIN_BUDGET_MS = 75_000;

function connectedView(amount: string, currency: string): SessionView {
  return {
    status: "CONNECTED",
    balance: { amount: formatAmount(amount, currency), currency },
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function persistIfLive(session: StoredSession): Promise<SessionView | null> {
  const verified = await verifyAndBalance(session);
  if (!verified.ok) return null;
  await writeSession(session);
  return connectedView(verified.balance.amount, verified.balance.currency);
}

export async function currentView(): Promise<SessionView> {
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

async function loginAttempt(identifier: string, password: string): Promise<LoginResult> {
  let lastMessage = "Could not connect.";
  let captchaBlocked = false;

  for (const origin of ORIGINS) {
    try {
      const result = await httpLogin({ identifier, password, origin });
      if (result.ok) {
        const view = await persistIfLive(result.session);
        if (view) return view;
        lastMessage = "Could not read balance.";
        continue;
      }
      lastMessage = publicMessage(result.code, result.message);
      if (isCredentialError(result.code)) {
        await clearSession();
        return { ...disconnected, error: lastMessage };
      }
      if (result.code === 4113) captchaBlocked = true;
    } catch {
      lastMessage = "Could not connect.";
    }
  }

  if (captchaBlocked && (await playwrightAvailable())) {
    try {
      const session = await playwrightLogin(identifier, password);
      if (session) {
        const view = await persistIfLive(session);
        if (view) return view;
        lastMessage = "Could not read balance.";
      } else {
        lastMessage = "Verification failed. Try again.";
      }
    } catch {
      lastMessage = "Could not connect.";
    }
  }

  await clearSession();
  return { ...disconnected, error: lastMessage };
}

export async function loginWithCredentials(
  identifier: string,
  password: string,
): Promise<LoginResult> {
  const id = identifier.trim();
  if (!id || !password) {
    return { ...disconnected, error: "Enter your email/username and password." };
  }
  try {
    return await withTimeout(loginAttempt(id, password), LOGIN_BUDGET_MS);
  } catch {
    await clearSession();
    return { ...disconnected, error: "Could not connect." };
  }
}

export async function logout(): Promise<SessionView> {
  await clearSession();
  return disconnected;
}
