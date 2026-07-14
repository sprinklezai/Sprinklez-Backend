const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  const header = String(req.headers.authorization || "");

  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  try {
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not configured");
    }

    req.user = jwt.verify(
      header.slice(7),
      process.env.JWT_SECRET,
      {
        issuer: "sprinklez-dashboard",
        audience: "sprinklez-dashboard-users",
      }
    );

    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Your login session is invalid or expired",
    });
  }
}

module.exports = { requireAuth };
