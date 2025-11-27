import React, { useEffect, useState, useMemo } from "react";
import {
  Card,
  Col,
  Row,
  Statistic,
  message,
  Spin,
  List,
  Typography,
  Avatar,
  Tag,
  Select,
  DatePicker,
  Button,
} from "antd";
import {
  UserOutlined,
  TeamOutlined,
  FileProtectOutlined,
  FileTextOutlined as FileTextIconOutlined,
  BellOutlined,
  CalendarOutlined,
  InfoCircleOutlined,
  LineChartOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  MailOutlined,
} from "@ant-design/icons";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { EmployeeService } from "../api/EmployeeService"; 
import { ContractService } from "../api/ContractService";
import { EmployeeWithContracts } from "../types/tblContracts";
import { PositionTypes } from "../types/tblPosition";
import { DepartmentTypes } from "../types/tblDepartment";
import moment from "moment";
import dayjs, { Dayjs } from "dayjs";
import isBetween from 'dayjs/plugin/isBetween'; 
import PositionService from "../api/PositionService";
import DepartmentService from "../api/DepartmentService";
import { useAuth } from "../types/useAuth";
import { ROLES } from "../types/auth";
import axios from "../api/_axiosInstance";
import "./Dashboard.css";

const { Title, Text } = Typography;
const { Option } = Select;

dayjs.extend(isBetween);

