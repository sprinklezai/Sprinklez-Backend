const { loadSalesMonth, clearSalesMonth } = require("./salesEngine");

function normalize(value) {
  return String(value || "").trim().toUpperCase();
}

function sortDesc(data, key) {
  return [...data].sort((a, b) => Number(b[key] || 0) - Number(a[key] || 0));
}

function sortAsc(data, key) {
  return [...data].sort((a, b) => Number(a[key] || 0) - Number(b[key] || 0));
}

async function getSalesDashboard({
  brandCode,
  month = "2026_06",
  period = "MTD",
  country = "",
  store = "",
  search = "",
}) {
  const allRows = await loadSalesMonth(month);

  let enrichedRows = allRows.filter(
    (row) => normalize(row.brand_code) === normalize(brandCode)
  );

  const allBrandRows = enrichedRows;

  if (country) {
    enrichedRows = enrichedRows.filter(
      (row) => normalize(row.country_name) === normalize(country)
    );
  }

  if (store) {
    enrichedRows = enrichedRows.filter(
      (row) => String(row.store_code) === String(store)
    );
  }

  if (search) {
    enrichedRows = enrichedRows.filter((row) =>
      normalize(row.item_description).includes(normalize(search))
    );
  }

  const netRevenue = enrichedRows.reduce((sum, row) => sum + row.net_sales, 0);
  const discounts = enrichedRows.reduce((sum, row) => sum + row.discount, 0);
  const itemsSold = enrichedRows.reduce((sum, row) => sum + row.quantity, 0);

  const uniqueReceipts = new Set(enrichedRows.map((row) => row.receipt_no));
  const orders = uniqueReceipts.size;
  const avgOrderValue = orders ? netRevenue / orders : 0;

  const dateMap = new Map();
  const countryMap = new Map();
  const companyMap = new Map();
  const salesTypeMap = new Map();
  const storeMap = new Map();
  const itemMap = new Map();

  enrichedRows.forEach((row) => {
    dateMap.set(row.date, (dateMap.get(row.date) || 0) + row.net_sales);

    countryMap.set(
      row.country_name,
      (countryMap.get(row.country_name) || 0) + row.net_sales
    );

    companyMap.set(
      row.company_name,
      (companyMap.get(row.company_name) || 0) + row.net_sales
    );

    salesTypeMap.set(
      row.sales_type,
      (salesTypeMap.get(row.sales_type) || 0) + row.net_sales
    );

    if (!storeMap.has(row.store_code)) {
      storeMap.set(row.store_code, {
        store_code: row.store_code,
        store_name: row.store_name,
        country_name: row.country_name,
        company_name: row.company_name,
        net_sales: 0,
        orders: new Set(),
        quantity: 0,
      });
    }

    const storeData = storeMap.get(row.store_code);
    storeData.net_sales += row.net_sales;
    storeData.quantity += row.quantity;
    storeData.orders.add(row.receipt_no);

    if (!itemMap.has(row.item_no)) {
      itemMap.set(row.item_no, {
        item_no: row.item_no,
        item_description: row.item_description,
        quantity: 0,
        net_sales: 0,
      });
    }

    const itemData = itemMap.get(row.item_no);
    itemData.quantity += row.quantity;
    itemData.net_sales += row.net_sales;
  });

  const storeRanking = Array.from(storeMap.values()).map((storeItem) => ({
    store_code: storeItem.store_code,
    store_name: storeItem.store_name,
    country_name: storeItem.country_name,
    company_name: storeItem.company_name,
    net_sales: storeItem.net_sales,
    orders: storeItem.orders.size,
    quantity: storeItem.quantity,
    avg_order_value: storeItem.orders.size
      ? storeItem.net_sales / storeItem.orders.size
      : 0,
  }));

  const itemRanking = Array.from(itemMap.values()).map((item) => ({
    item_no: item.item_no,
    item_description: item.item_description,
    quantity: item.quantity,
    net_sales: item.net_sales,
  }));

  const activeStoreCount = new Set(enrichedRows.map((row) => row.store_code))
    .size;

  const reportingDays = new Set(enrichedRows.map((row) => row.date)).size || 1;
  const averageDailySales = netRevenue / reportingDays;
  const averageDailySalesPerOutlet =
    activeStoreCount > 0 ? averageDailySales / activeStoreCount : 0;

  const countryOptions = Array.from(
    new Set(allBrandRows.map((row) => row.country_name).filter(Boolean))
  ).sort();

  const storeOptions = Array.from(
    new Map(
      allBrandRows.map((row) => [
        row.store_code,
        {
          store_code: row.store_code,
          store_name: row.store_name,
          country_name: row.country_name,
        },
      ])
    ).values()
  ).sort((a, b) => String(a.store_name).localeCompare(String(b.store_name)));

  return {
    success: true,
    brandCode,
    brandName: allBrandRows[0]?.brand_name || brandCode,
    month,
    period,
    currency: "AED",
    kpis: {
      netRevenue,
      orders,
      avgOrderValue,
      discounts,
      discountPercent: netRevenue ? (discounts / netRevenue) * 100 : 0,
      itemsSold,
      activeStores: activeStoreCount,
      averageDailySales,
      averageDailySalesPerOutlet,
      rows: enrichedRows.length,
    },
    filters: {
      countries: countryOptions,
      stores: storeOptions,
      periods: ["WTD", "MTD", "YTD"],
    },
    revenueTrend: Array.from(dateMap.entries())
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => String(a.date).localeCompare(String(b.date))),
    countrySales: sortDesc(
      Array.from(countryMap.entries()).map(([name, value]) => ({ name, value })),
      "value"
    ),
    companySales: sortDesc(
      Array.from(companyMap.entries()).map(([name, value]) => ({ name, value })),
      "value"
    ),
    salesTypeMix: sortDesc(
      Array.from(salesTypeMap.entries()).map(([name, value]) => ({ name, value })),
      "value"
    ),
    topStores: sortDesc(storeRanking, "net_sales").slice(0, 10),
    bottomStores: sortAsc(storeRanking, "net_sales").slice(0, 10),
    topItems: sortDesc(itemRanking, "net_sales").slice(0, 10),
    bottomItems: sortAsc(itemRanking, "net_sales").slice(0, 10),
  };
}

async function refreshSalesMonth(month = "2026_06") {
  clearSalesMonth(month);
  await loadSalesMonth(month, true);

  return {
    success: true,
    message: `Sales cache refreshed for ${month}`,
  };
}

module.exports = {
  getSalesDashboard,
  refreshSalesMonth,
};