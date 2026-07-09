const express = require("express");
const https = require("https");

const router = express.Router();

router.get("/test-download", async (req, res) => {
  const url =
    "https://sprinkleztrading.com/sales-data/monthly/2026_06_sales.zip";

  const start = Date.now();

  https
    .get(url, (response) => {
      let bytes = 0;

      response.on("data", (chunk) => {
        bytes += chunk.length;
      });

      response.on("end", () => {
        res.json({
          success: true,
          status: response.statusCode,
          bytes,
          duration_ms: Date.now() - start,
        });
      });
    })
    .on("error", (err) => {
      res.status(500).json({
        success: false,
        name: err.name,
        code: err.code,
        message: err.message,
      });
    });
});

module.exports = router;