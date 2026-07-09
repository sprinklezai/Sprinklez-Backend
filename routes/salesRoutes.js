const express = require("express");
const router = express.Router();

const { getSalesDashboard, refreshSalesMonth } = require("../services/salesService");

router.get("/sales/:brandCode", async (req, res) => {
  try {
    const { brandCode } = req.params;
    const { month, period, country, store, search } = req.query;

    const data = await getSalesDashboard({
      brandCode,
      month: month || "2026_06",
      period: period || "MTD",
      country: country || "",
      store: store || "",
      search: search || "",
    });

    res.json(data);
  } catch (error) {
    console.error("Sales API error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load sales dashboard",
      error: error.message,
    });
  }
});

router.post("/sales-refresh", async (req, res) => {
  try {
    const { month } = req.query;

    const result = await refreshSalesMonth(month || "2026_06");

    res.json(result);
  } catch (error) {
    console.error("Sales refresh error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to refresh sales cache",
      error: error.message,
    });
  }
});

module.exports = router;