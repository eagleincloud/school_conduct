import React, { useState, useEffect, useMemo } from 'react';
import { useConfirm } from '../../context/ConfirmContext';
import api from '../../services/api';
import authService from '../../services/authService';
import { useStudent } from '../../context/StudentContext';
import {
    Calendar,
    MapPin,
    User as UserIcon,
    Loader2,
    Plus,
    Edit2,
    Trash2,
    X,
    Save,
    Filter,
    Clock,
    BookOpen,
    DoorOpen
} from 'lucide-react';

const DAYS = [
    { id: 1, name: 'Monday', short: 'Mon' },
    { id: 2, name: 'Tuesday', short: 'Tue' },
    { id: 3, name: 'Wednesday', short: 'Wed' },
    { id: 4, name: 'Thursday', short: 'Thu' },
    { id: 5, name: 'Friday', short: 'Fri' },
    { id: 6, name: 'Saturday', short: 'Sat' },
];

const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

const colors = {
    primary: '#2563eb',
    primaryLight: '#eff6ff',
    secondary: '#0f172a',
    success: '#10b981',
    successLight: '#ecfdf5',
    warning: '#f59e0b',
    warningLight: '#fffbeb',
    danger: '#ef4444',
    dangerLight: '#fef2f2',
    border: '#e2e8f0',
    text: '#1e293b',
    textMuted: '#64748b',
    white: '#ffffff',
    bg: '#f8fafc',
};

