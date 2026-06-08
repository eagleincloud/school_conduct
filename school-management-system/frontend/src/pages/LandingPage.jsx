import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useSchoolStore from '../store/schoolStore';

/* ─── Global base styles ─── */
const globalStyles = `
  html { scroll-behavior: smooth; }
  body { background: #ffffff; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: #f1f5f9; }
  ::-webkit-scrollbar-thumb { background: #2563eb; border-radius: 3px; }

  .card-lift {
    transition: transform 0.25s ease, box-shadow 0.25s ease;
  }
  .card-lift:hover {
    transform: translateY(-5px);
    box-shadow: 0 12px 32px rgba(30,58,138,0.12);
  }

  .btn-primary {
    background: #1e3a8a;
    color: #ffffff;
    transition: background 0.2s ease, transform 0.15s ease;
  }
  .btn-primary:hover {
    background: #2563eb;
    transform: translateY(-1px);
  }

  .btn-outline {
    border: 2px solid #1e3a8a;
    color: #1e3a8a;
    background: transparent;
    transition: all 0.2s ease;
  }
  .btn-outline:hover {
    background: #1e3a8a;
    color: #ffffff;
  }

  .section-label {
    color: #2563eb;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .nav-link {
    color: #475569;
    font-size: 0.875rem;
    font-weight: 500;
    transition: color 0.15s ease;
  }
  .nav-link:hover { color: #1e3a8a; }

  @keyframes float {
    0% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
    100% { transform: translateY(0px); }
  }
  .animate-float { animation: float 6s ease-in-out infinite; }
`;

/* ─── Intersection Observer hook ─── */
function useInView(threshold = 0.1) {
  const [ref, setRef] = useState(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!ref) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        observer.unobserve(ref);
      }
    }, { threshold });

    observer.observe(ref);
    return () => observer.disconnect();
  }, [ref, threshold]);

  return [setRef, inView];
}

