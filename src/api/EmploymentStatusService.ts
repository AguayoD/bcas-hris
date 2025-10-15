import { EmploymentStatusTypes } from "../types/tblEmploymentStatus";

const API_BASE_URL = 'https://localhost:7245/api';
const API_URL = API_BASE_URL + '/EmploymentStatus';

export const EmploymentStatusService = {
  getAll: async (): Promise<EmploymentStatusTypes[]> => {
    const response = await fetch(`${API_URL}`);
    if (!response.ok) {
      throw new Error('Failed to fetch employment statuses');
    }
    return response.json();
  },

  getById: async (id: number): Promise<EmploymentStatusTypes> => {
    const response = await fetch(`${API_URL}/${id}`);
    if (!response.ok) {
      throw new Error('Failed to fetch employment status');
    }
    return response.json();
  },

  create: async (status: Omit<EmploymentStatusTypes, 'employmentStatusID'>): Promise<EmploymentStatusTypes> => {
    const response = await fetch(`${API_URL}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(status),
    });
    if (!response.ok) {
      throw new Error('Failed to create employment status');
    }
    return response.json();
  },

update: async (id: number, status: EmploymentStatusTypes): Promise<EmploymentStatusTypes> => {
  console.log('Attempting to update employment status:', { id, status });
  
  const response = await fetch(`${API_URL}/${id}`, {
    method: 'PATCH', // Changed back to PATCH to match backend
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(status),
  });
  
  console.log('Update response status:', response.status);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Update error details:', {
      status: response.status,
      statusText: response.statusText,
      error: errorText
    });
    throw new Error(`Failed to update employment status: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
},

  delete: async (id: number): Promise<void> => {
  console.log('Attempting to delete employment status with ID:', id);
  
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
    throw new Error(`Failed to delete employment status: ${response.status} ${response.statusText}`);
  }
  
},
};