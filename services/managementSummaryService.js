function formatMoney(value, currency = "AED") {
  const amount = Number(value || 0);
  if (Math.abs(amount) >= 1000000) return `${currency} ${(amount / 1000000).toFixed(2)}M`;
  if (Math.abs(amount) >= 1000) return `${currency} ${(amount / 1000).toFixed(0)}K`;
  return `${currency} ${Math.round(amount).toLocaleString()}`;
}

function buildManagementSummary({
  brandName,
  period,
  periodInfo,
  kpis,
  countrySales,
  salesTypeMix,
  topStores,
  bottomStores,
  currency = "AED",
}) {
  const positiveInsights = [];
  const attentionPoints = [];
  const recommendedActions = [];

  const topCountry = countrySales?.[0];
  const topChannel = salesTypeMix?.[0];
  const topStore = topStores?.[0];
  const bottomStore = bottomStores?.[0];

  if (topCountry && Number(kpis.netRevenue || 0) !== 0) {
    const share = (Number(topCountry.value || 0) / Number(kpis.netRevenue || 1)) * 100;
    positiveInsights.push(`${topCountry.name} is the largest market at ${share.toFixed(1)}% of revenue.`);
  }

  if (topChannel && Number(kpis.netRevenue || 0) !== 0) {
    const share = (Number(topChannel.value || 0) / Number(kpis.netRevenue || 1)) * 100;
    positiveInsights.push(`${topChannel.name} is the leading channel at ${share.toFixed(1)}% contribution.`);
  }

  if (topStore) {
    positiveInsights.push(`${topStore.store_name} is the highest-revenue store at ${formatMoney(topStore.net_sales, currency)}.`);
  }

  if (Number(kpis.discountPercent || 0) >= 10) {
    attentionPoints.push(`Discounts are ${Number(kpis.discountPercent).toFixed(1)}% of revenue.`);
    recommendedActions.push("Review discount-heavy stores and channels for profitability impact.");
  }

  if (bottomStore) {
    attentionPoints.push(`${bottomStore.store_name} is the lowest-revenue active store.`);
    recommendedActions.push("Review low-performing store traffic, operating hours and local promotions.");
  }

  if (Number(kpis.avgOrderValue || 0) < 25) {
    attentionPoints.push(`Average order value is low at ${formatMoney(kpis.avgOrderValue, currency)}.`);
    recommendedActions.push("Consider bundles, upselling prompts and menu engineering to improve spend per transaction.");
  }

  if (!positiveInsights.length) positiveInsights.push("Performance is available for the selected filters.");
  if (!attentionPoints.length) attentionPoints.push("No major exceptions were detected for the selected period.");
  if (!recommendedActions.length) recommendedActions.push("Continue monitoring store productivity, average order value and discount rate.");

  const headline = attentionPoints[0].startsWith("No major")
    ? "Performance is stable across the selected period"
    : "Performance requires focused management review";

  const narrative = `${brandName} generated ${formatMoney(kpis.netRevenue, currency)} in net revenue from ${Math.round(Number(kpis.orders || 0)).toLocaleString()} orders across ${Math.round(Number(kpis.activeStores || 0)).toLocaleString()} active stores. Average order value was ${formatMoney(kpis.avgOrderValue, currency)}, while average daily sales per outlet were ${formatMoney(kpis.averageDailySalesPerOutlet, currency)}. The selected range covers ${periodInfo?.startDate || "N/A"} to ${periodInfo?.endDate || "N/A"} under ${period}.`;

  return { headline, narrative, positiveInsights, attentionPoints, recommendedActions };
}

module.exports = { buildManagementSummary };
