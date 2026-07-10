const fs = require("fs");
const path = require("path");

const SUMMARY_PATH =
  process.env.SALES_SUMMARY_PATH ||
  path.join(__dirname, "..", "data", "sales", "summaries");

function loadSalesSummary(month = "2026_06") {
  const filePath = path.join(
    SUMMARY_PATH,
    `${month}_sales_summary.json`
  );

  if (!fs.existsSync(filePath)) {
    throw new Error(`Sales summary not found: ${filePath}`);
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function getBrandSalesSummary(month, brandCode) {
  const summary = loadSalesSummary(month);

  const brand = summary.brands?.[
    String(brandCode || "").trim().toUpperCase()
  ];

  if (!brand) {
    throw new Error(
      `Brand ${brandCode} not found in sales summary for ${month}`
    );
  }

  return brand;
}

module.exports = {
  loadSalesSummary,
  getBrandSalesSummary,
};