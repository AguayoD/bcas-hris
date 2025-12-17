// [file name]: PendingUpdatesPage.tsx
import React, { useState, useEffect } from "react";
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Descriptions,
  message,
  Spin,
  Divider,
  Popconfirm,
  Typography,
  Badge,
  Empty,
  Select,
  Tooltip,
  Alert,
  Grid,
  Dropdown,
  Menu,
  List,
  Avatar,
} from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  SyncOutlined,
  CheckOutlined,
  CloseOutlined,
  InfoCircleOutlined,
  MoreOutlined,
  DownOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { EmployeeService, PendingUpdate } from "../api/EmployeeService";
import { useAuth } from "../types/useAuth";
import { ROLES } from "../types/auth";
import dayjs from "dayjs";
import type { ColumnsType } from "antd/lib/table";
import DepartmentService from "../api/DepartmentService";
import PositionService from "../api/PositionService";

const { Title, Text } = Typography;
const { Option } = Select;
const { useBreakpoint } = Grid;

const PendingUpdatesPage: React.FC = () => {
  const [pendingUpdates, setPendingUpdates] = useState<PendingUpdate[]>([]);
  const [allUpdates, setAllUpdates] = useState<PendingUpdate[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUpdate, setSelectedUpdate] = useState<PendingUpdate | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const { user } = useAuth();
  const isAdmin = user?.roleId === ROLES.Admin;
  const isHR = user?.roleId === ROLES.HR;
  const screens = useBreakpoint();
  
  // Check if mobile view
  const isMobile = screens.xs;
  const isTablet = screens.sm && !screens.md;
  const isDesktop = screens.md;
  
  // Add this state to track HR's employee ID
  const [currentEmployeeId, setCurrentEmployeeId] = useState<number | null>(null);

  useEffect(() => {
    if (isAdmin || isHR) {
      loadData();
      
      // If HR user, fetch their employee ID
      if (isHR && user?.employeeId) {
        setCurrentEmployeeId(user.employeeId);
      }
    }
    // Clean up old updates periodically
    EmployeeService.cleanupOldUpdates();
  }, [isAdmin, isHR]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load employees for display
      const employeesData = await EmployeeService.getAll();
      setEmployees(employeesData);
      
      // If HR user, find their employee record
      if (isHR && user?.employeeId) {
        const hrEmployee = employeesData.find(emp => emp.employeeID === user.employeeId);
        if (hrEmployee && hrEmployee.employeeID !== undefined) {
          setCurrentEmployeeId(hrEmployee.employeeID);
        }
      }
      
      // Load departments and positions
      const departmentsData = await DepartmentService.getAll();
      const positionsData = await PositionService.getAll();
      setDepartments(departmentsData);
      setPositions(positionsData);
      
      // Load all updates
      const updates = await EmployeeService.getAllUpdates();
      setAllUpdates(updates);
      
      // Filter pending updates
      const pending = updates.filter(update => update.status === 'pending');
      setPendingUpdates(pending);
    } catch (error) {
      console.error("Error loading data:", error);
      message.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  // Check if HR is trying to approve their own request
  const isHROwnUpdate = (update: PendingUpdate): boolean => {
    if (!isHR || !currentEmployeeId) return false;
    return update.employeeID === currentEmployeeId;
  };

  const getEmployeeInfo = (employeeID: number) => {
    return employees.find(emp => emp.employeeID === employeeID);
  };

  const getDepartmentName = (departmentID: number | null) => {
    if (!departmentID) return "N/A";
    const dept = departments.find(d => d.departmentID === departmentID);
    return dept?.departmentName || `ID: ${departmentID}`;
  };

  const getPositionName = (positionID: number | null) => {
    if (!positionID) return "N/A";
    const pos = positions.find(p => p.positionID === positionID);
    return pos?.positionName || `ID: ${positionID}`;
  };

  const handleViewDetails = (update: PendingUpdate) => {
    console.log('=== UPDATE DETAILS DEBUG ===');
    console.log('Full update object:', update);
    console.log('Update Data keys:', Object.keys(update.updateData || {}));
    console.log('Update Data values:', update.updateData);
    console.log('Original Data keys:', Object.keys(update.originalData || {}));
    console.log('Original Data values:', update.originalData);
    console.log('=== END DEBUG ===');
    
    setSelectedUpdate(update);
    setDetailModalVisible(true);
  };

const handleApprove = async (pendingUpdateID: number) => {
  try {
    setLoading(true);
    console.log('=== Approving update ===');
    console.log('PendingUpdateID:', pendingUpdateID);
    
    const result = await EmployeeService.approveUpdate(pendingUpdateID, "Approved by reviewer");
    console.log('Approval result:', result);
    
    message.success("Update approved and applied successfully");
    
    // Reload all data to refresh the employee list
    await loadData();
    
    // If we're viewing details of this employee, refresh that too
    if (selectedUpdate && selectedUpdate.employeeID === result.employeeID) {
      // Close the modal
      setDetailModalVisible(false);
      setSelectedUpdate(null);
    }
    
  } catch (error: any) {
    console.error("Error approving update:", error);
    message.error(error.message || "Failed to approve update");
  } finally {
    setLoading(false);
  }
};

  const handleReject = async (pendingUpdateID: number) => {
    try {
      setLoading(true);
      await EmployeeService.rejectUpdate(pendingUpdateID, "Rejected by reviewer");
      
      message.success("Update rejected successfully");
      loadData();
      
    } catch (error) {
      console.error("Error rejecting update:", error);
      message.error("Failed to reject update");
    } finally {
      setLoading(false);
    }
  };

  const getStatusTag = (status: string) => {
    switch (status) {
      case 'pending':
        return <Tag icon={<SyncOutlined spin />} color="orange">Pending</Tag>;
      case 'approved':
        return <Tag icon={<CheckOutlined />} color="green">Approved</Tag>;
      case 'rejected':
        return <Tag icon={<CloseOutlined />} color="red">Rejected</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  const getFieldDisplayName = (fieldName: string) => {
    const fieldMap: Record<string, string> = {
      'firstName': 'First Name',
      'middleName': 'Middle Name',
      'lastName': 'Last Name',
      'gender': 'Gender',
      'dateOfBirth': 'Date of Birth',
      'email': 'Email',
      'phoneNumber': 'Phone Number',
      'address': 'Address',
      'positionID': 'Position',
      'departmentID': 'Primary Department',
      'departmentID2': 'Secondary Department',
      'departmentID3': 'Tertiary Department',
      'employmentStatus': 'Employment Status',
      'hireDate': 'Hire Date',
      'memberFirstName': 'Family Member First Name',
      'memberLastName': 'Family Member Last Name',
      'memberGender': 'Family Member Gender',
      'memberAddress': 'Family Member Address',
      'memberPhoneNumber': 'Family Member Phone',
      'educationalAttainment': 'Educational Attainment',
      'institutionName': 'Institution Name',
      'yearGraduated': 'Year Graduated',
      'courseName': 'Course Name',
      'previousPosition': 'Previous Position',
      'officeName': 'Office Name',
      'durationStart': 'Duration Start',
      'durationEnd': 'Duration End',
      'agencyName': 'Agency Name',
      'supervisor': 'Supervisor',
      'accomplishment': 'Accomplishment',
      'summary': 'Summary',
    };
    
    return fieldMap[fieldName] || fieldName;
  };

  const formatValueForDisplay = (field: string, value: any): string => {
    if (value === null || value === undefined || value === '') return 'N/A';
    
    // Format dates
    if (field.includes('Date') || field.includes('date') || field === 'yearGraduated' || field === 'hireDate') {
      try {
        return dayjs(value).format('YYYY-MM-DD');
      } catch (e) {
        return String(value);
      }
    }
    
    // Convert positionID to position name
    if (field === 'positionID') {
      return getPositionName(value);
    }
    
    // Convert department IDs to names
    if (field === 'departmentID' || field === 'departmentID2' || field === 'departmentID3') {
      return getDepartmentName(value);
    }
    
    // Convert gender to readable format
    if (field === 'gender' || field === 'memberGender') {
      if (value === 'Male') return 'Male';
      if (value === 'Female') return 'Female';
      if (value === 'Other') return 'Other';
    }
    
    // Handle boolean
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    
    return String(value);
  };

  // Mobile List View Component
  const MobileUpdateItem = ({ update }: { update: PendingUpdate }) => {
    const employee = getEmployeeInfo(update.employeeID);
    const isOwnUpdate = isHROwnUpdate(update);
    
    const menu = (
      <Menu>
        <Menu.Item key="view" onClick={() => handleViewDetails(update)}>
          <EyeOutlined /> Review Details
        </Menu.Item>
        {update.status === 'pending' && !isOwnUpdate && (
          <>
            <Menu.Item 
              key="approve" 
              onClick={() => handleApprove(update.pendingUpdateID)}
              style={{ color: '#52c41a' }}
            >
              <CheckCircleOutlined /> Approve
            </Menu.Item>
            <Menu.Item 
              key="reject" 
              onClick={() => handleReject(update.pendingUpdateID)}
              style={{ color: '#ff4d4f' }}
            >
              <CloseCircleOutlined /> Reject
            </Menu.Item>
          </>
        )}
        {isOwnUpdate && update.status === 'pending' && (
          <Menu.Item key="disabled" disabled>
            <Tooltip title="You cannot approve/reject your own update requests">
              <span>Your own request</span>
            </Tooltip>
          </Menu.Item>
        )}
      </Menu>
    );

    return (
      <List.Item
        key={update.pendingUpdateID}
        actions={[
          <Dropdown overlay={menu} trigger={['click']}>
            <Button size="small" icon={<MoreOutlined />} />
          </Dropdown>
        ]}
      >
        <List.Item.Meta
          avatar={<Avatar icon={<UserOutlined />} />}
          title={
            <div>
              <Text strong>
                {employee ? `${employee.firstName} ${employee.lastName}` : `Employee ${update.employeeID}`}
              </Text>
              {isOwnUpdate && (
                <Tag color="gold" style={{ marginLeft: 8 }}>Your Request</Tag>
              )}
            </div>
          }
          description={
            <div style={{ fontSize: '12px' }}>
              <div>ID: {update.employeeID}</div>
              <div>{getStatusTag(update.status)}</div>
              <div style={{ color: '#999' }}>
                {dayjs(update.submittedAt).format("MMM D, YYYY HH:mm")}
              </div>
            </div>
          }
        />
      </List.Item>
    );
  };

  // Desktop Table Columns
  const columns: ColumnsType<PendingUpdate> = [
    {
      title: "Employee",
      key: "employee",
      render: (_, record) => {
        const employee = getEmployeeInfo(record.employeeID);
        if (!employee) return <Spin size="small" />;
        
        return (
          <div>
            <div><strong>{employee.firstName} {employee.lastName}</strong></div>
            <Text type="secondary">ID: {employee.employeeID}</Text>
            {isHR && isHROwnUpdate(record) && (
              <Tag color="gold" style={{ marginTop: 4, fontSize: '10px' }}>Your Request</Tag>
            )}
          </div>
        );
      },
      width: 180,
    },
    {
      title: "Submitted",
      dataIndex: "submittedAt",
      key: "submittedAt",
      render: (date) => (
        <div>
          <div>{dayjs(date).format("MMM D, YYYY")}</div>
          <Text type="secondary">{dayjs(date).format("HH:mm")}</Text>
        </div>
      ),
      width: 120,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status) => getStatusTag(status),
      width: 100,
    },
    {
      title: "Actions",
      key: "actions",
      width: 200,
      render: (_, record) => {
        if (record.status !== 'pending') {
          return (
            <Button
              type="link"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetails(record)}
              size="small"
            >
              View Details
            </Button>
          );
        }
        
        // Check if HR is trying to approve their own request
        const isOwnUpdate = isHROwnUpdate(record);
        
        // If HR is trying to approve their own update, disable actions
        if (isHR && isOwnUpdate) {
          return (
            <Space size="small">
              <Button
                type="link"
                icon={<EyeOutlined />}
                onClick={() => handleViewDetails(record)}
                size="small"
              >
                Review
              </Button>
              <Tooltip title="You cannot approve/reject your own update requests">
                <Button
                  type="link"
                  icon={<CheckCircleOutlined />}
                  style={{ color: '#d9d9d9' }}
                  size="small"
                  disabled
                >
                  Approve
                </Button>
              </Tooltip>
              <Tooltip title="You cannot approve/reject your own update requests">
                <Button
                  type="link"
                  icon={<CloseCircleOutlined />}
                  style={{ color: '#d9d9d9' }}
                  size="small"
                  disabled
                >
                  Reject
                </Button>
              </Tooltip>
            </Space>
          );
        }
        
        return (
          <Space size="small">
            <Button
              type="link"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetails(record)}
              size="small"
            >
              Review
            </Button>
            <Popconfirm
              title="Are you sure you want to approve this update?"
              onConfirm={() => handleApprove(record.pendingUpdateID)}
              okText="Yes"
              cancelText="No"
            >
              <Button
                type="link"
                icon={<CheckCircleOutlined />}
                style={{ color: '#52c41a' }}
                size="small"
              >
                Approve
              </Button>
            </Popconfirm>
            <Popconfirm
              title="Are you sure you want to reject this update?"
              onConfirm={() => handleReject(record.pendingUpdateID)}
              okText="Yes"
              cancelText="No"
            >
              <Button
                type="link"
                icon={<CloseCircleOutlined />}
                danger
                size="small"
              >
                Reject
              </Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  const filteredUpdates = statusFilter === 'all' 
    ? allUpdates 
    : allUpdates.filter(update => update.status === statusFilter);

  if (!isAdmin && !isHR) {
    return (
      <Card style={{ margin: isMobile ? 12 : 24 }}>
        <Title level={isMobile ? 5 : 4}>Access Denied</Title>
        <p>You don't have permission to view this page.</p>
      </Card>
    );
  }

  return (
    <div style={{ 
      padding: isMobile ? 12 : 24,
      minHeight: '100vh'
    }}>
      <Card
        title={
          <div style={{ 
            display: 'flex', 
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'flex-start' : 'center', 
            justifyContent: 'space-between',
            gap: isMobile ? 12 : 8,
            width: '100%'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 8,
              flexWrap: 'wrap'
            }}>
              <Title level={isMobile ? 5 : 4} style={{ margin: 0 }}>
                Update Requests
              </Title>
              {isHR && (
                <Tooltip title="You cannot approve/reject your own update requests">
                  <InfoCircleOutlined style={{ color: '#faad14' }} />
                </Tooltip>
              )}
              <Badge
                count={pendingUpdates.length}
                style={{ backgroundColor: '#fa8c16' }}
                showZero
              />
            </div>
            <Space 
              style={{ 
                width: isMobile ? '100%' : 'auto',
                justifyContent: isMobile ? 'space-between' : 'flex-end'
              }}
            >
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: isMobile ? 120 : 140 }}
                size={isMobile ? "small" : "middle"}
                suffixIcon={isMobile ? <DownOutlined /> : undefined}
              >
                <Option value="pending">Pending</Option>
                <Option value="approved">Approved</Option>
                <Option value="rejected">Rejected</Option>
                <Option value="all">All</Option>
              </Select>
              <Button
                icon={<SyncOutlined />}
                onClick={loadData}
                loading={loading}
                size={isMobile ? "small" : "middle"}
              >
                {isMobile ? "" : "Refresh"}
              </Button>
            </Space>
          </div>
        }
        bordered={!isMobile}
        bodyStyle={{ padding: isMobile ? 8 : 16 }}
      >
        {filteredUpdates.length === 0 ? (
          <Empty
            description={
              statusFilter === 'pending' 
                ? "No pending update requests"
                : "No updates found"
            }
          />
        ) : isMobile ? (
          // Mobile List View
          <List
            dataSource={filteredUpdates}
            loading={loading}
            renderItem={item => <MobileUpdateItem update={item} />}
            pagination={{
              pageSize: 10,
              size: "small",
              simple: true,
            }}
          />
        ) : (
          // Desktop Table View
          <Table
            columns={columns}
            dataSource={filteredUpdates}
            rowKey="pendingUpdateID"
            loading={loading}
            pagination={{
              pageSize: 10,
              size: isTablet ? "small" : "default",
              showSizeChanger: !isMobile,
              showTotal: !isMobile ? (total, range) => `${range[0]}-${range[1]} of ${total}` : undefined
            }}
            rowClassName={(record) => isHROwnUpdate(record) ? 'hr-own-request-row' : ''}
            scroll={isTablet ? { x: true } : undefined}
            size={isTablet ? "small" : "middle"}
          />
        )}
      </Card>

      {/* Update Details Modal */}
      <Modal
        title="Update Request Details"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        width={isMobile ? "95vw" : isDesktop ? 900 : 700}
        footer={selectedUpdate?.status === 'pending' && !(isHR && selectedUpdate && isHROwnUpdate(selectedUpdate)) ? [
          <Button 
            key="close" 
            onClick={() => setDetailModalVisible(false)}
            size={isMobile ? "small" : "middle"}
          >
            Close
          </Button>,
          <Popconfirm
            key="reject"
            title="Are you sure you want to reject this update?"
            onConfirm={() => {
              handleReject(selectedUpdate.pendingUpdateID);
              setDetailModalVisible(false);
            }}
            okText="Yes"
            cancelText="No"
          >
            <Button 
              danger 
              icon={<CloseCircleOutlined />}
              size={isMobile ? "small" : "middle"}
            >
              {isMobile ? "Reject" : "Reject Update"}
            </Button>
          </Popconfirm>,
          <Popconfirm
            key="approve"
            title="Are you sure you want to approve this update?"
            onConfirm={() => {
              handleApprove(selectedUpdate.pendingUpdateID);
              setDetailModalVisible(false);
            }}
            okText="Yes"
            cancelText="No"
          >
            <Button 
              type="primary" 
              icon={<CheckCircleOutlined />}
              size={isMobile ? "small" : "middle"}
            >
              {isMobile ? "Approve" : "Approve Update"}
            </Button>
          </Popconfirm>
        ] : [
          <Button 
            key="close" 
            onClick={() => setDetailModalVisible(false)}
            size={isMobile ? "small" : "middle"}
          >
            Close
          </Button>
        ]}
        centered
      >
        {selectedUpdate && (
          <>
            {/* Add warning for HR's own request */}
            {isHR && isHROwnUpdate(selectedUpdate) && selectedUpdate.status === 'pending' && (
              <Alert
                message="Important Notice"
                description="This is your own update request. You cannot approve or reject it. Please contact an administrator for assistance."
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}

            <Descriptions 
              title="Request Information" 
              bordered 
              column={isMobile ? 1 : 2}
              size="small"
            >
              <Descriptions.Item label="Request ID">
                <Text code>{selectedUpdate.pendingUpdateID}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Employee ID">
                {selectedUpdate.employeeID}
                {isHR && isHROwnUpdate(selectedUpdate) && (
                  <Tag color="gold" style={{ marginLeft: 8 }}>Your Request</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Submitted">
                {dayjs(selectedUpdate.submittedAt).format("MMMM D, YYYY HH:mm:ss")}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                {getStatusTag(selectedUpdate.status)}
              </Descriptions.Item>
              {selectedUpdate.reviewedAt && (
                <>
                  <Descriptions.Item label="Reviewed">
                    {dayjs(selectedUpdate.reviewedAt).format("MMMM D, YYYY HH:mm:ss")}
                  </Descriptions.Item>
                  <Descriptions.Item label="Reviewed By">
                    {selectedUpdate.reviewerName || selectedUpdate.reviewedBy}
                  </Descriptions.Item>
                </>
              )}
            </Descriptions>

            <Divider orientation="left">Employee Information</Divider>
            {(() => {
              const employee = getEmployeeInfo(selectedUpdate.employeeID);
              return employee ? (
                <Descriptions bordered column={isMobile ? 1 : 2} size="small">
                  <Descriptions.Item label="Name">
                    {`${employee.firstName} ${employee.lastName}`}
                </Descriptions.Item>
                  <Descriptions.Item label="Email">
                    {employee.email}
                  </Descriptions.Item>
                  <Descriptions.Item label="Position">
                    {getPositionName(employee.positionID)}
                  </Descriptions.Item>
                  <Descriptions.Item label="Department">
                    {getDepartmentName(employee.departmentID)}
                  </Descriptions.Item>
                </Descriptions>
              ) : (
                <Spin size="small" />
              );
            })()}

            <Divider orientation="left">Change Comparison</Divider>
            {(() => {
              const updateData = selectedUpdate.updateData || {};
              const originalData = selectedUpdate.originalData || {};
              
              // Find all fields that have changed
              const changedFields = Object.keys(updateData).filter(field => {
                const newVal = updateData[field];
                const oldVal = originalData[field];
                
                // Compare values (handle null/undefined)
                return JSON.stringify(newVal) !== JSON.stringify(oldVal);
              });

              if (changedFields.length === 0) {
                return <Empty description="No changes detected" />;
              }

              return (
                <div style={{ 
                  padding: isMobile ? '8px' : '16px', 
                  backgroundColor: '#fafafa', 
                  borderRadius: '6px',
                  maxHeight: isMobile ? '300px' : 'none',
                  overflowY: isMobile ? 'auto' : 'visible'
                }}>
                  <div style={{ 
                    marginBottom: isMobile ? '8px' : '12px', 
                    fontWeight: 500, 
                    color: '#1890ff', 
                    fontSize: isMobile ? '12px' : '14px' 
                  }}>
                    {changedFields.length} field(s) changed:
                  </div>
                  {changedFields.map((field, index) => {
                    const oldVal = originalData[field];
                    const newVal = updateData[field];
                    
                    // Format values for display
                    const displayOld = formatValueForDisplay(field, oldVal);
                    const displayNew = formatValueForDisplay(field, newVal);
                    const fieldName = getFieldDisplayName(field);

                    return (
                      <div 
                        key={field} 
                        style={{ 
                          display: 'flex', 
                          flexDirection: isMobile ? 'column' : 'row',
                          alignItems: isMobile ? 'flex-start' : 'center', 
                          padding: isMobile ? '6px 0' : '10px 0',
                          borderBottom: index < changedFields.length - 1 ? '1px dashed #d9d9d9' : 'none'
                        }}
                      >
                        <div style={{ 
                          width: isMobile ? '100%' : '180px', 
                          fontWeight: 500, 
                          fontSize: isMobile ? '12px' : '13px',
                          marginBottom: isMobile ? '4px' : 0
                        }}>{fieldName}:</div>
                        
                        {!isMobile ? (
                          <>
                            <div style={{ 
                              flex: 1, 
                              textAlign: 'center',
                              backgroundColor: '#fff2f0', 
                              padding: '6px 10px',
                              margin: '0 8px',
                              borderRadius: '4px',
                              fontSize: '13px',
                              textDecoration: selectedUpdate.status === 'approved' ? 'line-through' : 'none',
                              minHeight: '32px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}>
                              {displayOld}
                            </div>
                            <div style={{ 
                              color: '#1890ff', 
                              fontWeight: 'bold', 
                              fontSize: '16px',
                              padding: '0 8px'
                            }}>
                              →
                            </div>
                            <div style={{ 
                              flex: 1, 
                              textAlign: 'center',
                              backgroundColor: selectedUpdate.status === 'approved' ? '#f6ffed' : '#e6f7ff',
                              padding: '6px 10px',
                              margin: '0 8px',
                              borderRadius: '4px',
                              fontSize: '13px',
                              fontWeight: selectedUpdate.status === 'pending' ? 500 : 'normal',
                              minHeight: '32px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}>
                              {displayNew}
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={{ 
                              width: '100%',
                              marginBottom: '6px'
                            }}>
                              <Text type="secondary" style={{ fontSize: '11px' }}>Old Value:</Text>
                              <div style={{ 
                                backgroundColor: '#fff2f0', 
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '12px',
                                textDecoration: selectedUpdate.status === 'approved' ? 'line-through' : 'none',
                                marginTop: '2px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}>
                                {displayOld}
                              </div>
                            </div>
                            <div style={{ 
                              width: '100%'
                            }}>
                              <Text type="secondary" style={{ fontSize: '11px' }}>New Value:</Text>
                              <div style={{ 
                                backgroundColor: selectedUpdate.status === 'approved' ? '#f6ffed' : '#e6f7ff',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: selectedUpdate.status === 'pending' ? 500 : 'normal',
                                marginTop: '2px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}>
                                {displayNew}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {selectedUpdate.comments && (
              <>
                <Divider orientation="left">Reviewer Comments</Divider>
                <Card size="small" style={{ backgroundColor: '#fafafa' }}>
                  <Text style={{ fontSize: isMobile ? '12px' : '14px' }}>
                    {selectedUpdate.comments}
                  </Text>
                </Card>
              </>
            )}
          </>
        )}
      </Modal>
    </div>
  );
};

export default PendingUpdatesPage;