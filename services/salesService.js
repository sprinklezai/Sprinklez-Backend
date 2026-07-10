const fs = require("fs");
const path = require("path");

const SUMMARY_PATH =
  process.env.SALES_SUMMARY_PATH ||
  path.join(__dirname, "..", "data", "sales", "summaries");

function normalize(value) {
  return String(value ?? "").trim().toUpperCase();
}

function toDate(value) {
  if (!value) return null;

  const date = new Date(`${value}T00:00:00`);

  return Number.isNaN(date.getTime()) ? null : date;
}

function sortDesc(data, key) {
  return [...data].sort(
    (a, b) => Number(b[key] || 0) - Number(a[key] || 0)
  );
}

function sortAsc(data, key) {
  return [...data].sort(
    (a, b) => Number(a[key] || 0) - Number(b[key] || 0)
  );
}

function loadSummary(month) {
  const filePath = path.join(
    SUMMARY_PATH,
    `${month}_sales_summary.json`
  );

  if (!fs.existsSync(filePath)) {
    throw new Error(`Sales summary not found: ${filePath}`);
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function getStartOfWeek(date) {
  const result = new Date(date);
  const day = result.getDay();

  const difference = day === 0 ? -6 : 1 - day;

  result.setDate(result.getDate() + difference);
  result.setHours(0, 0, 0, 0);

  return result;
}

function getPeriodDays(daily, period) {
  if (!daily.length) return [];

  const sortedDays = [...daily].sort(
    (a, b) => String(a.date).localeCompare(String(b.date))
  );

  const latestDate = toDate(sortedDays.at(-1)?.date);

  if (!latestDate) return sortedDays;

  const normalizedPeriod = normalize(period);

  if (normalizedPeriod === "WTD") {
    const weekStart = getStartOfWeek(latestDate);

    return sortedDays.filter((day) => {
      const date = toDate(day.date);
      return date && date >= weekStart && date <= latestDate;
    });
  }

  // A monthly summary file can calculate MTD directly.
  if (normalizedPeriod === "MTD") {
    return sortedDays;
  }

  // YTD requires January-to-current-month summary files.
  // Until that multi-month endpoint is added, return current month only.
  return sortedDays;
}

function aggregateFilteredDays(
  days,
  country,
  storeCode,
  search
) {
  const normalizedCountry = normalize(country);
  const normalizedStore = String(storeCode || "").trim();
  const normalizedSearch = normalize(search);

  let netRevenue = 0;
  let discounts = 0;
  let itemsSold = 0;
  let orders = 0;

  const dates = new Set();

  const countryMap = new Map();
  const companyMap = new Map();
  const salesTypeMap = new Map();
  const storeMap = new Map();
  const itemMap = new Map();
  const revenueTrend = new Map();

  for (const day of days) {
    let dayRevenue = 0;

    for (const store of day.stores || []) {
      if (
        normalizedCountry &&
        normalize(store.country_name) !== normalizedCountry
      ) {
        continue;
      }

      if (
        normalizedStore &&
        String(store.store_code).trim() !== normalizedStore
      ) {
        continue;
      }

      const storeRevenue = Number(store.net_sales || 0);
      const storeDiscount = Number(store.discounts || 0);
      const storeQuantity = Number(store.quantity || 0);
      const storeOrders = Number(store.orders || 0);

      netRevenue += storeRevenue;
      discounts += storeDiscount;
      itemsSold += storeQuantity;
      orders += storeOrders;
      dayRevenue += storeRevenue;

      dates.add(day.date);

      const storeKey = String(store.store_code);

      if (!storeMap.has(storeKey)) {
        storeMap.set(storeKey, {
          store_code: store.store_code,
          store_name: store.store_name,
          country_code: store.country_code,
          country_name: store.country_name,
          company_code: store.company_code,
          company_name: store.company_name,
          net_sales: 0,
          discounts: 0,
          quantity: 0,
          orders: 0,
        });
      }

      const aggregateStore = storeMap.get(storeKey);

      aggregateStore.net_sales += storeRevenue;
      aggregateStore.discounts += storeDiscount;
      aggregateStore.quantity += storeQuantity;
      aggregateStore.orders += storeOrders;

      countryMap.set(
        store.country_name,
        (countryMap.get(store.country_name) || 0) +
          storeRevenue
      );

      companyMap.set(
        store.company_name,
        (companyMap.get(store.company_name) || 0) +
          storeRevenue
      );

      // Filter-aware channel mix
      for (const channel of store.sales_types || []) {
        const channelName = channel.name || "UNKNOWN";

        salesTypeMap.set(
          channelName,
          (salesTypeMap.get(channelName) || 0) +
            Number(channel.value || 0)
        );
      }

      // Filter-aware item ranking
      for (const item of store.items || []) {
        const itemLabel =
          item.item_description ||
          item.item_no ||
          "Unknown Item";

        if (
          normalizedSearch &&
          !normalize(itemLabel).includes(normalizedSearch)
        ) {
          continue;
        }

        const itemKey = String(
          item.item_no || itemLabel
        );

        if (!itemMap.has(itemKey)) {
          itemMap.set(itemKey, {
            item_no: item.item_no,
            item_description: itemLabel,
            quantity: 0,
            net_sales: 0,
          });
        }

        const aggregateItem = itemMap.get(itemKey);

        aggregateItem.quantity += Number(
          item.quantity || 0
        );

        aggregateItem.net_sales += Number(
          item.net_sales || 0
        );
      }
    }

    if (dayRevenue > 0) {
      revenueTrend.set(day.date, dayRevenue);
    }
  }

  const reportingDays = dates.size || 1;

  const storeDirectory = Array.from(
    storeMap.values()
  ).map((store) => ({
    ...store,

    avg_order_value: store.orders
      ? store.net_sales / store.orders
      : 0,

    avg_daily_sales:
      store.net_sales / reportingDays,

    contribution_percent: netRevenue
      ? (store.net_sales / netRevenue) * 100
      : 0,
  }));

  const itemRanking = Array.from(itemMap.values());

  return {
    kpis: {
      netRevenue,
      orders,

      avgOrderValue: orders
        ? netRevenue / orders
        : 0,

      discounts,

      discountPercent: netRevenue
        ? (discounts / netRevenue) * 100
        : 0,

      itemsSold,

      activeStores: storeMap.size,

      averageDailySales:
        netRevenue / reportingDays,

      averageDailySalesPerOutlet:
        storeMap.size > 0
          ? netRevenue /
            reportingDays /
            storeMap.size
          : 0,

      rows: 0,
    },

    revenueTrend: Array.from(
      revenueTrend.entries()
    )
      .map(([date, value]) => ({
        date,
        value,
      }))
      .sort((a, b) =>
        a.date.localeCompare(b.date)
      ),

    countrySales: sortDesc(
      Array.from(countryMap.entries()).map(
        ([name, value]) => ({
          name,
          value,
        })
      ),
      "value"
    ),

    companySales: sortDesc(
      Array.from(companyMap.entries()).map(
        ([name, value]) => ({
          name,
          value,
        })
      ),
      "value"
    ),

    salesTypeMix: sortDesc(
      Array.from(salesTypeMap.entries()).map(
        ([name, value]) => ({
          name,
          value,
        })
      ),
      "value"
    ),

    storeDirectory: sortDesc(
      storeDirectory,
      "net_sales"
    ),

    topStores: sortDesc(
      storeDirectory,
      "net_sales"
    ).slice(0, 10),

    bottomStores: sortAsc(
      storeDirectory.filter(
        (item) => item.net_sales > 0
      ),
      "net_sales"
    ).slice(0, 10),

    topItems: sortDesc(
      itemRanking,
      "net_sales"
    ).slice(0, 10),

    bottomItems: sortAsc(
      itemRanking.filter(
        (item) => item.net_sales > 0
      ),
      "net_sales"
    ).slice(0, 10),
  };
}

async function getSalesDashboard({
  brandCode,
  month = "2026_06",
  period = "MTD",
  country = "",
  store = "",
  search = "",
}) {
  const summary = loadSummary(month);

  const normalizedBrandCode = normalize(brandCode);
  const brand = summary.brands?.[normalizedBrandCode];

  if (!brand) {
    throw new Error(
      `Brand ${normalizedBrandCode} not found for ${month}`
    );
  }

  const periodDays = getPeriodDays(
    brand.daily || [],
    period
  );

  const aggregated = aggregateFilteredDays(
    periodDays,
    country,
    store,
    search
  );

  const storeOptions = (brand.stores || [])
    .filter((item) => {
      if (!country) return true;

      return normalize(item.country_name) === normalize(country);
    })
    .map((item) => ({
      store_code: item.store_code,
      store_name: item.store_name,
      country_name: item.country_name,
    }))
    .sort((a, b) =>
      String(a.store_name).localeCompare(String(b.store_name))
    );

  return {
    success: true,
    brandCode: normalizedBrandCode,
    brandName: brand.brandName || normalizedBrandCode,
    month,
    period,
    currency: summary.currency || "AED",

    filters: {
      countries: [...(brand.countries || [])].sort(),
      stores: storeOptions,
      periods: ["WTD", "MTD", "YTD"],
    },

    ...aggregated,
  };
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