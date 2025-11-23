import React, { useState, useEffect, JSX } from "react";
import { 
  EyeOutlined, 
  UploadOutlined,
  FileOutlined,
  FilePdfOutlined,
  FileImageOutlined,
  DownloadOutlined,
  EditOutlined,
  SearchOutlined,
  HistoryOutlined,
  DeleteOutlined,
  NotificationOutlined
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
  Divider,
  Popconfirm,
  Spin
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
  contractCategory: string;
}

interface ContractUpdateFormData {
  contractStartDate?: Dayjs;
  contractEndDate?: Dayjs;
  contractType?: string;
  contractCategory?: string;
}

const getFileIcon = (fileType?: string, fileName?: string) => {
  // Check by file extension first
  if (fileName) {
    const ext = fileName.toLowerCase().split('.').pop();
    if (ext === 'pdf') return <FilePdfOutlined />;
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext!)) return <FileImageOutlined />;
  }
  
  // Fallback to file type checking
  if (!fileType) return <FileOutlined />;
  
  if (fileType.includes('pdf')) return <FilePdfOutlined />;
  if (fileType.includes('image')) return <FileImageOutlined />;
  
  return <FileOutlined />;
};

// Helper function to extract text from different file types
const extractTextFromBlob = async (_blob: Blob, fileType: string): Promise<string> => {
  return new Promise((resolve, _reject) => {
    if (fileType.includes('pdf')) {
      // For PDF files - we'll use the blob URL directly in iframe
      resolve('PDF content is displayed in the embedded viewer below.');
    } else if (fileType.includes('image')) {
      resolve('Image file - preview available below.');
    } else {
      // For other file types (shouldn't happen with our restrictions)
      resolve('This file type is not supported. Only PDF and image files are allowed.');
    }
  });
};

const ContractPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.roleId === ROLES.Admin || user?.roleId === ROLES.HR;
  const isTeacher = user?.roleId === ROLES.Teaching || user?.roleId === ROLES.Coordinator;
  const isNonTeacher = user?.roleId === ROLES.NonTeaching;
  
  const hasAccess = isAdmin || isTeacher || isNonTeacher;

  const [employees, setEmployees] = useState<EmployeeWithContracts[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<EmployeeWithContracts[]>([]);
  const [searchText, setSearchText] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<(UploadFile & { blob?: Blob }) | null>(null);
  const [, setFileContent] = useState<string>('');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeWithContracts | null>(null);
  const [updatingContract, setUpdatingContract] = useState<any>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [updateFileList, setUpdateFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
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

    fetchData();
  }, [hasAccess, isAdmin, isTeacher, isNonTeacher, user?.employeeId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
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
              contractStatus: "",
              roleId: 0
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
      console.error("Failed to fetch data:", error);
      setError("Failed to load contract data");
      message.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  // Add this function for manual expiration check
    const manuallyCheckExpirations = async () => {
    try {
      setLoading(true);
      // Use the service method instead of direct axios call
      const response = await ContractService.checkExpirations();
      message.success(response.message || 'Contract expiration check completed successfully');
    } catch (error: any) {
      console.error('Error checking contract expirations:', error);
      message.error(error.response?.data?.message || 'Failed to check contract expirations');
    } finally {
      setLoading(false);
    }
    };

  const getDepartmentName = (departmentId: number | null | undefined): string => {
    if (departmentId == null) return 'Unknown';
    const department = departments.find(d => d.departmentID === departmentId);
    return department ? department.departmentName : String(departmentId);
  };

  const getAllDepartmentNames = (employee: Employee): string => {
    const departmentsList: string[] = [];
    
    // Primary department
    if (employee.departmentID) {
      const primaryDept = getDepartmentName(employee.departmentID);
      if (primaryDept !== 'Unknown') {
        departmentsList.push(primaryDept);
      }
    }
    
    // Second department
    if (employee.departmentID2) {
      const secondDept = getDepartmentName(employee.departmentID2);
      if (secondDept !== 'Unknown') {
        departmentsList.push(secondDept);
      }
    }
    
    // Third department
    if (employee.departmentID3) {
      const thirdDept = getDepartmentName(employee.departmentID3);
      if (thirdDept !== 'Unknown') {
        departmentsList.push(thirdDept);
      }
    }
    
    return departmentsList.length > 0 ? departmentsList.join(', ') : 'No department assigned';
  };

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

      // Search by ALL departments (primary, second, and third)
      const allDeptNames = getAllDepartmentNames(emp).toLowerCase();
      const deptMatch = allDeptNames.includes(searchLower);

      // Search by contract type
      const typeMatch = latestContract?.contractType?.toLowerCase().includes(searchLower);

      // Search by contract category
      const categoryMatch = latestContract?.contractCategory?.toLowerCase().includes(searchLower);

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

      return nameMatch || deptMatch || typeMatch || categoryMatch || endDateMatch || renewalMatch;
    });

    setFilteredEmployees(filtered);
  };

  const handlePreview = async (contract: any) => {
    try {
      setIsLoadingPreview(true);
      setFileContent('');

      // Try to get file blob for better preview handling
      const fileInfo = await ContractService.getFileBlob(contract.contractID!);
      
      if (!fileInfo.blob) {
        message.warning("No file available for preview");
        setIsLoadingPreview(false);
        return;
      }
      
      // Create object URL from blob for preview
      const blobUrl = URL.createObjectURL(fileInfo.blob);
      
      // Try to extract text content from the file
      if (fileInfo.fileType.includes('pdf') || fileInfo.fileType.includes('image')) {
        try {
          const text = await extractTextFromBlob(fileInfo.blob, fileInfo.fileType);
          setFileContent(text);
        } catch (textError) {
          console.error("Failed to extract text content:", textError);
          // Continue without text content
        }
      }
      
      setPreviewFile({
        uid: contract.contractID?.toString() || '',
        name: fileInfo.fileName || contract.fileName || 'contract',
        status: 'done',
        url: blobUrl,
        type: fileInfo.fileType,
        blob: fileInfo.blob
      });
      setPreviewOpen(true);
    } catch (error) {
      console.error("Failed to get file for preview:", error);
      
      // Fallback to URL-based preview
      try {
        const fileInfo = await ContractService.getFileUrl(contract.contractID!);
        
        if (!fileInfo.fileUrl) {
          message.warning("No file available for preview");
          return;
        }
        
        setPreviewFile({
          uid: contract.contractID?.toString() || '',
          name: contract.fileName || 'contract',
          status: 'done',
          url: fileInfo.fileUrl,
          type: fileInfo.fileType
        });
        setPreviewOpen(true);
      } catch (urlError) {
        console.error("Failed to get file URL:", urlError);
        message.error("Unable to preview contract file");
      }
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleDownloadFromBlob = (blob: Blob, fileName: string) => {
    try {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      message.success("Download started");
    } catch (error) {
      console.error("Failed to download file from blob:", error);
      message.error("Failed to download file");
    }
  };

  const handleDownload = async (contractId: number, fileName: string) => {
    try {
      // Try direct download first (works across devices)
      await ContractService.downloadDirect(contractId, fileName);
      message.success("Download started");
    } catch (error) {
      console.error("Direct download failed, trying blob download:", error);
      
      // Fallback to blob download
      try {
        const response = await ContractService.download(contractId);
        
        // Create blob URL for download
        const url = window.URL.createObjectURL(response);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        message.success("Download started");
      } catch (blobError) {
        console.error("Blob download also failed:", blobError);
        message.error("Failed to download contract");
      }
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
          contractCategory: values.contractCategory,
          contractStartDate: values.contractStartDate.format('YYYY-MM-DD'),
          lastUpdatedBy: user?.employeeId || 0
        };

        // Always include contractEndDate, but set it appropriately based on contract type
        if (values.contractType === 'Regular') {
          contractData.contractEndDate = ''; // Empty for Regular contracts
        } else if (values.contractEndDate) {
          contractData.contractEndDate = values.contractEndDate.format('YYYY-MM-DD');
        } else {
          contractData.contractEndDate = '';
        }

        try {
          await ContractService.upload(
            editingEmployee.employeeID!,
            file,
            contractData
          );
          
          message.success("Contract uploaded successfully");
          await fetchData(); // Refresh data
          
          setEditingEmployee(null);
          setFileList([]);
          form.resetFields();
        } catch (error) {
          console.error("Failed to upload contract:", error);
          message.error("Failed to upload contract");
        } finally {
          setUploading(false);
        }
      } else {
        message.error("Please select a file to upload");
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
        if (values.contractCategory) {
          updateData.contractCategory = values.contractCategory;
        }
        if (values.contractStartDate) {
          updateData.contractStartDate = values.contractStartDate.format('YYYY-MM-DD');
        }
        // Handle contract end date based on contract type
        if (values.contractType === 'Regular') {
          updateData.contractEndDate = ''; // Empty for Regular contracts
        } else if (values.contractEndDate) {
          updateData.contractEndDate = values.contractEndDate.format('YYYY-MM-DD');
        } else if (values.contractType && values.contractType !== 'Regular') {
          // If changing to non-Regular without end date, keep existing or set to empty
          updateData.contractEndDate = updatingContract.contractEndDate || '';
        }

        if (updateFileList.length > 0) {
          updateData.file = updateFileList[0].originFileObj as File;
        }

        try {
          await ContractService.update(
            updatingContract.contractID!,
            updateData
          );
          
          message.success("Contract updated successfully");
          await fetchData(); // Refresh data
          
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

  const handleDeleteContract = async (contractId: number) => {
    try {
      setDeleting(true);
      await ContractService.delete(contractId);
      message.success("Contract deleted successfully");
      await fetchData(); // Refresh data
    } catch (error) {
      console.error("Failed to delete contract:", error);
      message.error("Failed to delete contract");
    } finally {
      setDeleting(false);
    }
  };

  const beforeUpload: UploadProps['beforeUpload'] = (file) => {
    // Check file type - only allow PDF and images
    const isPdf = file.type === 'application/pdf';
    const isImage = file.type.startsWith('image/');
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
    
    const isAllowedType = isPdf || (isImage && allowedImageTypes.includes(file.type));
    
    if (!isAllowedType) {
      message.error('You can only upload PDF and image files (JPG, PNG, GIF, WebP, BMP)!');
      return Upload.LIST_IGNORE;
    }

    // Check file size (10MB limit)
    const isLt10M = file.size / 1024 / 1024 < 10;
    if (!isLt10M) {
      message.error('File must be smaller than 10MB!');
      return Upload.LIST_IGNORE;
    }
    
    // Return false to prevent auto upload
    return false;
  };

  const renderFilePreview = () => {
    if (!previewFile) return null;

    const fileType = previewFile.type || '';
    const fileUrl = previewFile.url || '';
    const fileName = previewFile.name || 'contract';

    if (isLoadingPreview) {
      return (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Spin size="large" />
          <p style={{ marginTop: 16 }}>Loading file content...</p>
        </div>
      );
    }

    // Handle PDF files
    if (fileType.includes('pdf') || fileName.toLowerCase().endsWith('.pdf')) {
      return (
        <div className="file-content-preview file-type-pdf">
          <div className="file-content-header">
            <Text strong>PDF Document</Text>
            <Button 
              type="primary" 
              icon={<DownloadOutlined />}
              onClick={() => previewFile.blob ? handleDownloadFromBlob(previewFile.blob, fileName) : window.open(fileUrl, '_blank')}
              className="download-button"
            >
              Download PDF
            </Button>
          </div>
          <div style={{ height: '500px' }}>
            <iframe 
              src={fileUrl} 
              width="100%" 
              height="100%" 
              style={{ border: 'none' }}
              title="PDF Preview"
              className="pdf-viewer-container"
            />
          </div>
        </div>
      );
    }

    // Handle image files
    if (fileType.includes('image') || 
        fileName.toLowerCase().endsWith('.jpg') || 
        fileName.toLowerCase().endsWith('.jpeg') || 
        fileName.toLowerCase().endsWith('.png') || 
        fileName.toLowerCase().endsWith('.gif') ||
        fileName.toLowerCase().endsWith('.webp') ||
        fileName.toLowerCase().endsWith('.bmp')) {
      return (
        <div className="file-content-preview file-type-image">
          <div className="file-content-header">
            <Text strong>Image Preview</Text>
            <Button 
              type="primary" 
              icon={<DownloadOutlined />}
              onClick={() => previewFile.blob ? handleDownloadFromBlob(previewFile.blob, fileName) : window.open(fileUrl, '_blank')}
              className="download-button"
            >
              Download Image
            </Button>
          </div>
          <div className="image-preview-container">
            <Image
              width="100%"
              src={fileUrl}
              alt="Contract preview"
              style={{ maxWidth: '100%', objectFit: 'contain' }}
              fallback="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xOCAxNUg2VjlIMThWMTVaIiBmaWxsPSIjQjhCOEI4Ii8+CjxjaXJjbGUgY3g9IjEyIiBjeT0iMTAiIHI9IjIiIGZpbGw9IiNCOEI4QjgiLz4KPC9zdmc+"
            />
          </div>
        </div>
      );
    }

    // For unsupported file types (shouldn't happen with our restrictions)
    return (
      <div className="file-content-preview file-type-other">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <FileOutlined style={{ fontSize: 64, color: '#ff4d4f' }} />
          <p style={{ marginTop: 16, fontSize: '16px' }}>
            {fileName}
          </p>
          <p style={{ marginTop: 8, color: '#666', marginBottom: '24px' }}>
            This file type is not supported. Only PDF and image files are allowed.
          </p>
          <Button 
            type="primary" 
            icon={<DownloadOutlined />}
            onClick={() => previewFile.blob ? handleDownloadFromBlob(previewFile.blob, fileName) : window.open(fileUrl, '_blank')}
            style={{ marginTop: 16 }}
            className="download-button"
          >
            Download File
          </Button>
        </div>
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
      title: 'Department(s)',
      key: 'department',
      render: (record: Employee) => {
        const departmentsList: JSX.Element[] = [];
        
        // Primary department
        if (record.departmentID) {
          const primaryDept = getDepartmentName(record.departmentID);
          if (primaryDept !== 'Unknown') {
            departmentsList.push(
              <Tag key="primary" color="blue">{primaryDept}</Tag>
            );
          }
        }
        
        // Second department
        if (record.departmentID2) {
          const secondDept = getDepartmentName(record.departmentID2);
          if (secondDept !== 'Unknown') {
            departmentsList.push(
              <Tag key="secondary" color="green">{secondDept}</Tag>
            );
          }
        }
        
        // Third department
        if (record.departmentID3) {
          const thirdDept = getDepartmentName(record.departmentID3);
          if (thirdDept !== 'Unknown') {
            departmentsList.push(
              <Tag key="tertiary" color="orange">{thirdDept}</Tag>
            );
          }
        }
        
        return (
          <Space wrap>
            {departmentsList.length > 0 ? departmentsList : <Text type="secondary">No department</Text>}
          </Space>
        );
      },
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
      title: 'Contract Documents',
      key: 'contractDocuments',
      render: (record: EmployeeWithContracts) => {
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
                  onClick={() => handlePreview(latestContract)}
                  size="small"
                />
                <Button
                  type="link"
                  icon={<DownloadOutlined />}
                  onClick={() => handleDownload(latestContract.contractID!, latestContract.fileName || 'contract')}
                  size="small"
                />
                {isAdmin && (
                  <>
                    <Button
                      type="link"
                      icon={<EditOutlined />}
                      onClick={() => {
                        setUpdatingContract(latestContract);
                        setSelectedUpdateContractType(latestContract.contractType || '');
                        updateForm.setFieldsValue({
                          contractType: latestContract.contractType ?? undefined,
                          contractCategory: latestContract.contractCategory ?? undefined,
                          contractStartDate: latestContract.contractStartDate ? dayjs(latestContract.contractStartDate) : undefined,
                          contractEndDate: latestContract.contractEndDate ? dayjs(latestContract.contractEndDate) : undefined,
                        });
                        setUpdateFileList([]);
                      }}
                      size="small"
                    />
                    <Popconfirm
                      title="Delete Contract"
                      description="Are you sure you want to delete this contract?"
                      onConfirm={() => handleDeleteContract(latestContract.contractID!)}
                      okText="Yes"
                      cancelText="No"
                    >
                      <Button
                        type="link"
                        icon={<DeleteOutlined />}
                        danger
                        size="small"
                        loading={deleting}
                      />
                    </Popconfirm>
                  </>
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
              <span className="action-text">View Contracts</span>
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
                setFileList([]);
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

  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        height: '50vh',
        flexDirection: 'column'
      }}>
        <Text type="danger" style={{ fontSize: '18px', marginBottom: '16px' }}>
          Error Loading Data
        </Text>
        <Text type="secondary" style={{ marginBottom: '16px' }}>
          {error}
        </Text>
        <Button type="primary" onClick={fetchData}>
          Retry
        </Button>
      </div>
    );
  }

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

  return (
    <div className="contract-page">
      <div style={{ marginBottom: '16px' }}>
        <h2>
          {isAdmin ? 'Employee Contracts' : 'My Contracts'}
        </h2>
      </div>

      {/* Updated Search Section with Manual Check Button */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Input
            placeholder="Search by name, department, contract type, category, end date, or 'expiring soon', 'renewal', 'expired'..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => handleSearch(e.target.value)}
            allowClear
            size="large"
            style={{ maxWidth: '600px', flex: 1 }}
          />
          
          {/* Manual Expiration Check Button - Only for Admins */}
          {isAdmin && (
            <Button
              type="dashed"
              icon={<NotificationOutlined />}
              onClick={manuallyCheckExpirations}
              loading={loading}
              size="large"
              title="Manually check for expiring contracts and send email notifications"
            >
              Check Expirations
            </Button>
          )}
        </div>
      </div>

      <Table
        columns={columns}
        dataSource={filteredEmployees.map(emp => ({ ...emp, key: emp.employeeID }))}
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      {/* Upload Contract Modal */}
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
            contractCategory: 'Teaching',
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
          <Row gutter={16}>
            <Col span={12}>
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
                  form.validateFields(['contractEndDate']);
                }}>
                  <Option value="Regular">Regular</Option>
                  <Option value="Contractual">Contractual</Option>
                  <Option value="Probationary">Probationary</Option>
                  <Option value="Temporary">Temporary</Option>
                  <Option value="Part-Time">Part-Time</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="contractCategory"
                label="Contract Category"
                rules={[{ required: true, message: 'Please select contract category' }]}
              >
                <Select>
                  <Option value="Teaching">Teaching</Option>
                  <Option value="Non-Teaching">Non-Teaching</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item 
            label="Contract Document"
            rules={[{ required: true, message: 'Please select a PDF or image file' }]}
            extra="Only PDF and image files (JPG, PNG, GIF, WebP, BMP) are allowed. Maximum file size: 10MB."
          >
            <Upload
              beforeUpload={beforeUpload}
              fileList={fileList}
              onChange={({ fileList }) => setFileList(fileList)}
              maxCount={1}
              accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.bmp,application/pdf,image/*"
            >
              <Button icon={<UploadOutlined />}>Select PDF or Image File</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>

      {/* Update Contract Modal */}
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
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="contractType"
                label="Contract Type"
              >
                <Select onChange={(value) => {
                  setSelectedUpdateContractType(value);
                  if (value === 'Regular') {
                    updateForm.setFieldsValue({ contractEndDate: undefined });
                  }
                  updateForm.validateFields(['contractEndDate']);
                }}>
                  <Option value="Regular">Regular</Option>
                  <Option value="Contractual">Contractual</Option>
                  <Option value="Probationary">Probationary</Option>
                  <Option value="Temporary">Temporary</Option>
                  <Option value="Part-Time">Part-Time</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="contractCategory"
                label="Contract Category"
              >
                <Select>
                  <Option value="Teaching">Teaching</Option>
                  <Option value="Non-Teaching">Non-Teaching</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item 
            label="Contract Document (Optional)"
            extra="Only PDF and image files (JPG, PNG, GIF, WebP, BMP) are allowed. Maximum file size: 10MB."
          >
            <Upload
              beforeUpload={beforeUpload}
              fileList={updateFileList}
              onChange={({ fileList }) => setUpdateFileList(fileList)}
              maxCount={1}
              accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.bmp,application/pdf,image/*"
            >
              <Button icon={<UploadOutlined />}>Select PDF or Image File</Button>
            </Upload>
            <Text type="secondary">Leave empty to keep current file</Text>
          </Form.Item>
        </Form>
      </Modal>

      {/* File Preview Modal */}
      <Modal
        open={previewOpen}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {previewFile && getFileIcon(previewFile.type, previewFile.name)}
            <span>{previewFile?.name || 'Contract Preview'}</span>
          </div>
        }
        footer={null}
        onCancel={() => {
          setPreviewOpen(false);
          // Clean up blob URL to prevent memory leaks
          if (previewFile?.url && previewFile.url.startsWith('blob:')) {
            URL.revokeObjectURL(previewFile.url);
          }
          setPreviewFile(null);
          setFileContent('');
          setIsLoadingPreview(false);
        }}
        width={900}
        style={{ top: 20 }}
        bodyStyle={{ padding: 0 }}
      >
        {renderFilePreview()}
      </Modal>

      {/* Contract History Modal */}
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
                <Col span={16}>
                  <Text strong>Department(s):</Text> {getAllDepartmentNames(viewingContractHistory)}
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
                          border: isLatest ? '2px solid #1890ff' : '1px solid #d9d9d9',
                          maxWidth: '100%'
                        }}
                      >
                        <Space direction="vertical" style={{ width: '100%' }} size="small">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                            <Space wrap>
                              <Tag color={statusColor}>{statusText}</Tag>
                              <Tag color={contract.contractCategory === 'Teaching' ? 'blue' : 'green'}>
                                {contract.contractCategory || 'Not specified'}
                              </Tag>
                              {isLatest && <Tag color="blue">Current</Tag>}
                            </Space>
                            <Space className="contract-history-actions" wrap>
                              <Button
                                type="link"
                                icon={<EyeOutlined />}
                                onClick={() => handlePreview(contract)}
                                size="small"
                                title="View"
                              >
                                <span className="action-text">View</span>
                              </Button>
                              <Button
                                type="link"
                                icon={<DownloadOutlined />}
                                onClick={() => handleDownload(contract.contractID!, contract.fileName || 'contract')}
                                size="small"
                                title="Download"
                              >
                                <span className="action-text">Download</span>
                              </Button>
                              {isAdmin && (
                                <>
                                  <Button
                                    type="link"
                                    icon={<EditOutlined />}
                                    onClick={() => {
                                      setUpdatingContract(contract);
                                      setSelectedUpdateContractType(contract.contractType || '');
                                      updateForm.setFieldsValue({
                                        contractType: contract.contractType ?? undefined,
                                        contractCategory: contract.contractCategory ?? undefined,
                                        contractStartDate: contract.contractStartDate ? dayjs(contract.contractStartDate) : undefined,
                                        contractEndDate: contract.contractEndDate ? dayjs(contract.contractEndDate) : undefined,
                                      });
                                      setUpdateFileList([]);
                                      setViewingContractHistory(null);
                                    }}
                                    size="small"
                                    title="Edit"
                                  >
                                    <span className="action-text">Edit</span>
                                  </Button>
                                  <Popconfirm
                                    title="Delete Contract"
                                    description="Are you sure you want to delete this contract?"
                                    onConfirm={() => handleDeleteContract(contract.contractID!)}
                                    okText="Yes"
                                    cancelText="No"
                                  >
                                    <Button
                                      type="link"
                                      icon={<DeleteOutlined />}
                                      danger
                                      size="small"
                                      loading={deleting}
                                      title="Delete"
                                    >
                                      <span className="action-text">Delete</span>
                                    </Button>
                                  </Popconfirm>
                                </>
                              )}
                            </Space>
                          </div>

                          <Divider style={{ margin: '8px 0' }} />

                          {/* Rest of the contract details remain the same */}
                          <Row gutter={[16, 8]}>
                            <Col span={12}>
                              <Text type="secondary">Contract Type:</Text>
                              <br />
                              <Text strong>{contract.contractType || 'Not specified'}</Text>
                            </Col>
                            <Col span={12}>
                              <Text type="secondary">Contract Category:</Text>
                              <br />
                              <Text strong>{contract.contractCategory || 'Not specified'}</Text>
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