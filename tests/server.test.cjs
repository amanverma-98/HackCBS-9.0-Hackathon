const { test } = require("node:test"),
  assert = require("node:assert/strict");
async function fixture(fn, fetcher) {
  const { createServer } = await import("../server/index.mjs");
  const server = createServer(
    {
      TALK2_ACCESS_TOKEN: "secret",
      OPENAI_API_KEY: "test-key",
      OPENAI_MODEL: "test-model",
    },
    fetcher,
  );
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((r) => server.close(r));
  }
}
test("health and authentication", () =>
  fixture(async (url) => {
    assert.equal((await fetch(url + "/health")).status, 200);
    assert.equal(
      (await fetch(url + "/api/assist", { method: "POST" })).status,
      401,
    );
  }));
test("GPT request validation and Responses extraction", () =>
  fixture(
    async (url) => {
      const headers = {
        authorization: "Bearer secret",
        "content-type": "application/json",
      };
      assert.equal(
        (
          await fetch(url + "/api/assist", {
            method: "POST",
            headers,
            body: "{}",
          })
        ).status,
        400,
      );
      const r = await fetch(url + "/api/assist", {
        method: "POST",
        headers,
        body: JSON.stringify({ text: "Hello" }),
      });
      assert.deepEqual(await r.json(), { text: "नमस्ते" });
    },
    async (url, options) => {
      assert.equal(url, "https://api.openai.com/v1/responses");
      assert.equal(JSON.parse(options.body).store, false);
      return {
        ok: true,
        json: async () => ({
          output: [{ content: [{ type: "output_text", text: "नमस्ते" }] }],
        }),
      };
    },
  ));
