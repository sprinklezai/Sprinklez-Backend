const { getLatestSalesMonth } = require("./salesMonthService");
const { getPeriodBrandData } = require("./salesPeriodService");

const BRAND_CODES = [
  "ALB",
  "WSP",
  "CSC",
  "SLI",
  "NAN",
  "JMP",
  "JMT",
  "MCC",
];

function normalize(value) {
  return String(value ?? "").trim().toUpperCase();
}

function aggregateBrand({
  brandCode,
  selectedMonth,
  period,
  country,
}) {
  const periodData = getPeriodBrandData({
    selectedMonth,
    period,
    brandCode,
  });

  if (!periodData.selectedBrand) {
    return null;
  }

  const normalizedCountry = normalize(country);

  let netRevenue = 0;
  let orders = 0;
  let activeStores = new Set();
  const countryMap = new Map();
  const storeMap = new Map();

  for (const day of periodData.days || []) {
    for (const store of day.stores || []) {
      if (
        normalizedCountry &&
        normalize(store.country_name) !== normalizedCountry
      ) {
        continue;
      }

      const storeRevenue = Number(store.net_sales || 0);
      const storeOrders = Number(store.orders || 0);
      const storeCode = String(store.store_code || "").trim();

      netRevenue += storeRevenue;
      orders += storeOrders;
      activeStores.add(storeCode);

      const countryName =
        store.country_name ||
        store.country_code ||
        "Unknown";

      countryMap.set(
        countryName,
        (countryMap.get(countryName) || 0) + storeRevenue
      );

      if (!storeMap.has(storeCode)) {
        storeMap.set(storeCode, {
          store_code: store.store_code,
          store_name: store.store_name,
          country_name: countryName,
          net_sales: 0,
          orders: 0,
        });
      }

      const storeItem = storeMap.get(storeCode);
      storeItem.net_sales += storeRevenue;
      storeItem.orders += storeOrders;
    }
  }

  return {
    brand_code: brandCode,
    brand_name:
      periodData.selectedBrand.brandName ||
      brandCode,
    stores:
      periodData.selectedBrand.stores?.length || 0,
    countries:
      periodData.selectedBrand.countries?.length || 0,
    net_revenue: netRevenue,
    orders,
    activeStores: activeStores.size,
    countryMap,
    storesData: Array.from(storeMap.values()),
    endDate:
      periodData.days?.[
        periodData.days.length - 1
      ]?.date || null,
  };
}

