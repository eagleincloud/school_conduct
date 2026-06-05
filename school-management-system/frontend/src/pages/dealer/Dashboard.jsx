import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import useAuthStore from "../../store/authStore";

const DealerDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total_schools: 0 });
  const [location, setLocation] = useState("...");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingSchoolId, setEditingSchoolId] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    school_id: "",
    location: "",
    tagline: "",
    about: "",
    established_year: "",
    contact_email: "",
    phone: "",
    address: "",
    google_map_link: "",
    board: "",
    classes_offered: "",
    streams: "",
    total_students_count: "",
    total_teachers_count: "",
    pass_percentage: "",
    logo: null,
    hero_image: null,
    show_facilities: true,
    show_events: true,
    show_testimonials: true,

    admin_name: "",
    admin_username: "",
    admin_email: "",
    admin_password: "",
  });

  const [message, setMessage] = useState("");
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingSchool, setViewingSchool] = useState(null);
  const [viewingAdmins, setViewingAdmins] = useState([]);

  const fetchSchools = async () => {
    try {
      const res = await api.get("dealers/schools/");
      setSchools(res.data);
      setStats({ total_schools: res.data.length });

      // Fetch profile for location
      const profileRes = await api.get("dealers/profile/");
      setLocation(profileRes.data.location);
    } catch (e) {
      console.error("Error fetching dashboard data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchools();
  }, []);

  const handleCreateSchool = async (e) => {
    e.preventDefault();
    setMessage("");

    // Mandatory Field Validation
    const requiredFields = [
      "name",
      "school_id",
      "location",
      "tagline",
      "established_year",
      "about",
      "contact_email",
      "phone",
      "address",
      "google_map_link",
      "board",
      "classes_offered",
      "streams",
      "total_students_count",
      "total_teachers_count",
      "pass_percentage",
      "admin_name",
      "admin_username",
      "admin_email",
      "admin_password",
    ];

    for (const field of requiredFields) {
      if (!formData[field] || formData[field].toString().trim() === "") {
        const fieldName = field
          .split("_")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
        setMessage(`Error: Please fill in the mandatory field: ${fieldName}`);
        return;
      }
    }

    if (!formData.logo) {
      setMessage("Error: Please upload the School Logo.");
      return;
    }
    if (!formData.hero_image) {
      setMessage("Error: Please upload the Hero Image.");
      return;
    }

    const data = new FormData();
    Object.keys(formData).forEach((key) => {
      if (formData[key] !== null && formData[key] !== "") {
        data.append(key, formData[key]);
      }
    });

    try {
      await api.post("dealers/schools/", data, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMessage("School created successfully!");
      setIsFormOpen(false);
      setFormData({
        name: "",
        school_id: "",
        location: "",
        tagline: "",
        about: "",
        established_year: "",
        contact_email: "",
        phone: "",
        address: "",
        google_map_link: "",
        board: "",
        classes_offered: "",
        streams: "",
        total_students_count: "",
        total_teachers_count: "",
        pass_percentage: "",
        logo: null,
        hero_image: null,
        show_facilities: true,
        show_events: true,
        show_testimonials: true,
        admin_name: "",
        admin_username: "",
        admin_email: "",
        admin_password: "",
      });
      fetchSchools();
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      const errorMsg = err.response?.data?.detail || "Error creating school.";
      setMessage(`Error: ${errorMsg}`);
    }
  };

  const handleToggleSuspension = async (id) => {
    try {
      const res = await api.post(`dealers/schools/${id}/toggle_active/`);
      if (res.data.status === "success") {
        fetchSchools();
      }
    } catch (err) {
      console.error("Error toggling school status:", err);
      alert("Failed to update school status.");
    }
  };

  const handleEditClick = (school) => {
    setEditingSchoolId(school.id);
    setIsEditMode(true);
    setFormData({
      name: school.name || "",
      school_id: school.school_id || "",
      location: school.location || "",
      tagline: school.tagline || "",
      about: school.about || "",
      established_year: school.established_year || "",
      contact_email: school.contact_email || "",
      phone: school.phone || "",
      address: school.address || "",
      google_map_link: school.google_map_link || "",
      board: school.board || "",
      classes_offered: school.classes_offered || "",
      streams: school.streams || "",
      total_students_count: school.total_students_count || "",
      total_teachers_count: school.total_teachers_count || "",
      pass_percentage: school.pass_percentage || "",
      logo: null,
      hero_image: null,
      show_facilities: school.show_facilities ?? true,
      show_events: school.show_events ?? true,
      show_testimonials: school.show_testimonials ?? true,
      // Admin fields not editable in simple school profile update
      admin_name: "",
      admin_username: "",
      admin_email: "",
      admin_password: "",
    });
    setIsFormOpen(true);
  };

  const handleUpdateSchool = async (e) => {
    e.preventDefault();
    setMessage("");
    const data = new FormData();
    Object.keys(formData).forEach((key) => {
      if (key.startsWith("admin_") || key === "school_id") return;
      if (formData[key] !== null && formData[key] !== "") {
        data.append(key, formData[key]);
      }
    });

    try {
      await api.patch(`dealers/schools/${editingSchoolId}/`, data, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMessage("School updated successfully!");
      setIsFormOpen(false);
      setIsEditMode(false);
      fetchSchools();
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      const errorMsg = err.response?.data?.detail || "Error updating school.";
      setMessage(`Error: ${errorMsg}`);
    }
  };

  const handleViewDetails = async (school) => {
    setViewingSchool(school);
    setIsViewModalOpen(true);
    try {
      const res = await api.get(`dealers/schools/${school.id}/admins/`);
      setViewingAdmins(res.data);
    } catch (err) {
      console.error("Error fetching school admins:", err);
    }
  };

  if (loading)
    return (
      <div className="p-10 text-slate-500 font-inter">Loading Dashboard...</div>
    );

  return (
    <div className="space-y-8 animate-in fade-in duration-500 font-inter p-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-4">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">
            Dealer{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-school-blue">
              Dashboard
            </span>
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Manage your delegated institutions and territory
          </p>
        </div>
        <button
          onClick={() => setIsFormOpen(true)}
          className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold text-sm hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 flex items-center gap-2"
        >
          <span className="text-lg">+</span> Register New School
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden group">
          <div className="flex items-center gap-5 relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 fle items-center justify-center text-2xl flex">
              🏫
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Active Schools
              </p>
              <p className="text-3xl font-bold text-slate-900">
                {stats.total_schools}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden group">
          <div className="flex items-center gap-5 relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 fle items-center justify-center text-2xl flex">
              📍
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Territory Location
              </p>
              <p className="text-xl font-bold text-slate-900">{location}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden group">
          <div className="flex items-center gap-5 relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 fle items-center justify-center text-2xl flex">
              👤
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Dealer Status
              </p>
              <p className="text-xl font-bold text-emerald-600">
                Verified Partner
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* School List Section */}
      <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
        <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">
            Your Registered Schools
          </h2>
          <div className="text-[10px] font-bold text-slate-400 bg-slate-50 px-4 py-2 rounded-full uppercase tracking-widest">
            Total Delegated Institutions: {schools.length}
          </div>
        </div>

        {schools.length === 0 ? (
          <div className="p-20 text-center">
            <div className="text-4xl mb-4 text-slate-300">🏢</div>
            <h3 className="text-lg font-bold text-slate-900">
              No schools registered yet
            </h3>
            <p className="text-sm text-slate-500 mt-2">
              Start by registering your first institution in your territory.
            </p>
            <button
              onClick={() => setIsFormOpen(true)}
              className="mt-6 text-indigo-600 font-bold hover:underline"
            >
              + Register School
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto no-scrollbar">
            <div className="table-scroll"><table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                  <th className="px-10 py-5">Institution</th>
                  <th className="px-10 py-5">Platform ID</th>
                  <th className="px-10 py-5">Capacity</th>
                  <th className="px-10 py-5">Status</th>
                  <th className="px-10 py-5 text-right">Operations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {schools.map((school) => (
                  <tr
                    key={school.id}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-10 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 font-bold text-lg overflow-hidden border border-slate-200">
                          {school.logo ? (
                            <img
                              src={school.logo}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            school.name?.[0] || "?"
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 leading-none">
                            {school.name}
                          </p>
                          <p className="text-xs text-slate-400 mt-1.5">
                            {school.contact_email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-6">
                      <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                        {school.school_id}
                      </span>
                    </td>
                    <td className="px-10 py-6">
                      <div className="flex items-center gap-6">
                        <div>
                          <p className="text-xs font-bold text-slate-900 leading-none">
                            {school.student_count || 0}
                          </p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                            Students
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900 leading-none">
                            {school.teacher_count || 0}
                          </p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                            Teachers
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-6">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${school.is_active ? "bg-green-500" : "bg-red-500"} animate-pulse`}
                        ></span>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-widest ${school.is_active ? "text-green-600" : "text-red-600"}`}
                        >
                          {school.is_active ? "Online" : "Suspended"}
                        </span>
                      </div>
                    </td>
                    <td className="px-10 py-6 text-right space-x-3">
                      <button
                        onClick={() => handleViewDetails(school)}
                        className="text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-lg border border-blue-100 text-blue-600 hover:bg-blue-50 transition-all"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleEditClick(school)}
                        className="text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-lg border border-indigo-100 text-indigo-600 hover:bg-indigo-50 transition-all"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleSuspension(school.id)}
                        className={`text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-lg border transition-all ${
                          school.is_active
                            ? "text-red-500 border-red-100 hover:bg-red-50"
                            : "text-green-500 border-green-100 hover:bg-green-50"
                        }`}
                      >
                        {school.is_active
                          ? "Suspend Gateway"
                          : "Restore Access"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        )}
      </div>

      {/* View Detail Modal (Synchronized with SuperAdmin Style) */}
      {isViewModalOpen && viewingSchool && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl p-12 relative max-h-[90vh] overflow-y-auto no-scrollbar font-inter">
            <button
              onClick={() => {
                setIsViewModalOpen(false);
                setViewingAdmins([]);
                setViewingSchool(null);
              }}
              className="absolute top-8 right-8 text-slate-400 hover:text-slate-900 text-2xl transition-colors"
            >
              ✕
            </button>

            <div className="flex items-center gap-6 mb-10">
              <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center text-slate-400 font-bold text-3xl overflow-hidden border border-slate-200">
                {viewingSchool.logo ? (
                  <img
                    src={viewingSchool.logo}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  viewingSchool.name?.[0] || "D"
                )}
              </div>
              <div>
                <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
                  {viewingSchool.name}
                </h2>
                {viewingSchool.school_id && (
                  <p className="text-blue-600 font-mono text-sm font-bold mt-1 tracking-wide">
                    ID: {viewingSchool.school_id}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-10">
              {/* Institutional Profile Section */}
              <div className="space-y-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] border-b border-slate-50 pb-2">
                  Institutional Profile
                </p>
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                      Contact Email
                    </p>
                    <p className="text-sm font-semibold text-slate-900">
                      {viewingSchool.contact_email || "Not Provided"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                      Account Status
                    </p>
                    <p
                      className={`text-sm font-bold flex items-center gap-2 ${viewingSchool.is_active ? "text-green-600" : "text-red-600"}`}
                    >
                      <span className="text-lg leading-none">●</span>{" "}
                      {viewingSchool.is_active ? "Active" : "Suspended"}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                    About Institution
                  </p>
                  <p className="text-sm text-slate-600 leading-relaxed font-medium">
                    {viewingSchool.about ||
                      "No description provided for this tenant institution."}
                  </p>
                </div>
              </div>

              {/* Administrative Root Access Section */}
              <div className="space-y-4">
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-[0.3em] border-b border-blue-50 pb-2">
                  Administrative Root Access
                </p>
                {viewingAdmins.length > 0 ? (
                  <div className="space-y-6">
                    {viewingAdmins.map((admin, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-50 rounded-2xl p-6 border border-slate-100"
                      >
                        <div className="grid grid-cols-2 gap-6">
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                              Admin Name
                            </p>
                            <p className="text-sm font-bold text-slate-900">
                              {admin.name || admin.username}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                              Username
                            </p>
                            <p className="text-sm font-mono font-bold text-blue-600">
                              {admin.username}
                            </p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                              Registered Email
                            </p>
                            <p className="text-sm font-bold text-slate-900">
                              {admin.email}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      Loading administrative data...
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-12">
              <button
                onClick={() => {
                  setIsViewModalOpen(false);
                  setViewingAdmins([]);
                  setViewingSchool(null);
                }}
                className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl text-sm transition-all active:scale-[0.98] shadow-xl shadow-slate-900/10"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create School Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setIsFormOpen(false)}
          ></div>
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl relative z-10 overflow-y-auto max-h-[90vh] no-scrollbar animate-in zoom-in-95 duration-300">
            <div className="p-8 bg-slate-900 text-white flex justify-between items-start">
              <div>
                <h3 className="text-2xl font-bold">
                  {isEditMode
                    ? "Update Institutional Profile"
                    : "New Institution Registration"}
                </h3>
                <p className="text-slate-400 text-xs mt-1">
                  {isEditMode
                    ? "Modify statistics, configuration and branding."
                    : "Register a school within your assigned territory."}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsFormOpen(false);
                  setIsEditMode(false);
                }}
                className="text-white/50 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={isEditMode ? handleUpdateSchool : handleCreateSchool}
              className="p-10 space-y-10"
            >
              {!isEditMode && (
                <div className="space-y-6">
                  <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-[0.3em] border-b border-indigo-50 pb-2">
                    Institutional Profile
                  </p>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                        School Name
                      </label>
                      <input
                        type="text"
                        placeholder="Enter full school name"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-indigo-500/10 outline-none focus:bg-white focus:border-indigo-500/20 transition-all font-medium"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                        Unique School ID
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. DPS_WEST"
                        readOnly={isEditMode}
                        value={formData.school_id}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            school_id: e.target.value.toUpperCase(),
                          })
                        }
                        className={`w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-indigo-500/10 outline-none focus:bg-white focus:border-indigo-500/20 transition-all font-medium ${isEditMode ? "opacity-50" : ""}`}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                        Tagline
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Where Innovation Meets Education"
                        value={formData.tagline}
                        onChange={(e) =>
                          setFormData({ ...formData, tagline: e.target.value })
                        }
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3.5 text-sm outline-none focus:bg-white transition-all font-medium"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                        Est. Year
                      </label>
                      <input
                        type="number"
                        required
                        placeholder="e.g. 1995"
                        value={formData.established_year}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            established_year: e.target.value,
                          })
                        }
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3.5 text-sm outline-none focus:bg-white transition-all font-medium"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                      About Institution
                    </label>
                    <textarea
                      required
                      placeholder="Full description of the school..."
                      value={formData.about}
                      onChange={(e) =>
                        setFormData({ ...formData, about: e.target.value })
                      }
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-indigo-500/10 outline-none focus:bg-white focus:border-indigo-500/20 transition-all font-medium min-h-[100px] resize-none"
                    />
                  </div>
                </div>
              )}

              {!isEditMode && (
                <div className="space-y-6">
                  <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-[0.3em] border-b border-indigo-50 pb-2">
                    Communication & Location
                  </p>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                        Assign Location
                      </label>
                      <input
                        type="text"
                        placeholder={location || "Your location"}
                        value={formData.location}
                        onChange={(e) =>
                          setFormData({ ...formData, location: e.target.value })
                        }
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3.5 text-sm outline-none focus:bg-white transition-all font-medium"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                        Contact Email
                      </label>
                      <input
                        type="email"
                        placeholder="admin@school.com"
                        value={formData.contact_email}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            contact_email: e.target.value,
                          })
                        }
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3.5 text-sm outline-none focus:bg-white transition-all font-medium"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                        Phone Number
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="+91 00000 00000"
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData({ ...formData, phone: e.target.value })
                        }
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3.5 text-sm outline-none focus:bg-white transition-all font-medium"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                        Full Address
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Street, City, ZIP"
                        value={formData.address}
                        onChange={(e) =>
                          setFormData({ ...formData, address: e.target.value })
                        }
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3.5 text-sm outline-none focus:bg-white transition-all font-medium"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                      Google Maps ID/Link
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="https://maps.google.com/..."
                      value={formData.google_map_link}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          google_map_link: e.target.value,
                        })
                      }
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3.5 text-sm outline-none focus:bg-white transition-all font-medium"
                    />
                  </div>
                </div>
              )}

              {!isEditMode && (
                <div className="space-y-6">
                  <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-[0.3em] border-b border-indigo-50 pb-2">
                    Academic & Stats
                  </p>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                        Board
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. CBSE"
                        value={formData.board}
                        onChange={(e) =>
                          setFormData({ ...formData, board: e.target.value })
                        }
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3.5 text-sm outline-none focus:bg-white transition-all font-medium"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                        Classes
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Nursery - 12"
                        value={formData.classes_offered}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            classes_offered: e.target.value,
                          })
                        }
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3.5 text-sm outline-none focus:bg-white transition-all font-medium"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                        Streams
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Science, Commerce"
                        value={formData.streams}
                        onChange={(e) =>
                          setFormData({ ...formData, streams: e.target.value })
                        }
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3.5 text-sm outline-none focus:bg-white transition-all font-medium"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                        Students
                      </label>
                      <input
                        type="number"
                        required
                        placeholder="1200"
                        value={formData.total_students_count}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            total_students_count: e.target.value,
                          })
                        }
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3.5 text-sm outline-none focus:bg-white transition-all font-medium"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                        Teachers
                      </label>
                      <input
                        type="number"
                        required
                        placeholder="85"
                        value={formData.total_teachers_count}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            total_teachers_count: e.target.value,
                          })
                        }
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3.5 text-sm outline-none focus:bg-white transition-all font-medium"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                        Pass %
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="98%"
                        value={formData.pass_percentage}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            pass_percentage: e.target.value,
                          })
                        }
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3.5 text-sm outline-none focus:bg-white transition-all font-medium"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-6">
                <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-[0.3em] border-b border-indigo-50 pb-2">
                  Media & Branding
                </p>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                      School Logo
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      required={!isEditMode}
                      onChange={(e) =>
                        setFormData({ ...formData, logo: e.target.files[0] })
                      }
                      className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                      Hero Image
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      required={!isEditMode}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          hero_image: e.target.files[0],
                        })
                      }
                      className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-[0.3em] border-b border-indigo-50 pb-2">
                  Page Configuration
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    {
                      key: "show_facilities",
                      label: "Show Facilities Section",
                    },
                    { key: "show_events", label: "Show Events Section" },
                    { key: "show_testimonials", label: "Show Testimonials" },
                  ].map((toggle) => (
                    <label
                      key={toggle.key}
                      className="flex items-center gap-3 cursor-pointer group"
                    >
                      <input
                        type="checkbox"
                        checked={formData[toggle.key]}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            [toggle.key]: e.target.checked,
                          })
                        }
                        className="w-5 h-5 rounded-lg border-slate-200 text-indigo-600 focus:ring-indigo-500 transition-all"
                      />
                      <span className="text-xs font-semibold text-slate-600 group-hover:text-slate-900 transition-colors">
                        {toggle.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {!isEditMode && (
                <div className="pt-4 border-t border-slate-100 mt-6">
                  <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-6">
                    Administrative Root Account
                  </h4>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                        Legal Name
                      </label>
                      <input
                        type="text"
                        placeholder="John Doe"
                        value={formData.admin_name}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            admin_name: e.target.value,
                          })
                        }
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-indigo-500/10 outline-none focus:bg-white focus:border-indigo-500/20 transition-all font-medium"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                        Platform Username
                      </label>
                      <input
                        type="text"
                        placeholder="admin_username"
                        value={formData.admin_username}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            admin_username: e.target.value,
                          })
                        }
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-indigo-500/10 outline-none focus:bg-white focus:border-indigo-500/20 transition-all font-medium"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                        Admin Email
                      </label>
                      <input
                        type="email"
                        placeholder="john.doe@email.com"
                        value={formData.admin_email}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            admin_email: e.target.value,
                          })
                        }
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-indigo-500/10 outline-none focus:bg-white focus:border-indigo-500/20 transition-all font-medium"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                        Admin Password
                      </label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={formData.admin_password}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            admin_password: e.target.value,
                          })
                        }
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-indigo-500/10 outline-none focus:bg-white focus:border-indigo-500/20 transition-all font-medium"
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-6 border-t border-slate-50 flex items-center justify-between">
                {message && (
                  <span
                    className={`text-xs font-bold ${message.includes("Error") ? "text-red-500" : "text-emerald-500"}`}
                  >
                    {message}
                  </span>
                )}
                <div className="flex gap-4 ml-auto">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-8 py-3.5 rounded-2xl text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-10 py-3.5 bg-slate-900 text-white rounded-2xl text-sm font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20 active:scale-95"
                  >
                    {isEditMode ? "Save Changes" : "Register School"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DealerDashboard;
