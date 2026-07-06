import Header from "./Header";
import Footer from "./Footer";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main className="min-h-[calc(100vh-144px)] px-8 py-8">
        {children}
      </main>

      <Footer />
    </div>
  );
}

export default DashboardLayout;