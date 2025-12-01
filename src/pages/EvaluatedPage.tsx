import React, { useEffect, useState } from "react";
import {
  Table,
  Spin,
  Typography,
  Button,
  message,
  Select,
  Modal,
  Tag,
  Tabs,
  Card,
  Row,
  Col,
  Statistic,
  Input,
} from "antd";
import {
  RedoOutlined,
  CalendarOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  DeleteOutlined,
  PrinterOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import axios from "../api/_axiosInstance";
import moment from "moment";
import { ROLES } from "../types/auth";
import { useAuth } from "../types/useAuth";
import "./EvaluatedPage.css";

const { Title } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

interface SubGroupAnswer {
  subGroupID: number;
  subGroupName: string;
  scoreValue: number;
  scoreLabel: string;
}

interface EvaluationAnswerResponse {
  evaluatorName: string;
  answers: SubGroupAnswer[];
}

interface EvalWithNames {
  evaluationID: number;
  employeeID: number;
  employeeName: string;
  evaluatorID: number;
  evaluatorName: string;
  evaluationDate: string;
  finalScore: number;
  createdAt: string;
  employeeDepartments?: string[];
}

interface EvaluationHistoryItem {
  evaluationHistoryID: number;
  originalEvaluationID: number;
  employeeID: number;
  employeeName: string;
  evaluatorID: number;
  evaluatorName: string;
  evaluationDate: string;
  comments: string;
  finalScore: number;
  createdAt: string;
  archivedAt: string;
  scoresJson: string;
  scores: SubGroupAnswer[];
}

interface SemesterData {
  S1: EvalWithNames[];
  S2: EvalWithNames[];
}

interface EmployeeTotalScore {
  employeeID: number;
  employeeName: string;
  employeeDepartments?: string[];
  firstSemesterScore?: number;
  secondSemesterScore?: number;
  totalScore?: number;
  evaluationCount: number;
}

interface ResetEvaluationResponse {
  message: string;
  archivedCount: number;
}

interface SemesterConfig {
  S1: {
    startMonth: number;
    endMonth: number;
    name: string;
  };
  S2: {
    startMonth: number;
    endMonth: number;
    name: string;
  };
}

const EvaluatedPage: React.FC = () => {
  const [evaluations, setEvaluations] = useState<EvalWithNames[]>([]);
  const [evaluationHistory, setEvaluationHistory] = useState<EvaluationHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [resetting, setResetting] = useState<boolean>(false);
  const [, setSelectedDepartment] = useState<string>("all");
  const [selectedSemester, setSelectedSemester] = useState<string>("S1");
  const [selectedHistoryDepartment, setSelectedHistoryDepartment] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isResetModalVisible, setIsResetModalVisible] = useState(false);
  const [selectedEvaluation, setSelectedEvaluation] = useState<EvalWithNames | null>(null);
  const [selectedHistoryEvaluation, setSelectedHistoryEvaluation] = useState<EvaluationHistoryItem | null>(null);
  const [evaluationAnswers, setEvaluationAnswers] = useState<SubGroupAnswer[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [historyModalLoading, setHistoryModalLoading] = useState(false);
  const [semesterData, setSemesterData] = useState<SemesterData>({
    S1: [],
    S2: [],
  });
  const [, setAvailableYears] = useState<string[]>([]);
  const [employeeTotals, setEmployeeTotals] = useState<EmployeeTotalScore[]>([]);
  const [coordinatorDepartment, setCoordinatorDepartment] = useState<string | null>(null);
  const [coordinatorLoading, setCoordinatorLoading] = useState<boolean>(true);
  const [selectedEmployeeHistory, setSelectedEmployeeHistory] = useState<EvalWithNames[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [isArchivedDetailsModalVisible, setIsArchivedDetailsModalVisible] = useState(false);

  // Semester Configuration State
  const [semesterConfig, setSemesterConfig] = useState<SemesterConfig>(() => {
    const saved = localStorage.getItem('semesterConfig');
    if (saved) {
      return JSON.parse(saved);
    }
    return {
      S1: { startMonth: 0, endMonth: 5, name: "First Semester" },
      S2: { startMonth: 6, endMonth: 11, name: "Second Semester" }
    };
  });
  const [isSemesterConfigModalVisible, setIsSemesterConfigModalVisible] = useState(false);
  const [tempSemesterConfig, setTempSemesterConfig] = useState<SemesterConfig>(semesterConfig);

  const { user } = useAuth();
  const isAdmin = user?.roleId === ROLES.Admin;
  const isHR = user?.roleId === ROLES.HR;
  const isCoordinator = user?.roleId === ROLES.Coordinator;
  const isEmployee = user?.roleId === ROLES.Teaching || user?.roleId === ROLES.NonTeaching;

  // EMERGENCY FIX: Force filter evaluations one more time
  const [forceFilteredEvaluations, setForceFilteredEvaluations] = useState<EvalWithNames[]>([]);

  // Print functionality for Current Evaluations
  const printCurrentEvaluations = () => {
    if (currentSemesterData.length === 0) {
      message.error("No current evaluations to print");
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      message.error("Please allow pop-ups for printing");
      return;
    }

    // Create table HTML without actions column and pagination
    const tableHtml = `
      <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
        <thead>
          <tr>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: #f5f5f5; font-weight: bold;">Employee</th>
            ${!isEmployee ? '<th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: #f5f5f5; font-weight: bold;">Departments</th>' : ''}
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: #f5f5f5; font-weight: bold;">Evaluator</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: #f5f5f5; font-weight: bold;">Date</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: #f5f5f5; font-weight: bold;">Evaluation Score</th>
          </tr>
        </thead>
        <tbody>
          ${currentSemesterData.map((item, index) => `
            <tr style="${index % 2 === 0 ? 'background-color: #f9f9f9;' : ''}">
              <td style="border: 1px solid #ddd; padding: 8px;">${item.employeeName}</td>
              ${!isEmployee ? `<td style="border: 1px solid #ddd; padding: 8px;">${item.employeeDepartments?.join(', ') || 'No Department'}</td>` : ''}
              <td style="border: 1px solid #ddd; padding: 8px;">${item.evaluatorName}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${new Date(item.evaluationDate).toLocaleDateString()}</td>
              <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">${item.finalScore.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Current Evaluations Report</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 20px;
              color: #333;
            }
            .print-header {
              text-align: center;
              margin-bottom: 20px;
              border-bottom: 2px solid #1890ff;
              padding-bottom: 10px;
            }
            .print-header h1 {
              color: #1890ff;
              margin: 0;
            }
            .print-info {
              margin: 10px 0;
              font-size: 14px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 8px;
              text-align: left;
            }
            th {
              background-color: #f5f5f5;
              font-weight: bold;
            }
            tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            .print-footer {
              margin-top: 20px;
              text-align: center;
              font-size: 12px;
              color: #666;
            }
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="print-header">
            <h1>Current Evaluations Report</h1>
            <div class="print-info">
              Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}
            </div>
            <div class="print-info">
              Semester: ${getSemesterLabel(selectedSemester)}
            </div>
            ${selectedHistoryDepartment !== "all" ? `<div class="print-info">Department: ${selectedHistoryDepartment}</div>` : ''}
            ${isCoordinator && coordinatorDepartment ? `<div class="print-info">Department: ${coordinatorDepartment}</div>` : ''}
            <div class="print-info">
              Total Evaluations: ${currentSemesterData.length}
            </div>
          </div>
          ${tableHtml}
          <div class="print-footer">
            This report was generated from the Evaluation System
          </div>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
      printWindow.onafterprint = () => printWindow.close();
    }, 250);
  };

  // Print functionality for Evaluation Details
  const printEvaluationDetails = (evaluation: EvalWithNames, answers: SubGroupAnswer[]) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      message.error("Please allow pop-ups for printing");
      return;
    }

    // Create detailed table HTML
    const tableHtml = `
      <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
        <thead>
          <tr>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: #f5f5f5; font-weight: bold;">SubGroup</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: #f5f5f5; font-weight: bold;">Score</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: #f5f5f5; font-weight: bold;">Label</th>
          </tr>
        </thead>
        <tbody>
          ${answers.map((answer, index) => `
            <tr style="${index % 2 === 0 ? 'background-color: #f9f9f9;' : ''}">
              <td style="border: 1px solid #ddd; padding: 8px;">${answer.subGroupName}</td>
              <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">${answer.scoreValue}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${answer.scoreLabel}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Evaluation Details Report</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 20px;
              color: #333;
            }
            .print-header {
              text-align: center;
              margin-bottom: 20px;
              border-bottom: 2px solid #1890ff;
              padding-bottom: 10px;
            }
            .print-header h1 {
              color: #1890ff;
              margin: 0;
            }
            .print-info {
              margin: 10px 0;
              font-size: 14px;
            }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px;
              margin: 15px 0;
            }
            .info-item {
              padding: 8px;
              background-color: #f8f9fa;
              border-radius: 4px;
            }
            .info-label {
              font-weight: bold;
              color: #666;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 8px;
              text-align: left;
            }
            th {
              background-color: #f5f5f5;
              font-weight: bold;
            }
            tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            .final-score {
              font-size: 18px;
              font-weight: bold;
              color: #1890ff;
              text-align: center;
              margin: 15px 0;
              padding: 10px;
              background-color: #f0f8ff;
              border-radius: 4px;
            }
            .print-footer {
              margin-top: 20px;
              text-align: center;
              font-size: 12px;
              color: #666;
            }
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="print-header">
            <h1>Evaluation Details Report</h1>
            <div class="print-info">
              Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}
            </div>
          </div>
          
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Evaluator:</span><br>
              ${evaluation.evaluatorName}
            </div>
            <div class="info-item">
              <span class="info-label">Employee Evaluated:</span><br>
              ${evaluation.employeeName}
            </div>
            <div class="info-item">
              <span class="info-label">Evaluation Date:</span><br>
              ${new Date(evaluation.evaluationDate).toLocaleDateString()}
            </div>
            <div class="info-item">
              <span class="info-label">Report Date:</span><br>
              ${new Date().toLocaleDateString()}
            </div>
          </div>
          
          <div class="final-score">
            Final Score: ${evaluation.finalScore.toFixed(2)}
          </div>
          
          ${tableHtml}
          
          <div class="print-footer">
            This report was generated from the Evaluation System
          </div>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
      printWindow.onafterprint = () => printWindow.close();
    }, 250);
  };

  // Print functionality for Semester Totals
  const printSemesterTotals = () => {
    if (employeeTotals.length === 0) {
      message.error("No semester totals to print");
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      message.error("Please allow pop-ups for printing");
      return;
    }

    // Create table HTML without actions column and pagination
    const tableHtml = `
      <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
        <thead>
          <tr>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: #f5f5f5; font-weight: bold;">Employee</th>
            ${!isEmployee ? '<th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: #f5f5f5; font-weight: bold;">Departments</th>' : ''}
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: #f5f5f5; font-weight: bold;">1st Semester</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: #f5f5f5; font-weight: bold;">2nd Semester</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: #f5f5f5; font-weight: bold;">Total Average</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: #f5f5f5; font-weight: bold;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${employeeTotals.map((item, index) => `
            <tr style="${index % 2 === 0 ? 'background-color: #f9f9f9;' : ''}">
              <td style="border: 1px solid #ddd; padding: 8px;">${item.employeeName}</td>
              ${!isEmployee ? `<td style="border: 1px solid #ddd; padding: 8px;">${item.employeeDepartments?.join(', ') || 'No Department'}</td>` : ''}
              <td style="border: 1px solid #ddd; padding: 8px;">${item.firstSemesterScore !== undefined ? item.firstSemesterScore.toFixed(2) : '-'}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${item.secondSemesterScore !== undefined ? item.secondSemesterScore.toFixed(2) : '-'}</td>
              <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold; color: #1890ff;">${item.totalScore !== undefined ? item.totalScore.toFixed(2) : '-'}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">
                ${item.totalScore !== undefined ? 
                  '<span style="background-color: #f6ffed; border: 1px solid #b7eb8f; padding: 2px 6px; border-radius: 4px;">Complete</span>' : 
                  item.evaluationCount > 0 ? 
                    `<span style="background-color: #fff7e6; border: 1px solid #ffd591; padding: 2px 6px; border-radius: 4px;">${[item.firstSemesterScore !== undefined, item.secondSemesterScore !== undefined].filter(Boolean).length}/2 Semesters Complete</span>` :
                    '<span style="background-color: #fff2f0; border: 1px solid #ffccc7; padding: 2px 6px; border-radius: 4px;">No Evaluations</span>'
                }
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Semester Totals Report</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 20px;
              color: #333;
            }
            .print-header {
              text-align: center;
              margin-bottom: 20px;
              border-bottom: 2px solid #1890ff;
              padding-bottom: 10px;
            }
            .print-header h1 {
              color: #1890ff;
              margin: 0;
            }
            .print-info {
              margin: 10px 0;
              font-size: 14px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 8px;
              text-align: left;
            }
            th {
              background-color: #f5f5f5;
              font-weight: bold;
            }
            tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            .total-score {
              font-weight: bold;
              color: #1890ff;
            }
            .print-footer {
              margin-top: 20px;
              text-align: center;
              font-size: 12px;
              color: #666;
            }
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="print-header">
            <h1>Semester Totals Report</h1>
            <div class="print-info">
              Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}
            </div>
            <div class="print-info">
              Year: ${selectedYear || 'All Years'}
            </div>
            <div class="print-info">
              Total Employees: ${employeeTotals.length}
            </div>
          </div>
          ${tableHtml}
          <div class="print-footer">
            This report was generated from the Evaluation System
          </div>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
      printWindow.onafterprint = () => printWindow.close();
    }, 250);
  };

  // Save semester config to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('semesterConfig', JSON.stringify(semesterConfig));
  }, [semesterConfig]);

  // Enhanced department matching function
  const doesDepartmentMatch = (employeeDepts: string[], coordinatorDept: string): boolean => {
    if (!employeeDepts || employeeDepts.length === 0) return false;
    
    const coordinatorDeptLower = coordinatorDept.toLowerCase();
    
    return employeeDepts.some(employeeDept => {
      const employeeDeptLower = employeeDept.toLowerCase();
      
      // Exact match or contains check
      return employeeDeptLower === coordinatorDeptLower || 
             employeeDeptLower.includes(coordinatorDeptLower) ||
             coordinatorDeptLower.includes(employeeDeptLower);
    });
  };

  // Updated semester detection function
  const getSemesterFromDate = (date: string): string => {
    const momentDate = moment(date);
    const month = momentDate.month(); // 0-11

    // Use configurable semester dates
    if (month >= semesterConfig.S1.startMonth && month <= semesterConfig.S1.endMonth) {
      return "S1";
    } else if (month >= semesterConfig.S2.startMonth && month <= semesterConfig.S2.endMonth) {
      return "S2";
    } else {
      // If date doesn't fit in configured semesters, use default logic
      console.warn(`Date ${date} doesn't fit in configured semesters, using fallback`);
      return month <= 5 ? "S1" : "S2";
    }
  };

  // Updated semester label function
  const getSemesterLabel = (period: string) => {
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    if (period === "S1") {
      const config = semesterConfig.S1;
      return `${config.name} (${monthNames[config.startMonth]} - ${monthNames[config.endMonth]})`;
    } else if (period === "S2") {
      const config = semesterConfig.S2;
      return `${config.name} (${monthNames[config.startMonth]} - ${monthNames[config.endMonth]})`;
    }
    
    return period;
  };

  // Semester Configuration Modal Component
  const SemesterConfigModal = () => {
    const monthOptions = [
      { value: 0, label: "January" },
      { value: 1, label: "February" },
      { value: 2, label: "March" },
      { value: 3, label: "April" },
      { value: 4, label: "May" },
      { value: 5, label: "June" },
      { value: 6, label: "July" },
      { value: 7, label: "August" },
      { value: 8, label: "September" },
      { value: 9, label: "October" },
      { value: 10, label: "November" },
      { value: 11, label: "December" }
    ];

    const validateConfig = (config: SemesterConfig): boolean => {
      // Check if semesters overlap
      const s1Months = [];
      for (let i = config.S1.startMonth; i <= config.S1.endMonth; i++) {
        s1Months.push(i);
      }
      
      const s2Months: number[] = [];
      for (let i = config.S2.startMonth; i <= config.S2.endMonth; i++) {
        s2Months.push(i);
      }
      
      const overlap = s1Months.some(month => s2Months.includes(month));
      if (overlap) {
        message.error("Semesters cannot have overlapping months!");
        return false;
      }
      
      return true;
    };

    const handleSave = () => {
      if (validateConfig(tempSemesterConfig)) {
        setSemesterConfig(tempSemesterConfig);
        setIsSemesterConfigModalVisible(false);
        message.success("Semester configuration updated successfully!");
      }
    };

    const handleResetToDefault = () => {
      setTempSemesterConfig({
        S1: { startMonth: 0, endMonth: 5, name: "First Semester" },
        S2: { startMonth: 6, endMonth: 11, name: "Second Semester" }
      });
      message.info("Reset to default semester configuration");
    };

    return (
      <Modal
        title="Configure Semester Dates"
        open={isSemesterConfigModalVisible}
        onOk={handleSave}
        onCancel={() => {
          setIsSemesterConfigModalVisible(false);
          setTempSemesterConfig(semesterConfig);
        }}
        okText="Save Configuration"
        cancelText="Cancel"
        width={600}
        className="evaluated-modal"
      >
        <div className="semester-config-modal">
          <div style={{ marginBottom: 24 }}>
            <div className="semester-config-section">
              <Title level={5} style={{ marginBottom: 8 }}>{tempSemesterConfig.S1.name}</Title>
              <Row gutter={16} align="middle">
                <Col span={10}>
                  <Select
                    value={tempSemesterConfig.S1.startMonth}
                    onChange={(value) => setTempSemesterConfig(prev => ({
                      ...prev,
                      S1: { ...prev.S1, startMonth: value }
                    }))}
                    style={{ width: '100%' }}
                    placeholder="Start Month"
                  >
                    {monthOptions.map(month => (
                      <Option key={month.value} value={month.value}>
                        {month.label}
                      </Option>
                    ))}
                  </Select>
                </Col>
                <Col span={4} style={{ textAlign: 'center' }}>
                  to
                </Col>
                <Col span={10}>
                  <Select
                    value={tempSemesterConfig.S1.endMonth}
                    onChange={(value) => setTempSemesterConfig(prev => ({
                      ...prev,
                      S1: { ...prev.S1, endMonth: value }
                    }))}
                    style={{ width: '100%' }}
                    placeholder="End Month"
                  >
                    {monthOptions.map(month => (
                      <Option key={month.value} value={month.value}>
                        {month.label}
                      </Option>
                    ))}
                  </Select>
                </Col>
              </Row>
            </div>

            <div className="semester-config-section">
              <Title level={5} style={{ marginBottom: 8 }}>{tempSemesterConfig.S2.name}</Title>
              <Row gutter={16} align="middle">
                <Col span={10}>
                  <Select
                    value={tempSemesterConfig.S2.startMonth}
                    onChange={(value) => setTempSemesterConfig(prev => ({
                      ...prev,
                      S2: { ...prev.S2, startMonth: value }
                    }))}
                    style={{ width: '100%' }}
                    placeholder="Start Month"
                  >
                    {monthOptions.map(month => (
                      <Option key={month.value} value={month.value}>
                        {month.label}
                      </Option>
                    ))}
                  </Select>
                </Col>
                <Col span={4} style={{ textAlign: 'center' }}>
                  to
                </Col>
                <Col span={10}>
                  <Select
                    value={tempSemesterConfig.S2.endMonth}
                    onChange={(value) => setTempSemesterConfig(prev => ({
                      ...prev,
                      S2: { ...prev.S2, endMonth: value }
                    }))}
                    style={{ width: '100%' }}
                    placeholder="End Month"
                  >
                    {monthOptions.map(month => (
                      <Option key={month.value} value={month.value}>
                        {month.label}
                      </Option>
                    ))}
                  </Select>
                </Col>
              </Row>
            </div>

            <div className="semester-config-section">
              <Title level={5} style={{ marginBottom: 8 }}>Semester Names</Title>
              <Row gutter={16}>
                <Col span={12}>
                  <Input
                    value={tempSemesterConfig.S1.name}
                    onChange={(e) => setTempSemesterConfig(prev => ({
                      ...prev,
                      S1: { ...prev.S1, name: e.target.value }
                    }))}
                    placeholder="Semester 1 Name"
                  />
                </Col>
                <Col span={12}>
                  <Input
                    value={tempSemesterConfig.S2.name}
                    onChange={(e) => setTempSemesterConfig(prev => ({
                      ...prev,
                      S2: { ...prev.S2, name: e.target.value }
                    }))}
                    placeholder="Semester 2 Name"
                  />
                </Col>
              </Row>
            </div>

            <Button type="dashed" onClick={handleResetToDefault} style={{ width: '100%' }}>
              Reset to Default (Jan-Jun & Jul-Dec)
            </Button>
          </div>
        </div>
      </Modal>
    );
  };

  // FIXED: Properly determine coordinator department type
  useEffect(() => {
    if (isCoordinator) {
      console.log("Coordinator detected, determining department type");

      const fetchCoordinatorDepartment = async () => {
        try {
          // Try to fetch coordinator details from backend
          const coordinatorRes = await axios.get(
            `/Employees/${user?.employeeId}`
          );
          const coordinatorData = coordinatorRes.data;

          // Check departments to determine department type
          const employeeDeptIDs = [
            coordinatorData.departmentID,
            coordinatorData.departmentID2,
            coordinatorData.departmentID3,
          ].filter((id) => id != null && id !== 0);

          let departmentMap = new Map();
          try {
            const departmentsRes = await axios.get("/Departments");
            if (departmentsRes.data && Array.isArray(departmentsRes.data)) {
              departmentsRes.data.forEach((dept) => {
                if (dept.departmentID && dept.departmentName) {
                  departmentMap.set(dept.departmentID, dept.departmentName);
                }
              });
            }
          } catch (error) {
            console.error("Error fetching departments:", error);
          }

          const coordinatorDeptNames: string[] = [];
          for (const deptID of employeeDeptIDs) {
            const deptNameFromMap = departmentMap.get(deptID);
            if (deptNameFromMap) {
              coordinatorDeptNames.push(deptNameFromMap);
            } else {
              try {
                const deptRes = await axios.get(`/Department/${deptID}`);
                const deptName =
                  deptRes.data?.departmentName || deptRes.data?.name;
                if (deptName) {
                  coordinatorDeptNames.push(deptName);
                }
              } catch (error) {
                console.error(`Error fetching department ${deptID}:`, error);
              }
            }
          }

          // Determine coordinator's primary department
          let primaryDepartment = coordinatorDeptNames[0] || "General Department";

          // Set the coordinator department and appropriate semester system
          setCoordinatorDepartment(primaryDepartment);
          setSelectedDepartment(primaryDepartment);
          setSelectedHistoryDepartment(primaryDepartment);

          // Always use semester system
          setSelectedSemester("S1");
          console.log(
            `${primaryDepartment} coordinator detected - using semester system`
          );
        } catch (error) {
          console.error("Error fetching coordinator details:", error);
          // Fallback
          setCoordinatorDepartment("General Department");
          setSelectedDepartment("General Department");
          setSelectedHistoryDepartment("General Department");
          setSelectedSemester("S1");
        } finally {
          setCoordinatorLoading(false);
        }
      };

      fetchCoordinatorDepartment();
    } else {
      setCoordinatorLoading(false);
    }
  }, [isCoordinator, user]);

  useEffect(() => {
    fetchEvaluations();
    fetchEvaluationHistory();
  }, []);

  // EMERGENCY FIX: Apply strict filtering to evaluations
  useEffect(() => {
    if (isEmployee && user?.employeeId && evaluations.length > 0) {
      const strictlyFiltered = evaluations.filter(_evalItem => 
        _evalItem.employeeID === user.employeeId
      );
      
      if (strictlyFiltered.length !== evaluations.length) {
        console.log("EMERGENCY FILTER: Removing wrong evaluations");
        console.log(`Before: ${evaluations.length}, After: ${strictlyFiltered.length}`);
        
        // Log what was removed
        evaluations.forEach(_evalItem => {
          if (_evalItem.employeeID !== user.employeeId) {
            console.log(`REMOVED: ${_evalItem.employeeName} (ID: ${_evalItem.employeeID})`);
          }
        });
        
        setForceFilteredEvaluations(strictlyFiltered);
      } else {
        setForceFilteredEvaluations(evaluations);
      }
    } else {
      setForceFilteredEvaluations(evaluations);
    }
  }, [evaluations, isEmployee, user?.employeeId]);

  // Debug what's being displayed
  useEffect(() => {
    if (forceFilteredEvaluations.length > 0 && isEmployee && user?.employeeId) {
      console.log("=== FINAL DISPLAY CHECK ===");
      console.log(`User: ${user.firstName} ${user.lastName} (ID: ${user.employeeId})`);
      console.log(`Evaluations to display: ${forceFilteredEvaluations.length}`);
      
      forceFilteredEvaluations.forEach((evalItem, index) => {
        const isOwn = evalItem.employeeID === user.employeeId;
        console.log(`${index + 1}. ${evalItem.employeeName} (ID: ${evalItem.employeeID}) - Own: ${isOwn} - Score: ${evalItem.finalScore}`);
      });
      
      const wrongEvaluations = forceFilteredEvaluations.filter(e => e.employeeID !== user.employeeId);
      if (wrongEvaluations.length > 0) {
        console.error("❌ SECURITY BREACH: Employee is seeing wrong evaluations!");
        wrongEvaluations.forEach(wrong => {
          console.error(`WRONG: ${wrong.employeeName} (ID: ${wrong.employeeID})`);
        });
      } else {
        console.log("✅ SECURITY: Employee only sees their own evaluations");
      }
    }
  }, [forceFilteredEvaluations, isEmployee, user]);

  const fetchEvaluationHistory = async () => {
    setHistoryLoading(true);
    try {
      let res;
      if (isEmployee && user?.employeeId) {
        // For employees, only fetch their own history
        try {
          res = await axios.get(`/Evaluations/history/employee/${user.employeeId}`);
        } catch (error) {
          // If endpoint doesn't exist, filter from all history
          console.log("Employee history endpoint not found, filtering from all history");
          const allHistory = await axios.get("/Evaluations/history");
          res = { data: allHistory.data.filter((item: EvaluationHistoryItem) => 
            item.employeeID === user.employeeId
          ) };
        }
      } else {
        // For admins/HR/coordinators, fetch all history
        res = await axios.get("/Evaluations/history");
      }
      setEvaluationHistory(res.data);
    } catch (error) {
      console.error("Error fetching evaluation history:", error);
      message.error("Failed to fetch evaluation history");
    } finally {
      setHistoryLoading(false);
    }
  };

  const organizeBySemester = (evals: EvalWithNames[]): SemesterData => {
    const data: SemesterData = {
      S1: [],
      S2: [],
    };

    evals.forEach((evaluation) => {
      const semesterPeriod = getSemesterFromDate(evaluation.evaluationDate);
      data[semesterPeriod as keyof SemesterData].push(evaluation);
    });

    Object.keys(data).forEach((period) => {
      data[period as keyof SemesterData].sort(
        (a, b) => b.finalScore - a.finalScore
      );
    });

    return data;
  };

  const organizeByYear = (
    evals: EvalWithNames[]
  ): { [year: string]: EvalWithNames[] } => {
    const data: { [year: string]: EvalWithNames[] } = {};

    evals.forEach((evaluation) => {
      const year = moment(evaluation.evaluationDate).year().toString();

      if (!data[year]) {
        data[year] = [];
      }
      data[year].push(evaluation);
    });

    Object.keys(data).forEach((year) => {
      data[year].sort((a, b) => b.finalScore - a.finalScore);
    });

    return data;
  };

  const calculateEmployeeTotals = (
    evals: EvalWithNames[],
    year: string
  ): EmployeeTotalScore[] => {
    const employeeMap = new Map<number, EmployeeTotalScore>();

    const yearEvals =
      year === "all"
        ? evals
        : evals.filter(
            (e) => moment(e.evaluationDate).year().toString() === year
          );

    yearEvals.forEach((evaluation) => {
      const empId = evaluation.employeeID;

      if (!employeeMap.has(empId)) {
        employeeMap.set(empId, {
          employeeID: empId,
          employeeName: evaluation.employeeName,
          employeeDepartments: evaluation.employeeDepartments,
          evaluationCount: 0,
        });
      }

      const empData = employeeMap.get(empId)!;
      empData.evaluationCount++;

      const semesterPeriod = getSemesterFromDate(evaluation.evaluationDate);

      if (semesterPeriod === "S1")
        empData.firstSemesterScore = evaluation.finalScore;
      else if (semesterPeriod === "S2")
        empData.secondSemesterScore = evaluation.finalScore;

      if (
        empData.firstSemesterScore !== undefined &&
        empData.secondSemesterScore !== undefined
      ) {
        empData.totalScore =
          (empData.firstSemesterScore + empData.secondSemesterScore) / 2;
      }
    });

    return Array.from(employeeMap.values()).sort((a, b) => {
      if (a.totalScore !== undefined && b.totalScore !== undefined) {
        return b.totalScore - a.totalScore;
      }
      if (a.totalScore !== undefined) return -1;
      if (b.totalScore !== undefined) return 1;
      return 0;
    });
  };

  const filterEvaluationsByCoordinator = (
    evals: EvalWithNames[]
  ): EvalWithNames[] => {
    if (!isCoordinator || !coordinatorDepartment) {
      return evals;
    }

    console.log("Filtering evaluations for coordinator department:", coordinatorDepartment);
    
    const filtered = evals.filter((evaluation) => {
      const hasMatchingDepartment = doesDepartmentMatch(
        evaluation.employeeDepartments || [],
        coordinatorDepartment
      );
      
      console.log(`Employee ${evaluation.employeeName} departments:`, 
        evaluation.employeeDepartments, 
        "matches:", hasMatchingDepartment
      );
      
      return hasMatchingDepartment;
    });

    console.log(`Filtered ${filtered.length} out of ${evals.length} evaluations for coordinator`);
    return filtered;
  };

  const fetchEvaluations = async () => {
    try {
      console.log(`STRICT MODE: Fetching evaluations for user ${user?.firstName} ${user?.lastName} (ID: ${user?.employeeId}, Role: ${user?.roleId})`);

      let allEvaluations;
      
      // Always fetch ALL evaluations first
      const response = await axios.get("/Evaluations");
      allEvaluations = response.data;
      
      console.log(`Total evaluations from API: ${allEvaluations.length}`);

      // STRICT FILTERING: For employees, ONLY show their own evaluations
      let finalEvaluations = allEvaluations;
      if (isEmployee && user?.employeeId) {
        finalEvaluations = allEvaluations.filter((evaluation: EvalWithNames) => {
          const isOwnEvaluation = evaluation.employeeID === user.employeeId;
          console.log(`Evaluation check: ${evaluation.employeeName} (ID: ${evaluation.employeeID}) vs User: ${user.employeeId} -> ${isOwnEvaluation}`);
          return isOwnEvaluation;
        });
        
        console.log(`STRICT FILTER APPLIED: Employee ${user.employeeId} will see ${finalEvaluations.length} evaluations out of ${allEvaluations.length}`);
        
        // Log exactly what evaluations the employee will see
        finalEvaluations.forEach((evalItem: EvalWithNames) => {
          console.log(`✅ EMPLOYEE WILL SEE: ${evalItem.employeeName} (ID: ${evalItem.employeeID}) - Score: ${evalItem.finalScore}`);
        });

        // Log evaluations that were filtered out
        const filteredOut = allEvaluations.filter((evaluation: EvalWithNames) => 
          evaluation.employeeID !== user.employeeId
        );
        filteredOut.forEach((evalItem: EvalWithNames) => {
          console.log(`❌ FILTERED OUT: ${evalItem.employeeName} (ID: ${evalItem.employeeID}) - Score: ${evalItem.finalScore}`);
        });
      }

      let departmentMap = new Map();
      try {
        const departmentsRes = await axios.get("/Departments");
        if (departmentsRes.data && Array.isArray(departmentsRes.data)) {
          departmentsRes.data.forEach((dept) => {
            if (dept.departmentID && dept.departmentName) {
              departmentMap.set(dept.departmentID, dept.departmentName);
            }
          });
        }
      } catch (error) {
        console.error("Error fetching departments:", error);
      }

      const evaluationsWithDetails = await Promise.all(
        finalEvaluations.map(async (evaluation: EvalWithNames) => {
          try {
            const employeeRes = await axios.get(
              `/Employees/${evaluation.employeeID}`
            );
            const employeeData = employeeRes.data;

            const employeeDeptIDs = [
              employeeData.departmentID,
              employeeData.departmentID2,
              employeeData.departmentID3,
            ].filter((id) => id != null && id !== 0);

            const employeeDeptNames: string[] = [];

            for (const deptID of employeeDeptIDs) {
              const deptNameFromMap = departmentMap.get(deptID);
              if (deptNameFromMap) {
                employeeDeptNames.push(deptNameFromMap);
              } else {
                try {
                  const deptRes = await axios.get(`/Department/${deptID}`);
                  const deptName =
                    deptRes.data?.departmentName || deptRes.data?.name;
                  if (deptName) {
                    employeeDeptNames.push(deptName);
                    departmentMap.set(deptID, deptName);
                  } else {
                    employeeDeptNames.push(`Department ${deptID}`);
                  }
                } catch (error) {
                  console.error(`Error fetching department ${deptID}:`, error);
                  employeeDeptNames.push(`Department ${deptID}`);
                }
              }
            }

            if (employeeDeptNames.length === 0) {
              if (employeeData.departmentName) {
                employeeDeptNames.push(employeeData.departmentName);
              }
              if (employeeData.departmentID2Name) {
                employeeDeptNames.push(employeeData.departmentID2Name);
              }
              if (employeeData.departmentID3Name) {
                employeeDeptNames.push(employeeData.departmentID3Name);
              }
            }

            // Ensure we always have at least "No Department"
            if (employeeDeptNames.length === 0) {
              employeeDeptNames.push("No Department");
            }

            return {
              ...evaluation,
              employeeDepartments: employeeDeptNames,
            };
          } catch (error) {
            console.error(
              `Error fetching details for evaluation ${evaluation.evaluationID}:`,
              error
            );
            return {
              ...evaluation,
              employeeDepartments: ["No Department"],
            };
          }
        })
      );

      // FINAL SECURITY CHECK - Double filter for employees
      let secureEvaluations = evaluationsWithDetails;
      if (isEmployee && user?.employeeId) {
        secureEvaluations = evaluationsWithDetails.filter(
          (evaluation) => evaluation.employeeID === user.employeeId
        );
        console.log(`FINAL SECURITY CHECK: ${secureEvaluations.length} evaluations passed`);
      }

      // Set the evaluations
      setEvaluations(secureEvaluations);
      console.log(`SET EVALUATIONS: ${secureEvaluations.length} evaluations set for display`);

      // For employees, organize ALL their evaluations (no semester filtering needed)
      if (isEmployee) {
        const allEmployeeEvals = secureEvaluations;
        const organized = {
          S1: allEmployeeEvals.filter(e => getSemesterFromDate(e.evaluationDate) === "S1"),
          S2: allEmployeeEvals.filter(e => getSemesterFromDate(e.evaluationDate) === "S2")
        };
        setSemesterData(organized);

        const yearlyOrganized = organizeByYear(allEmployeeEvals);
        const years = Object.keys(yearlyOrganized).sort(
          (a, b) => parseInt(b) - parseInt(a)
        );
        setAvailableYears(years);

        if (allEmployeeEvals.length > 0) {
          const totals = calculateEmployeeTotals(allEmployeeEvals, "all");
          console.log("Employee personal totals:", totals);
          setEmployeeTotals(totals);
        }
      } else {
        // For non-employees, use the existing logic
        const coordinatorFilteredEvaluations = filterEvaluationsByCoordinator(
          secureEvaluations
        );

        const organized = organizeBySemester(coordinatorFilteredEvaluations);
        setSemesterData(organized);

        const yearlyOrganized = organizeByYear(coordinatorFilteredEvaluations);
        const years = Object.keys(yearlyOrganized).sort(
          (a, b) => parseInt(b) - parseInt(a)
        );
        setAvailableYears(years);

        if (years.length > 0) {
          const defaultYear = selectedYear || years[0];
          setSelectedYear(defaultYear);

          const totals = calculateEmployeeTotals(
            coordinatorFilteredEvaluations,
            defaultYear
          );
          setEmployeeTotals(totals);
        }
      }

    } catch (error) {
      console.error("Error fetching evaluations:", error);
      message.error("Failed to fetch evaluations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedYear && evaluations.length > 0) {
      let filteredEvaluations = evaluations;
      
      // Apply coordinator filter for non-employees
      if (!isEmployee) {
        filteredEvaluations = filterEvaluationsByCoordinator(evaluations);
      }
      
      const totals = calculateEmployeeTotals(filteredEvaluations, selectedYear);
      setEmployeeTotals(totals);
    }
  }, [selectedYear, evaluations]);

  // FIXED: Include "No Department" in department options
  const allDepartments = evaluations.flatMap(
    (evalItem) => evalItem.employeeDepartments || ["No Department"]
  );
  const departments =
    isCoordinator && coordinatorDepartment
      ? [coordinatorDepartment]
      : (Array.from(new Set(allDepartments)) as string[]);
  departments.sort();

  const showResetConfirmation = () => {
    setIsResetModalVisible(true);
  };

  const allHistoryEvaluations = [...evaluations].sort(
    (a, b) =>
      new Date(b.evaluationDate).getTime() -
      new Date(a.evaluationDate).getTime()
  );

  const handleResetConfirm = async () => {
    setIsResetModalVisible(false);
    setResetting(true);
    try {
      const response = await axios.post<ResetEvaluationResponse>("/Evaluations/reset");
      message.success(response.data.message);
      await fetchEvaluations();
      await fetchEvaluationHistory(); // Refresh history after reset
      window.dispatchEvent(new CustomEvent("evaluationsReset"));
    } catch (error: any) {
      console.error("Error resetting evaluations:", error);
      message.error("Failed to reset evaluation data");
    } finally {
      setResetting(false);
    }
  };

  const handleResetCancel = () => {
    setIsResetModalVisible(false);
  };

  const showModal = async (evaluation: EvalWithNames) => {
    // STRICT SECURITY CHECK: Employees can only view their own evaluations
    if (isEmployee && user?.employeeId && evaluation.employeeID !== user.employeeId) {
      message.error("Access denied: You can only view your own evaluations");
      console.error(`SECURITY VIOLATION: Employee ${user.employeeId} tried to view evaluation for employee ${evaluation.employeeID}`);
      return;
    }
    
    setSelectedEvaluation(evaluation);
    setIsModalVisible(true);
    setModalLoading(true);

    try {
      const res = await axios.get<EvaluationAnswerResponse>(
        `/Evaluations/${evaluation.evaluationID}/answers`
      );
      setEvaluationAnswers(res.data.answers);
    } catch (error) {
      console.error("Error fetching evaluation answers:", error);
      setEvaluationAnswers([]);
    } finally {
      setModalLoading(false);
    }
  };

  const showArchivedDetailsModal = async (evaluation: EvaluationHistoryItem) => {
    // STRICT SECURITY CHECK: Employees can only view their own archived evaluations
    if (isEmployee && user?.employeeId && evaluation.employeeID !== user.employeeId) {
      message.error("Access denied: You can only view your own archived evaluations");
      console.error(`SECURITY VIOLATION: Employee ${user.employeeId} tried to view archived evaluation for employee ${evaluation.employeeID}`);
      return;
    }
    
    setSelectedHistoryEvaluation(evaluation);
    setIsArchivedDetailsModalVisible(true);
    setHistoryModalLoading(true);

    try {
      // If scores are not already loaded, fetch them
      if (!evaluation.scores || evaluation.scores.length === 0) {
        const res = await axios.get(`/Evaluations/history/${evaluation.evaluationHistoryID}`);
        setSelectedHistoryEvaluation(res.data);
      }
    } catch (error) {
      console.error("Error fetching archived evaluation details:", error);
    } finally {
      setHistoryModalLoading(false);
    }
  };

  const handleModalClose = () => {
    setIsModalVisible(false);
    setSelectedEvaluation(null);
    setEvaluationAnswers([]);
  };

  const handleArchivedModalClose = () => {
    setIsArchivedDetailsModalVisible(false);
    setSelectedHistoryEvaluation(null);
  };

  const columns: ColumnsType<EvalWithNames> = [
    {
      title: "Employee",
      dataIndex: "employeeName",
      key: "employeeName",
    },
    ...(isEmployee ? [] : [{
      title: "Departments",
      dataIndex: "employeeDepartments",
      key: "employeeDepartments",
      render: (departments: string[]) =>
        departments && departments.length > 0 ? (
          <div className="department-tags">
            {departments.map((dept, index) => (
              <Tag key={index} color="blue" className="department-tag">
                {dept}
              </Tag>
            ))}
          </div>
        ) : (
          "No Department"
        ),
    }]),
    {
      title: "Evaluator",
      dataIndex: "evaluatorName",
      key: "evaluatorName",
    },
    {
      title: "Date",
      dataIndex: "evaluationDate",
      key: "evaluationDate",
      render: (d: string) => new Date(d).toLocaleDateString(),
    },
    {
      title: "Evaluation Score",
      dataIndex: "finalScore",
      key: "finalScore",
      render: (score: number) => score.toFixed(2),
      sorter: (a, b) => a.finalScore - b.finalScore,
    },
    {
      title: "Action",
      key: "action",
      render: (_, record) => (
        <Button type="link" onClick={() => showModal(record)}>
          View Details
        </Button>
      ),
    },
    ...(isEmployee ? [] : [{
      title: "History",
      key: "history",
      render: (_: any, record: { employeeID: number; }) => (
        <Button
          type="link"
          onClick={() => {
            // Filter all evaluations of this employee
            const history = allHistoryEvaluations.filter(
              (e) => e.employeeID === record.employeeID
            );

            console.log("FULL HISTORY:", history);

            // Open modal and show employee history
            setSelectedEmployeeHistory(history);
            setShowHistoryModal(true);
          }}
        >
          View History
        </Button>
      ),
    }]),
  ];

  const columnsV2: ColumnsType<EvalWithNames> = [
    {
      title: "Employee",
      dataIndex: "employeeName",
      key: "employeeName",
    },
    ...(isEmployee ? [] : [{
      title: "Departments",
      dataIndex: "employeeDepartments",
      key: "employeeDepartments",
      render: (departments: string[]) =>
        departments && departments.length > 0 ? (
          <div className="department-tags">
            {departments.map((dept, index) => (
              <Tag key={index} color="blue" className="department-tag">
                {dept}
              </Tag>
            ))}
          </div>
        ) : (
          "No Department"
        ),
    }]),
    {
      title: "Evaluator",
      dataIndex: "evaluatorName",
      key: "evaluatorName",
    },
    {
      title: "Date",
      dataIndex: "evaluationDate",
      key: "evaluationDate",
      render: (d: string) => new Date(d).toLocaleDateString(),
    },
    {
      title: "Evaluation Score Average",
      dataIndex: "finalScore",
      key: "finalScore",
      render: (score: number) => score.toFixed(2),
      sorter: (a, b) => a.finalScore - b.finalScore,
      defaultSortOrder: "descend",
    },
    {
      title: "Action",
      key: "action",
      render: (_, record) => (
        <Button type="link" onClick={() => showModal(record)}>
          View Details
        </Button>
      ),
    },
  ];

  const archivedColumns: ColumnsType<EvaluationHistoryItem> = [
    {
      title: "Employee",
      dataIndex: "employeeName",
      key: "employeeName",
    },
    ...(isEmployee ? [] : [{
      title: "Evaluator",
      dataIndex: "evaluatorName",
      key: "evaluatorName",
    }]),
    {
      title: "Evaluation Date",
      dataIndex: "evaluationDate",
      key: "evaluationDate",
      render: (d: string) => new Date(d).toLocaleDateString(),
    },
    {
      title: "Final Score",
      dataIndex: "finalScore",
      key: "finalScore",
      render: (score: number) => score.toFixed(2),
    },
    {
      title: "Archived Date",
      dataIndex: "archivedAt",
      key: "archivedAt",
      render: (d: string) => new Date(d).toLocaleDateString(),
    },
    {
      title: "Action",
      key: "action",
      render: (_, record) => (
        <Button type="link" onClick={() => showArchivedDetailsModal(record)}>
          View Details
        </Button>
      ),
    },
  ];

  const semesterColumns: ColumnsType<EmployeeTotalScore> = [
    {
      title: "Employee",
      dataIndex: "employeeName",
      key: "employeeName",
      width: 150,
    },
    ...(isEmployee ? [] : [{
      title: "Departments",
      dataIndex: "employeeDepartments",
      key: "employeeDepartments",
      width: 200,
      render: (departments: string[]) =>
        departments && departments.length > 0 ? (
          <div className="department-tags">
            {departments.map((dept, index) => (
              <Tag key={index} color="blue" className="department-tag">
                {dept}
              </Tag>
            ))}
          </div>
        ) : (
          "No Department"
        ),
    }]),
    {
      title: "1st Semester",
      dataIndex: "firstSemesterScore",
      key: "firstSemesterScore",
      width: 120,
      render: (score?: number) =>
        score !== undefined ? score.toFixed(2) : "-",
    },
    {
      title: "2nd Semester",
      dataIndex: "secondSemesterScore",
      key: "secondSemesterScore",
      width: 120,
      render: (score?: number) =>
        score !== undefined ? score.toFixed(2) : "-",
    },
    {
      title: "Total Average",
      dataIndex: "totalScore",
      key: "totalScore",
      width: 120,
      render: (score?: number) =>
        score !== undefined ? (
          <strong style={{ color: "#1890ff", fontSize: "16px" }}>
            {score.toFixed(2)}
          </strong>
        ) : (
          "-"
        ),
      sorter: (a, b) => {
        const aScore = a.totalScore ?? -1;
        const bScore = b.totalScore ?? -1;
        return bScore - aScore;
      },
      defaultSortOrder: "descend",
    },
    {
      title: "Status",
      key: "status",
      width: 150,
      render: (_, record) => {
        if (record.totalScore !== undefined) {
          return <Tag className="status-tag-complete">Complete</Tag>;
        } else if (record.evaluationCount > 0) {
          const completedSemesters = [
            record.firstSemesterScore !== undefined,
            record.secondSemesterScore !== undefined,
          ].filter(Boolean).length;
          return (
            <Tag className="status-tag-incomplete">{completedSemesters}/2 Semesters Complete</Tag>
          );
        }
        return <Tag className="status-tag-none">No Evaluations</Tag>;
      },
    },
  ];

  // FIXED: Properly filter data based on selected department
  const getCurrentSemesterData = () => {
    if (isEmployee) {
      // For employees, show ALL their evaluations regardless of semester
      return forceFilteredEvaluations;
    }

    let data = semesterData[selectedSemester as keyof SemesterData];

    // Apply department filtering
    if (selectedHistoryDepartment !== "all") {
      data = data.filter((evalItem) => {
        const employeeDepts = evalItem.employeeDepartments || ["No Department"];
        return employeeDepts.includes(selectedHistoryDepartment);
      });
    }

    return data;
  };

  const currentSemesterData = getCurrentSemesterData();

  console.log("User Role Debug:", {
    isEmployee,
    userRole: user?.roleId,
    employeeId: user?.employeeId,
    userName: `${user?.firstName} ${user?.lastName}`,
    evaluationsCount: forceFilteredEvaluations.length,
    evaluations: forceFilteredEvaluations.map(e => ({
      employeeID: e.employeeID,
      employeeName: e.employeeName,
      evaluator: e.evaluatorName
    }))
  });

  return (
    <div className="evaluated-page-container">
      <div className="evaluated-header">
        <Title level={2} className="evaluated-title">
          {isEmployee ? "My Evaluations" : "Evaluations"}
        </Title>
        <div className="evaluated-actions">
          {(isAdmin || isHR) && (
            <>
              <Button
                type="default"
                icon={<CalendarOutlined />}
                onClick={() => {
                  setTempSemesterConfig(semesterConfig);
                  setIsSemesterConfigModalVisible(true);
                }}
                title="Configure semester dates"
              >
                Configure Semesters
              </Button>
              <Button
                type="primary"
                icon={<RedoOutlined />}
                loading={resetting}
                onClick={showResetConfirmation}
                danger
              >
                Archive & Reset Current Evaluations
              </Button>
            </>
          )}
        </div>
      </div>

      <Spin spinning={loading || resetting || coordinatorLoading} className="evaluated-loading">
        <div className="evaluated-tabs">
          <Tabs defaultActiveKey="history" type="line">
            <TabPane
              tab={
                <span>
                  {isEmployee ? "My Evaluations" : "Current Evaluations"}
                </span>
              }
              key="history"
            >
              {/* Print Button for Current Evaluations - Only visible to Admin, HR, and Coordinator */}
              {(isAdmin || isHR || isCoordinator) && (
                <div style={{ marginBottom: 16, textAlign: 'right' }}>
                  <Button
                    type="primary"
                    icon={<PrinterOutlined />}
                    onClick={printCurrentEvaluations}
                    disabled={currentSemesterData.length === 0}
                  >
                    Print Current Evaluations
                  </Button>
                </div>
              )}

              <div className="evaluated-filters">
                {!isCoordinator && !isEmployee && (
                  <Select
                    value={selectedHistoryDepartment}
                    onChange={(value) => {
                      setSelectedHistoryDepartment(value);
                    }}
                    style={{ width: 250 }}
                    placeholder="Filter by department"
                    size="large"
                  >
                    <Option value="all">All Departments</Option>
                    {departments.map((dept) => (
                      <Option key={dept} value={dept}>
                        {dept}
                      </Option>
                    ))}
                  </Select>
                )}
                {!isEmployee && (
                  <Select
                    value={selectedSemester}
                    onChange={setSelectedSemester}
                    style={{ width: 400 }}
                    placeholder="Select Semester"
                    size="large"
                  >
                    <Option value="S1">{getSemesterLabel("S1")}</Option>
                    <Option value="S2">{getSemesterLabel("S2")}</Option>
                  </Select>
                )}
              </div>

              <div className="evaluated-info-panel">
                <Title level={4} style={{ margin: 0, marginBottom: 8 }}>
                  {isEmployee ? "My Evaluation History" : getSemesterLabel(selectedSemester)}
                </Title>
                <div className="evaluated-info-content">
                  {!isEmployee && selectedHistoryDepartment !== "all" && (
                    <div>
                      <strong>Department:</strong> {selectedHistoryDepartment}
                    </div>
                  )}
                  {isCoordinator && (
                    <div>
                      <strong>Department:</strong> {coordinatorDepartment}
                    </div>
                  )}
                </div>
                {isEmployee && currentSemesterData.length > 0 && (
                  <div className="evaluated-note">
                    <strong>Note:</strong> You are viewing only your own evaluation records
                  </div>
                )}
              </div>

              {currentSemesterData.length === 0 ? (
                <div className="evaluated-empty-state">
                  <p className="evaluated-empty-text">
                    {isEmployee 
                      ? "No evaluations found for you"
                      : `No evaluations found for ${getSemesterLabel(selectedSemester)}`
                    }
                    {selectedHistoryDepartment !== "all" && ` in ${selectedHistoryDepartment}`}
                    {isCoordinator && ` in ${coordinatorDepartment}`}
                  </p>
                </div>
              ) : (
                <Table<EvalWithNames>
                  className="evaluated-table"
                  rowKey={(record) => `${record.evaluationID}-${record.employeeID}`}
                  columns={columns}
                  dataSource={currentSemesterData}
                  bordered
                  pagination={{ pageSize: 10 }}
                  sortDirections={["descend", "ascend"]}
                  onRow={isEmployee ? undefined : (record) => ({
                    onClick: () => {
                      const history: EvalWithNames[] =
                        allHistoryEvaluations.filter(
                          (e) => e.employeeID === record.employeeID
                        );

                      // Open modal with this employee's full history
                      setSelectedEmployeeHistory(history);
                      setShowHistoryModal(true);
                    },
                  })}
                />
              )}
            </TabPane>

            {(isAdmin || isHR) && (
              <TabPane
                tab={
                  <span>
                    <DeleteOutlined /> Archived Evaluations
                  </span>
                }
                key="archived"
              >
                <div className="evaluated-stats">
                  <Row gutter={16} style={{ marginBottom: 16 }}>
                    <Col span={12}>
                      <Card>
                        <Statistic
                          title="Total Archived Evaluations"
                          value={evaluationHistory.length}
                          prefix={<DeleteOutlined />}
                        />
                      </Card>
                    </Col>
                    <Col span={12}>
                      <Card>
                        <Statistic
                          title="Current Evaluations"
                          value={evaluations.length}
                          prefix={<FileTextOutlined />}
                        />
                      </Card>
                    </Col>
                  </Row>
                </div>

                <Spin spinning={historyLoading}>
                  {evaluationHistory.length === 0 ? (
                    <div className="evaluated-empty-state">
                      <DeleteOutlined className="evaluated-empty-icon" />
                      <p className="evaluated-empty-text">
                        No archived evaluations found
                      </p>
                      <p className="evaluated-empty-subtext">
                        Archived evaluations will appear here after using the "Archive & Reset" function
                      </p>
                    </div>
                  ) : (
                    <Table
                      className="evaluated-table"
                      rowKey="evaluationHistoryID"
                      columns={archivedColumns}
                      dataSource={evaluationHistory}
                      bordered
                      pagination={{ pageSize: 10 }}
                    />
                  )}
                </Spin>
              </TabPane>
            )}

            {!isEmployee && (
              <TabPane
                tab={
                  <span>
                    <CalendarOutlined /> Semester Totals
                  </span>
                }
                key="semester"
              >
                {/* Print Button for Semester Totals */}
                <div style={{ marginBottom: 16, textAlign: 'right' }}>
                  <Button
                    type="primary"
                    icon={<PrinterOutlined />}
                    onClick={printSemesterTotals}
                    disabled={employeeTotals.length === 0}
                  >
                    Print Semester Totals
                  </Button>
                </div>

                {employeeTotals.length === 0 ? (
                  <div className="evaluated-empty-state">
                    <p className="evaluated-empty-text">
                      No semester evaluations found for Year {selectedYear}
                    </p>
                  </div>
                ) : (
                  <Table
                    className="evaluated-table"
                    rowKey="employeeID"
                    columns={semesterColumns}
                    dataSource={employeeTotals}
                    bordered
                    pagination={{ pageSize: 10 }}
                    sortDirections={["descend", "ascend"]}
                  />
                )}
              </TabPane>
            )}
          </Tabs>
        </div>
      </Spin>

      {/* Semester Configuration Modal */}
      <SemesterConfigModal />

      {/* Reset Confirmation Modal */}
      <Modal
        title={
          <span>
            <ExclamationCircleOutlined
              style={{ color: "#ff4d4f", marginRight: 8 }}
            />
            Archive and Reset Current Evaluations
          </span>
        }
        open={isResetModalVisible}
        onOk={handleResetConfirm}
        onCancel={handleResetCancel}
        okText="Yes, Archive and Reset"
        cancelText="Cancel"
        okButtonProps={{ danger: true }}
        width={600}
        className="evaluated-modal"
      >
        <div className="evaluated-modal-content">
          <div className="evaluated-modal-section">
            <p style={{ fontSize: "14px", marginBottom: 12 }}>
              Are you sure you want to archive current evaluations and reset the system?
            </p>
          </div>
          <div className="evaluated-modal-section">
            <p style={{ fontSize: "14px", color: "#ff4d4f", fontWeight: 500 }}>
              This will:
            </p>
            <ul style={{ fontSize: "14px", color: "#ff4d4f", paddingLeft: 20, marginBottom: 12 }}>
              <li>Move all current evaluations to history/archive</li>
              <li>Clear current evaluation data for new evaluations</li>
              <li>Preserve all historical data in the archive</li>
            </ul>
          </div>
          <div className="evaluated-modal-section">
            <p style={{ fontSize: "14px", marginTop: 12 }}>
              Previous evaluations will be available in the "Archived Evaluations" tab.
            </p>
          </div>
        </div>
      </Modal>

      {/* Current Evaluation Details Modal */}
    <Modal
      title="Evaluation Details"
      open={isModalVisible}
      onCancel={handleModalClose}
      footer={[
        <Button key="close" onClick={handleModalClose}>
          Close
        </Button>
      ]}
      width={700}
    >
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button key="print" icon={<PrinterOutlined />} onClick={() => selectedEvaluation && printEvaluationDetails(selectedEvaluation, evaluationAnswers)}>
          Print
        </Button>
      </div>
        <div className="evaluated-modal-content">
          {selectedEvaluation && (
            <>
              <div className="evaluated-modal-section">
                <p>
                  <strong>Evaluator:</strong> {selectedEvaluation.evaluatorName}
                </p>
                <p>
                  <strong>Employee Evaluated:</strong>{" "}
                  {selectedEvaluation.employeeName}
                </p>
                <p>
                  <strong>Final Score:</strong>{" "}
                  {selectedEvaluation.finalScore.toFixed(2)}
                </p>
                <p>
                  <strong>Evaluation Date:</strong>{" "}
                  {new Date(selectedEvaluation.evaluationDate).toLocaleDateString()}
                </p>
              </div>

              <div className="evaluated-modal-section">
                <Spin spinning={modalLoading}>
                  <Table<SubGroupAnswer>
                    className="evaluated-table"
                    rowKey="subGroupID"
                    dataSource={evaluationAnswers}
                    pagination={false}
                    bordered
                    size="small"
                    columns={[
                      {
                        title: "SubGroup",
                        dataIndex: "subGroupName",
                        key: "subGroupName",
                      },
                      {
                        title: "Score",
                        dataIndex: "scoreValue",
                        key: "scoreValue",
                        render: (value) => <strong>{value}</strong>,
                      },
                      {
                        title: "Label",
                        dataIndex: "scoreLabel",
                        key: "scoreLabel",
                      },
                    ]}
                  />
                </Spin>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Archived Evaluation Details Modal */}
      <Modal
        title="Archived Evaluation Details"
        open={isArchivedDetailsModalVisible}
        onCancel={handleArchivedModalClose}
        footer={[
          <Button key="close" onClick={handleArchivedModalClose}>
            Close
          </Button>
        ]}
        width={700}
        className="evaluated-modal"
      >
        <div className="evaluated-modal-content">
          {selectedHistoryEvaluation && (
            <>
              <div className="evaluated-modal-section">
                <p>
                  <strong>Evaluator:</strong> {selectedHistoryEvaluation.evaluatorName}
                </p>
                <p>
                  <strong>Employee Evaluated:</strong>{" "}
                  {selectedHistoryEvaluation.employeeName}
                </p>
                <p>
                  <strong>Final Score:</strong>{" "}
                  {selectedHistoryEvaluation.finalScore.toFixed(2)}
                </p>
                <p>
                  <strong>Evaluation Date:</strong>{" "}
                  {new Date(selectedHistoryEvaluation.evaluationDate).toLocaleDateString()}
                </p>
                <p>
                  <strong>Archived Date:</strong>{" "}
                  {new Date(selectedHistoryEvaluation.archivedAt).toLocaleDateString()}
                </p>

                {selectedHistoryEvaluation.comments && (
                  <p>
                    <strong>Comments:</strong> {selectedHistoryEvaluation.comments}
                  </p>
                )}
              </div>

              <div className="evaluated-modal-section">
                <Spin spinning={historyModalLoading}>
                  <Table<SubGroupAnswer>
                    className="evaluated-table"
                    rowKey="subGroupID"
                    dataSource={selectedHistoryEvaluation.scores}
                    pagination={false}
                    bordered
                    size="small"
                    columns={[
                      {
                        title: "SubGroup",
                        dataIndex: "subGroupName",
                        key: "subGroupName",
                      },
                      {
                        title: "Score",
                        dataIndex: "scoreValue",
                        key: "scoreValue",
                        render: (value) => <strong>{value}</strong>,
                      },
                      {
                        title: "Label",
                        dataIndex: "scoreLabel",
                        key: "scoreLabel",
                      },
                    ]}
                  />
                </Spin>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Employee Evaluation History Modal */}
      <Modal
        title="Employee Evaluation History"
        open={showHistoryModal}
        onCancel={() => setShowHistoryModal(false)}
        footer={null}
        width={800}
        className="evaluated-modal"
        getContainer={false} 
      >
        <div className="evaluated-modal-content">
          <Table<EvalWithNames>
            className="evaluated-table"
            rowKey="evaluationID"
            columns={columnsV2}
            dataSource={selectedEmployeeHistory}
            pagination={{ pageSize: 5 }}
            bordered
          />
        </div>
      </Modal>
    </div>
  );
};

export default EvaluatedPage;