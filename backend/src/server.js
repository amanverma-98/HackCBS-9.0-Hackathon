require("dotenv").config();
const connectDB = require("./config/db");
const createApp = require("./app");

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error("Set JWT_SECRET (at least 32 characters) in backend/.env");
  process.exit(1);
}

const port = Number(process.env.PORT) || 5000;
connectDB(process.env.MONGODB_URI)
  .then(() => createApp().listen(port, () => console.log(`Talk2 backend listening on port ${port}`)))
  .catch((err) => {
    console.error("Startup failed:", err.message);
    process.exit(1);
  });
