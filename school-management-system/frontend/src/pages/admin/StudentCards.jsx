import React, { useMemo, useState } from 'react';
import { useConfirm } from '../../context/ConfirmContext';
import api from '../../services/api';

const getInitials = (name) => {
    const parts = (name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'ST';
    return parts.length > 1 
        ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase() 
        : parts[0][0].toUpperCase();
};

const StudentCards = ({ students, refreshStudents }) => {
    const confirm = useConfirm();
    const [viewStudent, setViewStudent] = useState(null);
    const [editStudent, setEditStudent] = useState(null);
    const [editForm, setEditForm] = useState(null);
    const [busy, setBusy] = useState(false);

    const closeModal = () => {
        setViewStudent(null);
        setEditStudent(null);
        setEditForm(null);
    };

    const handleDelete = async (id) => {
        if (!(await confirm('Are you sure you want to delete this student record?'))) return;
        setBusy(true);
        try {
            await api.delete(`students/delete/${id}/`);
            await refreshStudents();
        } catch (e) {
            alert('Error deleting student');
        } finally {
            setBusy(false);
        }
    };

    const openEdit = (s) => {
        setEditStudent(s);
        setEditForm({ ...s });
    };

    const saveEdit = async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
            const { first_name, last_name, admission_number, email, bus_no, father_name, mother_name, father_contact, mother_contact } = editForm;
            await api.patch(`students/update/${editStudent.id}/`, {
                first_name,
                last_name,
                name: `${first_name || ''} ${last_name || ''}`.trim(),
                admission_number,
                email,
                bus_no,
                father_name,
                mother_name,
                father_contact,
                mother_contact,
            });
            await refreshStudents();
            closeModal();
        } catch (err) {
            alert('Error updating student');
        } finally {
            setBusy(false);
        }
    };

    const inputClasses = "w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-school-navy/5 outline-none focus:bg-white focus:border-school-navy/20 transition-all font-medium";
    const labelClasses = "text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1 mb-1 block";

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {students.map((s) => {
                    const initials = getInitials(s.name);
                    return (
                        <div 
                            key={s.id} 
                            className="group relative bg-white rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-school-blue/10 transition-all duration-500 overflow-hidden hover:-translate-y-1"
                        >
                            {/* Decorative Background Gradient */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-school-blue/5 to-transparent rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-700"></div>
                            
                            <div className="p-7 relative z-10">
                                <div className="flex items-start justify-between mb-6">
                                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-school-navy via-school-blue to-school-sky flex items-center justify-center text-white font-poppins font-bold text-xl shadow-xl shadow-school-blue/20 group-hover:rotate-3 transition-transform duration-500">
                                        {initials}
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <span className="px-3 py-1 bg-slate-50 border border-slate-100 text-[10px] font-bold text-slate-400 rounded-lg uppercase tracking-widest shadow-sm">
                                            {s.admission_number}
                                        </span>
                                        {s.category && (
                                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[9px] font-black rounded-md uppercase tracking-tighter border border-emerald-100/50">
                                                {s.category}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="space-y-1">
                                    <h3 className="font-poppins font-bold text-school-text text-lg group-hover:text-school-blue transition-colors truncate">
                                        {s.name}
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-school-blue/5 rounded-full border border-school-blue/10">
                                            <span className="w-1.5 h-1.5 rounded-full bg-school-blue animate-pulse"></span>
                                            <span className="text-[10px] font-bold text-school-blue uppercase tracking-wider">
                                                {s.class_name || 'Unassigned'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Action Bar */}
                            <div className="px-7 py-5 bg-slate-50/50 backdrop-blur-md border-t border-slate-100/50 flex items-center justify-between gap-3">
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setViewStudent(s)}
                                        className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-school-navy hover:border-school-navy/30 hover:shadow-lg hover:shadow-school-navy/10 transition-all flex items-center justify-center group/btn"
                                        title="View Profile"
                                    >
                                        <span className="group-hover/btn:scale-125 transition-transform">👤</span>
                                    </button>
                                    <button
                                        onClick={() => openEdit(s)}
                                        className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-emerald-500 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/10 transition-all flex items-center justify-center group/btn"
                                        title="Edit Student"
                                    >
                                        <span className="group-hover/btn:scale-125 transition-transform">✏️</span>
                                    </button>
                                </div>
                                <button
                                    onClick={() => handleDelete(s.id)}
                                    disabled={busy}
                                    className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-500/30 hover:shadow-lg hover:shadow-red-500/10 transition-all flex items-center justify-center group/btn disabled:opacity-50"
                                    title="Delete Record"
                                >
                                    <span className="group-hover/btn:scale-125 transition-transform">🗑️</span>
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Modal Redesign */}
            {(viewStudent || editStudent) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeModal}></div>
                    <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
                        <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-bold">{viewStudent ? 'Student Profile' : 'Edit Information'}</h3>
                                <p className="text-xs text-slate-400 mt-0.5">{viewStudent ? 'Comprehensive overview of student records' : 'Update the student profile details below'}</p>
                            </div>
                            <button onClick={closeModal} className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">✕</button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                            {viewStudent ? (
                                <div className="space-y-8">
                                    <div className="flex items-center gap-6 pb-8 border-b border-slate-100">
                                        <div className="w-20 h-20 rounded-3xl bg-school-navy flex items-center justify-center text-white text-3xl font-bold shadow-xl shadow-school-navy/20">
                                            {getInitials(viewStudent.name)}
                                        </div>
                                        <div>
                                            <h4 className="text-2xl font-bold text-school-text">{viewStudent.name}</h4>
                                            <p className="text-school-blue font-bold uppercase tracking-widest text-xs mt-1">{viewStudent.admission_number}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                        {[
                                            { label: 'Email Address', val: viewStudent.email },
                                            { label: 'Username', val: viewStudent.username },
                                            { label: 'Class / Section', val: viewStudent.class_name },
                                            { label: 'Date of Birth', val: viewStudent.dob },
                                            { label: 'Gender', val: viewStudent.gender },
                                            { label: 'Blood Group', val: viewStudent.blood_group },
                                            { label: 'Category', val: viewStudent.category },
                                            { label: 'Bus No', val: viewStudent.bus_no || 'N/A' },
                                            { label: 'Father\'s Name', val: viewStudent.father_name },
                                            { label: 'Father\'s Contact', val: viewStudent.father_contact },
                                            { label: 'Mother\'s Name', val: viewStudent.mother_name },
                                            { label: 'Mother\'s Contact', val: viewStudent.mother_contact },
                                        ].map((item, i) => (
                                            <div key={i} className="space-y-1">
                                                <p className={labelClasses}>{item.label}</p>
                                                <p className="font-bold text-school-text">{item.val || '—'}</p>
                                            </div>
                                        ))}
                                        <div className="md:col-span-2 space-y-1">
                                            <p className={labelClasses}>Residential Address</p>
                                            <p className="font-bold text-school-text leading-relaxed">{viewStudent.address || '—'}</p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <form onSubmit={saveEdit} className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div><label className={labelClasses}>First Name</label><input type="text" value={editForm.first_name} onChange={e => setEditForm({...editForm, first_name: e.target.value})} className={inputClasses} /></div>
                                        <div><label className={labelClasses}>Last Name</label><input type="text" value={editForm.last_name} onChange={e => setEditForm({...editForm, last_name: e.target.value})} className={inputClasses} /></div>
                                        <div><label className={labelClasses}>Admission No</label><input type="text" value={editForm.admission_number} onChange={e => setEditForm({...editForm, admission_number: e.target.value})} className={inputClasses} /></div>
                                        <div><label className={labelClasses}>Email</label><input type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} className={inputClasses} /></div>
                                        <div><label className={labelClasses}>Bus No.</label><input type="text" value={editForm.bus_no} onChange={e => setEditForm({...editForm, bus_no: e.target.value})} className={inputClasses} /></div>
                                        <div><label className={labelClasses}>Father's Name</label><input type="text" value={editForm.father_name} onChange={e => setEditForm({...editForm, father_name: e.target.value})} className={inputClasses} /></div>
                                        <div><label className={labelClasses}>Father's Contact</label><input type="text" value={editForm.father_contact} onChange={e => setEditForm({...editForm, father_contact: e.target.value})} className={inputClasses} /></div>
                                        <div><label className={labelClasses}>Mother's Name</label><input type="text" value={editForm.mother_name} onChange={e => setEditForm({...editForm, mother_name: e.target.value})} className={inputClasses} /></div>
                                        <div><label className={labelClasses}>Mother's Contact</label><input type="text" value={editForm.mother_contact} onChange={e => setEditForm({...editForm, mother_contact: e.target.value})} className={inputClasses} /></div>
                                    </div>
                                    <div className="pt-6 border-t border-slate-50 flex justify-end gap-3">
                                        <button type="button" onClick={closeModal} className="px-6 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-colors">Cancel</button>
                                        <button type="submit" disabled={busy} className="px-8 py-2.5 bg-school-navy text-white text-xs font-bold rounded-xl shadow-lg shadow-school-navy/10 hover:bg-school-blue transition-all disabled:opacity-50">Save Changes</button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentCards;

