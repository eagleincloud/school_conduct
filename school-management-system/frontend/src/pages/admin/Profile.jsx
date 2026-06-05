import React from "react";
import authService from "../../services/authService";

const AdminProfile = () => {
  const user = authService.getCurrentUser();

  const getInitials = (name) => {
    return (name || "A")
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  return (
    <div className="max-w-2xl space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-school-text">My Profile</h1>
        <p className="text-sm text-school-body">
          Manage your administrative account settings.
        </p>
      </div>

      <div className="bg-white rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/50 p-10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-school-navy/5 rounded-full -mr-32 -mt-32"></div>

        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="w-32 h-32 rounded-[40px] bg-school-navy flex items-center justify-center text-white text-4xl font-black shadow-2xl shadow-school-navy/30 mb-6 rotate-3 hover:rotate-0 transition-transform duration-500">
            {getInitials(user?.username)}
          </div>

          <h2 className="text-3xl font-black text-school-text mb-1 capitalize">
            {user?.username || "Administrator"}
          </h2>
          <p className="px-4 py-1.5 bg-school-blue/10 text-school-blue text-[10px] font-black uppercase tracking-[0.2em] rounded-full inline-block mb-10">
            {user?.role || "Admin"}
          </p>

          <div className="w-full grid grid-cols-1 gap-4 text-left">
            <div className="p-6 bg-slate-50/50 rounded-3xl border border-slate-50 flex items-center justify-between group hover:bg-white hover:shadow-lg transition-all">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                  Username
                </p>
                <p className="font-bold text-school-text">{user?.username}</p>
              </div>
              <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                ✏️
              </span>
            </div>
            <div className="p-6 bg-slate-50/50 rounded-3xl border border-slate-50 flex items-center justify-between group hover:bg-white hover:shadow-lg transition-all">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                  Access Level
                </p>
                <p className="font-bold text-school-text capitalize">
                  {user?.role} Privileges
                </p>
              </div>
              <span className="text-emerald-500 font-bold text-[10px] uppercase">
                Verified
              </span>
            </div>
          </div>

          <button className="mt-10 px-10 py-4 bg-school-navy text-white text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-school-blue transition-all shadow-lg shadow-school-navy/20">
            Edit Public Profile
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminProfile;
