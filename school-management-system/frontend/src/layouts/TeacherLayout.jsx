import React from 'react';
import MainLayout from './MainLayout';

const TeacherLayout = ({ children }) => {
    return (
        <MainLayout>
            <div className="border-b-2 border-[#28a745] mb-5 pb-2.5">
                <span className="text-[#28a745] font-bold">Teacher&apos;s Workspace</span>
            </div>
            {children}
        </MainLayout>
    );
};

export default TeacherLayout;