function getExecutiveOverview({
  period = "MTD",
  country = "",
}) {
  const selectedMonth = getLatestSalesMonth();

  if (!selectedMonth) {
    throw new Error("No sales data is available");
  }

  const normalizedPeriod = normalize(period);
  const brands = BRAND_CODES.map((brandCode) =>
    aggregateBrand({
      brandCode,
      selectedMonth,
      period: normalizedPeriod,
      country,
    })
  ).filter(Boolean);

  const netRevenue = brands.reduce(
    (sum, item) => sum + Number(item.net_revenue || 0),
    0
  );

  const orders = brands.reduce(
    (sum, item) => sum + Number(item.orders || 0),
    0
  );

  const activeStores = brands.reduce(
    (sum, item) => sum + Number(item.activeStores || 0),
    0
  );

  const totalStores = brands.reduce(
    (sum, item) => sum + Number(item.stores || 0),
    0
  );

  const countryMap = new Map();
  const allStores = [];

  for (const brand of brands) {
    for (const [name, value] of brand.countryMap.entries()) {
      countryMap.set(
        name,
        (countryMap.get(name) || 0) + Number(value || 0)
      );
    }

    for (const store of brand.storesData) {
      allStores.push({
        ...store,
        brand_code: brand.brand_code,
        brand_name: brand.brand_name,
      });
    }
  }

  const revenueByBrand = [...brands]
    .sort(
      (a, b) =>
        Number(b.net_revenue || 0) -
        Number(a.net_revenue || 0)
    )
    .map((item) => ({
      name: item.brand_name,
      value: item.net_revenue,
      percentage:
        netRevenue !== 0
          ? (item.net_revenue / netRevenue) * 100
          : 0,
    }));

  const revenueByCountry = Array.from(
    countryMap.entries()
  )
    .map(([name, value]) => ({
      name,
      value,
      percentage:
        netRevenue !== 0
          ? (Number(value || 0) / netRevenue) * 100
          : 0,
    }))
    .sort(
      (a, b) =>
        Number(b.value || 0) -
        Number(a.value || 0)
    );

  const sortedStores = [...allStores].sort(
    (a, b) =>
      Number(b.net_sales || 0) -
      Number(a.net_sales || 0)
  );

  const topStores = sortedStores.slice(0, 5);
  const bottomStores = sortedStores
    .filter((item) => Number(item.net_sales || 0) > 0)
    .slice(-5)
    .reverse();

  const topBrand = revenueByBrand[0];
  const topCountry = revenueByCountry[0];

  const executiveSummary = [];

  if (topBrand) {
    executiveSummary.push({
      message: `${topBrand.name} is the leading brand with ${topBrand.percentage.toFixed(
        1
      )}% of total revenue.`,
    });
  }

  if (topCountry) {
    executiveSummary.push({
      message: `${topCountry.name} contributes ${topCountry.percentage.toFixed(
        1
      )}% of total revenue.`,
    });
  }

  executiveSummary.push({
    message: `Average check is AED ${
      orders > 0 ? (netRevenue / orders).toFixed(2) : "0.00"
    } across ${activeStores} active stores.`,
  });

  if (topStores[0]) {
    executiveSummary.push({
      message: `${topStores[0].store_name} is the highest-revenue store for the selected period.`,
    });
  }

  if (bottomStores.length > 0) {
    executiveSummary.push({
      message: `${bottomStores.length} low-performing stores require management review.`,
    });
  }

  const executiveAlerts = [];

  if (bottomStores[0]) {
    executiveAlerts.push({
      level: "critical",
      message: `${bottomStores[0].store_name} is currently the lowest-revenue active store.`,
    });
  }

  if (
    topBrand &&
    Number(topBrand.percentage || 0) >= 35
  ) {
    executiveAlerts.push({
      level: "warning",
      message: `${topBrand.name} represents ${topBrand.percentage.toFixed(
        1
      )}% of group revenue, indicating brand concentration.`,
    });
  }

  if (
    topCountry &&
    Number(topCountry.percentage || 0) >= 45
  ) {
    executiveAlerts.push({
      level: "warning",
      message: `${topCountry.name} represents ${topCountry.percentage.toFixed(
        1
      )}% of revenue, indicating market concentration.`,
    });
  }

  if (executiveAlerts.length === 0) {
    executiveAlerts.push({
      level: "info",
      message: "No major executive exceptions detected.",
    });
  }

  const countries = [
    ...new Set(
      brands.flatMap((item) =>
        Array.from(item.countryMap.keys())
      )
    ),
  ].sort();

  const latestAvailableDate =
    brands
      .map((item) => item.endDate)
      .filter(Boolean)
      .sort()
      .at(-1) || null;

  return {
    success: true,
    selectedMonth,
    period: normalizedPeriod,
    filters: {
      countries,
    },
    kpis: {
      netRevenue,
      orders,
      avgOrderValue:
        orders > 0 ? netRevenue / orders : 0,
      activeStores,
      totalStores,
      revenueGrowthPercent: 0,
      ordersGrowthPercent: 0,
      aovGrowthPercent: 0,
      grossProfitAvailable: false,
      grossProfit: 0,
      grossMarginPercent: 0,
    },
    executiveSummary,
    executiveAlerts,
    revenueByBrand,
    revenueByCountry,
    brandPortfolio: brands.map((item) => ({
      brand_code: item.brand_code,
      brand_name: item.brand_name,
      stores: item.stores,
      countries: item.countries,
      net_revenue: item.net_revenue,
    })),
    topStores,
    bottomStores,
    systemHealth: {
      latestAvailableDate,
      lastRefresh: new Date().toISOString(),
      loadStatus: "Completed Successfully",
      coveragePercent: totalStores > 0
        ? (activeStores / totalStores) * 100
        : 0,
      syncedStores: activeStores,
      totalStores,
      pendingStores: Math.max(
        totalStores - activeStores,
        0
      ),
    },
  };
}

module.exports = {
  getExecutiveOverview,
};
