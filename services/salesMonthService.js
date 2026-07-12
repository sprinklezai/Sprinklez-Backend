const fs = require("fs");
const path = require("path");

const SUMMARY_PATH =
  process.env.SALES_SUMMARY_PATH ||
  path.join(__dirname, "..", "data", "sales", "summaries");

function formatMonthLabel(value) {
  const match = /^(\d{4})_(\d{2})$/.exec(value);

  if (!match) {
    return value;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);

  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

function getAvailableSalesMonths() {
  if (!fs.existsSync(SUMMARY_PATH)) {
    throw new Error(`Sales summary folder not found: ${SUMMARY_PATH}`);
  }

  const filePattern = /^(\d{4}_\d{2})_sales_summary\.json$/i;

  return fs
    .readdirSync(SUMMARY_PATH)
    .map((fileName) => {
      const match = filePattern.exec(fileName);

      if (!match) {
        return null;
      }

      const value = match[1];

      return {
        value,
        label: formatMonthLabel(value),
        fileName,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.value.localeCompare(a.value));
}

function getLatestSalesMonth() {
  const months = getAvailableSalesMonths();
  return months[0]?.value || null;
}

module.exports = {
  getAvailableSalesMonths,
  getLatestSalesMonth,
};