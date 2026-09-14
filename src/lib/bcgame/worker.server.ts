import { readSession, writeSession, clearSession } from "./session.server";
import { verifyAndBalance, bcFetch } from "./http.server";
import { loginWithCredentials } from "./orchestrator.server";
import type { StoredSession } from "./types";
import { cookieHeader } from "./http.server";
import WebSocket from "ws";

const POLL_INTERVAL = 15_000;
const RECONNECT_DELAY_BASE = 2_000;
const MAX_RECONNECT_DELAY = 60_000;

class SessionWorker {
  private running = false;
  private socket: WebSocket | null = null;
  private watchdogTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private currentSession: StoredSession | null = null;

  public async start() {
    if (this.running) return;
    this.running = true;
    console.log("[Worker] Background session worker started.");
    this.loop();
  }

  public stop() {
    this.running = false;
    this.cleanup();
    console.log("[Worker] Background session worker stopped.");
  }

  private cleanup() {
    if (this.watchdogTimer) clearTimeout(this.watchdogTimer);
    if (this.socket) {
      try {
        this.socket.close();
      } catch {
        // ignore
      }
      this.socket = null;
    }
  }

  private async loop() {
    while (this.running) {
      try {
        await this.checkAndMaintain();
      } catch (err) {
        console.error("[Worker] Error in loop:", err);
      }
      await this.sleep(POLL_INTERVAL);
    }
  }

  private async checkAndMaintain() {
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
      
      // Perform legitimate session recovery if credentials exist
      if (session.credentials) {
        console.log("[Worker] Attempting legitimate session recovery...");
        const result = await loginWithCredentials(
          session.credentials.identifier,
          session.credentials.password
        );
        if (result.status === "CONNECTED") {
          console.log("[Worker] Session successfully recovered.");
          // Reconnection of realtime socket will happen on next tick or below
        } else {
          console.error("[Worker] Session recovery failed:", result.error);
        }
      } else {
        console.log("[Worker] No credentials available for recovery. Clearing session.");
        await clearSession();
        this.cleanup();
      }
      return;
    }

    this.currentSession = session;

    // Maintain realtime connection
    if (!this.socket || this.socket.readyState === WebSocket.CLOSED) {
      this.connectWebSocket(session);
    }
  }

  private connectWebSocket(session: StoredSession) {
    if (!this.running) return;
    this.cleanup();

    const wsUrl = session.origin.replace("https://", "wss://").replace("http://", "ws://") + "/socket.io/?EIO=3&transport=websocket";
    console.log(`[Worker] Connecting to realtime endpoint: ${wsUrl}`);
    
    try {
      this.socket = new WebSocket(wsUrl, {
        headers: {
          "User-Agent": session.userAgent,
          "Origin": session.origin,
          "Cookie": cookieHeader(session.cookies)
        }
      });
      
      this.socket.on('open', () => {
        console.log("[Worker] Realtime connection established.");
        this.reconnectAttempts = 0;
        this.startWatchdog();
      });

      this.socket.on('message', (data) => {
        this.resetWatchdog();
        const msg = data.toString();
        if (typeof msg === "string") {
          // Respond to socket.io pings
          if (msg.startsWith("2")) {
            this.socket?.send("3");
          } else if (msg.startsWith("0")) {
            // connection established packet, optionally we can subscribe to things here
            console.log("[Worker] Socket.io connected successfully.");
          }
        }
      });

      this.socket.on('close', (code) => {
        console.log(`[Worker] Realtime connection closed (Code: ${code}).`);
        this.handleDisconnect();
      });

      this.socket.on('error', (error) => {
        console.error("[Worker] Realtime connection error:", error);
      });

    } catch (err) {
      console.error("[Worker] Failed to setup WebSocket:", err);
      this.handleDisconnect();
    }
  }

  private handleDisconnect() {
    this.cleanup();
    if (!this.running) return;
    
    this.reconnectAttempts++;
    const delay = Math.min(RECONNECT_DELAY_BASE * Math.pow(1.5, this.reconnectAttempts - 1), MAX_RECONNECT_DELAY);
    console.log(`[Worker] Reconnecting in ${Math.round(delay / 1000)}s (Attempt ${this.reconnectAttempts})...`);
    
    setTimeout(() => {
      if (this.running) this.checkAndMaintain();
    }, delay);
  }

  private startWatchdog() {
    this.resetWatchdog();
  }

  private resetWatchdog() {
    if (this.watchdogTimer) clearTimeout(this.watchdogTimer);
    this.watchdogTimer = setTimeout(() => {
      console.log("[Worker] Watchdog timeout: No ping received. Restarting connection.");
      this.handleDisconnect();
    }, 45_000); // 45s watchdog timeout (socket.io ping is typically 25s)
  }

  private sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const sessionWorker = new SessionWorker();

// Start it immediately if it's imported (in dev, this might happen multiple times on HMR, but we'll try to just run it)
// We'll expose an init function to be called from a central place to avoid double-starting.
export function initWorker() {
  sessionWorker.start();
}
