const express = require("express");
const router = express.Router();

const {
  getSalesDashboard,
  refreshSalesMonth,
} = require("../services/salesService");

const {
  getAvailableSalesMonths,
  getLatestSalesMonth,
} = require("../services/salesMonthService");

/*
|--------------------------------------------------------------------------
| Available sales months
|--------------------------------------------------------------------------
|
| GET /api/sales-months
|--------------------------------------------------------------------------
*/

router.get("/sales-months", (req, res) => {
  try {
    const months = getAvailableSalesMonths();
    const latestMonth = getLatestSalesMonth();

    return res.json({
      success: true,
      latestMonth,
      count: months.length,
      months,
    });
  } catch (error) {
    console.error("Sales months API error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load available sales months",
      error: error.message,
    });
  }
});

/*
|--------------------------------------------------------------------------
| Sales dashboard
|--------------------------------------------------------------------------
|
| GET /api/sales/:brandCode
|--------------------------------------------------------------------------
*/

router.get("/sales/:brandCode", async (req, res) => {
  try {
    const { brandCode } = req.params;
    const {
      month,
      period,
      country,
      store,
      search,
    } = req.query;

    const selectedMonth =
      month || getLatestSalesMonth() || "2026_06";

    const data = await getSalesDashboard({
      brandCode,
      month: selectedMonth,
      period: period || "MTD",
      country: country || "",
      store: store || "",
      search: search || "",
    });

    return res.json(data);
  } catch (error) {
    console.error("Sales API error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load sales dashboard",
      error: error.message,
    });
  }
});

/*
|--------------------------------------------------------------------------
| Sales summary refresh check
|--------------------------------------------------------------------------
|
| POST /api/sales-refresh?month=2026_06
|--------------------------------------------------------------------------
*/

router.post("/sales-refresh", async (req, res) => {
  try {
    const selectedMonth =
      req.query.month ||
      getLatestSalesMonth() ||
      "2026_06";

    const result = await refreshSalesMonth(selectedMonth);

    return res.json(result);
  } catch (error) {
    console.error("Sales refresh error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to refresh sales cache",
      error: error.message,
    });
  }
});

module.exports = router;