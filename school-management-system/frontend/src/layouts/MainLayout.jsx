import React from 'react';
import Navbar from '../components/common/Navbar';
import Sidebar from '../components/common/Sidebar';

import authService from '../services/authService';

const MainLayout = ({ children }) => {
    const { role } = authService.getCurrentUser();

    return (
        <div className="app-shell h-screen flex flex-col bg-[#f8fafc] overflow-hidden">
            {/* Full-width Navbar at the very top */}
            <Navbar />
            
            <div className="flex flex-1 min-h-0 overflow-hidden">
                {/* Sidebar now sits below the Navbar, hide for platform roles */}
                {role !== 'superadmin' && role !== 'dealer' && <Sidebar />}
                
                <main className="flex-1 min-w-0 overflow-y-auto p-3 sm:p-4 md:p-6 lg:p-8 custom-scrollbar">
                    <div className="app-content-surface w-full max-w-7xl mx-auto">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
