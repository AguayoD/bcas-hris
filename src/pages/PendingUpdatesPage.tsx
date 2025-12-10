
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
} from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  SyncOutlined,
  CheckOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import { EmployeeService, PendingUpdate } from "../api/EmployeeService";
import { useAuth } from "../types/useAuth";
import { ROLES } from "../types/auth";
import dayjs from "dayjs";
import type { ColumnsType } from "antd/lib/table";

const { Title, Text } = Typography;
const { Option } = Select;

const PendingUpdatesPage: React.FC = () => {
  const [pendingUpdates, setPendingUpdates] = useState<PendingUpdate[]>([]);
  const [allUpdates, setAllUpdates] = useState<PendingUpdate[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUpdate, setSelectedUpdate] = useState<PendingUpdate | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const { user } = useAuth();
  const isAdmin = user?.roleId === ROLES.Admin;
  const isHR = user?.roleId === ROLES.HR;

  useEffect(() => {
    if (isAdmin || isHR) {
      loadData();
    }
    // Clean up old updates periodically
    EmployeeService.clearOldUpdates();
  }, [isAdmin, isHR]);

  const loadData = async () => {
    try {
      setLoading(true);
      // Load employees for display
      const employeesData = await EmployeeService.getAll();
      setEmployees(employeesData);
      
      // Load all updates
      const updates = EmployeeService.getAllUpdates();
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

  const getEmployeeInfo = (employeeID: number) => {
    return employees.find(emp => emp.employeeID === employeeID);
  };

  const handleViewDetails = (update: PendingUpdate) => {
    setSelectedUpdate(update);
    setDetailModalVisible(true);
  };

  const handleApprove = async (pendingUpdateID: string) => {
    try {
      setLoading(true);
      const result = await EmployeeService.approveUpdate(
        pendingUpdateID,
        user?.employeeId || 0,
        `${user?.firstName || ''} ${user?.lastName || ''}`
      );
      
      // Update the actual employee data via API
      const employee = getEmployeeInfo(result.pendingUpdate.employeeID);
      if (employee) {
        try {
          // Apply the approved changes
          await EmployeeService.update(
            result.pendingUpdate.employeeID,
            result.pendingUpdate.updateData
          );
          message.success("Update approved and applied successfully");
        } catch (apiError) {
          console.error("Error applying update:", apiError);
          message.warning("Approved but failed to apply changes to server. Please try updating manually.");
        }
      }
      
      // Refresh data
      loadData();
      
    } catch (error) {
      console.error("Error approving update:", error);
      message.error("Failed to approve update");
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (pendingUpdateID: string) => {
    try {
      setLoading(true);
      await EmployeeService.rejectUpdate(
        pendingUpdateID,
        user?.employeeId || 0,
        `${user?.firstName || ''} ${user?.lastName || ''}`
      );
      
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

  const formatFieldValue = (field: string, value: any) => {
    if (value === null || value === undefined || value === '') return 'N/A';
    
    // Format dates
    if (field.includes('Date') || field.includes('date') || field === 'yearGraduated') {
      try {
        return dayjs(value).format('YYYY-MM-DD');
      } catch (e) {
        return value;
      }
    }
    
    // Format boolean values
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    
    return String(value);
  };

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
          </div>
        );
      },
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
      <Card>
        <Title level={4}>Access Denied</Title>
        <p>You don't have permission to view this page.</p>
      </Card>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>Update Requests</span>
              <Badge
                count={pendingUpdates.length}
                style={{ backgroundColor: '#fa8c16' }}
                showZero
              />
            </div>
            <Space>
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 120 }}
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
              >
                Refresh
              </Button>
            </Space>
          </div>
        }
      >
        {filteredUpdates.length === 0 ? (
          <Empty
            description={
              statusFilter === 'pending' 
                ? "No pending update requests"
                : "No updates found"
            }
          />
        ) : (
          <Table
            columns={columns}
            dataSource={filteredUpdates}
            rowKey="pendingUpdateID"
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        )}
      </Card>

      {/* Update Details Modal */}
      <Modal
        title="Update Request Details"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        width={900}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            Close
          </Button>,
        ]}
      >
        {selectedUpdate && (
          <>
            <Descriptions 
              title="Request Information" 
              bordered 
              column={2}
              size="small"
            >
              <Descriptions.Item label="Request ID">
                <Text code>{selectedUpdate.pendingUpdateID}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Employee ID">
                {selectedUpdate.employeeID}
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
                <Descriptions bordered column={2} size="small">
                  <Descriptions.Item label="Name">
                    {`${employee.firstName} ${employee.lastName}`}
                  </Descriptions.Item>
                  <Descriptions.Item label="Email">
                    {employee.email}
                  </Descriptions.Item>
                  <Descriptions.Item label="Position">
                    {employee.positionID}
                  </Descriptions.Item>
                  <Descriptions.Item label="Department">
                    {employee.departmentID}
                  </Descriptions.Item>
                </Descriptions>
              ) : (
                <Spin size="small" />
              );
            })()}

            <Divider orientation="left">Change Comparison</Divider>
            <Table
              dataSource={Object.keys(selectedUpdate.updateData).map(field => ({
                field,
                currentValue: selectedUpdate.originalData[field as keyof typeof selectedUpdate.originalData],
                newValue: selectedUpdate.updateData[field as keyof typeof selectedUpdate.updateData],
                hasChanged: true
              }))}
              columns={[
                {
                  title: "Field",
                  dataIndex: "field",
                  key: "field",
                  width: 200,
                  render: (field) => getFieldDisplayName(field),
                },
                {
                  title: "Current Value",
                  dataIndex: "currentValue",
                  key: "currentValue",
                  render: (value, record) => (
                    <div style={{ 
                      backgroundColor: '#fff2f0', 
                      padding: 4,
                      borderRadius: 2,
                      textDecoration: selectedUpdate.status === 'approved' ? 'line-through' : 'none'
                    }}>
                      {formatFieldValue(record.field, value)}
                    </div>
                  ),
                },
                {
                  title: "→",
                  key: "arrow",
                  width: 30,
                  render: () => <Text>→</Text>,
                },
                {
                  title: "New Value",
                  dataIndex: "newValue",
                  key: "newValue",
                  render: (value, record) => (
                    <div style={{ 
                      backgroundColor: selectedUpdate.status === 'approved' ? '#f6ffed' : '#f0f5ff',
                      padding: 4,
                      borderRadius: 2,
                      fontWeight: selectedUpdate.status === 'pending' ? 500 : 'normal'
                    }}>
                      {formatFieldValue(record.field, value)}
                    </div>
                  ),
                },
              ]}
              pagination={false}
              size="small"
              rowKey="field"
            />

            {selectedUpdate.status === 'pending' && (
              <>
                <Divider />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <Popconfirm
                    title="Are you sure you want to reject this update?"
                    onConfirm={() => {
                      handleReject(selectedUpdate.pendingUpdateID);
                      setDetailModalVisible(false);
                    }}
                    okText="Yes"
                    cancelText="No"
                  >
                    <Button danger icon={<CloseCircleOutlined />}>
                      Reject
                    </Button>
                  </Popconfirm>
                  <Popconfirm
                    title="Are you sure you want to approve this update?"
                    onConfirm={() => {
                      handleApprove(selectedUpdate.pendingUpdateID);
                      setDetailModalVisible(false);
                    }}
                    okText="Yes"
                    cancelText="No"
                  >
                    <Button type="primary" icon={<CheckCircleOutlined />}>
                      Approve
                    </Button>
                  </Popconfirm>
                </div>
              </>
            )}
          </>
        )}
      </Modal>
    </div>
  );
};

export default PendingUpdatesPage;
