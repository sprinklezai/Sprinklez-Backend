const {
  getPeriodBrandData,
} = require("./salesPeriodService");

function normalize(value) {
  return String(value ?? "").trim().toUpperCase();
}

function shiftDateYear(dateValue, offset) {
  if (!dateValue) return "";

  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);

  if (!match) return "";

  return `${Number(match[1]) + offset}-${match[2]}-${match[3]}`;
}

function shiftMonthYear(monthValue, offset) {
  const match =
    /^(\d{4})_(\d{2})$/.exec(
      String(monthValue || "")
    );

  if (!match) return "";

  return `${Number(match[1]) + offset}_${match[2]}`;
}

function filterDays(days, fromDate, toDate) {
  return (days || []).filter((day) => {
    const date = String(day.date || "");

    return (
      (!fromDate || date >= fromDate) &&
      (!toDate || date <= toDate)
    );
  });
}

function monthlyRevenue(days, country, storeCode) {
  const normalizedCountry = normalize(country);
  const normalizedStore = String(storeCode || "").trim();
  const monthMap = new Map();

  for (const day of days || []) {
    let dayRevenue = 0;

    for (const store of day.stores || []) {
      if (
        normalizedCountry &&
        normalize(store.country_name) !==
          normalizedCountry
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

      dayRevenue += Number(store.net_sales || 0);
    }

    const month = String(day.date || "").slice(0, 7);

    if (month) {
      monthMap.set(
        month,
        (monthMap.get(month) || 0) + dayRevenue
      );
    }
  }

  return monthMap;
}

function monthLabel(monthValue) {
  const [year, month] = monthValue.split("-");

  return new Date(
    Number(year),
    Number(month) - 1,
    1
  ).toLocaleDateString("en-US", {
    month: "short",
  });
}

function getRevenueComparison({
  brandCode,
  selectedMonth,
  fromDate = "",
  toDate = "",
  country = "",
  store = "",
}) {
  const currentPeriod = getPeriodBrandData({
    selectedMonth,
    period: "YTD",
    brandCode,
  });

  const currentMap = monthlyRevenue(
    filterDays(
      currentPeriod.days || [],
      fromDate,
      toDate
    ),
    country,
    store
  );

  const priorSelectedMonth =
    shiftMonthYear(selectedMonth, -1);

  const priorFromDate =
    shiftDateYear(fromDate, -1);

  const priorToDate =
    shiftDateYear(toDate, -1);

  let priorMap = new Map();

  if (priorSelectedMonth) {
    try {
      const priorPeriod = getPeriodBrandData({
        selectedMonth: priorSelectedMonth,
        period: "YTD",
        brandCode,
      });

      priorMap = monthlyRevenue(
        filterDays(
          priorPeriod.days || [],
          priorFromDate,
          priorToDate
        ),
        country,
        store
      );
    } catch (error) {
      // Prior-year data is optional.
      priorMap = new Map();
    }
  }

  const monthlyRevenueComparison = Array.from(
    currentMap.keys()
  )
    .sort()
    .map((monthValue) => {
      const priorMonthValue = shiftDateYear(
        `${monthValue}-01`,
        -1
      ).slice(0, 7);

      return {
        month: monthValue,
        label: monthLabel(monthValue),
        current: Number(
          currentMap.get(monthValue) || 0
        ),
        prior: Number(
          priorMap.get(priorMonthValue) || 0
        ),
      };
    });

  return {
    monthlyRevenueComparison,

    priorPeriodAvailable: Array.from(
      priorMap.values()
    ).some(
      (value) => Number(value || 0) !== 0
    ),
  };
}

module.exports = {
  getRevenueComparison,
};
