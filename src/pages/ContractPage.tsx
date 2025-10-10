import React, { useState, useEffect } from "react";
import { 
  EyeOutlined, 
  UploadOutlined,
  FileOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  FileExcelOutlined,
  DownloadOutlined,
  EditOutlined,
  SearchOutlined,
  HistoryOutlined
} from "@ant-design/icons";
import { 
  Button, 
  Upload, 
  Modal, 
  message, 
  Table, 
  Space,
  Image,
  Typography,
  DatePicker,
  Form,
  Row,
  Col,
  Select,
  Input,
  Timeline,
  Card,
  Tag,
  Divider
} from "antd";
import type { UploadFile, UploadProps } from "antd";
import dayjs, { Dayjs } from 'dayjs';
import { EmployeeService } from "../api/EmployeeService";
import DepartmentService from "../api/DepartmentService";
import { ContractService } from "../api/ContractService";
import { EmployeeWithContracts } from "../types/tblContracts";
import { Employee } from "../types/tblEmployees";
import { useAuth } from "../types/useAuth";
import { ROLES } from "../types/auth";
import "./ContractPage.css";

const { Text } = Typography;
const { Option } = Select;

interface Department {
  departmentID: number;
  departmentName: string;
}

interface ContractFormData {
  contractStartDate: Dayjs;
  contractEndDate: Dayjs;
  contractType: string;
}

interface ContractUpdateFormData {
  contractStartDate?: Dayjs;
  contractEndDate?: Dayjs;
  contractType?: string;
}

const getFileIcon = (fileType?: string) => {
  if (!fileType) return <FileOutlined />;
  
  if (fileType.includes('pdf')) return <FilePdfOutlined />;
  if (fileType.includes('word') || fileType.includes('document')) return <FileWordOutlined />;
  if (fileType.includes('excel') || fileType.includes('sheet')) return <FileExcelOutlined />;
  if (fileType.includes('image')) return <FileOutlined />;
  
  return <FileOutlined />;
};

const ContractPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.roleId === ROLES.Admin || user?.roleId === ROLES.Coordinator;
  const isTeacher = user?.roleId === ROLES.Teaching;
  const isNonTeacher = user?.roleId === ROLES.NonTeaching;
  
  const hasAccess = isAdmin || isTeacher || isNonTeacher;

  const [employees, setEmployees] = useState<EmployeeWithContracts[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<EmployeeWithContracts[]>([]);
  const [searchText, setSearchText] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<UploadFile | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeWithContracts | null>(null);
  const [updatingContract, setUpdatingContract] = useState<any>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [updateFileList, setUpdateFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [viewingContractHistory, setViewingContractHistory] = useState<EmployeeWithContracts | null>(null);
  const [selectedContractType, setSelectedContractType] = useState<string>('Regular');
  const [selectedUpdateContractType, setSelectedUpdateContractType] = useState<string>('');
  const [form] = Form.useForm<ContractFormData>();
  const [updateForm] = Form.useForm<ContractUpdateFormData>();

  useEffect(() => {
    if (!hasAccess) {
      message.error("You don't have permission to access this page");
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        
        const [allEmployees, departmentData] = await Promise.all([
          EmployeeService.getAll(),
          DepartmentService.getAll()
        ]);
        
        let employeeData: Employee[];
        
        if (isAdmin) {
          employeeData = allEmployees;
        } else if (isTeacher || isNonTeacher) {
          employeeData = allEmployees.filter(emp => emp.employeeID === user?.employeeId);
        } else {
          employeeData = [];
        }
        
        const employeesWithContracts = await Promise.all(
          employeeData.map(async (emp) => {
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
        
        setEmployees(employeesWithContracts);
        setFilteredEmployees(employeesWithContracts);
        setDepartments(
          departmentData
            .filter((d: any) => typeof d.departmentID === 'number')
            .map((d: any) => ({
              departmentID: d.departmentID as number,
              departmentName: d.departmentName
            }))
        );
      } catch (error) {
        message.error("Failed to fetch data");
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [hasAccess, isAdmin, isTeacher, isNonTeacher, user?.employeeId]);

  const handleSearch = (value: string) => {
    setSearchText(value);
    
    if (!value.trim()) {
      setFilteredEmployees(employees);
      return;
    }

    const searchLower = value.toLowerCase();
    const filtered = employees.filter(emp => {
      const latestContract = emp.contracts.length > 0 
        ? emp.contracts[emp.contracts.length - 1] 
        : null;

      // Search by employee name
      const nameMatch = `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(searchLower);

      // Search by department
      const deptName = getDepartmentName(emp.departmentID);
      const deptMatch = typeof deptName === 'string' 
        ? deptName.toLowerCase().includes(searchLower)
        : String(deptName).toLowerCase().includes(searchLower);

      // Search by contract type
      const typeMatch = latestContract?.contractType?.toLowerCase().includes(searchLower);

      // Search by end date (format: MMM DD, YYYY or just year)
      const endDateMatch = latestContract?.contractEndDate 
        ? dayjs(latestContract.contractEndDate).format('MMM DD, YYYY').toLowerCase().includes(searchLower) ||
          dayjs(latestContract.contractEndDate).format('YYYY').includes(searchLower)
        : false;

      // Search for "expiring soon" or "renewal" keywords
      const renewalKeywords = ['renewal', 'expiring', 'expired', 'ending'];
      const isRenewalSearch = renewalKeywords.some(keyword => searchLower.includes(keyword));
      
      let renewalMatch = false;
      if (isRenewalSearch) {
        // Exclude Regular contracts from renewal/expiring/expired searches
        if (latestContract?.contractType === 'Regular') {
          renewalMatch = false;
        } else {
          const daysLeft = latestContract?.contractEndDate 
            ? dayjs(latestContract.contractEndDate).diff(dayjs(), 'days')
            : null;
          
          if (daysLeft !== null) {
            if (searchLower.includes('expired') && daysLeft <= 0) {
              renewalMatch = true;
            } else if ((searchLower.includes('expiring') || searchLower.includes('ending')) && daysLeft > 0 && daysLeft <= 90) {
              renewalMatch = true;
            } else if (searchLower.includes('renewal') && daysLeft <= 90) {
              renewalMatch = true;
            }
          }
        }
      }

      return nameMatch || deptMatch || typeMatch || endDateMatch || renewalMatch;
    });

    setFilteredEmployees(filtered);
  };

  if (!hasAccess) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        height: '50vh',
        flexDirection: 'column'
      }}>
        <Text type="danger" style={{ fontSize: '18px', marginBottom: '16px' }}>
          Access Denied
        </Text>
        <Text type="secondary">
          You don't have permission to view contract information.
        </Text>
      </div>
    );
  }

  const getBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });

  const handlePreview = async (file: UploadFile) => {
    if (!file.url && !file.preview && file.originFileObj) {
      try {
        file.preview = await getBase64(file.originFileObj);
      } catch (error) {
        console.error("Error generating preview:", error);
        message.error("Failed to generate preview");
        return;
      }
    }
    setPreviewFile(file);
    setPreviewOpen(true);
  };

  const handleDownload = async (contractId: number, fileName: string) => {
    try {
      const blob = await ContractService.download(contractId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download contract:", error);
      message.error("Failed to download contract");
    }
  };

const handleUpload = async () => {
  try {
    const values = await form.validateFields();
    
    if (editingEmployee && fileList.length > 0) {
      setUploading(true);
      
      const file = fileList[0].originFileObj as File;
      
      // Create the contract data with consistent structure
      const contractData: any = {
        contractType: values.contractType,
        contractStartDate: values.contractStartDate.format('YYYY-MM-DD'),
        lastUpdatedBy: user?.employeeId || 0
      };

      // Always include contractEndDate, but set it appropriately based on contract type
      if (values.contractType === 'Regular') {
        // For Regular contracts, you might need to send null, empty string, or a default value
        contractData.contractEndDate = ''; // or null depending on your API
        // contractData.contractEndDate = '9999-12-31'; // alternative: use a far future date
      } else if (values.contractEndDate) {
        contractData.contractEndDate = values.contractEndDate.format('YYYY-MM-DD');
      } else {
        // For non-Regular contracts without end date, you might need to handle this case
        contractData.contractEndDate = ''; // or throw an error
      }

      try {
        const createdContract = await ContractService.upload(
          editingEmployee.employeeID!,
          file,
          contractData
        );
        
        message.success("Contract uploaded successfully");
        
        const updatedEmployees = employees.map(emp => {
          if (emp.employeeID === editingEmployee.employeeID) {
            const updatedContracts = [...emp.contracts, createdContract];
            return {
              ...emp,
              contracts: updatedContracts
            };
          }
          return emp;
        });
        
        setEmployees(updatedEmployees);
        setFilteredEmployees(updatedEmployees);
        setEditingEmployee(null);
        setFileList([]);
        form.resetFields();
      } catch (error) {
        console.error("Failed to upload contract:", error);
        message.error("Failed to upload contract");
      } finally {
        setUploading(false);
      }
    }
  } catch (error) {
    console.error("Validation failed:", error);
    message.error("Please fill in all required fields");
  }
};

  const handleUpdate = async () => {
    try {
      const values = await updateForm.validateFields();
      
      if (updatingContract) {
        setUpdating(true);
        
        const updateData: any = {
          lastUpdatedBy: user?.employeeId || 0
        };

        if (values.contractType) {
          updateData.contractType = values.contractType;
        }
        if (values.contractStartDate) {
          updateData.contractStartDate = values.contractStartDate.format('YYYY-MM-DD');
        }
        // Only add contractEndDate if it's not a Regular contract
        if (values.contractType !== 'Regular' && values.contractEndDate) {
          updateData.contractEndDate = values.contractEndDate.format('YYYY-MM-DD');
        }
        if (updateFileList.length > 0) {
          updateData.file = updateFileList[0].originFileObj as File;
        }

        try {
          const updatedContract = await ContractService.update(
            updatingContract.contractID!,
            updateData
          );
          
          message.success("Contract updated successfully");
          
          const updatedEmployees = employees.map(emp => {
            const updatedContracts = emp.contracts.map(contract => 
              contract.contractID === updatingContract.contractID 
                ? { ...updatedContract, contractID: updatingContract.contractID }
                : contract
            );
            
            return {
              ...emp,
              contracts: updatedContracts
            };
          });
          
          setEmployees(updatedEmployees);
          setFilteredEmployees(updatedEmployees);
          setUpdatingContract(null);
          setUpdateFileList([]);
          updateForm.resetFields();
        } catch (error) {
          console.error("Failed to update contract:", error);
          message.error("Failed to update contract");
        } finally {
          setUpdating(false);
        }
      }
    } catch (error) {
      console.error("Validation failed:", error);
      message.error("Please fill in all required fields");
    }
  };

  const getDepartmentName = (departmentId: number | undefined) => {
    if (typeof departmentId !== 'number') return 'Unknown';
    const department = departments.find(d => d.departmentID === departmentId);
    return department ? department.departmentName : departmentId;
  };

  const beforeUpload: UploadProps['beforeUpload'] = (file) => {
    const isLt10M = file.size / 1024 / 1024 < 10;
    if (!isLt10M) {
      message.error('File must be smaller than 10MB!');
      return Upload.LIST_IGNORE;
    }
    return false;
  };

  const renderFilePreview = () => {
    if (!previewFile) return null;

    const fileType = previewFile.type || '';
    const fileUrl = previewFile.url || previewFile.preview || '';

    if (fileType.includes('image')) {
      return (
        <Image
          width="100%"
          src={fileUrl}
          alt="Contract preview"
          style={{ maxHeight: '70vh', objectFit: 'contain' }}
        />
      );
    }

    if (fileType.includes('pdf')) {
      return (
        <iframe 
          src={fileUrl} 
          width="100%" 
          height="600px" 
          style={{ border: 'none' }}
          title="PDF Preview"
        />
      );
    }

    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        {getFileIcon(fileType)}
        <p style={{ marginTop: 16 }}>
          {previewFile.name || 'Contract File'}
        </p>
        <Button 
          type="primary" 
          onClick={() => window.open(fileUrl, '_blank')}
          style={{ marginTop: 16 }}
        >
          Download File
        </Button>
      </div>
    );
  };

  const columns = [
    {
      title: 'Employee',
      key: 'name',
      render: (record: Employee) => (
        <Text strong>{record.firstName} {record.lastName}</Text>
      ),
    },
    {
      title: 'Department',
      key: 'department',
      render: (record: Employee) => (
        <Text>{getDepartmentName(record.departmentID)}</Text>
      ),
    },
    {
      title: 'Contract Type',
      key: 'contractType',
      render: (record: EmployeeWithContracts) => {
        const latestContract = record.contracts.length > 0 
          ? record.contracts[record.contracts.length - 1] 
          : null;
        return (
          <Text>{latestContract?.contractType || 'Not specified'}</Text>
        );
      },
    },
    {
      title: 'Contract Start',
      key: 'startDate',
      render: (record: EmployeeWithContracts) => {
        const latestContract = record.contracts.length > 0 
          ? record.contracts[record.contracts.length - 1] 
          : null;
        return (
          <Text>{latestContract?.contractStartDate ? dayjs(latestContract.contractStartDate).format('MMM DD, YYYY') : 'Not set'}</Text>
        );
      },
    },
    {
      title: 'Contract End',
      key: 'endDate',
      render: (record: EmployeeWithContracts) => {
        const latestContract = record.contracts.length > 0 
          ? record.contracts[record.contracts.length - 1] 
          : null;
        
        if (latestContract?.contractType === 'Regular') {
          return <Text type="secondary">N/A (Regular)</Text>;
        }
        
        return (
          <Text>{latestContract?.contractEndDate ? dayjs(latestContract.contractEndDate).format('MMM DD, YYYY') : 'Not set'}</Text>
        );
      },
    },
    {
      title: 'Days Remaining',
      key: 'daysRemaining',
      render: (record: EmployeeWithContracts) => {
        const latestContract = record.contracts.length > 0 
          ? record.contracts[record.contracts.length - 1] 
          : null;
        
        if (!latestContract?.contractEndDate || latestContract?.contractType === 'Regular') {
          return <Text type="secondary">N/A</Text>;
        }
        
        const daysLeft = dayjs(latestContract.contractEndDate).diff(dayjs(), 'days');
        const color = daysLeft < 30 ? 'red' : daysLeft < 90 ? 'orange' : 'green';
        
        return (
          <Text type={color === 'red' ? 'danger' : color === 'orange' ? 'warning' : 'success'}>
            {daysLeft > 0 ? `${daysLeft} days` : 'Expired'}
          </Text>
        );
      },
    },
    {
      title: 'Contract Documents',
      key: 'contractDocuments',
      render: (record: EmployeeWithContracts) => {
        // Only show the most recent contract
        const latestContract = record.contracts.length > 0 
          ? record.contracts[record.contracts.length - 1] 
          : null;

        return (
          <Space direction="vertical" size="small">
            {latestContract ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Button
                  type="link"
                  icon={<EyeOutlined />}
                  onClick={() => handlePreview({
                    uid: latestContract.contractID?.toString() || '',
                    name: latestContract.fileName || 'contract',
                    status: 'done',
                    url: latestContract.filePath,
                  } as UploadFile)}
                  size="small"
                />
                <Button
                  type="link"
                  icon={<DownloadOutlined />}
                  onClick={() => handleDownload(latestContract.contractID!, latestContract.fileName || 'contract')}
                  size="small"
                />
                {isAdmin && (
                  <Button
                    type="link"
                    icon={<EditOutlined />}
                    onClick={() => {
                      setUpdatingContract(latestContract);
                      setSelectedUpdateContractType(latestContract.contractType || '');
                      updateForm.setFieldsValue({
                        contractType: latestContract.contractType ?? undefined,
                        contractStartDate: latestContract.contractStartDate ? dayjs(latestContract.contractStartDate) : undefined,
                        contractEndDate: latestContract.contractEndDate ? dayjs(latestContract.contractEndDate) : undefined,
                      });
                      setUpdateFileList([]);
                    }}
                    size="small"
                  />
                )}
                <Tag color="blue">{record.contracts.length} contract{record.contracts.length !== 1 ? 's' : ''}</Tag>
              </div>
            ) : (
              <Text type="secondary">No contract documents</Text>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record: EmployeeWithContracts) => (
        <Space size="middle" className="contract-actions">
          {record.contracts.length > 0 && (
            <Button
              type="default"
              icon={<HistoryOutlined />}
              onClick={() => setViewingContractHistory(record)}
              size="small"
            >
              <span className="action-text">View Records</span>
            </Button>
          )}
          {isAdmin && (
            <Button
              type="primary"
              icon={<UploadOutlined />}
              onClick={() => {
                setEditingEmployee(record);
                setSelectedContractType('Regular');
                form.resetFields();
              }}
              size="small"
            >
              <span className="action-text">
                {record.contracts.length === 0 ? 'Upload Contract' : 'Add Contract'}
              </span>
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="contract-page">
      <div style={{ marginBottom: '16px' }}>
        <h2>
          {isAdmin ? 'Employee Contracts' : 'My Contracts'}
        </h2>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <Input
          placeholder="Search by name, department, contract type, end date, or 'expiring soon', 'renewal', 'expired'..."
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => handleSearch(e.target.value)}
          allowClear
          size="large"
          style={{ maxWidth: '600px' }}
        />
      </div>

      <Table
        columns={columns}
        dataSource={filteredEmployees}
        rowKey="employeeID"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        open={!!editingEmployee}
        title={`Upload Contract for ${editingEmployee?.firstName} ${editingEmployee?.lastName}`}
        onCancel={() => {
          setEditingEmployee(null);
          setFileList([]);
          form.resetFields();
        }}
        onOk={handleUpload}
        confirmLoading={uploading}
        width={600}
        okText="Upload"
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            contractType: 'Regular',
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="contractStartDate"
                label="Start Date"
                rules={[{ required: true, message: 'Please select start date' }]}
              >
                <DatePicker 
                  style={{ width: '100%' }} 
                  format="YYYY-MM-DD" 
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="contractEndDate"
                label="End Date"
                rules={[
                  {
                    required: selectedContractType !== 'Regular',
                    message: 'Please select end date'
                  }
                ]}
              >
                <DatePicker 
                  style={{ width: '100%' }} 
                  format="YYYY-MM-DD"
                  placeholder={selectedContractType === 'Regular' ? 'Not applicable for Regular' : 'Select end date'}
                  disabled={selectedContractType === 'Regular'}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="contractType"
            label="Contract Type"
            rules={[{ required: true, message: 'Please select contract type' }]}
          >
            <Select onChange={(value) => {
              setSelectedContractType(value);
              if (value === 'Regular') {
                form.setFieldsValue({ contractEndDate: undefined });
              }
              // Trigger validation to update required state
              form.validateFields(['contractEndDate']);
            }}>
              <Option value="Regular">Regular</Option>
              <Option value="Contractual">Contractual</Option>
              <Option value="Probationary">Probationary</Option>
              <Option value="Temporary">Temporary</Option>
              <Option value="Part-Time">Part-Time</Option>
            </Select>
          </Form.Item>
          <Form.Item label="Contract Document">
            <Upload
              beforeUpload={beforeUpload}
              fileList={fileList}
              onChange={({ fileList }) => setFileList(fileList)}
              maxCount={1}
            >
              <Button icon={<UploadOutlined />}>Select File</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={!!updatingContract}
        title={`Update Contract`}
        onCancel={() => {
          setUpdatingContract(null);
          setUpdateFileList([]);
          updateForm.resetFields();
        }}
        onOk={handleUpdate}
        confirmLoading={updating}
        width={600}
        okText="Update"
      >
        <Form
          form={updateForm}
          layout="vertical"
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="contractStartDate"
                label="Start Date"
              >
                <DatePicker 
                  style={{ width: '100%' }} 
                  format="YYYY-MM-DD" 
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="contractEndDate"
                label="End Date"
                rules={[
                  {
                    required: selectedUpdateContractType !== 'Regular',
                    message: 'Please select end date'
                  }
                ]}
              >
                <DatePicker 
                  style={{ width: '100%' }} 
                  format="YYYY-MM-DD"
                  placeholder={selectedUpdateContractType === 'Regular' ? 'Not applicable for Regular' : 'Select end date'}
                  disabled={selectedUpdateContractType === 'Regular'}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="contractType"
            label="Contract Type"
          >
            <Select onChange={(value) => {
              setSelectedUpdateContractType(value);
              if (value === 'Regular') {
                updateForm.setFieldsValue({ contractEndDate: undefined });
              }
              // Trigger validation to update required state
              updateForm.validateFields(['contractEndDate']);
            }}>
              <Option value="Regular">Regular</Option>
              <Option value="Contractual">Contractual</Option>
              <Option value="Probationary">Probationary</Option>
              <Option value="Temporary">Temporary</Option>
              <Option value="Part-Time">Part-Time</Option>
            </Select>
          </Form.Item>
          <Form.Item label="Contract Document">
            <Upload
              beforeUpload={beforeUpload}
              fileList={updateFileList}
              onChange={({ fileList }) => setUpdateFileList(fileList)}
              maxCount={1}
            >
              <Button icon={<UploadOutlined />}>Select File</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={previewOpen}
        title={previewFile?.name || 'Contract Preview'}
        footer={null}
        onCancel={() => {
          setPreviewOpen(false);
          setPreviewFile(null);
        }}
        width={800}
      >
        {renderFilePreview()}
      </Modal>

      <Modal
        open={!!viewingContractHistory}
        title={
          <div>
            <HistoryOutlined style={{ marginRight: 8 }} />
            Contract Records - {viewingContractHistory?.firstName} {viewingContractHistory?.lastName}
          </div>
        }
        onCancel={() => setViewingContractHistory(null)}
        footer={[
          <Button key="close" onClick={() => setViewingContractHistory(null)}>
            Close
          </Button>
        ]}
        width={900}
      >
        {viewingContractHistory && (
          <div>
            <Card size="small" style={{ marginBottom: 16, backgroundColor: '#f5f5f5' }}>
              <Row gutter={16}>
                <Col span={8}>
                  <Text strong>Employee ID:</Text> {viewingContractHistory.employeeID}
                </Col>
                <Col span={8}>
                  <Text strong>Department:</Text> {getDepartmentName(viewingContractHistory.departmentID)}
                </Col>
                <Col span={8}>
                  <Text strong>Total Contracts:</Text> {viewingContractHistory.contracts.length}
                </Col>
              </Row>
            </Card>

            <Divider orientation="left">Contract History</Divider>

            <Timeline mode="left">
              {viewingContractHistory.contracts
                .sort((a, b) => {
                  const dateA = a.contractStartDate ? new Date(a.contractStartDate).getTime() : 0;
                  const dateB = b.contractStartDate ? new Date(b.contractStartDate).getTime() : 0;
                  return dateB - dateA;
                })
                .map((contract: any, index: number) => {
                  const isLatest = index === 0;
                  const daysLeft: number | null = contract.contractEndDate 
                    ? dayjs(contract.contractEndDate).diff(dayjs(), 'days')
                    : null;
                  
                  let statusColor = 'default';
                  let statusText = 'Active';
                  
                  if (contract.contractType === 'Regular') {
                    statusColor = 'blue';
                    statusText = 'Regular';
                  } else if (daysLeft !== null) {
                    if (daysLeft < 0) {
                      statusColor = 'red';
                      statusText = 'Expired';
                    } else if (daysLeft < 30) {
                      statusColor = 'orange';
                      statusText = 'Expiring Soon';
                    } else {
                      statusColor = 'green';
                      statusText = 'Active';
                    }
                  }

                  return (
                    <Timeline.Item
                      key={contract.contractID?.toString() || `contract-${index}`}
                      color={isLatest ? 'blue' : 'gray'}
                      label={
                        <div style={{ width: 150, textAlign: 'right' }}>
                          {contract.contractStartDate 
                            ? dayjs(contract.contractStartDate).format('MMM DD, YYYY')
                            : 'N/A'}
                        </div>
                      }
                    >
                      <Card 
                        size="small" 
                        style={{ 
                          marginBottom: 16,
                          border: isLatest ? '2px solid #1890ff' : '1px solid #d9d9d9'
                        }}
                      >
                        <Space direction="vertical" style={{ width: '100%' }} size="small">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Space>
                              <Tag color={statusColor}>{statusText}</Tag>
                              {isLatest && <Tag color="blue">Current</Tag>}
                            </Space>
                            <Space>
                              <Button
                                type="link"
                                icon={<EyeOutlined />}
                                onClick={() => handlePreview({
                                  uid: contract.contractID?.toString() || '',
                                  name: contract.fileName || 'contract',
                                  status: 'done',
                                  url: contract.filePath,
                                } as UploadFile)}
                                size="small"
                              >
                                View
                              </Button>
                              <Button
                                type="link"
                                icon={<DownloadOutlined />}
                                onClick={() => handleDownload(contract.contractID!, contract.fileName || 'contract')}
                                size="small"
                              >
                                Download
                              </Button>
                              {isAdmin && (
                                <Button
                                  type="link"
                                  icon={<EditOutlined />}
                                  onClick={() => {
                                    setUpdatingContract(contract);
                                    setSelectedUpdateContractType(contract.contractType || '');
                                    updateForm.setFieldsValue({
                                      contractType: contract.contractType ?? undefined,
                                      contractStartDate: contract.contractStartDate ? dayjs(contract.contractStartDate) : undefined,
                                      contractEndDate: contract.contractEndDate ? dayjs(contract.contractEndDate) : undefined,
                                    });
                                    setUpdateFileList([]);
                                    setViewingContractHistory(null);
                                  }}
                                  size="small"
                                >
                                  Edit
                                </Button>
                              )}
                            </Space>
                          </div>

                          <Divider style={{ margin: '8px 0' }} />

                          <Row gutter={[16, 8]}>
                            <Col span={12}>
                              <Text type="secondary">Contract Type:</Text>
                              <br />
                              <Text strong>{contract.contractType || 'Not specified'}</Text>
                            </Col>
                            <Col span={12}>
                              <Text type="secondary">File Name:</Text>
                              <br />
                              <Text strong>{contract.fileName || 'N/A'}</Text>
                            </Col>
                            <Col span={12}>
                              <Text type="secondary">Start Date:</Text>
                              <br />
                              <Text strong>
                                {contract.contractStartDate 
                                  ? dayjs(contract.contractStartDate).format('MMM DD, YYYY')
                                  : 'Not set'}
                              </Text>
                            </Col>
                            <Col span={12}>
                              <Text type="secondary">End Date:</Text>
                              <br />
                              <Text strong>
                                {contract.contractType === 'Regular' 
                                  ? 'N/A (Regular)'
                                  : contract.contractEndDate 
                                    ? dayjs(contract.contractEndDate).format('MMM DD, YYYY')
                                    : 'Not set'}
                              </Text>
                            </Col>
                            {contract.contractEndDate && contract.contractType !== 'Regular' && (
                              <Col span={12}>
                                <Text type="secondary">Days Remaining:</Text>
                                <br />
                                <Text strong type={daysLeft && daysLeft < 30 ? 'danger' : daysLeft && daysLeft < 90 ? 'warning' : 'success'}>
                                  {daysLeft !== null && daysLeft > 0 ? `${daysLeft} days` : 'Expired'}
                                </Text>
                              </Col>
                            )}
                            {contract.lastUpdatedAt && (
                              <Col span={12}>
                                <Text type="secondary">Last Updated:</Text>
                                <br />
                                <Text strong>
                                  {dayjs(contract.lastUpdatedAt).format('MMM DD, YYYY HH:mm')}
                                </Text>
                              </Col>
                            )}
                          </Row>
                        </Space>
                      </Card>
                    </Timeline.Item>
                  );
                })}
            </Timeline>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ContractPage;