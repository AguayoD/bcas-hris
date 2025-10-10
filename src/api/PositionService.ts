import { PositionTypes } from "../types/tblPosition";
import axios from "axios";

const API_URL = "https://localhost:7245/api";

const PositionService = {
  getAll: async (): Promise<any[]> => {
    try {
      const response = await axios.get(`${API_URL}/Positions`);
      return response.data;
    } catch (error) {
      console.error("Error fetching users:", error);
      throw error;
    }
  },

  getById: async (positionID: number): Promise<any> => {
    try {
      const response = await axios.get(`${API_URL}/Positions/${positionID}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching user ${positionID}:`, error);
      throw error;
    }
  },

  create: async (positionData: PositionTypes): Promise<any> => {
    try {
      const response = await axios.post(`${API_URL}/Positions`, positionData);
      return response.data;
    } catch (error) {
      console.error("Error creating user:", error);
      throw error;
    }
  },

  update: async (positionID: number, positionData: any): Promise<any> => {
    try {
      const response = await axios.patch(
        `${API_URL}/Positions/${positionID}`,
        positionData
      );
      return response.data;
    } catch (error) {
      console.error(`Error updating user ${positionID}:`, error);
      throw error;
    }
  },

  delete: async (positionID: number): Promise<any> => {
    try {
      const response = await axios.delete(`${API_URL}/Positions/${positionID}`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting user ${positionID}:`, error);
      throw error;
    }
  },
};

export default PositionService;
