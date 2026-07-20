const fs = require("fs");
const path = require("path");
const unzipper = require("unzipper");
const { parse } = require("csv-parse");
const xlsx = require("xlsx");

require("dotenv").config({
  path: path.resolve(__dirname, "..", ".env"),
});

const salesDate = process.argv[2];
const explicitZipPath = process.argv[3];

if (!/^\d{4}_\d{2}_\d{2}$/.test(String(salesDate || ""))) {
  console.error("Usage: node scripts/buildDailySalesSummary.js YYYY_MM_DD");
  console.error("Example: node scripts/buildDailySalesSummary.js 2026_07_11");
  process.exit(1);
}

const month = salesDate.slice(0, 7);
const expectedBusinessDate = salesDate.replace(/_/g, "-");

const ROOT = path.resolve(__dirname, "..");

const SALES_ZIP = explicitZipPath
  ? path.resolve(explicitZipPath)
  : path.join(
      ROOT,
      "data",
      "sales",
      "daily-zips",
      `${salesDate}_sales.zip`
    );

const MASTER_DIR =
  process.env.MASTERS_DATA_PATH ||
  path.join(ROOT, "data", "masters");

const OUTPUT_DIR = path.join(
  ROOT,
  "data",
  "sales",
  "daily",
  month
);

const OUTPUT_FILE = path.join(
  OUTPUT_DIR,
  `${salesDate}_sales_summary.json`
);

const MISSING_STORES_JSON = path.join(
  OUTPUT_DIR,
  `${salesDate}_missing_stores.json`
);

const MISSING_STORES_CSV = path.join(
  OUTPUT_DIR,
  `${salesDate}_missing_stores.csv`
);

/*
|--------------------------------------------------------------------------
| Basic helpers
|--------------------------------------------------------------------------
*/

function normalize(value) {
  return String(value ?? "").trim().toUpperCase();
}

function normalizeStoreCode(value) {
  return String(value ?? "")
    .trim()
    .replace(/\.0+$/, "");
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const cleanedValue = String(value)
    .replace(/,/g, "")
    .trim();

  const number = Number(cleanedValue);

  return Number.isFinite(number) ? number : 0;
}

function parseDate(value) {
  if (!value) return "";

  const dateText = String(value).trim();

  const isoDate = dateText.split(" ")[0];

  if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return isoDate;
  }

  const parsedDate = new Date(dateText);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  const year = parsedDate.getFullYear();
  const monthValue = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const day = String(parsedDate.getDate()).padStart(2, "0");

  return `${year}-${monthValue}-${day}`;
}

function getField(row, fieldName) {
  const normalizedField = String(fieldName)
    .trim()
    .toLowerCase();

  const key = Object.keys(row).find(
    (item) =>
      String(item).trim().toLowerCase() === normalizedField
  );

  return key ? row[key] : "";
}

