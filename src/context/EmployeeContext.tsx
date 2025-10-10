import React, { createContext, useState, useContext } from 'react';
import { Employee } from '../types/tblEmployees';

interface EmployeeContextType {
  facultyData: Employee[];
  setFacultyData: (data: Employee[]) => void;
  addEmployee: (employee: Employee) => void;
  updateEmployee: (id: number, employee: Employee) => void;
  deleteEmployee: (id: number) => void;
}

const EmployeeContext = createContext<EmployeeContextType | undefined>(undefined);

export const EmployeeProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [facultyData, setFacultyData] = useState<Employee[]>([]);

  const addEmployee = (employee: Employee) => {
    setFacultyData(prev => [...prev, {
      ...employee,
      EmployeeID: Math.max(...prev.map(e => e.employeeID || 0), 0) + 1
    }]);
  };

  const updateEmployee = (id: number, employee: Employee) => {
    setFacultyData(prev => prev.map(e => 
      e.employeeID === id ? { ...e, ...employee } : e
    ));
  };

  const deleteEmployee = (id: number) => {
    setFacultyData(prev => prev.filter(e => e.employeeID !== id));
  };

  return (
    <EmployeeContext.Provider 
      value={{ facultyData, setFacultyData, addEmployee, updateEmployee, deleteEmployee }}
    >
      {children}
    </EmployeeContext.Provider>
  );
};

export const useEmployees = () => {
  const context = useContext(EmployeeContext);
  if (!context) {
    throw new Error('useEmployees must be used within an EmployeeProvider');
  }
  return context;
};