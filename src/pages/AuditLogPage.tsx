// src/pages/AuditLogPage.tsx
import React, { useState, useEffect } from 'react';
import { Table, Card, DatePicker, Select, Button, Space, Tag, Modal, Typography, Row, Col, message } from 'antd';
import { SearchOutlined, EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import axios from '../api/_axiosInstance';
import { Employee } from '../types/tblEmployees';
import { UserListItem } from '../types/tblUsers';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Title } = Typography;

interface AuditLog {
    auditLogID: number;
    tableName: string;
    action: string;
    recordID: string;
    oldValues: string;
    newValues: string;
    userID: number;
    userName: string;
    timestamp: string;
    ipAddress: string;
    userAgent: string;
}

interface AuditSummary {
    tableName: string;
    action: string;
    count: number;
}

const AuditLogPage: React.FC = () => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [, setSummary] = useState<AuditSummary[]>([]);
    const [loading, setLoading] = useState(false);
    const [, setSummaryLoading] = useState(false);
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const [filters, setFilters] = useState({
        tableName: '',
        action: '',
        dateRange: null as [dayjs.Dayjs, dayjs.Dayjs] | null
    });
    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 50,
        total: 0
    });
    
    const [users, setUsers] = useState<UserListItem[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [positions, setPositions] = useState<any[]>([]);
    const [educationalAttainments, setEducationalAttainments] = useState<any[]>([]);
    const [employmentStatuses, setEmploymentStatuses] = useState<any[]>([]);

    const fetchReferenceData = async () => {
        try {
            const [usersResponse, employeesResponse, departmentsResponse, positionsResponse, attainmentsResponse, statusesResponse] = await Promise.all([
                axios.get('/Users'),
                axios.get('/Employees'),
                axios.get('/Department'),
                axios.get('/Position'),
                axios.get('/EducationalAttainment'),
                axios.get('/EmploymentStatus')
            ]);
            
            setUsers(usersResponse.data.data || usersResponse.data);
            setEmployees(employeesResponse.data.data || employeesResponse.data);
            setDepartments(departmentsResponse.data.data || departmentsResponse.data);
            setPositions(positionsResponse.data.data || positionsResponse.data);
            setEducationalAttainments(attainmentsResponse.data.data || attainmentsResponse.data);
            setEmploymentStatuses(statusesResponse.data.data || statusesResponse.data);
        } catch (error) {
            console.error('Error fetching reference data:', error);
        }
    };

    const getPerformerName = (log: AuditLog): string => {
        // Find the user who performed the action using userID from audit log
        const user = users.find(u => u.userId === log.userID);
        
        if (user) {
            // Find the employee linked to this user
            const employee = employees.find(e => e.employeeID === user.employeeId);
            if (employee && employee.firstName && employee.lastName) {
                return `${employee.firstName} ${employee.lastName}`;
            }
            // If no employee found, use user name
            if (user.firstName && user.lastName) {
                return `${user.firstName} ${user.lastName}`;
            }
            return user.userName || `User ${user.userId}`;
        }
        
        return log.userName || `User ${log.userID}`;
    };

    // Function to get affected record name
    const getAffectedRecord = (log: AuditLog): string => {
        try {
            const recordId = parseInt(log.recordID);
            
            switch (log.tableName) {
                case 'tblEmployees':
                    const employee = employees.find(emp => emp.employeeID === recordId);
                    return employee ? `${employee.firstName} ${employee.lastName}` : `Employee ID: ${recordId}`;
                
                case 'tblUsers':
                    const user = users.find(u => u.userId === recordId);
                    return user ? user.userName || `User ID: ${recordId}` : `User ID: ${recordId}`;
                
                case 'tblDepartment':
                    const department = departments.find(dept => dept.departmentID === recordId);
                    return department ? department.departmentName || `Department ID: ${recordId}` : `Department ID: ${recordId}`;
                
                case 'tblPositions':
                    const position = positions.find(pos => pos.positionID === recordId);
                    return position ? position.positionName || `Position ID: ${recordId}` : `Position ID: ${recordId}`;
                
                case 'tblEducationalAttainment':
                    const attainment = educationalAttainments.find(att => att.educationalAttainmentID === recordId);
                    return attainment ? attainment.attainmentName || `Educational Attainment ID: ${recordId}` : `Educational Attainment ID: ${recordId}`;
                
                case 'tblEmploymentStatus':
                    const status = employmentStatuses.find(stat => stat.employmentStatusID === recordId);
                    return status ? status.statusName || `Employment Status ID: ${recordId}` : `Employment Status ID: ${recordId}`;
                
                case 'Evaluation':
                    return `Evaluation ID: ${recordId}`;
                
                case 'Files':
                    return `File ID: ${recordId}`;
                
                case 'tblRoles':
                    return `Role ID: ${recordId}`;
                
                default:
                    return `Record ID: ${log.recordID}`;
            }
        } catch (error) {
            console.error('Error getting affected record:', error);
            return `Record ID: ${log.recordID}`;
        }
    };

    const fetchAuditLogs = async (page = 1) => {
        setLoading(true);
        try {
            const params: any = {
                pageNumber: page,
                pageSize: pagination.pageSize
            };

            if (filters.tableName) params.tableName = filters.tableName;
            if (filters.action) params.action = filters.action;
            if (filters.dateRange?.[0]) params.fromDate = filters.dateRange[0].format('YYYY-MM-DD');
            if (filters.dateRange?.[1]) params.toDate = filters.dateRange[1].format('YYYY-MM-DD');

            const response = await axios.get(`/AuditLog/paged`, { params });
            setLogs(response.data.data);
            setPagination(prev => ({
                ...prev,
                current: page,
                total: response.data.pagination.totalCount
            }));
        } catch (error) {
            console.error('Error fetching audit logs:', error);
            message.error('Failed to fetch audit logs');
        } finally {
            setLoading(false);
        }
    };

    const fetchAuditSummary = async () => {
        setSummaryLoading(true);
        try {
            const params: any = {};
            if (filters.dateRange?.[0]) params.fromDate = filters.dateRange[0].format('YYYY-MM-DD');
            if (filters.dateRange?.[1]) params.toDate = filters.dateRange[1].format('YYYY-MM-DD');

            const response = await axios.get(`/AuditLog/summary`, { params });
            setSummary(response.data.data);
        } catch (error) {
            console.error('Error fetching audit summary:', error);
        } finally {
            setSummaryLoading(false);
        }
    };

    useEffect(() => {
        fetchAuditLogs(1);
        fetchAuditSummary();
        fetchReferenceData();
    }, []);

    useEffect(() => {
        fetchAuditLogs(1);
        fetchAuditSummary();
    }, [filters.tableName, filters.action, filters.dateRange]);

    const handleTableChange = (newPagination: any) => {
        fetchAuditLogs(newPagination.current);
    };

    const handleFilter = () => {
        fetchAuditLogs(1);
        fetchAuditSummary();
    };

    const handleReset = () => {
        setFilters({
            tableName: '',
            action: '',
            dateRange: null
        });
    };

    const showDetails = (log: AuditLog) => {
        setSelectedLog(log);
        setDetailModalVisible(true);
    };

    const getActionColor = (action: string) => {
        switch (action) {
            case 'INSERT': return 'green';
            case 'UPDATE': return 'blue';
            case 'DELETE': return 'red';
            default: return 'default';
        }
    };

    const getTableNameDisplay = (tableName: string) => {
        const tableMap: { [key: string]: string } = {
            'tblDepartment': 'Departments',
            'tblEmployees': 'Employees',
            'tblUsers': 'Users',
            'Evaluation': 'Evaluations',
            'tblPositions': 'Positions',
            'tblRoles': 'Roles',
            'Files': 'Files',
            'tblEducationalAttainment': 'Educational Attainment',
            'tblEmploymentStatus': 'Employment Status'
        };
        return tableMap[tableName] || tableName;
    };

    const columns = [
        {
            title: 'Timestamp',
            dataIndex: 'timestamp',
            key: 'timestamp',
            width: 180,
            render: (timestamp: string) => dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss'),
            sorter: (a: AuditLog, b: AuditLog) => dayjs(a.timestamp).unix() - dayjs(b.timestamp).unix(),
            defaultSortOrder: 'descend' as const
        },
        {
            title: 'User',
            dataIndex: 'userName',
            key: 'userName',
            width: 120,
            render: (_userName: string, record: AuditLog) => getPerformerName(record),
        },
        {
            title: 'Table',
            dataIndex: 'tableName',
            key: 'tableName',
            width: 120,
            render: (tableName: string) => getTableNameDisplay(tableName),
        },
        {
            title: 'Action',
            dataIndex: 'action',
            key: 'action',
            width: 100,
            render: (action: string) => (
                <Tag color={getActionColor(action)}>
                    {action}
                </Tag>
            )
        },
        {
            title: 'Affected',
            key: 'affected',
            width: 200,
            render: (_: any, record: AuditLog) => (
                <div>
                    {getAffectedRecord(record)}
                </div>
            )
        },
        {
            title: 'Actions',
            key: 'actions',
            width: 100,
            fixed: 'right' as const,
            render: (_: any, record: AuditLog) => (
                <Button
                    type="link"
                    icon={<EyeOutlined />}
                    onClick={() => showDetails(record)}
                    size="small"
                >
                    View
                </Button>
            )
        }
    ];

    return (
        <div style={{ padding: 24 }}>
            <Card>
                <Title level={2}>Audit Log</Title>
                
                {/* Filters */}
                <Card size="small" style={{ marginBottom: 16 }}>
                    <Space wrap size="middle">
                        <Select
                            placeholder="Table Name"
                            value={filters.tableName}
                            onChange={(value) => setFilters({ ...filters, tableName: value })}
                            style={{ width: 150 }}
                            allowClear
                        >
                            <Option value="tblDepartment">Departments</Option>
                            <Option value="tblEmployees">Employees</Option>
                            <Option value="tblUsers">Users</Option>
                            <Option value="Evaluation">Evaluations</Option>
                            <Option value="tblPositions">Positions</Option>
                            <Option value="tblRoles">Roles</Option>
                            <Option value="Files">Files</Option>
                            <Option value="tblEducationalAttainment">Educational Attainment</Option>
                            <Option value="tblEmploymentStatus">Employment Status</Option>
                        </Select>

                        <Select
                            placeholder="Action"
                            value={filters.action}
                            onChange={(value) => setFilters({ ...filters, action: value })}
                            style={{ width: 120 }}
                            allowClear
                        >
                            <Option value="INSERT">INSERT</Option>
                            <Option value="UPDATE">UPDATE</Option>
                            <Option value="DELETE">DELETE</Option>
                        </Select>

                        <RangePicker
                            value={filters.dateRange}
                            onChange={(dates) => setFilters({ ...filters, dateRange: dates as [dayjs.Dayjs, dayjs.Dayjs] })}
                        />

                        <Button
                            type="primary"
                            icon={<SearchOutlined />}
                            onClick={handleFilter}
                        >
                            Filter
                        </Button>

                        <Button 
                            icon={<ReloadOutlined />}
                            onClick={handleReset}
                        >
                            Reset
                        </Button>

                        <Button 
                            icon={<ReloadOutlined />}
                            onClick={() => {
                                fetchAuditLogs(1);
                                fetchAuditSummary();
                                fetchReferenceData();
                            }}
                            loading={loading}
                        >
                            Refresh
                        </Button>
                    </Space>
                </Card>

                {/* Main Log Table */}
                <Table
                    columns={columns}
                    dataSource={logs}
                    rowKey="auditLogID"
                    loading={loading}
                    pagination={pagination}
                    onChange={handleTableChange}
                    scroll={{ x: 1000 }}
                    size="middle"
                    locale={{
                        emptyText: loading ? 'Loading...' : 'No audit logs found'
                    }}
                />
            </Card>

            {/* Detail Modal */}
            <Modal
                title="Audit Log Details"
                open={detailModalVisible}
                onCancel={() => setDetailModalVisible(false)}
                footer={[
                    <Button key="close" onClick={() => setDetailModalVisible(false)}>
                        Close
                    </Button>
                ]}
                width={900}
            >
                {selectedLog && (
                    <div>
                        <Row gutter={16}>
                            <Col span={12}>
                                <p><strong>Timestamp:</strong> {dayjs(selectedLog.timestamp).format('YYYY-MM-DD HH:mm:ss')}</p>
                                <p><strong>User:</strong> {getPerformerName(selectedLog)} (ID: {selectedLog.userID})</p>
                                <p><strong>Table:</strong> {getTableNameDisplay(selectedLog.tableName)}</p>
                                <p><strong>Affected Record:</strong> {getAffectedRecord(selectedLog)}</p>
                            </Col>
                            <Col span={12}>
                                <p><strong>Action:</strong> <Tag color={getActionColor(selectedLog.action)}>{selectedLog.action}</Tag></p>
                                <p><strong>Record ID:</strong> {selectedLog.recordID}</p>
                                <p><strong>IP Address:</strong> {selectedLog.ipAddress}</p>
                            </Col>
                        </Row>
                        
                        {selectedLog.oldValues && (
                            <div style={{ marginTop: 16 }}>
                                <strong>Old Values:</strong>
                                <pre style={{ 
                                    background: '#fff1f0', 
                                    padding: 12, 
                                    borderRadius: 4, 
                                    maxHeight: 200, 
                                    overflow: 'auto',
                                    border: '1px solid #ffccc7',
                                    fontSize: '12px'
                                }}>
                                    {JSON.stringify(JSON.parse(selectedLog.oldValues), null, 2)}
                                </pre>
                            </div>
                        )}
                        
                        {selectedLog.newValues && (
                            <div style={{ marginTop: 16 }}>
                                <strong>New Values:</strong>
                                <pre style={{ 
                                    background: '#f6ffed', 
                                    padding: 12, 
                                    borderRadius: 4, 
                                    maxHeight: 200, 
                                    overflow: 'auto',
                                    border: '1px solid #b7eb8f',
                                    fontSize: '12px'
                                }}>
                                    {JSON.stringify(JSON.parse(selectedLog.newValues), null, 2)}
                                </pre>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default AuditLogPage;