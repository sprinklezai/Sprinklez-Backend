const express = require("express");
const router = express.Router();

const {
  getSalesDashboard,
  refreshSalesMonth,
} = require("../services/salesService");

const {
  getSalesAvailability,
  getLatestSalesMonth,
} = require("../services/salesMonthService");

router.get("/sales-months", (req, res) => {
  try {
    const availability = getSalesAvailability();

    return res.json({
      success: true,
      latestMonth: availability.latestMonth,
      latestAvailableDate:
        availability.latestAvailableDate,
      count: availability.months.length,
      months: availability.months,
    });
  } catch (error) {
    console.error(
      "Sales availability API error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to load available sales periods",
      error: error.message,
    });
  }
});

router.get("/sales/:brandCode", async (req, res) => {
  try {
    const { brandCode } = req.params;

    const {
      month,
      period,
      country,
      store,
      search,
      fromDate,
      toDate,
    } = req.query;

    const data = await getSalesDashboard({
      brandCode,
      month: month || getLatestSalesMonth(),
      period: period || "MTD",
      country: country || "",
      store: store || "",
      search: search || "",
      fromDate: fromDate || "",
      toDate: toDate || "",
    });

    return res.json(data);
  } catch (error) {
    console.error("Sales API error:", error);

    return res.status(500).json({
      success: false,
      message:
        "Failed to load sales dashboard",
      error: error.message,
    });
  }
});

router.post("/sales-refresh", async (req, res) => {
  try {
    const result = await refreshSalesMonth(
      req.query.month || getLatestSalesMonth()
    );

    return res.json(result);
  } catch (error) {
    console.error("Sales refresh error:", error);

    return res.status(500).json({
      success: false,
      message:
        "Failed to refresh sales data",
      error: error.message,
    });
  }
});

module.exports = router;
