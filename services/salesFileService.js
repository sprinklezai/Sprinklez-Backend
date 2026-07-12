const fs = require("fs");
const path = require("path");

const MONTHLY_SUMMARY_PATH =
  process.env.SALES_SUMMARY_PATH ||
  path.join(__dirname, "..", "data", "sales", "summaries");

const DAILY_SUMMARY_PATH =
  process.env.DAILY_SALES_SUMMARY_PATH ||
  path.join(__dirname, "..", "data", "sales", "daily");

const MONTHLY_PATTERN =
  /^(\d{4})_(\d{2})_sales_summary\.json$/i;

const DAILY_PATTERN =
  /^(\d{4})_(\d{2})_(\d{2})_sales_summary\.json$/i;

function isDirectory(directoryPath) {
  return (
    fs.existsSync(directoryPath) &&
    fs.statSync(directoryPath).isDirectory()
  );
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Sales summary file not found: ${filePath}`);
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function formatMonthValue(year, month) {
  return `${String(year).padStart(4, "0")}_${String(month).padStart(2, "0")}`;
}

function formatDateValue(year, month, day) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(
    2,
    "0"
  )}-${String(day).padStart(2, "0")}`;
}

function getMonthlySummaryFile(monthValue) {
  return path.join(
    MONTHLY_SUMMARY_PATH,
    `${monthValue}_sales_summary.json`
  );
}

function getDailyMonthDirectory(monthValue) {
  return path.join(DAILY_SUMMARY_PATH, monthValue);
}

function getMonthlySummaries() {
  if (!isDirectory(MONTHLY_SUMMARY_PATH)) {
    return [];
  }

  return fs
    .readdirSync(MONTHLY_SUMMARY_PATH)
    .map((fileName) => {
      const match = MONTHLY_PATTERN.exec(fileName);

      if (!match) return null;

      const year = Number(match[1]);
      const month = Number(match[2]);
      const value = formatMonthValue(year, month);

      return {
        type: "monthly",
        value,
        year,
        month,
        fileName,
        filePath: path.join(MONTHLY_SUMMARY_PATH, fileName),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.value.localeCompare(b.value));
}

function getDailySummariesForMonth(monthValue) {
  const monthDirectory = getDailyMonthDirectory(monthValue);

  if (!isDirectory(monthDirectory)) {
    return [];
  }

  return fs
    .readdirSync(monthDirectory)
    .map((fileName) => {
      const match = DAILY_PATTERN.exec(fileName);

      if (!match) return null;

      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      const fileMonthValue = formatMonthValue(year, month);

      if (fileMonthValue !== monthValue) {
        return null;
      }

      return {
        type: "daily",
        value: formatDateValue(year, month, day),
        monthValue: fileMonthValue,
        year,
        month,
        day,
        fileName,
        filePath: path.join(monthDirectory, fileName),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.value.localeCompare(b.value));
}

function getAllDailySummaries() {
  if (!isDirectory(DAILY_SUMMARY_PATH)) {
    return [];
  }

  return fs
    .readdirSync(DAILY_SUMMARY_PATH, {
      withFileTypes: true,
    })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        /^\d{4}_\d{2}$/.test(entry.name)
    )
    .flatMap((entry) =>
      getDailySummariesForMonth(entry.name)
    )
    .sort((a, b) => a.value.localeCompare(b.value));
}

function hasMonthlySummary(monthValue) {
  return fs.existsSync(
    getMonthlySummaryFile(monthValue)
  );
}

function loadMonthlySummary(monthValue) {
  return readJson(
    getMonthlySummaryFile(monthValue)
  );
}

function loadDailySummary(filePath) {
  return readJson(filePath);
}

function getAvailableMonthValues() {
  const months = new Set();

  for (const monthly of getMonthlySummaries()) {
    months.add(monthly.value);
  }

  for (const daily of getAllDailySummaries()) {
    months.add(daily.monthValue);
  }

  return Array.from(months).sort();
}

function getLatestAvailableDate() {
  const allDates = [];

  for (const daily of getAllDailySummaries()) {
    allDates.push(daily.value);
  }

  for (const monthly of getMonthlySummaries()) {
    const summary = readJson(monthly.filePath);

    for (const brand of Object.values(summary.brands || {})) {
      for (const day of brand.daily || []) {
        if (day.date) {
          allDates.push(String(day.date));
        }
      }
    }
  }

  return allDates.sort().at(-1) || null;
}

module.exports = {
  MONTHLY_SUMMARY_PATH,
  DAILY_SUMMARY_PATH,
  getMonthlySummaries,
  getDailySummariesForMonth,
  getAllDailySummaries,
  getAvailableMonthValues,
  getLatestAvailableDate,
  hasMonthlySummary,
  loadMonthlySummary,
  loadDailySummary,
};
