import React, { useEffect, useState, useCallback } from "react";
import api from "../../services/api";
import { toast } from "react-hot-toast";
import {
  CalendarDays,
  Download,
  Users,
  UsersRound,
  Search,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  BookOpen,
  Filter,
  UserCheck,
  UserX,
  Clock,
  BarChart3,
  RotateCw,
  Table2,
} from "lucide-react";

/* ══════════════════════════════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════════════════════════════ */
const MONTHS = [
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

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const getTodayDate = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => (currentYear - i).toString());

const EXAM_TYPES = [
  { val: "all", label: "All Exams" },
  { val: "unit_test", label: "Unit Test" },
  { val: "class_test", label: "Class Test" },
  { val: "mst", label: "MST" },
  { val: "final", label: "Final" },
];

const StatusBadge = ({ status }) => {
  const s = (status || "").toLowerCase();
  const colors = {
    present: "bg-emerald-50 text-emerald-700 border-emerald-200",
    absent: "bg-red-50 text-red-700 border-red-200",
    late: "bg-amber-50 text-amber-700 border-amber-200",
    active: "bg-emerald-50 text-emerald-700 border-emerald-200",
    inactive: "bg-slate-100 text-slate-500 border-slate-200",
  };
  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
        colors[s] || "bg-slate-100 text-slate-500 border-slate-200"
      }`}
    >
      {status}
    </span>
  );
};

const Pagination = ({ meta, onPageChange }) => {
  if (!meta || meta.total_pages <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-4 border-t border-slate-100">
      <p className="text-xs text-slate-400 font-medium">
        Page {meta.page} of {meta.total_pages} &middot; {meta.total} records
      </p>
      <div className="flex gap-1">
        <button
          onClick={() => onPageChange(meta.page - 1)}
          disabled={meta.page <= 1}
          className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => onPageChange(meta.page + 1)}
          disabled={meta.page >= meta.total_pages}
          className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

const SummaryCard = ({ icon: Icon, label, value, color }) => (
  <div className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all ${color}`}>
    <Icon className="h-5 w-5 shrink-0" strokeWidth={2.3} />
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-xl font-black">{value}</p>
    </div>
  </div>
);

const EmptyState = ({ message }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <ClipboardList className="h-12 w-12 text-slate-200 mb-4" strokeWidth={1.5} />
    <p className="text-sm font-bold text-slate-400">{message || "No data found"}</p>
    <p className="text-xs text-slate-300 mt-1">Try adjusting your filters or date selection.</p>
  </div>
);

/* Cell color helper for diary grid */
const cellStyle = (val) => {
  if (val === "P") return "bg-emerald-100 text-emerald-800 font-bold";
  if (val === "A") return "bg-red-100 text-red-800 font-bold";
  if (val === "L") return "bg-amber-100 text-amber-800 font-bold";
  if (val === "H") return "bg-blue-100 text-blue-700 font-bold";
  if (val === "S") return "bg-purple-100 text-purple-700 font-bold";
  if (val === "-") return "bg-slate-50 text-slate-300";
  return "bg-white text-slate-200";
};

const inputCls =
  "w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-school-navy outline-none focus:border-school-navy focus:ring-1 focus:ring-school-navy/20 transition-all";
const btnPrimary =
  "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-school-navy text-white text-xs font-bold uppercase tracking-wider hover:bg-school-navy/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm";
const btnOutline =
  "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold uppercase tracking-wider hover:bg-slate-50 transition-all shadow-sm";

/* ══════════════════════════════════════════════════════════════════════
   Main Component
   ══════════════════════════════════════════════════════════════════════ */
