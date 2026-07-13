const express = require("express");
const router = express.Router();

const {
  getPnlDashboard,
} = require("../services/pnlService");

router.get("/pnl/:brandCode", (req, res) => {
  try {
    const { brandCode } = req.params;
    const { fromDate, toDate } = req.query;

    const data = getPnlDashboard({
      brandCode,
      fromDate: fromDate || "",
      toDate: toDate || "",
    });

    return res.json(data);
  } catch (error) {
    console.error("P&L API error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load P&L dashboard",
      error: error.message,
    });
  }
});

module.exports = router;
