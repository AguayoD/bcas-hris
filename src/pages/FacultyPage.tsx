import React, { useState, useEffect, useRef } from "react";
import {
  Card,
  Form,
  Input,
  Button,
  Table,
  Space,
  Select,
  message,
  Spin,
  Popconfirm,
  Modal,
  DatePicker,
  Grid,
  Tabs,
  Divider,
  Checkbox,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  UserOutlined,
  PrinterOutlined,
  FileExcelOutlined,
  FilterOutlined,
} from "@ant-design/icons";
import { EmployeeService } from "../api/EmployeeService";
import { Employee } from "../types/tblEmployees";
import type { ColumnsType } from "antd/lib/table";
import UserService from "../api/userService";
import "./FacultyPage.css";
import DepartmentService from "../api/DepartmentService";
import { DepartmentTypes } from "../types/tblDepartment";
import { PositionTypes } from "../types/tblPosition";
import PositionService from "../api/PositionService";
import { useAuth } from "../types/useAuth";
import { ROLES } from "../types/auth";
import Requirements from "./Requirements";
import { EducationalAttainmentService } from "../api/EducationalAttainmentService";
import { EmploymentStatusService } from "../api/EmploymentStatusService";
import { EducationalAttainmentTypes } from "../types/tblEducationalAttainment";
import { EmploymentStatusTypes } from "../types/tblEmploymentStatus";
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { tblUsersTypes } from "../types/tblUsers";

dayjs.extend(isBetween);

const { Option } = Select;
const { useBreakpoint } = Grid;
const { TabPane } = Tabs;
const { RangePicker } = DatePicker;

