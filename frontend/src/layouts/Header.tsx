import { LogOut, Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function Header() {
  const navigate = useNavigate();
  const { user, logoutUser } = useAuth();

  const handleLogout = () => {
    logoutUser();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="flex h-20 items-center justify-between px-8">
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            Sprinklez F&amp;B Dashboard
          </h1>
          <p className="text-sm text-slate-500">
            Executive Company Overview
          </p>
        </div>

        <div className="flex items-center gap-6">
          <button className="rounded-xl border border-slate-200 p-3 text-slate-500 hover:bg-slate-50">
            <Bell size={20} />
          </button>

          <div className="text-right">
            <p className="font-semibold text-slate-800">
              {user?.emp_name}
            </p>
            <p className="text-sm text-slate-500">
              {user?.designation}
            </p>
          </div>

          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 font-bold text-white">
            {user?.emp_name?.charAt(0) || "S"}
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;