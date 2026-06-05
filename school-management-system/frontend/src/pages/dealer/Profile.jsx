import React, { useState, useEffect } from "react";
import api from "../../services/api";

const DealerProfile = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [status, setStatus] = useState({ type: "", text: "" });
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    contact: "",
    location: "",
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await api.get("dealers/profile/");
        setProfile(response.data);
        setFormData({
          name: response.data.name,
          email: response.data.email,
          contact: response.data.contact,
          location: response.data.location,
        });
      } catch (err) {
        console.error("Profile fetch error:", err);
        setStatus({ type: "error", text: "Failed to load profile details" });
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const getInitials = (name) => {
    return (name || "D")
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setStatus({ type: "", text: "" });
    try {
      const response = await api.patch("dealers/profile/me/", formData);
      setProfile(response.data);
      setEditMode(false);
      setStatus({ type: "success", text: "Credentials updated successfully" });
      // Clear status after 5s
      setTimeout(() => setStatus({ type: "", text: "" }), 5000);
    } catch (err) {
      const errorMsg =
        err.response?.data?.email ||
        err.response?.data?.contact ||
        "Update failed";
      setStatus({
        type: "error",
        text: typeof errorMsg === "string" ? errorMsg : "Check your input",
      });
    }
  };

  if (loading)
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );

  return (
    <div className="max-w-4xl mx-auto py-12 px-6 animate-in fade-in duration-700 font-inter">
      <div className="mb-12 flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">
            Channel Partner Profile
          </h1>
          <p className="text-slate-500 mt-2 text-lg font-medium">
            Manage your dealer credentials and institution oversight.
          </p>
        </div>
        {editMode && (
          <button
            onClick={() => setEditMode(false)}
            className="text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors mb-2"
          >
            Cancel Editing
          </button>
        )}
      </div>

      {status.text && (
        <div
          className={`mb-8 p-4 rounded-2xl border animate-in slide-in-from-top-4 duration-300 flex items-center gap-3 ${
            status.type === "success"
              ? "bg-emerald-50 border-emerald-100 text-emerald-600"
              : "bg-red-50 border-red-100 text-red-600"
          }`}
        >
          <span className="text-xl">
            {status.type === "success" ? "✅" : "❌"}
          </span>
          <p className="text-sm font-bold tracking-tight">{status.text}</p>
        </div>
      )}

      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-2xl shadow-slate-200/60 p-12 relative overflow-hidden">
        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/5 rounded-full -mr-48 -mt-48 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-indigo-600/5 rounded-full -ml-36 -mb-36 blur-3xl"></div>

        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-12">
          <div className="flex-shrink-0">
            <div className="w-40 h-40 rounded-[2.5rem] bg-indigo-600 flex items-center justify-center text-white text-5xl font-black shadow-2xl shadow-indigo-600/20 transform hover:scale-105 transition-transform duration-500">
              {getInitials(profile?.name)}
            </div>
            <div className="mt-6 flex justify-center">
              <span className="px-4 py-1.5 bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-[0.2em] rounded-full border border-blue-100">
                🟢 Active Partner
              </span>
            </div>
          </div>

          <div className="flex-1 w-full">
            {editMode ? (
              <form onSubmit={handleUpdate} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-4">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-600 transition-all"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-4">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-600 transition-all"
                      required
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-4">
                      Contact Number
                    </label>
                    <input
                      type="text"
                      value={formData.contact}
                      onChange={(e) =>
                        setFormData({ ...formData, contact: e.target.value })
                      }
                      className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-600 transition-all"
                      required
                    />
                  </div>
                </div>
                <div className="pt-6">
                  <button
                    type="submit"
                    className="w-full px-8 py-5 bg-indigo-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-600/30 active:scale-[0.98]"
                  >
                    Save Profile Changes
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-10 text-center md:text-left">
                <div>
                  <h2 className="text-4xl font-black text-slate-900 mb-2 capitalize">
                    {profile?.name}
                  </h2>
                  <p className="text-indigo-600 font-bold text-sm tracking-widest uppercase">
                    Institutional Deployment Partner
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-left">
                  <div className="p-8 bg-slate-50/50 rounded-3xl border border-slate-100 group hover:bg-white hover:shadow-xl transition-all duration-300">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 leading-none">
                      Username
                    </p>
                    <p className="font-bold text-slate-900 font-mono">
                      @{profile?.username}
                    </p>
                  </div>
                  <div className="p-8 bg-slate-50/50 rounded-3xl border border-slate-100 group hover:bg-white hover:shadow-xl transition-all duration-300">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 leading-none">
                      Email Access
                    </p>
                    <p className="font-bold text-slate-900 truncate">
                      {profile?.email}
                    </p>
                  </div>
                  <div className="p-8 bg-slate-50/50 rounded-3xl border border-slate-100 group hover:bg-white hover:shadow-xl transition-all duration-300">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 leading-none">
                      Contact
                    </p>
                    <p className="font-bold text-slate-900">
                      {profile?.contact}
                    </p>
                  </div>
                  <div className="p-8 bg-slate-50/50 rounded-3xl border border-slate-100 group hover:bg-white hover:shadow-xl transition-all duration-300">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 leading-none">
                      Territory / Location
                    </p>
                    <p className="font-bold text-slate-900">
                      {profile?.location}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <button
                    onClick={() => setEditMode(true)}
                    className="flex-1 px-8 py-4 bg-slate-900 text-white text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-indigo-600 transition-all shadow-xl shadow-slate-900/10"
                  >
                    Update Credentials
                  </button>
                  <button className="flex-1 px-8 py-4 bg-white border-2 border-slate-100 text-slate-600 text-xs font-black uppercase tracking-widest rounded-2xl hover:border-slate-200 hover:bg-slate-50 transition-all">
                    Partner Support
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-12 text-center text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em]">
        Partner Portal Security Protocol Active
      </div>
    </div>
  );
};

export default DealerProfile;
