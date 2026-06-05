import React, { createContext, useContext, useState, useEffect } from "react";

const StudentContext = createContext();

export const useStudent = () => {
  const context = useContext(StudentContext);
  if (!context) {
    throw new Error("useStudent must be used within a StudentProvider");
  }
  return context;
};

export const StudentProvider = ({ children }) => {
  const [selectedStudentId, setSelectedStudentId] = useState(() => {
    return localStorage.getItem("selectedStudentId") || null;
  });

  const updateSelectedStudent = (id) => {
    if (id) {
      localStorage.setItem("selectedStudentId", id);
    } else {
      localStorage.removeItem("selectedStudentId");
    }
    setSelectedStudentId(id);
  };

  // Optional: Sync across tabs
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === "selectedStudentId") {
        setSelectedStudentId(e.newValue);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return (
    <StudentContext.Provider
      value={{ selectedStudentId, setSelectedStudentId: updateSelectedStudent }}
    >
      {children}
    </StudentContext.Provider>
  );
};
