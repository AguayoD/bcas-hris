import axios from 'axios';
import { Employee } from '../types/tblEmployees';

const API_BASE_URL = 'https://localhost:7245/api';

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

export const EmployeeService = {
  
  // CREATE
  async create(employee: Omit<Employee, 'employeeID'>): Promise<Employee> {
    const employeeData = { ...employee, employeeID: null };
    const response = await axiosInstance.post('/Employees', employeeData);
    return response.data;
  },

  // GET ALL
  async getAll(): Promise<Employee[]> {
    const response = await axiosInstance.get('/Employees');
    return response.data;
  },

  // UPDATE
update: async (id: number, employee: Partial<Employee>): Promise<Employee> => {
  try {
    const payload = {
      EmployeeID: id,
      FirstName: employee.firstName,
      LastName: employee.lastName,
      Gender: employee.gender,
      DateOfBirth: employee.dateOfBirth,
      Email: employee.email,
      PhoneNumber: employee.phoneNumber,
      Address: employee.address,
      PositionID: employee.positionID,
      DepartmentID: employee.departmentID,
      EmploymentStatus: employee.employmentStatus,
      HireDate: employee.hireDate,
      MemberFirstName: employee.memberFirstName,
      MemberLastName: employee.memberLastName,
      MemberGender: employee.memberGender,
      MemberAddress: employee.memberAddress,
      MemberPhoneNumber: employee.memberPhoneNumber,
      EducationalAttainment: employee.educationalAttainment,
      InstitutionName: employee.institutionName,
      YearGraduated: employee.yearGraduated,
      CourseName: employee.courseName,
      PreviousPosition: employee.previousPosition,
      OfficeName: employee.officeName,
      DurationStart: employee.durationStart,
      DurationEnd: employee.durationEnd,
      AgencyName: employee.agencyName,
      Supervisor: employee.supervisor,
      Accomplishment: employee.accomplishment,
      Summary: employee.summary
    };

    const response = await axiosInstance.patch<Employee>(
      `/Employees/${id}`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error in EmployeeService.update:", error);
    throw error;
  }
},

  // DELETE
  async delete(id: number): Promise<void> {
    await axiosInstance.delete(`/Employees/${id}`);
  }
};