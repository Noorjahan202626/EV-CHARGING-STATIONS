// backend/middleware/auth.js
import jwt from "jsonwebtoken";

/**
 * Middleware to protect routes.
 * Expects the Authorization header in the form "Bearer <token>".
 * On success attaches decoded payload to req.user and calls next().
 */
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({
      ok: false,
      error: "Missing or malformed Authorization header"
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET_KEY || "dev-secret"
    );

    req.user = payload; // { userId, email, role, iat, exp }
    next();
  } catch (err) {
    return res.status(401).json({
      ok: false,
      error: "Invalid or expired token"
    });
  }
}