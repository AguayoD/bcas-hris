import { EmploymentStatusTypes } from "../types/tblEmploymentStatus";
import axios from '../api/_axiosInstance';

const API_URL = '/EmploymentStatus';

export const EmploymentStatusService = {
  getAll: async (): Promise<EmploymentStatusTypes[]> => {
    try {
      const response = await axios.get(API_URL);
      return response.data;
    } catch (error) {
      console.error('Error fetching employment statuses:', error);
      throw error;
    }
  },

  getById: async (id: number): Promise<EmploymentStatusTypes> => {
    try {
      const response = await axios.get(`${API_URL}/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching employment status:', error);
      throw error;
    }
  },

  create: async (status: Omit<EmploymentStatusTypes, 'employmentStatusID'>): Promise<EmploymentStatusTypes> => {
    try {
      const response = await axios.post(API_URL, status);
      return response.data;
    } catch (error) {
      console.error('Error creating employment status:', error);
      throw error;
    }
  },

  update: async (id: number, status: EmploymentStatusTypes): Promise<EmploymentStatusTypes> => {
    try {
      const response = await axios.patch(`${API_URL}/${id}`, status);
      return response.data;
    } catch (error: any) {
      console.error('Error updating employment status:', error);
      if (error.response?.status === 400) {
        throw new Error(error.response.data.message || 'Failed to update employment status');
      }
      throw error;
    }
  },

  delete: async (id: number): Promise<void> => {
    try {
      await axios.delete(`${API_URL}/${id}`);
    } catch (error: any) {
      console.error('Error deleting employment status:', error);
      if (error.response?.status === 400) {
        throw new Error('Cannot delete: This employment status may be referenced by other records');
      } else if (error.response?.status === 404) {
        throw new Error('Employment status not found');
      } else {
        throw new Error(`Failed to delete employment status: ${error.response?.statusText || 'Unknown error'}`);
      }
    }
  },
};