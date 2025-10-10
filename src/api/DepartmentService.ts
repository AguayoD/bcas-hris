import { DepartmentTypes } from "../types/tblDepartment";
import axios from "axios";

const API_URL = "https://localhost:7245/api";

const DepartmentService = {
  getAll: async (): Promise<DepartmentTypes[]> => {
    try {
      const response = await axios.get(`${API_URL}/Department?timestamp=${Date.now()}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching departments:", error);
      throw error;
    }
  },

  getById: async (departmentId: number): Promise<DepartmentTypes> => {
    try {
      const response = await axios.get(`${API_URL}/Department/${departmentId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching department ${departmentId}:`, error);
      throw error;
    }
  },

  create: async (departmentData: DepartmentTypes): Promise<DepartmentTypes> => {
    try {
      const response = await axios.post(`${API_URL}/Department`, departmentData);
      // Add notification after creation
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
        `${API_URL}/Department/${departmentId}`,
        departmentData
      );
      // Add notification after update
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
      await axios.delete(`${API_URL}/Department/${departmentId}`);
      // Add notification after deletion
      window.dispatchEvent(new CustomEvent('departments-updated', {
        detail: { action: 'delete', departmentId }
      }));
    } catch (error) {
      console.error(`Error deleting department ${departmentId}:`, error);
      throw error;
    }
  },

  // Keep this for manual notifications if needed
  notifyChange: () => {
    window.dispatchEvent(new CustomEvent('departments-updated', {
      detail: { action: 'manual-refresh' }
    }));
  }
};

export default DepartmentService;