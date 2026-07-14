const jwt = require("jsonwebtoken");

function createAuthToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign(
    {
      emp_id: user.emp_id,
      emp_name: user.emp_name,
      designation: user.designation,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "8h",
      issuer: "sprinklez-dashboard",
      audience: "sprinklez-dashboard-users",
    }
  );
}

module.exports = { createAuthToken };
