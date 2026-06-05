import React, { useState, useEffect } from 'react';
import { useConfirm } from '../../context/ConfirmContext';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

export default function DealerManagement() {
    const confirm = useConfirm();
  const navigate = useNavigate();
  const [dealers, setDealers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewingDealer, setViewingDealer] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [dealerSchools, setDealerSchools] = useState([]);
  
  const [formData, setFormData] = useState({
    name: '',
    contact: '',
    location: '',
    admin_username: '',
    admin_email: '',
    admin_password: '',
  });

  const fetchDealers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/dealers/management/');
      setDealers(response.data);
    } catch (err) {
      console.error('Failed to fetch dealers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDealers();
  }, []);

  const handleCreateDealer = async (e) => {
    e.preventDefault();
    try {
      await api.post('/dealers/management/', formData);
      setIsModalOpen(false);
      fetchDealers();
      setFormData({
        name: '', contact: '', location: '',
        admin_username: '', admin_email: '', admin_password: '',
      });
    } catch (err) {
      const errorData = err.response?.data;
      let errorMsg = 'Error creating dealer.';
      
      if (errorData) {
        if (typeof errorData === 'string') errorMsg = errorData;
        else if (errorData.detail) errorMsg = errorData.detail;
        else if (typeof errorData === 'object') {
          // Flatten validation errors
          errorMsg = Object.entries(errorData)
            .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
            .join('\n');
        }
      }
      alert(errorMsg);
    }
  };

  const handleViewDealer = async (dealer) => {
    setViewingDealer(dealer);
    setIsDetailModalOpen(true);
    try {
      const response = await api.get(`/dealers/management/${dealer.id}/schools/`);
      setDealerSchools(response.data);
    } catch (err) {
      console.error('Failed to fetch dealer schools');
    }
  };

  const handleDeleteDealer = async (id) => {
    if (!(await confirm("Are you sure? This will delete the dealer and their associated user account."))) return;
    try {
      await api.delete(`/dealers/management/${id}/`);
      fetchDealers();
    } catch (err) {
      alert('Failed to delete dealer.');
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500 font-inter">Loading Dealers...</div>;

  return (
    <div className="min-h-screen bg-slate-50 font-inter text-slate-800 p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <button onClick={() => navigate('/superadmin/dashboard')} className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-2 flex items-center gap-1 hover:underline">
              ← Back to Overview
            </button>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Dealer Network</h1>
            <p className="text-slate-500 mt-1 text-sm font-medium">Manage independent platform partners and their territories</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-3.5 rounded-2xl text-sm font-bold shadow-2xl transition-all active:scale-[0.98]"
          >
            + Onboard New Dealer
          </button>
        </div>

        {/* Dealer Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {dealers.map(dealer => (
            <div key={dealer.id} className="bg-white border border-slate-200 p-8 rounded-[2rem] shadow-sm hover:shadow-xl transition-all duration-500 group">
              <div className="flex items-start justify-between mb-6">
                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 text-2xl font-bold">
                  {dealer.name[0]}
                </div>
                <div className="flex gap-2">
                   <button onClick={() => handleViewDealer(dealer)} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400">👁️</button>
                   <button onClick={() => handleDeleteDealer(dealer.id)} className="p-2 hover:bg-red-50 rounded-xl text-red-400">🗑️</button>
                </div>
              </div>
              
              <h3 className="text-lg font-bold text-slate-900 mb-1">{dealer.name}</h3>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{dealer.location}</span>
                <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">{dealer.school_count} Schools</span>
              </div>
              
              <div className="space-y-3 pt-6 border-t border-slate-50">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-bold uppercase tracking-widest">Contact</span>
                  <span className="text-slate-700 font-medium">{dealer.contact}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-bold uppercase tracking-widest">Email</span>
                  <span className="text-slate-700 font-medium">{dealer.email}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Create Dealer Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl p-12 relative max-h-[90vh] overflow-y-auto">
              <button onClick={() => setIsModalOpen(false)} className="absolute top-8 right-8 text-slate-400 hover:text-slate-900 text-2xl">✕</button>
              
              <h2 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Onboard New Dealer</h2>
              <p className="text-slate-500 mb-10 text-sm font-medium">Create a new independent dealer account and profile.</p>

              <form onSubmit={handleCreateDealer} className="space-y-8">
                <div className="space-y-6">
                  <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-[0.3em] border-b border-indigo-50 pb-2">Business Profile</p>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Dealer Name</label>
                       <input 
                         type="text" required 
                         className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 focus:bg-white transition-all font-medium"
                         placeholder="e.g. Acme Distributions"
                         value={formData.name}
                         onChange={(e) => setFormData({...formData, name: e.target.value})}
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Assigned Location</label>
                       <input 
                         type="text" required 
                         className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 focus:bg-white transition-all font-medium"
                         placeholder="e.g. New York, USA"
                         value={formData.location}
                         onChange={(e) => setFormData({...formData, location: e.target.value})}
                       />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Contact Number</label>
                    <input 
                      type="text" required 
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 focus:bg-white transition-all font-medium"
                      placeholder="+1 234 567 890"
                      value={formData.contact}
                      onChange={(e) => setFormData({...formData, contact: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-6">
                  <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-[0.3em] border-b border-indigo-50 pb-2">Access Credentials</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Portal Username</label>
                       <input 
                         type="text" required 
                         className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 focus:bg-white transition-all font-medium"
                         placeholder="acme_dealer"
                         value={formData.admin_username}
                         onChange={(e) => setFormData({...formData, admin_username: e.target.value})}
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Security Token (Password)</label>
                       <input 
                         type="password" required 
                         className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 focus:bg-white transition-all font-medium"
                         placeholder="••••••••••••"
                         value={formData.admin_password}
                         onChange={(e) => setFormData({...formData, admin_password: e.target.value})}
                       />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Business Email</label>
                    <input 
                      type="email" required 
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 focus:bg-white transition-all font-medium"
                      placeholder="dealer@business.com"
                      value={formData.admin_email}
                      onChange={(e) => setFormData({...formData, admin_email: e.target.value})}
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <button type="submit" className="w-full bg-slate-900 text-white font-bold py-5 rounded-2xl shadow-2xl transition-all active:scale-[0.98] text-sm tracking-wide">
                    Create Dealer Account
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Dealer Detail & Schools Modal */}
        {isDetailModalOpen && viewingDealer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
            <div className="bg-white w-full max-w-3xl rounded-[3rem] shadow-2xl p-12 relative max-h-[90vh] overflow-y-auto">
              <button 
                onClick={() => { setIsDetailModalOpen(false); setDealerSchools([]); }}
                className="absolute top-8 right-8 text-slate-400 hover:text-slate-900 text-2xl"
              >✕</button>
              
              <div className="flex items-center gap-6 mb-10">
                 <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center text-indigo-600 font-bold text-3xl">
                    {viewingDealer.name[0]}
                 </div>
                 <div>
                    <h2 className="text-3xl font-bold text-slate-900 tracking-tight">{viewingDealer.name}</h2>
                    <p className="text-indigo-600 font-bold text-[10px] uppercase tracking-widest mt-1">Territory: {viewingDealer.location}</p>
                 </div>
              </div>

              <div className="space-y-12">
                <div className="space-y-6">
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] border-b border-slate-50 pb-2">Institutional Portfolio</p>
                   {dealerSchools.length > 0 ? (
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {dealerSchools.map((school, idx) => (
                          <div key={idx} className="bg-slate-50 rounded-2xl p-6 border border-slate-100 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-bold text-slate-900 leading-none mb-1">{school.name}</p>
                                <p className="text-[10px] font-mono font-bold text-slate-400 uppercase">ID: {school.school_id}</p>
                            </div>
                            <button onClick={() => navigate(`/school/${school.school_id}`)} className="text-[10px] font-bold text-blue-600 uppercase tracking-widest hover:underline">Portal ↗</button>
                          </div>
                        ))}
                     </div>
                   ) : (
                     <div className="p-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No schools registered by this dealer.</p>
                     </div>
                   )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
