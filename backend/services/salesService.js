const { downloadSalesZipFromDrive } = require("./googleDriveSalesService");
const AdmZip = require("adm-zip");
const { parse } = require("csv-parse/sync");
const { getData } = require("./excelService");


const SALES_BASE_URL =
  process.env.SALES_BASE_URL ||
  "https://sprinkleztrading.com/sales-data/monthly";

function normalize(value) {
  return String(value || "").trim().toUpperCase();
}

function toNumber(value) {
  const num = Number(value || 0);
  return Number.isNaN(num) ? 0 : num;
}

function getField(row, fieldName) {
  const key = Object.keys(row).find(
    (k) => String(k).trim().toLowerCase() === fieldName.toLowerCase()
  );

  return key ? row[key] : "";
}

function parseDate(value) {
  if (!value) return null;
  return String(value).split(" ")[0];
}

async function downloadZip(month = "2026_06") {
  return await downloadSalesZipFromDrive(month);
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
      status: store.status,
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

function sortDesc(data, key) {
  return [...data].sort((a, b) => Number(b[key] || 0) - Number(a[key] || 0));
}

function sortAsc(data, key) {
  return [...data].sort((a, b) => Number(a[key] || 0) - Number(b[key] || 0));
}

async function getSalesDashboard({
  brandCode,
  month = "2026_06",
  period = "MTD",
  country = "",
  store = "",
  search = "",
}) {
  const zipBuffer = await downloadZip(month);
  const rawRows = parseZipCsv(zipBuffer);
  const storeLookup = buildStoreLookup();

  let enrichedRows = rawRows
    .map((row) => {
      const storeCode = String(row["Store No_"] || "").trim();
      const storeInfo = storeLookup.get(storeCode);

      if (!storeInfo) return null;

      const quantity = Math.abs(toNumber(row["Quantity"]));
      const netAmount = Math.abs(toNumber(row["Net Amount"]));
      const discount = Math.abs(toNumber(row["Discount Amount"]));
      const receiptNo = String(row["Receipt No_"] || "").trim();

      return {
        date: parseDate(row["Date"]),
        store_code: storeCode,
        store_name: storeInfo.store_name,
        brand_code: storeInfo.brand_code,
        brand_name: storeInfo.brand_name,
        country_code: storeInfo.country_code,
        country_name: storeInfo.country_name,
        company_code: storeInfo.company_code,
        company_name: storeInfo.company_name,
        receipt_no: receiptNo,
        transaction_no: row["Transaction No_"],
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
        net_amount: netAmount,
        discount,
        net_sales: netAmount,
      };
    })
    .filter(Boolean)
    .filter((row) => normalize(row.brand_code) === normalize(brandCode));

  const allBrandRows = enrichedRows;

  if (country) {
    enrichedRows = enrichedRows.filter(
      (row) => normalize(row.country_name) === normalize(country)
    );
  }

  if (store) {
    enrichedRows = enrichedRows.filter(
      (row) => String(row.store_code) === String(store)
    );
  }

  if (search) {
    enrichedRows = enrichedRows.filter((row) =>
      normalize(row.item_description).includes(normalize(search))
    );
  }

  const netRevenue = enrichedRows.reduce((sum, row) => sum + row.net_sales, 0);
  const discounts = enrichedRows.reduce((sum, row) => sum + row.discount, 0);
  const itemsSold = enrichedRows.reduce((sum, row) => sum + row.quantity, 0);

  const uniqueReceipts = new Set(enrichedRows.map((row) => row.receipt_no));
  const orders = uniqueReceipts.size;
  const avgOrderValue = orders ? netRevenue / orders : 0;

  const dateMap = new Map();
  const countryMap = new Map();
  const companyMap = new Map();
  const salesTypeMap = new Map();
  const storeMap = new Map();
  const itemMap = new Map();

  enrichedRows.forEach((row) => {
    dateMap.set(row.date, (dateMap.get(row.date) || 0) + row.net_sales);

    countryMap.set(
      row.country_name,
      (countryMap.get(row.country_name) || 0) + row.net_sales
    );

    companyMap.set(
      row.company_name,
      (companyMap.get(row.company_name) || 0) + row.net_sales
    );

    salesTypeMap.set(
      row.sales_type,
      (salesTypeMap.get(row.sales_type) || 0) + row.net_sales
    );

    if (!storeMap.has(row.store_code)) {
      storeMap.set(row.store_code, {
        store_code: row.store_code,
        store_name: row.store_name,
        country_name: row.country_name,
        company_name: row.company_name,
        net_sales: 0,
        orders: new Set(),
        quantity: 0,
      });
    }

    const storeData = storeMap.get(row.store_code);
    storeData.net_sales += row.net_sales;
    storeData.quantity += row.quantity;
    storeData.orders.add(row.receipt_no);

    if (!itemMap.has(row.item_no)) {
      itemMap.set(row.item_no, {
        item_no: row.item_no,
        item_description: row.item_description,
        quantity: 0,
        net_sales: 0,
      });
    }

    const itemData = itemMap.get(row.item_no);
    itemData.quantity += row.quantity;
    itemData.net_sales += row.net_sales;
  });

  const storeRanking = Array.from(storeMap.values()).map((storeItem) => ({
    store_code: storeItem.store_code,
    store_name: storeItem.store_name,
    country_name: storeItem.country_name,
    company_name: storeItem.company_name,
    net_sales: storeItem.net_sales,
    orders: storeItem.orders.size,
    quantity: storeItem.quantity,
    avg_order_value: storeItem.orders.size
      ? storeItem.net_sales / storeItem.orders.size
      : 0,
  }));

  const itemRanking = Array.from(itemMap.values()).map((item) => ({
    item_no: item.item_no,
    item_description: item.item_description,
    quantity: item.quantity,
    net_sales: item.net_sales,
  }));

  const activeStoreCount = new Set(enrichedRows.map((row) => row.store_code))
    .size;

  const reportingDays = new Set(enrichedRows.map((row) => row.date)).size || 1;

  const averageDailySales = netRevenue / reportingDays;
  const averageDailySalesPerOutlet =
    activeStoreCount > 0 ? averageDailySales / activeStoreCount : 0;

  const countryOptions = Array.from(
    new Set(allBrandRows.map((row) => row.country_name).filter(Boolean))
  ).sort();

  const companyOptions = Array.from(
    new Set(allBrandRows.map((row) => row.company_name).filter(Boolean))
  ).sort();

  const storeOptions = Array.from(
    new Map(
      allBrandRows.map((row) => [
        row.store_code,
        {
          store_code: row.store_code,
          store_name: row.store_name,
          country_name: row.country_name,
        },
      ])
    ).values()
  ).sort((a, b) => String(a.store_name).localeCompare(String(b.store_name)));

  const salesTypeOptions = Array.from(
    new Set(allBrandRows.map((row) => row.sales_type).filter(Boolean))
  ).sort();

  return {
    success: true,
    brandCode,
    brandName: enrichedRows[0]?.brand_name || brandCode,
    month,
    kpis: {
      netRevenue,
      orders,
      avgOrderValue,
      discounts,
      discountPercent: netRevenue ? (discounts / netRevenue) * 100 : 0,
      itemsSold,
      activeStores: activeStoreCount,
      averageDailySales,
      averageDailySalesPerOutlet,
      rows: enrichedRows.length,
    },
    filters: {
      countries: countryOptions,
      companies: companyOptions,
      stores: storeOptions,
      salesTypes: salesTypeOptions,
      periods: ["WTD", "MTD", "YTD"],
    },
    revenueTrend: Array.from(dateMap.entries())
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => String(a.date).localeCompare(String(b.date))),
    countrySales: sortDesc(
      Array.from(countryMap.entries()).map(([name, value]) => ({
        name,
        value,
      })),
      "value"
    ),
    companySales: sortDesc(
      Array.from(companyMap.entries()).map(([name, value]) => ({
        name,
        value,
      })),
      "value"
    ),
    salesTypeMix: sortDesc(
      Array.from(salesTypeMap.entries()).map(([name, value]) => ({
        name,
        value,
      })),
      "value"
    ),
    topStores: sortDesc(storeRanking, "net_sales").slice(0, 10),
    bottomStores: sortAsc(storeRanking, "net_sales").slice(0, 10),
    topItems: sortDesc(itemRanking, "net_sales").slice(0, 10),
    bottomItems: sortAsc(itemRanking, "net_sales").slice(0, 10),
  };
}

module.exports = {
  getSalesDashboard,
};