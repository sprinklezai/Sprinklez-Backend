const fs = require("fs");
const path = require("path");

const month = process.argv[2];

if (!/^\d{4}_\d{2}$/.test(String(month || ""))) {
  console.error("Usage: node scripts/validateMonthAgainstDaily.js YYYY_MM");
  process.exit(1);
}

const ROOT = path.resolve(__dirname, "..");
const monthlyFile = path.join(
  ROOT,
  "data",
  "sales",
  "summaries",
  `${month}_sales_summary.json`
);
const dailyFolder = path.join(ROOT, "data", "sales", "daily", month);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sumSummary(summary) {
  const result = {};

  for (const [brandCode, brand] of Object.entries(summary.brands || {})) {
    result[brandCode] = (brand.daily || []).reduce(
      (total, day) => {
        total.netRevenue += Number(day.net_sales || 0);
        total.orders += Number(day.orders || 0);
        total.quantity += Number(day.quantity || 0);
        return total;
      },
      { netRevenue: 0, orders: 0, quantity: 0 }
    );
  }

  return result;
}

if (!fs.existsSync(monthlyFile)) {
  throw new Error(`Monthly summary not found: ${monthlyFile}`);
}

if (!fs.existsSync(dailyFolder)) {
  throw new Error(`Daily summary folder not found: ${dailyFolder}`);
}

const monthlyTotals = sumSummary(readJson(monthlyFile));
const dailyTotals = {};

const files = fs
  .readdirSync(dailyFolder)
  .filter((name) =>
    new RegExp(`^${month}_\\d{2}_sales_summary\\.json$`, "i").test(name)
  )
  .sort();

for (const fileName of files) {
  const totals = sumSummary(readJson(path.join(dailyFolder, fileName)));

  for (const [brandCode, values] of Object.entries(totals)) {
    if (!dailyTotals[brandCode]) {
      dailyTotals[brandCode] = {
        netRevenue: 0,
        orders: 0,
        quantity: 0,
      };
    }

    dailyTotals[brandCode].netRevenue += values.netRevenue;
    dailyTotals[brandCode].orders += values.orders;
    dailyTotals[brandCode].quantity += values.quantity;
  }
}

const brands = Array.from(
  new Set([...Object.keys(monthlyTotals), ...Object.keys(dailyTotals)])
).sort();

console.log(`Daily files checked: ${files.length}`);

console.table(
  brands.map((brand) => ({
    brand,
    monthlyRevenue: Number(monthlyTotals[brand]?.netRevenue || 0).toFixed(2),
    dailyRevenue: Number(dailyTotals[brand]?.netRevenue || 0).toFixed(2),
    revenueDifference: (
      Number(monthlyTotals[brand]?.netRevenue || 0) -
      Number(dailyTotals[brand]?.netRevenue || 0)
    ).toFixed(2),
    monthlyOrders: Number(monthlyTotals[brand]?.orders || 0),
    dailyOrders: Number(dailyTotals[brand]?.orders || 0),
  }))
);
