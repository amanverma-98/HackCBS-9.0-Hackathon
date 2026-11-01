const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET = "test-secret-that-is-long-enough-for-hs256-signing";
process.env.JWT_EXPIRES_IN = "3650d";
const createApp = require("../src/app");


let mongo, server, base;
before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await mongoose.connection.syncIndexes();
  server = createApp().listen(0);
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  server.close();
  await mongoose.disconnect();
  await mongo.stop();
});


async function call(method, path, body, token) {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}


test("signup, login, me and logout with a long-lived token", async () => {
  const signup = await call("POST", "/auth/signup", { name: "Asha", email: "Asha@Example.com", password: "secret123", role: "volunteer" });
  assert.equal(signup.status, 201);
  assert.equal(signup.body.user.email, "asha@example.com");
  assert.equal(signup.body.user.role, "volunteer");
  assert.equal(signup.body.user.password, undefined);
  const { exp, iat } = jwt.decode(signup.body.token);
  assert.ok(exp - iat >= 3650 * 24 * 3600, "token should last about ten years");

  assert.equal((await call("POST", "/auth/signup", { name: "A", email: "asha@example.com", password: "secret123" })).status, 409);
  assert.equal((await call("POST", "/auth/login", { email: "asha@example.com", password: "wrong-pass" })).status, 401);

  const login = await call("POST", "/auth/login", { email: "ASHA@example.com", password: "secret123" });
  assert.equal(login.status, 200);
  const me = await call("GET", "/auth/me", null, login.body.token);
  assert.equal(me.body.user.name, "Asha");

  assert.equal((await call("POST", "/auth/logout", null, login.body.token)).status, 200);
  assert.equal((await call("GET", "/auth/me", null, login.body.token)).status, 401);
  // Logging out one session leaves the other token valid.
  assert.equal((await call("GET", "/auth/me", null, signup.body.token)).status, 200);
});

test("signup validates input and defaults the role to citizen", async () => {
  assert.equal((await call("POST", "/auth/signup", { name: "B", email: "b@example.com", password: "short" })).status, 400);
  assert.equal((await call("POST", "/auth/signup", { name: "B", email: "b@example.com", password: "secret123", role: "admin" })).status, 400);
  assert.equal((await call("POST", "/auth/signup", { name: "B", email: "not-an-email", password: "secret123" })).status, 400);
  const ok = await call("POST", "/auth/signup", { name: "B", email: "b@example.com", password: "secret123" });
  assert.equal(ok.body.user.role, "citizen");
});

test("volunteer onboarding is role based", async () => {
  const citizen = (await call("POST", "/auth/signup", { name: "C", email: "c@example.com", password: "secret123" })).body.token;
  const medic = (await call("POST", "/auth/signup", { name: "M", email: "m@example.com", password: "secret123", role: "medical_support" })).body.token;
  const staff = (await call("POST", "/auth/signup", { name: "S", email: "s@example.com", password: "secret123", role: "emergency_staff" })).body.token;
  const form = { phone: "+91 98765 43210", city: "Pune", skills: ["First aid", "First aid", "CPR"], languages: ["mr", "hi"], availability: "weekends" };

  assert.equal((await call("POST", "/volunteers/onboarding", form, citizen)).status, 403);
  assert.equal((await call("POST", "/volunteers/onboarding", { ...form, skills: [] }, medic)).status, 400);
  const done = await call("POST", "/volunteers/onboarding", form, medic);
  assert.equal(done.status, 200);
  assert.equal(done.body.user.onboarding.completed, true);
  assert.deepEqual(done.body.user.onboarding.skills, ["First aid", "CPR"]);

  assert.equal((await call("GET", "/volunteers", null, medic)).status, 403);
  const found = await call("GET", "/volunteers?city=pune&skill=cpr", null, staff);
  assert.equal(found.status, 200);
  assert.deepEqual(found.body.volunteers.map((v) => v.name), ["M"]);
});

test("universal CORS: any origin, preflight with Authorization allowed", async () => {
  const pre = await fetch(base + "/auth/me", {
    method: "OPTIONS",
    headers: { Origin: "https://any-site.example", "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "authorization,content-type" },
  });
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get("access-control-allow-origin"), "*");
  assert.match(pre.headers.get("access-control-allow-headers"), /Authorization/i);
  const health = await fetch(base + "/health", { headers: { Origin: "http://localhost:3000" } });
  assert.equal(health.headers.get("access-control-allow-origin"), "*");
  const root = await fetch(base.replace(/\/api$/, "/"));
  assert.deepEqual(await root.json(), { name: "Talk2 backend", ok: true });
});