const TimetableGrid = ({ entries, isAdmin, isEditMode, handleCellClick, shift }) => {
    const currentDayNum = new Date().getDay();
    // Default to Monday (1) if today is Sunday (0)
    const initialDay = currentDayNum === 0 ? 1 : (currentDayNum > 6 ? 6 : currentDayNum);
    const [activeDayTab, setActiveDayTab] = useState(initialDay);
    
    const adjustedCurrentDay = currentDayNum === 0 ? 7 : currentDayNum;
    
    const periods = PERIODS;

    const gridData = useMemo(() => {
        const data = {};
        DAYS.forEach(day => {
            data[day.id] = entries.filter(e => e.day === day.id && (e.shift_ref === shift?.id || e.shift === shift?.name.toLowerCase()));
        });
        return data;
    }, [entries, shift]);

    const mobileRows = useMemo(() => {
        return DAYS.map(day => ({
            ...day,
            entries: periods.map((period) => {
                const entry = gridData[day.id]?.find(e => (e.period_number || e.period) === period);
                return { period, entry };
            }),
        }));
    }, [gridData, periods]);

    if (!shift) {
        return (
            <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-12 text-center">
                <p className="text-slate-500 font-medium">Loading schedule requirements...</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            {/* Mobile Day Tabs Selector */}
            <div className="md:hidden p-3 bg-slate-50 border-b border-slate-100">
                <div className="timetable-day-tabs">
                    {DAYS.map(day => (
                        <button
                            key={day.id}
                            type="button"
                            onClick={() => setActiveDayTab(day.id)}
                            className={`timetable-day-tab-btn ${
                                activeDayTab === day.id
                                    ? 'bg-school-blue text-white shadow-md shadow-blue-500/20'
                                    : 'text-slate-600 bg-white border border-slate-200/60'
                            }`}
                        >
                            {day.short}
                        </button>
                    ))}
                </div>
            </div>

            <div className="md:hidden divide-y divide-slate-100">
                {mobileRows
                    .filter(day => day.id === activeDayTab)
                    .map(day => (
                        <section key={day.id} className="bg-white">
                            <div className="sticky top-0 z-10 flex items-center justify-between bg-white/95 px-4 py-3 backdrop-blur border-b border-slate-100">
                                <div>
                                    <h3 className={`text-sm font-black uppercase tracking-wide ${day.id === adjustedCurrentDay ? 'text-school-blue' : 'text-slate-800'}`}>
                                        {day.name}
                                    </h3>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                        {shift.name} shift
                                    </p>
                                </div>
                                {day.id === adjustedCurrentDay && (
                                    <span className="rounded-full bg-school-blue/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-school-blue">
                                        Today
                                    </span>
                                )}
                            </div>

                            <div className="space-y-3 p-3">
                                {day.entries.filter(({ entry }) => entry || (isEditMode && isAdmin)).length > 0 ? (
                                    day.entries
                                        .filter(({ entry }) => entry || (isEditMode && isAdmin))
                                        .map(({ period, entry }) => (
                                            <button
                                                type="button"
                                                key={`${day.id}-${period}`}
                                                onClick={() => handleCellClick(day.id, period)}
                                                className={`w-full rounded-2xl border p-3 text-left transition-all ${entry
                                                    ? 'border-slate-100 bg-white shadow-sm active:scale-[0.99]'
                                                    : 'border-dashed border-slate-200 bg-slate-50/70 text-slate-400'
                                                    }`}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                            Period {period}
                                                        </p>
                                                        <h4 className="mt-1 truncate text-sm font-black text-slate-800">
                                                            {entry?.subject || 'Tap to add class'}
                                                        </h4>
                                                    </div>
                                                    {entry ? (
                                                        <span className="shrink-0 rounded-xl bg-school-blue/5 px-2 py-1 text-[10px] font-black text-school-blue">
                                                            {entry.start_time_display?.split(' ')[0] || entry.start_time}
                                                        </span>
                                                    ) : (
                                                        <Plus className="mt-1 h-4 w-4 shrink-0 text-school-blue" />
                                                    )}
                                                </div>

                                                {entry && (
                                                    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-bold text-slate-500">
                                                        <span className="truncate">{entry.class_name}-{entry.section}</span>
                                                        <span className="truncate text-right">RM {entry.room || '-'}</span>
                                                        <span className="col-span-2 truncate text-slate-600">{entry.teacher_name || 'Teacher not assigned'}</span>
                                                    </div>
                                                )}
                                            </button>
                                        ))
                                ) : (
                                    <div className="text-center py-10 px-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                                        <p className="text-slate-400 font-medium text-xs">No classes scheduled for this day</p>
                                    </div>
                                )}
                            </div>
                        </section>
                    ))}
            </div>

            <div className="hidden md:block overflow-x-auto">
                <div className="min-w-[1000px]">
                    <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50">
                        <div className="p-4 text-center border-r border-slate-100 bg-slate-100/30">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Period</span>
                        </div>
                        {DAYS.map(day => (
                            <div
                                key={day.id}
                                className={`p-4 text-center border-r border-slate-100 last:border-0 ${day.id === adjustedCurrentDay ? 'bg-school-blue/5' : ''
                                    }`}
                            >
                                <span className={`text-xs font-bold uppercase tracking-wider ${day.id === adjustedCurrentDay ? 'text-school-blue' : 'text-slate-500'
                                    }`}>
                                    {day.name}
                                </span>
                            </div>
                        ))}
                    </div>

                    <div className="relative">
                        {periods.map((pNum) => {
                            return (
                                <div key={pNum} className="grid grid-cols-7 border-b border-slate-100 last:border-0">
                                    <div className="p-4 flex flex-col items-center justify-center border-r border-slate-100 bg-slate-50/30">
                                        <span className="text-[10px] font-black text-slate-400">P{pNum}</span>
                                    </div>

                                    {DAYS.map(day => {
                                        const entry = gridData[day.id]?.find(
                                            e => (e.period_number || e.period) === pNum
                                        );
                                        return (
                                            <div
                                                key={`${day.id}-${pNum}`}
                                                onClick={() => handleCellClick(day.id, pNum)}
                                                className={`p-2 border-r border-slate-100 last:border-0 relative h-[140px] transition-all cursor-pointer ${day.id === adjustedCurrentDay ? 'bg-school-blue/[0.01]' : ''} ${isEditMode ? 'hover:bg-blue-50/50' : 'hover:bg-slate-50/50'}`}
                                            >
                                                {entry ? (
                                                    <div className="h-full w-full p-3 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-lg hover:border-school-blue/20 transition-all group flex flex-col justify-between relative overflow-hidden">
                                                        <div>
                                                            <div className="flex items-start justify-between mb-1.5 gap-2">
                                                                <span className="px-1.5 py-0.5 rounded-lg bg-school-blue/5 text-[10px] font-black text-school-blue uppercase tracking-wider truncate max-w-[70%]">
                                                                    {entry.subject}
                                                                </span>
                                                                <div className="flex flex-col items-end">
                                                                    <span className="text-[10px] font-bold text-slate-700 leading-none">
                                                                        {entry.start_time_display?.split(' ')[0]}
                                                                    </span>
                                                                    <span className="text-[7px] font-black text-slate-300 uppercase mt-0.5">START</span>
                                                                </div>
                                                            </div>
                                                            <h4 className="text-xs font-black text-slate-800 tracking-tight">
                                                                {entry.class_name}-{entry.section}
                                                            </h4>
                                                        </div>

                                                        <div className="space-y-2 pt-2 border-t border-slate-50">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-5 h-5 rounded-full bg-slate-50 flex items-center justify-center">
                                                                    <UserIcon className="w-2.5 h-2.5 text-slate-400" />
                                                                </div>
                                                                <span className="text-[10px] font-bold text-slate-600 truncate">{entry.teacher_name}</span>
                                                            </div>
                                                            
                                                            <div className="flex items-center justify-between gap-1">
                                                                <div className="flex items-center gap-2 bg-slate-50/50 px-1.5 py-0.5 rounded-md border border-slate-100/50">
                                                                    <MapPin className="w-2.5 h-2.5 text-slate-400" />
                                                                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">RM {entry.room}</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {isEditMode && isAdmin && (
                                                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all transform translate-y-1 group-hover:translate-y-0">
                                                                <div className="p-1.5 bg-school-blue text-white rounded-lg shadow-xl shadow-school-blue/30 scale-90">
                                                                    <Edit2 className="w-3 h-3" />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    isEditMode && isAdmin && (
                                                        <div className="h-full w-full rounded-xl border border-dashed border-slate-200 flex items-center justify-center group/add opacity-40 hover:opacity-100 hover:border-school-blue hover:bg-school-blue/[0.02] transition-all">
                                                            <Plus className="w-5 h-5 text-slate-300 group-hover/add:text-school-blue transition-colors" />
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

const TimeTable = () => {
    const confirm = useConfirm();
    const { selectedStudentId } = useStudent();
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const [shifts, setShifts] = useState([]);
    const [selectedShiftId, setSelectedShiftId] = useState('');
    const [selectedTeacherId, setSelectedTeacherId] = useState('');
    const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);

    const selectedShift = useMemo(() => shifts.find(sh => sh.id === parseInt(selectedShiftId)), [shifts, selectedShiftId]);

    const [selectedSectionId, setSelectedSectionId] = useState('');
    const [filters, setFilters] = useState({ class_name: '', section: '' });

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEntry, setEditingEntry] = useState(null);
    const [viewingEntry, setViewingEntry] = useState(null);

    const [teachers, setTeachers] = useState([]);
    const [sections, setSections] = useState([]);
    const [subjects, setSubjects] = useState([]);

    const { role } = authService.getCurrentUser();
    const isAdmin = role === 'admin';
    const isTeacher = role === 'teacher';
    const isStudent = role === 'student';

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            await fetchMetaData();
            if (isStudent || isTeacher) {
                await fetchTimetable();
            }
            setLoading(false);
        };
        init();
    }, [selectedStudentId]);

    useEffect(() => {
        if (isAdmin && (filters.class_name || selectedTeacherId)) {
            fetchTimetable();
        }
    }, [filters, selectedShiftId, selectedTeacherId]);

    const fetchTimetable = async () => {
        try {
            let url = 'timetable/';
            const query = new URLSearchParams();
            if (selectedShiftId) query.set('shift_id', selectedShiftId);
            if (selectedTeacherId) query.set('teacher_id', selectedTeacherId);
            
            if (isAdmin && filters.class_name && filters.section) {
                query.set('class_name', filters.class_name);
                query.set('section', filters.section);
            }
            url += `?${query.toString()}`;
            const response = await api.get(url);
            setEntries(response.data || []);
            setError(null);
        } catch (err) {
            console.error('Error fetching timetable:', err);
            setError('Failed to load timetable.');
        }
    };

    const fetchMetaData = async () => {
        try {
            const promises = [
                api.get('timetable/shifts/'),
                api.get('timetable/user-shift/')
            ];

            if (isAdmin) {
                promises.push(api.get('teachers/'));
                promises.push(api.get('classes/admin-sections/'));
                promises.push(api.get('subjects/'));
            }

            const results = await Promise.all(promises);
            const [shRes, usRes] = results;
            
            setShifts(shRes.data || []);

            if (isAdmin) {
                setTeachers(results[2]?.data || []);
                setSections(results[3]?.data || []);
                setSubjects(results[4]?.data || []);
            }
            
            if (usRes.data?.shift_id) {
                const sId = usRes.data.shift_id.toString();
                setSelectedShiftId(sId);
            } else if (shRes.data?.length > 0 && !selectedShiftId) {
                setSelectedShiftId(shRes.data[0].id.toString());
            }
        } catch (err) {
            console.error('Error fetching meta data:', err);
        }
    };

    const handleAdminFilterChange = (e) => {
        const sectionId = e.target.value;
        setSelectedSectionId(sectionId);
        const section = sections.find(s => s.id === parseInt(sectionId));
        if (section) {
            setFilters({ class_name: section.class_name, section: section.section_name });
        } else {
            setFilters({ class_name: '', section: '' });
        }
    };

    const handleCellClick = (dayId, pNum) => {
        const existing = entries.find(
            e =>
                e.day === dayId &&
                (e.shift_ref === parseInt(selectedShiftId) || e.shift === selectedShift?.name?.toLowerCase()) &&
                (e.period_number || e.period) === pNum
        );

        if (isAdmin && isEditMode) {
            if (existing) {
                openModal(existing);
            } else {
                openModal({
                    day: dayId,
                    shift_ref: parseInt(selectedShiftId),
                    period_number: pNum,
                    class_name: filters.class_name,
                    section: filters.section
                });
            }
        } else if (existing) {
            // View Mode for everyone
            setViewingEntry(existing);
        }
    };

    const openModal = (entry = null) => {
        setEditingEntry(entry);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingEntry(null);
    };

    const handleDelete = async (id) => {
        if (!(await confirm('Are you sure you want to delete this entry?'))) return;
        try {
            await api.delete(`timetable/${id}/`);
            fetchTimetable();
            closeModal();
        } catch (err) {
            alert('Failed to delete entry');
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-10">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-school-blue/10 flex items-center justify-center">
                        <Calendar className="w-6 h-6 text-school-blue" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Time Table</h1>
                        <p className="text-slate-500 font-medium text-sm">Weekly School Schedule</p>
                    </div>
                </div>

                <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
                    <div className="inline-flex max-w-full items-center overflow-x-auto rounded-xl border border-slate-200 bg-white p-1">
                        {shifts.map(opt => (
                            <button
                                key={opt.id}
                                onClick={() => setSelectedShiftId(opt.id.toString())}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedShiftId === opt.id.toString()
                                    ? 'bg-school-blue text-white'
                                    : 'text-slate-600 hover:text-school-blue'
                                    }`}
                            >
                                {opt.name}
                            </button>
                        ))}
                    </div>

                    {isAdmin && (
                        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:w-auto lg:items-center">
                            <div className="relative min-w-0">
                                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                    <UserIcon className="w-4 h-4 text-slate-400" />
                                </div>
                                <select
                                    value={selectedTeacherId}
                                    onChange={(e) => setSelectedTeacherId(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 outline-none focus:border-school-blue focus:ring-4 focus:ring-school-blue/5 transition-all appearance-none lg:min-w-[160px]"
                                >
                                    <option value="">-- All Teachers --</option>
                                    {teachers.map(t => (
                                        <option key={t.user_id} value={t.user_id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="relative min-w-0">
                                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                    <Filter className="w-4 h-4 text-slate-400" />
                                </div>
                                <select
                                    value={selectedSectionId}
                                    onChange={handleAdminFilterChange}
                                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 outline-none focus:border-school-blue focus:ring-4 focus:ring-school-blue/5 transition-all appearance-none lg:min-w-[200px]"
                                >
                                    <option value="">-- Choose Class-Section --</option>
                                    {sections.map(s => (
                                        <option key={s.id} value={s.id}>{s.class_name} - {s.section_name}</option>
                                    ))}
                                </select>
                            </div>

                            <button
                                onClick={() => setIsEditMode(!isEditMode)}
                                disabled={!filters.class_name && !selectedTeacherId}
                                className={`flex w-full items-center justify-center gap-2 px-4 py-2 rounded-xl border transition-all font-bold text-sm sm:col-span-2 lg:w-auto ${isEditMode
                                    ? 'bg-school-blue text-white border-school-blue shadow-lg shadow-school-blue/20'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-school-blue hover:text-school-blue'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                <Edit2 className="w-4 h-4" />
                                {isEditMode ? 'Finish' : 'Edit'}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 text-sm font-medium">
                    {error}
                </div>
            )}

            {isAdmin && !filters.class_name && !selectedTeacherId ? (
                <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-12 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Filter className="w-8 h-8 text-slate-300" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-700">Select a Class & Section</h3>
                    <p className="text-slate-500 text-sm mt-1 max-w-xs mx-auto">Please use the filters above to view and manage class schedules.</p>
                </div>
            ) : loading ? (
                <div className="flex flex-col items-center justify-center h-[40vh] gap-4">
                    <Loader2 className="w-10 h-10 text-school-blue animate-spin" />
                    <p className="text-slate-500 font-medium">Loading schedule...</p>
                </div>
            ) : (
                <TimetableGrid
                    entries={entries}
                    isAdmin={isAdmin}
                    isEditMode={isEditMode}
                    handleCellClick={handleCellClick}
                    shift={selectedShift}
                />
            )}

            {isShiftModalOpen && (
                <ShiftManager
                    shifts={shifts}
                    onClose={() => { setIsShiftModalOpen(false); fetchMetaData(); }}
                />
            )}

            {isModalOpen && (
                <AdminModal
                    entry={editingEntry}
                    onClose={closeModal}
                    onSuccess={() => { fetchTimetable(); closeModal(); }}
                    onDelete={handleDelete}
                    meta={{ teachers, sections, subjects, shifts }}
                    selectedShift={selectedShift}
                />
            )}

            {viewingEntry && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in zoom-in duration-300">
                    <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden relative border border-slate-100">
                        <button onClick={() => setViewingEntry(null)} className="absolute top-6 right-6 p-2.5 bg-slate-50 hover:bg-slate-100 rounded-2xl text-slate-400 transition-all z-10">
                            <X className="w-5 h-5" />
                        </button>

                        <div className="h-32 bg-school-blue/5 flex items-center justify-center relative">
                            <div className="w-16 h-16 rounded-3xl bg-white shadow-xl shadow-school-blue/10 flex items-center justify-center border border-slate-50">
                                <Clock className="w-7 h-7 text-school-blue" />
                            </div>
                        </div>

            <div className="view-modal-content p-6 pt-2">
                            <div className="text-center mb-5">
                                <h3 className="text-xl font-black text-slate-800 tracking-tight">{viewingEntry.subject}</h3>
                                <p className="text-slate-500 font-bold mt-0.5 uppercase tracking-widest text-[9px]">Period {viewingEntry.period_number || viewingEntry.period}</p>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50/50 border border-slate-100/50">
                                    <div className="w-8 h-8 rounded-xl bg-white shadow-sm flex items-center justify-center">
                                        <BookOpen className="w-4 h-4 text-school-blue" />
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Classroom</p>
                                        <p className="font-bold text-slate-700 text-sm">{viewingEntry.class_name} - {viewingEntry.section}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50/50 border border-slate-100/50">
                                    <div className="w-8 h-8 rounded-xl bg-white shadow-sm flex items-center justify-center">
                                        <UserIcon className="w-4 h-4 text-school-blue" />
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Instructor</p>
                                        <p className="font-bold text-slate-700 text-sm">{viewingEntry.teacher_name}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50/50 border border-slate-100/50">
                                        <div className="w-8 h-8 rounded-xl bg-white shadow-sm flex items-center justify-center">
                                            <DoorOpen className="w-4 h-4 text-school-blue" />
                                        </div>
                                        <div>
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Room</p>
                                            <p className="font-bold text-slate-700 text-sm">{viewingEntry.room}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50/50 border border-slate-100/50">
                                        <div className="w-8 h-8 rounded-xl bg-white shadow-sm flex items-center justify-center">
                                            <Calendar className="w-4 h-4 text-school-blue" />
                                        </div>
                                        <div>
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Day</p>
                                            <p className="font-bold text-slate-700 text-sm">{DAYS.find(d => d.id === viewingEntry.day)?.name}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 rounded-3xl bg-school-blue/5 border border-school-blue/10 flex items-center justify-between">
                                    <div className="text-center flex-1">
                                        <p className="text-[8px] font-black text-school-blue uppercase tracking-widest mb-0.5 opacity-60">Starts at</p>
                                        <p className="text-lg font-black text-school-blue">{viewingEntry.start_time_display}</p>
                                    </div>
                                    <div className="w-px h-8 bg-school-blue/20"></div>
                                    <div className="text-center flex-1">
                                        <p className="text-[8px] font-black text-school-blue uppercase tracking-widest mb-0.5 opacity-60">Ends at</p>
                                        <p className="text-lg font-black text-school-blue">{viewingEntry.end_time_display}</p>
                                    </div>
                                </div>
                            </div>

                            <button onClick={() => setViewingEntry(null)} className="w-full mt-6 py-3 bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-900 transition-all shadow-xl shadow-slate-200">
                                Close Details
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const AdminModal = ({ entry, onClose, onSuccess, onDelete, meta, selectedShift }) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        class_name: entry?.class_name || '',
        section: entry?.section || '',
        subject: entry?.subject || '',
        teacher: entry?.teacher || '',
        day: entry?.day || 1,
        shift_ref: entry?.shift_ref || selectedShift?.id || '',
        period_number: entry?.period_number || entry?.period || 1,
        start_time: entry?.start_time || '00:00:00',
        end_time: entry?.end_time || '00:00:00',
        room: entry?.room || ''
    });

    const periods = [1, 2, 3, 4, 5, 6, 7, 8];

    useEffect(() => {
        if (!entry?.id && formData.period_number && formData.start_time === '00:00:00') {
            const pNum = formData.period_number;
            const isMorning = selectedShift?.name.toLowerCase().includes('morning') || formData.shift_ref === 1;
            
            const morning_map = {
                1: ["08:00", "08:30"],
                2: ["08:30", "09:00"],
                3: ["09:00", "09:30"],
                4: ["10:00", "10:30"],
                5: ["10:30", "11:00"],
                6: ["11:00", "11:30"],
            };
            const afternoon_map = {
                1: ["13:00", "13:30"],
                2: ["13:30", "14:00"],
                3: ["14:00", "14:30"],
                4: ["15:00", "15:30"],
                5: ["15:30", "16:00"],
                6: ["16:00", "16:30"],
            };

            const map = isMorning ? morning_map : afternoon_map;
            if (map[pNum]) {
                setFormData(prev => ({ ...prev, start_time: map[pNum][0], end_time: map[pNum][1] }));
            }
        }
    }, [formData.period_number, entry?.id]);

    const filteredSubjects = useMemo(() => {
        if (!formData.class_name) return [];
        return (meta.subjects || []).filter(s => s.class_name === formData.class_name);
    }, [meta.subjects, formData.class_name]);

    const handleSectionChange = (e) => {
        const sectionId = e.target.value;
        const section = meta.sections.find(s => s.id === parseInt(sectionId));
        if (section) {
            setFormData({
                ...formData,
                class_name: section.class_name,
                section: section.section_name,
                room: section.room_number || formData.room,
                shift_ref: section.assigned_shift || formData.shift_ref,
                subject: '' // Clear subject when class changes
            });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (entry?.id) {
                await api.put(`timetable/${entry.id}/`, formData);
            } else {
                await api.post('timetable/', formData);
            }
            onSuccess();
        } catch (err) {
            console.error('Save error:', err.response?.data);
            alert('Failed to save entry. Check if entry already exists.');
        } finally {
            setLoading(false);
        }
    };

    const isNew = !entry?.id;

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-3 sm:p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="my-auto bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-100">
                <div className="p-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                    <h3 className="text-base font-bold text-slate-800">
                        {isNew ? 'New Entry' : 'Edit Entry'}
                    </h3>
                    <button onClick={onClose} className="p-1.5 hover:bg-white rounded-xl text-slate-400 transition-all">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="max-h-[calc(100dvh-7rem)] overflow-y-auto p-4 sm:p-5 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Day</label>
                            <select
                                value={formData.day}
                                onChange={e => setFormData({ ...formData, day: parseInt(e.target.value) })}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-school-blue focus:ring-2 focus:ring-school-blue/10 transition-all"
                            >
                                {DAYS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Shift</label>
                            <select
                                value={formData.shift_ref}
                                onChange={e => setFormData({ ...formData, shift_ref: parseInt(e.target.value) })}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-school-blue focus:ring-2 focus:ring-school-blue/10 transition-all"
                                required
                            >
                                <option value="">-- Choose Shift --</option>
                                {meta.shifts?.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Period No.</label>
                            <select
                                value={formData.period_number}
                                onChange={e => setFormData({ ...formData, period_number: parseInt(e.target.value, 10) })}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-school-blue focus:ring-2 focus:ring-school-blue/10 transition-all"
                            >
                                {periods.map(p => (
                                    <option key={p} value={p}>Period {p}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Period Duration</label>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-0.5">
                                    <span className="text-[8px] font-bold text-slate-400 pl-1">FROM</span>
                                    <input
                                        type="time"
                                        value={formData.start_time.substring(0, 5)}
                                        onChange={e => setFormData(p => ({ ...p, start_time: e.target.value }))}
                                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-bold text-slate-700 outline-none focus:border-school-blue focus:ring-2 focus:ring-school-blue/10 transition-all"
                                    />
                                </div>
                                <div className="space-y-0.5">
                                    <span className="text-[8px] font-bold text-slate-400 pl-1">TO</span>
                                    <input
                                        type="time"
                                        value={formData.end_time.substring(0, 5)}
                                        onChange={e => setFormData(p => ({ ...p, end_time: e.target.value }))}
                                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-bold text-slate-700 outline-none focus:border-school-blue focus:ring-2 focus:ring-school-blue/10 transition-all"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Class & Section</label>
                        <select
                            onChange={handleSectionChange}
                            value={meta.sections.find(s => s.class_name === formData.class_name && s.section_name === formData.section)?.id || ''}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-school-blue focus:ring-2 focus:ring-school-blue/10 transition-all"
                            required
                        >
                            <option value="">-- Choose Class-Section --</option>
                            {meta.sections.map(s => (
                                <option key={s.id} value={s.id}>{s.class_name} - {s.section_name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Subject</label>
                            <input
                                list="subject-options"
                                value={formData.subject}
                                onChange={e => setFormData({ ...formData, subject: e.target.value })}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-school-blue focus:ring-2 focus:ring-school-blue/10 transition-all"
                                placeholder={filteredSubjects.length > 0 ? "Select Subject..." : "No subjects found for this class"}
                                required
                            />
                            <datalist id="subject-options">
                                {filteredSubjects.map(s => <option key={s.id} value={s.name} />)}
                            </datalist>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Room</label>
                            <input
                                type="text"
                                value={formData.room}
                                onChange={e => setFormData({ ...formData, room: e.target.value })}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-school-blue focus:ring-2 focus:ring-school-blue/10 transition-all"
                                placeholder="101, Lab A"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Teacher</label>
                        <select
                            value={formData.teacher}
                            onChange={e => setFormData({ ...formData, teacher: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-school-blue focus:ring-2 focus:ring-school-blue/10 transition-all"
                            required
                        >
                            <option value="">-- Assign Teacher --</option>
                            {meta.teachers.map(t => <option key={t.user_id} value={t.user_id}>{t.name} ({t.employee_id})</option>
                            )}
                        </select>
                    </div>

                    <div className="pt-2 flex flex-col gap-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-2.5 bg-school-blue text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 shadow-lg shadow-school-blue/20 transition-all disabled:opacity-50 text-sm"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {isNew ? 'Create Entry' : 'Save Changes'}
                        </button>

                        {!isNew && (
                            <button
                                type="button"
                                onClick={() => onDelete(entry.id)}
                                className="w-full py-2 bg-red-50 text-red-600 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-100 transition-all text-xs"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete Entry
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
};

const ShiftManager = ({ shifts, onClose }) => {
    const [loading, setLoading] = useState(false);
    const [editingShift, setEditingShift] = useState(null);
    const [form, setForm] = useState({ name: '', start_time: '08:00', end_time: '14:00' });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (editingShift) {
                await api.put(`timetable/shifts/${editingShift.id}/`, form);
            } else {
                await api.post('timetable/shifts/', form);
            }
            setForm({ name: '', start_time: '08:00', end_time: '14:00' });
            setEditingShift(null);
            onClose();
        } catch (err) {
            alert('Failed to save shift');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-start justify-center overflow-y-auto p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="my-auto bg-white w-full max-w-lg rounded-3xl shadow-2xl p-4 sm:p-6">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Manage Shifts</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-xl transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 mb-8 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Shift Name</label>
                            <input
                                value={form.name}
                                onChange={e => setForm({ ...form, name: e.target.value })}
                                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold"
                                placeholder="Morning, Evening..."
                                required
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Start Time</label>
                            <input
                                type="time"
                                value={form.start_time}
                                onChange={e => setForm({ ...form, start_time: e.target.value })}
                                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold"
                                required
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">End Time</label>
                            <input
                                type="time"
                                value={form.end_time}
                                onChange={e => setForm({ ...form, end_time: e.target.value })}
                                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold"
                                required
                            />
                        </div>
                    </div>
                    <button type="submit" disabled={loading} className="w-full py-3 bg-school-blue text-white rounded-xl font-bold shadow-lg shadow-school-blue/20">
                        {loading ? 'Saving...' : editingShift ? 'Update Shift' : 'Add New Shift'}
                    </button>
                </form>

                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                    {shifts.map(s => (
                        <div key={s.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl group hover:border-school-blue/30 transition-all">
                            <div>
                                <h4 className="font-black text-slate-800 uppercase tracking-tight text-sm">{s.name}</h4>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{s.start_time} - {s.end_time}</p>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                <button onClick={() => { setEditingShift(s); setForm({ name: s.name, start_time: s.start_time, end_time: s.end_time }); }} className="p-2 text-slate-400 hover:text-school-blue hover:bg-school-blue/10 rounded-xl transition-all"><Edit2 className="w-4 h-4" /></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default TimeTable;
