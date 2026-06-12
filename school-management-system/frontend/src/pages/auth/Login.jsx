import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import authService from "../../services/authService";
import useAuthStore from "../../store/authStore";
import useSchoolStore from "../../store/schoolStore";
import { useStudent } from "../../context/StudentContext";

const Login = () => {
  const { schoolId: rawSchoolId } = useParams();
  const schoolId = (rawSchoolId || '').toString().trim();
  const normalizedSchoolId = schoolId.replace(/\s+/g, '').toUpperCase();
  const finalSchoolId = normalizedSchoolId === 'DEFALT' ? 'DEFAULT' : normalizedSchoolId;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { setUser, logout } = useAuthStore();
  const { setSelectedStudentId } = useStudent();
  const {
    school,
    loading: schoolLoading,
    fetchSchoolInfo,
    clearSchool,
  } = useSchoolStore();

  useEffect(() => {
    if (!finalSchoolId || finalSchoolId === "undefined") {
      navigate("/");
      return;
    }
    fetchSchoolInfo(finalSchoolId);
    return () => clearSchool();
  }, [finalSchoolId, fetchSchoolInfo, clearSchool, navigate]);

  // Get the expected role from URL (e.g., /school/:id/login?role=admin)
  const expectedRole = searchParams.get("role") || "student";
  const roleTitle =
    expectedRole === "student"
      ? "Parent"
      : expectedRole.charAt(0).toUpperCase() + expectedRole.slice(1);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const user = await authService.login(username, password);
      if (user) {
        if (user.role !== expectedRole) {
          setError(`Access Denied: You are not a registered ${roleTitle}.`);
          authService.logout();
          logout();
          setIsLoading(false);
          return;
        }

        // Enforce strict tenant isolation
        // String coercion is used since API might send number, URL param is string
        if (String(user.school_id) !== String(finalSchoolId)) {
          setError(`Access Denied: You do not belong to this school portal.`);
          authService.logout();
          logout();
          setIsLoading(false);
          return;
        }

        setUser(user);

        if (user.role === "admin") navigate("/admin/dashboard");
        else if (user.role === "teacher") navigate("/teacher/dashboard");
        else {
          if (user.student_profile_id) {
            setSelectedStudentId(user.student_profile_id);
          }
          navigate("/student/dashboard");
        }
      }
    } catch (err) {
      const errorMsg =
        err.response?.data?.detail ||
        err.response?.data?.error ||
        "Invalid credentials. Please check your username and password.";
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  if (schoolLoading)
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500 font-inter">
        Loading Portal...
      </div>
    );
  if (!school)
    return (
      <div className="min-h-screen flex items-center justify-center text-red-500 font-inter">
        School portal not found.
      </div>
    );

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6 font-inter relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-school-navy/5 rounded-full blur-3xl"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-school-blue/5 rounded-full blur-3xl"></div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {school.logo ? (
            <>
              <img
                src={school.logo}
                alt={school.name}
                className="w-16 h-16 rounded-[2px] mx-auto mb-4 shadow-xl"
                onError={(e) => {
                  e.target.style.display = "none";
                  e.target.nextSibling.style.display = "flex";
                }}
              />
              <div
                className="w-16 h-16 bg-school-navy rounded-[2px] items-center justify-center text-white text-2xl font-bold mx-auto mb-4 shadow-xl shadow-school-navy/20"
                style={{ display: "none" }}
              >
                {school.name[0]}
              </div>
            </>
          ) : (
            <div className="w-16 h-16 bg-school-navy rounded-[2px] flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4 shadow-xl shadow-school-navy/20">
              {school.name[0]}
            </div>
          )}
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {school.name}
          </h1>
          <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-full shadow-sm">
            <span className="w-2 h-2 rounded-full bg-school-blue animate-pulse"></span>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              {roleTitle} Portal
            </span>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-xl border border-white rounded-3xl shadow-2xl shadow-slate-200/50 p-8 md:p-10 animate-in fade-in zoom-in-95 duration-500 delay-150">
          <div className="mb-8">
            <h2 className="text-xl font-bold text-slate-800 mb-1">
              {roleTitle} Login
            </h2>
            <p className="text-sm text-slate-500">
              Please enter your credentials to continue
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
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/10 focus:bg-white focus:border-school-navy/20 transition-all font-medium"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 ml-1 uppercase tracking-wider">
                Password
              </label>
              <div className="relative group">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-school-navy transition-colors">
                  🔒
                </span>
                <input
                  type="password"
                  placeholder="••••••••"
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
                                ${isLoading ? "bg-slate-400 cursor-not-allowed" : "bg-school-navy hover:bg-school-blue shadow-school-navy/20"}`}
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-50 text-center">
            <button
              type="button"
              onClick={() => navigate(`/school/${schoolId}`)}
              className="text-xs font-bold text-school-blue hover:text-school-navy transition-colors uppercase tracking-widest"
            >
              ← Back to Home
            </button>
          </div>
        </div>

        <p className="text-center mt-8 text-[11px] text-slate-400 font-medium">
          © {new Date().getFullYear()} {school.name}. Secure Access Management
          System.
        </p>
      </div>
    </div>
  );
};

export default Login;
