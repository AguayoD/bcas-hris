import { EducationalAttainmentTypes } from "../types/tblEducationalAttainment";
import axios from '../api/_axiosInstance';

const API_URL = '/EducationalAttainment';

export const EducationalAttainmentService = {
  getAll: async (): Promise<EducationalAttainmentTypes[]> => {
    try {
      const response = await axios.get(API_URL);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching educational attainments:', error);
      const errorMessage = error.response?.data?.message || 
                          error.response?.data ||
                          error.message ||
                          'Failed to fetch educational attainments';
      throw new Error(errorMessage);
    }
  },

  getById: async (id: number): Promise<EducationalAttainmentTypes> => {
    try {
      const response = await axios.get(`${API_URL}/${id}`);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching educational attainment:', error);
      const errorMessage = error.response?.data?.message || 
                          error.response?.data ||
                          error.message ||
                          'Failed to fetch educational attainment';
      throw new Error(errorMessage);
    }
  },

  create: async (attainment: Omit<EducationalAttainmentTypes, 'educationalAttainmentID'>): Promise<EducationalAttainmentTypes> => {
    try {
      // Only send the fields that the stored procedure expects
      const createData = {
        attainmentName: attainment.attainmentName,
        description: attainment.description || null,
        isActive: attainment.isActive
      };
      
      const response = await axios.post(API_URL, createData);
      return response.data;
    } catch (error: any) {
      console.error('Error creating educational attainment:', error);
      const errorMessage = error.response?.data?.message || 
                          error.response?.data ||
                          error.message ||
                          'Failed to create educational attainment';
      throw new Error(errorMessage);
    }
  },

  update: async (id: number, attainment: EducationalAttainmentTypes): Promise<EducationalAttainmentTypes> => {
    try {
      // Only send the fields that the stored procedure expects
      const updateData = {
        attainmentName: attainment.attainmentName,
        description: attainment.description,
        isActive: attainment.isActive
      };
      
      const response = await axios.patch(`${API_URL}/${id}`, updateData);
      return response.data;
    } catch (error: any) {
      console.error('Error updating educational attainment:', error);
      const errorMessage = error.response?.data?.message || 
                          error.response?.data ||
                          error.message ||
                          'Failed to update educational attainment';
      throw new Error(errorMessage);
    }
  },

  delete: async (id: number): Promise<void> => {
    try {
      await axios.delete(`${API_URL}/${id}`);
    } catch (error: any) {
      console.error('Error deleting educational attainment:', error);
      const errorMessage = error.response?.data?.message || 
                          error.response?.data ||
                          error.message ||
                          'Failed to delete educational attainment';
      throw new Error(errorMessage);
    }
  },
};