function csvEscape(value) {
  const text = String(value ?? "");

  if (
    text.includes(",") ||
    text.includes('"') ||
    text.includes("\n") ||
    text.includes("\r")
  ) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

/*
|--------------------------------------------------------------------------
| Currency conversion
|--------------------------------------------------------------------------
|
| All dashboard sales are converted to AED.
| Qatar and KSA remain unchanged as requested.
|--------------------------------------------------------------------------
*/

function getAedRate(countryName) {
  const country = normalize(countryName);

  if (country.includes("OMAN")) return 9.55;
  if (country.includes("KUWAIT")) return 12.1;
  if (country.includes("BAHRAIN")) return 9.74;

  return 1;
}

/*
|--------------------------------------------------------------------------
| Master-data loading
|--------------------------------------------------------------------------
*/

function readMaster(fileName) {
  const filePath = path.join(MASTER_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Master file not found: ${filePath}`);
  }

  const workbook = xlsx.readFile(filePath);
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];

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
      brand.brand_name ||
        brand.brand_desc ||
        brand.brand_code,
    ])
  );

  const countryMap = new Map(
    countries.map((country) => [
      normalize(country.country_code),
      country.country_name ||
        country.country_desc ||
        country.country_code,
    ])
  );

  const companyMap = new Map(
    companies.map((company) => [
      normalize(company.company_code),
      company.company_name ||
        company.company_desc ||
        company.company_code,
    ])
  );

  const lookup = new Map();

  for (const store of stores) {
    const storeCode = normalizeStoreCode(
      store.store_code ||
      store.store_no ||
      store.store_no_
    );

    if (!storeCode) {
      continue;
    }

    const brandCode = normalize(store.brand_code);
    const countryCode = normalize(store.country_code);
    const companyCode = normalize(store.company_code);

    lookup.set(storeCode, {
      store_code: storeCode,
      store_name:
        store.store_name ||
        store.store_description ||
        storeCode,

      brand_code: brandCode,
      brand_name:
        brandMap.get(brandCode) || brandCode,

      country_code: countryCode,
      country_name:
        countryMap.get(countryCode) || countryCode,

      company_code: companyCode,
      company_name:
        companyMap.get(companyCode) || companyCode,
    });
  }

  console.log(
    `Store master records loaded: ${lookup.size.toLocaleString()}`
  );

  return lookup;
}

/*
|--------------------------------------------------------------------------
| Aggregation buckets
|--------------------------------------------------------------------------
*/

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

    receipt_keys: new Set(),

    countries: new Map(),
    companies: new Map(),
    sales_types: new Map(),

    stores: new Map(),
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

    receipt_keys: new Set(),

    // Required so Country and Store filters can recalculate
    // Channel Mix and Top/Bottom Items correctly.
    sales_types: new Map(),
    items: new Map(),
  };
}

function createItemBucket(itemNo, itemDescription) {
  return {
    item_no: itemNo,
    item_description:
      itemDescription ||
      itemNo ||
      "Unknown Item",

    net_sales: 0,
    quantity: 0,
  };
}

function addMapValue(map, key, value) {
  const normalizedKey =
    String(key || "").trim() || "UNKNOWN";

  map.set(
    normalizedKey,
    (map.get(normalizedKey) || 0) + Number(value || 0)
  );
}

/*
|--------------------------------------------------------------------------
| Serialization helpers
|--------------------------------------------------------------------------
*/

function serializeAmountMap(map) {
  return Array.from(map.entries())
    .map(([name, value]) => ({
      name,
      value,
    }))
    .sort((a, b) => b.value - a.value);
}

function serializeItems(itemMap) {
  return Array.from(itemMap.values()).map((item) => ({
    item_no: item.item_no,
    item_description: item.item_description,
    net_sales: item.net_sales,
    quantity: item.quantity,
  }));
}

function serializeStore(store) {
  const orders = store.receipt_keys.size;

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

    avg_order_value:
      orders > 0
        ? store.net_sales / orders
        : 0,

    sales_types: serializeAmountMap(
      store.sales_types
    ),

    items: serializeItems(store.items),
  };
}

function serializeDailyBucket(bucket) {
  return {
    date: bucket.date,

    net_sales: bucket.net_sales,
    discounts: bucket.discounts,
    quantity: bucket.quantity,
    orders: bucket.receipt_keys.size,

    countries: serializeAmountMap(
      bucket.countries
    ),

    companies: serializeAmountMap(
      bucket.companies
    ),

    sales_types: serializeAmountMap(
      bucket.sales_types
    ),

    stores: Array.from(
      bucket.stores.values()
    ).map(serializeStore),

    items: serializeItems(bucket.items),
  };
}

/*
|--------------------------------------------------------------------------
| Missing-store report
|--------------------------------------------------------------------------
*/

function recordMissingStore(
  missingStores,
  row,
  storeCode
) {
  const reportKey = storeCode || "(blank)";

  const country = String(
    getField(row, "Country") || ""
  ).trim();

  const company = String(
    getField(row, "Company") || ""
  ).trim();

  const receiptNo = String(
    getField(row, "Receipt No_") || ""
  ).trim();

  const transactionNo = String(
    getField(row, "Transaction No_") || ""
  ).trim();

  const posTerminalNo = String(
    getField(row, "POS Terminal No_") || ""
  ).trim();

  const sampleDate = parseDate(
    getField(row, "Date") ||
    getField(row, "Trans_ Date")
  );

  const netAmount = toNumber(
    getField(row, "Net Amount")
  );

  if (!missingStores.has(reportKey)) {
    missingStores.set(reportKey, {
      store_code: reportKey,
      country,
      company,

      skipped_rows: 0,
      net_amount_local: 0,

      sample_dates: [],
      sample_receipts: [],
      sample_transactions: [],
      sample_pos_terminals: [],
    });
  }

  const missingStore =
    missingStores.get(reportKey);

  missingStore.skipped_rows += 1;
  missingStore.net_amount_local += netAmount;

  if (
    sampleDate &&
    missingStore.sample_dates.length < 5 &&
    !missingStore.sample_dates.includes(sampleDate)
  ) {
    missingStore.sample_dates.push(sampleDate);
  }

  if (
    receiptNo &&
    missingStore.sample_receipts.length < 5 &&
    !missingStore.sample_receipts.includes(receiptNo)
  ) {
    missingStore.sample_receipts.push(receiptNo);
  }

  if (
    transactionNo &&
    missingStore.sample_transactions.length < 5 &&
    !missingStore.sample_transactions.includes(transactionNo)
  ) {
    missingStore.sample_transactions.push(
      transactionNo
    );
  }

  if (
    posTerminalNo &&
    missingStore.sample_pos_terminals.length < 5 &&
    !missingStore.sample_pos_terminals.includes(posTerminalNo)
  ) {
    missingStore.sample_pos_terminals.push(
      posTerminalNo
    );
  }
}

function writeMissingStoreReports(
  missingStores,
  skippedStoreCount
) {
  const report = Array.from(
    missingStores.values()
  ).sort(
    (a, b) =>
      b.skipped_rows - a.skipped_rows
  );

  const jsonOutput = {
    month,
    generated_at: new Date().toISOString(),
    total_skipped_rows: skippedStoreCount,
    missing_store_count: report.length,
    stores: report,
  };

  fs.writeFileSync(
    MISSING_STORES_JSON,
    JSON.stringify(jsonOutput, null, 2),
    "utf8"
  );

  const csvHeader = [
    "Store Code",
    "Country",
    "Company",
    "Skipped Rows",
    "Net Amount Local",
    "Sample Dates",
    "Sample Receipts",
    "Sample Transactions",
    "Sample POS Terminals",
  ];

  const csvRows = report.map((store) => [
    csvEscape(store.store_code),
    csvEscape(store.country),
    csvEscape(store.company),
    store.skipped_rows,
    store.net_amount_local,
    csvEscape(store.sample_dates.join(" | ")),
    csvEscape(store.sample_receipts.join(" | ")),
    csvEscape(
      store.sample_transactions.join(" | ")
    ),
    csvEscape(
      store.sample_pos_terminals.join(" | ")
    ),
  ]);

  const csvContent = [
    csvHeader.join(","),
    ...csvRows.map((row) => row.join(",")),
  ].join("\n");

  fs.writeFileSync(
    MISSING_STORES_CSV,
    csvContent,
    "utf8"
  );

  return report;
}

/*
|--------------------------------------------------------------------------
| Main builder
|--------------------------------------------------------------------------
*/

async function buildSummary() {
  if (!fs.existsSync(SALES_ZIP)) {
    throw new Error(
      `Sales ZIP not found: ${SALES_ZIP}`
    );
  }

  fs.mkdirSync(OUTPUT_DIR, {
    recursive: true,
  });

  console.log("");
  console.log("======================================");
  console.log(`Building daily sales summary: ${expectedBusinessDate}`);
  console.log(`Sales ZIP: ${SALES_ZIP}`);
  console.log(`Master folder: ${MASTER_DIR}`);
  console.log("======================================");
  console.log("");

  const storeLookup = buildStoreLookup();

  const brands = new Map();
  const missingStores = new Map();

  const zipStream = fs
    .createReadStream(SALES_ZIP)
    .pipe(
      unzipper.Parse({
        forceStream: true,
      })
    );

  let rowCount = 0;
  let includedRowCount = 0;
  let skippedStoreCount = 0;
  let skippedDateCount = 0;
  let skippedDifferentDateCount = 0;
  let csvFileCount = 0;

  for await (const entry of zipStream) {
    const fileName = String(
      entry.path || ""
    );

    if (
      !fileName.toLowerCase().endsWith(".csv")
    ) {
      entry.autodrain();
      continue;
    }

    csvFileCount += 1;

    console.log(
      `Reading CSV ${csvFileCount}: ${fileName}`
    );

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

      if (rowCount % 100000 === 0) {
        console.log(
          `Processed ${rowCount.toLocaleString()} rows...`
        );
      }

      const storeCode = normalizeStoreCode(
        getField(row, "Store No_")
      );

      const storeInfo =
        storeLookup.get(storeCode);

      if (!storeInfo) {
        skippedStoreCount += 1;

        recordMissingStore(
          missingStores,
          row,
          storeCode
        );

        continue;
      }

      const date = parseDate(
        getField(row, "Date") ||
        getField(row, "Trans_ Date")
      );

      if (!date) {
        skippedDateCount += 1;
        continue;
      }

      if (date !== expectedBusinessDate) {
        skippedDifferentDateCount += 1;
        continue;
      }

      includedRowCount += 1;

      const rate = getAedRate(
        storeInfo.country_name
      );

      /*
      |--------------------------------------------------------------------------
      | Important: preserve signs
      |--------------------------------------------------------------------------
      |
      | Do not use Math.abs() here.
      | Negative refund rows must reduce net revenue and quantity.
      |--------------------------------------------------------------------------
      */

      const netAmountLocal = toNumber(
  getField(row, "Net Amount")
);

const discountLocal = toNumber(
  getField(row, "Discount Amount")
);

const quantityLocal = toNumber(
  getField(row, "Quantity")
);

/*
|--------------------------------------------------------------------------
| LS Retail sign conversion
|--------------------------------------------------------------------------
|
| Normal sales and quantities are stored as negative values.
| Reverse the sign for dashboard presentation.
|--------------------------------------------------------------------------
*/

const netSales =
  -netAmountLocal * rate;

const quantity =
  -quantityLocal;

const discount =
  Math.abs(discountLocal) * rate;

      const receiptNo = String(
        getField(row, "Receipt No_") || ""
      ).trim();

      const posTerminalNo = String(
        getField(row, "POS Terminal No_") || ""
      ).trim();

      const transactionNo = String(
        getField(row, "Transaction No_") || ""
      ).trim();

      /*
      |--------------------------------------------------------------------------
      | Make the receipt key unique across stores and terminals.
      |--------------------------------------------------------------------------
      */

      const receiptKey =
        receiptNo
          ? [
              storeCode,
              posTerminalNo,
              receiptNo,
            ].join("|")
          : [
              storeCode,
              posTerminalNo,
              transactionNo,
              date,
            ].join("|");

      const itemNo = String(
        getField(row, "Item No_") || ""
      ).trim();

      const itemDescription = String(
        getField(row, "Item Description") ||
        getField(row, "Description") ||
        getField(row, "Item Description 2") ||
        itemNo ||
        "Unknown Item"
      ).trim();

      const salesType =
        normalize(
          getField(row, "Sales Type")
        ) || "UNKNOWN";

      const brandCode =
        storeInfo.brand_code;

      if (!brands.has(brandCode)) {
        brands.set(
          brandCode,
          createBrandBucket(storeInfo)
        );
      }

      const brand =
        brands.get(brandCode);

      brand.countries.add(
        storeInfo.country_name
      );

      /*
      |--------------------------------------------------------------------------
      | Overall brand-store totals
      |--------------------------------------------------------------------------
      */

      if (!brand.stores.has(storeCode)) {
        brand.stores.set(
          storeCode,
          createStoreBucket(storeInfo)
        );
      }

      const brandStore =
        brand.stores.get(storeCode);

      brandStore.net_sales += netSales;
      brandStore.discounts += discount;
      brandStore.quantity += quantity;

      if (receiptKey) {
        brandStore.receipt_keys.add(
          receiptKey
        );
      }

      addMapValue(
        brandStore.sales_types,
        salesType,
        netSales
      );

      if (!brandStore.items.has(itemNo)) {
        brandStore.items.set(
          itemNo,
          createItemBucket(
            itemNo,
            itemDescription
          )
        );
      }

      const brandStoreItem =
        brandStore.items.get(itemNo);

      brandStoreItem.net_sales +=
        netSales;

      brandStoreItem.quantity +=
        quantity;

      /*
      |--------------------------------------------------------------------------
      | Daily totals
      |--------------------------------------------------------------------------
      */

      if (!brand.daily.has(date)) {
        brand.daily.set(
          date,
          createDailyBucket(date)
        );
      }

      const day =
        brand.daily.get(date);

      day.net_sales += netSales;
      day.discounts += discount;
      day.quantity += quantity;

      if (receiptKey) {
        day.receipt_keys.add(
          receiptKey
        );
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

      /*
      |--------------------------------------------------------------------------
      | Daily store totals
      |--------------------------------------------------------------------------
      */

      if (!day.stores.has(storeCode)) {
        day.stores.set(
          storeCode,
          createStoreBucket(storeInfo)
        );
      }

      const dayStore =
        day.stores.get(storeCode);

      dayStore.net_sales += netSales;
      dayStore.discounts += discount;
      dayStore.quantity += quantity;

      if (receiptKey) {
        dayStore.receipt_keys.add(
          receiptKey
        );
      }

      addMapValue(
        dayStore.sales_types,
        salesType,
        netSales
      );

      if (!dayStore.items.has(itemNo)) {
        dayStore.items.set(
          itemNo,
          createItemBucket(
            itemNo,
            itemDescription
          )
        );
      }

      const dayStoreItem =
        dayStore.items.get(itemNo);

      dayStoreItem.net_sales +=
        netSales;

      dayStoreItem.quantity +=
        quantity;

      /*
      |--------------------------------------------------------------------------
      | Daily brand-item totals
      |--------------------------------------------------------------------------
      */

      if (!day.items.has(itemNo)) {
        day.items.set(
          itemNo,
          createItemBucket(
            itemNo,
            itemDescription
          )
        );
      }

      const dayItem =
        day.items.get(itemNo);

      dayItem.net_sales += netSales;
      dayItem.quantity += quantity;
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Build final summary JSON
  |--------------------------------------------------------------------------
  */

  const output = {
    success: true,
    month,
    currency: "AED",
    generatedAt: new Date().toISOString(),

    sourceRows: rowCount,
    includedRows: includedRowCount,

    skippedRowsWithoutStoreMaster:
      skippedStoreCount,

    skippedRowsWithoutValidDate:
      skippedDateCount,

    skippedRowsForDifferentDate:
      skippedDifferentDateCount,

    brands: {},
  };

  for (
    const [brandCode, brand]
    of brands.entries()
  ) {
    const daily = Array.from(
      brand.daily.values()
    )
      .map(serializeDailyBucket)
      .sort((a, b) =>
        a.date.localeCompare(b.date)
      );

    const stores = Array.from(
      brand.stores.values()
    )
      .map(serializeStore)
      .sort((a, b) =>
        a.store_name.localeCompare(
          b.store_name
        )
      );

    output.brands[brandCode] = {
      brandCode,
      brandName: brand.brandName,
      currency: "AED",

      countries: Array.from(
        brand.countries
      ).sort(),

      stores,
      daily,
    };
  }

  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(output),
    "utf8"
  );

  const missingStoresReport =
    writeMissingStoreReports(
      missingStores,
      skippedStoreCount
    );

  /*
  |--------------------------------------------------------------------------
  | Final console summary
  |--------------------------------------------------------------------------
  */

  console.log("");
  console.log("======================================");
  console.log("BUILD COMPLETED");
  console.log("======================================");

  console.log(
    `CSV files processed: ${csvFileCount.toLocaleString()}`
  );

  console.log(
    `Rows processed: ${rowCount.toLocaleString()}`
  );

  console.log(
    `Rows included: ${includedRowCount.toLocaleString()}`
  );

  console.log(
    `Rows skipped — missing store: ${skippedStoreCount.toLocaleString()}`
  );

  console.log(
    `Rows skipped — invalid date: ${skippedDateCount.toLocaleString()}`
  );

  console.log(
    `Rows skipped — different date: ${skippedDifferentDateCount.toLocaleString()}`
  );

  console.log(
    `Missing store codes: ${missingStoresReport.length.toLocaleString()}`
  );

  console.log(
    `Brands generated: ${Object.keys(output.brands).length.toLocaleString()}`
  );

  console.log("");
  console.log(`Summary: ${OUTPUT_FILE}`);
  console.log(
    `Missing-store CSV: ${MISSING_STORES_CSV}`
  );
  console.log(
    `Missing-store JSON: ${MISSING_STORES_JSON}`
  );

  if (missingStoresReport.length > 0) {
    console.log("");
    console.log(
      "Top missing stores by skipped row count:"
    );

    console.table(
      missingStoresReport
        .slice(0, 20)
        .map((store) => ({
          store_code:
            store.store_code,

          country:
            store.country,

          company:
            store.company,

          skipped_rows:
            store.skipped_rows,

          net_amount_local:
            Number(
              store.net_amount_local
            ).toFixed(2),
        }))
    );
  }

  console.log("======================================");
}

buildSummary().catch((error) => {
  console.error("");
  console.error(
    "Failed to build sales summary:"
  );
  console.error(error);

  process.exit(1);
});