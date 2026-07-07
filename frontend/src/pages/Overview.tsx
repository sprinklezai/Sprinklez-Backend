import { useEffect, useState } from "react";
import {
  Building2,
  CheckCircle2,
  Globe2,
  Store,
  Tag,
  Users,
  XCircle,
} from "lucide-react";

import DashboardLayout from "../layouts/DashboardLayout";
import { useAuth } from "../context/AuthContext";
import { getOverview } from "../api/overview";

import KpiCard from "../components/widgets/KpiCard";
import BrandCard from "../components/widgets/BrandCard";
import PieChartCard from "../components/widgets/PieChartCard";
import BarChartCard from "../components/widgets/BarChartCard";

const brandLogoMap: Record<string, string> = {
  ALB: "/brand-logos/allo-beirut.png",
  WSP: "/brand-logos/wingstop.png",
  CSC: "/brand-logos/coldstone.png",
  SLI: "/brand-logos/sushi-library.png",
  NAN: "/brand-logos/nandos.png",
  JMP: "/brand-logos/jamies-pizzeria.png",
  JMT: "/brand-logos/jamies-italian.png",
  MCC: "/brand-logos/molten.png",
};

function Overview() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<any>(null);

  const hour = new Date().getHours();

  const greeting =
    hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  useEffect(() => {
    async function loadOverview() {
      try {
        const data = await getOverview();
        setOverview(data);
      } catch (error) {
        console.error("Overview loading failed:", error);
      } finally {
        setLoading(false);
      }
    }

    loadOverview();
  }, []);

  const kpis = overview?.kpis || {
    stores: 0,
    brands: 0,
    companies: 0,
    countries: 0,
    employees: 0,
    activeStores: 0,
    inactiveStores: 0,
  };

  const brandCards = overview?.brandSummary || [];
  const topBrands = overview?.topBrandsByStores || [];
  const countrySummary = overview?.countrySummary || [];

  const activePercent =
    kpis.stores > 0 ? Math.round((kpis.activeStores / kpis.stores) * 100) : 0;

  const inactivePercent =
    kpis.stores > 0
      ? Math.round((kpis.inactiveStores / kpis.stores) * 100)
      : 0;

  return (
    <DashboardLayout>
      <section className="mb-8 overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-blue-100 p-8 shadow-sm">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <h1 className="text-4xl font-extrabold text-slate-900">
              {greeting}, {user?.emp_name} 👋
            </h1>

            <p className="mt-3 text-lg font-semibold text-slate-700">
              Welcome to Sprinklez General Trading F&amp;B Division
            </p>

            <p className="mt-2 text-slate-500">
              Executive Overview Dashboard
            </p>
          </div>

          <div className="hidden items-end justify-end lg:flex">
            <div className="w-full rounded-3xl bg-white/60 p-6 text-right text-blue-500">
              <p className="text-sm font-semibold">Business Overview</p>
              <p className="mt-2 text-5xl font-black text-blue-600">
                F&amp;B
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Brands · Stores · Countries · Companies
              </p>
            </div>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">
          Loading overview data...
        </div>
      ) : (
        <>
          <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title="Total Stores"
              value={kpis.stores}
              subtitle="Across all brands"
              icon={<Store size={30} />}
              accent="blue"
            />

            <KpiCard
              title="Total Brands"
              value={kpis.brands}
              subtitle="Brand portfolio"
              icon={<Tag size={30} />}
              accent="green"
            />

            <KpiCard
              title="Total Companies"
              value={kpis.companies}
              subtitle="Company entities"
              icon={<Building2 size={30} />}
              accent="purple"
            />

            <KpiCard
              title="Total Countries"
              value={kpis.countries}
              subtitle="Global presence"
              icon={<Globe2 size={30} />}
              accent="orange"
            />
          </section>

          <section className="mt-6 grid gap-6 lg:grid-cols-3">
            <KpiCard
              title="Active Stores"
              value={kpis.activeStores}
              subtitle={`${activePercent}% operating stores`}
              icon={<CheckCircle2 size={34} />}
              accent="green"
            />

            <KpiCard
              title="Inactive Stores"
              value={kpis.inactiveStores}
              subtitle={`${inactivePercent}% non-operational stores`}
              icon={<XCircle size={34} />}
              accent="red"
            />

            <KpiCard
              title="Total Employees"
              value={kpis.employees}
              subtitle="Across all companies"
              icon={<Users size={34} />}
              accent="blue"
            />
          </section>

          <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900">
                Our Brand Portfolio
              </h2>
              <p className="text-sm text-slate-500">
                Click on any brand to view detailed performance
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
              {brandCards.map((brand: any) => (
                <BrandCard
                  key={brand.brand_code}
                  name={brand.brand_name}
                  code={brand.brand_code}
                  logo={brandLogoMap[brand.brand_code] || ""}
                  stores={brand.stores}
                  countries={brand.countries}
                />
              ))}
            </div>
          </section>

          <section className="mt-8 grid gap-6 lg:grid-cols-2">
            <PieChartCard
              title="Country Contribution"
              data={countrySummary.map((item: any) => ({
                name: item.country_name,
                value: item.stores,
              }))}
            />

            <BarChartCard
              title="Brand Contribution by Store Count"
              data={topBrands.slice(0, 8).map((item: any) => ({
                name: item.brand_name,
                value: item.stores,
              }))}
            />
          </section>
        </>
      )}
    </DashboardLayout>
  );
}

export default Overview;