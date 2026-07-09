const AdmZip = require("adm-zip");
const { parse } = require("csv-parse/sync");
const { getData } = require("./excelService");
const { loadSalesZip } = require("./fileStorageService");

const monthCache = new Map();

function normalize(value) {
  return String(value || "").trim().toUpperCase();
}

function toNumber(value) {
  const num = Number(value || 0);
  return Number.isNaN(num) ? 0 : num;
}

function parseDate(value) {
  if (!value) return null;
  return String(value).split(" ")[0];
}

function getField(row, fieldName) {
  const key = Object.keys(row).find(
    (k) => String(k).trim().toLowerCase() === fieldName.toLowerCase()
  );

  return key ? row[key] : "";
}

function getAedRate(countryName) {
  const country = normalize(countryName);

  if (country.includes("OMAN")) return 9.55;
  if (country.includes("KUWAIT")) return 12.1;
  if (country.includes("BAHRAIN")) return 9.74;

  return 1;
}

function buildStoreLookup() {
  const stores = getData("stores");
  const brands = getData("brands");
  const countries = getData("countries");
  const companies = getData("companies");

  const brandMap = new Map(
    brands.map((brand) => [normalize(brand.brand_code), brand.brand_name])
  );

  const countryMap = new Map(
    countries.map((country) => [
      normalize(country.country_code),
      country.country_name,
    ])
  );

  const companyMap = new Map(
    companies.map((company) => [
      normalize(company.company_code),
      company.company_name,
    ])
  );

  const storeMap = new Map();

  stores.forEach((store) => {
    const storeCode = String(store.store_code || "").trim();
    const brandCode = normalize(store.brand_code);
    const countryCode = normalize(store.country_code);
    const companyCode = normalize(store.company_code);

    storeMap.set(storeCode, {
      store_code: storeCode,
      store_name: store.store_name,
      brand_code: brandCode,
      brand_name: brandMap.get(brandCode) || brandCode,
      country_code: countryCode,
      country_name: countryMap.get(countryCode) || countryCode,
      company_code: companyCode,
      company_name: companyMap.get(companyCode) || companyCode,
    });
  });

  return storeMap;
}

function parseZipCsv(buffer) {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();

  let allRows = [];

  entries.forEach((entry) => {
    if (!entry.entryName.toLowerCase().endsWith(".csv")) return;

    const csvText = entry.getData().toString("utf8");

    const rows = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      bom: true,
      relax_quotes: true,
      relax_column_count: true,
      trim: true,
    });

    allRows = allRows.concat(rows);
  });

  return allRows;
}

async function loadSalesMonth(month = "2026_06", forceRefresh = false) {
  if (!forceRefresh && monthCache.has(month)) {
    return monthCache.get(month);
  }

  const zipBuffer = await loadSalesZip(month);
  const rawRows = parseZipCsv(zipBuffer);
  const storeLookup = buildStoreLookup();

  const rows = rawRows
    .map((row) => {
      const storeCode = String(getField(row, "Store No_") || "").trim();
      const storeInfo = storeLookup.get(storeCode);

      if (!storeInfo) return null;

      const rate = getAedRate(storeInfo.country_name);

      const quantity = Math.abs(toNumber(getField(row, "Quantity")));
      const netAmountLocal = Math.abs(toNumber(getField(row, "Net Amount")));
      const discountLocal = Math.abs(toNumber(getField(row, "Discount Amount")));

      const netAmountAed = netAmountLocal * rate;
      const discountAed = discountLocal * rate;

      return {
        date: parseDate(getField(row, "Date")),
        store_code: storeCode,
        store_name: storeInfo.store_name,
        brand_code: storeInfo.brand_code,
        brand_name: storeInfo.brand_name,
        country_code: storeInfo.country_code,
        country_name: storeInfo.country_name,
        company_code: storeInfo.company_code,
        company_name: storeInfo.company_name,

        receipt_no: String(getField(row, "Receipt No_") || "").trim(),
        transaction_no: getField(row, "Transaction No_"),

        item_no: getField(row, "Item No_"),
        item_description:
          getField(row, "Item Description") ||
          getField(row, "Description") ||
          getField(row, "Item Description 2") ||
          getField(row, "Item No_") ||
          "Unknown Item",

        category_code: getField(row, "Item Category Code"),
        retail_product_code: getField(row, "Retail Product Code"),
        sales_type: normalize(getField(row, "Sales Type") || "UNKNOWN"),

        quantity,
        conversion_rate: rate,

        net_amount_local: netAmountLocal,
        net_amount_aed: netAmountAed,

        discount_local: discountLocal,
        discount_aed: discountAed,

        net_sales: netAmountAed,
        discount: discountAed,
      };
    })
    .filter(Boolean);

  monthCache.set(month, rows);

  return rows;
}

function clearSalesMonth(month) {
  if (month) {
    monthCache.delete(month);
  } else {
    monthCache.clear();
  }
}

module.exports = {
  loadSalesMonth,
  clearSalesMonth,
};