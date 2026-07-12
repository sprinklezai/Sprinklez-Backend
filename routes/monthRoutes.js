const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

const SUMMARY_PATH =
  process.env.SALES_SUMMARY_PATH ||
  path.join(__dirname, "..", "data", "sales", "summaries");

function formatMonthLabel(month) {
  const match = String(month).match(/^(\d{4})_(\d{2})$/);

  if (!match) {
    return month;
  }

  const year = Number(match[1]);
  const monthNumber = Number(match[2]);

  const date = new Date(year, monthNumber - 1, 1);

  return date.toLocaleString("en-US", {
    month: "short",
    year: "numeric",
  });
}

router.get("/sales-months", (req, res) => {
  try {
    if (!fs.existsSync(SUMMARY_PATH)) {
      return res.json({
        success: true,
        months: [],
      });
    }

    const files = fs.readdirSync(SUMMARY_PATH);

    const months = files
      .map((fileName) => {
        const match = fileName.match(
          /^(\d{4}_\d{2})_sales_summary\.json$/i
        );

        return match ? match[1] : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.localeCompare(a))
      .map((month) => ({
        value: month,
        label: formatMonthLabel(month),
      }));

    return res.json({
      success: true,
      months,
      latestMonth: months[0]?.value || null,
    });
  } catch (error) {
    console.error("Month listing error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load available sales months",
      error: error.message,
    });
  }
});

module.exports = router;