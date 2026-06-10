import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import StudentCards from './StudentCards';
import TeacherCards from './TeacherCards';

const AdminDashboard = () => {
    const [recentStudents, setRecentStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({
        email: '', password: '', confirm_password: '',
        first_name: '', last_name: '', name: '',
        admission_number: '',
        class_id: '', section_id: '',
        dob: '',
        gender: '',
        blood_group: '',
        father_name: '',
        mother_name: '',
        father_contact: '',
        mother_contact: '',
        bus_no: '',
        address: '',
        date_of_admission: '',
        category: '',
        rfid_code: '',
    });
    const [mainClasses, setMainClasses] = useState([]);
    const [mainSections, setMainSections] = useState([]);
    const [message, setMessage] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [students, setStudents] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [teachersCount, setTeachersCount] = useState(0);
    const [studentsCount, setStudentsCount] = useState(0);
    const [studentsLoading, setStudentsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [galleryImages, setGalleryImages] = useState([]);
    const [galleryLoading, setGalleryLoading] = useState(false);
    const [currentSlide, setCurrentSlide] = useState(0);
    const token = localStorage.getItem('access_token');
    const parentPhoneDigits = (formData.parent_contact_number || '').replace(/\D/g, '').slice(0, 10);

    const fetchCounts = async () => {
        setIsSubmitting(true);
        try {
            const res = await api.get('admin/dashboard/stats');
            const data = res?.data?.data || {};
            setStudentsCount(Number(data.total_students || 0));
            setTeachersCount(Number(data.total_teachers || 0));
        } catch (e) {
            console.error("Error fetching stats:", e);
        }
    };

    const fetchClassesAndSections = async () => {
        setIsSubmitting(true);
        try {
            const [cRes, sRes] = await Promise.all([
                api.get('classes/main-classes/'),
                api.get('classes/main-sections/')
            ]);
            setMainClasses(cRes.data);
            setMainSections(sRes.data);
        } catch (e) {
            console.error("Error fetching class/sections:", e);
        }
    };

    const fetchDashboardGallery = async () => {
        setGalleryLoading(true);
        setIsSubmitting(true);
        try {
            const res = await api.get('gallery/');
            setGalleryImages(Array.isArray(res?.data) ? res.data : []);
        } catch (e) {
            console.error("Error fetching gallery:", e);
            setGalleryImages([]);
        } finally {
            setGalleryLoading(false);
        }
    };

    useEffect(() => {
        setStudentsLoading(true);
        Promise.all([fetchCounts(), fetchClassesAndSections(), fetchDashboardGallery()])
            .finally(() => setStudentsLoading(false));
    }, []);

    useEffect(() => {
        if (!galleryImages.length) {
            setCurrentSlide(0);
            return undefined;
        }
        const timer = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % galleryImages.length);
        }, 4000);
        return () => clearInterval(timer);
    }, [galleryImages]);

    // Auto refresh dashboard stats (so delete/update actions reflect immediately).
    useEffect(() => {
        const tick = async () => {
            await fetchCounts();
        };

        const id = setInterval(tick, 5000);
        const onVis = () => {
            if (!document.hidden) tick();
        };
        document.addEventListener('visibilitychange', onVis);
        return () => {
            clearInterval(id);
            document.removeEventListener('visibilitychange', onVis);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;
        const password = formData.password || '';
        const confirm = formData.confirm_password || '';
        if (password !== confirm) {
            setMessage('Error: Password and confirm password do not match.');
            return;
        }
        setIsSubmitting(true);
        try {
            const payload = { ...formData };
            const first = (formData.first_name || '').trim();
            const last = (formData.last_name || '').trim();
            const emailLocal = (formData.email || '').split('@')[0].trim().toLowerCase();

            payload.username = emailLocal || 'student';
            payload.name = `${first} ${last}`.trim();

            const f_digits = (formData.father_contact || '').replace(/\D/g, '').slice(0, 10);
            const m_digits = (formData.mother_contact || '').replace(/\D/g, '').slice(0, 10);

            payload.father_contact = f_digits ? `+91${f_digits}` : '';
            payload.mother_contact = m_digits ? `+91${m_digits}` : '';

            await api.post('students/admin-create/', payload);
            setMessage('Student created successfully!');
            await fetchCounts();
            setIsFormOpen(false);
            setFormData({
                email: '', password: '', first_name: '', last_name: '', name: '',
                admission_number: '', class_id: '', section_id: '', dob: '',
                gender: '', blood_group: '', father_name: '', mother_name: '',
                father_contact: '', mother_contact: '', bus_no: '', address: '', date_of_admission: '', category: '',
                rfid_code: '',
            });
            setTimeout(() => setMessage(''), 3000);
        } catch (err) {
            setMessage(err?.response?.data?.error ? `Error: ${err.response.data.error}` : 'Error creating student.');
            setTimeout(() => setMessage(''), 3000);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="relative overflow-hidden bg-white/80 backdrop-blur-xl p-10 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 mb-10 group transition-all duration-500 hover:shadow-2xl hover:shadow-school-blue/5">
                <div className="absolute top-0 right-0 w-64 h-64 bg-school-blue/5 blur-3xl rounded-full -mr-32 -mt-32 transition-colors group-hover:bg-school-blue/10"></div>
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-school-navy to-school-blue flex items-center justify-center text-3xl shadow-xl shadow-school-navy/20">
                            🛡️
                        </div>
                        <div>
                            <h1 className="text-4xl font-poppins font-black text-school-text tracking-tight">
                                Welcome <span className="text-transparent bg-clip-text bg-gradient-to-r from-school-navy to-school-blue">Admin Dashboard</span>
                            </h1>
                            <p className="text-sm text-school-body font-bold mt-1 opacity-70">
                                Management Overview & Academic Control Center • {new Date().toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' })}
                            </p>
                        </div>
                    </div>
                </div>
            </div>


            {/* Dashboard Stats & Overview */}
            {!isFormOpen && (
                <div className="space-y-12 animate-in slide-in-from-bottom-4 duration-700">
                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            { label: 'Total Students', value: studentsCount, icon: '🎓', color: 'from-blue-500 to-school-blue', shadow: 'shadow-blue-500/20' },
                            { label: 'Total Teachers', value: teachersCount, icon: '👨‍🏫', color: 'from-indigo-600 to-violet-500', shadow: 'shadow-indigo-500/20' },
                            { label: 'Active Classes', value: mainClasses.length, icon: '🏫', color: 'from-emerald-500 to-teal-400', shadow: 'shadow-emerald-500/20' },
                            { label: 'Total Sections', value: mainSections.length, icon: '🏢', color: 'from-amber-500 to-orange-400', shadow: 'shadow-amber-500/20' },
                        ].map((stat, i) => (
                            <div key={i} className="group relative bg-white/80 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:shadow-school-blue/10 transition-all duration-500 cursor-default hover:-translate-y-2 overflow-hidden">
                                <div className={`absolute top-0 left-0 w-2 h-full bg-gradient-to-b ${stat.color} opacity-0 group-hover:opacity-100 transition-opacity`}></div>
                                <div className="flex items-center gap-5 relative z-10">
                                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${stat.color} flex items-center justify-center text-2xl shadow-lg ${stat.shadow} group-hover:rotate-6 transition-transform duration-500`}>
                                        {stat.icon}
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">{stat.label}</p>
                                        <p className="text-3xl font-poppins font-black text-school-text">{studentsLoading ? '...' : stat.value}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Chart & Activity Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* Dashboard Gallery Slider */}
                        <div className="lg:col-span-8 bg-white/50 backdrop-blur-md p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/30">
                            <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
                                <div>
                                    <h3 className="font-poppins font-bold text-school-text text-lg">School Gallery Highlights</h3>
                                    <p className="text-xs text-slate-400">Auto-rotating highlights from your secure gallery</p>
                                </div>
                            </div>
                            <div className="h-72 rounded-2xl border border-slate-100 bg-white/70 p-3">
                                {galleryLoading ? (
                                    <div className="h-full flex items-center justify-center text-slate-400 font-bold">Loading gallery...</div>
                                ) : galleryImages.length === 0 ? (
                                    <div className="h-full flex items-center justify-center text-slate-400 font-bold">No gallery images uploaded yet.</div>
                                ) : (
                                    <div className="h-full relative rounded-xl overflow-hidden">
                                        {galleryImages.map((img, idx) => (
                                            <img
                                                key={img.id}
                                                src={`${img.image_url}${token ? `?token=${token}` : ''}`}
                                                alt={img.title}
                                                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 select-none ${idx === currentSlide ? 'opacity-100' : 'opacity-0'}`}
                                                onContextMenu={(e) => e.preventDefault()}
                                                onDragStart={(e) => e.preventDefault()}
                                            />
                                        ))}
                                        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/50 to-transparent">
                                            <p className="text-white font-bold text-sm truncate">{galleryImages[currentSlide]?.title}</p>
                                        </div>
                                        <div className="absolute bottom-3 right-3 flex gap-1.5">
                                            {galleryImages.map((img, idx) => (
                                                <button
                                                    key={img.id}
                                                    type="button"
                                                    onClick={() => setCurrentSlide(idx)}
                                                    className={`w-2.5 h-2.5 rounded-full ${idx === currentSlide ? 'bg-white' : 'bg-white/50'}`}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Recent Activity / Calendar Placeholder (Light Theme) */}
                        <div className="lg:col-span-4 bg-white/80 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden group hover:shadow-2xl hover:shadow-school-blue/10 transition-all duration-500">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-school-blue/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-school-blue/10 transition-colors"></div>
                            <h3 className="font-poppins font-bold text-school-text text-lg mb-8 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-school-blue animate-pulse"></span>
                                    Academic Calendar
                                </div>
                                <span className="text-xs font-black text-school-navy bg-school-blue/5 px-3 py-1 rounded-full uppercase tracking-widest">
                                    {new Date().toLocaleString('default', { month: 'long' })} {new Date().getFullYear()}
                                </span>
                            </h3>
                            <div className="grid grid-cols-7 gap-3 text-center mb-6 px-1">
                                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                                    <span key={i} className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{day}</span>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 gap-2">
                                {(() => {
                                    const today = new Date();
                                    const month = today.getMonth();
                                    const year = today.getFullYear();
                                    const firstDay = new Date(year, month, 1).getDay();
                                    const totalDays = new Date(year, month + 1, 0).getDate();
                                    const cells = [];

                                    // Add spacers for days before the 1st
                                    for (let i = 0; i < firstDay; i++) {
                                        cells.push(<div key={`empty-${i}`} className="aspect-square" />);
                                    }

                                    // Add actual days
                                    for (let d = 1; d <= totalDays; d++) {
                                        const isToday = d === today.getDate();
                                        cells.push(
                                            <div
                                                key={`day-${d}`}
                                                className={`aspect-square flex items-center justify-center text-[11px] rounded-xl transition-all cursor-pointer border
                                                    ${isToday
                                                        ? 'bg-gradient-to-br from-school-navy to-school-blue text-white font-black border-transparent shadow-lg shadow-school-blue/30 scale-110 z-10'
                                                        : 'hover:bg-slate-50 text-slate-600 font-bold border-slate-50 hover:border-slate-100 hover:text-school-navy'}`}
                                            >
                                                {d}
                                            </div>
                                        );
                                    }
                                    return cells;
                                })()}
                            </div>
                            <div className="mt-10 space-y-5">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] pl-1">Upcoming Events</p>
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-white hover:shadow-md transition-all group/event cursor-pointer">
                                    <div className="flex gap-4 items-center">
                                        <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-500 font-black text-xs ring-4 ring-red-50 group-hover/event:scale-110 transition-transform">
                                            28
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black text-slate-800 group-hover/event:text-school-navy transition-colors">Exam Prep Week</span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Starts in 2 days</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            )}

            {/* Registration Form UI */}
            {isFormOpen && (
                <div className="max-w-4xl mx-auto bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
                    <div className="p-8 bg-slate-900 text-white relative">
                        <h3 className="text-2xl font-bold">New Student Registration</h3>
                        <p className="text-slate-400 text-sm mt-1">Fill in the details to create a new student account.</p>
                        <div className="absolute right-8 top-8 opacity-20 text-6xl">🎓</div>
                    </div>

                    <form onSubmit={handleSubmit} className="p-8 space-y-8">
                        {/* Section: Personal Info */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-4">
                                <span className="w-8 h-8 rounded-lg bg-school-blue/10 flex items-center justify-center text-school-blue font-bold">01</span>
                                <h4 className="font-bold text-school-text uppercase tracking-wider text-sm">Personal Information</h4>
                                <div className="flex-1 h-px bg-slate-100"></div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">First Name</label>
                                    <input
                                        type="text"
                                        placeholder="Enter first name"
                                        value={formData.first_name}
                                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-school-navy/5 outline-none focus:bg-white focus:border-school-navy/20 transition-all font-medium"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Last Name</label>
                                    <input
                                        type="text"
                                        placeholder="Enter last name"
                                        value={formData.last_name}
                                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-school-navy/5 outline-none focus:bg-white focus:border-school-navy/20 transition-all font-medium"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Email Address</label>
                                    <input
                                        type="email"
                                        placeholder="student@example.com"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-school-navy/5 outline-none focus:bg-white focus:border-school-navy/20 transition-all font-medium"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Login Password</label>
                                    <input
                                        type="password"
                                        placeholder="••••••••"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-school-navy/5 outline-none focus:bg-white focus:border-school-navy/20 transition-all font-medium"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Date of Birth</label>
                                    <input
                                        type="date"
                                        value={formData.dob}
                                        onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-school-navy/5 outline-none focus:bg-white focus:border-school-navy/20 transition-all"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Gender</label>
                                    <select
                                        value={formData.gender}
                                        onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-school-navy/5 outline-none focus:bg-white focus:border-school-navy/20 transition-all"
                                        required
                                    >
                                        <option value="">Select Gender</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Blood Group</label>
                                    <select
                                        value={formData.blood_group}
                                        onChange={(e) => setFormData({ ...formData, blood_group: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-school-navy/5 outline-none focus:bg-white focus:border-school-navy/20 transition-all"
                                        required
                                    >
                                        <option value="">Select Group</option>
                                        {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => <option key={bg} value={bg}>{bg}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Section: Academic Info */}
                        <div className="space-y-6 pt-4">
                            <div className="flex items-center gap-4">
                                <span className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 font-bold">02</span>
                                <h4 className="font-bold text-school-text uppercase tracking-wider text-sm">Academic Details</h4>
                                <div className="flex-1 h-px bg-slate-100"></div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Admission No</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. ADM2026"
                                        value={formData.admission_number}
                                        onChange={(e) => setFormData({ ...formData, admission_number: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-school-navy/5 outline-none focus:bg-white focus:border-school-navy/20 transition-all"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Category</label>
                                    <input
                                        type="text"
                                        placeholder="General / OBC / SC"
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-school-navy/5 outline-none focus:bg-white focus:border-school-navy/20 transition-all"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Class</label>
                                    <select
                                        value={formData.class_id}
                                        onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-school-navy/5 outline-none focus:bg-white focus:border-school-navy/20 transition-all"
                                        required
                                    >
                                        <option value="">Select Class</option>
                                        {mainClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Section</label>
                                    <select
                                        value={formData.section_id}
                                        onChange={(e) => setFormData({ ...formData, section_id: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-school-navy/5 outline-none focus:bg-white focus:border-school-navy/20 transition-all"
                                        required
                                    >
                                        <option value="">Select Section</option>
                                        {mainSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Bus No (Optional)</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. BUS-01"
                                        value={formData.bus_no}
                                        onChange={(e) => setFormData({ ...formData, bus_no: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-school-navy/5 outline-none focus:bg-white focus:border-school-navy/20 transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">RFID Code / Biometric ID</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. RFID_123"
                                        value={formData.rfid_code}
                                        onChange={(e) => setFormData({ ...formData, rfid_code: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-school-navy/5 outline-none focus:bg-white focus:border-school-navy/20 transition-all font-medium"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Admission Date</label>
                                <input
                                    type="date"
                                    value={formData.date_of_admission}
                                    onChange={(e) => setFormData({ ...formData, date_of_admission: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-school-navy/5 outline-none focus:bg-white focus:border-school-navy/20 transition-all max-w-xs"
                                    required
                                />
                            </div>
                        </div>

                        {/* Section: Guardian Info */}
                        <div className="space-y-6 pt-4">
                            <div className="flex items-center gap-4">
                                <span className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 font-bold">03</span>
                                <h4 className="font-bold text-school-text uppercase tracking-wider text-sm">Guardian & Address</h4>
                                <div className="flex-1 h-px bg-slate-100"></div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Father's Name</label>
                                    <input
                                        type="text"
                                        placeholder="Full name of father"
                                        value={formData.father_name}
                                        onChange={(e) => setFormData({ ...formData, father_name: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-school-navy/5 outline-none focus:bg-white focus:border-school-navy/20 transition-all"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Father's Contact</label>
                                    <input
                                        type="tel"
                                        placeholder="Father's phone number"
                                        value={formData.father_contact}
                                        onChange={(e) => setFormData({ ...formData, father_contact: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-school-navy/5 outline-none focus:bg-white focus:border-school-navy/20 transition-all font-medium"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Mother's Name</label>
                                    <input
                                        type="text"
                                        placeholder="Full name of mother"
                                        value={formData.mother_name}
                                        onChange={(e) => setFormData({ ...formData, mother_name: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-school-navy/5 outline-none focus:bg-white focus:border-school-navy/20 transition-all"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Mother's Contact</label>
                                    <input
                                        type="tel"
                                        placeholder="Mother's phone number"
                                        value={formData.mother_contact}
                                        onChange={(e) => setFormData({ ...formData, mother_contact: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-school-navy/5 outline-none focus:bg-white focus:border-school-navy/20 transition-all font-medium"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Residential Address</label>
                                <textarea
                                    placeholder="Enter full permanent address"
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-school-navy/5 outline-none focus:bg-white focus:border-school-navy/20 transition-all min-h-[100px]"
                                    required
                                />
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="pt-8 border-t border-slate-50 flex items-center justify-between">
                            <span className={`text-sm font-bold ${message.includes('Error') ? 'text-red-500' : 'text-emerald-500'}`}>
                                {message}
                            </span>
                            <div className="flex gap-4">
                                <button
                                    type="button"
                                    onClick={() => setIsFormOpen(false)}
                                    className="px-8 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button type="submit" disabled={isSubmitting}
                                    className="px-10 py-3 bg-school-navy text-white rounded-xl text-sm font-bold hover:bg-school-blue transition-all shadow-lg shadow-school-navy/20 active:scale-95"
                                >
                                    Create Student Account
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;


