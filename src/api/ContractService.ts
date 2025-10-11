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
      contractEndDate?: string;
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
      // Append empty string if API requires the field
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
    if (contractData.contractEndDate !== undefined) {
      formData.append('contractEndDate', contractData.contractEndDate || '');
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

  async getFileUrl(contractId: number): Promise<{ fileUrl: string; fileName: string; fileType: string }> {
    const response = await axios.get(`${API_URL}/${contractId}/fileurl`);
    return response.data;
  },

  async downloadDirect(contractId: number, fileName: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        // Remove unused fileInfo variable
        await this.getFileUrl(contractId);
        
        // Use the API download URL
        const downloadUrl = `${API_URL}/${contractId}/download`;
        
        // Create a temporary link and trigger download
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = fileName;
        link.target = '_blank';
        
        // Add to DOM, click, and remove
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Small delay to ensure download starts
        setTimeout(() => resolve(), 100);
      } catch (error) {
        reject(error);
      }
    });
  },

  async delete(contractId: number): Promise<void> {
    const response = await axios.delete(`${API_URL}/${contractId}`);
    return response.data;
  },
};

export default ContractService;