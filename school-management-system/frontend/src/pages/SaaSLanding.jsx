import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { BASE_URL } from '../services/api';

/* ─── Global Base Styles ─── */
const saasStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Inter:wght@400;500;600&display=swap');

  :root {
    --school-navy: #1e3a8a;
    --school-azure: #2563eb;
    --school-slate: #64748b;
  }

  .font-outfit { font-family: 'Outfit', sans-serif; }
  .font-inter { font-family: 'Inter', sans-serif; }

  .glass-nav {
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(226, 232, 240, 0.5);
  }

  .btn-premium {
    background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
    color: white;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.2), 0 4px 6px -2px rgba(37, 99, 235, 0.05);
  }
  .btn-premium:hover {
    transform: translateY(-2px);
    box-shadow: 0 20px 25px -5px rgba(37, 99, 235, 0.25), 0 10px 10px -5px rgba(37, 99, 235, 0.1);
    filter: brightness(1.1);
  }

  .btn-outline-premium {
    border: 2px solid #1e3a8a;
    color: #1e3a8a;
    background: transparent;
    transition: all 0.2s ease;
  }
  .btn-outline-premium:hover {
    background: rgba(30, 58, 138, 0.04);
    border-color: #2563eb;
    color: #2563eb;
  }

  .hero-gradient {
    background: radial-gradient(circle at top right, rgba(37, 99, 235, 0.05), transparent),
                radial-gradient(circle at bottom left, rgba(30, 58, 138, 0.03), transparent);
  }

  .feature-card {
    background: white;
    border: 1px solid #f1f5f9;
    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }
  .feature-card:hover {
    transform: translateY(-8px);
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.08);
    border-color: #e2e8f0;
  }

  @keyframes float {
    0% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
    100% { transform: translateY(0px); }
  }
  .animate-float { animation: float 3s ease-in-out infinite; }
