import React, { useEffect, useState } from "react";
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
  PieChart,
  Pie,
  Cell,
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

const COLORS = ['#0088FE', '#00C49F'];

dayjs.extend(isBetween);

const Dashboard: React.FC = () => {
  const [employeeData, setEmployeeData] = useState<EmployeeWithContracts[]>([]);
  const [positions, setPositions] = useState<PositionTypes[]>([]);
  const [departments, setDepartments] = useState<DepartmentTypes[]>([]);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [currentEmployee, setCurrentEmployee] = useState<EmployeeWithContracts | null>(null);
  const [chartView, setChartView] = useState<'hire' | 'contract' | 'evaluation'>('hire');
  const [hiringView, setHiringView] = useState<'monthly' | 'yearly'>('monthly');
  const [employeeEvaluation, setEmployeeEvaluation] = useState<any>(null);
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);
  
  const { user } = useAuth();
  const isAdmin = user?.roleId === ROLES.Admin;
  const isHR = user?.roleId === ROLES.HR;
  const isCoordinator = user?.roleId === ROLES.Coordinator;

  // Admin and HR see the same admin dashboard
  const canViewAdminDashboard = isAdmin || isHR;

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
      const [employees, positionsData, departmentsData, evaluationsData] = await Promise.all([
        EmployeeService.getAll(),
        PositionService.getAll(),
        DepartmentService.getAll(),
        axios.get("/Evaluations")
      ]);
      
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
              contractStatus: ""
            };
            
            return employeeWithContracts;
          } catch (error) {
            console.error(`Failed to fetch contracts for employee ${emp.employeeID}:`, error);
            return {
              ...emp,
              contracts: [],
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

  const getPositionName = (positionId?: number | null) => {
    if (positionId == null) return "Unknown";
    return positions.find(p => p.positionID === positionId)?.positionName || "Unknown";
  };

  const getDepartmentName = (departmentId?: number | null) => {
    if (departmentId == null) return "Unknown";
    return departments.find(d => d.departmentID === departmentId)?.departmentName || "Unknown";
  };

  const teachingPositions = ["Teacher", "Faculty","Coordinator"];
  
  const totalTeachers = employeeData.filter(e => {
    const positionName = getPositionName(e.positionID);
    return teachingPositions.some(tp => 
      positionName.toLowerCase().includes(tp.toLowerCase())
    );
  }).length;
  
  const totalNonTeaching = employeeData.filter(e => {
    const positionName = getPositionName(e.positionID);
    return !teachingPositions.some(tp => 
      positionName.toLowerCase().includes(tp.toLowerCase())
    );
  }).length;
  
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
        description: `Position: ${getPositionName(employee.positionID)}`,
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
    };
  };

  const employeeStats = getEmployeeStats();

  const getHiringTrendData = () => {
    const filteredEmployees = employeeData.filter((employee) => {
      if (!dateRange[0] || !dateRange[1] || !employee.hireDate) return true;
      const hireDate = dayjs(employee.hireDate);
      return hireDate.isBetween(dateRange[0], dateRange[1], 'day', '[]');
    });

    if (hiringView === 'monthly') {
      // Group by exact date and show in monthly view
      const dailyData: { [key: string]: { count: number; employees: string[] } } = {};
      
      filteredEmployees.forEach((employee) => {
        if (employee.hireDate) {
          const date = moment(employee.hireDate).format('MMM DD, YYYY');
          const employeeName = `${employee.firstName} ${employee.lastName}`;
          
          if (!dailyData[date]) {
            dailyData[date] = { count: 0, employees: [] };
          }
          dailyData[date].count += 1;
          dailyData[date].employees.push(employeeName);
        }
      });

      return Object.entries(dailyData)
        .map(([date, data]) => ({
          month: date,
          employees: data.count,
          employeeNames: data.employees,
          date: moment(date, 'MMM DD, YYYY').toDate(),
        }))
        .sort((a, b) => a.date.getTime() - b.date.getTime());
    } else {
      const yearlyData: { [key: string]: number } = {};
      
      filteredEmployees.forEach((employee) => {
        if (employee.hireDate) {
          const year = moment(employee.hireDate).format('YYYY');
          yearlyData[year] = (yearlyData[year] || 0) + 1;
        }
      });

      return Object.entries(yearlyData)
        .map(([year, count]) => ({
          month: year,
          employees: count,
          date: moment(year, 'YYYY').toDate(),
        }))
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .map(({ month, employees }) => ({ month, employees }));
    }
  };

  const getContractEndData = () => {
    const monthlyData: { [key: string]: { count: number; employees: string[] } } = {};
    
    employeeData.forEach((employee) => {
      if (employee.contracts && employee.contracts.length > 0) {
        const latestContract = employee.contracts[employee.contracts.length - 1];
        if (latestContract.contractEndDate) {
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
      .slice(-12);
  };

  const getEvaluationData = () => {
    const evaluated: string[] = [];
    const pending: string[] = [];
    
    const evaluatedEmployeeIds = new Set(
      evaluations.map(evaluation => evaluation.employeeID)
    );
    
    employeeData.forEach((employee) => {
      const employeeName = `${employee.firstName} ${employee.lastName}`;
      
      if (evaluatedEmployeeIds.has(employee.employeeID)) {
        evaluated.push(employeeName);
      } else {
        pending.push(employeeName);
      }
    });

    return [
      { name: 'Evaluated', value: evaluated.length, employees: evaluated },
      { name: 'Pending', value: pending.length, employees: pending },
    ];
  };

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

  const renderAdminDashboard = () => (
    <>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card className="dashboard-stat-card">
            <Statistic
              title="Total Teachers"
              value={totalTeachers}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="dashboard-stat-card">
            <Statistic
              title="Non-Teaching Staff"
              value={totalNonTeaching}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="dashboard-stat-card">
            <Statistic
              title="Total Employees"
              value={employeeData.length}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="dashboard-stat-card">
            <Statistic 
              title="Regular" 
              value={contractTypeCounts['Regular']} 
              prefix={<FileProtectOutlined />} 
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
                      <DatePicker 
                        value={dateRange[0]}
                        onChange={(date) => setDateRange([date, dateRange[1]])}
                        format="MMM DD, YYYY"
                        placeholder="Start Date"
                        style={{ 
                          width: '140px',
                          borderRadius: '6px',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                        }}
                        allowClear
                        suffixIcon={<CalendarOutlined style={{ color: '#1890ff' }} />}
                      />
                      <DatePicker 
                        value={dateRange[1]}
                        onChange={(date) => setDateRange([dateRange[0], date])}
                        format="MMM DD, YYYY"
                        placeholder="End Date"
                        style={{ 
                          width: '140px',
                          borderRadius: '6px',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                        }}
                        allowClear
                        suffixIcon={<CalendarOutlined style={{ color: '#1890ff' }} />}
                        disabledDate={(current) => {
                          if (!dateRange[0]) return false;
                          return current && current < dateRange[0];
                        }}
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
                    <Option value="evaluation">Evaluation Status</Option>
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
                            {hiringView === 'monthly' && data.employeeNames && (
                              <div style={{ borderTop: '1px solid #eee', paddingTop: '8px', marginTop: '8px' }}>
                                <p style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '12px' }}>Employees:</p>
                                {data.employeeNames.map((name: string, idx: number) => (
                                  <p key={idx} style={{ margin: '2px 0', fontSize: '12px' }}>
                                    • {name}
                                  </p>
                                ))}
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
                              {data.employees.map((emp: string, idx: number) => (
                                <p key={idx} style={{ margin: '2px 0', fontSize: '12px' }}>
                                  • {emp}
                                </p>
                              ))}
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
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={getEvaluationData()}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      label={(props: any) => {
                        const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
                        const RADIAN = Math.PI / 180;
                        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                        const x = cx + radius * Math.cos(-midAngle * RADIAN);
                        const y = cy + radius * Math.sin(-midAngle * RADIAN);
                        return (
                          <text
                            x={x}
                            y={y}
                            fill="white"
                            textAnchor={x > cx ? 'start' : 'end'}
                            dominantBaseline="central"
                          >
                            {`${(percent * 100).toFixed(0)}%`}
                          </text>
                        );
                      }}
                    >
                      {getEvaluationData().map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
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
                              maxWidth: '300px',
                              maxHeight: '400px',
                              overflowY: 'auto'
                            }}>
                              <p style={{ fontWeight: 'bold', marginBottom: '8px', color: data.fill }}>
                                {data.name}
                              </p>
                              <p style={{ marginBottom: '8px' }}>
                                Total: {data.value} employees
                              </p>
                              <div style={{ borderTop: '1px solid #eee', paddingTop: '8px' }}>
                                <p style={{ fontWeight: 'bold', marginBottom: '4px' }}>Employees:</p>
                                {data.employees.map((emp: string, idx: number) => (
                                  <p key={idx} style={{ margin: '2px 0', fontSize: '12px' }}>
                                    • {emp}
                                  </p>
                                ))}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
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
                  {employeeStats.position} • {employeeStats.department}
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
              <div style={{ textAlign: 'center', padding: '50px', color: '#8c8c8c' }}>
                No contract data available
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
                    avatar={React.cloneElement(item.icon, { 
                      style: { 
                        color: item.type === 'warning' ? '#faad14' : 
                               item.type === 'error' ? '#ff4d4f' : 
                               item.type === 'success' ? '#52c41a' : '#1890ff',
                        fontSize: '16px'
                      }
                    })}
                    title={<div className="dashboard-notification-title">{item.title}</div>}
                    description={
                      <div>
                        <div className="dashboard-notification-description">{item.description}</div>
                        {item.date && (
                          <div className="dashboard-notification-date">Date: {item.date}</div>
                        )}
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col span={24}>
          <Card 
            title={<span><LineChartOutlined /> Evaluation Status Overview</span>}
            className="dashboard-calendar-card"
          >
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={getEvaluationData()}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={(props: any) => {
                      const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
                      const RADIAN = Math.PI / 180;
                      const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                      const x = cx + radius * Math.cos(-midAngle * RADIAN);
                      const y = cy + radius * Math.sin(-midAngle * RADIAN);
                      return (
                        <text
                          x={x}
                          y={y}
                          fill="white"
                          textAnchor={x > cx ? 'start' : 'end'}
                          dominantBaseline="central"
                        >
                          {`${(percent * 100).toFixed(0)}%`}
                        </text>
                      );
                    }}
                  >
                    {getEvaluationData().map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
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
                            maxWidth: '300px',
                            maxHeight: '400px',
                            overflowY: 'auto'
                          }}>
                            <p style={{ fontWeight: 'bold', marginBottom: '8px', color: data.fill }}>
                              {data.name}
                            </p>
                            <p style={{ marginBottom: '8px' }}>
                              Total: {data.value} employees
                            </p>
                            <div style={{ borderTop: '1px solid #eee', paddingTop: '8px' }}>
                              <p style={{ fontWeight: 'bold', marginBottom: '4px' }}>Employees:</p>
                              {data.employees.map((emp: string, idx: number) => (
                                <p key={idx} style={{ margin: '2px 0', fontSize: '12px' }}>
                                  • {emp}
                                </p>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
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
                  {employeeStats.position} • {employeeStats.department}
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
              <div style={{ textAlign: 'center', padding: '50px', color: '#8c8c8c' }}>
                No contract data available
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
                    avatar={React.cloneElement(item.icon, { 
                      style: { 
                        color: item.type === 'warning' ? '#faad14' : 
                               item.type === 'error' ? '#ff4d4f' : 
                               item.type === 'success' ? '#52c41a' : '#1890ff',
                        fontSize: '16px'
                      }
                    })}
                    title={<div className="dashboard-notification-title">{item.title}</div>}
                    description={
                      <div>
                        <div className="dashboard-notification-description">{item.description}</div>
                        {item.date && (
                          <div className="dashboard-notification-date">Date: {item.date}</div>
                        )}
                      </div>
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

  return (
    <div className="dashboard-container">
      <Spin spinning={loading}>
        {canViewAdminDashboard ? renderAdminDashboard() : 
         isCoordinator ? renderCoordinatorDashboard() : 
         renderEmployeeDashboard()}
      </Spin>
    </div>
  );
};

export default Dashboard;