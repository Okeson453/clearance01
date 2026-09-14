import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { v as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { i as EyeOff, n as LoaderCircle, r as Eye } from "../_libs/lucide-react.mjs";
import { a as logoutFn, i as loginFn, n as Route, r as getSessionFn } from "./router-B6KpJYXE.mjs";
import { t as Slot } from "../_libs/radix-ui__react-slot.mjs";
import { n as clsx, t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-6G7TQCAf.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
var buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[opacity,transform,background-color,color,box-shadow] duration-[var(--motion-quick)] ease-[var(--ease-smooth-out)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]", {
	variants: {
		variant: {
			default: "bg-primary text-primary-foreground hover:opacity-90",
			ghost: "bg-transparent text-muted-foreground hover:text-foreground",
			outline: "border border-border bg-transparent text-foreground hover:bg-surface-2"
		},
		size: {
			default: "h-12 rounded-xl px-5 text-sm",
			lg: "h-14 rounded-xl px-6 text-base",
			sm: "h-9 rounded-lg px-3 text-xs"
		}
	},
	defaultVariants: {
		variant: "default",
		size: "default"
	}
});
var Button = import_react.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(asChild ? Slot : "button", {
		className: cn(buttonVariants({
			variant,
			size,
			className
		})),
		ref,
		...props
	});
});
Button.displayName = "Button";
var Input = import_react.forwardRef(({ className, type, ...props }, ref) => {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
		type,
		className: cn("flex h-12 w-full rounded-xl border border-border bg-surface-2 px-4 text-sm text-foreground shadow-none transition-[border-color,box-shadow] duration-[var(--motion-quick)] placeholder:text-fg-subtle focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50", className),
		ref,
		...props
	});
});
Input.displayName = "Input";
var Label = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
	ref,
	className: cn("text-sm font-medium text-muted-foreground", className),
	...props
}));
Label.displayName = "Label";
var POLL_MS = 12e3;
function StatusDot({ connected }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: connected ? "size-2.5 rounded-full bg-connected shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-connected)_22%,transparent)]" : "size-2.5 rounded-full bg-disconnected shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-disconnected)_22%,transparent)]",
		"aria-hidden": true
	});
}
function Dashboard({ view, onSignOut }) {
	const connected = view.status === "CONNECTED" && Boolean(view.balance);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "session-enter w-full max-w-md",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "rounded-[var(--radius-card)] border border-border bg-surface p-8",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusDot, { connected }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase",
					children: "Status"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: connected ? "font-display text-2xl font-semibold tracking-tight text-connected" : "font-display text-2xl font-semibold tracking-tight text-disconnected",
					"aria-live": "polite",
					children: connected ? "CONNECTED" : "DISCONNECTED"
				})] })]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-8 border-t border-border pt-8",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase",
					children: "Balance"
				}), connected && view.balance ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 font-mono text-3xl font-medium tracking-tight text-foreground tabular-nums",
					children: view.balance.amount
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-lg text-fg-subtle",
					children: "—"
				})]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-6 flex justify-center",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				type: "button",
				variant: "ghost",
				size: "sm",
				onClick: onSignOut,
				children: "Sign out"
			})
		})]
	});
}
function LoginForm({ busy, error, onSubmit }) {
	const formRef = (0, import_react.useRef)(null);
	const [show, setShow] = (0, import_react.useState)(false);
	const [canSubmit, setCanSubmit] = (0, import_react.useState)(false);
	const onFormInput = () => {
		const form = formRef.current;
		if (!form) return;
		setCanSubmit(form.checkValidity() && !busy);
	};
	const handleSubmit = (event) => {
		event.preventDefault();
		if (busy) return;
		const data = new FormData(event.currentTarget);
		const identifier = String(data.get("identifier") ?? "").trim();
		const password = String(data.get("password") ?? "");
		if (!identifier || !password) return;
		onSubmit(identifier, password);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
		className: "session-enter w-full max-w-md",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "rounded-[var(--radius-card)] border border-border bg-surface p-8",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-display text-2xl font-semibold tracking-tight text-foreground",
					children: "Sign in"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted-foreground",
					children: "Email or username, then password."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
					ref: formRef,
					className: "mt-8 space-y-5",
					onSubmit: handleSubmit,
					onInput: onFormInput,
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "identifier",
								children: "Email / Username"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "identifier",
								name: "identifier",
								autoComplete: "username",
								inputMode: "email",
								defaultValue: "",
								disabled: busy,
								required: true
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "password",
								children: "Password"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "relative",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "password",
									name: "password",
									type: show ? "text" : "password",
									autoComplete: "current-password",
									defaultValue: "",
									disabled: busy,
									required: true,
									className: "pr-12"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "absolute top-1/2 right-3 flex size-11 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground",
									onClick: () => setShow((v) => !v),
									"aria-label": show ? "Hide password" : "Show password",
									tabIndex: -1,
									children: show ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EyeOff, {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eye, {})
								})]
							})]
						}),
						error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-disconnected",
							role: "alert",
							children: error
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "submit",
							size: "lg",
							className: "mt-1 w-full",
							disabled: !canSubmit,
							children: busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "animate-spin" }), "Connecting"] }) : "Login"
						})
					]
				})
			]
		})
	});
}
function SessionApp({ initial }) {
	const [view, setView] = (0, import_react.useState)(initial);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)(null);
	const submittingRef = (0, import_react.useRef)(false);
	const [mode, setMode] = (0, import_react.useState)(initial.status === "CONNECTED" && initial.balance ? "dashboard" : "login");
	const connected = view.status === "CONNECTED" && Boolean(view.balance);
	(0, import_react.useEffect)(() => {
		if (mode !== "dashboard") return;
		let cancelled = false;
		const tick = async () => {
			try {
				const next = await getSessionFn();
				if (cancelled) return;
				if (next.status === "CONNECTED" && next.balance) setView(next);
				else setView({
					status: "DISCONNECTED",
					balance: null
				});
			} catch {
				if (!cancelled) setView({
					status: "DISCONNECTED",
					balance: null
				});
			}
		};
		const id = window.setInterval(tick, POLL_MS);
		return () => {
			cancelled = true;
			window.clearInterval(id);
		};
	}, [mode]);
	const onLogin = async (identifier, password) => {
		if (submittingRef.current) return;
		submittingRef.current = true;
		setBusy(true);
		setError(null);
		try {
			const result = await loginFn({ data: {
				identifier,
				password
			} });
			if (result.status === "CONNECTED" && result.balance) {
				setView({
					status: "CONNECTED",
					balance: result.balance
				});
				setMode("dashboard");
			} else {
				setView({
					status: "DISCONNECTED",
					balance: null
				});
				setError(result.error || "DISCONNECTED");
				setMode("login");
			}
		} catch (err) {
			setView({
				status: "DISCONNECTED",
				balance: null
			});
			const message = err instanceof TypeError ? "Could not connect." : err.message || "Could not connect.";
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
		} catch {}
		setView({
			status: "DISCONNECTED",
			balance: null
		});
		setError(null);
		setMode("login");
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "relative flex min-h-dvh flex-col items-center justify-center px-5 py-16",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				"aria-hidden": true,
				className: "hero-wash pointer-events-none absolute inset-0"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "relative mb-10 text-center",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs font-medium tracking-[0.22em] text-primary uppercase",
					children: "BC.GAME"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "mt-3 font-display text-4xl font-semibold tracking-tight text-foreground",
					children: "Clearance"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "relative flex w-full justify-center",
				children: mode === "dashboard" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dashboard, {
					view: connected ? view : {
						status: "DISCONNECTED",
						balance: null
					},
					onSignOut
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoginForm, {
					busy,
					error,
					onSubmit: onLogin
				})
			})
		]
	});
}
function Home() {
	const initial = Route.useLoaderData();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SessionApp, { initial });
}
//#endregion
export { Home as component };
