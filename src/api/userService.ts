import { tblUsersTypes } from "../types/tblUsers";
import axios from 'axios';
import {
  ForgotPasswordDTO,
  ResetPasswordDTO,
  UserChangePasswordDTO
} from "../types/auth";

const API_URL = 'https://localhost:7245/api';

const UserService = {
  getAll: async (): Promise<any[]> => {
    try {
      const response = await axios.get(`${API_URL}/Users`);
      return response.data;
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  },

  getById: async (userId: number): Promise<any> => {
    try {
      const response = await axios.get(`${API_URL}/Users/${userId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching user ${userId}:`, error);
      throw error;
    }
  },

  create: async (userData: tblUsersTypes): Promise<any> => {
    try {
      const response = await axios.post(`${API_URL}/Users`, userData);
      return response.data;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  },

  update: async (userId: number, userData: any): Promise<any> => {
    try {
      const response = await axios.put(`${API_URL}/Users/${userId}`, userData);
      return response.data;
    } catch (error) {
      console.error(`Error updating user ${userId}:`, error);
      throw error;
    }
  },

  delete: async (userId: number): Promise<any> => {
    try {
      const response = await axios.delete(`${API_URL}/Users/${userId}`);
      return response.data;
    } catch (error: any) {
      console.error(`Error deleting user ${userId}:`, error);
      
      // Enhanced error handling for foreign key constraints
      if (error.response?.status === 400) {
        const errorMessage = error.response?.data?.message || error.response?.data || 'Cannot delete user due to database constraints';
        throw new Error(errorMessage);
      }
      
      throw error;
    }
  },
  

  // New method to check if user can be deleted
  checkCanDelete: async (userId: number): Promise<boolean> => {
    try {
      const response = await axios.get(`${API_URL}/Users/${userId}/can-delete`);
      return response.data;
    } catch (error) {
      console.error(`Error checking if user ${userId} can be deleted:`, error);
      return false;
    }
  },

  // New method to get users by employee ID
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
      const response = await axios.post(`${API_URL}/Users`, userData);
      return response.data;
    } catch (error) {
      console.error('Error creating user for employee:', error);
      throw error;
    }
  },
  //Forgot Password
    forgotPassword: async (email: string): Promise<any> => {
    try {
      const dto: ForgotPasswordDTO = { email };
      const response = await axios.post(`${API_URL}/Users/forgot-password`, dto);
      return response.data;
    } catch (error) {
      console.error("Error requesting password reset:", error);
      throw error;
    }
  },

  // Reset Password via token
  resetPassword: async (token: string, newPassword: string): Promise<any> => {
    try {
      const dto: ResetPasswordDTO = { token, newPassword };
      const response = await axios.post(`${API_URL}/Users/reset-password`, dto);
      return response.data;
    } catch (error) {
      console.error("Error resetting password:", error);
      throw error;
    }
  },

  // Change Password
  changePassword: async (dto: UserChangePasswordDTO): Promise<any> => {
    try {
      const response = await axios.post(`${API_URL}/Users/change-password`, dto);
      return response.data;
    } catch (error) {
      console.error("Error changing password:", error);
      throw error;
    }
  }
};


export default UserService;