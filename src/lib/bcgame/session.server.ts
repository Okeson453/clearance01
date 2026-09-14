import { promises as fs } from "node:fs";
import { join } from "node:path";
import type { StoredSession } from "./types";

const SESSION_FILE = join(process.cwd(), ".grok", "bcgame_session.json");

export async function writeSession(session: StoredSession): Promise<void> {
  try {
    await fs.mkdir(join(process.cwd(), ".grok"), { recursive: true });
    await fs.writeFile(SESSION_FILE, JSON.stringify(session, null, 2), "utf-8");
  } catch (err) {
    console.error("[Session] Failed to write session file", err);
  }
}

export async function readSession(): Promise<StoredSession | null> {
  try {
    const text = await fs.readFile(SESSION_FILE, "utf-8");
    const payload = JSON.parse(text);
    if (!payload.origin || !payload.cookies) return null;
    return payload as StoredSession;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  try {
    await fs.unlink(SESSION_FILE);
  } catch {
    // Ignore error if file does not exist
  }
}
