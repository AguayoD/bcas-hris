import { ReactNode } from "react";
import { Employee } from "./tblEmployees";

export interface Contract {
  contractId: number;
  endDate: ReactNode;
  startDate: ReactNode;
  status: string;
  contractID: number | null;
  employeeID: number | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  contractType: string | null;
  contractStatus: string | null;
  lastUpdatedBy: number | null;
  lastUpdatedAt: string | null;
  fileName?: string;
  filePath?: string;
  fileType?: string;
  fileSize?: number;
}

export interface EmployeeWithContracts extends Employee {
  contracts: Contract[];
  contractStatus: string;
}