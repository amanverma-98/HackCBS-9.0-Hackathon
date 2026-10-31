const User = require("../models/User");
const RevokedToken = require("../models/RevokedToken");
const { verifyToken } = require("../utils/token");
const HttpError = require("../utils/httpError");

/** Requires a valid, non-revoked Bearer token and loads req.user. */
async function protect(req, res, next) {
  const [scheme, token] = (req.headers.authorization || "").split(" ");
  if (scheme !== "Bearer" || !token) throw new HttpError(401, "Not signed in");
  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw new HttpError(401, "Invalid or expired token");
  }
  if (await RevokedToken.exists({ jti: payload.jti })) throw new HttpError(401, "Token has been logged out");
  const user = await User.findById(payload.sub);
  if (!user) throw new HttpError(401, "Account no longer exists");
  req.user = user;
  req.token = payload;
  next();
}

/** Allows only the listed roles; use after protect. */
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) throw new HttpError(403, "Your role cannot access this");
  next();
};

module.exports = { protect, authorize };
