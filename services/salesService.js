const { getPeriodBrandData } = require("./salesPeriodService");
const { getLatestSalesMonth } = require("./salesMonthService");
const { getRevenueComparison } = require("./salesComparisonService");

const normalize = (value) =>
  String(value ?? "").trim().toUpperCase();

const sortDesc = (data, key) =>
  [...data].sort(
    (a, b) =>
      Number(b[key] || 0) - Number(a[key] || 0)
  );

const sortAsc = (data, key) =>
  [...data].sort(
    (a, b) =>
      Number(a[key] || 0) - Number(b[key] || 0)
  );

function filterDaysByDate(days, fromDate, toDate) {
  return (days || []).filter((day) => {
    const date = String(day.date || "");

    return (
      (!fromDate || date >= fromDate) &&
      (!toDate || date <= toDate)
    );
  });
}

function buildExecutiveAlerts({
  kpis,
  topStores,
  bottomStores,
  salesTypeMix,
  countrySales,
}) {
  const alerts = [];

  if (Number(kpis.discountPercent || 0) >= 10) {
    alerts.push({
      type: "discount",
      level: "warning",
      message: `Discounts are ${Number(
        kpis.discountPercent
      ).toFixed(1)}% of revenue.`,
    });
  }

  const topStore = topStores[0];

  if (
    topStore &&
    Number(topStore.contribution_percent || 0) >= 20
  ) {
    alerts.push({
      type: "store",
      level: "warning",
      message: `${topStore.store_name} contributes ${Number(
        topStore.contribution_percent
      ).toFixed(1)}% of revenue.`,
    });
  }

  const bottomStore = bottomStores[0];

  if (bottomStore) {
    alerts.push({
      type: "low-store",
      level: "critical",
      message: `${bottomStore.store_name} is the lowest-revenue active store.`,
    });
  }

  const topChannel = salesTypeMix[0];

  if (topChannel && Number(kpis.netRevenue || 0)) {
    const share =
      (Number(topChannel.value || 0) /
        Number(kpis.netRevenue)) *
      100;

    alerts.push({
      type: "channel",
      level: "info",
      message: `${topChannel.name} leads channel revenue at ${share.toFixed(
        1
      )}%.`,
    });
  }

  const topCountry = countrySales[0];

  if (topCountry && Number(kpis.netRevenue || 0)) {
    const share =
      (Number(topCountry.value || 0) /
        Number(kpis.netRevenue)) *
      100;

    alerts.push({
      type: "country",
      level: "info",
      message: `${topCountry.name} contributes ${share.toFixed(
        1
      )}% of revenue.`,
    });
  }

  if (Number(kpis.avgOrderValue || 0) < 25) {
    alerts.push({
      type: "aov",
      level: "warning",
      message: "Average order value is below AED 25.",
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      type: "healthy",
      level: "info",
      message:
        "No major exceptions detected for the selected period.",
    });
  }

  return alerts;
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
  const ordersTrend = new Map();
  const aovTrend = new Map();

  for (const day of days || []) {
    let dayRevenue = 0;
    let dayOrders = 0;

    for (const store of day.stores || []) {
      if (
        normalizedCountry &&
        normalize(store.country_name) !== normalizedCountry
      ) {
        continue;
      }

      if (
        normalizedStore &&
        String(store.store_code || "").trim() !==
          normalizedStore
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
      dayOrders += storeOrders;

      if (day.date) {
        dates.add(day.date);
      }

      const storeKey = String(
        store.store_code || ""
      ).trim();

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
        store.country_name ||
        store.country_code ||
        "Unknown";

      const companyName =
        store.company_name ||
        store.company_code ||
        "Unknown";

      countryMap.set(
        countryName,
        (countryMap.get(countryName) || 0) +
          storeRevenue
      );

      companyMap.set(
        companyName,
        (companyMap.get(companyName) || 0) +
          storeRevenue
      );

      for (const channel of store.sales_types || []) {
        const channelName = channel.name || "UNKNOWN";

        salesTypeMap.set(
          channelName,
          (salesTypeMap.get(channelName) || 0) +
            Number(channel.value || 0)
        );
      }

      /*
       * Items are normally stored under each store in the summary JSON.
       * The day-level fallback is included for compatibility with any older
       * summary files where items may be directly under the day object.
       */
      const storeItems = Array.isArray(store.items)
        ? store.items
        : [];

      for (const item of storeItems) {
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
        ).trim();

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

    /*
     * Compatibility fallback for summaries that keep items directly under
     * each day rather than inside individual stores.
     */
    for (const item of day.items || []) {
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
      ).trim();

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

    if (day.date) {
      revenueTrend.set(day.date, dayRevenue);
      ordersTrend.set(day.date, dayOrders);
      aovTrend.set(
        day.date,
        dayOrders > 0 ? dayRevenue / dayOrders : 0
      );
    }
  }

  const reportingDays = dates.size || 1;

  const storeDirectory = Array.from(
    storeMap.values()
  ).map((store) => ({
    ...store,

    avg_order_value:
      store.orders > 0
        ? store.net_sales / store.orders
        : 0,

    avg_daily_sales:
      store.net_sales / reportingDays,

    contribution_percent:
      netRevenue !== 0
        ? (store.net_sales / netRevenue) * 100
        : 0,
  }));

  const itemRanking = Array.from(itemMap.values());

  const countrySales = sortDesc(
    Array.from(countryMap.entries()).map(
      ([name, value]) => ({
        name,
        value,
      })
    ),
    "value"
  );

  const companySales = sortDesc(
    Array.from(companyMap.entries()).map(
      ([name, value]) => ({
        name,
        value,
      })
    ),
    "value"
  );

  const salesTypeMix = sortDesc(
    Array.from(salesTypeMap.entries()).map(
      ([name, value]) => ({
        name,
        value,
      })
    ),
    "value"
  );

  const topStores = sortDesc(
    storeDirectory,
    "net_sales"
  ).slice(0, 10);

  const bottomStores = sortAsc(
    storeDirectory.filter(
      (item) => Number(item.net_sales || 0) > 0
    ),
    "net_sales"
  ).slice(0, 10);

  const kpis = {
    netRevenue,
    orders,

    avgOrderValue:
      orders > 0 ? netRevenue / orders : 0,

    discounts,

    discountPercent:
      netRevenue !== 0
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

    reportingDays,
  };

  return {
    kpis,

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

    ordersTrend: Array.from(
      ordersTrend.entries()
    )
      .map(([date, value]) => ({
        date,
        value,
      }))
      .sort((a, b) =>
        a.date.localeCompare(b.date)
      ),

    avgOrderValueTrend: Array.from(
      aovTrend.entries()
    )
      .map(([date, value]) => ({
        date,
        value,
      }))
      .sort((a, b) =>
        a.date.localeCompare(b.date)
      ),

    countrySales,
    companySales,
    salesTypeMix,

    storeDirectory: sortDesc(
      storeDirectory,
      "net_sales"
    ),

    topStores,
    bottomStores,

    topItemsByRevenue: sortDesc(
      itemRanking,
      "net_sales"
    ).slice(0, 10),

    topItemsByQuantity: sortDesc(
      itemRanking,
      "quantity"
    ).slice(0, 10),

    bottomItemsByRevenue: sortAsc(
      itemRanking.filter(
        (item) => Number(item.net_sales || 0) > 0
      ),
      "net_sales"
    ).slice(0, 10),

    bottomItemsByQuantity: sortAsc(
      itemRanking.filter(
        (item) => Number(item.quantity || 0) > 0
      ),
      "quantity"
    ).slice(0, 10),

    executiveAlerts: buildExecutiveAlerts({
      kpis,
      topStores,
      bottomStores,
      salesTypeMix,
      countrySales,
    }),
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
  const selectedMonth =
    month || getLatestSalesMonth();

  if (!selectedMonth) {
    throw new Error(
      "No sales summary data is available"
    );
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

  const dateFilteredDays = filterDaysByDate(
    periodData.days || [],
    fromDate,
    toDate
  );

  const aggregated = aggregateFilteredDays(
    dateFilteredDays,
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

  const storeOptions = (
    periodData.selectedBrand.stores || []
  )
    .filter((item) => {
      if (!country) {
        return true;
      }

      return (
        normalize(item.country_name) ===
        normalize(country)
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
      periodData.selectedBrand.brandName ||
      normalizedBrandCode,

    month: selectedMonth,
    period: normalizedPeriod,

    currency:
      periodData.selectedSummary?.currency ||
      "AED",

    periodInfo: {
      type: normalizedPeriod,
      selectedMonth,

      includedMonths:
        periodData.includedMonths || [],

      includedFiles:
        periodData.includedFiles || [],

      sourceByMonth:
        periodData.sourceByMonth || {},

      requestedFromDate:
        fromDate || null,

      requestedToDate:
        toDate || null,

      startDate:
        dateFilteredDays[0]?.date || null,

      endDate:
        dateFilteredDays[
          dateFilteredDays.length - 1
        ]?.date || null,
    },

    filters: {
      countries: [
        ...(periodData.selectedBrand.countries ||
          []),
      ].sort(),

      stores: storeOptions,

      periods: ["WTD", "MTD", "YTD"],
    },

    revenueComparison: {
      ...revenueComparison,
      regionRevenue:
        aggregated.countrySales || [],
    },

    ...aggregated,
  };
}

async function refreshSalesMonth(month) {
  const selectedMonth =
    month || getLatestSalesMonth();

  if (!selectedMonth) {
    throw new Error(
      "No sales summary data is available"
    );
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
