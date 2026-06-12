import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import authService from '../../services/authService';
import useAuthStore from '../../store/authStore';
import useUIStore from '../../store/uiStore';
import api from '../../services/api';
import SiblingSwitcher from '../student/SiblingSwitcher';
import { useStudent } from '../../context/StudentContext';

const Navbar = () => {
    const navigate = useNavigate();
    const { logout } = useAuthStore();
    const user = authService.getCurrentUser();
    const [studentProfile, setStudentProfile] = useState(null);
    const [teacherProfile, setTeacherProfile] = useState(null);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const { selectedStudentId, setSelectedStudentId } = useStudent();
    const [siblings, setSiblings] = useState([]);
    const [authProfile, setAuthProfile] = useState(null);
    const { toggleSidebar } = useUIStore();

    // Determine if the sidebar hamburger toggle should show (roles that have a sidebar)
    const showSidebarToggle = user.role !== 'superadmin' && user.role !== 'dealer';

    useEffect(() => {
        // Fetch base auth profile for everyone to get the latest profile_photo
        api.get('auth/profile/').then(res => setAuthProfile(res.data)).catch(() => { });

        if (user.role === 'student') {
            api.get('students/profile/').then(res => setStudentProfile(res.data)).catch(() => { });
            api.get('students/siblings/').then(res => setSiblings(res.data)).catch(() => { });
        }
        if (user.role === 'teacher') {
            api.get('teachers/profile/').then(res => setTeacherProfile(res.data)).catch(() => { });
        }
    }, [user.role, selectedStudentId]);

    const handleLogout = () => {
        const sid = user.school_id;
        logout();
        if (sid && user.role !== 'superadmin') {
            navigate(`/school/${sid}`);
        } else {
            navigate('/');
        }
    };

    const displayName = user.role === 'student' ? (studentProfile?.name || user.name) : user.name;
    const initials = (displayName || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    const profileId = user.role === 'student'
        ? studentProfile?.admission_number
        : user.role === 'teacher'
            ? teacherProfile?.employee_id
            : user?.id;

    // Use the latest fetched photo, fallback to token photo, fallback to null
    const profilePhotoUrl = authProfile?.profile_photo || user.profile_photo;

    // Unified Navbar for all roles
    return (
        <header className="h-14 sm:h-16 md:h-20 bg-white border-b border-slate-200 sticky top-0 z-40 flex items-center justify-between gap-2 px-3 sm:px-4 md:px-8">
            {/* Left Section: Hamburger + Branding */}
            <div className="flex items-center gap-1.5 sm:gap-2 md:gap-4 min-w-0 md:min-w-[200px]">
                {/* Mobile Hamburger Toggle */}
                {showSidebarToggle && (
                    <button
                        onClick={toggleSidebar}
                        className="md:hidden flex items-center justify-center w-10 h-10 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 transition-all"
                        aria-label="Toggle sidebar menu"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                        </svg>
                    </button>
                )}
                <div className="w-9 sm:w-11 h-9 sm:h-11 bg-school-navy rounded-[2px] flex items-center justify-center text-white text-lg sm:text-2xl font-black shadow-xl shadow-school-navy/20 animate-in fade-in zoom-in duration-700 overflow-hidden">
                    {user.role === 'superadmin' ? (
                        profilePhotoUrl ? (
                            <img src={profilePhotoUrl} alt="Logo" className="w-full h-full object-cover bg-white" />
                        ) : 'S'
                    ) : user.role === 'dealer' ? 'D' : (
                        user.school_logo ? (
                            <img
                                src={user.school_logo}
                                alt="Logo"
                                className="w-full h-full object-contain bg-white rounded-[2px] border border-slate-100 shadow-sm transition-opacity duration-500"
                                onLoad={(e) => {
                                    e.target.style.opacity = '1';
                                }}
                                onError={(e) => {
                                    if (!e.target.dataset.triedFallback) {
                                        e.target.dataset.triedFallback = 'true';
                                        e.target.style.display = 'none';
                                        e.target.parentElement.innerText = user.school_name ? user.school_name[0].toUpperCase() : 'S';
                                    }
                                }}
                            />
                        ) : (
                            user.school_name ? user.school_name[0].toUpperCase() : 'S'
                        ))}
                </div>
                <div className="flex flex-col">
                    <h1 className="text-[11px] sm:text-[13px] md:text-base font-black text-slate-900 leading-tight tracking-tight uppercase truncate max-w-[120px] sm:max-w-[150px] md:max-w-xs">
                        {user.role === 'superadmin' ? 'Root User' : user.role === 'dealer' ? 'Dealer Portal' : (user.school_name || 'School Portal')}
                    </h1>
                    <p className="text-[7px] sm:text-[9px] font-bold text-school-blue uppercase tracking-[0.1em] sm:tracking-[0.2em] opacity-80">
                        {user.role === 'superadmin' ? 'Global Control' : user.role === 'dealer' ? 'Partner Access' : (user.school_id || 'System')}
                    </p>
                </div>
            </div>

            {/* Right: Notifications & Profile Dropdown */}
            <div className="flex items-center justify-end gap-1 sm:gap-2 md:gap-5 min-w-0">
                {/* Repositioned Class Info */}
                {user.role === 'student' && (
                    <div className="flex items-center justify-end gap-1 sm:gap-3 min-w-0">
                        <div className="hidden md:flex px-4 py-1.5 bg-slate-50 border border-slate-100 rounded-xl items-center gap-2.5 shadow-sm hover:shadow-md transition-all group cursor-default">
                            <span className="text-lg group-hover:scale-110 transition-transform">🏫</span>
                            <div className="flex flex-col">
                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none">Class</span>
                                <span className="text-[12px] font-black text-school-navy leading-tight">{studentProfile?.class_section_display || '...'}</span>
                            </div>
                        </div>
                        <SiblingSwitcher
                            siblings={siblings}
                            selectedStudentId={selectedStudentId}
                            onSwitch={setSelectedStudentId}
                        />
                    </div>
                )}

                {/* Notifications - Hidden for Superadmin and School Admin */}
                {user.role !== 'superadmin' && user.role !== 'admin' && (
                    <>
                        {user.role === 'student' || user.role === 'teacher' ? (
                            <Link
                                to={user.role === 'student' ? '/student/notifications' : '/teacher/notifications'}
                                className="relative hidden sm:flex w-10 h-10 items-center justify-center rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-100 transition-all group"
                                aria-label="Notifications"
                            >
                                <span className="text-xl group-hover:scale-110 transition-transform">🔔</span>
                            </Link>
                        ) : (
                            <button type="button" className="relative w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-100 transition-all group">
                                <span className="text-xl group-hover:scale-110 transition-transform">🔔</span>
                            </button>
                        )}
                        <div className="h-8 w-px bg-slate-100 mx-1"></div>
                    </>
                )}

                {/* Profile Toggle */}
                <div className="relative">
                    <button
                        onClick={() => setIsProfileOpen(!isProfileOpen)}
                        className="flex items-center gap-1 sm:gap-2 md:gap-3 group bg-slate-50 hover:bg-slate-100 p-1 sm:p-1.5 md:pr-4 rounded-2xl transition-all border border-transparent hover:border-slate-200"
                    >
                        <div className="relative">
                            <div className="w-9 sm:w-11 h-9 sm:h-11 rounded-xl bg-gradient-to-br from-school-navy to-school-blue flex items-center justify-center text-white font-black text-xs sm:text-sm shadow-lg shadow-school-navy/20 group-hover:scale-105 transition-transform overflow-hidden">
                                {profilePhotoUrl ? (
                                    <img src={profilePhotoUrl} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    initials
                                )}
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-3 sm:w-4 h-3 sm:h-4 bg-emerald-500 rounded-lg border-[2px] sm:border-[3px] border-white shadow-sm"></div>
                        </div>
                        <div className="hidden sm:flex flex-col items-start min-w-0 max-w-[120px] md:max-w-[180px]">
                            <span className="text-[11px] sm:text-[13px] font-black text-slate-800 leading-tight group-hover:text-school-navy transition-colors truncate max-w-full">
                                {user.role === 'student' ? (studentProfile?.name || user.name) : user.name}
                            </span>
                            <span className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight">{user.role}</span>
                        </div>
                        <span className={`text-[8px] sm:text-[10px] text-slate-400 transition-transform duration-300 hidden sm:inline ${isProfileOpen ? 'rotate-180' : ''}`}>▼</span>
                    </button>

                    {/* Dropdown Menu */}
                    {isProfileOpen && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setIsProfileOpen(false)}></div>
                            <div className="fixed left-3 right-3 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-3 sm:w-72 sm:max-w-md max-h-[calc(100dvh-5rem)] overflow-y-auto bg-white rounded-3xl shadow-2xl shadow-slate-200/80 border border-slate-100 z-50 animate-in fade-in slide-in-from-top-4 duration-300 transform origin-top-right">
                                <div className="p-4 sm:p-6 bg-slate-50 border-b border-slate-100">
                                    <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
                                        <div className="w-11 sm:w-14 h-11 sm:h-14 rounded-2xl bg-white shadow-md flex items-center justify-center text-school-navy text-lg sm:text-xl font-black overflow-hidden">
                                            {profilePhotoUrl ? (
                                                <img src={profilePhotoUrl} alt="Profile" className="w-full h-full object-cover" />
                                            ) : (
                                                initials
                                            )}
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <h3 className="font-black text-slate-900 leading-tight text-sm sm:text-base truncate">
                                                {user.role === 'student' ? (studentProfile?.name || user.name) : user.name}
                                            </h3>
                                            <p className="text-[10px] sm:text-[11px] font-bold text-school-blue mt-0.5">ID: {profileId || '---'}</p>
                                        </div>
                                    </div>
                                    {user.role === 'student' && (
                                        <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                                            <div className="bg-white p-2 rounded-xl border border-slate-100">
                                                <p className="text-[7px] sm:text-[8px] font-bold text-slate-400 uppercase tracking-tighter italic">Class</p>
                                                <p className="text-[9px] sm:text-[10px] font-black text-slate-800">{studentProfile?.class_section_display || 'N/A'}</p>
                                            </div>
                                            <div className="bg-white p-2 rounded-xl border border-slate-100">
                                                <p className="text-[7px] sm:text-[8px] font-bold text-slate-400 uppercase tracking-tighter italic">Semester</p>
                                                <p className="text-[9px] sm:text-[10px] font-black text-slate-800">1st (Current)</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="p-1.5 sm:p-2">
                                    <Link
                                        to={`/${user.role}/profile`}
                                        className="flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-school-navy rounded-2xl transition-all group"
                                        onClick={() => setIsProfileOpen(false)}
                                    >
                                        <span className="w-7 sm:w-8 h-7 sm:h-8 rounded-lg bg-slate-100 flex items-center justify-center group-hover:scale-110 transition-transform text-sm">👤</span>
                                        View Profile
                                    </Link>
                                    <button
                                        onClick={handleLogout}
                                        className="w-full flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-red-500 hover:bg-red-50 rounded-2xl transition-all group"
                                    >
                                        <span className="w-7 sm:w-8 h-7 sm:h-8 rounded-lg bg-red-100/50 flex items-center justify-center group-hover:scale-110 transition-transform text-sm">🚪</span>
                                        Sign Out
                                    </button>
                                </div>
                                <div className="p-3 sm:p-4 bg-slate-50/50 text-center">
                                    <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-widest">Atheris Secure Login</p>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Navbar;
