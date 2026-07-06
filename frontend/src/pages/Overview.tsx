import DashboardLayout from "../layouts/DashboardLayout";
import { useAuth } from "../context/AuthContext";

function Overview() {
  const { user } = useAuth();

  const hour = new Date().getHours();

  const greeting =
    hour < 12
      ? "Good Morning"
      : hour < 17
      ? "Good Afternoon"
      : "Good Evening";

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

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total Stores</p>
          <h2 className="mt-3 text-4xl font-bold text-slate-800">--</h2>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total Brands</p>
          <h2 className="mt-3 text-4xl font-bold text-slate-800">--</h2>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total Companies</p>
          <h2 className="mt-3 text-4xl font-bold text-slate-800">--</h2>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total Countries</p>
          <h2 className="mt-3 text-4xl font-bold text-slate-800">--</h2>
        </div>
      </section>
    </DashboardLayout>
  );
}

export default Overview;