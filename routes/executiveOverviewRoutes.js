const express = require("express");
const router = express.Router();

const {
  getExecutiveOverview,
} = require("../services/executiveOverviewService");

router.get("/executive-overview", (req, res) => {
  try {
    const { period, country } = req.query;

    const data = getExecutiveOverview({
      period: period || "MTD",
      country: country || "",
    });

    return res.json(data);
  } catch (error) {
    console.error(
      "Executive overview API error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to load executive overview",
      error: error.message,
    });
  }
});

module.exports = router;
