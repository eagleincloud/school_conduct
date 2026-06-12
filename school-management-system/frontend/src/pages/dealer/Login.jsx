import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import authService from "../../services/authService";
import useAuthStore from "../../store/authStore";

export default function DealerLogin() {
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
        if (user.role !== "dealer") {
          setError(
            "Access Denied: You are not registered as a Platform Dealer.",
          );
          authService.logout();
          setIsLoading(false);
          return;
        }
        setUser(user);
        navigate("/dealer/dashboard");
      }
    } catch (err) {
      const errorData = err.response?.data;
      if (errorData && errorData.detail) {
        setError(errorData.detail);
      } else if (errorData && typeof errorData === "object") {
        const firstError = Object.values(errorData)[0];
        setError(
          Array.isArray(firstError) ? firstError[0] : String(firstError),
        );
      } else {
        setError(
          "Invalid dealer credentials. Please check your username and password.",
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6 font-inter relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-900/5 rounded-full blur-3xl"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-school-azure/5 rounded-full blur-3xl"></div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="w-16 h-16 bg-slate-900 rounded-[2px] flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4 shadow-xl shadow-slate-900/20">
            D
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Dealer Portal
          </h1>
          <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-full shadow-sm">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Authorized Dealer Access
            </span>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-xl border border-white rounded-3xl shadow-2xl shadow-slate-200/50 p-8 md:p-10 animate-in fade-in zoom-in-95 duration-500 delay-150">
          <div className="mb-8">
            <h2 className="text-xl font-bold text-slate-800 mb-1">
              Dealer Login
            </h2>
            <p className="text-sm text-slate-500">
              Sign in to manage your institution portfolio
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 ml-1 uppercase tracking-wider">
                Dealer Username
              </label>
              <div className="relative group">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                  👤
                </span>
                <input
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:bg-white focus:border-indigo-500/20 transition-all font-medium"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 ml-1 uppercase tracking-wider">
                Access Password
              </label>
              <div className="relative group">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                  🔒
                </span>
                <input
                  type="password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:bg-white focus:border-indigo-500/20 transition-all font-medium"
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
                ${isLoading ? "bg-slate-400" : "bg-slate-900 hover:bg-slate-800 shadow-slate-900/20"}`}
            >
              {isLoading ? "Authenticating..." : "Sign In as Dealer"}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-50 text-center">
            <button
              onClick={() => navigate("/")}
              className="text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors uppercase tracking-widest"
            >
              ← Back to SaaS Gateway
            </button>
          </div>
        </div>

        <p className="text-center mt-8 text-[11px] text-slate-400 font-medium">
          © {new Date().getFullYear()} School Conduct Multi-Tenant System.
        </p>
      </div>
    </div>
  );
}