`;

/* ─── Static Data ─── */
const features = [
  {
    title: 'Multi-Tenant Ecosystem',
    desc: 'Each school operates in its own isolated environment with dedicated data security and branding.',
    icon: '🏢'
  },
  {
    title: 'RBAC Security',
    desc: 'Granular permissions for Superadmins, School Admins, Teachers, and Parents.',
    icon: '🛡️'
  },
  {
    title: 'Global Analytics',
    desc: 'Real-time reporting and performance metrics across single or multiple institutions.',
    icon: '📊'
  },
  {
    title: 'Automated Operations',
    desc: 'Streamlined attendance, fees, results, and communication workflows.',
    icon: '⚙️'
  }
];

export default function SaaSLanding() {
  const navigate = useNavigate();
  const [schoolIdSearch, setSchoolIdSearch] = useState('');
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);

    const style = document.createElement('style');
    style.textContent = saasStyles;
    document.head.appendChild(style);

    return () => {
      window.removeEventListener('scroll', onScroll);
      document.head.removeChild(style);
    };
  }, []);

  const handleSchoolSearch = (e) => {
    e.preventDefault();
    if (schoolIdSearch.trim()) {
      navigate(`/school/${schoolIdSearch.trim()}`);
    }
  };

  const [enquiryForm, setEnquiryForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [enquiryStatus, setEnquiryStatus] = useState(null); // 'loading', 'success', 'error'
  const [enquiryMsg, setEnquiryMsg] = useState('');

  const handleEnquirySubmit = async (e) => {
    e.preventDefault();
    setEnquiryStatus('loading');
    try {
      const response = await fetch(`${BASE_URL}enquiries/submit/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(enquiryForm),
      });
      const data = await response.json();
      if (response.ok) {
        setEnquiryStatus('success');
        setEnquiryMsg(data.message);
        setEnquiryForm({ name: '', email: '', subject: '', message: '' });
      } else {
        setEnquiryStatus('error');
        setEnquiryMsg(data.message || 'Submission failed');
      }
    } catch (err) {
      setEnquiryStatus('error');
      setEnquiryMsg('Failed to connect to server');
    }
  };


  return (
    <div className="min-h-screen bg-white font-inter text-slate-800 hero-gradient selection:bg-blue-100 selection:text-blue-900">

      {/* ─── Header ─── */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'glass-nav py-4' : 'bg-transparent py-6'}`}>
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center overflow-hidden shadow-lg shadow-blue-900/10 border border-slate-100">
              <img 
                src="https://res.cloudinary.com/dutitdlwp/image/upload/v1777784687/WhatsApp_Image_2026-04-27_at_11.23.40_1_eglpnu.jpg" 
                alt="School Conduct Logo" 
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <p className="font-outfit text-lg font-bold text-slate-900 tracking-tight leading-none">School Conduct</p>
              <p className="text-[10px] uppercase tracking-widest font-bold text-school-azure mt-1">Enterprise SaaS</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            {/* Platform Login Dropdown */}
            <div className="relative group hidden md:block">
              <button className="text-sm font-bold text-slate-600 group-hover:text-school-navy transition-colors px-4 flex items-center gap-2">
                Platform Login
                <span className="text-[10px] opacity-50 group-hover:rotate-180 transition-transform">▼</span>
              </button>
              
              <div className="absolute top-full right-0 pt-2 w-48 opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-300 z-[60]">
                <div className="bg-white border border-slate-100 rounded-2xl shadow-2xl overflow-hidden p-2">
                  <button 
                    onClick={() => navigate('/superadmin/login')}
                    className="w-full text-left px-4 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-school-navy rounded-xl transition-colors flex items-center gap-3"
                  >
                    <span className="w-6 h-6 bg-blue-50 rounded-lg flex items-center justify-center text-[10px]">🏢</span>
                    Superadmin Login
                  </button>
                  <button 
                    onClick={() => navigate('/dealer-login')}
                    className="w-full text-left px-4 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-school-navy rounded-xl transition-colors flex items-center gap-3"
                  >
                    <span className="w-6 h-6 bg-indigo-50 rounded-lg flex items-center justify-center text-[10px]">💼</span>
                    Dealer Login
                  </button>
                </div>
              </div>
            </div>
            <form onSubmit={handleSchoolSearch} className="relative group w-full max-w-[320px] sm:max-w-[400px]">
              <input
                type="text"
                placeholder="Enter School ID..."
                value={schoolIdSearch}
                onChange={(e) => setSchoolIdSearch(e.target.value)}
                className="bg-slate-100 hover:bg-slate-200 focus:bg-white border-none rounded-full py-2.5 px-6 text-sm font-medium focus:ring-2 focus:ring-school-navy/10 transition-all w-full"
              />
              <button
                type="submit"
                className="absolute right-2 top-1.5 bottom-1.5 bg-school-navy text-white text-[10px] px-4 rounded-full font-bold uppercase tracking-wider hover:bg-school-azure transition-colors"
              >
                Go
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* ─── Hero Section ─── */}
      <section className="pt-48 pb-32 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-100 rounded-full mb-6">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest">v4.0 Enterprise Live</span>
            </div>

            <h1 className="font-outfit text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-slate-900 leading-[1.1] mb-8 tracking-tight">
              SCHOOL ERP <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-school-navy to-school-azure">SYSTEM.</span>
            </h1>

            <p className="text-base sm:text-lg md:text-xl text-slate-500 mb-12 max-w-xl sm:max-w-lg leading-relaxed">
              Professional multi-tenant infrastructure designed for modern institutions. Secure, scalable, and completely branded for every tenant.
            </p>

            <div className="flex flex-col sm:flex-row gap-5">
              <button
                onClick={() => navigate('/superadmin/login')}
                className="btn-premium px-10 py-5 rounded-2xl text-base font-bold shadow-2xl"
              >
                Launch Admin Portal
              </button>
              <div className="relative group flex items-center">
                <p className="text-sm font-bold text-slate-400 px-4">or find your institution</p>
                <div className="w-8 h-px bg-slate-200"></div>
              </div>
            </div>

            <div className="mt-16 flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-6">
              <div>
                <p className="text-3xl sm:text-4xl font-bold text-slate-900 font-outfit">100+</p>
                <p className="text-xs sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-1">Institutions</p>
              </div>
              <div className="hidden sm:block w-px h-10 bg-slate-200"></div>
              <div>
                <p className="text-3xl sm:text-4xl font-bold text-slate-900 font-outfit">50k+</p>
                <p className="text-xs sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-1">Daily Users</p>
              </div>
              <div className="hidden sm:block w-px h-10 bg-slate-200"></div>
              <div>
                <p className="text-3xl sm:text-4xl font-bold text-slate-900 font-outfit">99.9%</p>
                <p className="text-xs sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-1">Uptime</p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -top-12 -right-12 w-64 h-64 bg-school-azure/10 rounded-full blur-[100px]"></div>
            <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-school-navy/5 rounded-full blur-[100px]"></div>

            <div className="relative bg-white border border-slate-100 rounded-[2.5rem] p-4 shadow-2xl animate-float">
              <div className="rounded-[2rem] overflow-hidden border border-slate-50">
                <img
                  src="https://images.unsplash.com/photo-1593642532842-98d0fd5ebc1a?auto=format&fit=crop&q=80&w=1600"
                  alt="Dashboard Preview"
                  className="w-full h-auto"
                />
              </div>

              {/* Floating Cards */}
              <div className="absolute -top-6 -right-6 bg-white rounded-2xl shadow-xl p-5 border border-slate-50 flex items-center gap-4 max-w-[200px]">
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-600 text-lg">✓</div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Isolation Verified</p>
                  <p className="text-[10px] text-slate-400">Zero data overlap</p>
                </div>
              </div>

              <div className="absolute -bottom-6 -left-6 bg-white rounded-2xl shadow-xl p-5 border border-slate-50 flex items-center gap-4 max-w-[200px]">
                <div className="w-10 h-10 rounded-full bg-school-navy/10 flex items-center justify-center text-school-navy text-lg">✈</div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Auto Scaled</p>
                  <p className="text-[10px] text-slate-400">Region: Asia-1</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features Section ─── */}
      <section className="py-32 bg-slate-50/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <p className="text-[10px] font-extrabold text-school-azure uppercase tracking-[0.3em] mb-4">The Platform Standard</p>
            <h2 className="font-outfit text-4xl font-bold text-slate-900 mb-6">Engineered for Transparency</h2>
            <p className="text-slate-500 max-w-2xl mx-auto leading-relaxed">
              Our core infrastructure provides the stability your school needs, with the flexibility to adapt to existing pedagogical workflows.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f, i) => (
              <div key={i} className="feature-card p-8 md:p-10 rounded-[2rem]">
                <div className="text-4xl mb-6">{f.icon}</div>
                <h3 className="font-outfit text-xl font-bold text-slate-900 mb-3">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA Footer ─── */}
      <section className="py-32 px-6">
        <div className="max-w-5xl mx-auto bg-school-navy rounded-[3rem] p-12 md:p-20 text-center relative overflow-hidden shadow-2xl shadow-blue-900/20">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-school-azure/20 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl"></div>

          <div className="relative z-10">
            <h2 className="font-outfit text-4xl md:text-5xl font-bold text-white mb-8">Ready to evolve your <br className="hidden md:block" /> school management?</h2>
            <p className="text-white/60 mb-12 max-w-xl mx-auto text-lg leading-relaxed">Join over 100 institutions leveraging our technology to drive academic excellence and operational efficiency.</p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
              <button
                onClick={() => navigate('/superadmin/login')}
                className="w-full sm:w-auto bg-white text-school-navy px-12 py-5 rounded-2xl font-bold text-base hover:bg-slate-100 transition-colors shadow-xl"
              >
                Sign In as Platform Admin
              </button>
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="w-full sm:w-auto border-2 border-white/20 text-white px-12 py-5 rounded-2xl font-bold text-base hover:bg-white/5 transition-colors"
              >
                Find your School
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-slate-50 border-t border-slate-100">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="font-outfit text-3xl font-bold text-slate-900 mb-4">Have Questions?</h2>
            <p className="text-slate-500">Send us an enquiry and our team will get back to you within 24 hours.</p>
          </div>

          <form onSubmit={handleEnquirySubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-8 md:p-10 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100">
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400 ml-1">Full Name</label>
              <input
                type="text"
                required
                value={enquiryForm.name}
                onChange={(e) => setEnquiryForm({ ...enquiryForm, name: e.target.value })}
                placeholder="Rahul Sharma"
                className="w-full bg-slate-50 border-none rounded-2xl py-3.5 px-6 text-sm focus:ring-2 focus:ring-school-navy/10 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400 ml-1">Email Address</label>
              <input
                type="email"
                required
                value={enquiryForm.email}
                onChange={(e) => setEnquiryForm({ ...enquiryForm, email: e.target.value })}
                placeholder="rahul@example.com"
                className="w-full bg-slate-50 border-none rounded-2xl py-3.5 px-6 text-sm focus:ring-2 focus:ring-school-navy/10 transition-all"
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400 ml-1">Subject</label>
              <input
                type="text"
                required
                value={enquiryForm.subject}
                onChange={(e) => setEnquiryForm({ ...enquiryForm, subject: e.target.value })}
                placeholder="Pricing or Technical Query"
                className="w-full bg-slate-50 border-none rounded-2xl py-3.5 px-6 text-sm focus:ring-2 focus:ring-school-navy/10 transition-all"
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400 ml-1">Message</label>
              <textarea
                required
                rows="4"
                value={enquiryForm.message}
                onChange={(e) => setEnquiryForm({ ...enquiryForm, message: e.target.value })}
                placeholder="How can we help your institution?"
                className="w-full bg-slate-50 border-none rounded-2xl py-3.5 px-6 text-sm focus:ring-2 focus:ring-school-navy/10 transition-all"
              ></textarea>
            </div>
            
            <div className="md:col-span-2 mt-2">
              <button
                type="submit"
                disabled={enquiryStatus === 'loading'}
                className="w-full btn-premium py-4 rounded-2xl font-bold flex items-center justify-center gap-3 disabled:opacity-70"
              >
                {enquiryStatus === 'loading' ? 'Sending...' : 'Send Message'}
                <span>→</span>
              </button>
              
              {enquiryStatus === 'success' && (
                <p className="text-center text-green-600 text-xs font-bold mt-4 animate-float">✓ {enquiryMsg}</p>
              )}
              {enquiryStatus === 'error' && (
                <p className="text-center text-red-500 text-xs font-bold mt-4">⚠ {enquiryMsg}</p>
              )}
            </div>
          </form>
        </div>
      </section>

      <footer className="py-12 border-t border-slate-100 text-center">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-loose">
          © {new Date().getFullYear()} School Conduct Multi-Tenant Infrastructure. <br />
          Built for Global Educational Excellence.
        </p>
      </footer>


    </div>
  );
}
