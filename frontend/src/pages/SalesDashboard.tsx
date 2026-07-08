import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  RefreshCw,
  Download,
  Search,
  TrendingUp,
  Receipt,
  CreditCard,
  Percent,
} from "lucide-react";

import BrandLayout from "../layouts/BrandLayout";
import PieChartCard from "../components/charts/PieChartCard";
import BarChartCard from "../components/charts/BarChartCard";
import LineChartCard from "../components/charts/LineChartCard";
import { getSalesDashboard } from "../api/sales";

function SalesDashboard() {
  const { brandCode } = useParams();
  const code = String(brandCode || "").toUpperCase();

  const [loading, setLoading] = useState(true);
  const [salesData, setSalesData] = useState<any>(null);

  const [month, setMonth] = useState("2026_06");
  const [period, setPeriod] = useState("YTD");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedStore, setSelectedStore] = useState("");
  const [search, setSearch] = useState("");

const compactMoney = (value: number) => {
  const amount = Number(value || 0);

  if (amount >= 1000000) return `AED ${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `AED ${(amount / 1000).toFixed(0)}K`;

  return `AED ${Math.round(amount).toLocaleString()}`;
};

const money = (value: number) =>
  `AED ${Math.round(Number(value || 0)).toLocaleString()}`;

  const number = (value: number) =>
    Math.round(Number(value || 0)).toLocaleString();

  const cleanStoreName = (name: string) =>
    String(name || "")
      .replace(/^SLI\s+/i, "")
      .replace(/^WSP\s+/i, "")
      .replace(/^ALB\s+/i, "")
      .replace(/^NAN\s+/i, "")
      .replace(/^CSC\s+/i, "")
      .trim();

  const loadSales = async () => {
    try {
      setLoading(true);

      const data = await getSalesDashboard(code, month, {
        period,
        country: selectedCountry,
        store: selectedStore,
        search,
      });

      setSalesData(data);
    } catch (error) {
      console.error("Sales dashboard loading failed:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (code) loadSales();
  }, [code, month, period, selectedCountry, selectedStore]);

  const resetFilters = () => {
    setSelectedCountry("");
    setSelectedStore("");
    setSearch("");
    setPeriod("YTD");
  };

  const kpis = salesData?.kpis || {
    netRevenue: 0,
    orders: 0,
    avgOrderValue: 0,
    discounts: 0,
    discountPercent: 0,
    itemsSold: 0,
    activeStores: 0,
    averageDailySales: 0,
    averageDailySalesPerOutlet: 0,
  };

 const brandName =
  salesData?.brandName ||
  {
    SLI: "Sushi Library",
    WSP: "Wingstop",
    ALB: "Allo Beirut",
    NAN: "Nando's",
    CSC: "Cold Stone Creamery",
    JMP: "Jamie's Pizzeria",
    JMT: "Jamie's Italian",
    MCC: "Molten Chocolate Café",
  }[code] ||
  code;

  const revenueTrend =
    salesData?.revenueTrend?.map((item: any) => ({
      name: String(item.date || "").slice(5),
      value: Math.round(Number(item.value || 0)),
    })) || [];

  const countrySales =
    salesData?.countrySales?.map((item: any) => ({
      name: item.name,
      value: Math.round(Number(item.value || 0)),
    })) || [];

  const channelMix =
    salesData?.salesTypeMix?.map((item: any) => ({
      name: item.name || "Unknown",
      value: Math.round(Number(item.value || 0)),
    })) || [];


  return (
    <BrandLayout brandCode={code} brandName={brandName}>
      <div className="min-h-screen bg-[#F7F8FA]">
        <section className="sticky top-0 z-20 border-b border-stone-200 bg-[#F7F8FA]/95 px-1 py-4 backdrop-blur">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h1 className="text-2xl font-extrabold text-stone-950">
                Executive Business Overview
              </h1>
              <p className="text-xs text-stone-500">
                {brandName} · {period} · June 2026 · Updated from sales file
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                className="h-10 rounded-xl border border-stone-300 bg-white px-3 text-xs font-semibold text-stone-700 outline-none"
              >
                <option value="">All Locations</option>
                {(salesData?.filters?.stores || []).map((store: any) => (
                  <option key={store.store_code} value={store.store_code}>
                    {cleanStoreName(store.store_name)}
                  </option>
                ))}
              </select>

              <select
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                className="h-10 rounded-xl border border-stone-300 bg-white px-3 text-xs font-semibold text-stone-700 outline-none"
              >
                <option value="">All Countries</option>
                {(salesData?.filters?.countries || []).map((country: string) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </select>

              <div className="flex h-10 rounded-xl border border-stone-300 bg-white p-1">
                {["WTD", "MTD", "YTD"].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setPeriod(item)}
                    className={`rounded-lg px-4 text-xs font-bold ${
                      period === item
                        ? "bg-[#0F6B52] text-white"
                        : "text-stone-500 hover:bg-stone-100"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>

              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="h-10 rounded-xl border border-stone-300 bg-white px-3 text-xs font-semibold text-stone-700 outline-none"
              >
                <option value="2026_06">Jun 2026</option>
              </select>

              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-3 text-stone-400"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") loadSales();
                  }}
                  placeholder="Search products..."
                  className="h-10 w-48 rounded-xl border border-stone-300 bg-white pl-9 pr-3 text-xs outline-none"
                />
              </div>

              <button
                type="button"
                onClick={loadSales}
                className="flex h-10 items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 text-xs font-bold text-stone-700 hover:bg-stone-100"
              >
                <RefreshCw size={14} />
                Refresh
              </button>

              <button
                type="button"
                onClick={resetFilters}
                className="h-10 rounded-xl border border-stone-300 bg-white px-4 text-xs font-bold text-stone-700 hover:bg-stone-100"
              >
                Reset
              </button>

              <button
                type="button"
                className="flex h-10 items-center gap-2 rounded-xl bg-[#0F6B52] px-4 text-xs font-bold text-white hover:bg-[#0b553f]"
              >
                <Download size={14} />
                Export
              </button>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-8 text-stone-500 shadow-sm">
            Loading sales dashboard...
          </div>
        ) : (
          <>
            <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <ExecutiveKpi
                title="Net Revenue"
                value={compactMoney(kpis.netRevenue)}
                subtitle="Selected period"
                icon={<TrendingUp size={18} />}
              />

              <ExecutiveKpi
                title="Orders"
                value={number(kpis.orders)}
                subtitle="Unique receipts"
                icon={<Receipt size={18} />}
              />

              <ExecutiveKpi
                title="Avg Order Value"
                value={money(kpis.avgOrderValue)}
                subtitle="Revenue per order"
                icon={<CreditCard size={18} />}
              />

              <ExecutiveKpi
                title="Discounts"
                value={compactMoney(kpis.discounts)}
                subtitle={`${Number(kpis.discountPercent || 0).toFixed(1)}% of revenue`}
                icon={<Percent size={18} />}
                accent="gold"
              />
            </section>

            <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <ExecutiveKpi
                title="Items Sold"
                value={number(kpis.itemsSold)}
                subtitle="Total quantity"
              />

              <ExecutiveKpi
                title="Active Stores"
                value={number(kpis.activeStores)}
                subtitle="Stores with sales"
              />

              <ExecutiveKpi
                title="Avg Daily Sales"
                value={compactMoney(kpis.averageDailySales)}
                subtitle="Daily average"
              />

              <ExecutiveKpi
                title="ADS / Outlet"
                value={money(kpis.averageDailySalesPerOutlet)}
                subtitle="Avg daily sales per outlet"
              />
            </section>

            <section className="mt-6 grid gap-5 lg:grid-cols-[2fr_1fr]">
              <LineChartCard
                title="Revenue Trend"
                subtitle="Net revenue by day"
                data={revenueTrend}
              />

              <BarChartCard
                title="Revenue by Country"
                subtitle="Country contribution"
                data={countrySales}
              />
            </section>

            <section className="mt-6 grid gap-5 lg:grid-cols-[2fr_1fr]">
              <LineChartCard
                title="Average Daily Sales / Outlet"
                subtitle="Selected period performance"
                data={revenueTrend}
              />

              <PieChartCard
                title="Channel Mix"
                subtitle="Dine-in, delivery and takeaway"
                data={channelMix}
              />
            </section>

            <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-stone-900">
                    Locations by Sales
                  </h3>
                  <p className="text-xs text-stone-500">
                    Top 10 and bottom 10 locations by net revenue
                  </p>
                </div>
              </div>

              <StoreTable
                data={salesData?.topStores || []}
                formatMoney={compactMoney}
                formatNumber={number}
                cleanStoreName={cleanStoreName}
              />
            </section>

            <section className="mt-6 grid gap-5 lg:grid-cols-2">
              <ItemTable
                title="Top Selling Items"
                data={salesData?.topItems || []}
                formatMoney={compactMoney}
                formatNumber={number}
              />

              <ItemTable
                title="Bottom Selling Items"
                data={salesData?.bottomItems || []}
                formatMoney={compactMoney}
                formatNumber={number}
              />
            </section>
          </>
        )}
      </div>
    </BrandLayout>
  );
}

