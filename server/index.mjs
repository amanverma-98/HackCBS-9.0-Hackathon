import http from "node:http";
import { readFile } from "node:fs/promises";
import { timingSafeEqual, createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
const digest = (s) => createHash("sha256").update(s).digest();
export function createServer(env = process.env, fetcher = fetch) {
  const rates = new Map();
  return http.createServer(async (req, res) => {
    const json = (status, data) => {
      res.writeHead(status, {
        "content-type": "application/json",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      });
      res.end(JSON.stringify(data));
    };
    const url = new URL(req.url, "http://localhost");
    if (req.method === "GET" && url.pathname === "/health")
      return json(200, {
        service: "Talk2",
        ok: true,
        gptConfigured: !!env.OPENAI_API_KEY && !!env.OPENAI_MODEL,
      });
    if (req.method === "GET" && url.pathname === "/api/models") {
      if (!env.MODEL_MANIFEST_PATH)
        return json(503, { error: "Model manifest is not configured" });
      try {
        return json(
          200,
          JSON.parse(await readFile(env.MODEL_MANIFEST_PATH, "utf8")),
        );
      } catch {
        return json(503, { error: "Model manifest unavailable" });
      }
    }
    if (req.method !== "POST" || url.pathname !== "/api/assist")
      return json(404, { error: "Not found" });
    if (
      !env.TALK2_ACCESS_TOKEN ||
      !timingSafeEqual(
        digest(req.headers.authorization || ""),
        digest(`Bearer ${env.TALK2_ACCESS_TOKEN}`),
      )
    )
      return json(401, { error: "Invalid access token" });
    const address = req.socket.remoteAddress,
      now = Date.now();
    if (rates.size > 10000)
      for (const [k, v] of rates) if (now - v.start > 60000) rates.delete(k);
    const rate = rates.get(address) || { start: now, count: 0 };
    if (now - rate.start > 60000) {
      rate.start = now;
      rate.count = 0;
    }
    rate.count++;
    rates.set(address, rate);
    if (rate.count > 10) return json(429, { error: "Try again in one minute" });
    if (!env.OPENAI_API_KEY || !env.OPENAI_MODEL)
      return json(503, { error: "GPT is not configured on this server" });
    try {
      let body = "";
      for await (const chunk of req) {
        body += chunk;
        if (Buffer.byteLength(body) > 12000)
          return json(413, { error: "Request too large" });
      }
      let data;
      try {
        data = JSON.parse(body);
      } catch {
        return json(400, { error: "Invalid JSON" });
      }
      if (
        typeof data.text !== "string" ||
        !data.text.trim() ||
        data.text.length > 2000
      )
        return json(400, { error: "text must contain 1–2000 characters" });
      const response = await fetcher("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: env.OPENAI_MODEL,
          store: false,
          max_output_tokens: 700,
          instructions:
            "You are Talk2, a concise multilingual communication assistant. Answer the user. Do not claim to contact services, transmit radio messages, or access location.",
          input: data.text,
        }),
        signal: AbortSignal.timeout(35000),
      });
      if (!response.ok)
        return json(502, {
          error: "AI provider request failed",
          providerStatus: response.status,
        });
      const output = await response.json();
      const text = (output.output || [])
        .flatMap((x) => x.content || [])
        .filter((x) => x.type === "output_text")
        .map((x) => x.text)
        .join("\n");
      return text
        ? json(200, { text })
        : json(502, { error: "No text returned by provider" });
    } catch (e) {
      return json(502, {
        error:
          e.name === "TimeoutError"
            ? "AI provider timed out"
            : "Request failed",
      });
    }
  });
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const s = createServer();
  s.requestTimeout = 45000;
  s.headersTimeout = 10000;
  s.listen(
    Number(process.env.PORT || 8080),
    process.env.HOST || "127.0.0.1",
    () => console.log("Talk2 server listening"),
  );
}
