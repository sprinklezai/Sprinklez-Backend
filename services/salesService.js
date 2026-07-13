const {
  getPeriodBrandData,
} = require("./salesPeriodService");

const {
  getLatestSalesMonth,
} = require("./salesMonthService");

const {
  getRevenueComparison,
} = require("./salesComparisonService");

function normalize(value) {
  return String(value ?? "").trim().toUpperCase();
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

function aggregateFilteredDays(days, country, storeCode, search) {
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

  for (const day of days || []) {
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

      if (day.date) dates.add(day.date);

      const storeKey = String(store.store_code || "").trim();

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

      const countryName =
        store.country_name || store.country_code || "Unknown";
      const companyName =
        store.company_name || store.company_code || "Unknown";

      countryMap.set(
        countryName,
        (countryMap.get(countryName) || 0) + storeRevenue
      );

      companyMap.set(
        companyName,
        (companyMap.get(companyName) || 0) + storeRevenue
      );

      for (const channel of store.sales_types || []) {
        const channelName = channel.name || "UNKNOWN";
        salesTypeMap.set(
          channelName,
          (salesTypeMap.get(channelName) || 0) +
            Number(channel.value || 0)
        );
      }

      for (const item of store.items || []) {
        const itemLabel =
          item.item_description || item.item_no || "Unknown Item";

        if (
          normalizedSearch &&
          !normalize(itemLabel).includes(normalizedSearch)
        ) {
          continue;
        }

        const itemKey = String(item.item_no || itemLabel).trim();

        if (!itemMap.has(itemKey)) {
          itemMap.set(itemKey, {
            item_no: item.item_no,
            item_description: itemLabel,
            quantity: 0,
            net_sales: 0,
          });
        }

        const aggregateItem = itemMap.get(itemKey);
        aggregateItem.quantity += Number(item.quantity || 0);
        aggregateItem.net_sales += Number(item.net_sales || 0);
      }
    }

    if (day.date && dayRevenue !== 0) {
      revenueTrend.set(day.date, dayRevenue);
    }
  }

  const reportingDays = dates.size || 1;

  const storeDirectory = Array.from(storeMap.values()).map((store) => ({
    ...store,
    avg_order_value:
      store.orders > 0 ? store.net_sales / store.orders : 0,
    avg_daily_sales: store.net_sales / reportingDays,
    contribution_percent:
      netRevenue !== 0 ? (store.net_sales / netRevenue) * 100 : 0,
  }));

  const itemRanking = Array.from(itemMap.values());

  return {
    kpis: {
      netRevenue,
      orders,
      avgOrderValue: orders > 0 ? netRevenue / orders : 0,
      discounts,
      discountPercent:
        netRevenue !== 0 ? (discounts / netRevenue) * 100 : 0,
      itemsSold,
      activeStores: storeMap.size,
      averageDailySales: netRevenue / reportingDays,
      averageDailySalesPerOutlet:
        storeMap.size > 0
          ? netRevenue / reportingDays / storeMap.size
          : 0,
      reportingDays,
    },

    revenueTrend: Array.from(revenueTrend.entries())
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) =>
        String(a.date).localeCompare(String(b.date))
      ),

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

    storeDirectory: sortDesc(storeDirectory, "net_sales"),
    topStores: sortDesc(storeDirectory, "net_sales").slice(0, 10),
    bottomStores: sortAsc(
      storeDirectory.filter(
        (item) => Number(item.net_sales || 0) > 0
      ),
      "net_sales"
    ).slice(0, 10),
    topItems: sortDesc(itemRanking, "net_sales").slice(0, 10),
    bottomItems: sortAsc(
      itemRanking.filter(
        (item) => Number(item.net_sales || 0) > 0
      ),
      "net_sales"
    ).slice(0, 10),
  };
}

async function getSalesDashboard({
  brandCode,
  month,
  period = "MTD",
  country = "",
  store = "",
  search = "",
  fromDate = "",
  toDate = "",
}) {
  const selectedMonth = month || getLatestSalesMonth();

  if (!selectedMonth) {
    throw new Error("No sales summary data is available");
  }

  const normalizedBrandCode = normalize(brandCode);
  const normalizedPeriod = normalize(period || "MTD");

  const periodData = getPeriodBrandData({
    selectedMonth,
    period: normalizedPeriod,
    brandCode: normalizedBrandCode,
  });

  if (!periodData.selectedBrand) {
    throw new Error(
      `Brand ${normalizedBrandCode} not found for ${selectedMonth}`
    );
  }

  const aggregated = aggregateFilteredDays(
    periodData.days || [],
    country,
    store,
    search
  );

  const revenueComparison = getRevenueComparison({
    brandCode: normalizedBrandCode,
    selectedMonth,
    fromDate,
    toDate,
    country,
    store,
  });

  const storeOptions = (periodData.selectedBrand.stores || [])
    .filter((item) => {
      if (!country) return true;

      return (
        normalize(item.country_name) === normalize(country)
      );
    })
    .map((item) => ({
      store_code: item.store_code,
      store_name: item.store_name,
      country_name: item.country_name,
    }))
    .sort((a, b) =>
      String(a.store_name || "").localeCompare(
        String(b.store_name || "")
      )
    );

  return {
    success: true,
    brandCode: normalizedBrandCode,
    brandName:
      periodData.selectedBrand.brandName || normalizedBrandCode,
    month: selectedMonth,
    period: normalizedPeriod,
    currency:
      periodData.selectedSummary?.currency || "AED",

    periodInfo: {
      type: normalizedPeriod,
      selectedMonth,
      includedMonths: periodData.includedMonths || [],
      includedFiles: periodData.includedFiles || [],
      sourceByMonth: periodData.sourceByMonth || {},
      startDate: periodData.startDate || null,
      endDate: periodData.endDate || null,
    },

    filters: {
      countries: [
        ...(periodData.selectedBrand.countries || []),
      ].sort(),
      stores: storeOptions,
      periods: ["WTD", "MTD", "YTD"],
    },

    revenueComparison: {
      ...revenueComparison,
      regionRevenue: aggregated.countrySales || [],
    },

    ...aggregated,
  };
}

async function refreshSalesMonth(month) {
  const selectedMonth = month || getLatestSalesMonth();

  if (!selectedMonth) {
    throw new Error("No sales summary data is available");
  }

  return {
    success: true,
    message: `Sales data is available for ${selectedMonth}`,
    month: selectedMonth,
  };
}

module.exports = {
  getSalesDashboard,
  refreshSalesMonth,
};
