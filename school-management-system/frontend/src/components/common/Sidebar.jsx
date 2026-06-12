import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    Bell,
    BookOpen,
    CalendarDays,
    ChartLine,
    ChevronDown,
    CircleCheck,
    CirclePlus,
    ClipboardCheck,
    CreditCard,
    FileText,
    FileUp,
    GraduationCap,
    Images,
    Info,
    LayoutDashboard,
    MessageCircle,
    Network,
    Store,
    Umbrella,
    UserCheck,
    UserCog,
    UserRound,
    UsersRound,
    Wallet,
    X,
} from 'lucide-react';
import authService from '../../services/authService';
import useUIStore from '../../store/uiStore';

const Sidebar = () => {
    const location = useLocation();
    const { role, name } = authService.getCurrentUser();
    const [openMenus, setOpenMenus] = useState({});
    const { isSidebarOpen, closeSidebar } = useUIStore();

    const studentLinks = [
        { path: '/student/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
        { 
            label: 'Academic', 
            Icon: GraduationCap,
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
            Icon: Wallet,
            subLinks: [
                { path: '/student/fees', label: 'Fees Receipt' },
                { path: '/student/ledger', label: 'Student Ledgers' },
                { path: '/student/finance-cards', label: 'Class Fee Cards' }
            ]
        },
        {
            label: 'General Info',
            Icon: Info,
            subLinks: [
                { path: '/student/notifications', label: 'Notifications' },
                { path: '/student/syllabus', label: 'Syllabus' },
                { path: '/student/Holidays', label: 'Holidays' },
                { path: '/student/messaging', label: 'Messaging' },
            ]
        },
        { path: '/student/gallery', label: 'Gallery', Icon: Images },
        { path: '/student/shops', label: 'Shop Locations', Icon: Store },
        { path: '/student/profile', label: 'Your Profile', Icon: UserRound },
    ];

    const teacherLinks = [
        { path: '/teacher/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
        { path: '/teacher/attendance', label: 'Mark Attendance', Icon: CircleCheck },
        { path: '/teacher/my-attendance', label: 'My Attendance', Icon: ClipboardCheck },
        { path: '/teacher/upload-result', label: 'Upload Results', Icon: FileUp },
        { path: '/teacher/assignment', label: 'Create Assignment', Icon: CirclePlus },
        { path: '/teacher/assignments', label: 'Assignment List', Icon: BookOpen },
        { path: '/teacher/syllabus', label: 'Syllabus', Icon: FileText },
        { path: '/teacher/students', label: 'My Students', Icon: UsersRound },
        { path: '/teacher/timetable', label: 'Time Table', Icon: CalendarDays },
        { path: '/teacher/messaging', label: 'Messaging', Icon: MessageCircle },
        { path: '/teacher/gallery', label: 'Gallery', Icon: Images },
        { path: '/teacher/notifications', label: 'Notifications', Icon: Bell },
        { path: '/teacher/Holidays', label: 'Holidays', Icon: Umbrella },
        { path: '/teacher/Profile', label: 'Profile', Icon: UserCog },
    ];

    const adminLinks = [
        { path: '/admin/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
        { 
            label: 'User Management', 
            Icon: UsersRound,
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
            Icon: GraduationCap,
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

        { path: '/admin/gallery', label: 'Gallery', Icon: Images },
        {
            label: 'Finance',
            Icon: CreditCard,
            subLinks: [
                { path: '/admin/fees', label: 'Fee Management' },
                { path: '/admin/finance-cards', label: 'Fee Cards' },
            ]
        },
        { path: '/admin/reports', label: 'Reports', Icon: ChartLine },
        { path: '/admin/shops', label: 'Shop Locations', Icon: Store },
    ];


        adminLinks.splice(adminLinks.length - 1, 0, { path: '/admin/biometric-machines', label: 'Biometric Machines', Icon: Network });
        adminLinks.splice(adminLinks.length - 1, 0, { path: '/admin/teacher-attendance', label: 'Staff Attendance', Icon: UserCheck });

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
        const Icon = item.Icon;
        
        // Auto-open parent if child is active (simplified for 2 levels)
        const isChildActive = hasSubLinks && item.subLinks.some(sub => 
            sub.path === location.pathname || (sub.subLinks && sub.subLinks.some(ss => ss.path === location.pathname))
        );
        const isExpanded = Boolean(isOpen);
        const isHighlighted = Boolean(isOpen || isChildActive);

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
                        {Icon && (
                            <Icon
                                className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-school-navy'}`}
                                strokeWidth={2.3}
                            />
                        )}
                        <span>{item.label}</span>
                        {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white opacity-50"></div>}
                    </Link>
                ) : (
                    <button
                        onClick={() => toggleMenu(item.label)}
                        aria-expanded={isExpanded}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 group ${
                            isHighlighted ? 'text-school-navy' : 'text-school-body hover:bg-slate-50 hover:text-school-navy'
                        }`}
                        style={{ marginLeft: `${depth * 12}px` }}
                    >
                        {Icon && (
                            <Icon
                                className={`h-[18px] w-[18px] shrink-0 ${isHighlighted ? 'text-school-navy' : 'text-slate-400 group-hover:text-school-navy'}`}
                                strokeWidth={2.3}
                            />
                        )}
                        <span>{item.label}</span>
                        <ChevronDown
                            className={`ml-auto h-4 w-4 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-school-navy' : 'text-slate-400 group-hover:text-school-navy'}`}
                            strokeWidth={2.4}
                        />
                    </button>
                )}

                {isExpanded && hasSubLinks && (
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
                        <X className="h-4 w-4" strokeWidth={2.5} />
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