function ExecutiveKpi({ title, value, subtitle, icon, accent = "green" }: any) {
  const color =
    accent === "gold"
      ? "text-[#C89B3C] bg-[#FBF4E4]"
      : "text-[#0F6B52] bg-[#E7F3EF]";

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-stone-500">{title}</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-stone-950">
            {value}
          </h2>
          <p className="mt-2 text-xs text-stone-500">{subtitle}</p>
        </div>

        {icon && (
          <div className={`rounded-xl p-3 ${color}`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

function StoreTable({ data, formatMoney, formatNumber, cleanStoreName }: any) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead>
          <tr className="border-b border-stone-200 text-xs uppercase tracking-wider text-stone-400">
            <th className="py-3">#</th>
            <th className="py-3">Location</th>
            <th className="py-3">Country</th>
            <th className="py-3 text-right">Revenue</th>
            <th className="py-3 text-right">Orders</th>
            <th className="py-3 text-right">Avg Bill</th>
          </tr>
        </thead>

        <tbody>
          {data.map((store: any, index: number) => (
            <tr key={store.store_code} className="border-b border-stone-100">
              <td className="py-4 font-bold text-[#C89B3C]">
                {String(index + 1).padStart(2, "0")}
              </td>
              <td className="max-w-[280px] truncate py-4 font-bold text-stone-900">
                {cleanStoreName(store.store_name)}
              </td>
              <td className="py-4 text-stone-500">{store.country_name}</td>
              <td className="py-4 text-right font-bold text-stone-900">
                {formatMoney(store.net_sales)}
              </td>
              <td className="py-4 text-right text-stone-600">
                {formatNumber(store.orders)}
              </td>
              <td className="py-4 text-right text-stone-600">
                {formatMoney(store.avg_order_value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ItemTable({ title, data, formatMoney, formatNumber }: any) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      <h3 className="text-base font-bold text-stone-900">{title}</h3>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-xs uppercase tracking-wider text-stone-400">
              <th className="w-12 py-3">#</th>
              <th className="py-3">Item Description</th>
              <th className="w-24 py-3 text-right">Qty</th>
              <th className="w-36 py-3 text-right">Revenue</th>
            </tr>
          </thead>

          <tbody>
            {data.map((item: any, index: number) => (
              <tr key={`${item.item_no}-${index}`} className="border-b border-stone-100">
                <td className="py-4 font-bold text-[#C89B3C]">
                  {String(index + 1).padStart(2, "0")}
                </td>

                <td className="py-4 font-semibold text-stone-900">
                  {item.item_description || item.item_no || "Unknown Item"}
                </td>

                <td className="py-4 text-right text-stone-600">
                  {formatNumber(item.quantity)}
                </td>

                <td className="rounded-r-xl py-4 text-right font-bold text-stone-900">
                  {formatMoney(item.net_sales)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default SalesDashboard;