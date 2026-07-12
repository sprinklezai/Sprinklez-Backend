const {
  getAvailableMonthValues,
  getDailySummariesForMonth,
  hasMonthlySummary,
  loadMonthlySummary,
  loadDailySummary,
} = require("./salesFileService");

function normalize(value) {
  return String(value ?? "").trim().toUpperCase();
}

function parseMonthValue(monthValue) {
  const match = /^(\d{4})_(\d{2})$/.exec(
    String(monthValue || "").trim()
  );

  if (!match) {
    throw new Error(
      `Invalid month format: ${monthValue}`
    );
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
  };
}

function toDate(value) {
  if (!value) return null;

  const date = new Date(`${value}T00:00:00`);

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

function getStartOfWeek(date) {
  const result = new Date(date);
  const day = result.getDay();
  const difference =
    day === 0 ? -6 : 1 - day;

  result.setDate(
    result.getDate() + difference
  );

  result.setHours(0, 0, 0, 0);

  return result;
}

function getBrandFromSummary(
  summary,
  brandCode
) {
  const normalizedBrandCode =
    normalize(brandCode);

  return (
    summary?.brands?.[
      normalizedBrandCode
    ] || null
  );
}

function getBrandDaysFromSummary(
  summary,
  brandCode
) {
  const brand = getBrandFromSummary(
    summary,
    brandCode
  );

  return Array.isArray(brand?.daily)
    ? brand.daily
    : [];
}

function getLatestDayDate(days = []) {
  return (
    [...days]
      .map((day) =>
        String(day.date || "").trim()
      )
      .filter(Boolean)
      .sort()
      .at(-1) || null
  );
}

function mergeBrandMetadata(
  baseBrand,
  dailyBrands
) {
  const allBrands = [
    baseBrand,
    ...dailyBrands,
  ].filter(Boolean);

  if (allBrands.length === 0) {
    return null;
  }

  const firstBrand = allBrands[0];
  const countrySet = new Set();
  const storeMap = new Map();

  for (const brand of allBrands) {
    for (const country of brand.countries || []) {
      if (country) {
        countrySet.add(country);
      }
    }

    for (const store of brand.stores || []) {
      const storeCode = String(
        store.store_code || ""
      ).trim();

      if (storeCode) {
        storeMap.set(storeCode, store);
      }
    }
  }

  return {
    ...firstBrand,

    brandCode:
      firstBrand.brandCode,

    brandName:
      firstBrand.brandName,

    countries:
      Array.from(countrySet).sort(),

    stores:
      Array.from(storeMap.values()).sort(
        (a, b) =>
          String(
            a.store_name || ""
          ).localeCompare(
            String(
              b.store_name || ""
            )
          )
      ),
  };
}

function getMonthBrandData(
  monthValue,
  brandCode
) {
  const dailyFiles =
    getDailySummariesForMonth(
      monthValue
    );

  if (hasMonthlySummary(monthValue)) {
    const monthlySummary =
      loadMonthlySummary(monthValue);

    const monthlyBrand =
      getBrandFromSummary(
        monthlySummary,
        brandCode
      );

    const monthlyDays =
      getBrandDaysFromSummary(
        monthlySummary,
        brandCode
      );

    const monthlyDateSet = new Set(
      monthlyDays
        .map((day) =>
          String(day.date || "").trim()
        )
        .filter(Boolean)
    );

    const additionalDays = [];
    const dailyBrands = [];
    const includedDailyFiles = [];

    for (const dailyFile of dailyFiles) {
      const dailySummary =
        loadDailySummary(
          dailyFile.filePath
        );

      const dailyBrand =
        getBrandFromSummary(
          dailySummary,
          brandCode
        );

      if (!dailyBrand) {
        continue;
      }

      dailyBrands.push(dailyBrand);

      const eligibleDays =
        getBrandDaysFromSummary(
          dailySummary,
          brandCode
        ).filter((day) => {
          const dayDate = String(
            day.date || ""
          ).trim();

          return (
            dayDate &&
            !monthlyDateSet.has(dayDate)
          );
        });

      if (eligibleDays.length > 0) {
        additionalDays.push(
          ...eligibleDays
        );

        includedDailyFiles.push(
          dailyFile.fileName
        );
      }
    }

    const combinedDays = [
      ...monthlyDays,
      ...additionalDays,
    ].sort((a, b) =>
      String(a.date).localeCompare(
        String(b.date)
      )
    );

    return {
      source:
        additionalDays.length > 0
          ? "monthly+daily"
          : "monthly",

      monthValue,

      summary:
        monthlySummary,

      brand:
        mergeBrandMetadata(
          monthlyBrand,
          dailyBrands
        ),

      days:
        combinedDays,

      monthlyCutoffDate:
        getLatestDayDate(
          monthlyDays
        ),

      latestDate:
        getLatestDayDate(
          combinedDays
        ),

      includedFiles: [
        `${monthValue}_sales_summary.json`,
        ...includedDailyFiles,
      ],
    };
  }

  const days = [];
  const dailyBrands = [];
  const includedFiles = [];
  let latestSummary = null;

  for (const dailyFile of dailyFiles) {
    const dailySummary =
      loadDailySummary(
        dailyFile.filePath
      );

    const dailyBrand =
      getBrandFromSummary(
        dailySummary,
        brandCode
      );

    latestSummary =
      dailySummary;

    if (!dailyBrand) {
      continue;
    }

    dailyBrands.push(
      dailyBrand
    );

    days.push(
      ...getBrandDaysFromSummary(
        dailySummary,
        brandCode
      )
    );

    includedFiles.push(
      dailyFile.fileName
    );
  }

  const combinedDays = days.sort(
    (a, b) =>
      String(a.date).localeCompare(
        String(b.date)
      )
  );

  return {
    source: "daily",
    monthValue,

    summary:
      latestSummary,

    brand:
      mergeBrandMetadata(
        null,
        dailyBrands
      ),

    days:
      combinedDays,

    monthlyCutoffDate:
      null,

    latestDate:
      getLatestDayDate(
        combinedDays
      ),

    includedFiles,
  };
}

function getYtdMonthValues(
  selectedMonth
) {
  const selected =
    parseMonthValue(
      selectedMonth
    );

  return getAvailableMonthValues().filter(
    (monthValue) => {
      const candidate =
        parseMonthValue(
          monthValue
        );

      return (
        candidate.year ===
          selected.year &&
        candidate.month <=
          selected.month
      );
    }
  );
}

function getPeriodBrandData({
  selectedMonth,
  period,
  brandCode,
}) {
  const normalizedPeriod =
    normalize(period || "MTD");

  if (normalizedPeriod === "YTD") {
    const monthValues =
      getYtdMonthValues(
        selectedMonth
      );

    const allDays = [];
    const includedFiles = [];
    const sourceByMonth = {};

    let selectedBrand = null;
    let selectedSummary = null;

    for (const monthValue of monthValues) {
      const monthData =
        getMonthBrandData(
          monthValue,
          brandCode
        );

      allDays.push(
        ...monthData.days
      );

      includedFiles.push(
        ...monthData.includedFiles
      );

      sourceByMonth[monthValue] =
        monthData.source;

      if (
        monthValue ===
        selectedMonth
      ) {
        selectedBrand =
          monthData.brand;

        selectedSummary =
          monthData.summary;
      }
    }

    const sortedDays =
      allDays.sort((a, b) =>
        String(a.date).localeCompare(
          String(b.date)
        )
      );

    return {
      days:
        sortedDays,

      selectedBrand,
      selectedSummary,

      includedMonths:
        monthValues,

      includedFiles,
      sourceByMonth,

      startDate:
        sortedDays[0]?.date ||
        null,

      endDate:
        sortedDays[
          sortedDays.length - 1
        ]?.date || null,
    };
  }

  const monthData =
    getMonthBrandData(
      selectedMonth,
      brandCode
    );

  let days = [
    ...monthData.days,
  ].sort((a, b) =>
    String(a.date).localeCompare(
      String(b.date)
    )
  );

  if (
    normalizedPeriod === "WTD" &&
    days.length > 0
  ) {
    const latestDate =
      toDate(
        days[
          days.length - 1
        ]?.date
      );

    if (latestDate) {
      const weekStart =
        getStartOfWeek(
          latestDate
        );

      days = days.filter(
        (day) => {
          const date =
            toDate(day.date);

          return (
            date &&
            date >= weekStart &&
            date <= latestDate
          );
        }
      );
    }
  }

  return {
    days,

    selectedBrand:
      monthData.brand,

    selectedSummary:
      monthData.summary,

    includedMonths: [
      selectedMonth,
    ],

    includedFiles:
      monthData.includedFiles,

    sourceByMonth: {
      [selectedMonth]:
        monthData.source,
    },

    startDate:
      days[0]?.date || null,

    endDate:
      days[
        days.length - 1
      ]?.date || null,
  };
}

module.exports = {
  getPeriodBrandData,
  getMonthBrandData,
  getYtdMonthValues,
};
