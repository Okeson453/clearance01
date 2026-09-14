import { createHash } from "node:crypto";
import { EncryptJWT, jwtDecrypt } from "jose";
import { isWorkspacePreview } from "@/lib/env.server";
import type { StoredSession } from "./types";

const COOKIE = "bcg_session";
const MAX_AGE = 60 * 60 * 24 * 7;

function secretKey(): Uint8Array {
  const material =
    process.env.BETTER_AUTH_SECRET ||
    process.env.GROK_SERVER_KEY ||
    "clearance.bc.session.v1";
  return createHash("sha256").update(material).digest();
}

export async function writeSession(session: StoredSession): Promise<void> {
  const token = await new EncryptJWT({
    origin: session.origin,
    userAgent: session.userAgent,
    cookies: session.cookies,
    connectedAt: session.connectedAt,
  })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .encrypt(secretKey());

  const { setCookie } = await import("@tanstack/react-start/server");
  setCookie(COOKIE, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: !isWorkspacePreview(),
    maxAge: MAX_AGE,
  });
}

export async function readSession(): Promise<StoredSession | null> {
  try {
    const { getCookie } = await import("@tanstack/react-start/server");
    const token = getCookie(COOKIE);
    if (!token) return null;
    const { payload } = await jwtDecrypt(token, secretKey());
    const origin = typeof payload.origin === "string" ? payload.origin : "";
    const userAgent = typeof payload.userAgent === "string" ? payload.userAgent : "";
    const cookies =
      payload.cookies && typeof payload.cookies === "object"
        ? (payload.cookies as StoredSession["cookies"])
        : null;
    const connectedAt =
      typeof payload.connectedAt === "number" ? payload.connectedAt : Date.now();
    if (!origin || !cookies) return null;
    return { origin, userAgent, cookies, connectedAt };
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  try {
    const { deleteCookie } = await import("@tanstack/react-start/server");
    deleteCookie(COOKIE, { path: "/" });
  } catch {
    const { setCookie } = await import("@tanstack/react-start/server");
    setCookie(COOKIE, "", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: !isWorkspacePreview(),
      maxAge: 0,
    });
  }
}
