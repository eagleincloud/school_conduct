import React from 'react';
import MainLayout from './MainLayout';

const StudentLayout = ({ children }) => {
    return (
        <MainLayout>
            <div className="border-b-2 border-[#17a2b8] mb-5 pb-2.5">
                <span className="text-[#17a2b8] font-bold">Student Portal</span>
            </div>
            {children}
        </MainLayout>
    );
};

export default StudentLayout;
    
