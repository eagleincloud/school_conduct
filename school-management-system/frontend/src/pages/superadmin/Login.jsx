import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import authService from "../../services/authService";
import useAuthStore from "../../store/authStore";

export default function SuperAdminLogin() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const user = await authService.login(username, password);
      if (user) {
        if (user.role !== "superadmin") {
          setError(
            "Access Denied: This portal is reserved for Platform Administrators.",
          );
          authService.logout();
          setIsLoading(false);
          return;
        }
        setUser(user);
        navigate("/superadmin/dashboard");
      }
    } catch (err) {
      setError("Invalid platform credentials. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6 font-inter relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-school-navy/5 rounded-full blur-3xl"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-school-azure/5 rounded-full blur-3xl"></div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="w-16 h-16 bg-school-navy rounded-2xl flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4 shadow-xl shadow-school-navy/20">
            A
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Platform Control
          </h1>
          <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-full shadow-sm">
            <span className="w-2 h-2 rounded-full bg-school-azure animate-pulse"></span>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Global Superadmin
            </span>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-xl border border-white rounded-3xl shadow-2xl shadow-slate-200/50 p-8 md:p-10 animate-in fade-in zoom-in-95 duration-500 delay-150">
          <div className="mb-8">
            <h2 className="text-xl font-bold text-slate-800 mb-1">
              Administrator Login
            </h2>
            <p className="text-sm text-slate-500">
              Secure entry for platform orchestration
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 ml-1 uppercase tracking-wider">
                Username
              </label>
              <div className="relative group">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-school-navy transition-colors">
                  👤
                </span>
                <input
                  type="text"
                  placeholder="admin_id"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/10 focus:bg-white focus:border-school-navy/20 transition-all font-medium"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 ml-1 uppercase tracking-wider">
                Security Token
              </label>
              <div className="relative group">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-school-navy transition-colors">
                  🔒
                </span>
                <input
                  type="password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/10 focus:bg-white focus:border-school-navy/20 transition-all font-medium"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-2xl text-xs font-bold flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <span>⚠️</span>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-4 rounded-2xl text-sm font-bold text-white shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2
                ${isLoading ? "bg-slate-400" : "bg-school-navy hover:bg-school-azure shadow-school-navy/20"}`}
            >
              {isLoading ? "Verifying..." : "Initialize Session"}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-50 text-center">
            <button
              onClick={() => navigate("/")}
              className="text-xs font-bold text-school-azure hover:text-school-navy transition-colors uppercase tracking-widest"
            >
              ← Back to SaaS Gateway
            </button>
          </div>
        </div>

        <p className="text-center mt-8 text-[11px] text-slate-400 font-medium">
          © {new Date().getFullYear()} School Conduct Platform Management.
          Secure Access Level 4.
        </p>
      </div>
    </div>
  );
}
