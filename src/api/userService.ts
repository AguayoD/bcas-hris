import { tblUsersTypes } from "../types/tblUsers";
import axios from '../api/_axiosInstance';
import {
  ForgotPasswordDTO,
  ResetPasswordDTO,
  UserChangePasswordDTO
} from "../types/auth";

const UserService = {
  getAll: async (): Promise<any[]> => {
    try {
      const response = await axios.get('/Users');
      return response.data;
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  },

  getById: async (userId: number): Promise<any> => {
    try {
      const response = await axios.get(`/Users/${userId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching user ${userId}:`, error);
      throw error;
    }
  },

  create: async (userData: tblUsersTypes): Promise<any> => {
    try {
      const response = await axios.post('/Users', userData);
      return response.data;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  },

  update: async (userId: number, userData: any): Promise<any> => {
    try {
      const response = await axios.put(`/Users/${userId}`, userData);
      return response.data;
    } catch (error) {
      console.error(`Error updating user ${userId}:`, error);
      throw error;
    }
  },

  delete: async (userId: number): Promise<any> => {
    try {
      const response = await axios.delete(`/Users/${userId}`);
      return response.data;
    } catch (error: any) {
      console.error(`Error deleting user ${userId}:`, error);
      
      if (error.response?.status === 400) {
        const errorMessage = error.response?.data?.message || error.response?.data || 'Cannot delete user due to database constraints';
        throw new Error(errorMessage);
      }
      
      throw error;
    }
  },

  checkCanDelete: async (userId: number): Promise<boolean> => {
    try {
      const response = await axios.get(`/Users/${userId}/can-delete`);
      return response.data;
    } catch (error) {
      console.error(`Error checking if user ${userId} can be deleted:`, error);
      return false;
    }
  },

  getByEmployeeId: async (employeeId: number): Promise<any[]> => {
    try {
      const allUsers = await UserService.getAll();
      return allUsers.filter(user => user.employeeId === employeeId);
    } catch (error) {
      console.error(`Error fetching users for employee ${employeeId}:`, error);
      throw error;
    }
  },
  
  createUserForEmployee: async (userData: tblUsersTypes): Promise<any> => {
    try {
      const response = await axios.post('/Users', userData);
      return response.data;
    } catch (error: any) {
      console.error('Error creating user for employee:', error);
      
      if (error.response?.status === 409) {
        throw new Error('Username already exists. Please choose a different username.');
      }
      
      if (error.response?.status === 400) {
        const errorMessage = error.response?.data?.message || error.response?.data || 'Invalid user data';
        throw new Error(errorMessage);
      }
      
      throw new Error('Failed to create user account. Please try again.');
    }
  },

  forgotPassword: async (email: string): Promise<any> => {
    try {
      const dto: ForgotPasswordDTO = { email };
      const response = await axios.post('/Users/forgot-password', dto);
      return response.data;
    } catch (error: any) {
      console.error("Error requesting password reset:", error);
      
      if (error.response?.status === 405 || error.response?.status === 404) {
        return { message: "If an account exists, a reset link has been sent." };
      }
      
      throw error;
    }
  },

  resetPassword: async (token: string, newPassword: string): Promise<any> => {
    try {
      const dto: ResetPasswordDTO = { token, newPassword };
      const response = await axios.post('/Users/reset-password', dto);
      return response.data;
    } catch (error: any) {
      console.error("Error resetting password:", error);
      
      if (error.response?.status === 400) {
        const errorMessage = error.response?.data?.message || error.response?.data || 'Invalid request';
        throw new Error(errorMessage);
      }
      
      throw error;
    }
  },

  changePassword: async (dto: UserChangePasswordDTO): Promise<any> => {
    try {
      const response = await axios.post('/Users/change-password', dto);
      return response.data;
    } catch (error) {
      console.error("Error changing password:", error);
      throw error;
    }
  },

  activateUser: async (userId: number): Promise<any> => {
    try {
      const response = await axios.patch(`/Users/${userId}/activate`);
      return response.data;
    } catch (error) {
      console.error(`Error activating user ${userId}:`, error);
      throw error;
    }
  },

  deactivateUser: async (userId: number): Promise<any> => {
    try {
      const response = await axios.patch(`/Users/${userId}/deactivate`);
      return response.data;
    } catch (error) {
      console.error(`Error deactivating user ${userId}:`, error);
      throw error;
    }
  }
};

export default UserService;