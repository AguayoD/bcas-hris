import axios from 'axios';
import { Contract } from '../types/tblContracts';

const API_URL = "https://localhost:7245/api/Contracts";

export const ContractService = {
  async getByEmployeeId(employeeId: number): Promise<Contract[]> {
    const response = await axios.get(`${API_URL}/employee/${employeeId}`);
    return response.data;
  },

  async getById(contractId: number): Promise<Contract> {
    const response = await axios.get(`${API_URL}/${contractId}`);
    return response.data;
  },

  async upload(
  employeeId: number, 
  file: File, 
  contractData: {
    contractType: string;
    contractStartDate: string;
    contractEndDate?: string; // Make optional
    lastUpdatedBy: number;
  }
): Promise<Contract> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('employeeID', employeeId.toString());
  formData.append('contractType', contractData.contractType);
  formData.append('contractStartDate', contractData.contractStartDate);
  
  // Only append contractEndDate if it exists
  if (contractData.contractEndDate) {
    formData.append('contractEndDate', contractData.contractEndDate);
  } else {
    // Or append empty string if API requires the field
    formData.append('contractEndDate', '');
  }
  
  formData.append('lastUpdatedBy', contractData.lastUpdatedBy.toString());

  console.log('FormData contents:');
  for (let pair of formData.entries()) {
    console.log(pair[0] + ': ' + pair[1]);
  }

  const response = await axios.post(API_URL, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
},

  async update(
    contractId: number,
    contractData: {
      contractType?: string;
      contractStartDate?: string;
      contractEndDate?: string;
      lastUpdatedBy: number;
      file?: File;
    }
  ): Promise<Contract> {
    const formData = new FormData();
    
    if (contractData.contractType) {
      formData.append('contractType', contractData.contractType);
    }
    if (contractData.contractStartDate) {
      formData.append('contractStartDate', contractData.contractStartDate);
    }
    if (contractData.contractEndDate) {
      formData.append('contractEndDate', contractData.contractEndDate);
    }
    if (contractData.file) {
      formData.append('file', contractData.file);
    }
    formData.append('lastUpdatedBy', contractData.lastUpdatedBy.toString());

    const response = await axios.put(`${API_URL}/${contractId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async download(contractId: number): Promise<Blob> {
    const response = await axios.get(`${API_URL}/${contractId}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },

  delete: async (id: number) => {
  return axios.delete(`Contracts/${id}`);
},
};

export default ContractService;