import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { LoginResult, SessionView } from "./types";

const credentials = z.object({
  identifier: z.string().min(1).max(200),
  password: z.string().min(1).max(200),
});

export const getSessionFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<SessionView> => {
    const { currentView } = await import("./orchestrator.server");
    return currentView();
  },
);

export const loginFn = createServerFn({ method: "POST" })
  .validator(credentials)
  .handler(async ({ data }): Promise<LoginResult> => {
    const { loginWithCredentials } = await import("./orchestrator.server");
    return loginWithCredentials(data.identifier, data.password);
  });

export const logoutFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<SessionView> => {
    const { logout } = await import("./orchestrator.server");
    return logout();
  },
);
