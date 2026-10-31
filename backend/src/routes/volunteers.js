const express = require("express");
const User = require("../models/User");
const { protect, authorize } = require("../middleware/auth");
const { RESPONDER_ROLES } = require("../config/roles");
const HttpError = require("../utils/httpError");

const router = express.Router();
const AVAILABILITY = ["anytime", "weekdays", "weekends", "on_call"];
const list = (value) =>
  Array.isArray(value)
    ? [...new Set(value.filter((v) => typeof v === "string").map((v) => v.trim()).filter(Boolean))].slice(0, 20)
    : [];

// POST /api/volunteers/onboarding — responders fill in how and where they can help.
router.post("/onboarding", protect, authorize(...RESPONDER_ROLES), async (req, res) => {
  const { phone, city, availability } = req.body || {};
  const skills = list(req.body?.skills), languages = list(req.body?.languages);
  if (typeof phone !== "string" || !/^\+?[0-9 -]{7,20}$/.test(phone.trim())) throw new HttpError(400, "Enter a valid phone number");
  if (typeof city !== "string" || !city.trim()) throw new HttpError(400, "City is required");
  if (!skills.length) throw new HttpError(400, "Add at least one skill");
  if (!AVAILABILITY.includes(availability)) throw new HttpError(400, `Availability must be one of: ${AVAILABILITY.join(", ")}`);
  req.user.onboarding = {
    completed: true,
    phone: phone.trim(),
    city: city.trim(),
    skills,
    languages,
    availability,
    completedAt: new Date(),
  };
  await req.user.save();
  res.json({ user: req.user });
});

// GET /api/volunteers?city=&skill= — emergency staff find onboarded responders.
router.get("/", protect, authorize("emergency_staff"), async (req, res) => {
  const filter = { role: { $in: RESPONDER_ROLES }, "onboarding.completed": true };
  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (typeof req.query.city === "string" && req.query.city.trim())
    filter["onboarding.city"] = new RegExp(`^${escape(req.query.city.trim())}$`, "i");
  if (typeof req.query.skill === "string" && req.query.skill.trim())
    filter["onboarding.skills"] = new RegExp(`^${escape(req.query.skill.trim())}$`, "i");
  const volunteers = await User.find(filter).sort({ "onboarding.completedAt": -1 }).limit(200);
  res.json({ count: volunteers.length, volunteers });
});

module.exports = router;
