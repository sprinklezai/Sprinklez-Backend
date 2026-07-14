const OpenAI = require("openai");
const { getSalesDashboard } = require("./salesService");

function clean(value, max = 500) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, max);
}

function snapshot(data) {
  return {
    brand: data.brandName,
    brand_code: data.brandCode,
    currency: data.currency || "AED",
    period: data.period,
    start_date: data.periodInfo?.startDate || null,
    end_date: data.periodInfo?.endDate || null,
    kpis: {
      net_revenue: Number(data.kpis?.netRevenue || 0),
      orders: Number(data.kpis?.orders || 0),
      average_order_value: Number(data.kpis?.avgOrderValue || 0),
      discounts: Number(data.kpis?.discounts || 0),
      discount_percent: Number(data.kpis?.discountPercent || 0),
      active_stores: Number(data.kpis?.activeStores || 0),
      average_daily_sales_per_outlet: Number(
        data.kpis?.averageDailySalesPerOutlet || 0
      ),
    },
    revenue_by_country: (data.countrySales || []).slice(0, 10),
    revenue_by_channel: (data.salesTypeMix || []).slice(0, 10),
    top_stores: (data.topStores || []).slice(0, 10),
    bottom_stores: (data.bottomStores || []).slice(0, 10),
    top_items_by_revenue: (data.topItemsByRevenue || []).slice(0, 10),
    top_items_by_quantity: (data.topItemsByQuantity || []).slice(0, 10),
    executive_alerts: (data.executiveAlerts || []).slice(0, 8),
  };
}

function fallback(data) {
  return `${data.brand} generated ${data.currency} ${Math.round(
    data.kpis.net_revenue
  ).toLocaleString()} from ${Math.round(
    data.kpis.orders
  ).toLocaleString()} orders. Average order value was ${
    data.currency
  } ${data.kpis.average_order_value.toFixed(2)}. Data is available through ${
    data.end_date || "the selected end date"
  }.`;
}

async function askSalesAssistant(args) {
  const question = clean(args.question);

  if (!question) {
    throw new Error("Please enter a question");
  }

  const dashboard = await getSalesDashboard({
    brandCode: args.brandCode,
    month: args.month,
    period: args.period || "MTD",
    country: args.country || "",
    store: args.store || "",
    search: "",
    fromDate: args.fromDate || "",
    toDate: args.toDate || "",
  });

  const data = snapshot(dashboard);

  if (!process.env.OPENAI_API_KEY) {
    return {
      success: true,
      answer: fallback(data),
      mode: "analytics-fallback",
      dataThrough: data.end_date,
    };
  }

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5-mini",
    instructions: [
      "You are Sprinklez AI Sales Assistant.",
      "Answer only from the supplied analytics snapshot.",
      "Never invent numbers, stores, causes, budgets, targets or forecasts.",
      "If information is missing, say it is unavailable in the current dataset.",
      "Use concise CEO-friendly language.",
      "State the data-through date in every answer.",
      "Recommended actions must be clearly labelled as recommendations.",
    ].join("\n"),
    input: JSON.stringify({
      question,
      analytics_snapshot: data,
      logged_in_user: clean(args.user?.emp_name || args.user?.emp_id, 100),
    }),
    max_output_tokens: 700,
  });

  return {
    success: true,
    answer: clean(response.output_text, 6000) || fallback(data),
    mode: "openai",
    dataThrough: data.end_date,
  };
}

module.exports = { askSalesAssistant };
