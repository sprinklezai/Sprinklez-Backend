const {
  getAvailableMonthValues,
  getLatestAvailableDate,
  hasMonthlySummary,
  getDailySummariesForMonth,
} = require("./salesFileService");

function formatMonthLabel(
  monthValue
) {
  const match =
    /^(\d{4})_(\d{2})$/.exec(
      monthValue
    );

  if (!match) {
    return monthValue;
  }

  const year =
    Number(match[1]);

  const month =
    Number(match[2]);

  return new Date(
    year,
    month - 1,
    1
  ).toLocaleDateString(
    "en-US",
    {
      month: "short",
      year: "numeric",
    }
  );
}

function getAvailableSalesMonths() {
  return getAvailableMonthValues()
    .map((value) => {
      const dailyFiles =
        getDailySummariesForMonth(
          value
        );

      const monthlyExists =
        hasMonthlySummary(
          value
        );

      return {
        value,

        label:
          formatMonthLabel(
            value
          ),

        status:
          dailyFiles.length > 0
            ? "in_progress"
            : monthlyExists
              ? "closed"
              : "in_progress",

        hasMonthlySummary:
          monthlyExists,

        dailyFileCount:
          dailyFiles.length,
      };
    })
    .sort((a, b) =>
      b.value.localeCompare(
        a.value
      )
    );
}

function getLatestSalesMonth() {
  return (
    getAvailableSalesMonths()[
      0
    ]?.value || null
  );
}

function getSalesAvailability() {
  const months =
    getAvailableSalesMonths();

  return {
    months,

    latestMonth:
      months[0]?.value ||
      null,

    latestAvailableDate:
      getLatestAvailableDate(),
  };
}

module.exports = {
  getAvailableSalesMonths,
  getLatestSalesMonth,
  getSalesAvailability,
};
