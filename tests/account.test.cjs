const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeBase, parseList, validAccount, friendlyError, AVAILABILITY, RESPONDER_ROLES } = require("../shared/account.cjs");
const { ROLES } = require("../shared/onboarding.cjs");
const backendRoles = require("../backend/src/config/roles.js");

test("server address: HTTPS, trailing slash and /api removed; LAN HTTP only for development", () => {
  assert.equal(normalizeBase("https://talk2-backend.onrender.com/"), "https://talk2-backend.onrender.com");
  assert.equal(normalizeBase(" https://talk2-backend.onrender.com/api "), "https://talk2-backend.onrender.com");
  assert.equal(normalizeBase("http://192.168.1.20:5000"), "http://192.168.1.20:5000");
  assert.equal(normalizeBase("http://example.com"), "", "plain HTTP to the internet is refused");
  assert.equal(normalizeBase(""), "");
});

test("lists and stored accounts", () => {
  assert.deepEqual(parseList("first aid, driving,  , first aid"), ["first aid", "driving"]);
  assert.equal(validAccount({ token: "", user: { email: "a@b.c" } }), null);
  assert.equal(validAccount({ token: "t" }), null);
  assert.deepEqual(validAccount({ token: "t", user: { email: "a@b.c" }, extra: 1 }), { token: "t", user: { email: "a@b.c" } });
});

test("errors are readable", () => {
  assert.match(friendlyError({ timedOut: true }), /wake/);
  assert.match(friendlyError({ offline: true }), /SOS work without it/);
  assert.equal(friendlyError({ status: 401, error: "Invalid email or password" }), "Invalid email or password");
  assert.match(friendlyError({ status: 401, error: "Token has been logged out" }), /signed out/);
  assert.match(friendlyError({ status: 404 }), /not reachable/);
});

test("app and backend agree on roles and volunteer options", () => {
  assert.deepEqual(backendRoles.ROLES, ROLES);
  assert.deepEqual(backendRoles.RESPONDER_ROLES, RESPONDER_ROLES);
  const routes = require("fs").readFileSync(require("path").join(__dirname, "../backend/src/routes/volunteers.js"), "utf8");
  assert.ok(routes.includes(JSON.stringify(AVAILABILITY).replace(/,/g, ", ")), "availability values match the backend");
});
