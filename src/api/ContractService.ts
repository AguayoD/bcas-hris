import axios from 'axios';
import { Contract } from '../types/tblContracts';

const API_URL = "https://localhost:7245/api/Contracts";

export const ContractService = {
  async getByEmployeeId(employeeId: number): Promise<Contract[]> {
    try {
      const response = await axios.get(`${API_URL}/employee/${employeeId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching contracts for employee ${employeeId}:`, error);
      throw error;
    }
  },

  async getById(contractId: number): Promise<Contract> {
    try {
      const response = await axios.get(`${API_URL}/${contractId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching contract ${contractId}:`, error);
      throw error;
    }
  },

  async upload(
    employeeId: number, 
    file: File, 
    contractData: {
      contractType: string;
      contractStartDate: string;
      contractEndDate?: string;
      lastUpdatedBy: number;
      contractCategory?: string;
    }
  ): Promise<Contract> {
    try {
      // Validate file type on client side before upload
      const isPdf = file.type === 'application/pdf';
      const isImage = file.type.startsWith('image/');
      const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
      
      const isAllowedType = isPdf || (isImage && allowedImageTypes.includes(file.type));
      
      if (!isAllowedType) {
        throw new Error('Only PDF and image files (JPG, PNG, GIF, WebP, BMP) are allowed');
      }

      // Validate file size (10MB limit)
      const maxSize = 10 * 1024 * 1024; // 10MB in bytes
      if (file.size > maxSize) {
        throw new Error('File must be smaller than 10MB');
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('employeeID', employeeId.toString());
      formData.append('contractType', contractData.contractType);
      formData.append('contractStartDate', contractData.contractStartDate);
      
      if (contractData.contractEndDate) {
        formData.append('contractEndDate', contractData.contractEndDate);
      } else {
        formData.append('contractEndDate', '');
      }
      
      formData.append('lastUpdatedBy', contractData.lastUpdatedBy.toString());

       if (contractData.contractCategory) {
      formData.append('contractCategory', contractData.contractCategory);
    }

      const response = await axios.post(API_URL, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error uploading contract:', error);
      throw error;
    }
  },

  async update(
    contractId: number,
    contractData: {
      contractType?: string;
      contractStartDate?: string;
      contractEndDate?: string;
      lastUpdatedBy: number;
      file?: File;
      contractCategory?: string;
    }
  ): Promise<Contract> {
    try {
      // Validate file type if a new file is provided
      if (contractData.file) {
        const file = contractData.file;
        const isPdf = file.type === 'application/pdf';
        const isImage = file.type.startsWith('image/');
        const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
        
        const isAllowedType = isPdf || (isImage && allowedImageTypes.includes(file.type));
        
        if (!isAllowedType) {
          throw new Error('Only PDF and image files (JPG, PNG, GIF, WebP, BMP) are allowed');
        }

        // Validate file size (10MB limit)
        const maxSize = 10 * 1024 * 1024; // 10MB in bytes
        if (file.size > maxSize) {
          throw new Error('File must be smaller than 10MB');
        }
      }

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

      if (contractData.contractCategory) {
      formData.append('contractCategory', contractData.contractCategory);
    }

      const response = await axios.put(`${API_URL}/${contractId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      console.error(`Error updating contract ${contractId}:`, error);
      throw error;
    }
  },

  async download(contractId: number): Promise<Blob> {
    try {
      const response = await axios.get(`${API_URL}/${contractId}/download`, {
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      console.error(`Error downloading contract ${contractId}:`, error);
      throw error;
    }
  },

  async getFileUrl(contractId: number): Promise<{ fileUrl: string; fileName: string; fileType: string }> {
    try {
      const response = await axios.get(`${API_URL}/${contractId}/fileurl`);
      return response.data;
    } catch (error) {
      console.error(`Error getting file URL for contract ${contractId}:`, error);
      throw error;
    }
  },

  async getFileBlob(contractId: number): Promise<{ blob: Blob; fileName: string; fileType: string }> {
    try {
      const response = await axios.get(`${API_URL}/${contractId}/download`, {
        responseType: 'blob',
      });
      
      // Extract filename from content-disposition header
      const contentDisposition = response.headers['content-disposition'];
      let fileName = 'contract';
      if (contentDisposition) {
        const fileNameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (fileNameMatch && fileNameMatch[1]) {
          fileName = fileNameMatch[1];
        }
      }
      
      // Determine file type from blob or filename
      let fileType = response.headers['content-type'] || '';
      if (!fileType && fileName) {
        if (fileName.endsWith('.pdf')) fileType = 'application/pdf';
        else if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) fileType = 'image/jpeg';
        else if (fileName.endsWith('.png')) fileType = 'image/png';
        else if (fileName.endsWith('.gif')) fileType = 'image/gif';
        else if (fileName.endsWith('.webp')) fileType = 'image/webp';
        else if (fileName.endsWith('.bmp')) fileType = 'image/bmp';
      }
      
      return {
        blob: response.data,
        fileName,
        fileType
      };
    } catch (error) {
      console.error(`Error getting file blob for contract ${contractId}:`, error);
      throw error;
    }
  },

  async downloadDirect(contractId: number, fileName: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const downloadUrl = `${API_URL}/${contractId}/download`;
        
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = fileName;
        link.target = '_blank';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setTimeout(() => resolve(), 100);
      } catch (error) {
        console.error(`Error in direct download for contract ${contractId}:`, error);
        reject(error);
      }
    });
  },

  async delete(contractId: number): Promise<void> {
    try {
      const response = await axios.delete(`${API_URL}/${contractId}`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting contract ${contractId}:`, error);
      throw error;
    }
  },
};

export default ContractService;