const Reports = () => {
  // Top-level tab
  const [activeTab, setActiveTab] = useState("attendance");
  // Sub-tab
  const [subTab, setSubTab] = useState("teacher_att");

  // Shared filter state
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterType, setFilterType] = useState("daily");
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [selectedMonth, setSelectedMonth] = useState(
    String(new Date().getMonth() + 1).padStart(2, "0")
  );
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [statusFilter, setStatusFilter] = useState("all");
  const [examType, setExamType] = useState("all");

  // Dropdown lists
  const [studentsList, setStudentsList] = useState([]);
  const [teachersList, setTeachersList] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");

  // Data (flat list mode)
  const [data, setData] = useState([]);
  const [meta, setMeta] = useState(null);
  const [summary, setSummary] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Diary mode data
  const [diaryData, setDiaryData] = useState(null);

  // Are we showing diary grid?
  const isDiaryMode = (subTab === "student_att" || subTab === "teacher_att") &&
    (filterType === "monthly" || filterType === "yearly");

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  // Fetch classes on mount
  useEffect(() => {
    api.get("classes/sections/").then(r => setClasses(r.data || [])).catch(() => {});
  }, []);

  // Reset filters when main tab changes
  useEffect(() => {
    if (activeTab === "students") setSubTab("list");
    else if (activeTab === "teachers") setSubTab("list");
    else if (activeTab === "attendance") setSubTab("teacher_att");

    setSearch("");
    setDebouncedSearch("");
    setSelectedClass("all");
    setStatusFilter("all");
    setExamType("all");
    setSelectedStudentId("");
    setSelectedTeacherId("");
    setPage(1);
  }, [activeTab]);

  // Reset filters when sub-tab changes
  useEffect(() => {
    setSearch("");
    setDebouncedSearch("");
    setSelectedStudentId("");
    setSelectedTeacherId("");
    setPage(1);
    setDiaryData(null);
  }, [subTab]);

  // Load students dropdown
  useEffect(() => {
    if (subTab === "student_att" || subTab === "marks" || subTab === "individual_marks") {
      const params = selectedClass !== "all" ? `?class=${selectedClass}` : "";
      api.get(`reports/students-dropdown/${params}`).then(r => setStudentsList(r.data || [])).catch(() => {});
    }
  }, [subTab, selectedClass]);

  // Load teachers dropdown
  useEffect(() => {
    if (subTab === "teacher_att") {
      api.get("reports/teachers-dropdown/").then(r => setTeachersList(r.data || [])).catch(() => {});
    }
  }, [subTab]);

  /* ─── FETCH diary data ─── */
  const fetchDiary = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("type", filterType);
      if (filterType === "monthly") {
        params.append("month", selectedMonth);
        params.append("year", selectedYear);
      }
      if (filterType === "yearly") {
        params.append("year", selectedYear);
      }

      let url = "";
      if (subTab === "student_att") {
        url = "reports/preview/student-attendance-diary/";
        if (selectedClass !== "all") params.append("class", selectedClass);
      } else if (subTab === "teacher_att") {
        url = "reports/preview/teacher-attendance-diary/";
      }

      const res = await api.get(`${url}?${params.toString()}`);
      setDiaryData(res.data);
      // Clear flat data
      setData([]);
      setMeta(null);
      setSummary(null);
    } catch (err) {
      console.error("Failed to load diary data:", err);
      toast.error("Failed to load diary data.");
      setDiaryData(null);
    } finally {
      setLoading(false);
    }
  }, [subTab, filterType, selectedMonth, selectedYear, selectedClass]);

  /* ─── FETCH preview data (flat list) ─── */
  const fetchPreview = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      let url = "";
      const params = new URLSearchParams({ page: p, page_size: 50 });

      if (subTab === "list" && activeTab === "students") {
        url = "reports/preview/students/";
        if (selectedClass !== "all") params.append("class", selectedClass);
        if (debouncedSearch) params.append("search", debouncedSearch);
      } else if (subTab === "list" && activeTab === "teachers") {
        url = "reports/preview/teachers/";
        if (statusFilter !== "all") params.append("status", statusFilter);
        if (debouncedSearch) params.append("search", debouncedSearch);
      } else if (subTab === "student_att") {
        url = "reports/preview/student-attendance/";
        params.append("type", filterType);
        if (filterType === "daily") params.append("date", selectedDate);
        if (filterType === "monthly") {
          params.append("month", selectedMonth);
          params.append("year", selectedYear);
        }
        if (filterType === "yearly") params.append("year", selectedYear);
        if (selectedClass !== "all") params.append("class", selectedClass);
        if (statusFilter !== "all") params.append("status", statusFilter);
        if (selectedStudentId) params.append("student_id", selectedStudentId);
      } else if (subTab === "teacher_att") {
        url = "reports/preview/teacher-attendance/";
        params.append("type", filterType);
        if (filterType === "daily") params.append("date", selectedDate);
        if (filterType === "monthly") {
          params.append("month", selectedMonth);
          params.append("year", selectedYear);
        }
        if (filterType === "yearly") params.append("year", selectedYear);
        if (statusFilter !== "all") params.append("status", statusFilter);
        if (selectedTeacherId) params.append("teacher_id", selectedTeacherId);
      } else if (subTab === "marks" || subTab === "individual_marks") {
        url = "reports/preview/marks/";
        if (selectedClass !== "all") params.append("class", selectedClass);
        if (examType !== "all") params.append("exam_type", examType);
        if (selectedStudentId) params.append("student_id", selectedStudentId);
        if (debouncedSearch) params.append("search", debouncedSearch);
      }

      if (!url) {
        setLoading(false);
        return;
      }

      const res = await api.get(`${url}?${params.toString()}`);
      setData(res.data.results || []);
      setMeta(res.data.meta || null);
      setSummary(res.data.summary || null);
      setPage(p);
      setDiaryData(null);
    } catch (err) {
      console.error("Failed to load report data:", err);
      toast.error("Failed to load report data.");
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [
    activeTab,
    subTab,
    selectedClass,
    debouncedSearch,
    filterType,
    selectedDate,
    selectedMonth,
    selectedYear,
    statusFilter,
    selectedStudentId,
    selectedTeacherId,
    examType,
  ]);

  // Auto-fetch whenever tab, sub-tab, or active filters change
  useEffect(() => {
    if (isDiaryMode) {
      fetchDiary();
    } else {
      fetchPreview(page);
    }
  }, [isDiaryMode, fetchDiary, fetchPreview, page]);

  /* ─── DOWNLOAD CSV ─── */
  const handleDownload = async () => {
    setDownloading(true);
    try {
      const params = new URLSearchParams();

      if (subTab === "list" && activeTab === "students") {
        params.append("report_cat", "students");
        if (selectedClass !== "all") params.append("class", selectedClass);
        if (debouncedSearch) params.append("search", debouncedSearch);
      } else if (subTab === "list" && activeTab === "teachers") {
        params.append("report_cat", "teachers");
        if (statusFilter !== "all") params.append("status", statusFilter);
        if (debouncedSearch) params.append("search", debouncedSearch);
      } else if (subTab === "student_att") {
        params.append("report_cat", "attendance");
        params.append("type", filterType);
        if (filterType === "daily") params.append("date", selectedDate);
        if (filterType === "monthly") {
          params.append("month", selectedMonth);
          params.append("year", selectedYear);
        }
        if (filterType === "yearly") params.append("year", selectedYear);
        if (selectedClass !== "all") params.append("class", selectedClass);
        if (statusFilter !== "all") params.append("status", statusFilter);
        if (selectedStudentId) params.append("student_id", selectedStudentId);
      } else if (subTab === "teacher_att") {
        params.append("report_cat", "teacher_attendance");
        params.append("type", filterType);
        if (filterType === "daily") params.append("date", selectedDate);
        if (filterType === "monthly") {
          params.append("month", selectedMonth);
          params.append("year", selectedYear);
        }
        if (filterType === "yearly") params.append("year", selectedYear);
        if (statusFilter !== "all") params.append("status", statusFilter);
        if (selectedTeacherId) params.append("teacher_id", selectedTeacherId);
      } else if (subTab === "marks" || subTab === "individual_marks") {
        params.append("report_cat", "marks");
        if (selectedClass !== "all") params.append("class", selectedClass);
        if (examType !== "all") params.append("exam_type", examType);
        if (selectedStudentId) params.append("student_id", selectedStudentId);
        if (debouncedSearch) params.append("search", debouncedSearch);
      }

      // If diary mode, generate CSV on the frontend from diaryData
      if (isDiaryMode && diaryData && diaryData.rows && diaryData.rows.length > 0) {
        let csvContent = "";
        const isStudent = subTab === "student_att";
        const headerCols = isStudent
          ? ["Name", "Roll No", "Adm No", "Class"]
          : ["Name", "Employee ID"];

        const allCols = [...headerCols, ...diaryData.columns, "Present", "Absent", "Late"];
        csvContent += allCols.join(",") + "\n";

        for (const row of diaryData.rows) {
          const baseCols = isStudent
            ? [row.name, row.roll_number, row.admission_number, row.class_name]
            : [row.name, row.employee_id];

          const cellVals = row.cells.map(c => {
            if (typeof c === "object" && c !== null) {
              return `P:${c.P} A:${c.A} L:${c.L}`;
            }
            return c || "";
          });
          const line = [...baseCols, ...cellVals, row.present, row.absent, row.late]
            .map(v => `"${String(v).replace(/"/g, '""')}"`)
            .join(",");
          csvContent += line + "\n";
        }

        const blob = new Blob([csvContent], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        const prefix = isStudent ? "student" : "teacher";
        const timeStr = filterType === "monthly" ? `${selectedMonth}_${selectedYear}` : selectedYear;
        link.setAttribute("download", `${prefix}_attendance_diary_${timeStr}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        toast.success("Diary report downloaded successfully!");
        setDownloading(false);
        return;
      }

      const response = await api.get(`reports/download/?${params.toString()}`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      const cd = response.headers["content-disposition"];
      let filename = "report.csv";
      if (cd) {
        const m = cd.match(/filename="?([^"]+)"?/);
        if (m && m[1]) filename = m[1];
      }
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Report downloaded successfully!");
    } catch (err) {
      console.error("Download failed:", err);
      toast.error("Download failed.");
    } finally {
      setDownloading(false);
    }
  };

  /* ══════════════════════════════════════════════════════════════════
     RENDER SECTIONS
     ══════════════════════════════════════════════════════════════════ */

  const renderTimePeriodFilters = () => (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
        Period Filter
      </label>
      <div className="flex gap-1 p-0.5 bg-slate-100 rounded-lg">
        {["daily", "monthly", "yearly"].map(t => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setFilterType(t);
              setPage(1);
            }}
            className={`flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${
              filterType === t
                ? "bg-white text-school-navy shadow-sm font-extrabold"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {filterType === "daily" && (
        <div className="pt-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
            Date
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={e => {
              setSelectedDate(e.target.value);
              setPage(1);
            }}
            className={inputCls}
          />
        </div>
      )}
      {filterType === "monthly" && (
        <div className="pt-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
            Month & Year
          </label>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={selectedMonth}
              onChange={e => {
                setSelectedMonth(e.target.value);
                setPage(1);
              }}
              className={inputCls}
            >
              {MONTHS.map(m => (
                <option key={m.val} value={m.val}>
                  {m.name}
                </option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={e => {
                setSelectedYear(e.target.value);
                setPage(1);
              }}
              className={inputCls}
            >
              {YEARS.map(y => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      {filterType === "yearly" && (
        <div className="pt-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
            Year
          </label>
          <select
            value={selectedYear}
            onChange={e => {
              setSelectedYear(e.target.value);
              setPage(1);
            }}
            className={inputCls}
          >
            {YEARS.map(y => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );

  const renderFilterBar = () => {
    if (subTab === "list" && activeTab === "students")
      return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative sm:col-span-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
              Search Students
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
              <input
                type="text"
                placeholder="Search by name, admission no, roll..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className={`${inputCls} pl-9`}
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
              Class Section
            </label>
            <select
              value={selectedClass}
              onChange={e => {
                setSelectedClass(e.target.value);
                setPage(1);
              }}
              className={inputCls}
            >
              <option value="all">All Classes</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.class_name} - {c.section_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      );

    if (subTab === "list" && activeTab === "teachers")
      return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative sm:col-span-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
              Search Teachers
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
              <input
                type="text"
                placeholder="Search by name, employee ID, specialization..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className={`${inputCls} pl-9`}
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={e => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className={inputCls}
            >
              <option value="all">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>
      );

    if (subTab === "student_att")
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
              Class
            </label>
            <select
              value={selectedClass}
              onChange={e => {
                setSelectedClass(e.target.value);
                setSelectedStudentId("");
                setPage(1);
              }}
              className={inputCls}
            >
              <option value="all">All Classes</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.class_name} - {c.section_name}
                </option>
              ))}
            </select>
          </div>
          {filterType === "daily" && (
            <>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={e => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  className={inputCls}
                >
                  <option value="all">All Status</option>
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="late">Late</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                  Individual Student
                </label>
                <select
                  value={selectedStudentId}
                  onChange={e => {
                    setSelectedStudentId(e.target.value);
                    setPage(1);
                  }}
                  className={inputCls}
                >
                  <option value="">All Students</option>
                  {studentsList.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.admission_number})
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
          <div>{renderTimePeriodFilters()}</div>
        </div>
      );

    if (subTab === "teacher_att")
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-end">
          {filterType === "daily" && (
            <>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                  Attendance Status
                </label>
                <select
                  value={statusFilter}
                  onChange={e => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  className={inputCls}
                >
                  <option value="all">All Status</option>
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="late">Late</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                  Individual Teacher
                </label>
                <select
                  value={selectedTeacherId}
                  onChange={e => {
                    setSelectedTeacherId(e.target.value);
                    setPage(1);
                  }}
                  className={inputCls}
                >
                  <option value="">All Teachers</option>
                  {teachersList.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.employee_id})
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
          <div>{renderTimePeriodFilters()}</div>
        </div>
      );

    if (subTab === "marks" || subTab === "individual_marks")
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
              Class Section
            </label>
            <select
              value={selectedClass}
              onChange={e => {
                setSelectedClass(e.target.value);
                setSelectedStudentId("");
                setPage(1);
              }}
              className={inputCls}
            >
              <option value="all">All Classes</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.class_name} - {c.section_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
              Exam Type
            </label>
            <select
              value={examType}
              onChange={e => {
                setExamType(e.target.value);
                setPage(1);
              }}
              className={inputCls}
            >
              {EXAM_TYPES.map(e => (
                <option key={e.val} value={e.val}>
                  {e.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
              Student
            </label>
            <select
              value={selectedStudentId}
              onChange={e => {
                setSelectedStudentId(e.target.value);
                setPage(1);
              }}
              className={inputCls}
            >
              <option value="">All Students</option>
              {studentsList.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
              <input
                type="text"
                placeholder="Search subject, student..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className={`${inputCls} pl-9`}
              />
            </div>
          </div>
        </div>
      );

    return null;
  };

  /* ─── DIARY GRID RENDER ─── */
  const renderDiaryGrid = () => {
    if (loading)
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-8 h-8 border-3 border-slate-200 border-t-school-navy rounded-full animate-spin"></div>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
            Loading Attendance Register...
          </p>
        </div>
      );

    if (!diaryData || !diaryData.rows || diaryData.rows.length === 0)
      return <EmptyState message="No attendance diary data found for the selected period." />;

    const isStudent = subTab === "student_att";
    const isYearly = diaryData.type === "yearly";
    const monthName = diaryData.month ? MONTH_NAMES[diaryData.month - 1] : "";

    return (
      <div>
        {/* Diary header */}
        <div className="flex items-center gap-3 mb-4 px-1">
          <Table2 className="h-5 w-5 text-school-navy" strokeWidth={2.3} />
          <div>
            <h3 className="text-sm font-extrabold text-school-navy uppercase tracking-wider">
              {isYearly ? "Yearly" : "Monthly"} Attendance Register
            </h3>
            <p className="text-[11px] text-slate-400 font-medium">
              {isYearly
                ? `Year ${diaryData.year}`
                : `${monthName} ${diaryData.year}`}
              {isStudent && selectedClass !== "all" && classes.length > 0 && (
                <> &bull; {classes.find(c => String(c.id) === selectedClass)?.class_name || ""} - {classes.find(c => String(c.id) === selectedClass)?.section_name || ""}</>
              )}
              &nbsp;&bull;&nbsp;{isStudent ? `${diaryData.rows.length} Students` : `${diaryData.rows.length} Teachers`}
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-4 px-1">
          {[
            { code: "P", label: "Present", cls: "bg-emerald-100 text-emerald-800" },
            { code: "A", label: "Absent", cls: "bg-red-100 text-red-800" },
            { code: "L", label: "Late", cls: "bg-amber-100 text-amber-800" },
            { code: "H", label: "Holiday", cls: "bg-blue-100 text-blue-700" },
            { code: "S", label: "Sunday", cls: "bg-purple-100 text-purple-700" },
            { code: "-", label: "No Record", cls: "bg-slate-50 text-slate-400" },
          ].map(item => (
            <div key={item.code} className="flex items-center gap-1.5">
              <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-bold ${item.cls}`}>
                {item.code}
              </span>
              <span className="text-[10px] text-slate-500 font-medium">{item.label}</span>
            </div>
          ))}
        </div>

        {/* Grid table */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-xs border-collapse" style={{ minWidth: isYearly ? "900px" : "1200px" }}>
            <thead>
              <tr className="bg-slate-700 text-white">
                <th className="sticky left-0 z-20 bg-slate-700 px-3 py-2.5 text-left font-bold text-[10px] uppercase tracking-wider border-r border-slate-600 min-w-[50px]">
                  #
                </th>
                <th className="sticky left-[50px] z-20 bg-slate-700 px-3 py-2.5 text-left font-bold text-[10px] uppercase tracking-wider border-r border-slate-600 min-w-[160px]">
                  Name
                </th>
                {isStudent && (
                  <th className="sticky left-[210px] z-20 bg-slate-700 px-2 py-2.5 text-left font-bold text-[10px] uppercase tracking-wider border-r border-slate-600 min-w-[60px]">
                    Roll
                  </th>
                )}
                {!isStudent && (
                  <th className="sticky left-[210px] z-20 bg-slate-700 px-2 py-2.5 text-left font-bold text-[10px] uppercase tracking-wider border-r border-slate-600 min-w-[80px]">
                    Emp ID
                  </th>
                )}
                {diaryData.columns.map((col, ci) => (
                  <th
                    key={ci}
                    className="px-1 py-2.5 text-center font-bold text-[10px] uppercase tracking-wider border-r border-slate-600"
                    style={{ minWidth: isYearly ? "65px" : "30px" }}
                  >
                    {col}
                  </th>
                ))}
                <th className="px-2 py-2.5 text-center font-bold text-[10px] uppercase tracking-wider bg-emerald-800 border-r border-slate-600 min-w-[35px]">
                  P
                </th>
                <th className="px-2 py-2.5 text-center font-bold text-[10px] uppercase tracking-wider bg-red-800 border-r border-slate-600 min-w-[35px]">
                  A
                </th>
                <th className="px-2 py-2.5 text-center font-bold text-[10px] uppercase tracking-wider bg-amber-700 min-w-[35px]">
                  L
                </th>
              </tr>
            </thead>
            <tbody>
              {diaryData.rows.map((row, ri) => (
                <tr
                  key={row.id}
                  className={`${ri % 2 === 0 ? "bg-white" : "bg-slate-50/70"} hover:bg-blue-50/30 transition-colors border-b border-slate-100`}
                >
                  <td className="sticky left-0 z-10 px-3 py-2 text-slate-400 font-mono text-[10px] border-r border-slate-100"
                    style={{ backgroundColor: ri % 2 === 0 ? "#fff" : "#f8fafc" }}>
                    {ri + 1}
                  </td>
                  <td className="sticky left-[50px] z-10 px-3 py-2 font-semibold text-school-navy text-[11px] border-r border-slate-100 whitespace-nowrap"
                    style={{ backgroundColor: ri % 2 === 0 ? "#fff" : "#f8fafc" }}>
                    {row.name}
                  </td>
                  {isStudent && (
                    <td className="sticky left-[210px] z-10 px-2 py-2 text-slate-500 text-[10px] border-r border-slate-100"
                      style={{ backgroundColor: ri % 2 === 0 ? "#fff" : "#f8fafc" }}>
                      {row.roll_number}
                    </td>
                  )}
                  {!isStudent && (
                    <td className="sticky left-[210px] z-10 px-2 py-2 text-slate-500 text-[10px] border-r border-slate-100"
                      style={{ backgroundColor: ri % 2 === 0 ? "#fff" : "#f8fafc" }}>
                      {row.employee_id}
                    </td>
                  )}
                  {row.cells.map((cell, ci) => {
                    if (isYearly && typeof cell === "object" && cell !== null) {
                      return (
                        <td key={ci} className="px-1 py-1.5 text-center border-r border-slate-100">
                          <div className="flex flex-col gap-0.5 leading-tight">
                            {cell.total > 0 ? (
                              <>
                                <span className="text-[9px] font-bold text-emerald-700">P:{cell.P}</span>
                                <span className="text-[9px] font-bold text-red-600">A:{cell.A}</span>
                                {cell.L > 0 && <span className="text-[9px] font-bold text-amber-600">L:{cell.L}</span>}
                              </>
                            ) : (
                              <span className="text-[9px] text-slate-300">—</span>
                            )}
                          </div>
                        </td>
                      );
                    }
                    return (
                      <td
                        key={ci}
                        className={`px-1 py-2 text-center text-[10px] border-r border-slate-100 ${cellStyle(cell)}`}
                      >
                        {cell || ""}
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 text-center text-[10px] font-bold text-emerald-700 bg-emerald-50/50 border-r border-slate-100">
                    {row.present}
                  </td>
                  <td className="px-2 py-2 text-center text-[10px] font-bold text-red-700 bg-red-50/50 border-r border-slate-100">
                    {row.absent}
                  </td>
                  <td className="px-2 py-2 text-center text-[10px] font-bold text-amber-700 bg-amber-50/50">
                    {row.late}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  /* ─── FLAT TABLE RENDER ─── */
  const renderTable = () => {
    if (loading && !data.length)
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-8 h-8 border-3 border-slate-200 border-t-school-navy rounded-full animate-spin"></div>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
            Loading Report Data...
          </p>
        </div>
      );

    if (!data.length)
      return (
        <EmptyState message="No records found matching your selected filters." />
      );

    // Student list
    if (subTab === "list" && activeTab === "students")
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {[
                  "Name",
                  "Adm. No",
                  "Roll",
                  "Class",
                  "Gender",
                  "Father",
                  "Contact",
                  "Admission Date",
                ].map(h => (
                  <th
                    key={h}
                    className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-3"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((r, i) => (
                <tr
                  key={i}
                  className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                >
                  <td className="px-3 py-2.5 font-semibold text-school-navy">{r.name}</td>
                  <td className="px-3 py-2.5 text-slate-500">{r.admission_number}</td>
                  <td className="px-3 py-2.5 text-slate-500">{r.roll_number}</td>
                  <td className="px-3 py-2.5 text-slate-500">{r.class_name}</td>
                  <td className="px-3 py-2.5 text-slate-500">{r.gender}</td>
                  <td className="px-3 py-2.5 text-slate-500">{r.father_name}</td>
                  <td className="px-3 py-2.5 text-slate-500">{r.father_contact}</td>
                  <td className="px-3 py-2.5 text-slate-500">{r.date_of_admission}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    // Teacher list
    if (subTab === "list" && activeTab === "teachers")
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {[
                  "Name",
                  "Emp ID",
                  "Specialization",
                  "Phone",
                  "Gender",
                  "Qualification",
                  "Exp",
                  "Joining",
                  "Role",
                  "Status",
                ].map(h => (
                  <th
                    key={h}
                    className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-3"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((r, i) => (
                <tr
                  key={i}
                  className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                >
                  <td className="px-3 py-2.5 font-semibold text-school-navy">{r.name}</td>
                  <td className="px-3 py-2.5 text-slate-500">{r.employee_id}</td>
                  <td className="px-3 py-2.5 text-slate-500">{r.subject_specialization}</td>
                  <td className="px-3 py-2.5 text-slate-500">{r.phone_number}</td>
                  <td className="px-3 py-2.5 text-slate-500">{r.gender}</td>
                  <td className="px-3 py-2.5 text-slate-500">{r.qualification}</td>
                  <td className="px-3 py-2.5 text-slate-500">{r.experience_years ?? ""}</td>
                  <td className="px-3 py-2.5 text-slate-500">{r.joining_date}</td>
                  <td className="px-3 py-2.5 text-slate-500">{r.role}</td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    // Student attendance (daily flat list)
    if (subTab === "student_att")
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {["Student", "Adm. No", "Class", "Date", "Status", "Via"].map(h => (
                  <th
                    key={h}
                    className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-3"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((r, i) => (
                <tr
                  key={i}
                  className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                >
                  <td className="px-3 py-2.5 font-semibold text-school-navy">
                    {r.student_name}
                  </td>
                  <td className="px-3 py-2.5 text-slate-500">{r.admission_number}</td>
                  <td className="px-3 py-2.5 text-slate-500">{r.class_name}</td>
                  <td className="px-3 py-2.5 text-slate-500 font-mono text-xs">{r.date}</td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-3 py-2.5 text-slate-500 capitalize">{r.marked_via}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    // Teacher attendance (daily flat list)
    if (subTab === "teacher_att")
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {["Teacher", "Emp ID", "Date", "Status", "Via"].map(h => (
                  <th
                    key={h}
                    className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-3"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((r, i) => (
                <tr
                  key={i}
                  className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                >
                  <td className="px-3 py-2.5 font-semibold text-school-navy">
                    {r.teacher_name}
                  </td>
                  <td className="px-3 py-2.5 text-slate-500">{r.employee_id}</td>
                  <td className="px-3 py-2.5 text-slate-500 font-mono text-xs">{r.date}</td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-3 py-2.5 text-slate-500 capitalize">{r.marked_via}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    // Marks
    if (subTab === "marks" || subTab === "individual_marks")
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {[
                  "Student",
                  "Roll",
                  "Class",
                  "Subject",
                  "Exam",
                  "Marks",
                  "Max Marks",
                ].map(h => (
                  <th
                    key={h}
                    className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-3"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((r, i) => (
                <tr
                  key={i}
                  className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                >
                  <td className="px-3 py-2.5 font-semibold text-school-navy">
                    {r.student_name}
                  </td>
                  <td className="px-3 py-2.5 text-slate-500">{r.roll_number}</td>
                  <td className="px-3 py-2.5 text-slate-500">{r.class_name}</td>
                  <td className="px-3 py-2.5 text-slate-500">{r.subject}</td>
                  <td className="px-3 py-2.5 text-slate-500 capitalize">
                    {r.exam_type?.replace("_", " ")}
                  </td>
                  <td className="px-3 py-2.5 font-bold text-school-navy">{r.marks}</td>
                  <td className="px-3 py-2.5 text-slate-400">{r.max_marks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    return null;
  };

  /* ══════════════════════════════════════════════════════════════════
     SUB-TAB CONFIG
     ══════════════════════════════════════════════════════════════════ */
  const subTabs = {
    students: [
      { id: "list", label: "Student List", icon: Users },
      { id: "marks", label: "Class Marks", icon: BookOpen },
      { id: "individual_marks", label: "Individual Marks", icon: GraduationCap },
    ],
    teachers: [{ id: "list", label: "Teacher List", icon: Users }],
    attendance: [
      { id: "teacher_att", label: "Teacher Attendance", icon: UsersRound },
      { id: "student_att", label: "Student Attendance", icon: CalendarDays },
    ],
  };

  // Determine if data is available for download
  const hasData = isDiaryMode
    ? diaryData && diaryData.rows && diaryData.rows.length > 0
    : data.length > 0;

  // Summary for display
  const diarySummary = diaryData?.summary;

  /* ══════════════════════════════════════════════════════════════════
     MAIN RETURN
     ══════════════════════════════════════════════════════════════════ */
  return (
    <div className="p-4 md:p-8 space-y-6 animate-in fade-in duration-500 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-school-navy tracking-tight flex items-center gap-3">
            <BarChart3 className="h-7 w-7 text-school-navy" strokeWidth={2.5} /> Reports
          </h1>
          <p className="text-slate-400 font-medium mt-1 text-sm">
            View, filter, analyze, and download school reports.
          </p>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex gap-1.5 p-1 bg-slate-100 rounded-2xl">
        {[
          { id: "attendance", label: "Attendance Reports", Icon: CalendarDays },
          { id: "students", label: "Student Reports", Icon: GraduationCap },
          { id: "teachers", label: "Teacher Reports", Icon: UsersRound },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              activeTab === tab.id
                ? "bg-white text-school-navy shadow-sm font-extrabold"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <tab.Icon className="h-4 w-4" strokeWidth={2.3} />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Sub Tabs */}
      {subTabs[activeTab] && subTabs[activeTab].length > 1 && (
        <div className="flex gap-2 border-b border-slate-100 pb-1">
          {subTabs[activeTab].map(st => (
            <button
              key={st.id}
              onClick={() => setSubTab(st.id)}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold transition-all border-b-2 -mb-[3px] ${
                subTab === st.id
                  ? "border-school-navy text-school-navy font-extrabold"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              <st.icon className="h-3.5 w-3.5" strokeWidth={2.3} />
              {st.label}
            </button>
          ))}
        </div>
      )}

      {/* Content Card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-lg shadow-slate-200/30 overflow-hidden">
        {/* Filters */}
        <div className="p-5 border-b border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Filter className="h-3.5 w-3.5" /> Filter Criteria
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (isDiaryMode) fetchDiary();
                  else fetchPreview(1);
                }}
                disabled={loading}
                className={btnPrimary}
              >
                <RotateCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                {loading ? "Updating..." : "Refresh Report"}
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading || !hasData}
                className={btnOutline}
              >
                <Download className="h-3.5 w-3.5" /> {downloading ? "Exporting..." : "Export CSV"}
              </button>
            </div>
          </div>
          {renderFilterBar()}
        </div>

        {/* Summary cards for attendance */}
        {!isDiaryMode && summary && (subTab === "student_att" || subTab === "teacher_att") && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5 border-b border-slate-100 bg-slate-50/50">
            <SummaryCard
              icon={BarChart3}
              label="Total Records"
              value={summary.total ?? 0}
              color="bg-white border-slate-200 text-slate-700 shadow-sm"
            />
            <SummaryCard
              icon={UserCheck}
              label="Present"
              value={summary.present ?? 0}
              color="bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm"
            />
            <SummaryCard
              icon={UserX}
              label="Absent"
              value={summary.absent ?? 0}
              color="bg-red-50 border-red-200 text-red-700 shadow-sm"
            />
            <SummaryCard
              icon={Clock}
              label="Late"
              value={summary.late ?? 0}
              color="bg-amber-50 border-amber-200 text-amber-700 shadow-sm"
            />
          </div>
        )}

        {/* Diary summary cards */}
        {isDiaryMode && diarySummary && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-5 border-b border-slate-100 bg-slate-50/50">
            <SummaryCard
              icon={Users}
              label={subTab === "student_att" ? "Students" : "Teachers"}
              value={diarySummary.total_students ?? diarySummary.total_teachers ?? 0}
              color="bg-white border-slate-200 text-slate-700 shadow-sm"
            />
            <SummaryCard
              icon={BarChart3}
              label="Total Records"
              value={diarySummary.total_records ?? 0}
              color="bg-blue-50 border-blue-200 text-blue-700 shadow-sm"
            />
            <SummaryCard
              icon={UserCheck}
              label="Present"
              value={diarySummary.present ?? 0}
              color="bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm"
            />
            <SummaryCard
              icon={UserX}
              label="Absent"
              value={diarySummary.absent ?? 0}
              color="bg-red-50 border-red-200 text-red-700 shadow-sm"
            />
            <SummaryCard
              icon={Clock}
              label="Late"
              value={diarySummary.late ?? 0}
              color="bg-amber-50 border-amber-200 text-amber-700 shadow-sm"
            />
          </div>
        )}

        {/* Table / Diary Grid */}
        <div className="p-5">
          {isDiaryMode ? renderDiaryGrid() : renderTable()}
          {!isDiaryMode && <Pagination meta={meta} onPageChange={p => fetchPreview(p)} />}
        </div>
      </div>
    </div>
  );
};

export default Reports;
