import { useEffect, useRef, useState, type FormEvent } from "react";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSessionFn, loginFn, logoutFn } from "@/lib/bcgame/actions";
import type { SessionView } from "@/lib/bcgame/types";

const POLL_MS = 12_000;

function StatusDot({ connected }: { connected: boolean }) {
  return (
    <span
      className={
        connected
          ? "size-2.5 rounded-full bg-connected shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-connected)_22%,transparent)]"
          : "size-2.5 rounded-full bg-disconnected shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-disconnected)_22%,transparent)]"
      }
      aria-hidden
    />
  );
}

function Dashboard({
  view,
  onSignOut,
}: {
  view: SessionView;
  onSignOut: () => void;
}) {
  const connected = view.status === "CONNECTED" && Boolean(view.balance);
  return (
    <section className="session-enter w-full max-w-md">
      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-8">
        <div className="flex items-center gap-3">
          <StatusDot connected={connected} />
          <div>
            <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
              Status
            </p>
            <p
              className={
                connected
                  ? "font-display text-2xl font-semibold tracking-tight text-connected"
                  : "font-display text-2xl font-semibold tracking-tight text-disconnected"
              }
              aria-live="polite"
            >
              {connected ? "CONNECTED" : "DISCONNECTED"}
            </p>
          </div>
        </div>
        <div className="mt-8 border-t border-border pt-8">
          <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
            Balance
          </p>
          {connected && view.balance ? (
            <p className="mt-2 font-mono text-3xl font-medium tracking-tight text-foreground tabular-nums">
              {view.balance.amount}
            </p>
          ) : (
            <p className="mt-2 text-lg text-fg-subtle">—</p>
          )}
        </div>
      </div>
      <div className="mt-6 flex justify-center">
        <Button type="button" variant="ghost" size="sm" onClick={onSignOut}>
          Sign out
        </Button>
      </div>
    </section>
  );
}

function LoginForm({
  busy,
  error,
  onSubmit,
}: {
  busy: boolean;
  error: string | null;
  onSubmit: (identifier: string, password: string) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [show, setShow] = useState(false);
  const [canSubmit, setCanSubmit] = useState(false);

  const onFormInput = () => {
    const form = formRef.current;
    if (!form) return;
    setCanSubmit(form.checkValidity() && !busy);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const identifier = String(data.get("identifier") ?? "").trim();
    const password = String(data.get("password") ?? "");
    if (!identifier || !password) return;
    onSubmit(identifier, password);
  };

  return (
    <section className="session-enter w-full max-w-md">
      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-8">
        <p className="font-display text-2xl font-semibold tracking-tight text-foreground">
          Sign in
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Email or username, then password.
        </p>
        <form
          ref={formRef}
          className="mt-8 space-y-5"
          onSubmit={handleSubmit}
          onInput={onFormInput}
        >
          <div className="space-y-2">
            <Label htmlFor="identifier">Email / Username</Label>
            <Input
              id="identifier"
              name="identifier"
              autoComplete="username"
              inputMode="email"
              defaultValue=""
              disabled={busy}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                defaultValue=""
                disabled={busy}
                required
                className="pr-12"
              />
              <button
                type="button"
                className="absolute top-1/2 right-3 flex size-11 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {show ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </div>
          {error ? (
            <p className="text-sm text-disconnected" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" size="lg" className="mt-1 w-full" disabled={!canSubmit}>
            {busy ? (
              <>
                <LoaderCircle className="animate-spin" />
                Connecting
              </>
            ) : (
              "Login"
            )}
          </Button>
        </form>
      </div>
    </section>
  );
}

export function SessionApp({ initial }: { initial: SessionView }) {
  const [view, setView] = useState<SessionView>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const [mode, setMode] = useState<"login" | "dashboard">(
    initial.status === "CONNECTED" && initial.balance ? "dashboard" : "login",
  );
  const connected = view.status === "CONNECTED" && Boolean(view.balance);

  useEffect(() => {
    if (mode !== "dashboard") return;
    let cancelled = false;
    const tick = async () => {
      try {
        const next = await getSessionFn();
        if (cancelled) return;
        if (next.status === "CONNECTED" && next.balance) {
          setView(next);
        } else {
          setView({ status: "DISCONNECTED", balance: null });
        }
      } catch {
        if (!cancelled) setView({ status: "DISCONNECTED", balance: null });
      }
    };
    const id = window.setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [mode]);

  const onLogin = async (identifier: string, password: string) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await loginFn({ data: { identifier, password } });
      if (result.status === "CONNECTED" && result.balance) {
        setView({ status: "CONNECTED", balance: result.balance });
        setMode("dashboard");
      } else {
        setView({ status: "DISCONNECTED", balance: null });
        setError(result.error || "DISCONNECTED");
        setMode("login");
      }
    } catch (err) {
      setView({ status: "DISCONNECTED", balance: null });
      const message = err instanceof TypeError ? "Could not connect." : (err as Error).message || "Could not connect.";
      setError(message);
      setMode("login");
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  };

  const onSignOut = async () => {
    try {
      await logoutFn();
    } catch {
      /* still return to login */
    }
    setView({ status: "DISCONNECTED", balance: null });
    setError(null);
    setMode("login");
  };

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center px-5 py-16">
      <div aria-hidden className="hero-wash pointer-events-none absolute inset-0" />
      <header className="relative mb-10 text-center">
        <p className="text-xs font-medium tracking-[0.22em] text-primary uppercase">
          BC.GAME
        </p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-foreground">
          Clearance
        </h1>
      </header>
      <div className="relative flex w-full justify-center">
        {mode === "dashboard" ? (
          <Dashboard
            view={connected ? view : { status: "DISCONNECTED", balance: null }}
            onSignOut={onSignOut}
          />
        ) : (
          <LoginForm busy={busy} error={error} onSubmit={onLogin} />
        )}
      </div>
    </main>
  );
}
