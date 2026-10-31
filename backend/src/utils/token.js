const crypto = require("crypto");
const jwt = require("jsonwebtoken");

// Long-lived by design (default 10 years) so field volunteers stay signed in; logout revokes.
const expiresIn = () => process.env.JWT_EXPIRES_IN || "3650d";

function signToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role }, process.env.JWT_SECRET, {
    expiresIn: expiresIn(),
    jwtid: crypto.randomUUID(),
  });
}

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
}

module.exports = { signToken, verifyToken };
