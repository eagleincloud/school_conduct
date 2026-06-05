import React, { useState, useEffect } from "react";
import api from "../../services/api";
import { useNavigate } from "react-router-dom";

/**
 * SuperAdmin Dashboard
 * Allows platform administrators to manage all school tenants.
 */
export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const [schools, setSchools] = useState([]);
  const [dealers, setDealers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState("institutions"); // 'institutions' | 'dealers'

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingSchoolId, setEditingSchoolId] = useState(null);
  const [isDealerModalOpen, setIsDealerModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingSchool, setViewingSchool] = useState(null);
  const [viewingAdmins, setViewingAdmins] = useState([]);

  // New School Form State
  const [formData, setFormData] = useState({
    name: "",
    school_id: "",
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
    admin_email: "",
    admin_username: "",
    admin_password: "",
  });

  // New Dealer Form State
  const [dealerFormData, setDealerFormData] = useState({
    name: "",
    contact: "",
    location: "",
    admin_username: "",
    admin_email: "",
    admin_password: "",
  });

  const fetchSchools = async () => {
    try {
      const response = await api.get("/schools/admin-schools/");
      setSchools(response.data);
    } catch (err) {
      setError("Failed to fetch platform schools.");
    }
  };

  const fetchDealers = async () => {
    try {
      const response = await api.get("/dealers/management/");
      setDealers(response.data);
    } catch (err) {
      console.error("Failed to fetch dealers");
    }
  };

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchSchools(), fetchDealers()]);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateSchool = async (e) => {
    e.preventDefault();

    // Mandatory Field Validation
    const requiredFields = [
      "name",
      "school_id",
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
      "admin_email",
      "admin_username",
      "admin_password",
    ];

    for (const field of requiredFields) {
      if (!formData[field] || formData[field].toString().trim() === "") {
        const fieldName = field
          .split("_")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
        alert(`Please fill in the mandatory field: ${fieldName}`);
        return;
      }
    }

    if (!formData.logo) {
      alert("Please upload the School Logo.");
      return;
    }
    if (!formData.hero_image) {
      alert("Please upload the Hero Image.");
      return;
    }

    const data = new FormData();
    Object.keys(formData).forEach((key) => {
      if (formData[key] !== null && formData[key] !== "") {
        data.append(key, formData[key]);
      }
    });

    try {
      await api.post("/schools/admin-schools/", data, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setIsModalOpen(false);
      fetchSchools();
      setFormData({
        name: "",
        school_id: "",
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
        admin_email: "",
        admin_username: "",
        admin_password: "",
      });
      alert("School registered successfully!");
    } catch (err) {
      alert(
        err.response?.data?.detail ||
          "Error creating school. Please verify unique fields.",
      );
    }
  };

  const handleEditClick = (school) => {
    setIsEditMode(true);
    setEditingSchoolId(school.id);
    setFormData({
      name: school.name || "",
      school_id: school.school_id || "",
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
      // Admin fields are not editable here for safety
      admin_name: "",
      admin_email: "",
      admin_username: "",
      admin_password: "",
    });
    setIsModalOpen(true);
  };

  const handleUpdateSchool = async (e) => {
    e.preventDefault();
    const data = new FormData();
    Object.keys(formData).forEach((key) => {
      // Don't send empty files or admin credentials during update
      if (key.startsWith("admin_") || key === "school_id") return;

      if (formData[key] !== null && formData[key] !== "") {
        data.append(key, formData[key]);
      }
    });

    try {
      await api.patch(`/schools/admin-schools/${editingSchoolId}/`, data, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setIsModalOpen(false);
      setIsEditMode(false);
      fetchSchools();
      alert("School updated successfully!");
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to update school.");
    }
  };

  const handleCreateDealer = async (e) => {
    e.preventDefault();
    try {
      await api.post("/dealers/management/", dealerFormData);
      setIsDealerModalOpen(false);
      fetchDealers();
      setDealerFormData({
        name: "",
        contact: "",
        location: "",
        admin_username: "",
        admin_email: "",
        admin_password: "",
      });
    } catch (err) {
      alert(
        err.response?.data?.detail ||
          "Error creating dealer. Please verify unique fields.",
      );
    }
  };

  const handleViewDetail = async (school) => {
    setViewingSchool(school);
    setIsViewModalOpen(true);
    try {
      const response = await api.get(
        `/schools/admin-schools/${school.id}/admins/`,
      );
      setViewingAdmins(response.data);
    } catch (err) {
      console.error("Failed to fetch school admins");
    }
  };

  const toggleSchoolStatus = async (id, currentStatus) => {
    try {
      await api.patch(`/schools/admin-schools/${id}/`, {
        is_active: !currentStatus,
      });
      fetchSchools();
    } catch (err) {
      alert("Failed to update school status.");
    }
  };

  const toggleDealerStatus = async (id) => {
    try {
      await api.post(`/dealers/management/${id}/toggle_active/`);
      fetchDealers();
    } catch (err) {
      alert("Failed to update dealer status.");
    }
  };

  const [utilState, setUtilState] = useState({
    school_id: "",
    school_name: "",
    user_type: "student",
    busy: false,
  });

  const handleIDCardRedirect = (school) => {
    setUtilState((prev) => ({
      ...prev,
      school_id: school.id,
      school_name: school.name,
    }));
    setViewMode("utilities");
  };

  const handleGenerateIDs = async () => {
    if (!utilState.school_id) {
      alert("Please select a school first.");
      return;
    }
    setUtilState((prev) => ({ ...prev, busy: true }));
    try {
      const resp = await api.post(
        "/schools/bulk-id-cards/",
        {
          school_id: utilState.school_id,
          user_type: utilState.user_type,
        },
        { responseType: "blob" },
      );

      const url = URL.createObjectURL(new Blob([resp.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `bulk_${utilState.user_type}_ids_${utilState.school_id}.pdf`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert(
        "Failed to generate IDs. Ensure the school has students/teachers and your session is active.",
      );
    } finally {
      setUtilState((prev) => ({ ...prev, busy: false }));
    }
  };

  const stats = [
    { label: "Total Institutions", value: schools.length, icon: "🏛️" },
    {
      label: "Active Students",
      value: schools.reduce((acc, s) => acc + (s.student_count || 0), 0),
      icon: "🎓",
    },
    {
      label: "Active Teachers",
      value: schools.reduce((acc, s) => acc + (s.teacher_count || 0), 0),
      icon: "👨‍🏫",
    },
    { label: "Global Uptime", value: "99.9%", icon: "⚡" },
  ];

  if (loading && schools.length === 0)
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-inter text-slate-500">
        Initializing Platform...
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50 font-inter text-slate-800 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              Platform Overview
            </h1>
            <p className="text-slate-500 mt-1 text-sm font-medium">
              Managing multi-tenant infrastructure for Multiple Schools
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 sm:gap-6 w-full md:w-auto">
            {/* Toggle Switch */}
            <div className="bg-slate-100 p-1.5 rounded-2xl flex flex-wrap items-center shadow-inner border border-slate-200">
              <button
                onClick={() => setViewMode("institutions")}
                className={`flex-1 sm:flex-none px-4 sm:px-8 py-2.5 rounded-xl text-xs font-bold transition-all ${viewMode === "institutions" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
              >
                Institutions
              </button>
              <button
                onClick={() => setViewMode("dealers")}
                className={`flex-1 sm:flex-none px-4 sm:px-8 py-2.5 rounded-xl text-xs font-bold transition-all ${viewMode === "dealers" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
              >
                Dealers
              </button>
              <button
                onClick={() => setViewMode("utilities")}
                className={`flex-1 sm:flex-none px-4 sm:px-8 py-2.5 rounded-xl text-xs font-bold transition-all ${viewMode === "utilities" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
              >
                Utilities
              </button>
            </div>

            {viewMode === "institutions" ? (
              <button
                onClick={() => setIsModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-2xl text-sm font-bold shadow-2xl shadow-blue-600/20 transition-all active:scale-[0.98]"
              >
                + Create Institution
              </button>
            ) : viewMode === "dealers" ? (
              <button
                onClick={() => setIsDealerModalOpen(true)}
                className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-3.5 rounded-2xl text-sm font-bold shadow-2xl shadow-slate-900/20 transition-all active:scale-[0.98]"
              >
                + Create New Dealer
              </button>
            ) : null}
          </div>
        </div>

        {/* Stats Grid */}
        {viewMode !== "utilities" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
            {stats.map((s, i) => (
              <div
                key={i}
                className="bg-white border border-slate-200 p-8 rounded-[2rem] shadow-sm"
              >
                <div className="text-3xl mb-4">{s.icon}</div>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">
                  {s.label}
                </p>
                <p className="text-3xl font-bold text-slate-900 font-outfit leading-tight">
                  {s.value}
                </p>
              </div>
            ))}
          </div>
        )}

        {viewMode !== "utilities" && (
          <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
            <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">
                {viewMode === "institutions"
                  ? "Direct Institutions"
                  : "Authorized Dealers"}
              </h2>
              <div className="text-[10px] font-bold text-slate-400 bg-slate-50 px-4 py-2 rounded-full uppercase tracking-widest">
                {viewMode === "institutions"
                  ? "Superadmin Managed"
                  : "Network Partners"}
              </div>
            </div>

            <div className="overflow-x-auto">
              {viewMode === "institutions" ? (
                <div className="table-scroll"><table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                      <th className="px-10 py-5">Institution</th>
                      <th className="px-10 py-5">Platform ID</th>
                      <th className="px-10 py-5">Capacity</th>
                      <th className="px-10 py-5">Status</th>
                      <th className="px-6 py-5 text-right">Operations</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {schools
                      .filter((s) => s.dealer === null)
                      .map((school) => (
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
                                  school.name[0]
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
                          <td className="px-6 py-6 text-right whitespace-nowrap space-x-2">
                            <button
                              onClick={() => handleViewDetail(school)}
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
                              onClick={() => handleIDCardRedirect(school)}
                              className="text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-lg border border-amber-100 text-amber-600 hover:bg-amber-50 transition-all"
                            >
                              ID Card
                            </button>
                            <button
                              onClick={() =>
                                toggleSchoolStatus(school.id, school.is_active)
                              }
                              className={`text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-lg border transition-all
                              ${
                                school.is_active
                                  ? "text-red-500 border-red-100 hover:bg-red-50"
                                  : "text-green-500 border-green-100 hover:bg-green-50"
                              }`}
                            >
                              {school.is_active ? "Suspend" : "Restore Access"}
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table></div>
              ) : (
                <div className="table-scroll"><table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                      <th className="px-10 py-5">Dealer Profile</th>
                      <th className="px-10 py-5">Location</th>
                      <th className="px-10 py-5">Managed Schools</th>
                      <th className="px-10 py-5">Login Access</th>
                      <th className="px-10 py-5 text-right">Operations</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dealers.map((dealer) => (
                      <tr
                        key={dealer.id}
                        className="hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="px-10 py-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center text-white font-bold text-lg border border-slate-800">
                              {dealer.name[0]}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900 leading-none">
                                {dealer.name}
                              </p>
                              <p className="text-xs text-slate-400 mt-1.5">
                                {dealer.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-10 py-6">
                          <span className="text-xs font-bold text-slate-600">
                            {dealer.location}
                          </span>
                        </td>
                        <td className="px-10 py-6">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900">
                              {dealer.school_count}
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase">
                              Units
                            </span>
                          </div>
                        </td>
                        <td className="px-10 py-6">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full ${dealer.is_active ? "bg-indigo-500" : "bg-red-500"} animate-pulse`}
                            ></span>
                            <span
                              className={`text-[10px] font-bold uppercase tracking-widest ${dealer.is_active ? "text-indigo-600" : "text-red-600"}`}
                            >
                              {dealer.is_active ? "Authorized" : "Suspended"}
                            </span>
                          </div>
                        </td>
                        <td className="px-10 py-6 text-right space-x-3">
                          <button
                            onClick={() => {
                              setViewingSchool({
                                name: dealer.name,
                                schools: dealer.schools,
                                isDealer: true,
                                email: dealer.email,
                                location: dealer.location,
                                is_active: dealer.is_active,
                              });
                              setIsViewModalOpen(true);
                            }}
                            className="text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all"
                          >
                            View Detail
                          </button>
                          <button
                            onClick={() => toggleDealerStatus(dealer.id)}
                            className={`text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-lg border transition-all
                              ${
                                dealer.is_active
                                  ? "text-red-500 border-red-100 hover:bg-red-50"
                                  : "text-indigo-500 border-indigo-100 hover:bg-indigo-50"
                              }`}
                          >
                            {dealer.is_active
                              ? "Suspend Dealer"
                              : "Re-Authorize"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              )}
            </div>
          </div>
        )}

        {/* Create School Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl p-12 relative max-h-[90vh] overflow-y-auto no-scrollbar">
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-8 right-8 text-slate-400 hover:text-slate-900 text-2xl transition-colors"
              >
                ✕
              </button>

              <h2 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">
                {isEditMode
                  ? "Update Institutional Profile"
                  : "Register New School"}
              </h2>
              <p className="text-slate-500 mb-10 text-sm font-medium">
                {isEditMode
                  ? "Modify branding, stats and configuration."
                  : "Create a new isolated tenant environment."}
              </p>

              <form
                onSubmit={isEditMode ? handleUpdateSchool : handleCreateSchool}
                className="space-y-10"
              >
                {!isEditMode && (
                  <div className="space-y-6">
                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-[0.3em] border-b border-blue-50 pb-2">
                      Institutional Profile
                    </p>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                          School Name
                        </label>
                        <input
                          type="text"
                          required
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white transition-all font-medium"
                          placeholder="e.g. Atheris Lab School"
                          value={formData.name}
                          onChange={(e) =>
                            setFormData({ ...formData, name: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                          Tenant ID
                        </label>
                        <input
                          type="text"
                          required
                          readOnly={isEditMode}
                          className={`w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white transition-all font-medium font-mono text-blue-600 ${isEditMode ? "opacity-50" : ""}`}
                          placeholder="e.g. ATHERIS"
                          value={formData.school_id}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              school_id: e.target.value.toUpperCase(),
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                          Tagline
                        </label>
                        <input
                          type="text"
                          required
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white transition-all font-medium"
                          placeholder="Where Innovation Meets Education"
                          value={formData.tagline}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              tagline: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                          Est. Year
                        </label>
                        <input
                          type="number"
                          required
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white transition-all font-medium"
                          placeholder="e.g. 1995"
                          value={formData.established_year}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              established_year: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                        About School (Long Description)
                      </label>
                      <textarea
                        required
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white transition-all font-medium h-24 resize-none"
                        placeholder="Brief description of the institution..."
                        value={formData.about}
                        onChange={(e) =>
                          setFormData({ ...formData, about: e.target.value })
                        }
                      ></textarea>
                    </div>
                  </div>
                )}

                {!isEditMode && (
                  <div className="space-y-6">
                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-[0.3em] border-b border-blue-50 pb-2">
                      Communication Details
                    </p>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                          Contact Email
                        </label>
                        <input
                          type="email"
                          required
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white transition-all font-medium"
                          placeholder="admin@school.com"
                          value={formData.contact_email}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              contact_email: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                          Phone Number
                        </label>
                        <input
                          type="text"
                          required
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white transition-all font-medium"
                          placeholder="+91 00000 00000"
                          value={formData.phone}
                          onChange={(e) =>
                            setFormData({ ...formData, phone: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                        Full Physical Address
                      </label>
                      <input
                        type="text"
                        required
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white transition-all font-medium"
                        placeholder="Street, City, State, ZIP"
                        value={formData.address}
                        onChange={(e) =>
                          setFormData({ ...formData, address: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                        Google Maps Embed Link
                      </label>
                      <input
                        type="text"
                        required
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white transition-all font-medium"
                        placeholder="https://maps.google.com/..."
                        value={formData.google_map_link}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            google_map_link: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                )}

                {!isEditMode && (
                  <div className="space-y-6">
                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-[0.3em] border-b border-blue-50 pb-2">
                      Academic Standards & Performance
                    </p>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                          Board
                        </label>
                        <input
                          type="text"
                          required
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white transition-all font-medium"
                          placeholder="CBSE / ICSE"
                          value={formData.board}
                          onChange={(e) =>
                            setFormData({ ...formData, board: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                          Classes
                        </label>
                        <input
                          type="text"
                          required
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white transition-all font-medium"
                          placeholder="Nursery - 12"
                          value={formData.classes_offered}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              classes_offered: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                          Streams
                        </label>
                        <input
                          type="text"
                          required
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white transition-all font-medium"
                          placeholder="Science, Arts..."
                          value={formData.streams}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              streams: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                          Students
                        </label>
                        <input
                          type="number"
                          required
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white transition-all font-medium"
                          placeholder="1200"
                          value={formData.total_students_count}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              total_students_count: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                          Teachers
                        </label>
                        <input
                          type="number"
                          required
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white transition-all font-medium"
                          placeholder="85"
                          value={formData.total_teachers_count}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              total_teachers_count: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                          Pass %
                        </label>
                        <input
                          type="text"
                          required
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white transition-all font-medium"
                          placeholder="98%"
                          value={formData.pass_percentage}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              pass_percentage: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-6">
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-[0.3em] border-b border-blue-50 pb-2">
                    Rich Media & Branding
                  </p>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                        School Logo
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        required={!isEditMode}
                        className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-all"
                        onChange={(e) =>
                          setFormData({ ...formData, logo: e.target.files[0] })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                        Hero Image
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        required={!isEditMode}
                        className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-all"
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            hero_image: e.target.files[0],
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-[0.3em] border-b border-blue-50 pb-2">
                    Landing Page Configuration
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
                          className="w-5 h-5 rounded-lg border-slate-200 text-blue-600 focus:ring-blue-500 transition-all"
                        />
                        <span className="text-xs font-semibold text-slate-600 group-hover:text-slate-900 transition-colors">
                          {toggle.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {!isEditMode && (
                  <div className="space-y-6">
                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-[0.3em] border-b border-blue-50 pb-2">
                      Administrative Root Account
                    </p>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                          Admin Full Name
                        </label>
                        <input
                          type="text"
                          required
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white transition-all font-medium"
                          placeholder="John Doe"
                          value={formData.admin_name}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              admin_name: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                          Admin Email
                        </label>
                        <input
                          type="email"
                          required
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white transition-all font-medium"
                          placeholder="john@example.com"
                          value={formData.admin_email}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              admin_email: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                          Username
                        </label>
                        <input
                          type="text"
                          required
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white transition-all font-medium"
                          placeholder="admin_root"
                          value={formData.admin_username}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              admin_username: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                          Initial Password
                        </label>
                        <input
                          type="password"
                          required
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white transition-all font-medium"
                          placeholder="••••••••••••"
                          value={formData.admin_password}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              admin_password: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-4 flex gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setIsEditMode(false);
                    }}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-5 rounded-2xl transition-all active:scale-[0.98] text-sm tracking-wide"
                  >
                    Cancel Edit
                  </button>
                  <button
                    type="submit"
                    className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white font-bold py-5 rounded-2xl shadow-2xl shadow-blue-600/20 transition-all active:scale-[0.98] text-sm tracking-wide"
                  >
                    {isEditMode
                      ? "Commit Changes"
                      : "Initialize Tenant Infrastructure"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create Dealer Modal */}
        {isDealerModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl p-12 relative max-h-[90vh] overflow-y-auto no-scrollbar">
              <button
                onClick={() => setIsDealerModalOpen(false)}
                className="absolute top-8 right-8 text-slate-400 hover:text-slate-900 text-2xl transition-colors"
              >
                ✕
              </button>

              <h2 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">
                Onboard New Dealer
              </h2>
              <p className="text-slate-500 mb-10 text-sm font-medium">
                Create an independent dealer account for platform expansion.
              </p>

              <form onSubmit={handleCreateDealer} className="space-y-10">
                <div className="space-y-6">
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-[0.3em] border-b border-blue-50 pb-2">
                    Dealer Profile
                  </p>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                        Dealer Name
                      </label>
                      <input
                        type="text"
                        required
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white transition-all font-medium"
                        placeholder="e.g. North Zone Distributions"
                        value={dealerFormData.name}
                        onChange={(e) =>
                          setDealerFormData({
                            ...dealerFormData,
                            name: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                        Contact Number
                      </label>
                      <input
                        type="text"
                        required
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white transition-all font-medium"
                        placeholder="+91 00000 00000"
                        value={dealerFormData.contact}
                        onChange={(e) =>
                          setDealerFormData({
                            ...dealerFormData,
                            contact: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                      Location / Territory
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white transition-all font-medium"
                      placeholder="e.g. Jaipur, Rajasthan"
                      value={dealerFormData.location}
                      onChange={(e) =>
                        setDealerFormData({
                          ...dealerFormData,
                          location: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-6">
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-[0.3em] border-b border-blue-50 pb-2">
                    Dealer Login Account
                  </p>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                        Username
                      </label>
                      <input
                        type="text"
                        required
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white transition-all font-medium"
                        placeholder="dealer_north"
                        value={dealerFormData.admin_username}
                        onChange={(e) =>
                          setDealerFormData({
                            ...dealerFormData,
                            admin_username: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        required
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white transition-all font-medium"
                        placeholder="dealer@example.com"
                        value={dealerFormData.admin_email}
                        onChange={(e) =>
                          setDealerFormData({
                            ...dealerFormData,
                            admin_email: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                      Password
                    </label>
                    <input
                      type="password"
                      required
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white transition-all font-medium"
                      placeholder="••••••••••••"
                      value={dealerFormData.admin_password}
                      onChange={(e) =>
                        setDealerFormData({
                          ...dealerFormData,
                          admin_password: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-5 rounded-2xl shadow-2xl shadow-slate-900/20 transition-all active:scale-[0.98] text-sm tracking-wide"
                  >
                    Confirm Registration
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* View Detail Modal (Unified for Institutions and Dealer Managed Schools) */}
        {isViewModalOpen && viewingSchool && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
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
                    <p className="text-blue-600 font-mono text-sm font-bold mt-1">
                      ID: {viewingSchool.school_id}
                    </p>
                  )}
                </div>
              </div>

              {viewingSchool.schools ? (
                /* Dealer Schools List View */
                <div className="space-y-8">
                  <div className="grid grid-cols-2 gap-8 mb-6">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                        Dealer Email
                      </p>
                      <p className="text-sm font-semibold text-slate-900">
                        {viewingSchool.email || "Not Provided"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                        Dealer Location
                      </p>
                      <p className="text-sm font-semibold text-slate-900">
                        {viewingSchool.location || "Not Provided"}
                      </p>
                    </div>
                  </div>

                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] border-b border-slate-50 pb-2">
                    Managed Institutions
                  </p>
                  <div className="grid grid-cols-1 gap-4">
                    {viewingSchool.schools &&
                      viewingSchool.schools.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between p-6 bg-slate-50 rounded-2xl border border-slate-100"
                        >
                          <div>
                            <p className="text-sm font-bold text-slate-900">
                              {s.name}
                            </p>
                            <p className="text-xs font-mono text-slate-400 mt-1">
                              {s.school_id}
                            </p>
                          </div>
                          <div className="flex items-center gap-4">
                            <span
                              className={`text-[10px] font-bold uppercase tracking-widest ${s.is_active ? "text-green-600" : "text-red-600"}`}
                            >
                              {s.is_active ? "Online" : "Suspended"}
                            </span>
                            <button
                              onClick={() => handleViewDetail(s)}
                              className="bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm active:scale-95"
                            >
                              View
                            </button>
                          </div>
                        </div>
                      ))}
                    {(!viewingSchool.schools ||
                      viewingSchool.schools.length === 0) && (
                      <p className="text-center py-10 text-slate-400 text-sm italic">
                        No institutions registered under this dealer yet.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                /* Single School Detail View */
                <div className="space-y-10">
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
                          className={`text-sm font-bold ${viewingSchool.is_active ? "text-green-600" : "text-red-600"}`}
                        >
                          {viewingSchool.is_active ? "● Active" : "● Suspended"}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                        About Institution
                      </p>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        {viewingSchool.about ||
                          "No description provided for this tenant."}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] border-b border-slate-50 pb-2">
                      Institutional Capacity
                    </p>
                    <div className="grid grid-cols-2 gap-8">
                      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                            Active Students
                          </p>
                          <p className="text-2xl font-bold text-slate-900 leading-none">
                            {viewingSchool.student_count || 0}
                          </p>
                        </div>
                        <span className="text-2xl opacity-50">🎓</span>
                      </div>
                      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                            Active Teachers
                          </p>
                          <p className="text-2xl font-bold text-slate-900 leading-none">
                            {viewingSchool.teacher_count || 0}
                          </p>
                        </div>
                        <span className="text-2xl opacity-50">👨‍🏫</span>
                      </div>
                    </div>
                  </div>

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
                                  {admin.name}
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
              )}

              <div className="mt-12">
                <button
                  onClick={() => {
                    setIsViewModalOpen(false);
                    setViewingAdmins([]);
                    setViewingSchool(null);
                  }}
                  className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl text-sm transition-all active:scale-[0.98]"
                >
                  Close Profile
                </button>
              </div>
            </div>
          </div>
        )}
        {viewMode === "utilities" && (
          <div className="bg-white border border-slate-200 rounded-[2rem] p-12 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                ID Card Center
              </h2>
              <p className="text-slate-500 mb-10">
                Generate bulk ID cards for any institution in the platform.
                Cards are formatted in a 2x5 grid on A4 pages.
              </p>

              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">
                      Selected Institution
                    </label>
                    <div className="w-full bg-slate-50 rounded-2xl px-6 py-4 border border-slate-100">
                      <p className="text-sm font-bold text-slate-900">
                        {utilState.school_name || "No school selected"}
                      </p>
                      {utilState.school_id && (
                        <p className="text-[10px] text-blue-600 font-mono font-black mt-1 uppercase">
                          Infrastructure Active
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">
                      User Type
                    </label>
                    <div className="bg-slate-50 rounded-2xl p-1.5 flex gap-1 border border-slate-100">
                      {["student", "teacher"].map((type) => (
                        <button
                          key={type}
                          onClick={() =>
                            setUtilState((prev) => ({
                              ...prev,
                              user_type: type,
                            }))
                          }
                          className={`flex-1 py-3 rounded-xl text-xs font-bold capitalize transition-all ${utilState.user_type === type ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                        >
                          {type}s
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100">
                  <button
                    onClick={handleGenerateIDs}
                    disabled={utilState.busy}
                    className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white px-12 py-4 rounded-2xl text-sm font-black shadow-xl shadow-blue-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                  >
                    {utilState.busy ? (
                      <>
                        <svg
                          className="animate-spin h-5 w-5 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Generating PDF...
                      </>
                    ) : (
                      <>
                        <span className="text-xl">🖨️</span>
                        Generate & Download ID Cards
                      </>
                    )}
                  </button>
                  <p className="text-[10px] text-slate-400 mt-4 font-bold uppercase tracking-widest">
                    Note: PDF will be generated instantly and downloaded to your
                    device.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
