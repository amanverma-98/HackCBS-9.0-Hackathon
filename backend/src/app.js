const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/auth");
const volunteerRoutes = require("./routes/volunteers");

function createApp() {
  const app = express();
  // Render (and most hosts) terminate HTTPS at a proxy in front of the app.
  app.set("trust proxy", 1);
  // Universal CORS: any origin, any method, Authorization header allowed; preflights answered.
  // The Android app does not need CORS at all; this is for web clients and testing tools.
  app.use(cors({ origin: "*", methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], allowedHeaders: ["Content-Type", "Authorization"], maxAge: 86400 }));
  app.use(express.json({ limit: "20kb" }));

  app.get("/", (req, res) => res.json({ name: "Talk2 backend", ok: true }));
  app.get("/api/health", (req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRoutes);
  app.use("/api/volunteers", volunteerRoutes);

  app.use((req, res) => res.status(404).json({ error: "Not found" }));
  // Express 5 forwards rejected async handlers here.
  app.use((err, req, res, next) => {
    if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON body" });
    if (err.name === "ValidationError") return res.status(400).json({ error: Object.values(err.errors)[0].message });
    if (err.code === 11000) return res.status(409).json({ error: "An account with this email already exists" });
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? "Server error" : err.message });
  });
  return app;
}

module.exports = createApp;
