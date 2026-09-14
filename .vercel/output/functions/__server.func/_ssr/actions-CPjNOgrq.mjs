import { n as createServerFn, r as TSS_SERVER_FUNCTION } from "./ssr.mjs";
import { i as string, r as object } from "../_libs/zod.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/actions-CPjNOgrq.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var credentials = object({
	identifier: string().min(1).max(200),
	password: string().min(1).max(200)
});
var getSessionFn_createServerFn_handler = createServerRpc({
	id: "49547b6507e79b63869acab7f3d8584ac871878d11a6cfacfd8ff92ffe919282",
	name: "getSessionFn",
	filename: "src/lib/bcgame/actions.ts"
}, (opts) => getSessionFn.__executeServer(opts));
var getSessionFn = createServerFn({ method: "GET" }).handler(getSessionFn_createServerFn_handler, async () => {
	const { currentView } = await import("./orchestrator.server-DpV6htsM.mjs");
	return currentView();
});
var loginFn_createServerFn_handler = createServerRpc({
	id: "6a1c721aa39e6983e40ccc46bd75549c214e043102ef9295694d6224ba46cfd0",
	name: "loginFn",
	filename: "src/lib/bcgame/actions.ts"
}, (opts) => loginFn.__executeServer(opts));
var loginFn = createServerFn({ method: "POST" }).validator(credentials).handler(loginFn_createServerFn_handler, async ({ data }) => {
	const { loginWithCredentials } = await import("./orchestrator.server-DpV6htsM.mjs");
	return loginWithCredentials(data.identifier, data.password);
});
var logoutFn_createServerFn_handler = createServerRpc({
	id: "a1730feec9138ad665c25a33e8a907c52229849721d0cd17b0ddd8277f2be326",
	name: "logoutFn",
	filename: "src/lib/bcgame/actions.ts"
}, (opts) => logoutFn.__executeServer(opts));
var logoutFn = createServerFn({ method: "POST" }).handler(logoutFn_createServerFn_handler, async () => {
	const { logout } = await import("./orchestrator.server-DpV6htsM.mjs");
	return logout();
});
//#endregion
export { getSessionFn_createServerFn_handler, loginFn_createServerFn_handler, logoutFn_createServerFn_handler };
