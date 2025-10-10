import { AuthenticationTypes, LoginTypes } from "../types/auth";
import axiosInstance from "./_axiosInstance";

const authenticationService = {
  login: async (data: LoginTypes) => {
    const { data: response } = await axiosInstance.post<AuthenticationTypes>(
      "Authentication/login",
      data
    );
    localStorage.setItem("authToken", response.token);
    return response;
  },
};

export default authenticationService;
