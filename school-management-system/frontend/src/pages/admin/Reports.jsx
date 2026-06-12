import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { toast } from "react-hot-toast";
import {
  CalendarDays,
  Download,
  FileText,
  Gauge,
  LockKeyhole,
  UsersRound,
  Zap,
} from "lucide-react";

const Reports = () => {
  const [reportCat, setReportCat] = useState("attendance");
  const [filterType, setFilterType] = useState("daily");
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("all");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [selectedMonth, setSelectedMonth] = useState(
    (new Date().getMonth() + 1).toString().padStart(2, "0"),
  );
  const [selectedYear, setSelectedYear] = useState(
    new Date().getFullYear().toString(),
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      const res = await api.get("classes/sections/");
      setClasses(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownload = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        report_cat: reportCat,
        type: filterType,
        class: selectedClass,
      });

      if (filterType === "daily") params.append("date", selectedDate);
      if (filterType === "monthly") {
        params.append("month", selectedMonth);
        params.append("year", selectedYear);
      }
      if (filterType === "yearly") params.append("year", selectedYear);

      const response = await api.get(`reports/download/?${params.toString()}`, {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;

      // Extract filename from header or use default
      const contentDisposition = response.headers["content-disposition"];
      let filename = `${reportCat}_report.csv`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch.length > 1) filename = filenameMatch[1];
      }

      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Report downloaded successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to download report.");
    } finally {
      setLoading(false);
    }
  };

  const months = [
    { val: "01", name: "January" },
    { val: "02", name: "February" },
    { val: "03", name: "March" },
    { val: "04", name: "April" },
    { val: "05", name: "May" },
    { val: "06", name: "June" },
    { val: "07", name: "July" },
    { val: "08", name: "August" },
    { val: "09", name: "September" },
    { val: "10", name: "October" },
    { val: "11", name: "November" },
    { val: "12", name: "December" },
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) =>
    (currentYear - i).toString(),
  );

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-school-navy tracking-tight">
            Generation Reports
          </h1>
          <p className="text-slate-400 font-medium mt-1">
            Export academic and administrative data with advanced filters.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-4 py-2 rounded-full border border-slate-100">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          System Online
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Configuration Card */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 p-8 md:p-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {/* Primary Filters */}
              <div className="space-y-8">
                <div className="space-y-3">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Report Category
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: "attendance", label: "Attendance", Icon: CalendarDays },
                      { id: "marks", label: "Marks", Icon: FileText },
                      { id: "students", label: "Students", Icon: UsersRound },
                      { id: "teachers", label: "Teachers", Icon: UsersRound },
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setReportCat(cat.id)}
                        className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all group ${
                          reportCat === cat.id
                            ? "border-school-navy bg-school-navy text-white shadow-lg shadow-school-navy/20"
                            : "border-slate-50 bg-slate-50/50 text-slate-500 hover:border-slate-200"
                        }`}
                      >
                        <cat.Icon className="h-5 w-5 shrink-0" strokeWidth={2.3} />
                        <span className="text-sm font-bold">{cat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Select Class
                  </label>
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl p-4 text-sm font-bold text-school-navy outline-none focus:border-school-navy transition-all appearance-none cursor-pointer"
                    disabled={reportCat === "teachers"}
                  >
                    <option value="all">All Classes & Sections</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.class_name} - {c.section_name}
                      </option>
                    ))}
                  </select>
                  {reportCat === "teachers" && (
                    <p className="text-[10px] text-amber-500 font-bold ml-1">
                      Not applicable for teacher reports
                    </p>
                  )}
                </div>
              </div>

              {/* Secondary Filters */}
              <div className="space-y-8 bg-slate-50/50 rounded-[2rem] p-8 border border-slate-100">
                <div className="space-y-3">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Period Type
                  </label>
                  <div className="flex gap-2 p-1 bg-white rounded-xl border border-slate-100">
                    {["daily", "monthly", "yearly"].map((type) => (
                      <button
                        key={type}
                        onClick={() => setFilterType(type)}
                        className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all ${
                          filterType === type
                            ? "bg-school-navy text-white shadow-md"
                            : "text-slate-400 hover:bg-slate-50"
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
                  {filterType === "daily" && (
                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        Target Date
                      </label>
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-full bg-white border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold text-school-navy outline-none focus:border-school-navy transition-all"
                      />
                    </div>
                  )}

                  {filterType === "monthly" && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                          Month
                        </label>
                        <select
                          value={selectedMonth}
                          onChange={(e) => setSelectedMonth(e.target.value)}
                          className="w-full bg-white border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold text-school-navy outline-none focus:border-school-navy transition-all"
                        >
                          {months.map((m) => (
                            <option key={m.val} value={m.val}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-3">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                          Year
                        </label>
                        <select
                          value={selectedYear}
                          onChange={(e) => setSelectedYear(e.target.value)}
                          className="w-full bg-white border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold text-school-navy outline-none focus:border-school-navy transition-all"
                        >
                          {years.map((y) => (
                            <option key={y} value={y}>
                              {y}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {filterType === "yearly" && (
                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        Target Year
                      </label>
                      <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value)}
                        className="w-full bg-white border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold text-school-navy outline-none focus:border-school-navy transition-all"
                      >
                        {years.map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleDownload}
                  disabled={loading}
                  className={`w-full py-5 rounded-2xl flex items-center justify-center gap-3 transition-all ${
                    loading
                      ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                      : "bg-school-navy text-white hover:scale-[1.02] hover:shadow-2xl hover:shadow-school-navy/30 active:scale-[0.98]"
                  }`}
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Download className="h-5 w-5" strokeWidth={2.4} />
                      <span className="font-black uppercase tracking-wider text-xs">
                        Download CSV Report
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Info / Quick Stats Card */}
        <div className="space-y-6">
          <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white h-full relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-school-blue opacity-10 rounded-full -mr-32 -mt-32 transition-all group-hover:scale-125 duration-700"></div>
            <div className="relative z-10 space-y-8">
              <div>
                <h4 className="text-lg font-bold">Reporting Guide</h4>
                <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                  Our advanced reporting engine generates standards-compliant
                  CSV files. All data is real-time and reflects current database
                  states.
                </p>
              </div>

              <div className="space-y-4">
                {[
                  { label: "Data Latency", val: "< 200ms", Icon: Zap },
                  { label: "Record Limit", val: "Unlimited", Icon: Gauge },
                  { label: "Security", val: "E2E Encrypted", Icon: LockKeyhole },
                ].map((stat, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5"
                  >
                    <stat.Icon className="h-5 w-5 shrink-0 text-school-blue" strokeWidth={2.3} />
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        {stat.label}
                      </p>
                      <p className="font-bold text-sm">{stat.val}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-white/5">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
                  Support
                </p>
                <button className="text-xs font-bold text-school-blue hover:underline">
                  Download Documentation PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
