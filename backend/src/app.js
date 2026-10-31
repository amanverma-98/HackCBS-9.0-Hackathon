const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/auth");
const volunteerRoutes = require("./routes/volunteers");

function createApp() {
  const app = express();
  const origins = (process.env.CORS_ORIGIN || "*").split(",").map((o) => o.trim());
  app.use(cors({ origin: origins.includes("*") ? "*" : origins }));
  app.use(express.json({ limit: "20kb" }));

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
