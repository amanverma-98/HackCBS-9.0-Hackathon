// Client for the optional Talk2 backend (backend/, deployable to Render).
const account = require("../../shared/account.cjs");

type Options = { method?: string; token?: string; body?: unknown; timeoutMs?: number };

/** Calls `/api/<path>` on the configured server and returns its JSON, or throws a readable error. */
export async function api(base: string, path: string, { method = "GET", token, body, timeoutMs = 70000 }: Options = {}) {
  const root = account.normalizeBase(base);
  if (!root) throw new Error("The Talk2 server is not reachable at the moment. Try again later.");
  let res: Response;
  try {
    // 70 s: a sleeping free Render service takes up to a minute to start.
    res = await fetch(`${root}/api/${path.replace(/^\//, "")}`, {
      method,
      headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e: any) {
    const timedOut = e?.name === "TimeoutError" || e?.name === "AbortError";
    throw Object.assign(new Error(account.friendlyError({ timedOut, offline: !timedOut })), { status: 0 });
  }
  let data: any = {};
  try {
    data = await res.json();
  } catch {
    // Non-JSON answer (wrong address, proxy page): handled by the status below.
  }
  if (!res.ok) throw Object.assign(new Error(account.friendlyError({ status: res.status, error: data?.error })), { status: res.status });
  return data;
}