const Dashboard: React.FC = () => {
  const [employeeData, setEmployeeData] = useState<EmployeeWithContracts[]>([]);
  const [positions, setPositions] = useState<PositionTypes[]>([]);
  const [departments, setDepartments] = useState<DepartmentTypes[]>([]);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [, setEmployeeRoles] = useState<Map<number, number>>(new Map());
  const [loading, setLoading] = useState<boolean>(false);
  const [currentEmployee, setCurrentEmployee] = useState<EmployeeWithContracts | null>(null);
  const [chartView, setChartView] = useState<'hire' | 'contract' | 'evaluation'>('hire');
  const [hiringView, setHiringView] = useState<'monthly' | 'yearly'>('monthly');
  const [employeeEvaluation, setEmployeeEvaluation] = useState<any>(null);
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);
  const [sendingEmails, setSendingEmails] = useState<boolean>(false);
  
  const { user } = useAuth();
  const isAdmin = user?.roleId === ROLES.Admin;
  const isHR = user?.roleId === ROLES.HR;
  const isCoordinator = user?.roleId === ROLES.Coordinator;

  // Admin and HR see the same admin dashboard
  const canViewAdminDashboard = isAdmin || isHR;

  // Define teaching and non-teaching roles (typed as number[] to avoid literal union issues)
  const teachingRoles: number[] = [ROLES.Teaching, ROLES.Coordinator];
  const nonTeachingRoles: number[] = [ROLES.NonTeaching];

  useEffect(() => {
    fetchData();
    
    const handleEvaluationsReset = () => {
      fetchData();
    };
    
    window.addEventListener('evaluationsReset', handleEvaluationsReset);
    
    return () => {
      window.removeEventListener('evaluationsReset', handleEvaluationsReset);
    };
  }, [isAdmin, isHR, isCoordinator, user?.employeeId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [employees, positionsData, departmentsData, evaluationsData, usersData] = await Promise.all([
        EmployeeService.getAll(),
        PositionService.getAll(),
        DepartmentService.getAll(),
        axios.get("/Evaluations"),
        axios.get("/Users") // Fetch user data to get roles
      ]);
      
      // Create a map of employeeID to roleId
      const roleMap = new Map<number, number>();
      usersData.data.forEach((userItem: any) => {
        if (userItem.employeeId) {
          roleMap.set(userItem.employeeId, userItem.roleId);
        }
      });
      setEmployeeRoles(roleMap);
      
      let filteredEmployees = employees;
      
      // Admin and HR can see all employees
      if (canViewAdminDashboard) {
        filteredEmployees = employees;
      } else if (!isCoordinator && user?.employeeId) {
        // Regular employees see only their own data
        filteredEmployees = employees.filter(emp => emp.employeeID === user.employeeId);
      } else if (isCoordinator) {
        // Coordinators see all employees (for evaluation purposes)
        filteredEmployees = employees;
      }
      
      const employeesWithContracts = await Promise.all(
        filteredEmployees.map(async (emp) => {
          try {
            const employeeContracts = await ContractService.getByEmployeeId(emp.employeeID!);
            
            const employeeWithContracts: EmployeeWithContracts = {
              ...emp,
              contracts: employeeContracts,
              contractStatus: "",
              roleId: roleMap.get(emp.employeeID!) || 0
            };
            
            return employeeWithContracts;
          } catch (error) {
            console.error(`Failed to fetch contracts for employee ${emp.employeeID}:`, error);
            return {
              ...emp,
              contracts: [],
              roleId: roleMap.get(emp.employeeID!) || 0
            } as unknown as EmployeeWithContracts;
          }
        })
      );
      
      setEmployeeData(employeesWithContracts);
      setPositions(positionsData);
      setDepartments(departmentsData);
      setEvaluations(evaluationsData.data || []);
      
      // For non-admin/HR users, set current employee data
      if (!canViewAdminDashboard && user?.employeeId) {
        const currentEmp = employeesWithContracts.find(emp => emp.employeeID === user.employeeId);
        setCurrentEmployee(currentEmp || null);
        
        const employeeEval = evaluationsData.data.find((evalItem: any) => 
          evalItem.employeeID === user.employeeId
        );
        setEmployeeEvaluation(employeeEval || null);
        
        console.log('Current employee found:', currentEmp);
        console.log('Employee evaluation:', employeeEval);
      }
    } catch (error) {
      message.error("Failed to load data");
      console.error("Fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  const sendBonusEligibilityEmails = async () => {
    setSendingEmails(true);
    try {
      const eligibleEmployeesForEmail = evaluationEligibleEmployees.map(emp => ({
        id: emp.id,
        name: emp.name,
        finalScore: emp.finalScore,
        requiredScore: emp.requiredScore,
        isAssistant: emp.isAssistant
      }));

      const response = await axios.post("/Email/send-bonus-eligibility", {
        eligibleEmployees: eligibleEmployeesForEmail
      });
      
      if (response.data.success) {
        message.success(`Bonus eligibility emails sent to ${evaluationEligibleEmployees.length} employees`);
      } else {
        message.error("Failed to send some emails");
      }
    } catch (error) {
      console.error("Error sending emails:", error);
      message.error("Failed to send emails");
    } finally {
      setSendingEmails(false);
    }
  };

  const getPositionName = (positionId?: number | null) => {
    if (positionId == null) return "Unknown";
    return positions.find(p => p.positionID === positionId)?.positionName || "Unknown";
  };

  const getDepartmentName = (departmentId?: number | null) => {
    if (departmentId == null) return "Unknown";
    return departments.find(d => d.departmentID === departmentId)?.departmentName || "Unknown";
  };

  const getRoleName = (roleId?: number | null) => {
    if (!roleId) return "Unknown";
    switch (roleId) {
      case ROLES.Admin: return "Admin";
      case ROLES.Teaching: return "Teaching";
      case ROLES.NonTeaching: return "Non-Teaching";
      case ROLES.Coordinator: return "Coordinator";
      case ROLES.HR: return "HR";
      default: return "Unknown";
    }
  };

  // Helper function to determine if employee is quarter-based
  const isEmployeeQuarterBased = (departmentId?: number | null): boolean => {
    if (!departmentId) return false;
    
    const departmentName = getDepartmentName(departmentId).toLowerCase();
    
    // Quarter-based departments: Pre Elementary, Elementary, High School
    const isPreElementary = departmentName.includes("pre elementary") || departmentName.includes("pre-elementary");
    const isElementary = departmentName.includes("elementary");
    const isHighSchool = (departmentName.includes("high school") || departmentName.includes("highschool")) && !departmentName.includes("senior");

    return isPreElementary || isElementary || isHighSchool;
  };
  
  // Count teachers and non-teaching staff based on roles
  const totalTeachers = employeeData.filter(e =>
    e.roleId != null && teachingRoles.includes(e.roleId as number)
  ).length;
  
  const totalNonTeaching = employeeData.filter(e =>
    e.roleId != null && nonTeachingRoles.includes(e.roleId as number)
  ).length;

  
  const getContractTypeCounts = () => {
    const counts: { [key: string]: number } = {
      'Permanent': 0,
      'Regular': 0,
      'Contractual': 0,
      'Probationary': 0,
      'Temporary': 0,
      'Part-Time': 0,
      'Unknown': 0
    };
    
    employeeData.forEach(e => {
      if (e.contracts && e.contracts.length > 0) {
        const latestContract = e.contracts[e.contracts.length - 1];
        const contractType = latestContract.contractType || 'Unknown';
        if (counts[contractType] !== undefined) {
          counts[contractType]++;
        } else {
          counts['Unknown']++;
        }
      } else {
        counts['Unknown']++;
      }
    });
    
    return counts;
  };
  
  const contractTypeCounts = getContractTypeCounts();

  const adminNotifications = employeeData
    .filter((employee) => {
      if (!employee.contracts || employee.contracts.length === 0) return false;
      
      const latestContract = employee.contracts[employee.contracts.length - 1];
      if (!latestContract.contractEndDate) return false;
      
      const contractEndDate = moment(latestContract.contractEndDate);
      return contractEndDate.isAfter(moment()) && 
             contractEndDate.diff(moment(), "days") <= 30;
    })
    .map((employee) => {
      const latestContract = employee.contracts[employee.contracts.length - 1];
      return {
        title: `${employee.firstName} ${employee.lastName}'s contract ends soon`,
        description: `Position: ${getPositionName(employee.positionID)} | Role: ${getRoleName(employee.roleId)}`,
        date: moment(latestContract.contractEndDate).format("MMMM D, YYYY"),
      };
    });

  const getEmployeeStats = () => {
    if (!currentEmployee) {
      return {
        contractStatus: 'Unknown',
        daysUntilContractEnd: 0,
        department: 'Unknown',
        position: 'Unknown',
        hireDate: 'Unknown',
        employeeName: user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : 'Employee',
        contractType: 'Unknown',
        isEvaluated: false,
        evaluationScore: null,
        evaluationDate: null,
        role: getRoleName(user?.roleId),
      };
    }

    const latestContract = currentEmployee.contracts && currentEmployee.contracts.length > 0 
      ? currentEmployee.contracts[currentEmployee.contracts.length - 1] 
      : null;
    
    let contractStatus = 'Unknown';
    let daysUntilContractEnd = 0;
    let contractType = 'Unknown';
    
    if (latestContract) {
      if (latestContract.contractEndDate) {
        const contractEndDate = moment(latestContract.contractEndDate);
        daysUntilContractEnd = contractEndDate.diff(moment(), 'days');
        contractStatus = daysUntilContractEnd > 0 ? 'Active' : 'Expired';
      }
      if (latestContract.contractType) {
        contractType = latestContract.contractType;
      }
    }

    const hireDate = moment(currentEmployee.hireDate);

    return {
      contractStatus,
      daysUntilContractEnd: Math.max(0, daysUntilContractEnd),
      department: getDepartmentName(currentEmployee.departmentID),
      position: getPositionName(currentEmployee.positionID),
      hireDate: hireDate.format('MMMM D, YYYY'),
      employeeName: `${currentEmployee.firstName} ${currentEmployee.lastName}`,
      contractType,
      isEvaluated: !!employeeEvaluation,
      evaluationScore: employeeEvaluation?.finalScore || null,
      evaluationDate: employeeEvaluation?.evaluationDate || null,
      role: getRoleName(currentEmployee.roleId),
    };
  };

  const employeeStats = getEmployeeStats();

  const getHiringTrendData = () => {
    // Filter employees by date range
    const filteredEmployees = employeeData.filter((employee) => {
      if (!employee.hireDate) return false;
      
      const hireDate = dayjs(employee.hireDate);
      
      // If no date range is selected, include all employees
      if (!dateRange[0] || !dateRange[1]) return true;
      
      // Filter by the selected date range
      return hireDate.isBetween(dateRange[0], dateRange[1], 'day', '[]');
    });

    if (hiringView === 'monthly') {
      // Group by month for monthly view
      const monthlyData: { [key: string]: { count: number; employees: string[] } } = {};
      
      filteredEmployees.forEach((employee) => {
        if (employee.hireDate) {
          const monthKey = moment(employee.hireDate).format('MMM YYYY');
          const employeeName = `${employee.firstName} ${employee.lastName}`;
          
          if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = { count: 0, employees: [] };
          }
          monthlyData[monthKey].count += 1;
          monthlyData[monthKey].employees.push(employeeName);
        }
      });

      // Convert to array and sort by date
      return Object.entries(monthlyData)
        .map(([month, data]) => ({
          month,
          employees: data.count,
          employeeNames: data.employees,
          date: moment(month, 'MMM YYYY').toDate(),
        }))
        .sort((a, b) => a.date.getTime() - b.date.getTime());
    } else {
      // Yearly view
      const yearlyData: { [key: string]: { count: number; employees: string[] } } = {};
      
      filteredEmployees.forEach((employee) => {
        if (employee.hireDate) {
          const year = moment(employee.hireDate).format('YYYY');
          const employeeName = `${employee.firstName} ${employee.lastName}`;
          
          if (!yearlyData[year]) {
            yearlyData[year] = { count: 0, employees: [] };
          }
          yearlyData[year].count += 1;
          yearlyData[year].employees.push(employeeName);
        }
      });

      return Object.entries(yearlyData)
        .map(([year, data]) => ({
          month: year,
          employees: data.count,
          employeeNames: data.employees,
          date: moment(year, 'YYYY').toDate(),
        }))
        .sort((a, b) => a.date.getTime() - b.date.getTime());
    }
  };

  const getContractEndData = () => {
    const monthlyData: { [key: string]: { count: number; employees: string[] } } = {};
    
    employeeData.forEach((employee) => {
      if (employee.contracts && employee.contracts.length > 0) {
        const latestContract = employee.contracts[employee.contracts.length - 1];
        if (latestContract.contractEndDate) {
          // Filter by date range if selected
          if (dateRange[0] && dateRange[1]) {
            const contractEndDate = dayjs(latestContract.contractEndDate);
            if (!contractEndDate.isBetween(dateRange[0], dateRange[1], 'day', '[]')) {
              return;
            }
          }

          const month = moment(latestContract.contractEndDate).format('MMM YYYY');
          const employeeName = `${employee.firstName} ${employee.lastName}`;
          
          if (!monthlyData[month]) {
            monthlyData[month] = { count: 0, employees: [] };
          }
          monthlyData[month].count += 1;
          monthlyData[month].employees.push(employeeName);
        }
      }
    });

    return Object.entries(monthlyData)
      .map(([month, data]) => ({
        month,
        contracts: data.count,
        employees: data.employees,
        date: moment(month, 'MMM YYYY').toDate(),
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(-12); // Show last 12 months
  };

  // Memoize evaluation pie data and eligible employees to avoid recomputing during render
  const { evaluationPieData, evaluationEligibleEmployees } = useMemo(() => {
    const eligibleNames: string[] = [];
    const notEligibleNames: string[] = [];
    const eligibleEmployeesList: { 
      id?: number; 
      name: string; 
      finalScore: number; 
      requiredScore: number; 
      isAssistant: boolean;
      evaluationCount: number;
    }[] = [];

    // Create a map to store all evaluations per employee
    const employeeEvaluationsMap = new Map<number, any[]>();
    
    // Group evaluations by employee
    evaluations.forEach((evaluation) => {
      if (!employeeEvaluationsMap.has(evaluation.employeeID)) {
        employeeEvaluationsMap.set(evaluation.employeeID, []);
      }
      employeeEvaluationsMap.get(evaluation.employeeID)!.push(evaluation);
    });

    employeeData.forEach((employee) => {
      if (!employee.employeeID) return; // Skip employees without an ID
      const employeeName = `${employee.firstName} ${employee.lastName}`;
      const employeeEvals = employeeEvaluationsMap.get(employee.employeeID) || [];

      if (employeeEvals.length === 0) {
        return; // Skip employees with no evaluations
      }

      // Check if employee is quarter-based or semester-based
      const isQuarterBased = isEmployeeQuarterBased(employee.departmentID);
      const requiredEvaluations = isQuarterBased ? 4 : 2; // 4 quarters or 2 semesters

      // Only consider employees with complete evaluations
      if (employeeEvals.length >= requiredEvaluations) {
        // Calculate total average score for the employee
        const totalScore = employeeEvals.reduce((sum, evalItem) => sum + evalItem.finalScore, 0);
        const averageScore = totalScore / employeeEvals.length;

        const positionName = getPositionName(employee.positionID).toLowerCase();
        const isAssistant = positionName.includes('assistant');
        const requiredScore = 4.2;

        if (averageScore >= requiredScore) {
          eligibleNames.push(employeeName);
          eligibleEmployeesList.push({
            id: employee.employeeID,
            name: employeeName,
            finalScore: averageScore,
            requiredScore,
            isAssistant,
            evaluationCount: employeeEvals.length,
          });
        } else {
          notEligibleNames.push(employeeName);
        }
      }
    });

    const pieData = [
      { name: 'Eligible for Bonus', value: eligibleNames.length, employees: eligibleNames, fill: '#00C49F' },
      { name: 'Not Eligible for Bonus', value: notEligibleNames.length, employees: notEligibleNames, fill: '#FFBB28' },
    ];

    return {
      evaluationPieData: pieData,
      evaluationEligibleEmployees: eligibleEmployeesList,
    };
  }, [employeeData, evaluations, positions]);

  const employeeNotifications = [
    {
      title: "Welcome to BCAS HRMS",
      description: "Access your personal information and contracts here",
      type: "info",
      icon: <InfoCircleOutlined />,
    },
    ...(employeeStats.isEvaluated ? [{
      title: "Evaluation Completed",
      description: `Your performance evaluation has been completed with a score of ${employeeStats.evaluationScore?.toFixed(2) || 'N/A'}`,
      type: "success",
      icon: <CheckCircleOutlined />,
      date: employeeStats.evaluationDate ? moment(employeeStats.evaluationDate).format("MMMM D, YYYY") : null,
    }] : [{
      title: "Evaluation Pending",
      description: "Your performance evaluation is currently pending",
      type: "info",
      icon: <ClockCircleOutlined />,
    }]),
    ...(employeeStats.isEvaluated && employeeStats.evaluationScore && (() => {
      const requiredRating = 4.2; // Unified requirement
      return employeeStats.evaluationScore >= requiredRating;
    })() ? [{
      title: "🎉 Performance Bonus Eligibility",
      description: "Congratulations! Your evaluation score qualifies you for a performance bonus. To receive this bonus, you must meet the following requirements: no more than 5 late arrivals, no more than 3 absences in the school year, and no memorandums for policy violations.",
      type: "success",
      icon: <CheckCircleOutlined />,
    }] : []),
    ...(employeeStats.daysUntilContractEnd <= 30 && employeeStats.daysUntilContractEnd > 0 ? [{
      title: "Contract Renewal Reminder",
      description: `Your contract expires in ${employeeStats.daysUntilContractEnd} days`,
      type: "warning",
      icon: <CalendarOutlined />,
    }] : []),
    ...(employeeStats.contractStatus === 'Expired' ? [{
      title: "Contract Expired",
      description: "Please contact HR regarding contract renewal",
      type: "error",
      icon: <CalendarOutlined />,
    }] : []),
  ];

const totalAdminAndHR = employeeData.filter(e =>
  e.roleId != null && (e.roleId === ROLES.Admin || e.roleId === ROLES.HR)
).length;

  const renderAdminDashboard = () => (
    <>
    
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card className="dashboard-stat-card">
            <Statistic
              title="Total Teachers"
              value={totalTeachers}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
          
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="dashboard-stat-card">
            <Statistic
              title="Non-Teaching Staff"
              value={totalNonTeaching}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6} >
          <Card className="dashboard-stat-card">
            <Statistic
              title="Admin & HR Staff"
              value={totalAdminAndHR}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="dashboard-stat-card">
            <Statistic
              title="Total Employees"
              value={employeeData.length}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Card className="dashboard-stat-card">
            <Statistic
              title="Contractual"
              value={contractTypeCounts['Contractual']}
              prefix={<FileTextIconOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
         <Col xs={24} sm={12} md={6}>
          <Card className="dashboard-stat-card">
            <Statistic 
              title="Regular" 
              value={contractTypeCounts['Regular']} 
              prefix={<FileProtectOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="dashboard-stat-card">
            <Statistic
              title="Probationary"
              value={contractTypeCounts['Probationary']}
              prefix={<FileTextIconOutlined />}
              valueStyle={{ color: '#eb2f96' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="dashboard-stat-card">
            <Statistic
              title="Part-Time"
              value={contractTypeCounts['Part-Time']}
              prefix={<FileTextIconOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} md={16}>
          <Card 
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <span><LineChartOutlined /> Analytics Dashboard</span>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {(chartView === 'hire' || chartView === 'contract') && (
                    <>
                      <DatePicker.RangePicker
                        value={dateRange}
                        onChange={(dates) => setDateRange(dates as [Dayjs | null, Dayjs | null])}
                        format="MMM DD, YYYY"
                        style={{ 
                          width: '280px',
                          borderRadius: '6px',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                        }}
                        allowClear
                        suffixIcon={<CalendarOutlined style={{ color: '#1890ff' }} />}
                      />
                    </>
                  )}
                  {chartView === 'hire' && (
                    <Select 
                      value={hiringView} 
                      onChange={setHiringView}
                      style={{ 
                        width: 120,
                        borderRadius: '6px'
                      }}
                    >
                      <Option value="monthly">Monthly</Option>
                      <Option value="yearly">Yearly</Option>
                    </Select>
                  )}
                  <Select 
                    value={chartView} 
                    onChange={(value) => {
                      setChartView(value);
                      if (value === 'evaluation') {
                        setDateRange([null, null]);
                      }
                    }}
                    style={{ 
                      width: 200,
                      borderRadius: '6px'
                    }}
                  >
                    <Option value="hire">Hiring Trends</Option>
                    <Option value="contract">Contract End Dates</Option>
                    <Option value="evaluation">Performance Bonus Eligibility</Option>
                  </Select>
                </div>
              </div>
            }
            className="dashboard-calendar-card"
          >
            {chartView === 'hire' && (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={getHiringTrendData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="month" 
                    angle={hiringView === 'monthly' ? -45 : 0}
                    textAnchor={hiringView === 'monthly' ? 'end' : 'middle'}
                    height={hiringView === 'monthly' ? 80 : 60}
                  />
                  <YAxis allowDecimals={false} />
                  <Tooltip 
                    content={({ active, payload }: any) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div style={{ 
                            background: 'white', 
                            padding: '10px', 
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            maxWidth: '300px'
                          }}>
                            <p style={{ margin: 0, fontWeight: 'bold' }}>
                              {data.month}
                            </p>
                            <p style={{ margin: '4px 0 0 0', color: '#1890ff' }}>
                              Employees Hired: {payload[0].value}
                            </p>
                            {data.employeeNames && data.employeeNames.length > 0 && (
                              <div style={{ borderTop: '1px solid #eee', paddingTop: '8px', marginTop: '8px' }}>
                                <p style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '12px' }}>Employees:</p>
                                {data.employeeNames.slice(0, 5).map((name: string, idx: number) => (
                                  <p key={idx} style={{ margin: '2px 0', fontSize: '12px' }}>
                                    • {name}
                                  </p>
                                ))}
                                {data.employeeNames.length > 5 && (
                                  <p style={{ margin: '2px 0', fontSize: '12px', fontStyle: 'italic' }}>
                                    ... and {data.employeeNames.length - 5} more
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="employees" 
                    stroke="#1890ff" 
                    strokeWidth={2}
                    name="Employees Hired"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
            
            {chartView === 'contract' && (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={getContractEndData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" angle={-45} textAnchor="end" height={80} />
                  <YAxis allowDecimals={false} />
                  <Tooltip 
                    content={({ active, payload }: any) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div style={{ 
                            background: 'white', 
                            padding: '12px', 
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            maxWidth: '300px'
                          }}>
                            <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                              {data.month}
                            </p>
                            <p style={{ marginBottom: '8px' }}>
                              Contracts Ending: {data.contracts}
                            </p>
                            <div style={{ borderTop: '1px solid #eee', paddingTop: '8px' }}>
                              <p style={{ fontWeight: 'bold', marginBottom: '4px' }}>Employees:</p>
                              {data.employees.slice(0, 5).map((emp: string, idx: number) => (
                                <p key={idx} style={{ margin: '2px 0', fontSize: '12px' }}>
                                  • {emp}
                                </p>
                              ))}
                              {data.employees.length > 5 && (
                                <p style={{ margin: '2px 0', fontSize: '12px', fontStyle: 'italic' }}>
                                  ... and {data.employees.length - 5} more
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                  <Bar 
                    dataKey="contracts" 
                    fill="#ff4d4f" 
                    name="Contracts Ending"
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
            
            {chartView === 'evaluation' && (
              <div style={{ padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Title level={5} style={{ margin: 0 }}>Performance Bonus Eligibility</Title>
                  <Text type="secondary">{evaluationEligibleEmployees.length} eligible • {evaluationPieData.reduce((a: any, b: any) => a + b.value, 0)} evaluated</Text>
                </div>
                
                {/* Add Send Email Button for Admin/HR */}
                {(isAdmin || isHR) && evaluationEligibleEmployees.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <Button 
                      type="primary" 
                      icon={<MailOutlined />}
                      onClick={sendBonusEligibilityEmails}
                      loading={sendingEmails}
                    >
                      Notify Eligible Employees via Email
                    </Button>
                  </div>
                )}
                
                {evaluationEligibleEmployees.length === 0 ? (
                  <Text type="secondary">No employees are currently eligible for a performance bonus.</Text>
                ) : (
                  <List
                    size="small"
                    dataSource={evaluationEligibleEmployees}
                    renderItem={(item: any) => (
                      <List.Item>
                        <List.Item.Meta
                          title={`${item.name}`}
                          description={
                            <div>
                              <div>Total Average Score: <strong>{item.finalScore.toFixed(2)}</strong></div>
                              <div>Requirement: {item.requiredScore}{item.isAssistant ? ' (Assistant)' : ''}</div>
                              <div>Evaluations Completed: {item.evaluationCount}</div>
                              <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                                Status: <Tag color={item.finalScore >= item.requiredScore ? 'green' : 'red'}>
                                  {item.finalScore >= item.requiredScore ? 'ELIGIBLE' : 'NOT ELIGIBLE'}
                                </Tag>
                              </div>
                            </div>
                          }
                        />
                        <div>
                          <Tag color={item.isAssistant ? 'purple' : 'green'}>
                            {item.isAssistant ? 'Assistant' : 'Regular'}
                          </Tag>
                        </div>
                      </List.Item>
                    )}
                  />
                )}
              </div>
            )}
            
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card 
            title={<span><BellOutlined /> Contract End Alerts</span>}
            className="dashboard-notifications-card"
          >
            <List
              itemLayout="horizontal"
              dataSource={adminNotifications}
              locale={{ emptyText: "No upcoming contract endings." }}
              renderItem={(item) => (
                <List.Item className="dashboard-notification-item">
                  <List.Item.Meta
                    title={<div className="dashboard-notification-title">{item.title}</div>}
                    description={
                      <>
                        <div className="dashboard-notification-description">{item.description}</div>
                        <div className="dashboard-notification-date">End Date: {item.date}</div>
                      </>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </>
  );

  const renderCoordinatorDashboard = () => (
    <>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card className="welcome-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <Avatar size={64} icon={<UserOutlined />} />
              <div>
                <Title level={3} style={{ margin: 0 }}>
                  Welcome, {employeeStats.employeeName}!
                </Title>
                <Text type="secondary">
                  {employeeStats.position} • {employeeStats.department} • {employeeStats.role}
                </Text>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card className="dashboard-stat-card">
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#8c8c8c', fontSize: '14px', marginBottom: '16px' }}>
                Contract Type
              </div>
              <Tag 
                color={employeeStats.contractType === 'Permanent' ? 'green' : 
                       employeeStats.contractType === 'Regular' ? 'blue' :
                       employeeStats.contractType === 'Contractual' ? 'orange' :
                       employeeStats.contractType === 'Probationary' ? 'yellow' :
                       employeeStats.contractType === 'Temporary' ? 'red' :
                       employeeStats.contractType === 'Part-Time' ? 'purple' : 'default'}
                style={{ fontSize: '14px', padding: '4px 8px' }}
              >
                {employeeStats.contractType}
              </Tag>
            </div>
          </Card>
        </Col>
        
        {employeeStats.contractType !== 'Regular' && (
          <Col xs={24} sm={12} md={6}>
            <Card className="dashboard-stat-card">
              <Statistic
                title="Days Until Contract End"
                value={employeeStats.daysUntilContractEnd}
                prefix={<CalendarOutlined />}
                valueStyle={{ 
                  color: employeeStats.daysUntilContractEnd <= 30 ? '#ff4d4f' : '#3f8600'
                }}
              />
            </Card>
          </Col>
        )}
        
        <Col xs={24} sm={12} md={6}>
          <Card className="dashboard-stat-card">
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#8c8c8c', fontSize: '14px', marginBottom: '8px' }}>
                Hire Date
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <CalendarOutlined />
                <span style={{ fontSize: '16px', fontWeight: 500 }}>
                  {employeeStats.hireDate}
                </span>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="dashboard-stat-card">
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#8c8c8c', fontSize: '14px', marginBottom: '16px' }}>
                Evaluation Status
              </div>
              <Tag 
                color={employeeStats.isEvaluated ? 'green' : 'blue'}
                style={{ fontSize: '14px', padding: '4px 8px' }}
                icon={employeeStats.isEvaluated ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
              >
                {employeeStats.isEvaluated ? `Score: ${employeeStats.evaluationScore?.toFixed(2)}` : 'Pending'}
              </Tag>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} md={16}>
          <Card 
            title={<span><LineChartOutlined /> My Contract Timeline</span>}
            className="dashboard-calendar-card"
          >
            {currentEmployee && currentEmployee.contracts && currentEmployee.contracts.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart 
                  data={currentEmployee.contracts.map((contract, index) => ({
                    name: `Contract ${index + 1}`,
                    startDate: moment(contract.contractStartDate).format('MMM YYYY'),
                    endDate: moment(contract.contractEndDate).format('MMM YYYY'),
                    duration: moment(contract.contractEndDate).diff(moment(contract.contractStartDate), 'months'),
                    type: contract.contractType,
                  }))}
                >
                 <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis label={{ value: 'Duration (months)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip 
                    content={({ active, payload }: any) => {
                      if (active && payload && payload.length) {
                        const contractType = payload[0].payload.type;
                        const isRegularContract = contractType === 'Regular';
                        
                        return (
                          <div style={{ 
                            background: 'white', 
                            padding: '10px', 
                            border: '1px solid #ccc',
                            borderRadius: '4px'
                          }}>
                            <p><strong>{payload[0].payload.name}</strong></p>
                            <p>Type: {contractType}</p>
                            <p>Start: {payload[0].payload.startDate}</p>
                            {!isRegularContract && (
                              <>
                                <p>End: {payload[0].payload.endDate}</p>
                                <p>Duration: {payload[0].value} months</p>
                              </>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                  <Bar dataKey="duration" fill="#1890ff" name="Duration (months)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <Text type="secondary">No contract data available</Text>
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card 
            title={<span><BellOutlined /> Notifications</span>}
            className="dashboard-notifications-card"
          >
            <List
              itemLayout="horizontal"
              dataSource={employeeNotifications}
              renderItem={(item) => (
                <List.Item className="dashboard-notification-item">
                  <List.Item.Meta
                    avatar={
                      <Avatar 
                        icon={item.icon} 
                        style={{ 
                          backgroundColor: 
                            item.type === 'success' ? '#52c41a' :
                            item.type === 'warning' ? '#faad14' :
                            item.type === 'error' ? '#ff4d4f' : '#1890ff'
                        }} 
                      />
                    }
                    title={<div className="dashboard-notification-title">{item.title}</div>}
                    description={
                      <>
                        <div className="dashboard-notification-description">{item.description}</div>
                        {item.date && (
                          <div className="dashboard-notification-date">{item.date}</div>
                        )}
                      </>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      {/* Evaluation Status Overview for Coordinator */}
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col span={24}>
          <Card 
            title={<span><LineChartOutlined /> Performance Bonus Eligibility Overview</span>} 
            className="dashboard-calendar-card"
          >
            <div style={{ padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Title level={5} style={{ margin: 0 }}>Performance Bonus Eligible</Title>
                <Text type="secondary">{evaluationEligibleEmployees.length} eligible • {evaluationPieData.reduce((a: any, b: any) => a + b.value, 0)} evaluated</Text>
              </div>
              {evaluationEligibleEmployees.length === 0 ? (
                <Text type="secondary">No employees are currently eligible for a performance bonus.</Text>
              ) : (
                <List
                  size="small"
                  dataSource={evaluationEligibleEmployees}
                  renderItem={(item: any) => (
                    <List.Item>
                      <List.Item.Meta
                        title={`${item.name}`}
                        description={
                          <div>
                            <div>Total Average Score: <strong>{item.finalScore.toFixed(2)}</strong></div>
                            <div>Requirement: {item.requiredScore}{item.isAssistant ? ' (Assistant)' : ''}</div>
                            <div>Evaluations Completed: {item.evaluationCount}</div>
                            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                              Status: <Tag color={item.finalScore >= item.requiredScore ? 'green' : 'red'}>
                                {item.finalScore >= item.requiredScore ? 'ELIGIBLE' : 'NOT ELIGIBLE'}
                              </Tag>
                            </div>
                          </div>
                        }
                      />
                      <div>
                        <Tag color={item.isAssistant ? 'purple' : 'green'}>{item.isAssistant ? 'Assistant' : 'Regular'}</Tag>
                      </div>
                    </List.Item>
                  )}
                />
              )}
            </div>
          </Card>
        </Col>
      </Row>
    </>
  );

  const renderEmployeeDashboard = () => (
    <>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card className="welcome-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <Avatar size={64} icon={<UserOutlined />} />
              <div>
                <Title level={3} style={{ margin: 0 }}>
                  Welcome, {employeeStats.employeeName}!
                </Title>
                <Text type="secondary">
                  {employeeStats.position} • {employeeStats.department} • {employeeStats.role}
                </Text>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card className="dashboard-stat-card">
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#8c8c8c', fontSize: '14px', marginBottom: '16px' }}>
                Contract Type
              </div>
              <Tag 
                color={employeeStats.contractType === 'Permanent' ? 'green' : 
                       employeeStats.contractType === 'Regular' ? 'blue' :
                       employeeStats.contractType === 'Contractual' ? 'orange' :
                       employeeStats.contractType === 'Probationary' ? 'yellow' :
                       employeeStats.contractType === 'Temporary' ? 'red' :
                       employeeStats.contractType === 'Part-Time' ? 'purple' : 'default'}
                style={{ fontSize: '14px', padding: '4px 8px' }}
              >
                {employeeStats.contractType}
              </Tag>
            </div>
          </Card>
        </Col>
        
        {employeeStats.contractType !== 'Regular' && (
          <Col xs={24} sm={12} md={6}>
            <Card className="dashboard-stat-card">
              <Statistic
                title="Days Until Contract End"
                value={employeeStats.daysUntilContractEnd}
                prefix={<CalendarOutlined />}
                valueStyle={{ 
                  color: employeeStats.daysUntilContractEnd <= 30 ? '#ff4d4f' : '#3f8600'
                }}
              />
            </Card>
          </Col>
        )}
        
        <Col xs={24} sm={12} md={6}>
          <Card className="dashboard-stat-card">
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#8c8c8c', fontSize: '14px', marginBottom: '8px' }}>
                Hire Date
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <CalendarOutlined />
                <span style={{ fontSize: '16px', fontWeight: 500 }}>
                  {employeeStats.hireDate}
                </span>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="dashboard-stat-card">
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#8c8c8c', fontSize: '14px', marginBottom: '16px' }}>
                Evaluation Status
              </div>
              <Tag 
                color={employeeStats.isEvaluated ? 'green' : 'blue'}
                style={{ fontSize: '14px', padding: '4px 8px' }}
                icon={employeeStats.isEvaluated ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
              >
                {employeeStats.isEvaluated ? `Score: ${employeeStats.evaluationScore?.toFixed(2)}` : 'Pending'}
              </Tag>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} md={16}>
          <Card 
            title={<span><LineChartOutlined /> My Contract Timeline</span>}
            className="dashboard-calendar-card"
          >
            {currentEmployee && currentEmployee.contracts && currentEmployee.contracts.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart 
                  data={currentEmployee.contracts.map((contract, index) => ({
                    name: `Contract ${index + 1}`,
                    startDate: moment(contract.contractStartDate).format('MMM YYYY'),
                    endDate: moment(contract.contractEndDate).format('MMM YYYY'),
                    duration: moment(contract.contractEndDate).diff(moment(contract.contractStartDate), 'months'),
                    type: contract.contractType,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis label={{ value: 'Duration (months)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip 
                    content={({ active, payload }: any) => {
                      if (active && payload && payload.length) {
                        const contractType = payload[0].payload.type;
                        const isRegularContract = contractType === 'Regular';
                        
                        return (
                          <div style={{ 
                            background: 'white', 
                            padding: '10px', 
                            border: '1px solid #ccc',
                            borderRadius: '4px'
                          }}>
                            <p><strong>{payload[0].payload.name}</strong></p>
                            <p>Type: {contractType}</p>
                            <p>Start: {payload[0].payload.startDate}</p>
                            {!isRegularContract && (
                              <>
                                <p>End: {payload[0].payload.endDate}</p>
                                <p>Duration: {payload[0].value} months</p>
                              </>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                  <Bar dataKey="duration" fill="#1890ff" name="Duration (months)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <Text type="secondary">No contract data available</Text>
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card 
            title={<span><BellOutlined /> Notifications</span>}
            className="dashboard-notifications-card"
          >
            <List
              itemLayout="horizontal"
              dataSource={employeeNotifications}
              renderItem={(item) => (
                <List.Item className="dashboard-notification-item">
                  <List.Item.Meta
                    avatar={
                      <Avatar 
                        icon={item.icon} 
                        style={{ 
                          backgroundColor: 
                            item.type === 'success' ? '#52c41a' :
                            item.type === 'warning' ? '#faad14' :
                            item.type === 'error' ? '#ff4d4f' : '#1890ff'
                        }} 
                      />
                    }
                    title={<div className="dashboard-notification-title">{item.title}</div>}
                    description={
                      <>
                        <div className="dashboard-notification-description">{item.description}</div>
                        {item.date && (
                          <div className="dashboard-notification-date">{item.date}</div>
                        )}
                      </>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </>
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {canViewAdminDashboard ? renderAdminDashboard() : 
       isCoordinator ? renderCoordinatorDashboard() : renderEmployeeDashboard()}
    </div>
  );
};

export default Dashboard;