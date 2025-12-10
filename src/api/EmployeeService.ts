import axios from './_axiosInstance';
import { Employee } from '../types/tblEmployees';

export interface PendingUpdate {
  pendingUpdateID: string; // Using string ID for localStorage
  employeeID: number;
  updateData: Partial<Employee>;
  originalData: Partial<Employee>; // Store original data for comparison/rejection
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: number;
  reviewerName?: string;
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

  // LocalStorage-based methods for pending updates
  submitUpdateRequest(employeeID: number, updateData: Partial<Employee>, originalData: Partial<Employee>): PendingUpdate {
    const pendingUpdates = this.getPendingUpdatesFromStorage();
    const newUpdate: PendingUpdate = {
      pendingUpdateID: `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      employeeID,
      updateData,
      originalData,
      status: 'pending',
      submittedAt: new Date().toISOString()
    };
    
    pendingUpdates.push(newUpdate);
    this.savePendingUpdatesToStorage(pendingUpdates);
    return newUpdate;
  },

  getPendingUpdates(): PendingUpdate[] {
    return this.getPendingUpdatesFromStorage().filter(update => update.status === 'pending');
  },

  getAllUpdates(): PendingUpdate[] {
    return this.getPendingUpdatesFromStorage();
  },

  getPendingUpdateById(id: string): PendingUpdate | undefined {
    const updates = this.getPendingUpdatesFromStorage();
    return updates.find(update => update.pendingUpdateID === id);
  },

  approveUpdate(pendingUpdateID: string, reviewedBy: number, reviewerName: string): { pendingUpdate: PendingUpdate; employee: Employee | null } {
    const updates = this.getPendingUpdatesFromStorage();
    const updateIndex = updates.findIndex(update => update.pendingUpdateID === pendingUpdateID);
    
    if (updateIndex === -1) {
      throw new Error('Update request not found');
    }

    const updatedUpdate = {
      ...updates[updateIndex],
      status: 'approved' as const,
      reviewedAt: new Date().toISOString(),
      reviewedBy,
      reviewerName
    };

    updates[updateIndex] = updatedUpdate;
    this.savePendingUpdatesToStorage(updates);

    // Return the approved update data, but note: actual employee update still needs to be done via API
    return { pendingUpdate: updatedUpdate, employee: null };
  },

  rejectUpdate(pendingUpdateID: string, reviewedBy: number, reviewerName: string): PendingUpdate {
    const updates = this.getPendingUpdatesFromStorage();
    const updateIndex = updates.findIndex(update => update.pendingUpdateID === pendingUpdateID);
    
    if (updateIndex === -1) {
      throw new Error('Update request not found');
    }

    const updatedUpdate = {
      ...updates[updateIndex],
      status: 'rejected' as const,
      reviewedAt: new Date().toISOString(),
      reviewedBy,
      reviewerName
    };

    updates[updateIndex] = updatedUpdate;
    this.savePendingUpdatesToStorage(updates);

    return updatedUpdate;
  },

  getEmployeeHistory(employeeID: number): PendingUpdate[] {
    const updates = this.getPendingUpdatesFromStorage();
    return updates.filter(update => update.employeeID === employeeID);
  },

  clearOldUpdates(): void {
    // Keep only updates from the last 30 days
    const updates = this.getPendingUpdatesFromStorage();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const filteredUpdates = updates.filter(update => 
      new Date(update.submittedAt) > thirtyDaysAgo
    );
    
    this.savePendingUpdatesToStorage(filteredUpdates);
  },

  // Helper methods for localStorage
  getPendingUpdatesFromStorage(): PendingUpdate[] {
    try {
      const stored = localStorage.getItem('pending_employee_updates');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error reading pending updates from localStorage:', error);
      return [];
    }
  },

  savePendingUpdatesToStorage(updates: PendingUpdate[]): void {
    try {
      localStorage.setItem('pending_employee_updates', JSON.stringify(updates));
    } catch (error) {
      console.error('Error saving pending updates to localStorage:', error);
    }
  }
};
