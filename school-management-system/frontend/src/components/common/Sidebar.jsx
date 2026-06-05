import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import authService from '../../services/authService';
import useUIStore from '../../store/uiStore';

const Sidebar = () => {
    const location = useLocation();
    const { role, name } = authService.getCurrentUser();
    const [openMenus, setOpenMenus] = useState({});
    const { isSidebarOpen, closeSidebar } = useUIStore();

    const studentLinks = [
        { path: '/student/dashboard', label: 'Dashboard', icon: '📊' },
        { 
            label: 'Academic', 
            icon: '🎓',
            subLinks: [
                { path: '/student/assignments', label: 'Assignment' },
                { path: '/student/attendance', label: 'Attendance Status' },
                { path: '/student/exams', label: 'My Exams' },
                { 
                    label: 'Exam Result',
                    subLinks: [
                        { path: '/student/results/exam', label: 'Main Exam Result' },
                        { path: '/student/results/mst', label: 'MST Result' }
                    ]
                },
                { path: '/student/timetable', label: 'Time Table' }
            ]
        },
        {
            label: 'Account',
            icon: '💰',
            subLinks: [
                { path: '/student/fees', label: 'Fees Receipt' },
                { path: '/student/ledger', label: 'Student Ledgers' },
                { path: '/student/finance-cards', label: 'Class Fee Cards' }
            ]
        },
        {
            label: 'General Info',
            icon: 'ℹ️',
            subLinks: [
                { path: '/student/notifications', label: 'Notifications' },
                { path: '/student/syllabus', label: 'Syllabus' },
                { path: '/student/Holidays', label: 'Holidays' },
                { path: '/student/messaging', label: 'Messaging' },
            ]
        },
        { path: '/student/gallery', label: 'Gallery', icon: '🖼️' },
        { path: '/student/shops', label: 'Shop Locations', icon: '🏪' },
        { path: '/student/profile', label: 'Your Profile', icon: '🧑🏻‍🎓' },
    ];

    const teacherLinks = [
        { path: '/teacher/dashboard', label: 'Dashboard', icon: '📊' },
        { path: '/teacher/attendance', label: 'Mark Attendance', icon: '✅' },
        { path: '/teacher/upload-result', label: 'Upload Results', icon: '📤' },
        { path: '/teacher/assignment', label: 'Create Assignment', icon: '➕' },
        { path: '/teacher/assignments', label: 'Assignment List', icon: '📚' },
        { path: '/teacher/syllabus', label: 'Syllabus', icon: '📄' },
        { path: '/teacher/students', label: 'My Students', icon: '👥' },
        { path: '/teacher/timetable', label: 'Time Table', icon: '📅' },
        { path: '/teacher/messaging', label: 'Messaging', icon: '💬' },
        { path: '/teacher/gallery', label: 'Gallery', icon: '🖼️' },
        { path: '/teacher/notifications', label: 'Notifications', icon: '🔔' },
        { path: '/teacher/Holidays', label: 'Holidays', icon: '🏝️' },
        { path: '/teacher/Profile', label: 'Profile', icon: '🧑🏻‍💻' },
    ];

    const adminLinks = [
        { path: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
        { 
            label: 'User Management', 
            icon: '👥',
            subLinks: [
                { path: '/admin/add-teacher', label: 'Add Teacher' },
                { path: '/admin/add-student', label: 'Add Student' },
                { path: '/admin/manage-teachers', label: 'Teacher List' },
                { path: '/admin/manage-students', label: 'Student List' },
                { path: '/admin/bulk-import', label: 'Bulk Import Data' },
            ]
        },
        {
            label: 'Academic',
            icon: '🎓',
            subLinks: [
                { path: '/admin/classes', label: 'Classes & Sections' },
                { path: '/admin/subjects', label: 'Subjects' },
                { path: '/admin/assign-teacher', label: 'Assign Teacher' },
                { path: '/admin/exams', label: 'Exams' },
                { path: '/admin/publish-results', label: 'Publish Results' },
                { path: '/admin/announcements', label: 'Announcements' },
                { path: '/admin/syllabus', label: 'Syllabus' },
                { path: '/admin/holidays', label: 'Holidays' },
                { path: '/admin/timetable', label: 'Time Table' },
                { path: '/admin/messaging', label: 'Monitor Doubts' },
            ]
        },

        { path: '/admin/gallery', label: 'Gallery', icon: '🖼️' },
        {
            label: 'Finance',
            icon: '💰',
            subLinks: [
                { path: '/admin/fees', label: 'Fee Management' },
                { path: '/admin/finance-cards', label: 'Fee Cards' },
            ]
        },
        { path: '/admin/reports', label: 'Reports', icon: '📈' },
        { path: '/admin/shops', label: 'Shop Locations', icon: '🏪' },
    ];

    const links = role === 'student' ? studentLinks : (role === 'teacher' ? teacherLinks : adminLinks);

    const toggleMenu = (label) => {
        setOpenMenus((prev) => ({
            ...prev,
            [label]: !prev[label],
        }));
    };

    // Initialize open menus based on current location
    useEffect(() => {
        if (!role) return;

        const findActiveParentLabels = (menuItems, currentPath) => {
            let activeLabels = {};
            const search = (items, path) => {
                for (const item of items) {
                    if (item.subLinks) {
                        const hasActiveChild = search(item.subLinks, path);
                        if (hasActiveChild) {
                            activeLabels[item.label] = true;
                            return true;
                        }
                    } else if (item.path === path) {
                        return true;
                    }
                }
                return false;
            };
            search(menuItems, currentPath);
            return activeLabels;
        };

        const initialOpenMenus = findActiveParentLabels(links, location.pathname);
        // Keep the accordion state aligned with the current route on navigation.
        setOpenMenus(initialOpenMenus);
    }, [location.pathname, role]); // re-run if location or role changes

    if (!role) return null;

    const NavItem = ({ item, depth = 0 }) => {
        const hasSubLinks = item.subLinks && item.subLinks.length > 0;
        const isOpen = openMenus[item.label];
        const isActive = location.pathname === item.path;
        
        // Auto-open parent if child is active (simplified for 2 levels)
        const isChildActive = hasSubLinks && item.subLinks.some(sub => 
            sub.path === location.pathname || (sub.subLinks && sub.subLinks.some(ss => ss.path === location.pathname))
        );

        return (
            <div className="flex flex-col">
                {item.path ? (
                    <Link
                        to={item.path}
                        onClick={closeSidebar}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 group ${
                            isActive 
                            ? 'bg-school-navy text-white shadow-md shadow-school-navy/10' 
                            : 'text-school-body hover:bg-slate-50 hover:text-school-navy'
                        }`}
                        style={{ marginLeft: `${depth * 12}px` }}
                    >
                        {item.icon && <span className="text-lg">{item.icon}</span>}
                        <span>{item.label}</span>
                        {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white opacity-50"></div>}
                    </Link>
                ) : (
                    <button
                        onClick={() => toggleMenu(item.label, depth)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 group ${
                            isChildActive ? 'text-school-navy' : 'text-school-body hover:bg-slate-50 hover:text-school-navy'
                        }`}
                        style={{ marginLeft: `${depth * 12}px` }}
                    >
                        {item.icon && <span className="text-lg">{item.icon}</span>}
                        <span>{item.label}</span>
                        <span className={`ml-auto text-[10px] transition-transform duration-200 ${isOpen || isChildActive ? 'rotate-180' : ''}`}>
                            ▼
                        </span>
                    </button>
                )}

                {isOpen && hasSubLinks && (
                    <div className="mt-1 space-y-1">
                        {item.subLinks.map((sub, i) => (
                            <NavItem key={i} item={sub} depth={depth + 1} />
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <>
            {/* Mobile backdrop overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/40 z-40 md:hidden transition-opacity duration-300"
                    onClick={closeSidebar}
                />
            )}

            <aside className={`
                fixed inset-y-0 left-0 z-50 w-[82vw] max-w-72 md:w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300 ease-in-out
                md:relative md:translate-x-0
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                {/* Mobile close button */}
                <div className="md:hidden flex items-center justify-between p-4 border-b border-slate-100">
                    <span className="text-sm font-black text-slate-700 uppercase tracking-wide">Menu</span>
                    <button
                        onClick={closeSidebar}
                        className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
                        aria-label="Close menu"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar scrollbar-hide">
                    <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4 mt-2">Main Menu</p>
                    {links.map((link, i) => (
                        <NavItem key={i} item={link} />
                    ))}
                </nav>

                {/* User Footer */}
                <div className="p-4 border-t border-slate-50 bg-slate-50/50">
                    <div className="flex items-center gap-3 p-2 rounded-xl">
                        <div className="w-8 h-8 rounded-lg bg-school-blue/10 flex items-center justify-center text-school-blue font-bold text-xs uppercase">
                            {name?.[0] || 'U'}
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-xs font-bold text-school-text truncate">{name || 'User'}</span>
                            <span className="text-[10px] font-semibold text-slate-400 uppercase">{role}</span>
                        </div>
                    </div>
                </div>
            </aside>
        </>
    );
};

export default Sidebar;