/* ═══════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════ */
export default function LandingPage() {
  const { schoolId: rawSchoolId } = useParams();
  const schoolId = (rawSchoolId || '').toString().trim();
  // Normalize common user input mistakes: trim spaces and uppercase
  const normalizedSchoolId = schoolId.replace(/\s+/g, '').toUpperCase();
  // Auto-correct a frequent typo
  const finalSchoolId = normalizedSchoolId === 'DEFALT' ? 'DEFAULT' : normalizedSchoolId;
  const navigate = useNavigate();
  const { school, loading, error, fetchSchoolInfo, clearSchool } = useSchoolStore();
  
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const loginOptions = [
    { label: 'Administrator', role: 'admin' },
    { label: 'Teacher / Staff', role: 'teacher' },
    { label: 'Parent / Student', role: 'student' }
  ];

  const navLinks = [
    ['About', 'about'],
    ['Academics', 'academics'],
    ['Contact', 'contact']
  ];

  useEffect(() => {
    if (!finalSchoolId || finalSchoolId === 'undefined') {
      navigate('/');
      return;
    }
    fetchSchoolInfo(finalSchoolId);
    return () => clearSchool();
  }, [schoolId, fetchSchoolInfo, clearSchool, navigate]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 64);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = globalStyles;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  const [heroRef,   heroInView]   = useInView(0.05); // Faster trigger for hero
  const [aboutRef,  aboutInView]  = useInView(0.1);
  const [statsRef,  statsInView]  = useInView(0.1);
  const [acadRef,   acadInView]   = useInView(0.1);

  const [contRef,   contInView]   = useInView(0.1);


  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setMenuOpen(false);
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 font-inter">
      <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-slate-500 font-medium animate-pulse">Initializing Portal...</p>
    </div>
  );

  if (error || !school) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-inter">
      <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl p-12 text-center animate-in zoom-in-95 duration-500">
        <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-8">
          <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        
        <h2 className="text-3xl font-bold text-slate-900 mb-4 tracking-tight">Access Restricted</h2>
        <p className="text-slate-500 mb-10 leading-relaxed font-medium">
          {error || "We couldn't find the institution you're looking for. Please verify the School ID and try again."}
        </p>

        <div className="space-y-4">
          <button 
            onClick={() => window.location.href = '/'}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-2xl transition-all active:scale-[0.98] text-sm"
          >
            Back to Global Portal
          </button>
          
          <div className="pt-4 border-t border-slate-50">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Institutional Identifier</p>
              <p className="text-sm font-mono text-blue-600 font-bold mt-1">ID: {finalSchoolId || 'N/A'}</p>
          </div>
        </div>
      </div>
    </div>
  );

  // Default Assets
  const defaultHero = 'https://images.unsplash.com/photo-1562774053-701939374585?w=1600&q=80&auto=format&fit=crop';
  const defaultAbout = 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=1200&q=80&auto=format&fit=crop';

  return (
    <div className="font-inter bg-white text-slate-900 min-h-screen overflow-x-hidden">
      
      {/* ───── NAVBAR ───── */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm py-4' : 'bg-transparent py-6'
      }`}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-4 cursor-pointer group" onClick={() => scrollTo('hero')}>
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform overflow-hidden border border-slate-100">
               {school.logo ? (
                 <img 
                   src={school.logo} 
                   alt="" 
                   className="w-full h-full object-cover" 
                   onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                 />
               ) : null}
               <div className="text-2xl font-black text-blue-600" style={{ display: school.logo ? 'none' : 'flex' }}>
                 {school.name[0]}
               </div>
            </div>
            <div>
              <p className="text-lg font-black tracking-tight leading-none text-slate-900">{school.name}</p>
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-1">#{school.school_id}</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-10">
            {navLinks.filter(item => !item.toggle || item.toggle).map(item => {
              const [label, id] = Array.isArray(item) ? item : [item.label, item.id];
              return (
                <button 
                  key={id} 
                  onClick={() => scrollTo(id)} 
                  className="text-sm font-bold text-slate-600 hover:text-blue-600 transition-colors uppercase tracking-widest"
                >
                  {label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-4">
             <div className="hidden md:block relative group">
                <button className="bg-slate-900 text-white px-8 py-3 rounded-2xl text-xs font-bold shadow-xl shadow-slate-900/20 hover:bg-blue-600 transition-all active:scale-95">
                  Secure Access
                </button>
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 py-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                   {loginOptions.map(role => (
                      <button 
                        key={role.role}
                        onClick={() => navigate(`/school/${school.school_id}/login?role=${role.role}`)}
                        className="w-full text-left px-6 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors"
                      >
                        {role.label}
                      </button>
                   ))}
                </div>
             </div>
             <button
                type="button"
                className="md:hidden flex h-10 w-10 items-center justify-center rounded-xl text-slate-900 hover:bg-slate-100 transition-colors"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Toggle mobile menu"
                aria-expanded={menuOpen}
             >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={menuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} /></svg>
             </button>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-slate-100 bg-white shadow-xl">
            <div className="px-6 py-4 space-y-2">
              {navLinks.map(([label, id]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => scrollTo(id)}
                  className="w-full text-left px-4 py-3 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors uppercase tracking-widest"
                >
                  {label}
                </button>
              ))}
              <div className="my-3 h-px bg-slate-100" />
              {loginOptions.map(({ label, role }) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate(`/school/${school.school_id}/login?role=${role}`);
                  }}
                  className="w-full text-left px-4 py-3 rounded-xl text-sm font-bold text-white bg-slate-900 hover:bg-blue-600 transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* ───── HERO SECTION ───── */}
      <section id="hero" className="relative min-h-screen flex items-center pt-20">
         <div className="absolute inset-0 bg-slate-50">
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${school.hero_image || defaultHero}')` }} />
            <div className="absolute inset-0 bg-gradient-to-r from-white via-white/95 to-transparent lg:to-white/10" />
         </div>
         
         <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 py-24 grid lg:grid-cols-2 gap-16 items-center">
            <div ref={heroRef} className={`max-w-xl transition-all duration-1000 ${heroInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest mb-6 border border-blue-100">
                   <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                   Official Academic Portal
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black text-slate-900 leading-[1.1] mb-6 tracking-tight">
                  {school.name.split(' ').slice(0, 2).join(' ')}<br />
                  <span className="text-blue-600">{school.name.split(' ').slice(2).join(' ') || 'Institution'}</span>
                </h1>
                <p className="text-base sm:text-lg lg:text-xl font-bold text-slate-600 mb-4">
                  {school.tagline || 'Excellence in Education, Leadership in Innovation'}
                </p>
                <p className="text-base sm:text-lg text-slate-500 leading-relaxed mb-10">
                  {school.about?.substring(0, 200) || `${school.name} is dedicated to fostering a nurturing environment that empowers students to achieve academic excellence and life-long learning skills.`}...
                </p>
                
                <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4">
                   <button onClick={() => scrollTo('academics')} className="w-full sm:w-auto bg-blue-600 text-white px-8 py-4 sm:px-10 sm:py-5 rounded-[2rem] text-sm font-bold shadow-2xl shadow-blue-600/30 hover:bg-blue-700 transition-all active:scale-95">
                      Explore Programmes
                   </button>
                   <button onClick={() => scrollTo('contact')} className="w-full sm:w-auto bg-white border border-slate-200 text-slate-900 px-8 py-4 sm:px-10 sm:py-5 rounded-[2rem] text-sm font-bold hover:bg-slate-50 transition-all active:scale-95">
                      Contact Admission
                   </button>
                </div>
            </div>

            <div className="hidden lg:block relative animate-float">
               <div className="w-full max-w-[480px] aspect-[4/5] bg-white rounded-[3rem] shadow-2xl p-6 border border-slate-100 overflow-hidden">
                  <img src={school.hero_image || defaultHero} alt="" className="w-full h-full object-cover rounded-[2rem]" />
               </div>
               <div className="absolute -bottom-10 -left-10 bg-white rounded-3xl shadow-2xl p-8 border border-slate-50 max-w-[240px]">
                  <p className="text-4xl font-black text-blue-600 mb-1">{school.established_year || '1995'}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Established Heritage</p>
                  <div className="mt-4 pt-4 border-t border-slate-100">
                      <p className="text-xs font-bold text-slate-600">Rated among the top institutions in the region.</p>
                  </div>
               </div>
            </div>
         </div>
      </section>

      {/* ───── STATS BANNER ───── */}
      <section ref={statsRef} className="bg-blue-600 py-16">
         <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-12 text-center text-white">
            {[
               { val: school.total_students_count || '1.2k+', label: 'Enrolled Students' },
               { val: school.total_teachers_count || '85+', label: 'Expert Faculty' },
               { val: school.pass_percentage || '98%', label: 'Board Result' },
               { val: '24/7', label: 'Student Support' }
            ].map((stat, i) => (
               <div key={i} className={`transition-all duration-700 ${statsInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'}`} style={{ transitionDelay: `${i * 100}ms` }}>
                  <p className="text-3xl sm:text-4xl lg:text-5xl font-black mb-2">{stat.val}</p>
                  <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-blue-200">{stat.label}</p>
               </div>
            ))}
         </div>
      </section>

      {/* ───── ABOUT SECTION ───── */}
      <section id="about" className="py-24 bg-white relative overflow-hidden">
         <div className="max-w-7xl mx-auto px-6 lg:px-8 grid lg:grid-cols-2 gap-20 items-center">
             <div ref={aboutRef} className={`relative transition-all duration-1000 ${aboutInView ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'}`}>
                <img src={defaultAbout} alt="" className="w-full h-auto max-h-[540px] sm:max-h-[480px] object-cover rounded-[3rem] shadow-2xl relative z-10" />
                <div className="absolute -top-10 -right-10 w-64 h-64 bg-blue-50 rounded-full blur-3xl -z-0" />
                <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-indigo-50 rounded-full blur-2xl -z-0" />
             </div>
             <div className={`transition-all duration-1000 delay-300 ${aboutInView ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'}`}>
                <p className="section-label mb-4">Institutional Legacy</p>
                 <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 mb-8 tracking-tight leading-tight">
                   Nurturing Excellence, <br />
                   Inspiring Innovation
                </h2>
                <div className="space-y-6 text-slate-600 leading-relaxed text-base font-medium">
                   <p>{school.about || `Welcome to ${school.name}, where every student is mentored to reach their full potential. Our comprehensive curriculum is designed to balance academic rigor with creative exploration.`}</p>
                   <p>Founded in {school.established_year || 'the late 20th century'}, our institution has consistently evolved to integrate modern technology into traditional teaching methodologies, creating a dynamic learning ecosystem.</p>
                </div>
                
                <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                      <div className="text-3xl mb-3">🎯</div>
                      <p className="font-black text-slate-900 mb-1">Our Mission</p>
                      <p className="text-xs text-slate-500 font-medium">Empowering every learner with future-ready skills.</p>
                   </div>
                   <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                      <div className="text-3xl mb-3">🚀</div>
                      <p className="font-black text-slate-900 mb-1">Our Vision</p>
                      <p className="text-xs text-slate-500 font-medium">To lead as a global benchmark for holistic education.</p>
                   </div>
                </div>
             </div>
         </div>
      </section>

      {/* ───── ACADEMICS SECTION ───── */}
      <section id="academics" className="py-24 bg-slate-50 relative">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
              <div ref={acadRef} className={`text-center max-w-3xl mx-auto mb-16 transition-all duration-1000 ${acadInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
                 <p className="section-label mb-4">Academic Standards</p>
                 <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 mb-6 tracking-tight">Standardized Excellence</h2>
                 <p className="text-base sm:text-lg text-slate-500 font-medium leading-relaxed">We follow a globally recognized curriculum structure that ensures our students are competitive on both national and international platforms.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {[
                    { title: 'Affiliated Board', val: school.board || 'CBSE / ICSE', icon: '🏛️' },
                    { title: 'Grade Spectrum', val: school.classes_offered || 'Nursery - Grade 12', icon: '🎓' },
                    { title: 'Academic Streams', val: school.streams || 'Science, Commerce & Arts', icon: '🧪' }
                  ].map((card, i) => (
                    <div key={i} className={`bg-white p-10 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 transition-all duration-700 ${acadInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`} style={{ transitionDelay: `${i * 100}ms` }}>
                        <div className="text-5xl mb-8">{card.icon}</div>
                        <h3 className="text-xl font-black text-slate-900 mb-2">{card.title}</h3>
                        <p className="text-slate-500 font-bold tracking-tight text-lg mb-6">{card.val}</p>
                        <p className="text-sm text-slate-400 leading-relaxed font-medium">Comprehensive educational frameworks designed to prepare students for top-tier universities worldwide.</p>
                    </div>
                  ))}
              </div>
          </div>
      </section>



      {/* ───── CONTACT SECTION ───── */}
      <section id="contact" className="py-24 bg-slate-50 relative">
          <div className="max-w-7xl mx-auto px-6 lg:px-8 grid lg:grid-cols-2 gap-16">
              <div ref={contRef} className={`transition-all duration-1000 ${contInView ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'}`}>
                  <p className="section-label mb-4">Reach Out</p>
                  <h2 className="text-4xl lg:text-5xl font-black text-slate-900 mb-8 tracking-tight">Connect With Us</h2>
                  
                  <div className="space-y-8">
                      <div className="flex flex-col sm:flex-row gap-6 items-start">
                         <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-lg text-2xl flex-shrink-0">📍</div>
                         <div>
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Campus Address</p>
                            <p className="text-lg font-bold text-slate-700 leading-relaxed">{school.address || "Main Campus Road, Academic District, India"}</p>
                         </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-6 items-start">
                         <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-lg text-2xl flex-shrink-0">📧</div>
                         <div>
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Communication</p>
                            <p className="text-lg font-bold text-slate-700">{school.contact_email}</p>
                            <p className="text-lg font-bold text-slate-700 mt-1">{school.phone || "+91 00000 00000"}</p>
                         </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-6 items-start">
                         <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-lg text-2xl flex-shrink-0">⏰</div>
                         <div>
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Visiting Hours</p>
                            <p className="text-lg font-bold text-slate-700">Mon - Sat: 08:30 AM to 04:30 PM</p>
                         </div>
                      </div>
                  </div>
              </div>

              <div className={`bg-white p-10 lg:p-14 rounded-[3rem] shadow-2xl border border-slate-100 transition-all duration-1000 delay-300 ${contInView ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'}`}>
                  {school.google_map_link ? (
                    <div className="w-full h-full min-h-[320px] lg:min-h-[400px] rounded-[2rem] overflow-hidden border border-slate-200">
                        <iframe 
                            src={school.google_map_link} 
                            width="100%" 
                            height="100%" 
                            style={{ border: 0, minHeight: '320px' }} 
                            allowFullScreen="" 
                            loading="lazy"
                        ></iframe>
                    </div>
                  ) : (
                    <form className="space-y-6">
                        <h3 className="text-2xl font-black text-slate-900 mb-2">Admission Enquiry</h3>
                        <p className="text-slate-500 font-medium text-sm mb-8">Submit your details and our admission counselor will reach out shortly.</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <input type="text" placeholder="Full Name" className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm focus:ring-2 focus:ring-blue-600 transition-all font-medium" />
                            <input type="email" placeholder="Email Address" className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm focus:ring-2 focus:ring-blue-600 transition-all font-medium" />
                        </div>
                        <input type="text" placeholder="Phone Number" className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm focus:ring-2 focus:ring-blue-600 transition-all font-medium" />
                        <textarea placeholder="Message / Enquiry Details" className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm focus:ring-2 focus:ring-blue-600 transition-all font-medium min-h-[120px] resize-none" />
                        <button className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all">Submit Request</button>
                    </form>
                  )}
              </div>
          </div>
      </section>

      {/* ───── FOOTER ───── */}
      <footer className="bg-white border-t border-slate-100 py-16">
          <div className="max-w-7xl mx-auto px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-12">
              <div className="md:col-span-2">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3 mb-6">
                      <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-xl">
                         {school.name[0]}
                      </div>
                      <p className="text-xl font-black text-slate-900 tracking-tight mt-3 sm:mt-0">{school.name}</p>
                  </div>
                  <p className="text-slate-500 font-medium leading-relaxed max-w-sm mb-8">
                     A premier educational institute committed to nurturing global leaders through academic excellence and holistic development.
                  </p>
                  <div className="flex flex-wrap gap-4">
                      {['TW', 'FB', 'IG', 'LI'].map(soc => (
                        <div key={soc} className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-[10px] font-black text-slate-400 border border-slate-100 cursor-pointer hover:bg-blue-600 hover:text-white transition-all">{soc}</div>
                      ))}
                  </div>
              </div>
              
              <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Quick Links</h4>
                  <ul className="space-y-4 text-sm font-bold text-slate-600">
                      <li><button onClick={() => scrollTo('hero')} className="hover:text-blue-600 transition-colors">Home</button></li>
                      <li><button onClick={() => scrollTo('about')} className="hover:text-blue-600 transition-colors">About Us</button></li>
                      <li><button onClick={() => scrollTo('academics')} className="hover:text-blue-600 transition-colors">Academics</button></li>
                      {/* Removed Gallery link */}
                      <li><button onClick={() => scrollTo('contact')} className="hover:text-blue-600 transition-colors">Contact</button></li>
                  </ul>
              </div>

              <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Portals</h4>
                  <ul className="space-y-4 text-sm font-bold text-slate-600">
                      <li><button onClick={() => navigate(`/school/${school.school_id}/login?role=admin`)} className="hover:text-blue-600 transition-colors">Admin Login</button></li>
                      <li><button onClick={() => navigate(`/school/${school.school_id}/login?role=teacher`)} className="hover:text-blue-600 transition-colors">Staff Login</button></li>
                      <li><button onClick={() => navigate(`/school/${school.school_id}/login?role=student`)} className="hover:text-blue-600 transition-colors">Parent Portal</button></li>
                  </ul>
              </div>
          </div>
          <div className="max-w-7xl mx-auto px-6 lg:px-8 mt-16 pt-8 border-t border-slate-50 flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-xs font-bold text-slate-400 italic">© {new Date().getFullYear()} {school.name}. Empowering Futures.</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Platform by Atheris Lab</p>
          </div>
      </footer>
    </div>
  );
}
