const fs = require("fs");
const path = require("path");
const unzipper = require("unzipper");
const { parse } = require("csv-parse");
const xlsx = require("xlsx");

const month = process.argv[2] || "2026_06";

const ROOT = path.resolve(__dirname, "..");

const SALES_ZIP = path.join(
  ROOT,
  "data",
  "sales",
  "monthly",
  `${month}_sales.zip`
);

const MASTER_DIR =
  process.env.MASTERS_DATA_PATH ||
  path.join(ROOT, "data", "masters");

const OUTPUT_DIR = path.join(
  ROOT,
  "data",
  "sales",
  "summaries"
);

const OUTPUT_FILE = path.join(
  OUTPUT_DIR,
  `${month}_sales_summary.json`
);

function normalize(value) {
  return String(value ?? "").trim().toUpperCase();
}

function toNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function parseDate(value) {
  if (!value) return "";

  const date = String(value).split(" ")[0].trim();

  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
}

function getField(row, fieldName) {
  const normalizedField = fieldName.trim().toLowerCase();

  const key = Object.keys(row).find(
    (item) => String(item).trim().toLowerCase() === normalizedField
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

function readMaster(fileName) {
  const filePath = path.join(MASTER_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Master file not found: ${filePath}`);
  }

  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  return xlsx.utils.sheet_to_json(sheet, {
    defval: "",
  });
}

function buildStoreLookup() {
  const stores = readMaster("Store_Master.xlsx");
  const brands = readMaster("Brand_Master.xlsx");
  const countries = readMaster("Country_Master.xlsx");
  const companies = readMaster("Company_Master.xlsx");

  const brandMap = new Map(
    brands.map((brand) => [
      normalize(brand.brand_code),
      brand.brand_name || brand.brand_desc || brand.brand_code,
    ])
  );

  const countryMap = new Map(
    countries.map((country) => [
      normalize(country.country_code),
      country.country_name || country.country_code,
    ])
  );

  const companyMap = new Map(
    companies.map((company) => [
      normalize(company.company_code),
      company.company_name || company.company_code,
    ])
  );

  const lookup = new Map();

  for (const store of stores) {
    const storeCode = String(store.store_code || "").trim();

    if (!storeCode) continue;

    const brandCode = normalize(store.brand_code);
    const countryCode = normalize(store.country_code);
    const companyCode = normalize(store.company_code);

    lookup.set(storeCode, {
      store_code: storeCode,
      store_name: store.store_name || storeCode,
      brand_code: brandCode,
      brand_name: brandMap.get(brandCode) || brandCode,
      country_code: countryCode,
      country_name: countryMap.get(countryCode) || countryCode,
      company_code: companyCode,
      company_name: companyMap.get(companyCode) || companyCode,
    });
  }

  return lookup;
}

function createBrandBucket(storeInfo) {
  return {
    brandCode: storeInfo.brand_code,
    brandName: storeInfo.brand_name,
    countries: new Set(),
    stores: new Map(),
    daily: new Map(),
  };
}

function createDailyBucket(date) {
  return {
    date,
    net_sales: 0,
    discounts: 0,
    quantity: 0,
    receipts: new Set(),
    countries: new Map(),
    companies: new Map(),
    stores: new Map(),
    sales_types: new Map(),
    items: new Map(),
  };
}

function createStoreBucket(storeInfo) {
  return {
    store_code: storeInfo.store_code,
    store_name: storeInfo.store_name,
    country_code: storeInfo.country_code,
    country_name: storeInfo.country_name,
    company_code: storeInfo.company_code,
    company_name: storeInfo.company_name,
    net_sales: 0,
    discounts: 0,
    quantity: 0,
    receipts: new Set(),
  };
}

function createItemBucket(itemNo, itemDescription) {
  return {
    item_no: itemNo,
    item_description: itemDescription,
    net_sales: 0,
    quantity: 0,
  };
}

function addMapValue(map, key, value) {
  map.set(key, (map.get(key) || 0) + value);
}

function serializeAmountMap(map) {
  return Array.from(map.entries()).map(([name, value]) => ({
    name,
    value,
  }));
}

function serializeStore(store) {
  const orders = store.receipts.size;

  return {
    store_code: store.store_code,
    store_name: store.store_name,
    country_code: store.country_code,
    country_name: store.country_name,
    company_code: store.company_code,
    company_name: store.company_name,
    net_sales: store.net_sales,
    discounts: store.discounts,
    quantity: store.quantity,
    orders,
    avg_order_value: orders ? store.net_sales / orders : 0,
  };
}

function serializeDailyBucket(bucket) {
  return {
    date: bucket.date,
    net_sales: bucket.net_sales,
    discounts: bucket.discounts,
    quantity: bucket.quantity,
    orders: bucket.receipts.size,

    countries: serializeAmountMap(bucket.countries),
    companies: serializeAmountMap(bucket.companies),
    sales_types: serializeAmountMap(bucket.sales_types),

    stores: Array.from(bucket.stores.values()).map(serializeStore),
    items: Array.from(bucket.items.values()),
  };
}

async function buildSummary() {
  if (!fs.existsSync(SALES_ZIP)) {
    throw new Error(`Sales ZIP not found: ${SALES_ZIP}`);
  }

  fs.mkdirSync(OUTPUT_DIR, {
    recursive: true,
  });

  const storeLookup = buildStoreLookup();
  const brands = new Map();

  const zipStream = fs
    .createReadStream(SALES_ZIP)
    .pipe(unzipper.Parse({ forceStream: true }));

  let rowCount = 0;
  let skippedStoreCount = 0;

  for await (const entry of zipStream) {
    const fileName = String(entry.path || "").toLowerCase();

    if (!fileName.endsWith(".csv")) {
      entry.autodrain();
      continue;
    }

    const csvParser = entry.pipe(
      parse({
        columns: true,
        skip_empty_lines: true,
        bom: true,
        relax_quotes: true,
        relax_column_count: true,
        trim: true,
      })
    );

    for await (const row of csvParser) {
      rowCount += 1;

      const storeCode = String(
        getField(row, "Store No_") || ""
      ).trim();

      const storeInfo = storeLookup.get(storeCode);

      if (!storeInfo) {
        skippedStoreCount += 1;
        continue;
      }

      const date = parseDate(
        getField(row, "Date") ||
        getField(row, "Trans_ Date")
      );

      if (!date) continue;

      const rate = getAedRate(storeInfo.country_name);

      const netSales =
        Math.abs(toNumber(getField(row, "Net Amount"))) * rate;

      const discount =
        Math.abs(toNumber(getField(row, "Discount Amount"))) * rate;

      const quantity =
        Math.abs(toNumber(getField(row, "Quantity")));

      const receiptNo = String(
        getField(row, "Receipt No_") || ""
      ).trim();

      const itemNo = String(
        getField(row, "Item No_") || ""
      ).trim();

      const itemDescription =
        String(
          getField(row, "Item Description") ||
          getField(row, "Description") ||
          getField(row, "Item Description 2") ||
          itemNo ||
          "Unknown Item"
        ).trim();

      const salesType =
        normalize(getField(row, "Sales Type")) || "UNKNOWN";

      const brandCode = storeInfo.brand_code;

      if (!brands.has(brandCode)) {
        brands.set(brandCode, createBrandBucket(storeInfo));
      }

      const brand = brands.get(brandCode);

      brand.countries.add(storeInfo.country_name);

      if (!brand.stores.has(storeCode)) {
        brand.stores.set(storeCode, createStoreBucket(storeInfo));
      }

      const brandStore = brand.stores.get(storeCode);

      brandStore.net_sales += netSales;
      brandStore.discounts += discount;
      brandStore.quantity += quantity;

      if (receiptNo) {
        brandStore.receipts.add(receiptNo);
      }

      if (!brand.daily.has(date)) {
        brand.daily.set(date, createDailyBucket(date));
      }

      const day = brand.daily.get(date);

      day.net_sales += netSales;
      day.discounts += discount;
      day.quantity += quantity;

      if (receiptNo) {
        day.receipts.add(receiptNo);
      }

      addMapValue(
        day.countries,
        storeInfo.country_name,
        netSales
      );

      addMapValue(
        day.companies,
        storeInfo.company_name,
        netSales
      );

      addMapValue(
        day.sales_types,
        salesType,
        netSales
      );

      if (!day.stores.has(storeCode)) {
        day.stores.set(storeCode, createStoreBucket(storeInfo));
      }

      const dayStore = day.stores.get(storeCode);

      dayStore.net_sales += netSales;
      dayStore.discounts += discount;
      dayStore.quantity += quantity;

      if (receiptNo) {
        dayStore.receipts.add(receiptNo);
      }

      if (!day.items.has(itemNo)) {
        day.items.set(
          itemNo,
          createItemBucket(itemNo, itemDescription)
        );
      }

      const item = day.items.get(itemNo);

      item.net_sales += netSales;
      item.quantity += quantity;
    }
  }

  const output = {
    success: true,
    month,
    currency: "AED",
    generatedAt: new Date().toISOString(),
    sourceRows: rowCount,
    skippedRowsWithoutStoreMaster: skippedStoreCount,
    brands: {},
  };

  for (const [brandCode, brand] of brands.entries()) {
    const daily = Array.from(brand.daily.values())
      .map(serializeDailyBucket)
      .sort((a, b) => a.date.localeCompare(b.date));

    const stores = Array.from(brand.stores.values())
      .map(serializeStore)
      .sort((a, b) => a.store_name.localeCompare(b.store_name));

    output.brands[brandCode] = {
      brandCode,
      brandName: brand.brandName,
      currency: "AED",
      countries: Array.from(brand.countries).sort(),
      stores,
      daily,
    };
  }

  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(output),
    "utf8"
  );

  console.log(`Rows processed: ${rowCount.toLocaleString()}`);
  console.log(
    `Rows skipped due to missing store master: ${skippedStoreCount.toLocaleString()}`
  );
  console.log(`Summary created: ${OUTPUT_FILE}`);
}

buildSummary().catch((error) => {
  console.error("Failed to build sales summary:", error);
  process.exit(1);
});