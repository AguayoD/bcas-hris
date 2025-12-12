import axios from './_axiosInstance';
import { Employee } from '../types/tblEmployees';
import dayjs from 'dayjs';

export interface PendingUpdate {
  pendingUpdateID: number;
  employeeID: number;
  updateData: Record<string, any>;
  originalData: Record<string, any>;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: number;
  reviewerName?: string;
  comments?: string;
  employee?: Employee;
}

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
  },

  // Server-based methods for pending updates
  async submitUpdateRequest(employeeID: number, updateData: Partial<Employee>, _originalData: Record<string, any>): Promise<PendingUpdate> {
    console.log('=== DEBUG: Submitting update request ===');
    console.log('Employee ID:', employeeID);
    console.log('Raw update data:', updateData);
    
    // Convert to dictionary format
    const updateDict: Record<string, any> = {};
    Object.keys(updateData).forEach(key => {
      if (updateData[key as keyof Employee] !== undefined && updateData[key as keyof Employee] !== null) {
        const value = updateData[key as keyof Employee];
        updateDict[key] = value;
        
        // Log date fields specifically
        if (key.toLowerCase().includes('date') || key === 'yearGraduated' || key === 'hireDate') {
          console.log(`Date field ${key}:`, {
            value: value,
            type: typeof value,
            isDayjs: dayjs.isDayjs(value),
            formatted: dayjs.isDayjs(value) ? dayjs(value).format('YYYY-MM-DD') : value
          });
        }
      }
    });
    
    console.log('Update dict to send:', updateDict);
    console.log('Update dict keys:', Object.keys(updateDict));
    
    try {
      const response = await axios.post('/PendingEmployeeUpdates', {
        employeeId: employeeID,
        updateData: updateDict
      });
      console.log('Submit response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Error submitting update:', error);
      console.error('Error response:', error.response?.data);
      
      if (error.response?.status === 400) {
        const errorMessage = error.response?.data?.message || error.response?.data?.details || "No changes detected";
        if (errorMessage.includes("No changes detected")) {
          throw new Error("No changes detected. The values you entered are the same as the current values.");
        }
        throw new Error(errorMessage);
      } else if (error.response?.status === 404) {
        throw new Error("Employee not found. Please refresh the page and try again.");
      } else if (error.response?.status === 500) {
        throw new Error("Server error. Please try again later.");
      }
      
      throw error;
    }
  },

  async getPendingUpdates(): Promise<PendingUpdate[]> {
    try {
      const response = await axios.get('/PendingEmployeeUpdates/pending');
      return response.data;
    } catch (error) {
      console.error('Error fetching pending updates:', error);
      throw error;
    }
  },

  async getAllUpdates(): Promise<PendingUpdate[]> {
    try {
      const response = await axios.get('/PendingEmployeeUpdates');
      return response.data;
    } catch (error) {
      console.error('Error fetching all updates:', error);
      throw error;
    }
  },

  async getPendingUpdateById(id: number): Promise<PendingUpdate> {
    try {
      const response = await axios.get(`/PendingEmployeeUpdates/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching pending update by ID:', error);
      throw error;
    }
  },

  async getEmployeeHistory(employeeID: number): Promise<PendingUpdate[]> {
    try {
      const response = await axios.get(`/PendingEmployeeUpdates/employee/${employeeID}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching employee history:', error);
      throw error;
    }
  },

  async approveUpdate(pendingUpdateID: number, comments?: string): Promise<PendingUpdate> {
    try {
      console.log('=== DEBUG: Approving update ===');
      console.log('PendingUpdateID:', pendingUpdateID);
      console.log('Comments:', comments);
      
      const response = await axios.post(`/PendingEmployeeUpdates/${pendingUpdateID}/approve`, {
        comments: comments || "Approved by reviewer"
      });
      
      console.log('Approve response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Error approving update:', error);
      console.error('Error response:', error.response?.data);
      
      if (error.response?.status === 400) {
        throw new Error(error.response?.data || "Invalid request. Please check the update ID.");
      } else if (error.response?.status === 404) {
        throw new Error("Update request not found. It may have been already processed.");
      } else if (error.response?.status === 500) {
        throw new Error("Server error while approving update. Please try again.");
      }
      
      throw error;
    }
  },

  async rejectUpdate(pendingUpdateID: number, comments?: string): Promise<PendingUpdate> {
    try {
      const response = await axios.post(`/PendingEmployeeUpdates/${pendingUpdateID}/reject`, {
        comments: comments || "Rejected by reviewer"
      });
      return response.data;
    } catch (error: any) {
      console.error('Error rejecting update:', error);
      
      if (error.response?.status === 400) {
        throw new Error(error.response?.data || "Invalid request. Please check the update ID.");
      } else if (error.response?.status === 404) {
        throw new Error("Update request not found. It may have been already processed.");
      } else if (error.response?.status === 500) {
        throw new Error("Server error while rejecting update. Please try again.");
      }
      
      throw error;
    }
  },

  async cleanupOldUpdates(): Promise<void> {
    try {
      await axios.delete('/PendingEmployeeUpdates/cleanup');
    } catch (error) {
      console.error('Error cleaning up old updates:', error);
      throw error;
    }
  },

  // Helper method to check if there are actual changes
  async hasChanges(employeeID: number, updateData: Partial<Employee>): Promise<boolean> {
    try {
      const currentEmployee = await this.getById(employeeID);
      
      // Compare each field
      for (const key in updateData) {
        const newValue = updateData[key as keyof Employee];
        const currentValue = currentEmployee[key as keyof Employee];
        
        // Skip if both are null/undefined
        if (newValue == null && currentValue == null) continue;
        
        // If one is null/undefined and the other isn't, there's a change
        if (newValue == null || currentValue == null) return true;
        
        // Convert to string for comparison
        const newString = newValue.toString().trim();
        const currentString = currentValue.toString().trim();
        
        // For dates, compare in YYYY-MM-DD format
        if (key.includes('Date') || key.includes('date') || key === 'yearGraduated' || key === 'hireDate') {
          try {
            const newDate = dayjs(newString).format('YYYY-MM-DD');
            const currentDate = dayjs(currentString).format('YYYY-MM-DD');
            if (newDate !== currentDate) return true;
          } catch {
            // If date parsing fails, do string comparison
            if (newString !== currentString) return true;
          }
        } else {
          // Regular string comparison
          if (newString !== currentString) return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Error checking for changes:', error);
      return true; // Assume there are changes if we can't check
    }
  },

  // Method to prepare update data (filters out unchanged fields)
  async prepareUpdateData(employeeID: number, updateData: Partial<Employee>): Promise<Partial<Employee>> {
    try {
      const currentEmployee = await this.getById(employeeID);
      const preparedData: Partial<Employee> = {};
      
      for (const key in updateData) {
        const newValue = updateData[key as keyof Employee];
        const currentValue = currentEmployee[key as keyof Employee];
        
        // Skip if both are null/undefined
        if (newValue == null && currentValue == null) continue;
        
        // If one is null/undefined and the other isn't, include it
        if (newValue == null || currentValue == null) {
          preparedData[key as keyof Employee] = newValue as any;
          continue;
        }
        
        // Convert to string for comparison
        const newString = newValue.toString().trim();
        const currentString = currentValue.toString().trim();
        
        // For dates, compare in YYYY-MM-DD format
        let isDifferent = false;
        if (key.includes('Date') || key.includes('date') || key === 'yearGraduated' || key === 'hireDate') {
          try {
            const newDate = dayjs(newString).format('YYYY-MM-DD');
            const currentDate = dayjs(currentString).format('YYYY-MM-DD');
            isDifferent = newDate !== currentDate;
          } catch {
            // If date parsing fails, do string comparison
            isDifferent = newString !== currentString;
          }
        } else {
          // Regular string comparison
          isDifferent = newString !== currentString;
        }
        
        if (isDifferent) {
          preparedData[key as keyof Employee] = newValue as any;
        }
      }
      
      console.log('Prepared update data (filtered):', preparedData);
      return preparedData;
    } catch (error) {
      console.error('Error preparing update data:', error);
      return updateData; // Return original if we can't filter
    }
  },

  // Debug method to check employee data
  async debugEmployee(id: number): Promise<any> {
    try {
      const response = await axios.get(`/PendingEmployeeUpdates/debug/employee/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error debugging employee:', error);
      throw error;
    }
  }
};