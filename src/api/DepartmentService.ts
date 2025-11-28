import { DepartmentTypes } from "../types/tblDepartment";
import axios from "../api/_axiosInstance";

const API_URL = "/Department";

const DepartmentService = {
  getAll: async (): Promise<DepartmentTypes[]> => {
    try {
      const response = await axios.get(API_URL);
      return response.data;
    } catch (error) {
      console.error("Error fetching departments:", error);
      throw error;
    }
  },

  getById: async (departmentId: number): Promise<DepartmentTypes> => {
    try {
      const response = await axios.get(`${API_URL}/${departmentId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching department ${departmentId}:`, error);
      throw error;
    }
  },

  create: async (departmentData: DepartmentTypes): Promise<DepartmentTypes> => {
    try {
      const response = await axios.post(API_URL, departmentData);
      window.dispatchEvent(new CustomEvent('departments-updated', {
        detail: { action: 'create', department: response.data }
      }));
      return response.data;
    } catch (error) {
      console.error("Error creating department:", error);
      throw error;
    }
  },

  update: async (departmentId: number, departmentData: Partial<DepartmentTypes>): Promise<DepartmentTypes> => {
    try {
      const response = await axios.patch(
        `${API_URL}/${departmentId}`,
        departmentData
      );
      window.dispatchEvent(new CustomEvent('departments-updated', {
        detail: { action: 'update', department: response.data }
      }));
      return response.data;
    } catch (error) {
      console.error(`Error updating department ${departmentId}:`, error);
      throw error;
    }
  },

  delete: async (departmentId: number): Promise<void> => {
    try {
      await axios.delete(`${API_URL}/${departmentId}`);
      window.dispatchEvent(new CustomEvent('departments-updated', {
        detail: { action: 'delete', departmentId }
      }));
    } catch (error) {
      console.error(`Error deleting department ${departmentId}:`, error);
      throw error;
    }
  },

  notifyChange: () => {
    window.dispatchEvent(new CustomEvent('departments-updated', {
      detail: { action: 'manual-refresh' }
    }));
  }
};

export default DepartmentService;