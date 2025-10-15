// api/EducationalAttainmentService.ts
import { EducationalAttainmentTypes } from "../types/tblEducationalAttainment";

const API_BASE_URL = 'https://localhost:7245/api';
const API_URL = API_BASE_URL + '/EducationalAttainment';

export const EducationalAttainmentService = {
  getAll: async (): Promise<EducationalAttainmentTypes[]> => {
    const response = await fetch(`${API_URL}`);
    if (!response.ok) {
      throw new Error('Failed to fetch educational attainments');
    }
    return response.json();
  },

  getById: async (id: number): Promise<EducationalAttainmentTypes> => {
    const response = await fetch(`${API_URL}/${id}`);
    if (!response.ok) {
      throw new Error('Failed to fetch educational attainment');
    }
    return response.json();
  },

  create: async (attainment: Omit<EducationalAttainmentTypes, 'educationalAttainmentID'>): Promise<EducationalAttainmentTypes> => {
    const response = await fetch(`${API_URL}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(attainment),
    });
    if (!response.ok) {
      throw new Error('Failed to create educational attainment');
    }
    return response.json();
  },

  update: async (id: number, attainment: EducationalAttainmentTypes): Promise<EducationalAttainmentTypes> => {
  const response = await fetch(`${API_URL}/${id}`, {
    method: 'PATCH', // Changed back to PATCH to match backend
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(attainment),
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Update error:', errorText);
    throw new Error('Failed to update educational attainment');
  }
  return response.json();
},
   delete: async (id: number): Promise<void> => {
    console.log('Attempting to delete educational attainment with ID:', id);
    
    const response = await fetch(`${API_URL}/${id}`, {
      method: 'DELETE',
    });
    
    console.log('Delete response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Delete error details:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      
      // Provide more specific error messages
      if (response.status === 400) {
        throw new Error('Cannot delete: This educational attainment may be referenced by other records');
      } else if (response.status === 404) {
        throw new Error('Educational attainment not found');
      } else {
        throw new Error(`Failed to delete educational attainment: ${response.statusText}`);
      }
    }
    
  },
};