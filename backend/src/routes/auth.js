const express = require("express");
const User = require("../models/User");
const RevokedToken = require("../models/RevokedToken");
const { protect } = require("../middleware/auth");
const { signToken } = require("../utils/token");
const { ROLES } = require("../config/roles");
const HttpError = require("../utils/httpError");

const router = express.Router();
const text = (value) => (typeof value === "string" ? value.trim() : "");

// POST /api/auth/signup  { name, email, password, role? }
router.post("/signup", async (req, res) => {
  const name = text(req.body?.name), email = text(req.body?.email).toLowerCase();
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const role = req.body?.role === undefined ? "citizen" : req.body.role;
  if (!name || !email || !password) throw new HttpError(400, "Name, email and password are required");
  if (password.length < 8) throw new HttpError(400, "Password must be at least 8 characters");
  if (!ROLES.includes(role)) throw new HttpError(400, `Role must be one of: ${ROLES.join(", ")}`);
  if (await User.exists({ email })) throw new HttpError(409, "An account with this email already exists");
  const user = await User.create({ name, email, password, role });
  res.status(201).json({ token: signToken(user), user });
});

// POST /api/auth/login  { email, password }
router.post("/login", async (req, res) => {
  const email = text(req.body?.email).toLowerCase();
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!email || !password) throw new HttpError(400, "Email and password are required");
  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await user.matchPassword(password))) throw new HttpError(401, "Invalid email or password");
  res.json({ token: signToken(user), user });
});

// POST /api/auth/logout  (Bearer token) — revokes this token only.
router.post("/logout", protect, async (req, res) => {
  await RevokedToken.updateOne(
    { jti: req.token.jti },
    { $setOnInsert: { jti: req.token.jti, expiresAt: new Date(req.token.exp * 1000) } },
    { upsert: true },
  );
  res.json({ message: "Logged out" });
});

// GET /api/auth/me
router.get("/me", protect, (req, res) => res.json({ user: req.user }));

module.exports = router;
