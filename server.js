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

/*
|--------------------------------------------------------------------------
| Middleware
|--------------------------------------------------------------------------
*/

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://webapp.sprinkleztrading.com",
  "https://api.sprinkleztrading.com",
];

app.use(
  cors({
    origin(origin, callback) {
      // Allow Postman/server-to-server requests
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.log("Blocked Origin:", origin);
      return callback(new Error("CORS not allowed"));
    },
    credentials: true,
  })
);

app.use(express.json());

/*
|--------------------------------------------------------------------------
| Routes
|--------------------------------------------------------------------------
*/

app.get("/", (req, res) => {
  res.send("Sprinklez Backend is running...");
});

app.use("/api", authRoutes);
app.use("/api", overviewRoutes);
app.use("/api", brandRoutes);
app.use("/api", salesRoutes);
app.use("/api", testRoutes);
app.use("/api", dataRoutes);


/*
|--------------------------------------------------------------------------
| Start Server
|--------------------------------------------------------------------------
*/

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});