// Excel export utility functions
const exportToExcel = (data: any[], filename: string, category?: string) => {
  const headers = [
    "Employee ID",
    "First Name",
    "Middle Name",
    "Last Name",
    "Gender",
    "Date of Birth",
    "Email",
    "Phone Number",
    "Address",
    "Primary Department",
    "Secondary Department",
    "Tertiary Department",
    "Position",
    "Employment Status",
    "Hire Date",
    "Family Member First Name",
    "Family Member Last Name",
    "Family Member Gender",
    "Family Member Address",
    "Family Member Phone",
    "Educational Attainment",
    "Institution Name",
    "Year Graduated",
    "Course Name",
  ].join(",");

  const rows = data.map((employee) =>
    [
      `"${employee.formattedId}"`,
      `"${employee.firstName || ""}"`,
      `"${employee.middleName || ""}"`,
      `"${employee.lastName || ""}"`,
      `"${employee.gender || ""}"`,
      `"${
        employee.dateOfBirth
          ? dayjs(employee.dateOfBirth).format("YYYY-MM-DD")
          : ""
      }"`,
      `"${employee.email || ""}"`,
      `"${employee.phoneNumber || ""}"`,
      `"${employee.address || ""}"`,
      `"${employee.departmentName || ""}"`,
      `"${employee.departmentName2 || ""}"`,
      `"${employee.departmentName3 || ""}"`,
      `"${employee.positionName || ""}"`,
      `"${employee.employmentStatusName || ""}"`,
      `"${
        employee.hireDate ? dayjs(employee.hireDate).format("YYYY-MM-DD") : ""
      }"`,
      `"${employee.memberFirstName || ""}"`,
      `"${employee.memberLastName || ""}"`,
      `"${employee.memberGender || ""}"`,
      `"${employee.memberAddress || ""}"`,
      `"${employee.memberPhoneNumber || ""}"`,
      `"${employee.educationalAttainmentName || ""}"`,
      `"${employee.institutionName || ""}"`,
      `"${
        employee.yearGraduated
          ? dayjs(employee.yearGraduated).format("YYYY")
          : ""
      }"`,
      `"${employee.courseName || ""}"`,
    ].join(",")
  );

  const csvContent = [headers, ...rows].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `${filename}${category ? `_${category}` : ""}_${dayjs().format(
      "YYYY-MM-DD"
    )}.csv`
  );
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const FacultyPage: React.FC = () => {
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState("");
  const [facultyData, setFacultyData] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [, setError] = useState<string | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isUserModalVisible, setIsUserModalVisible] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null
  );
  const [userForm] = Form.useForm();
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedEmployeeDetails, setSelectedEmployeeDetails] =
    useState<Employee | null>(null);
  const screens = useBreakpoint();
  const [departments, setDepartments] = useState<DepartmentTypes[]>([]);
  const [positions, setPositions] = useState<PositionTypes[]>([]);
  const [educationalAttainments, setEducationalAttainments] = useState<EducationalAttainmentTypes[]>([]);
  const [employmentStatuses, setEmploymentStatuses] = useState<EmploymentStatusTypes[]>([]);
  const { user } = useAuth();
  const isAdmin = user?.roleId === ROLES.Admin;
  const isCoordinator = user?.roleId === ROLES.Coordinator;
  const isHR = user?.roleId === ROLES.HR;
  const canFilter = isAdmin || isHR || isCoordinator;
  const tableRef = useRef<HTMLDivElement>(null);

  // Filter states
  const [genderFilter, setGenderFilter] = useState<string>("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("");
  const [positionFilter, setPositionFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [firstNameFilter, setFirstNameFilter] = useState<string>("");
  const [middleNameFilter, setMiddleNameFilter] = useState<string>("");
  const [lastNameFilter, setLastNameFilter] = useState<string>("");
  const [emailFilter, setEmailFilter] = useState<string>("");
  const [employeeIdFilter, setEmployeeIdFilter] = useState<string>("");
  const [nameFilter, setNameFilter] = useState<string>("");
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);

  // Print and Export modal states
  const [printModalVisible, setPrintModalVisible] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedExportDepartments, setSelectedExportDepartments] = useState<string[]>([]);

  // Coordinator department state
  const [, setCoordinatorDepartmentId] = useState<number | null>(null);

  // New states from FacultyPage1.tsx
  const [employmentHistoryList, setEmploymentHistoryList] = useState<Array<{
    departmentID?: number | null;
    positionID?: number | null;
    category?: string | null;
    dateStarted?: string | null;
  }>>([]);
  const [editingHistoryIndex, setEditingHistoryIndex] = useState<number | null>(null);
  const [isEmploymentHistoryModalVisible, setEmploymentHistoryModalVisible] = useState(false);
  const [employmentHistoryForm] = Form.useForm();

  // Update confirmation states
  const [submitPopconfirmVisible, setSubmitPopconfirmVisible] = useState<boolean>(false);
  const [formValues, setFormValues] = useState<any>(null);

  // Helper function to check if position should have department
  const shouldHaveDepartment = (positionId?: number): boolean => {
    if (!positionId) return true; // Default to having department
    
    const position = positions.find(p => p.positionID === positionId);
    const positionName = position?.positionName?.toLowerCase() || '';
    
    // Positions that should NOT have department
    const nonDepartmentPositions = ['hr', 'admin', 'non-teaching', 'school doctor','non-teacher','security', 'maintenance', 'janitor', 'cleaner', 'technician', 'custodian'];
    
    return !nonDepartmentPositions.some(nonDeptPos => 
      positionName.includes(nonDeptPos)
    );
  };

  const formatEmployeeId = (
    employeeId: number | string | undefined,
    hireDate?: string | Date
  ): string => {
    if (!employeeId) return "N/A";

    if (typeof employeeId === "string" && employeeId.includes("-")) {
      return employeeId;
    }

    const idNumber =
      typeof employeeId === "string" ? parseInt(employeeId) : employeeId;

    if (!hireDate) {
      console.warn(`⚠️ Missing hireDate for employee ID ${idNumber}`);
    }

    const year = hireDate ? dayjs(hireDate).year() : new Date().getFullYear();
    const formattedId = idNumber.toString().padStart(3, "0");
    return `${year}-${formattedId}`;
  };

  const getEnhancedFacultyData = () => {
    return facultyData.map((employee) => {
      const isValidHireDate = employee.hireDate && dayjs(employee.hireDate).isValid();

      if (!isValidHireDate) {
        console.warn(`⚠️ Invalid or missing hireDate for employeeID ${employee.employeeID}`);
      }

      const getDepartmentName = (deptId: number | null | undefined) => {
        if (!deptId) return "N/A";
        return departments.find((d) => d.departmentID === deptId)?.departmentName || "N/A";
      };

      return {
        ...employee,
        formattedId: isValidHireDate
          ? formatEmployeeId(employee.employeeID, employee.hireDate)
          : "Invalid-Date",
        departmentName: shouldHaveDepartment(employee.positionID)
          ? getDepartmentName(employee.departmentID)
          : "N/A",
        departmentName2: shouldHaveDepartment(employee.positionID)
          ? getDepartmentName(employee.departmentID2)
          : "N/A",
        departmentName3: shouldHaveDepartment(employee.positionID)
          ? getDepartmentName(employee.departmentID3)
          : "N/A",
        positionName:
          positions.find((p) => p.positionID === employee.positionID)
            ?.positionName || "N/A",
        educationalAttainmentName:
          educationalAttainments.find((a) => a.educationalAttainmentID === employee.educationalAttainment)
            ?.attainmentName || "N/A",
        employmentStatusName:
          employmentStatuses.find((s) => s.employmentStatusID === employee.employmentStatus)
            ?.statusName || "N/A",
        gender: employee.gender || "N/A",
      };
    });
  };

  // Function to handle mixed department printing
  const handleMixedDepartmentPrint = () => {
    if (selectedDepartments.length === 0) {
      message.warning("Please select at least one department");
      return;
    }

    // Use visible rows so print matches current table filters
    const enhancedData = filteredData.map((employee) => {
      const isValidHireDate = employee.hireDate && dayjs(employee.hireDate).isValid();
      const getDepartmentName = (deptId: number | null | undefined) => {
        if (!deptId) return "N/A";
        return departments.find((d) => d.departmentID === deptId)?.departmentName || "N/A";
      };

      return {
        ...employee,
        formattedId: isValidHireDate
          ? formatEmployeeId(employee.employeeID, employee.hireDate)
          : "Invalid-Date",
        departmentName: shouldHaveDepartment(employee.positionID)
          ? getDepartmentName(employee.departmentID)
          : "N/A",
        departmentName2: shouldHaveDepartment(employee.positionID)
          ? getDepartmentName(employee.departmentID2)
          : "N/A",
        departmentName3: shouldHaveDepartment(employee.positionID)
          ? getDepartmentName(employee.departmentID3)
          : "N/A",
        positionName:
          positions.find((p) => p.positionID === employee.positionID)
            ?.positionName || "N/A",
        educationalAttainmentName:
          educationalAttainments.find((a) => a.educationalAttainmentID === employee.educationalAttainment)
            ?.attainmentName || "N/A",
        employmentStatusName:
          employmentStatuses.find((s) => s.employmentStatusID === employee.employmentStatus)
            ?.statusName || "N/A",
        gender: employee.gender || "N/A",
      };
    });

    // Filter employees who have ALL selected departments assigned
    const dataToPrint = enhancedData.filter((employee) => {
      const employeeDepartments = [
        employee.departmentName,
        employee.departmentName2,
        employee.departmentName3,
      ].filter(dept => dept && dept !== "N/A");

      // Check if employee has ALL selected departments
      return selectedDepartments.every(selectedDept => 
        employeeDepartments.includes(selectedDept)
      );
    });

    const departmentTitles = selectedDepartments.join(" + ");
    const title = `Faculty Members - ${departmentTitles}`;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      message.error("Popup blocked! Please allow popups for printing.");
      return;
    }

    const tableHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .print-header { text-align: center; margin-bottom: 20px; }
          .print-title { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
          .print-date { font-size: 14px; color: #666; margin-bottom: 20px; }
          .print-departments { font-size: 16px; margin-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="print-header">
          <div class="print-title">Faculty Members</div>
          <div class="print-departments">Departments: ${departmentTitles}</div>
          <div class="print-date">Generated on: ${dayjs().format(
            "MMMM D, YYYY h:mm A"
          )}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Employee ID</th>
              <th>First Name</th>
              <th>Middle Name</th>
              <th>Last Name</th>
              <th>Gender</th>
              <th>Email</th>
              <th>Primary Department</th>
              <th>Secondary Department</th>
              <th>Tertiary Department</th>
              <th>Position</th>
              <th>Status</th>
              <th>Hire Date</th>
            </tr>
          </thead>
          <tbody>
            ${dataToPrint
              .map(
                (employee) => `
              <tr>
                <td>${employee.formattedId}</td>
                <td>${employee.firstName || ""}</td>
                <td>${employee.middleName || ""}</td>
                <td>${employee.lastName || ""}</td>
                <td>${employee.gender || ""}</td>
                <td>${employee.email || ""}</td>
                <td>${employee.departmentName}</td>
                <td>${employee.departmentName2}</td>
                <td>${employee.departmentName3}</td>
                <td>${employee.positionName}</td>
                <td>${employee.employmentStatusName}</td>
                <td>${
                  employee.hireDate
                    ? dayjs(employee.hireDate).format("YYYY-MM-DD")
                    : ""
                }</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
        <div class="no-print" style="margin-top: 20px; text-align: center;">
          <button onclick="window.print()">Print</button>
          <button onclick="window.close()">Close</button>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(tableHtml);
    printWindow.document.close();
    setPrintModalVisible(false);
    setSelectedDepartments([]);
    message.success(`Printed data for departments: ${departmentTitles}`);
  };

  // Function to handle mixed department export
  const handleMixedDepartmentExport = () => {
    if (selectedExportDepartments.length === 0) {
      message.warning("Please select at least one department");
      return;
    }

    const enhancedData = getEnhancedFacultyData();
    
    // Filter employees who have ALL selected departments assigned
    const dataToExport = enhancedData.filter((employee) => {
      const employeeDepartments = [
        employee.departmentName,
        employee.departmentName2,
        employee.departmentName3,
      ].filter(dept => dept && dept !== "N/A");

      // Check if employee has ALL selected departments
      return selectedExportDepartments.every(selectedDept => 
        employeeDepartments.includes(selectedDept)
      );
    });

    const departmentTitles = selectedExportDepartments.join("_");
    const filename = `Faculty_Members_${departmentTitles}`;

    exportToExcel(dataToExport, filename, `Mixed_Departments_${departmentTitles}`);
    setExportModalVisible(false);
    setSelectedExportDepartments([]);
    message.success(`Exported data for departments: ${selectedExportDepartments.join(" + ")}`);
  };

  const handleExportToExcel = (category?: string, categoryValue?: string) => {
    // Export only the currently visible table rows (filteredData)
    const enhancedData = filteredData.map((employee) => {
      const isValidHireDate = employee.hireDate && dayjs(employee.hireDate).isValid();

      const getDepartmentName = (deptId: number | null | undefined) => {
        if (!deptId) return "N/A";
        return departments.find((d) => d.departmentID === deptId)?.departmentName || "N/A";
      };

      return {
        ...employee,
        formattedId: isValidHireDate
          ? formatEmployeeId(employee.employeeID, employee.hireDate)
          : "Invalid-Date",
        departmentName: shouldHaveDepartment(employee.positionID)
          ? getDepartmentName(employee.departmentID)
          : "N/A",
        departmentName2: shouldHaveDepartment(employee.positionID)
          ? getDepartmentName(employee.departmentID2)
          : "N/A",
        departmentName3: shouldHaveDepartment(employee.positionID)
          ? getDepartmentName(employee.departmentID3)
          : "N/A",
        positionName:
          positions.find((p) => p.positionID === employee.positionID)
            ?.positionName || "N/A",
        educationalAttainmentName:
          educationalAttainments.find((a) => a.educationalAttainmentID === employee.educationalAttainment)
            ?.attainmentName || "N/A",
        employmentStatusName:
          employmentStatuses.find((s) => s.employmentStatusID === employee.employmentStatus)
            ?.statusName || "N/A",
        gender: employee.gender || "N/A",
      };
    });

    let dataToExport = enhancedData;
    let filename = "Faculty_Members";

    if (category && categoryValue) {
      dataToExport = enhancedData.filter(
        (employee) =>
          employee[category as keyof typeof employee]?.toString() ===
          categoryValue
      );
      filename = `Faculty_Members_${categoryValue.replace(/\s+/g, "_")}`;
    }

    exportToExcel(dataToExport, filename, categoryValue);
    message.success(`Data exported successfully!`);
  };

  // Employment History Functions from FacultyPage1.tsx
  const handleSaveEmploymentHistory = async () => {
    // Permission guard: only Admin, HR, or Coordinator can modify employment history
    if (!(isAdmin || isHR || isCoordinator)) {
      message.warning("You don't have permission to modify employment details");
      setEmploymentHistoryModalVisible(false);
      return;
    }
    try {
      const values = await employmentHistoryForm.validateFields();
      const newEntry = {
        departmentID: values.departmentID ?? null,
        positionID: values.positionID ?? null,
        category: values.category ?? null,
        dateStarted: values.dateStarted ? dayjs(values.dateStarted).format('YYYY-MM-DD') : null,
      };
      if (editingHistoryIndex !== null) {
        // Update existing entry and update selectedEmployeeDetails to match latest history entry
        setEmploymentHistoryList(prev => {
          const updated = prev.map((e, i) => i === editingHistoryIndex ? newEntry : e);
          const last = updated.length ? updated[updated.length - 1] : null;
          setSelectedEmployeeDetails(curr => {
            if (!curr) return curr;
            return {
              ...curr,
              departmentID: last?.departmentID ?? curr.departmentID,
              positionID: last?.positionID ?? curr.positionID,
            } as Employee;
          });
          // persist updated history to localStorage
          if (selectedEmployeeDetails?.employeeID) {
            try {
              localStorage.setItem(
                `employmentHistory_${selectedEmployeeDetails.employeeID}`,
                JSON.stringify(updated)
              );
            } catch (e) {
              console.warn('Failed to persist employment history', e);
            }
          }
          return updated;
        });
      } else {
        // Add new entry and set selectedEmployeeDetails to the new last entry
        setEmploymentHistoryList(prev => {
          const updated = [...prev, newEntry];
          const last = updated.length ? updated[updated.length - 1] : null;
          setSelectedEmployeeDetails(curr => {
            if (!curr) return curr;
            return {
              ...curr,
              departmentID: last?.departmentID ?? curr.departmentID,
              positionID: last?.positionID ?? curr.positionID,
            } as Employee;
          });
          // persist updated history to localStorage
          if (selectedEmployeeDetails?.employeeID) {
            try {
              localStorage.setItem(
                `employmentHistory_${selectedEmployeeDetails.employeeID}`,
                JSON.stringify(updated)
              );
            } catch (e) {
                console.warn('Failed to persist employment history', e);
              }
            }
            return updated;
          });
        }
        // Update selectedEmployeeDetails to show the latest employment information
        setSelectedEmployeeDetails(prev => {
          if (!prev) return prev;
          const updated = {
            ...prev,
            departmentID: newEntry.departmentID ?? prev.departmentID,
            positionID: newEntry.positionID ?? prev.positionID,
            // DO NOT update hireDate here; hireDate remains the original hire date in Basic Information
          } as Employee;
          // Also update facultyData state so the list shows the updated values
          setFacultyData(existing => existing.map(emp => emp.employeeID === updated.employeeID ? updated : emp));
          return updated;
        });
        setEmploymentHistoryModalVisible(false);
        setEditingHistoryIndex(null);
        employmentHistoryForm.resetFields();
        message.success(editingHistoryIndex !== null ? 'Employment Details entry updated' : 'Employment Details entry added');
      } catch (err) {
        // validation errors
      }
    };

    // Persist employmentHistoryList to localStorage whenever it changes and we have a selected employee
    useEffect(() => {
      if (!selectedEmployeeDetails?.employeeID) return;
      try {
        localStorage.setItem(
          `employmentHistory_${selectedEmployeeDetails.employeeID}`,
          JSON.stringify(employmentHistoryList)
        );
      } catch (e) {
        console.warn('Failed to persist employment history', e);
      }
    }, [employmentHistoryList, selectedEmployeeDetails?.employeeID]);

    // Helper to find latest non-null dateStarted in employmentHistoryList
    const getLatestHistoryDate = () => {
      for (let i = employmentHistoryList.length - 1; i >= 0; i--) {
        const d = employmentHistoryList[i].dateStarted;
        if (d) return d;
      }
      return selectedEmployeeDetails?.hireDate ?? null;
    };

    useEffect(() => {
      const fetchData = async () => {
        try {
          setLoading(true);
          setError(null);

          const [allEmployees, depts, pos, attainments, statuses] = await Promise.all([
            EmployeeService.getAll(),
            DepartmentService.getAll(),
            PositionService.getAll(),
            EducationalAttainmentService.getAll(),
            EmploymentStatusService.getAll(),
          ]);

          let employees = allEmployees;
          let coordinatorDeptId: number | null = null;

          // Filter based on user role
          if (isAdmin || isHR) {
            // Admin and HR can see all employees
            employees = allEmployees;
          } else if (isCoordinator) {
            // Get coordinator's department from their employee record
            if (user?.employeeId) {
              // Look up coordinator's employee record from the already-fetched allEmployees array
              const coordinatorEmployee = allEmployees.find(
                (e) => e.employeeID === user.employeeId
              );
              coordinatorDeptId = coordinatorEmployee?.departmentID ?? null;
              setCoordinatorDepartmentId(coordinatorDeptId);

              if (coordinatorDeptId) {
                // Filter employees to show those in coordinator's primary, secondary, OR tertiary department
                employees = allEmployees.filter(
                  (emp) => 
                    emp.departmentID === coordinatorDeptId ||
                    emp.departmentID2 === coordinatorDeptId ||
                    emp.departmentID3 === coordinatorDeptId
                );
                message.info(`Showing employees from your assigned departments`);
              } else {
                employees = [];
                message.warning("No department assigned to your account");
              }
            } else {
              employees = [];
              message.warning("No employee ID found for coordinator");
            }
          } else {
            // Regular users can only see their own profile
            employees = allEmployees.filter(
              (emp) => emp.employeeID === (user?.employeeId || 0)
            );
          }

          setFacultyData(employees);
          setDepartments(depts);
          setPositions(pos);
          setEducationalAttainments(attainments);
          setEmploymentStatuses(statuses);
        } catch (error) {
          setError("Failed to fetch data");
          message.error("Failed to fetch data");
          console.error("Error fetching faculty data:", error);
        } finally {
          setLoading(false);
        }
      };

      fetchData();
    }, [isAdmin, isCoordinator, isHR, user?.employeeId]);

    // Watch for position changes to handle department logic
      const watchedPositionID = Form.useWatch('positionID', form);
    
      useEffect(() => {
        // When the watched position changes, clear department if not applicable and re-validate
        if (watchedPositionID !== undefined) {
          if (!shouldHaveDepartment(watchedPositionID)) {
            // Clear department if position shouldn't have one
            form.setFieldsValue({ departmentID: null });
          }
          // Force re-validation of department field (ignore validation errors here)
          form.validateFields(['departmentID']).catch(() => {});
        }
      }, [watchedPositionID, form, positions]);

    const handleCreate = () => {
      if (!isAdmin && !isHR) {
        message.warning("You don't have permission to add new faculty members");
        return;
      }

      form.resetFields();
      
      // Set default values
      const defaultEmploymentStatus = employmentStatuses.find(s => s.statusName === "Hired");
      
      form.setFieldsValue({
        employmentStatus: defaultEmploymentStatus ? defaultEmploymentStatus.employmentStatusID : null,
        hireDate: dayjs(),
        gender: "Male",
        memberGender: "Male",
      });
      setEditingId(null);
      setSelectedEmployee(null);
      setIsModalVisible(true);
    };

    const handleEdit = (record: Employee) => {
      if (!isAdmin && !isHR && record.employeeID !== user?.employeeId) {
        message.warning("You can only edit your own profile");
        return;
      }

      // Check if this position should have department
      const hasDepartment = shouldHaveDepartment(record.positionID);

      form.setFieldsValue({
        employeeID: record.employeeID,
        firstName: record.firstName,
        middleName: record.middleName,
        lastName: record.lastName,
        gender: record.gender || "Male",
        dateOfBirth: record.dateOfBirth ? dayjs(record.dateOfBirth) : null,
        email: record.email,
        phoneNumber: record.phoneNumber,
        address: record.address,
        departmentID: hasDepartment && record.departmentID ? Number(record.departmentID) : null,
        departmentID2: hasDepartment && record.departmentID2 ? Number(record.departmentID2) : null,
        departmentID3: hasDepartment && record.departmentID3 ? Number(record.departmentID3) : null,
        positionID: record.positionID ? Number(record.positionID) : null,
        educationalAttainment: record.educationalAttainment ? Number(record.educationalAttainment) : null,
        employmentStatus: record.employmentStatus ? Number(record.employmentStatus) : null,
        hireDate: record.hireDate ? dayjs(record.hireDate) : null,

        // Family member fields
        memberFirstName: record.memberFirstName,
        memberLastName: record.memberLastName,
        memberGender: record.memberGender || "Male",
        memberAddress: record.memberAddress,
        memberPhoneNumber: record.memberPhoneNumber,
        // Educational Attainment
        institutionName: record.institutionName,
        yearGraduated: record.yearGraduated ? dayjs(record.yearGraduated) : null,
        courseName: record.courseName,
        // Work Experience
        previousPosition: record.previousPosition,
        officeName: record.officeName,
        durationStart: record.durationStart ? dayjs(record.durationStart) : null,
        durationEnd: record.durationEnd ? dayjs(record.durationEnd) : null,
        agencyName: record.agencyName,
        supervisor: record.supervisor,
        accomplishment: record.accomplishment,
        summary: record.summary,
      });
      setEditingId(record.employeeID || null);
      setSelectedEmployee(record);
      setIsModalVisible(true);
    };

    const handleDelete = async (id: number) => {
      if (!isAdmin && !isHR) {
        message.warning("You don't have permission to delete faculty members");
        return;
      }

      try {
        setLoading(true);
        await EmployeeService.delete(id);
        setFacultyData(facultyData.filter((item) => item.employeeID !== id));
        message.success("Faculty member deleted successfully");
      } catch (err) {
        message.error("Failed to delete faculty member");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

const handleFormFinish = async (values: any) => {
  setFormValues(values);
  if (editingId) {
    // Show popconfirm for updates
    setSubmitPopconfirmVisible(true);
  } else {
    // Direct submit for creates
    handleSubmit(values);
  }
};

const handleSubmit = async (values: any) => {
  try {
    setLoading(true);

    const positionId = Number(values.positionID);
    const hasDepartment = shouldHaveDepartment(positionId);

    const formattedValues = {
      ...values,
      dateOfBirth: values.dateOfBirth
        ? dayjs(values.dateOfBirth).format("YYYY-MM-DD")
        : undefined,
      hireDate: values.hireDate
        ? dayjs(values.hireDate).format("YYYY-MM-DD")
        : undefined,
      // Department fields - only primary is required when applicable
      departmentID: hasDepartment ? Number(values.departmentID) : null,
      departmentID2: hasDepartment && values.departmentID2 ? Number(values.departmentID2) : null,
      departmentID3: hasDepartment && values.departmentID3 ? Number(values.departmentID3) : null,
      positionID: positionId,
      educationalAttainment: values.educationalAttainment ? Number(values.educationalAttainment) : null,
      employmentStatus: values.employmentStatus ? Number(values.employmentStatus) : null,
      yearGraduated: values.yearGraduated
        ? dayjs(values.yearGraduated).format("YYYY-MM-DD")
        : null,
      durationStart: values.durationStart
        ? dayjs(values.durationStart).format("YYYY-MM-DD")
        : null,
      durationEnd: values.durationEnd
        ? dayjs(values.durationEnd).format("YYYY-MM-DD")
        : null,
    };

    if (editingId) {
      // Check user role - Admin/HR can update directly, others submit for approval
      if (isAdmin || isHR) {
        // Direct update for Admin/HR
        const updatedEmployee = await EmployeeService.update(
          editingId,
          formattedValues
        );
        setFacultyData(
          facultyData.map((item) =>
            item.employeeID === editingId ? updatedEmployee : item
          )
        );
        // Update selected details if currently viewing this employee
        setSelectedEmployeeDetails(prev => prev && prev.employeeID === updatedEmployee.employeeID ? updatedEmployee : prev);

        // Always ensure employment history in localStorage reflects the updated basic info
        try {
          const storageKey = `employmentHistory_${updatedEmployee.employeeID}`;
          const stored = localStorage.getItem(storageKey);
          let histories: any[] = [];
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) histories = parsed;
          }

          const latestEntry = {
            departmentID: updatedEmployee.departmentID ?? null,
            positionID: updatedEmployee.positionID ?? null,
            category: shouldHaveDepartment(updatedEmployee.positionID) ? 'Teaching' : 'Non-Teaching',
            dateStarted: updatedEmployee.hireDate ?? null,
          };

          const last = histories.length ? histories[histories.length - 1] : null;
          const changed = !last || last.departmentID !== latestEntry.departmentID || last.positionID !== latestEntry.positionID || last.dateStarted !== latestEntry.dateStarted;
          if (changed) {
            histories = [...histories, latestEntry];
          }

          // Persist back (even if unchanged to ensure key exists)
          try {
            localStorage.setItem(storageKey, JSON.stringify(histories));
          } catch (e) {
            console.warn('Failed to persist employment history after update', e);
          }

          // Update in-memory list if details modal is open for this employee
          if (selectedEmployeeDetails && selectedEmployeeDetails.employeeID === updatedEmployee.employeeID) {
            setEmploymentHistoryList(histories);
          }
        } catch (e) {
          console.warn('Failed to sync employment history after update', e);
        }
        
        message.success("Faculty updated successfully");
      } else {
        // Regular user: Submit update request for approval
        
        // Remove employeeID from update data for storage
        const { employeeID, ...updateData } = formattedValues;
        
        // Get current employee data for comparison
        const currentEmployee = facultyData.find(emp => emp.employeeID === editingId);
        
        if (currentEmployee) {
          // Create original data object with only changed fields
          const originalData: any = {};
          Object.keys(updateData).forEach(key => {
            if (updateData[key as keyof typeof updateData] !== undefined) {
              originalData[key] = currentEmployee[key as keyof typeof currentEmployee];
            }
          });

          // Submit update request to localStorage
          EmployeeService.submitUpdateRequest(editingId, updateData, originalData);
          
          // Show notification to user
          message.success({
            content: (
              <div>
                <p>Update request submitted for approval.</p>
                <p style={{ fontSize: '12px', color: '#666' }}>
                  Your changes will be reviewed by HR/Admin. You'll be notified once approved or rejected.
                </p>
              </div>
            ),
            duration: 5,
          });
        }
      }
      
      // Clear form and close modal
      setIsModalVisible(false);
      setSubmitPopconfirmVisible(false);
      form.resetFields();
      setSelectedEmployee(null);
      setFormValues(null);
      
    } else {
      // Creating new employee - Admin/HR only (should already be checked in handleFormFinish)
      const { employeeID, ...employeeDataWithoutId } = formattedValues;
      const newEmployee = await EmployeeService.create(employeeDataWithoutId);
      setFacultyData([...facultyData, newEmployee]);
      message.success("Faculty added successfully");
      
      // No automatic employment history recording during create; employment history is managed manually via the Employment History tab.
    }

  } catch (err) {
    console.error("Error in handleSubmit:", err);
    message.error("Operation failed. Please check the form and try again.");
    setSubmitPopconfirmVisible(false);
  } finally {
    setLoading(false);
  }
};

const handleConfirmUpdate = () => {
  if (formValues) {
    handleSubmit(formValues);
  }
  setSubmitPopconfirmVisible(false); // Close popconfirm immediately
};

const handleCancelUpdate = () => {
  setSubmitPopconfirmVisible(false);
  setFormValues(null);
};

    const handleSubmitUserAccount = async () => {
    try {
      const values = await userForm.validateFields();
      setLoading(true);

      // Prepare user data with all required fields including email
      const userData: tblUsersTypes = {
        firstName: selectedEmployee?.firstName || '',
        middleName: selectedEmployee?.middleName || '',
        lastName: selectedEmployee?.lastName || '',
        username: values.username,
        newPassword: values.newPassword,
        roleId: values.roleId,
        employeeId: selectedEmployee?.employeeID || null,
        email: selectedEmployee?.email || '' // Make sure this is included
      };

      console.log('Creating user with data:', userData); // For debugging

      await UserService.createUserForEmployee(userData);
      
      message.success("User account created successfully and credentials sent via email");
      setIsUserModalVisible(false);
      userForm.resetFields();
      setSelectedEmployee(null);
    } catch (err: any) {
      console.error('Error creating user account:', err);
      message.error(err.message || "Failed to create user account");
    } finally {
      setLoading(false);
    }
  };

    const handleViewDetails = (record: Employee) => {
      setSelectedEmployeeDetails(record);
      // Try to load persisted employment history from localStorage (keyed by employeeID)
      const storageKey = `employmentHistory_${record.employeeID}`;
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setEmploymentHistoryList(parsed);
          } else {
            setEmploymentHistoryList([]);
          }
        } else {
          // Initialize employment history list from available fields if present, otherwise reset
          const initialHistory: Array<any> = [];
          // If a hireDate/position/department exists, add as an initial history record
          if (record.hireDate || record.positionID || record.departmentID) {
            initialHistory.push({
              departmentID: record.departmentID ?? null,
              positionID: record.positionID ?? null,
              category: shouldHaveDepartment(record.positionID) ? 'Teaching' : 'Non-Teaching',
              dateStarted: record.hireDate ?? null,
            });
          }
          // Include previousPosition/durationStart as an extra record if present
          if (record.previousPosition || record.durationStart) {
            initialHistory.push({
              positionID: undefined,
              departmentID: undefined,
              category: undefined,
              dateStarted: record.durationStart ?? null,
              previousPosition: record.previousPosition ?? undefined,
            });
          }
          setEmploymentHistoryList(initialHistory);
        }
      } catch (e) {
        console.warn('Failed to load employment history from storage', e);
        setEmploymentHistoryList([]);
      }
      // Anniversary notification: notify once per distinct years-of-service value
      try {
        const statusName = employmentStatuses.find((s) => s.employmentStatusID === record.employmentStatus)?.statusName || "";
        if (statusName.toLowerCase() === "hired" && record.hireDate) {
          const years = dayjs().diff(dayjs(record.hireDate), 'year');
          if (years >= 1) {
            const storageKey = `anniv_notified_${record.employeeID}`;
            const lastNotified = localStorage.getItem(storageKey);
            const lastNotifiedNum = lastNotified ? parseInt(lastNotified, 10) : null;
            if (lastNotifiedNum !== years) {
              message.info(`${record.firstName} ${record.lastName} has reached ${years} year${years > 1 ? 's' : ''} of service.`);
              try {
                localStorage.setItem(storageKey, String(years));
              } catch (e) {
                console.warn('Failed to persist anniversary notification', e);
              }
            }
          }
        }
      } catch (e) {
        console.warn('Anniversary notification error', e);
      }

      setDetailModalVisible(true);
    };

    // Apply filters to data
    const filteredData = facultyData.filter((record) => {
      // Name search filter (search in first, middle, and last name)
      const fullName = `${record.firstName || ""} ${record.middleName || ""} ${record.lastName || ""}`.trim();
      const nameMatchSearch =
        searchText === "" ||
        (fullName || "").toLowerCase().includes(searchText.toLowerCase());
      const nameMatchFilter = nameFilter === "" || (fullName || "").toLowerCase().includes(nameFilter.toLowerCase());
      const nameMatch = nameMatchSearch && nameMatchFilter;

      // Employee ID filter
      const formattedId = formatEmployeeId(record.employeeID, record.hireDate).toString();
      const employeeIdMatch = employeeIdFilter === "" || formattedId.toLowerCase().includes(employeeIdFilter.toLowerCase());

      const firstNameMatch = firstNameFilter === "" || (record.firstName || "").toLowerCase().includes(firstNameFilter.toLowerCase());
      const middleNameMatch = middleNameFilter === "" || (record.middleName || "").toLowerCase().includes(middleNameFilter.toLowerCase());
      const lastNameMatch = lastNameFilter === "" || (record.lastName || "").toLowerCase().includes(lastNameFilter.toLowerCase());
      const emailMatch = emailFilter === "" || (record.email || "").toLowerCase().includes(emailFilter.toLowerCase());

      // Gender filter
      const genderMatch = 
        genderFilter === "" || 
        record.gender === genderFilter;

      // Department filter - check primary, secondary, and tertiary departments
      const departmentMatch = 
        departmentFilter === "" || 
        (shouldHaveDepartment(record.positionID)
          ? departments.find((d) => d.departmentID === record.departmentID)?.departmentName === departmentFilter ||
            departments.find((d) => d.departmentID === record.departmentID2)?.departmentName === departmentFilter ||
            departments.find((d) => d.departmentID === record.departmentID3)?.departmentName === departmentFilter
          : "N/A" === departmentFilter);

      // Position filter
      const positionMatch = 
        positionFilter === "" || 
        positions.find((p) => p.positionID === record.positionID)?.positionName === positionFilter;

      // Status filter
      const statusMatch = 
        statusFilter === "" || 
        employmentStatuses.find((s) => s.employmentStatusID === record.employmentStatus)?.statusName === statusFilter;

      // Date range filter
      const dateMatch = !dateRange || !dateRange[0] || !dateRange[1] || !record.hireDate
        ? true
        : dayjs(record.hireDate).isBetween(dateRange[0], dateRange[1], 'day', '[]');

    return nameMatch && employeeIdMatch && firstNameMatch && middleNameMatch && lastNameMatch && emailMatch && genderMatch && departmentMatch && positionMatch && statusMatch && dateMatch;
    });

    // Clear all filters
    const clearAllFilters = () => {
      setGenderFilter("");
      setDepartmentFilter("");
      setPositionFilter("");
      setStatusFilter("");
      setSearchText("");
      setDateRange(null);
    };

    const columns: ColumnsType<Employee> = [
      {
        title: "Employee ID",
        dataIndex: "employeeID",
        key: "employeeID",
        responsive: ["sm"],
        render: (id: number, record: Employee) => (
          <span className="employee-id">
            {formatEmployeeId(id, record.hireDate)}
          </span>
        ),
        ...(canFilter
          ? {
              filterDropdown: ({ confirm }: any) => (
                <div style={{ padding: 8 }}>
                  <Input
                    placeholder="Search Employee ID"
                    value={employeeIdFilter}
                    onChange={(e) => setEmployeeIdFilter(e.target.value)}
                    style={{ width: 180, marginBottom: 8, display: 'block' }}
                  />
                  <Space>
                    <Button
                      type="link"
                      size="small"
                      onClick={() => {
                        setEmployeeIdFilter("");
                        confirm();
                      }}
                    >
                      Reset
                    </Button>
                    <Button
                      type="primary"
                      size="small"
                      onClick={() => confirm()}
                    >
                      OK
                    </Button>
                  </Space>
                </div>
              ),
              filtered: !!employeeIdFilter,
            }
          : {}),
      },
      {
        title: "Name",
        key: "name",
        responsive: ["xs", "sm"],
        render: (_, record) => (
          <div className="name-cell">
            <div className="name-line">{record.firstName}</div>
            <div className="name-line">{record.middleName}</div>
            <div className="name-line">{record.lastName}</div>
          </div>
        ),
        ...(canFilter
          ? {
              filterDropdown: ({ confirm }: any) => (
                <div style={{ padding: 8 }}>
                  <Input
                    placeholder="Search Name"
                    value={nameFilter}
                    onChange={(e) => setNameFilter(e.target.value)}
                    style={{ width: 220, marginBottom: 8, display: 'block' }}
                  />
                  <Space>
                    <Button
                      type="link"
                      size="small"
                      onClick={() => {
                        setNameFilter("");
                        confirm();
                      }}
                    >
                      Reset
                    </Button>
                    <Button
                      type="primary"
                      size="small"
                      onClick={() => confirm()}
                    >
                      OK
                    </Button>
                  </Space>
                </div>
              ),
              filtered: !!nameFilter,
            }
          : {}),
      },
      {
        title: "First Name",
        dataIndex: "firstName",
        key: "firstName",
        responsive: ["md"],
        ...(canFilter
          ? {
              filterDropdown: ({ confirm }: any) => (
                <div style={{ padding: 8 }}>
                  <Input
                    placeholder="Search first name"
                    value={firstNameFilter}
                    onChange={(e) => setFirstNameFilter(e.target.value)}
                    style={{ width: 180, marginBottom: 8, display: 'block' }}
                  />
                  <Space>
                    <Button
                      type="link"
                      size="small"
                      onClick={() => {
                        setFirstNameFilter("");
                        confirm();
                      }}
                    >
                      Reset
                    </Button>
                    <Button
                      type="primary"
                      size="small"
                      onClick={() => confirm()}
                    >
                      OK
                    </Button>
                  </Space>
                </div>
              ),
              filtered: !!firstNameFilter,
            }
          : {}),
      },
      {
        title: "Middle Name",
        dataIndex: "middleName",
        key: "middleName",
        responsive: ["md"],
        ...(canFilter
          ? {
              filterDropdown: ({ confirm }: any) => (
                <div style={{ padding: 8 }}>
                  <Input
                    placeholder="Search middle name"
                    value={middleNameFilter}
                    onChange={(e) => setMiddleNameFilter(e.target.value)}
                    style={{ width: 180, marginBottom: 8, display: 'block' }}
                  />
                  <Space>
                    <Button
                      type="link"
                      size="small"
                      onClick={() => {
                        setMiddleNameFilter("");
                        confirm();
                      }}
                    >
                      Reset
                    </Button>
                    <Button
                      type="primary"
                      size="small"
                      onClick={() => confirm()}
                    >
                      OK
                    </Button>
                  </Space>
                </div>
              ),
              filtered: !!middleNameFilter,
            }
          : {}),
      },
      {
        title: "Last Name",
        dataIndex: "lastName",
        key: "lastName",
        responsive: ["md"],
        ...(canFilter
          ? {
              filterDropdown: ({ confirm }: any) => (
                <div style={{ padding: 8 }}>
                  <Input
                    placeholder="Search last name"
                    value={lastNameFilter}
                    onChange={(e) => setLastNameFilter(e.target.value)}
                    style={{ width: 180, marginBottom: 8, display: 'block' }}
                  />
                  <Space>
                    <Button
                      type="link"
                      size="small"
                      onClick={() => {
                        setLastNameFilter("");
                        confirm();
                      }}
                    >
                      Reset
                    </Button>
                    <Button
                      type="primary"
                      size="small"
                      onClick={() => confirm()}
                    >
                      OK
                    </Button>
                  </Space>
                </div>
              ),
              filtered: !!lastNameFilter,
            }
          : {}),
      },
      {
        title: "Gender",
        dataIndex: ["gender"],
        key: "gender",
        responsive: ["sm"],
        ...(canFilter
          ? {
              filters: [
                { text: "Male", value: "Male" },
                { text: "Female", value: "Female" },
                { text: "Other", value: "Other" },
              ],
              onFilter: (value: any, record: Employee) => record.gender === value,
              filterDropdown: ({ confirm }: any) => (
                <div style={{ padding: 8 }}>
                  <Select
                    placeholder="Select gender"
                    value={genderFilter}
                    onChange={(value) => setGenderFilter(value)}
                    style={{ width: 120, marginBottom: 8, display: 'block' }}
                    allowClear
                  >
                    <Option value="Male">Male</Option>
                    <Option value="Female">Female</Option>
                    <Option value="Other">Other</Option>
                  </Select>
                  <Space>
                    <Button
                      type="link"
                      size="small"
                      onClick={() => {
                        setGenderFilter("");
                        confirm();
                      }}
                    >
                      Reset
                    </Button>
                  </Space>
                </div>
              ),
            }
          : {}),
      },
      {
        title: "Department",
        dataIndex: "departmentID",
        key: "departmentID",
        responsive: ["sm"],
        render: (deptId, record) => {
          if (!shouldHaveDepartment(record.positionID)) {
            return "N/A";
          }
          
          const primaryDept = departments.find((d) => d.departmentID === deptId)?.departmentName;
          const secondaryDept = departments.find((d) => d.departmentID === record.departmentID2)?.departmentName;
          const tertiaryDept = departments.find((d) => d.departmentID === record.departmentID3)?.departmentName;
          
          let displayText = primaryDept || deptId;
          
          // Add secondary and tertiary departments if they exist
          if (secondaryDept) {
            displayText += `, ${secondaryDept}`;
          }
          if (tertiaryDept) {
            displayText += `, ${tertiaryDept}`;
          }
          
          return displayText;
        },
        ...(canFilter
          ? {
              filters: [
                ...departments
                  .filter((dept) => !!dept.departmentName)
                  .map((dept) => ({
                    text: String(dept.departmentName),
                    value: String(dept.departmentName),
                  })),
                { text: "N/A", value: "N/A" },
              ],
              onFilter: (value: any, record: Employee) => {
                if (value === "N/A") return !shouldHaveDepartment(record.positionID);
                const primaryDeptName = departments.find((d) => d.departmentID === record.departmentID)?.departmentName;
                const secondaryDeptName = departments.find((d) => d.departmentID === record.departmentID2)?.departmentName;
                const tertiaryDeptName = departments.find((d) => d.departmentID === record.departmentID3)?.departmentName;
                return primaryDeptName === value || secondaryDeptName === value || tertiaryDeptName === value;
              },
              filterDropdown: ({ confirm }: any) => (
                <div style={{ padding: 8 }}>
                  <Select
                    placeholder="Select department"
                    value={departmentFilter}
                    onChange={(value) => setDepartmentFilter(value)}
                    style={{ width: 150, marginBottom: 8, display: 'block' }}
                    allowClear
                    disabled={isCoordinator}
                  >
                    {departments.map((dept) => (
                      <Option key={dept.departmentID} value={dept.departmentName}>
                        {dept.departmentName}
                      </Option>
                    ))}
                    <Option value="N/A">N/A</Option>
                  </Select>
                  <Space>
                    <Button
                      type="link"
                      size="small"
                      onClick={() => {
                        setDepartmentFilter("");
                        confirm();
                      }}
                    >
                      Reset
                    </Button>
                  </Space>
                </div>
              ),
            }
          : {}),
      },
      {
        title: "Position",
        dataIndex: ["positionID"],
        key: "positionID",
        responsive: ["sm"],
        render: (positionId) => {
          return (
            positions.find((p) => p.positionID === positionId)?.positionName ||
            positionId
          );
        },
        ...(canFilter
          ? {
              filters: positions
                .filter((pos) => !!pos.positionName)
                .map((pos) => ({ text: String(pos.positionName), value: String(pos.positionName) })),
              onFilter: (value: any, record: Employee) => {
                const posName = positions.find((p) => p.positionID === record.positionID)?.positionName;
                return posName === value;
              },
              filterDropdown: ({ confirm }: any) => (
                <div style={{ padding: 8 }}>
                  <Select
                    placeholder="Select position"
                    value={positionFilter}
                    onChange={(value) => setPositionFilter(value)}
                    style={{ width: 150, marginBottom: 8, display: 'block' }}
                    allowClear
                  >
                    {positions.map((pos) => (
                      <Option key={pos.positionID} value={pos.positionName}>
                        {pos.positionName}
                      </Option>
                    ))}
                  </Select>
                  <Space>
                    <Button
                      type="link"
                      size="small"
                      onClick={() => {
                        setPositionFilter("");
                        confirm();
                      }}
                    >
                      Reset
                    </Button>
                  </Space>
                </div>
              ),
            }
          : {}),
      },
      {
        title: "Email",
        dataIndex: "email",
        key: "email",
        responsive: ["md"],
        render: (email) => (
          <span className="email-cell">
            {screens.md ? email : `${email.substring(0, 10)}...`}
          </span>
        ),
        ...(canFilter
          ? {
              filterDropdown: ({ confirm }: any) => (
                <div style={{ padding: 8 }}>
                  <Input
                    placeholder="Search email"
                    value={emailFilter}
                    onChange={(e) => setEmailFilter(e.target.value)}
                    style={{ width: 200, marginBottom: 8, display: 'block' }}
                  />
                  <Space>
                    <Button
                      type="link"
                      size="small"
                      onClick={() => {
                        setEmailFilter("");
                        confirm();
                      }}
                    >
                      Reset
                    </Button>
                    <Button type="primary" size="small" onClick={() => confirm()}>OK</Button>
                  </Space>
                </div>
              ),
              filtered: !!emailFilter,
            }
          : {}),
      },
      {
        title: "Status",
        dataIndex: "employmentStatus",
        key: "employmentStatus",
        responsive: ["sm"],
        render: (statusId) => {
          const status = employmentStatuses.find(s => s.employmentStatusID === statusId);
          return status?.statusName || "N/A";
        },
        ...(canFilter
          ? {
              filters: employmentStatuses
                .filter((status) => !!status.statusName)
                .map((status) => ({ text: String(status.statusName), value: String(status.statusName) })),
              onFilter: (value: any, record: Employee) => {
                const statusName = employmentStatuses.find((s) => s.employmentStatusID === record.employmentStatus)?.statusName;
                return statusName === value;
              },
              filterDropdown: ({ confirm }: any) => (
                <div style={{ padding: 8 }}>
                  <Select
                    placeholder="Select status"
                    value={statusFilter}
                    onChange={(value) => setStatusFilter(value)}
                    style={{ width: 150, marginBottom: 8, display: 'block' }}
                    allowClear
                  >
                    {employmentStatuses.map((status) => (
                      <Option key={status.employmentStatusID} value={status.statusName}>
                        {status.statusName}
                      </Option>
                    ))}
                  </Select>
                  <Space>
                    <Button
                      type="link"
                      size="small"
                      onClick={() => {
                        setStatusFilter("");
                        confirm();
                      }}
                    >
                      Reset
                    </Button>
                  </Space>
                </div>
              ),
            }
          : {}),
      },
      {
        title: "Hire Date",
        dataIndex: "hireDate",
        key: "hireDate",
        responsive: ["md"],
        render: (date) =>
          dayjs(date).format(screens.md ? "YYYY-MM-DD" : "YY-MM-DD"),
        ...(canFilter
          ? {
              filterDropdown: ({ confirm }: any) => (
                <div style={{ padding: 8 }}>
                  <RangePicker
                    value={dateRange}
                    onChange={(dates) => setDateRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null] | null)}
                    style={{ marginBottom: 8, display: 'block' }}
                    format="YYYY-MM-DD"
                  />
                  <Space>
                    <Button
                      type="link"
                      size="small"
                      onClick={() => {
                        setDateRange(null);
                        confirm();
                      }}
                    >
                      Reset
                    </Button>
                    <Button
                      type="primary"
                      size="small"
                      onClick={() => confirm()}
                    >
                      OK
                    </Button>
                  </Space>
                </div>
              ),
            }
          : {}),
        filtered: !!dateRange && !!dateRange[0] && !!dateRange[1],
      },
      {
        title: "Actions",
        key: "actions",
        className: "actions-column",
        render: (_, record) => (
          <Space size="middle" className="actions-space">
            {(isAdmin || isHR || record.employeeID === user?.employeeId) && (
              <Button
                type="link"
                icon={<EditOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  handleEdit(record);
                }}
                className="action-button"
                aria-label="Edit"
              />
            )}
            {(isAdmin || isHR) && (
              <>
                <Button
                  type="link"
                  icon={<UserOutlined />}
                  onClick={(e) => handleAddUserAccount(record, e)}
                  className="action-button"
                  aria-label="Add User Account"
                  title="Add User Account"
                />
                <Popconfirm
                  title="Are you sure to delete this faculty member?"
                  onConfirm={(e) => {
                    if (e) e.stopPropagation();
                    handleDelete(record.employeeID!);
                  }}
                  onCancel={(e) => e?.stopPropagation()}
                  okText="Yes"
                  cancelText="No"
                >
                  <Button
                    type="link"
                    danger
                    icon={<DeleteOutlined />}
                    className="action-button"
                    aria-label="Delete"
                    onClick={(e) => e.stopPropagation()}
                  />
                </Popconfirm>
              </>
            )}
          </Space>
        ),
      },
    ];

    if (loading && facultyData.length === 0) {
      return (
        <Card title="Faculty Members" className="faculty-card">
          <Spin size="large" />
        </Card>
      );
    }

    const cardExtra = (
      <div className="search-add-container">
        <Space>
          {/* Clear Filters Button */}
          {(genderFilter || departmentFilter || positionFilter || statusFilter || searchText || dateRange) && (
            <Button
              icon={<FilterOutlined />}
              onClick={clearAllFilters}
              size={screens.xs ? "small" : "middle"}
              title="Clear all filters"
            >
              {screens.sm ? "Clear Filters" : ""}
            </Button>
          )}
          
    {/* Top-level position filter removed per request; use column filters instead */}

          <Button
            icon={<FileExcelOutlined />}
            type="primary"
            className="export-button"
            size={screens.xs ? "small" : "middle"}
            onClick={() => handleExportToExcel()}
          >
            {screens.sm ? "Export" : ""}
          </Button>

          {(isAdmin || isHR) && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreate}
              className="add-button"
              size={screens.xs ? "small" : "middle"}
            >
              {screens.sm ? "Add Employees" : "Add"}
            </Button>
          )}
        </Space>
      </div>
    );

    return (
      <div className="faculty-page-container" ref={tableRef}>
        <Card 
            title={isAdmin || isHR || isCoordinator ? "Faculty Members" : "My Profile"} 
            className="faculty-card" 
            extra={cardExtra}
          >
          <Table
            columns={columns}
            dataSource={filteredData}
            rowKey="employeeID"
            pagination={{
              pageSize: 10,
              showSizeChanger: !screens.xs,
              size: screens.xs ? "small" : "default",
            }}
            loading={loading}
            scroll={{ x: true }}
            className="faculty-table"
            size={screens.xs ? "small" : "middle"}
            onRow={(record) => {
              return {
                onClick: () => handleViewDetails(record),
              };
            }}
            rowClassName="clickable-row"
          />
        </Card>

        {/* Edit/Create Faculty Modal */}
        <Modal
          title={
            editingId
              ? `Edit Info: ${selectedEmployee?.firstName} ${selectedEmployee?.middleName || ''} ${selectedEmployee?.lastName}`
              : "Add New Faculty Member"
          }
          open={isModalVisible}
          onCancel={() => {
            setIsModalVisible(false);
            setSelectedEmployee(null);
            form.resetFields();
            setSubmitPopconfirmVisible(false);
            setFormValues(null);
          }}
          footer={[
            <Button
              key="cancel"
              onClick={() => {
                setIsModalVisible(false);
                setSelectedEmployee(null);
                form.resetFields();
                setSubmitPopconfirmVisible(false);
                setFormValues(null);
              }}
            >
              Cancel
            </Button>,
            <Popconfirm
              key="popconfirm"
              title="Are you sure you want to update this faculty member?"
              open={submitPopconfirmVisible}
              onConfirm={handleConfirmUpdate}
              onCancel={handleCancelUpdate}
              okText="Yes"
              cancelText="No"
            >
              <span>
                {/* Empty span wrapper for Popconfirm */}
              </span>
            </Popconfirm>,
            <Button
              key="submit"
              type="primary"
              loading={loading}
              onClick={() => {
                if (editingId) {
                  // For updates, show popconfirm
                  form.validateFields().then(values => {
                    setFormValues(values);
                    setSubmitPopconfirmVisible(true);
                  });
                } else {
                  // For creates, submit directly
                  form.submit();
                }
              }}
            >
              {editingId ? "Update" : "Submit"}
            </Button>,
          ]}
          width={screens.xs ? "90%" : "800px"}
          className="faculty-modal"
          destroyOnClose
        >
          <div className="modal-form-container">
            <Form form={form} layout="vertical" requiredMark={false} onFinish={handleFormFinish}>
              <Form.Item name="employeeID" hidden>
                <Input />
              </Form.Item>

              <Divider orientation="left">Personal Information</Divider>

              <div className="form-row">
                <Form.Item
                  name="firstName"
                  label="First Name"
                  rules={[{ required: true, message: "Please enter first name" }]}
                  className="form-item"
                >
                  <Input />
                </Form.Item>

                <Form.Item
                  name="middleName"
                  label="Middle Name"
                  className="form-item"
                >
                  <Input />
                </Form.Item>

                <Form.Item
                  name="lastName"
                  label="Last Name"
                  rules={[{ required: true, message: "Please enter last name" }]}
                  className="form-item"
                >
                  <Input />
                </Form.Item>
              </div>

              <div className="form-row">
                <Form.Item
                  name="gender"
                  label="Gender"
                  rules={[{ required: true, message: "Please select gender" }]}
                  className="form-item"
                >
                  <Select>
                    <Option value="Male">Male</Option>
                    <Option value="Female">Female</Option>
                    <Option value="Other">Other</Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  name="dateOfBirth"
                  label="Date of Birth"
                  rules={[
                    { required: true, message: "Please select date of birth" },
                  ]}
                  className="form-item"
                >
                  <DatePicker style={{ width: "100%" }}/>
                </Form.Item>
              </div>

              <div className="form-row">
                <Form.Item
                  name="email"
                  label="Email"
                  rules={[
                    { required: true, message: "Please enter email" },
                    { type: "email", message: "Please enter a valid email" },
                  ]}
                  className="form-item"
                >
                  <Input />
                </Form.Item>

                <Form.Item
                  name="phoneNumber"
                  label="Phone Number"
                  rules={[
                    { required: true, message: "Please enter phone number" },
                  ]}
                  className="form-item"
                >
                  <Input />
                </Form.Item>
              </div>

              <Form.Item
                name="address"
                label="Address"
                rules={[{ required: true, message: "Please enter address" }]}
              >
                <Input.TextArea rows={2} />
              </Form.Item>

              {/* Employment Information Section */}
              <Divider orientation="left">Employment Information</Divider>

              <div className="form-row">
                <Form.Item
                  name="departmentID"
                  label="Primary Department"
                  rules={[
                    {
                      required: shouldHaveDepartment(form.getFieldValue('positionID')),
                      message: "Please select primary department"
                    }
                  ]}
                  className="form-item"
                >
                  <Select 
                    disabled={!isAdmin && !isHR || !shouldHaveDepartment(form.getFieldValue('positionID'))}
                    placeholder={
                      shouldHaveDepartment(form.getFieldValue('positionID')) 
                        ? "Select Primary Department" 
                        : "Not applicable for this position"
                    }
                  >
                    {departments.map((dept) => (
                      <Option key={dept.departmentID} value={dept.departmentID}>
                        {dept.departmentName}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item
                  name="positionID"
                  label="Position"
                  rules={[{ required: true, message: "Please select position" }]}
                  className="form-item"
                >
                  <Select disabled={!isAdmin && !isHR}>
                    {positions.map((position) => (
                      <Option key={position.positionID} value={position.positionID}>
                        {position.positionName}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </div>

              {/* Additional Departments */}
              <div className="form-row">
                <Form.Item
                  name="departmentID2"
                  label="Secondary Department"
                  className="form-item"
                >
                  <Select 
                    disabled={!isAdmin && !isHR || !shouldHaveDepartment(form.getFieldValue('positionID'))}
                    placeholder={
                      shouldHaveDepartment(form.getFieldValue('positionID')) 
                        ? "Select Secondary Department (Optional)" 
                        : "Not applicable for this position"
                    }
                    allowClear
                  >
                    {departments.map((dept) => (
                      <Option key={dept.departmentID} value={dept.departmentID}>
                        {dept.departmentName}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item
                  name="departmentID3"
                  label="Tertiary Department"
                  className="form-item"
                >
                  <Select 
                    disabled={!isAdmin && !isHR || !shouldHaveDepartment(form.getFieldValue('positionID'))}
                    placeholder={
                      shouldHaveDepartment(form.getFieldValue('positionID')) 
                        ? "Select Tertiary Department (Optional)" 
                        : "Not applicable for this position"
                    }
                    allowClear
                  >
                    {departments.map((dept) => (
                      <Option key={dept.departmentID} value={dept.departmentID}>
                        {dept.departmentName}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </div>

              <div className="form-row">
                <Form.Item
                  name="employmentStatus"
                  label="Employment Status"
                  className="form-item"
                >
                  <Select placeholder="Select Employment Status" disabled={!isAdmin && !isHR}>
                    {employmentStatuses.map((status) => (
                      <Option key={status.employmentStatusID} value={status.employmentStatusID}>
                        {status.statusName}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item
                  name="hireDate"
                  label="Hire Date"
                  className="form-item"
                  rules={[{ required: true, message: "Please select hire date" }]}
                >
                  <DatePicker style={{ width: "100%" }} disabled={!isAdmin && !isHR} />
                </Form.Item>
              </div>

              {/* Show Educational Attainment, Work Experience, and Family Member Information only when editing */}
              {editingId && (
                <>
                  <Divider orientation="left">Educational Attainment</Divider>

                  <div className="form-row">
                    <Form.Item
                      name="educationalAttainment"
                      label="Educational Attainment"
                      className="form-item"
                    >
                      <Select placeholder="Select Educational Attainment">
                        {educationalAttainments.map((attainment) => (
                          <Option key={attainment.educationalAttainmentID} value={attainment.educationalAttainmentID}>
                            {attainment.attainmentName}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>

                    <Form.Item
                      name="yearGraduated"
                      label="Year Graduated"
                      className="form-item"
                    >
                      <DatePicker
                        style={{ width: "100%" }}
                        picker="year"
                        placeholder="Select Year"
                      />
                    </Form.Item>
                  </div>

                  <Form.Item name="courseName" label="Course Name">
                    <Input placeholder="Course Name" />
                  </Form.Item>

                  <Form.Item name="institutionName" label="Institution Name">
                    <Input placeholder="Name of school or institution" />
                  </Form.Item>

                  <Divider orientation="left">Work Experience</Divider>
                  <div className="form-row">
                    <Form.Item
                      name="previousPosition"
                      label="Previous Position"
                      className="form-item"
                    >
                      <Input placeholder="Previous Position" />
                    </Form.Item>

                    <Form.Item
                      name="officeName"
                      label="Office Name"
                      className="form-item"
                    >
                      <Input placeholder="Office Name" />
                    </Form.Item>
                  </div>
                  <div className="form-row">
                    <Form.Item
                      name="durationStart"
                      label="Duration Start"
                      className="form-item"
                    >
                      <DatePicker
                        style={{ width: "100%" }}
                        placeholder="Start Date"
                      />
                    </Form.Item>
                    <Form.Item
                      name="durationEnd"
                      label="Duration End"
                      className="form-item"
                    >
                      <DatePicker style={{ width: "100%" }} placeholder="End Date" />
                    </Form.Item>
                  </div>
                  <Form.Item
                    name="agencyName"
                    label="Agency Name"
                    className="form-item"
                  >
                    <Input placeholder="Agency Name" />
                  </Form.Item>

                  <Form.Item
                    name="supervisor"
                    label="Supervisor"
                    className="form-item"
                  >
                    <Input placeholder="Supervisor" />
                  </Form.Item>
                  <Form.Item
                    name="accomplishment"
                    label="List Of Accomplishment"
                    className="form-item"
                  >
                    <Input.TextArea rows={3} placeholder="Accomplishment" />
                  </Form.Item>

                  <Form.Item
                    name="summary"
                    label="Summary Of Actual Duties and Responsibilities"
                  >
                    <Input.TextArea
                      rows={3}
                      placeholder="Brief Summary of Work Experience"
                    />
                  </Form.Item>

                  <Divider orientation="left">Family Member Information</Divider>

                  <div className="form-row">
                    <Form.Item
                      name="memberFirstName"
                      label="Family Member First Name"
                      className="form-item"
                    >
                      <Input placeholder="First Name" />
                    </Form.Item>

                    <Form.Item
                      name="memberLastName"
                      label="Family Member Last Name"
                      className="form-item"
                    >
                      <Input placeholder="Last Name" />
                    </Form.Item>
                  </div>

                  <div className="form-row">
                    <Form.Item
                      name="memberGender"
                      label="Family Member Gender"
                      className="form-item"
                    >
                      <Select placeholder="Select Gender">
                        <Option value="Male">Male</Option>
                        <Option value="Female">Female</Option>
                        <Option value="Other">Other</Option>
                      </Select>
                    </Form.Item>

                    <Form.Item
                      name="memberPhoneNumber"
                      label="Family Member Phone"
                      className="form-item"
                    >
                      <Input placeholder="Phone Number" />
                    </Form.Item>
                  </div>

                  <Form.Item name="memberAddress" label="Family Member Address">
                    <Input.TextArea rows={2} placeholder="Address" />
                  </Form.Item>
                </>
              )}
            </Form>
          </div>
        </Modal>

        {/* Create User Account Modal */}
        <Modal
          title="Create User Account"
          open={isUserModalVisible}
          onOk={handleSubmitUserAccount}
          onCancel={() => {
            setIsUserModalVisible(false);
            setSelectedEmployee(null);
            userForm.resetFields();
          }}
          confirmLoading={loading}
          width={screens.xs ? "90%" : "520px"}
        >
          <Form form={userForm} layout="vertical">
            <Form.Item name="firstName" hidden>
              <Input />
            </Form.Item>

            <Form.Item name="middleName" hidden>
              <Input />
            </Form.Item>

            <Form.Item name="lastName" hidden>
              <Input />
            </Form.Item>

            <Form.Item name="employeeId" hidden>
              <Input />
            </Form.Item>

            <Form.Item
              label="Username"
              name="username"
              rules={[{ required: true, message: "Please input username!" }]}
            >
              <Input />
            </Form.Item>

            <Form.Item
              label="Password"
              name="newPassword"
              rules={[{ required: true, message: "Please input password!" }]}
            >
              <Input.Password />
            </Form.Item>

            <Form.Item
              label="Role"
              name="roleId"
              rules={[{ required: true, message: "Please select role!" }]}
            >
              <Select>
                <Option value={1}>Admin</Option>
                <Option value={2}>Teacher</Option>
                <Option value={3}>Non-Teacher</Option>
                <Option value={4}>Coordinator</Option>
                <Option value={5}>HR</Option>
              </Select>
            </Form.Item>
          </Form>
        </Modal>

        {/* Print by Mixed Departments Modal */}
        <Modal
          title="Print by Mixed Departments"
          open={printModalVisible}
          onCancel={() => {
            setPrintModalVisible(false);
            setSelectedDepartments([]);
          }}
          footer={[
            <Button
              key="cancel"
              onClick={() => {
                setPrintModalVisible(false);
                setSelectedDepartments([]);
              }}
            >
              Cancel
            </Button>,
            <Button
              key="print"
              type="primary"
              icon={<PrinterOutlined />}
              onClick={handleMixedDepartmentPrint}
            >
              Print Selected Departments
            </Button>,
          ]}
          width={600}
        >
          <div style={{ marginBottom: 16 }}>
            <p>Select multiple departments to print faculty members who belong to <strong>ALL</strong> of the selected departments:</p>
          </div>
          <div style={{ maxHeight: 400, overflow: 'auto' }}>
            <Checkbox.Group
              value={selectedDepartments}
              onChange={setSelectedDepartments}
              style={{ width: '100%' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {departments.map((dept) => (
                  <Checkbox key={dept.departmentID} value={dept.departmentName || ''}>
                    {dept.departmentName}
                  </Checkbox>
                ))}
              </div>
            </Checkbox.Group>
          </div>
          {selectedDepartments.length > 0 && (
            <div style={{ marginTop: 16, padding: 12, backgroundColor: '#f0f8ff', borderRadius: 4 }}>
              <strong>Selected Departments:</strong> {selectedDepartments.join(' + ')}
              <br />
              <span style={{ fontSize: 12, color: '#666' }}>
                This will print only faculty members who have <strong>ALL</strong> of these departments assigned (in primary, secondary, or tertiary positions).
              </span>
            </div>
          )}
        </Modal>

        {/* Export by Mixed Departments Modal */}
        <Modal
          title="Export by Mixed Departments"
          open={exportModalVisible}
          onCancel={() => {
            setExportModalVisible(false);
            setSelectedExportDepartments([]);
          }}
          footer={[
            <Button
              key="cancel"
              onClick={() => {
                setExportModalVisible(false);
                setSelectedExportDepartments([]);
              }}
            >
              Cancel
            </Button>,
            <Button
              key="export"
              type="primary"
              icon={<FileExcelOutlined />}
              onClick={handleMixedDepartmentExport}
            >
              Export Selected Departments
            </Button>,
          ]}
          width={600}
        >
          <div style={{ marginBottom: 16 }}>
            <p>Select multiple departments to export faculty members who belong to <strong>ALL</strong> of the selected departments:</p>
          </div>
          <div style={{ maxHeight: 400, overflow: 'auto' }}>
            <Checkbox.Group
              value={selectedExportDepartments}
              onChange={setSelectedExportDepartments}
              style={{ width: '100%' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {departments.map((dept) => (
                  <Checkbox key={dept.departmentID} value={dept.departmentName || ''}>
                    {dept.departmentName}
                  </Checkbox>
                ))}
              </div>
            </Checkbox.Group>
          </div>
          {selectedExportDepartments.length > 0 && (
            <div style={{ marginTop: 16, padding: 12, backgroundColor: '#f0f8ff', borderRadius: 4 }}>
              <strong>Selected Departments:</strong> {selectedExportDepartments.join(' + ')}
              <br />
              <span style={{ fontSize: 12, color: '#666' }}>
                This will export only faculty members who have <strong>ALL</strong> of these departments assigned (in primary, secondary, or tertiary positions).
              </span>
            </div>
          )}
        </Modal>

        {/* Employee Details Modal */}
        <Modal
          title={`${selectedEmployeeDetails?.firstName} ${selectedEmployeeDetails?.middleName || ''} ${selectedEmployeeDetails?.lastName} - Profile`}
          open={detailModalVisible}
          onCancel={() => setDetailModalVisible(false)}
          footer={[
            <Button
              key="close"
              type="primary"
              onClick={() => setDetailModalVisible(false)}
              style={{ background: "#00883e", borderColor: "#00883e" }}
            >
              Close
            </Button>,
          ]}
          width={800}
          className="employee-details-modal"
        >
          {selectedEmployeeDetails && (
            <>
              <Tabs defaultActiveKey="1">
                <TabPane tab="Basic Information" key="1">
                  <div className="horizontal-details-container">
                    <div className="employee-avatar horizontal-avatar">
                      {selectedEmployeeDetails.firstName?.charAt(0)}
                      {selectedEmployeeDetails.middleName?.charAt(0)}
                      {selectedEmployeeDetails.lastName?.charAt(0)}
                    </div>

                    <div className="horizontal-details-grid">
                      <div className="detail-row">
                        <span className="detail-label">Employee ID:</span>
                        <span className="detail-value employee-id">
                          {formatEmployeeId(
                            selectedEmployeeDetails.employeeID,
                            selectedEmployeeDetails.hireDate
                          )}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Name:</span>
                        <span className="detail-value">
                          {selectedEmployeeDetails.firstName}{" "}
                          {selectedEmployeeDetails.middleName}{" "}
                          {selectedEmployeeDetails.lastName}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Gender:</span>
                        <span className="detail-value">
                          {selectedEmployeeDetails.gender}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Date of Birth:</span>
                        <span className="detail-value">
                          {selectedEmployeeDetails.dateOfBirth
                            ? dayjs(selectedEmployeeDetails.dateOfBirth).format(
                                "MMMM D, YYYY"
                              )
                            : "N/A"}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Email:</span>
                        <span className="detail-value">
                          <a href={`mailto:${selectedEmployeeDetails.email}`}>
                            {selectedEmployeeDetails.email}
                          </a>
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Phone:</span>
                        <span className="detail-value">
                          <a href={`tel:${selectedEmployeeDetails.phoneNumber}`}>
                            {selectedEmployeeDetails.phoneNumber}
                          </a>
                        </span>
                      </div>
                      <div className="detail-row">
                      <span className="detail-label">Primary Department:</span>
                      <span className="detail-value">
                        {shouldHaveDepartment(selectedEmployeeDetails.positionID) 
                          ? departments.find(
                              (d) => d.departmentID === selectedEmployeeDetails.departmentID
                            )?.departmentName || selectedEmployeeDetails.departmentID
                          : "N/A"
                        }
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Secondary Department:</span>
                      <span className="detail-value">
                        {shouldHaveDepartment(selectedEmployeeDetails.positionID) 
                          ? departments.find(
                              (d) => d.departmentID === selectedEmployeeDetails.departmentID2
                            )?.departmentName || "N/A"
                          : "N/A"
                        }
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Tertiary Department:</span>
                      <span className="detail-value">
                        {shouldHaveDepartment(selectedEmployeeDetails.positionID) 
                          ? departments.find(
                              (d) => d.departmentID === selectedEmployeeDetails.departmentID3
                            )?.departmentName || "N/A"
                          : "N/A"
                        }
                      </span>
                    </div>
                      <div className="detail-row">
                        <span className="detail-label">Position:</span>
                        <span className="detail-value">
                          {positions.find(
                            (p) =>
                              p.positionID === selectedEmployeeDetails.positionID
                          )?.positionName || selectedEmployeeDetails.positionID}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Status:</span>
                        <span className="detail-value">
                          {employmentStatuses.find(
                            (s) => s.employmentStatusID === selectedEmployeeDetails.employmentStatus
                          )?.statusName || "N/A"}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Hire Date:</span>
                        <span className="detail-value">
                          {selectedEmployeeDetails.hireDate
                            ? dayjs(selectedEmployeeDetails.hireDate).format(
                                "MMMM D, YYYY"
                              )
                            : "N/A"}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Year Of Service:</span>
                        <span className="detail-value">
                          {selectedEmployeeDetails.hireDate
                            ? Math.max(0, dayjs().diff(dayjs(selectedEmployeeDetails.hireDate), 'year')) + ' year' + (Math.max(0, dayjs().diff(dayjs(selectedEmployeeDetails.hireDate), 'year')) !== 1 ? 's' : '')
                            : 'N/A'}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Address:</span>
                        <span className="detail-value">
                          {selectedEmployeeDetails.address}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Employment Details Box */}
                  <div style={{ 
                    marginTop: '24px', 
                    padding: '20px', 
                    border: '1px solid #d9d9d9', 
                    borderRadius: '8px',
                    backgroundColor: '#fafafa'
                  }}>
                    <h3 style={{ 
                      marginTop: 0, 
                      marginBottom: '16px', 
                      fontSize: '16px', 
                      fontWeight: 600,
                      color: '#00883e'
                    }}>
                      Employment Details
                    </h3>
                    <div className="horizontal-details-grid">
                      <div className="detail-row">
                        <span className="detail-label">Category:</span>
                        <span className="detail-value" style={{ fontWeight: 600 }}>
                          {shouldHaveDepartment(selectedEmployeeDetails.positionID) 
                            ? "Teaching" 
                            : "Non-Teaching"}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Position:</span>
                        <span className="detail-value">
                          {positions.find(
                            (p) =>
                              p.positionID === selectedEmployeeDetails.positionID
                          )?.positionName || selectedEmployeeDetails.positionID}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Department:</span>
                        <span className="detail-value">
                          {shouldHaveDepartment(selectedEmployeeDetails.positionID)
                            ? (() => {
                                const depts = [
                                  departments.find((d) => d.departmentID === selectedEmployeeDetails.departmentID)?.departmentName,
                                  departments.find((d) => d.departmentID === selectedEmployeeDetails.departmentID2)?.departmentName,
                                  departments.find((d) => d.departmentID === selectedEmployeeDetails.departmentID3)?.departmentName,
                                ].filter(Boolean);
                                return depts.length > 0 ? depts.join(", ") : "N/A";
                              })()
                            : "N/A"
                          }
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Date Started:</span>
                        <span className="detail-value">
                          {getLatestHistoryDate()
                            ? dayjs(getLatestHistoryDate()).format("MMMM D, YYYY")
                            : "N/A"}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Employment Status:</span>
                        <span className="detail-value">
                          {employmentStatuses.find(
                            (s) => s.employmentStatusID === selectedEmployeeDetails.employmentStatus
                          )?.statusName || "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>
                </TabPane>
                <TabPane tab="Educational Attainment" key="2">
                  <div className="horizontal-details-container">
                    <div className="horizontal-details-grid">
                      <div className="detail-row">
                        <span className="detail-label">
                          Educational Attainment:
                        </span>
                        <span className="detail-value">
                          {educationalAttainments.find(
                            (a) => a.educationalAttainmentID === selectedEmployeeDetails.educationalAttainment
                          )?.attainmentName || "N/A"}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Year Graduated:</span>
                        <span className="detail-value">
                          {selectedEmployeeDetails.yearGraduated
                            ? dayjs(
                                selectedEmployeeDetails.yearGraduated
                              ).format("YYYY")
                            : "N/A"}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Institution Name:</span>
                        <span className="detail-value">
                          {selectedEmployeeDetails.institutionName || "N/A"}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Course:</span>
                        <span className="detail-value">
                          {selectedEmployeeDetails.courseName || "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {!selectedEmployeeDetails.educationalAttainment && (
                    <div
                      style={{
                        textAlign: "center",
                        marginTop: "20px",
                        color: "#999",
                      }}
                    >
                      <p>No educational information available.</p>
                    </div>
                  )}
                </TabPane>
                <TabPane tab="Work Experience" key="3">
                  <div className="horizontal-details-container">
                    <div className="horizontal-details-grid">
                      <div className="detail-row">
                        <span className="detail-label">Previous Position:</span>
                        <span className="detail-value">
                          {selectedEmployeeDetails.previousPosition || "N/A"}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Office Name:</span>
                        <span className="detail-value">
                          {selectedEmployeeDetails.officeName || "N/A"}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Duration:</span>
                        <span className="detail-value">
                          {selectedEmployeeDetails.durationStart
                            ? dayjs(
                                selectedEmployeeDetails.durationStart
                              ).format("YYYY-MM-DD")
                            : "N/A -"}{" "}
                          ||{" "}
                          {selectedEmployeeDetails.durationEnd
                            ? dayjs(selectedEmployeeDetails.durationEnd).format(
                                "YYYY-MM-DD"
                              )
                            : " N/A"}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Agency Name:</span>
                        <span className="detail-value">
                          {selectedEmployeeDetails.agencyName || "N/A"}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Supervisor:</span>
                        <span className="detail-value">
                          {selectedEmployeeDetails.supervisor || "N/A"}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">
                          List of Accomplishments:
                        </span>
                        <span className="detail-value">
                          {selectedEmployeeDetails.accomplishment || "N/A"}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">
                          Summary of Actual Duties:
                        </span>
                        <span className="detail-value">
                          {selectedEmployeeDetails.summary || "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {!selectedEmployeeDetails.previousPosition && (
                    <div
                      style={{
                        textAlign: "center",
                        marginTop: "20px",
                        color: "#999",
                      }}
                    >
                      <p>No work experience information available.</p>
                    </div>
                  )}
                </TabPane>
                <TabPane tab="Requirements | Records" key="4">
                  <Requirements employeeId={selectedEmployeeDetails?.employeeID ?? null} />
                </TabPane>
                <TabPane tab="Family Data" key="5">
                  <div className="horizontal-details-container">
                    <div className="horizontal-details-grid">
                      <div className="detail-row">
                        <span className="detail-label">Family Member Name:</span>
                        <span className="detail-value">
                          {selectedEmployeeDetails.memberFirstName &&
                          selectedEmployeeDetails.memberLastName
                            ? `${selectedEmployeeDetails.memberFirstName} ${selectedEmployeeDetails.memberLastName}`
                            : "N/A"}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Gender:</span>
                        <span className="detail-value">
                          {selectedEmployeeDetails.memberGender || "N/A"}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Phone Number:</span>
                        <span className="detail-value">
                          {selectedEmployeeDetails.memberPhoneNumber ? (
                            <a
                              href={`tel:${selectedEmployeeDetails.memberPhoneNumber}`}
                            >
                              {selectedEmployeeDetails.memberPhoneNumber}
                            </a>
                          ) : (
                            "N/A"
                          )}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Address:</span>
                        <span className="detail-value">
                          {selectedEmployeeDetails.memberAddress || "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {!selectedEmployeeDetails.memberFirstName && (
                    <div
                      style={{
                        textAlign: "center",
                        marginTop: "20px",
                        color: "#999",
                      }}
                    >
                      <p>No family member information available.</p>
                    </div>
                  )}
                </TabPane>
                <TabPane tab="Employment Details" key="6">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 style={{ margin: 0 }}>Employment Details</h3>
                      {(isAdmin || isHR || isCoordinator) && (
                        <Button
                          type="primary"
                          icon={<PlusOutlined />}
                          onClick={() => {
                            employmentHistoryForm.resetFields();
                            setEditingHistoryIndex(null);
                            setEmploymentHistoryModalVisible(true);
                          }}
                          size={screens.xs ? 'small' : 'middle'}
                        >
                          Add
                        </Button>
                      )}
                  </div>

                    <Table
                    dataSource={employmentHistoryList.map((h, i) => ({ key: i, ...h }))}
                    pagination={false}
                    columns={[
                      {
                        title: 'Department',
                        dataIndex: 'departmentID',
                        key: 'department',
                        render: (deptId: number | null) => departments.find((d) => d.departmentID === deptId)?.departmentName || 'N/A'
                      },
                      {
                        title: 'Position',
                        dataIndex: 'positionID',
                        key: 'position',
                        render: (posId: number | null) => positions.find((p) => p.positionID === posId)?.positionName || 'N/A'
                      },
                      {
                        title: 'Category',
                        dataIndex: 'category',
                        key: 'category'
                      },
                      {
                        title: 'Date Started',
                        dataIndex: 'dateStarted',
                        key: 'dateStarted',
                        render: (date: string | null) => date ? dayjs(date).format('YYYY-MM-DD') : 'N/A'
                      },
                      ...(isAdmin || isHR || isCoordinator ? [{
                        title: 'Actions',
                        key: 'actions',
                        render: (_: any, record: any, index: number) => (
                          <Space size="middle">
                            <Button
                              type="link"
                              icon={<EditOutlined />}
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingHistoryIndex(index);
                                // set form values to the record
                                employmentHistoryForm.setFieldsValue({
                                  departmentID: record.departmentID || undefined,
                                  positionID: record.positionID || undefined,
                                  category: record.category || undefined,
                                  dateStarted: record.dateStarted ? dayjs(record.dateStarted) : undefined,
                                });
                                setEmploymentHistoryModalVisible(true);
                              }}
                            />
                            <Popconfirm
                              title="Are you sure you want to delete this history entry?"
                              onConfirm={(e) => {
                                e?.stopPropagation();
                                setEmploymentHistoryList(prev => {
                                  const updated = prev.filter((_, i) => i !== index);
                                  setSelectedEmployeeDetails(curr => {
                                    if (!curr) return curr;
                                    const last = updated.length ? updated[updated.length - 1] : null;
                                    return {
                                      ...curr,
                                      departmentID: last?.departmentID ?? curr.departmentID,
                                      positionID: last?.positionID ?? curr.positionID,
                                    } as Employee;
                                  });
                                  return updated;
                                });
                              }}
                            >
                              <Button type="link" danger icon={<DeleteOutlined />} />
                            </Popconfirm>
                          </Space>
                        )
                      }] : []),
                    ]}
                  />
                    <Modal
                    title={editingHistoryIndex !== null ? "Edit Employment Details" : "Add Employment Details"}
                    open={isEmploymentHistoryModalVisible}
                    onCancel={() => setEmploymentHistoryModalVisible(false)}
                    onOk={handleSaveEmploymentHistory}
                    okText={editingHistoryIndex !== null ? 'Save' : 'Add'}
                  >
                    <Form form={employmentHistoryForm} layout="vertical">
                      <Form.Item name="departmentID" label="Department">
                        <Select placeholder="Select Department" allowClear>
                          {departments.map((dept) => (
                            <Option key={dept.departmentID} value={dept.departmentID}>
                              {dept.departmentName}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                      <Form.Item name="positionID" label="Position">
                        <Select placeholder="Select Position" allowClear>
                          {positions.map((p) => (
                            <Option key={p.positionID} value={p.positionID}>
                              {p.positionName}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                      <Form.Item name="category" label="Category">
                        <Select placeholder="Select Category" allowClear>
                          <Option value="Teaching">Teaching</Option>
                          <Option value="Non-Teaching">Non-Teaching</Option>
                        </Select>
                      </Form.Item>
                      <Form.Item name="dateStarted" label="Date Started">
                        <DatePicker style={{ width: '100%' }} />
                      </Form.Item>
                    </Form>
                  </Modal>
                </TabPane>
              </Tabs>
            </>
          )}
          
        </Modal>
      </div>
    );
  };

  export default FacultyPage;

function handleAddUserAccount(_record: Employee, _e: React.MouseEvent<HTMLElement, MouseEvent>): void {
  throw new Error("Function not implemented.");
}
