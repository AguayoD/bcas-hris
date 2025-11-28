import { PositionTypes } from "../types/tblPosition";
import axios from "../api/_axiosInstance";

const API_URL = "/Positions";

const PositionService = {
  getAll: async (): Promise<any[]> => {
    try {
      const response = await axios.get(API_URL);
      return response.data;
    } catch (error) {
      console.error("Error fetching positions:", error);
      throw error;
    }
  },

  getById: async (positionID: number): Promise<any> => {
    try {
      const response = await axios.get(`${API_URL}/${positionID}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching position ${positionID}:`, error);
      throw error;
    }
  },

  create: async (positionData: PositionTypes): Promise<any> => {
    try {
      const response = await axios.post(API_URL, positionData);
      return response.data;
    } catch (error) {
      console.error("Error creating position:", error);
      throw error;
    }
  },

  update: async (positionID: number, positionData: any): Promise<any> => {
    try {
      const response = await axios.patch(
        `${API_URL}/${positionID}`,
        positionData
      );
      return response.data;
    } catch (error) {
      console.error(`Error updating position ${positionID}:`, error);
      throw error;
    }
  },

  delete: async (positionID: number): Promise<any> => {
    try {
      const response = await axios.delete(`${API_URL}/${positionID}`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting position ${positionID}:`, error);
      throw error;
    }
  },
};

export default PositionService;