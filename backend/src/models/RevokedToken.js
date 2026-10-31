const mongoose = require("mongoose");

// Logged-out tokens. MongoDB deletes each entry once the token would have expired anyway.
const revokedTokenSchema = new mongoose.Schema({
  jti: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
});

module.exports = mongoose.model("RevokedToken", revokedTokenSchema);
