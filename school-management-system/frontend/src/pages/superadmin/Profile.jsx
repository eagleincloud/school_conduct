import React, { useState, useEffect, useRef } from 'react';
import { useConfirm } from '../../context/ConfirmContext';
import api from '../../services/api';
import authService from '../../services/authService';
import { 
    Camera, 
    Trash2, 
    Maximize2, 
    Shield, 
    User, 
    Mail, 
    Phone, 
    Globe, 
    CheckCircle,
    X,
    Loader2,
    Edit2
} from 'lucide-react';

import toast from 'react-hot-toast';

const SuperAdminProfile = () => {
    const confirm = useConfirm();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [showFullPhoto, setShowFullPhoto] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editForm, setEditForm] = useState({ name: '', email: '', phone: '' });
    const fileInputRef = useRef(null);

    const fetchProfile = async () => {
        try {
            const res = await api.get('auth/profile/');
            setProfile(res.data);
            setEditForm({
                name: res.data.name || '',
                email: res.data.email || '',
                phone: res.data.phone || ''
            });
        } catch (err) {
            console.error('Error fetching profile:', err);
            toast.error('Failed to load profile');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProfile();
    }, []);

    const handlePhotoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('profile_photo', file);

        setUpdating(true);
        try {
            await api.patch('auth/update-profile/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.success('Profile photo updated');
            fetchProfile();
        } catch (err) {
            console.error('Upload error:', err);
            toast.error('Failed to upload photo');
        } finally {
            setUpdating(false);
        }
    };

    const handleDeletePhoto = async () => {
        if (!(await confirm('Delete your profile photo?'))) return;

        setUpdating(true);
        try {
            const formData = new FormData();
            formData.append('delete_photo', 'true');
            await api.patch('auth/update-profile/', formData);
            toast.success('Photo removed');
            fetchProfile();
        } catch (err) {
            toast.error('Failed to remove photo');
        } finally {
            setUpdating(false);
        }
    };

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setUpdating(true);
        try {
            await api.patch('auth/update-profile/', editForm);
            toast.success('Profile updated successfully');
            setIsEditModalOpen(false);
            fetchProfile();
        } catch (err) {
            console.error('Update error:', err);
            toast.error(err.response?.data?.email?.[0] || 'Failed to update profile');
        } finally {
            setUpdating(false);
        }
    };

    const getInitials = (name) => {
        return (name || 'S').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                <p className="text-slate-500 font-medium">Synchronizing Secure Profile...</p>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto py-10 px-6 animate-in fade-in slide-in-from-bottom-4 duration-700 font-inter">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-4">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <Shield className="w-8 h-8 text-blue-600" />
                        Root Administrator
                    </h1>
                    <p className="text-slate-500 mt-2 text-lg font-medium">Global Platform Infrastructure Controller</p>
                </div>
                <div className="flex flex-col items-end gap-3">
                    <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-2xl border border-blue-100 text-xs font-black uppercase tracking-widest">
                        <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></div>
                        System Status: Secure
                    </div>
                    <button 
                        onClick={() => setIsEditModalOpen(true)}
                        className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl shadow-slate-900/10 flex items-center gap-2"
                    >
                        <Edit2 className="w-4 h-4" /> Edit Profile
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Profile Card */}
                <div className="lg:col-span-4">
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-slate-200/50 p-8 flex flex-col items-center sticky top-10">
                        <div className="relative group">
                            <div className="w-48 h-48 rounded-[3rem] bg-slate-900 overflow-hidden flex items-center justify-center text-white text-6xl font-black shadow-2xl shadow-slate-900/20 group-hover:shadow-blue-500/20 transition-all duration-500 ring-4 ring-white ring-offset-4 ring-offset-slate-50">
                                {profile?.profile_photo ? (
                                    <img 
                                        src={profile.profile_photo} 
                                        alt="Profile" 
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                    />
                                ) : (
                                    getInitials(profile?.name || profile?.username)
                                )}
                                {updating && (
                                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center">
                                        <Loader2 className="w-8 h-8 text-white animate-spin" />
                                    </div>
                                )}
                            </div>

                            {/* Hover Actions */}
                            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-300 rounded-[3rem] flex items-center justify-center gap-3">
                                {profile?.profile_photo && (
                                    <button 
                                        onClick={() => setShowFullPhoto(true)}
                                        className="p-3 bg-white/20 hover:bg-white/40 text-white rounded-2xl backdrop-blur-md transition-all"
                                        title="View Full Photo"
                                    >
                                        <Maximize2 className="w-5 h-5" />
                                    </button>
                                )}
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-3 bg-white text-slate-900 rounded-2xl shadow-lg hover:scale-110 transition-all"
                                    title="Change Photo"
                                >
                                    <Camera className="w-5 h-5" />
                                </button>
                                {profile?.profile_photo && (
                                    <button 
                                        onClick={handleDeletePhoto}
                                        className="p-3 bg-red-500 text-white rounded-2xl shadow-lg hover:bg-red-600 hover:scale-110 transition-all"
                                        title="Remove Photo"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                        </div>

                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handlePhotoUpload} 
                            className="hidden" 
                            accept="image/*"
                        />

                        <div className="mt-8 text-center">
                            <h2 className="text-2xl font-black text-slate-900 mb-1 capitalize">{profile?.name || 'Administrator'}</h2>
                            <p className="text-blue-600 font-black text-[10px] tracking-[0.2em] uppercase">@{profile?.username || 'admin'}</p>
                        </div>

                        <div className="w-full h-px bg-slate-100 my-8"></div>

                        <div className="w-full space-y-4">
                            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-slate-400">
                                <span>Platform Tier</span>
                                <span className="text-slate-900 font-black">ENTERPRISE</span>
                            </div>
                            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-slate-400">
                                <span>Authority Level</span>
                                <span className="text-blue-600 font-black">LVL 1 (MASTER)</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Details Section */}
                <div className="lg:col-span-8 space-y-8">
                    {/* Information Grid */}
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden">
                        <div className="p-8 md:p-10 border-b border-slate-50 bg-slate-50/30">
                            <h3 className="text-xl font-black text-slate-800 tracking-tight">Security Credentials</h3>
                        </div>
                        <div className="p-8 md:p-10 grid grid-cols-1 md:grid-cols-2 gap-10">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <Mail className="w-3.5 h-3.5 text-blue-500" /> Registered Email
                                </label>
                                <p className="font-bold text-slate-900 text-lg break-all">{profile?.email || 'Not provided'}</p>
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <Phone className="w-3.5 h-3.5 text-blue-500" /> Secure Phone
                                </label>
                                <p className="font-bold text-slate-900 text-lg">{profile?.phone || 'Not linked'}</p>
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <Globe className="w-3.5 h-3.5 text-blue-500" /> Region Access
                                </label>
                                <p className="font-bold text-slate-900 text-lg">Global Registry</p>
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Multi-Factor Auth
                                </label>
                                <p className="text-emerald-600 font-black text-sm uppercase flex items-center gap-2">
                                    Enabled <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                </p>
                            </div>
                        </div>
                    </div>


                    {/* Permissions Section */}
                    <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
                        <div className="relative z-10">
                            <h3 className="text-xl font-black mb-8 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center">
                                    <Shield className="w-4 h-4 text-white" />
                                </div>
                                System Privileges
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {[
                                    'Full Infrastructure Access',
                                    'Financial Oversight',
                                    'Security Audit Logs',
                                    'Database Manipulation',
                                    'Tenant Configuration',
                                    'API Management'
                                ].map((perm, idx) => (
                                    <div key={idx} className="flex items-center gap-3 bg-white/5 border border-white/10 p-4 rounded-2xl hover:bg-white/10 transition-colors">
                                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                        <span className="text-sm font-bold text-slate-300">{perm}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Edit Profile Modal */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-300">
                        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                            <h3 className="text-xl font-black text-slate-800 tracking-tight">Edit Secure Profile</h3>
                            <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-white rounded-xl text-slate-400 transition-all">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleUpdateProfile} className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Full Name</label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        value={editForm.name}
                                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/5 transition-all"
                                        placeholder="Administrator Name"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Registered Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="email"
                                        value={editForm.email}
                                        onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/5 transition-all"
                                        placeholder="admin@platform.com"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Secure Phone</label>
                                <div className="relative">
                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="tel"
                                        value={editForm.phone}
                                        onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/5 transition-all"
                                        placeholder="+1 234 567 890"
                                    />
                                </div>
                            </div>

                            <button 
                                type="submit"
                                disabled={updating}
                                className="w-full py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl shadow-slate-900/10 flex items-center justify-center gap-3 disabled:opacity-50"
                            >
                                {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                Save Secure Changes
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Full Photo Modal */}
            {showFullPhoto && (
                <div 
                    className="fixed inset-0 z-[1000] bg-slate-900/90 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-300"
                    onClick={() => setShowFullPhoto(false)}
                >
                    <button 
                        className="absolute top-10 right-10 p-4 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all"
                        onClick={() => setShowFullPhoto(false)}
                    >
                        <X className="w-8 h-8" />
                    </button>
                    <img 
                        src={profile?.profile_photo} 
                        alt="Full Profile" 
                        className="max-w-full max-h-[80vh] rounded-[4rem] shadow-2xl border-4 border-white/20 animate-in zoom-in duration-500"
                    />
                </div>
            )}
        </div>
    );
};

export default SuperAdminProfile;


