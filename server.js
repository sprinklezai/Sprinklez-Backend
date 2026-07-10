require("dotenv").config();

const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const overviewRoutes = require("./routes/overviewRoutes");
const brandRoutes = require("./routes/brandRoutes");
const salesRoutes = require("./routes/salesRoutes");
const testRoutes = require("./routes/testRoutes");
const dataRoutes = require("./routes/dataRoutes");

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://webapp.sprinkleztrading.com",
  "https://api.sprinkleztrading.com",
  "https://sprinkleztrading.com",
  "https://www.sprinkleztrading.com",
];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.warn(`Blocked CORS origin: ${origin}`);
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

app.get("/", (req, res) => {
  res.status(200).send("Sprinklez Backend is running...");
});

app.use("/api", authRoutes);
app.use("/api", overviewRoutes);
app.use("/api", brandRoutes);
app.use("/api", salesRoutes);
app.use("/api", testRoutes);

// Keep generic data routes last.
app.use("/api", dataRoutes);

// Return JSON for unexpected application errors.
app.use((error, req, res, next) => {
  console.error("Unhandled server error:", error);

  if (res.headersSent) {
    return next(error);
  }

  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});