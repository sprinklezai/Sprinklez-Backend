const fs = require("fs");
const path = require("path");

const PNL_DATA_PATH =
  process.env.PNL_DATA_PATH ||
  path.join(__dirname, "..", "data", "pnl");

function normalize(value) {
  return String(value ?? "").trim().toUpperCase();
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`P&L data file not found: ${filePath}`);
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function getAvailablePnlFiles() {
  if (!fs.existsSync(PNL_DATA_PATH)) {
    return [];
  }

  return fs
    .readdirSync(PNL_DATA_PATH)
    .filter((name) =>
      /^\d{4}_\d{2}_pnl\.json$/i.test(name)
    )
    .sort();
}

function filterByDate(rows, fromDate, toDate) {
  return (rows || []).filter((row) => {
    const date = String(row.date || "");

    if (fromDate && date < fromDate) {
      return false;
    }

    if (toDate && date > toDate) {
      return false;
    }

    return true;
  });
}

function buildAlerts(kpis, storePnl) {
  const alerts = [];

  if (kpis.grossMarginPercent < 60) {
    alerts.push({
      level: "warning",
      message: `Gross margin is ${kpis.grossMarginPercent.toFixed(
        1
      )}% and is below the 60% review threshold.`,
    });
  }

  if (kpis.ebitdaMarginPercent < 10) {
    alerts.push({
      level: "critical",
      message: `EBITDA margin is ${kpis.ebitdaMarginPercent.toFixed(
        1
      )}% and requires management attention.`,
    });
  }

  const lossStores = storePnl.filter(
    (store) => Number(store.ebitda || 0) < 0
  );

  if (lossStores.length > 0) {
    alerts.push({
      level: "critical",
      message: `${lossStores.length} store(s) generated negative EBITDA in the selected period.`,
    });
  }

  const highLaborShare =
    kpis.revenue > 0
      ? (kpis.laborCost / kpis.revenue) * 100
      : 0;

  if (highLaborShare > 25) {
    alerts.push({
      level: "warning",
      message: `Labor cost is ${highLaborShare.toFixed(
        1
      )}% of revenue.`,
    });
  }

  const deliveryFeeShare =
    kpis.revenue > 0
      ? (kpis.deliveryFees / kpis.revenue) * 100
      : 0;

  if (deliveryFeeShare > 12) {
    alerts.push({
      level: "warning",
      message: `Delivery fees are ${deliveryFeeShare.toFixed(
        1
      )}% of revenue.`,
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      level: "info",
      message: "No major P&L exceptions detected for the selected period.",
    });
  }

  return alerts;
}

function getPnlDashboard({
  brandCode,
  fromDate = "",
  toDate = "",
}) {
  const files = getAvailablePnlFiles();

  if (files.length === 0) {
    throw new Error(
      `No P&L files found in ${PNL_DATA_PATH}`
    );
  }

  const rows = [];

  for (const fileName of files) {
    const data = readJson(
      path.join(PNL_DATA_PATH, fileName)
    );

    rows.push(...(data.rows || []));
  }

  const normalizedBrandCode =
    normalize(brandCode);

  const filtered = filterByDate(
    rows.filter(
      (row) =>
        normalize(row.brand_code) ===
        normalizedBrandCode
    ),
    fromDate,
    toDate
  );

  if (filtered.length === 0) {
    throw new Error(
      `No P&L data found for ${normalizedBrandCode}`
    );
  }

  const totals = filtered.reduce(
    (acc, row) => {
      acc.revenue += Number(row.revenue || 0);
      acc.cogs += Number(row.cogs || 0);
      acc.laborCost += Number(row.labor_cost || 0);
      acc.occupancyCost += Number(row.occupancy_cost || 0);
      acc.deliveryFees += Number(row.delivery_fees || 0);
      acc.otherOpex += Number(row.other_opex || 0);

      return acc;
    },
    {
      revenue: 0,
      cogs: 0,
      laborCost: 0,
      occupancyCost: 0,
      deliveryFees: 0,
      otherOpex: 0,
    }
  );

  const grossProfit =
    totals.revenue - totals.cogs;

  const ebitda =
    grossProfit -
    totals.laborCost -
    totals.occupancyCost -
    totals.deliveryFees -
    totals.otherOpex;

  const kpis = {
    ...totals,
    grossProfit,
    grossMarginPercent:
      totals.revenue > 0
        ? (grossProfit / totals.revenue) * 100
        : 0,
    ebitda,
    ebitdaMarginPercent:
      totals.revenue > 0
        ? (ebitda / totals.revenue) * 100
        : 0,
  };

  const monthMap = new Map();
  const storeMap = new Map();

  for (const row of filtered) {
    const month =
      String(row.date || "").slice(0, 7);

    if (!monthMap.has(month)) {
      monthMap.set(month, {
        month,
        revenue: 0,
        grossProfit: 0,
        ebitda: 0,
      });
    }

    const monthItem =
      monthMap.get(month);

    const rowRevenue =
      Number(row.revenue || 0);

    const rowCogs =
      Number(row.cogs || 0);

    const rowGrossProfit =
      rowRevenue - rowCogs;

    const rowEbitda =
      rowGrossProfit -
      Number(row.labor_cost || 0) -
      Number(row.occupancy_cost || 0) -
      Number(row.delivery_fees || 0) -
      Number(row.other_opex || 0);

    monthItem.revenue += rowRevenue;
    monthItem.grossProfit += rowGrossProfit;
    monthItem.ebitda += rowEbitda;

    const storeCode =
      String(row.store_code || "").trim();

    if (!storeMap.has(storeCode)) {
      storeMap.set(storeCode, {
        store_code: storeCode,
        store_name:
          row.store_name || storeCode,
        revenue: 0,
        gross_profit: 0,
        ebitda: 0,
      });
    }

    const store =
      storeMap.get(storeCode);

    store.revenue += rowRevenue;
    store.gross_profit +=
      rowGrossProfit;

    store.ebitda +=
      rowEbitda;
  }

  const storePnl =
    Array.from(storeMap.values())
      .map((store) => ({
        ...store,
        ebitda_margin_percent:
          store.revenue > 0
            ? (store.ebitda /
                store.revenue) *
              100
            : 0,
      }))
      .sort(
        (a, b) =>
          Number(b.ebitda || 0) -
          Number(a.ebitda || 0)
      );

  return {
    success: true,
    brandCode:
      normalizedBrandCode,
    brandName:
      filtered[0]?.brand_name ||
      normalizedBrandCode,
    fromDate:
      fromDate || null,
    toDate:
      toDate || null,
    currency: "AED",
    kpis,
    monthlyTrend:
      Array.from(monthMap.values()).sort(
        (a, b) =>
          a.month.localeCompare(
            b.month
          )
      ),
    costMix: [
      {
        name: "COGS",
        value: totals.cogs,
      },
      {
        name: "Labor",
        value: totals.laborCost,
      },
      {
        name: "Occupancy",
        value: totals.occupancyCost,
      },
      {
        name: "Delivery Fees",
        value: totals.deliveryFees,
      },
      {
        name: "Other Opex",
        value: totals.otherOpex,
      },
    ],
    storePnl,
    executiveAlerts:
      buildAlerts(kpis, storePnl),
  };
}

module.exports = {
  getPnlDashboard,
};
