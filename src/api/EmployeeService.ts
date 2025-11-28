import axios from './_axiosInstance';
import { Employee } from '../types/tblEmployees';

export const EmployeeService = {
  async create(employee: Omit<Employee, 'employeeID'>): Promise<Employee> {
    const employeeData = { ...employee, employeeID: null };
    const response = await axios.post('/Employees', employeeData);
    return response.data;
  },

  async getAll(): Promise<Employee[]> {
    const response = await axios.get('/Employees');
    return response.data;
  },

  async update(id: number, employee: Partial<Employee>): Promise<Employee> {
    try {
      const payload = {
        EmployeeID: id,
        FirstName: employee.firstName,
        MiddleName: employee.middleName,
        LastName: employee.lastName,
        Gender: employee.gender,
        DateOfBirth: employee.dateOfBirth,
        Email: employee.email,
        PhoneNumber: employee.phoneNumber,
        Address: employee.address,
        PositionID: employee.positionID,
        DepartmentID: employee.departmentID,
        DepartmentID2: employee.departmentID2,
        DepartmentID3: employee.departmentID3,
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

      const response = await axios.patch<Employee>(`/Employees/${id}`, payload);
      return response.data;
    } catch (error) {
      console.error("Error in EmployeeService.update:", error);
      throw error;
    }
  },

  async delete(id: number): Promise<void> {
    await axios.delete(`/Employees/${id}`);
  },

  async getById(id: number): Promise<Employee> {
    const response = await axios.get(`/Employees/${id}`);
    return response.data;
  }
};