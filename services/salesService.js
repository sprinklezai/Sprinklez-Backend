const fs = require("fs");
const path = require("path");

const SUMMARY_PATH =
  process.env.SALES_SUMMARY_PATH ||
  path.join(__dirname, "..", "data", "sales", "summaries");

function normalize(value) {
  return String(value || "").trim().toUpperCase();
}

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

function getBrandSummary(month, brandCode) {
  const summary = loadSalesSummary(month);
  const normalizedBrandCode = normalize(brandCode);

  const brand = summary.brands?.[normalizedBrandCode];

  if (!brand) {
    throw new Error(
      `Brand ${normalizedBrandCode} not found in sales summary for ${month}`
    );
  }

  return structuredClone(brand);
}

function applyCountryFilter(data, country) {
  if (!country) return data;

  const normalizedCountry = normalize(country);

  data.storeDirectory = (data.storeDirectory || []).filter(
    (item) => normalize(item.country_name) === normalizedCountry
  );

  data.topStores = (data.topStores || []).filter(
    (item) => normalize(item.country_name) === normalizedCountry
  );

  data.bottomStores = (data.bottomStores || []).filter(
    (item) => normalize(item.country_name) === normalizedCountry
  );

  data.countrySales = (data.countrySales || []).filter(
    (item) => normalize(item.name) === normalizedCountry
  );

  return data;
}

function applyStoreFilter(data, storeCode) {
  if (!storeCode) return data;

  const normalizedStoreCode = String(storeCode).trim();

  data.storeDirectory = (data.storeDirectory || []).filter(
    (item) => String(item.store_code).trim() === normalizedStoreCode
  );

  data.topStores = [...data.storeDirectory];
  data.bottomStores = [...data.storeDirectory];

  return data;
}

function applySearchFilter(data, search) {
  if (!search) return data;

  const normalizedSearch = normalize(search);

  data.topItems = (data.topItems || []).filter((item) =>
    normalize(item.item_description || item.item_no).includes(normalizedSearch)
  );

  data.bottomItems = (data.bottomItems || []).filter((item) =>
    normalize(item.item_description || item.item_no).includes(normalizedSearch)
  );

  return data;
}

async function getSalesDashboard({
  brandCode,
  month = "2026_06",
  period = "MTD",
  country = "",
  store = "",
  search = "",
}) {
  let data = getBrandSummary(month, brandCode);

  data.period = period;
  data.currency = "AED";

  data = applyCountryFilter(data, country);
  data = applyStoreFilter(data, store);
  data = applySearchFilter(data, search);

  return data;
}

async function refreshSalesMonth(month = "2026_06") {
  const filePath = path.join(
    SUMMARY_PATH,
    `${month}_sales_summary.json`
  );

  if (!fs.existsSync(filePath)) {
    throw new Error(`Sales summary not found: ${filePath}`);
  }

  return {
    success: true,
    message: `Sales summary is available for ${month}`,
    file: path.basename(filePath),
  };
}

module.exports = {
  getSalesDashboard,
  refreshSalesMonth,
};