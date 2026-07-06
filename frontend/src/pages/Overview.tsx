import { useEffect, useState } from "react";

import DashboardLayout from "../layouts/DashboardLayout";
import { useAuth } from "../context/AuthContext";

import {
  getBrands,
  getCompanies,
  getCountries,
  getStores,
  getEmployees,
} from "../services/dataService";

function Overview() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);

  const [kpis, setKpis] = useState({
    stores: 0,
    brands: 0,
    companies: 0,
    countries: 0,
    employees: 0,
    activeStores: 0,
    inactiveStores: 0,
  });

  const hour = new Date().getHours();

  const greeting =
    hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  useEffect(() => {
    async function loadOverviewData() {
      try {
        const [brands, companies, countries, stores, employees] =
          await Promise.all([
            getBrands(),
            getCompanies(),
            getCountries(),
            getStores(),
            getEmployees(),
          ]);

        const activeStores = stores.filter((store: any) =>
          String(
            store.Store_Status ||
              store.store_status ||
              store.Status ||
              store.status ||
              ""
          )
            .toLowerCase()
            .includes("active")
        ).length;

        const inactiveStores = stores.length - activeStores;

        setKpis({
          stores: stores.length,
          brands: brands.length,
          companies: companies.length,
          countries: countries.length,
          employees: employees.length,
          activeStores,
          inactiveStores,
        });
      } catch (error) {
        console.error("Overview data loading failed:", error);
      } finally {
        setLoading(false);
      }
    }

    loadOverviewData();
  }, []);

  const cards = [
    { title: "Total Stores", value: kpis.stores },
    { title: "Total Brands", value: kpis.brands },
    { title: "Total Companies", value: kpis.companies },
    { title: "Total Countries", value: kpis.countries },
    { title: "Employees", value: kpis.employees },
    { title: "Active Stores", value: kpis.activeStores },
    { title: "Inactive Stores", value: kpis.inactiveStores },
  ];

  return (
    <DashboardLayout>
      <section className="mb-8 rounded-3xl bg-gradient-to-r from-blue-600 to-blue-500 p-8 text-white shadow-lg">
        <p className="mb-2 text-sm font-medium text-blue-100">
          Company Overview
        </p>

        <h1 className="text-4xl font-bold">
          {greeting}, {user?.emp_name} 👋
        </h1>

        <p className="mt-3 max-w-3xl text-blue-100">
          Welcome to Sprinklez General Trading F&amp;B Division Dashboard.
          Monitor companies, countries, brands, stores and performance from one
          executive view.
        </p>
      </section>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">
          Loading overview data...
        </div>
      ) : (
        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <div
              key={card.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <p className="text-sm font-medium text-slate-500">
                {card.title}
              </p>

              <h2 className="mt-3 text-4xl font-bold text-slate-800">
                {card.value}
              </h2>
            </div>
          ))}
        </section>
      )}
    </DashboardLayout>
  );
}

export default Overview;