// File: src/pages/EvaluationFormPage.tsx

import { useEffect, useState } from "react";
import axios from "../api/_axiosInstance";
import DepartmentService from "../api/DepartmentService";
import PositionService from "../api/PositionService";
import { Spin, Input, Button, message, Alert, Card, Progress, DatePicker } from "antd";
import { EditOutlined, DeleteOutlined, InfoCircleOutlined } from "@ant-design/icons";
import './EvaluationPage.css';
import { ROLES } from "../types/auth";
import { useAuth } from "../types/useAuth";
import dayjs from 'dayjs';
import { PositionTypes } from "../types/tblPosition";

// Types
type ScoreChoice = {
  value: number;
  label: string;
}

type Item = {
  itemID: number;
  subGroupID: number | null;
  groupID: number | null;
  description: string;
  itemTypeID?: number | null;
  itemType?: string | null;
  isEditing?: boolean;
  tempDescription?: string;
};

type SubGroup = {
  subGroupID: number;
  groupID: number;
  name: string;
  isEditing?: boolean;
  tempName?: string;
};

type Group = {
  groupID: number;
  name: string;
  description: string;
  weight: number;
  groupTypeID: number;
  subGroups: SubGroup[];
  isEditing?: boolean;
  tempDescription?: string;
};

type SubGroupScore = {
  subGroupID: number;
  scoreValue: number;
};

type Evaluation = {
  employeeID: number;
  evaluatorID: number;
  evaluationDate: string;
  comments: string;
  scores: SubGroupScore[];
  evaluatorName?: string;
  evaluatorEmail?: string;
  evaluatorPosition?: number;
  finalScore?: number;
};

type Department = {
  departmentID: number;
  departmentName: string;
  description?: string;
};

type Employee = {
  employeeID: number;
  firstName: string;
  lastName: string;
  departmentID: number;
  departmentID2?: number | null;
  departmentID3?: number | null;
  departmentName?: string;
  position?: string;
  hireDate?: string;
  positionID?: number | null;
};

const scoreChoices: ScoreChoice[] = [
  { value: 1, label: "Poor (1.0)" },
  { value: 2, label: "Fair (2.0)" },
  { value: 3, label: "Satisfactory (3.0)" },
  { value: 4, label: "Very Satisfactory (4.0)" },
  { value: 5, label: "Excellent (5.0)" },
];

// Special ID for the virtual Non-teachers department
const NON_TEACHING_DEPARTMENT_ID = -1;

const EvaluationFormPage = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [positions, setPositions] = useState<PositionTypes[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [selectedDepartmentID, setSelectedDepartmentID] = useState<number | null>(null);
  const [selectedEmployeeID, setSelectedEmployeeID] = useState<number | null>(null);
  const [selectedPositionID, setSelectedPositionID] = useState<number | null>(null);
  const [comments, setComments] = useState("");
  const [scores, setScores] = useState<SubGroupScore[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [userDepartment, setUserDepartment] = useState<Department | null>(null);
  const [editing, setEditing] = useState<boolean>(false);
  const [missingScores, setMissingScores] = useState<number[]>([]);
  const [currentEfficiencyRating, setCurrentEfficiencyRating] = useState<number>(0);
  const [evaluationDate, setEvaluationDate] = useState<dayjs.Dayjs>(dayjs());
  
  const { user } = useAuth();
  
  const isAdmin = user?.roleId === ROLES.Admin;
  const isHR = user?.roleId === ROLES.HR;
  const isCoordinator = user?.roleId === ROLES.Coordinator;

  const [itemsBySubGroup, setItemsBySubGroup] = useState<Record<number, Item[]>>({});
  const [employeeRoles, setEmployeeRoles] = useState<Record<number, number>>({});

  // Simplified group type detection - ONLY uses position selection
  const getGroupTypeForEmployee = (employeeID: number): number | null => {
    if (!employeeID) return null;
    
    console.log(`Getting group type for employee ${employeeID}`, {
      selectedPositionID,
      selectedDepartmentID
    });
    
    // For non-teaching department with position selected
    if (selectedDepartmentID === NON_TEACHING_DEPARTMENT_ID && selectedPositionID) {
      const selectedPosition = positions.find(p => p.positionID === selectedPositionID);
      if (selectedPosition) {
        const positionName = (selectedPosition.positionName || "").toLowerCase();
        console.log(`Position: "${selectedPosition.positionName}" -> GroupType detection`);
        
        // Security positions
        if (positionName.includes('security') || positionName.includes('guard')) {
          return 4;
        }
        // Maintenance positions
        if (positionName.includes('maintenance') || positionName.includes('janitor') || positionName.includes('cleaner') ||
            positionName.includes('technician') ||  positionName.includes('custodian')) {
          return 5;
        }
        // All other non-teaching positions default to Admin
        return 3;
      }
    }
    
    // Default to Teaching evaluation for all other cases
    return 1;
  };

  // Filter groups by group type
  const getFilteredGroups = (): Group[] => {
    if (!selectedEmployeeID) {
      return editing ? groups : [];
    }
    
    const groupTypeID = getGroupTypeForEmployee(selectedEmployeeID);
    console.log(`Employee ${selectedEmployeeID} - GroupType: ${groupTypeID}`);
    
    if (!groupTypeID) return [];
    
    const filtered = groups.filter(group => group.groupTypeID === groupTypeID);
    console.log(`Filtered groups for type ${groupTypeID}:`, filtered);
    
    return filtered;
  };

  // Simplified item visibility - based on department selection only
  const shouldShowTeachingItems = (employeeID: number) => {
    if (!employeeID) return true;
    // For non-teaching department, don't show teaching items
    if (selectedDepartmentID === NON_TEACHING_DEPARTMENT_ID) {
      return false;
    }
    return true;
  };

  const shouldShowNonTeachingItems = (employeeID: number) => {
    if (!employeeID) return true;
    
    if (isCoordinator) {
      return false;
    }
    
    // For non-teaching department, show non-teaching items
    if (selectedDepartmentID === NON_TEACHING_DEPARTMENT_ID) {
      return true;
    }
    
    return false;
  };

  const getItemsByType = (items: Item[], type: 'teaching' | 'non-teaching') => {
    if (!items) return [];
    
    return items.filter(item => {
      if (type === 'teaching') {
        return item.itemType === 'teaching' || item.itemTypeID === 1 || !item.itemType || item.itemTypeID === null;
      } else {
        return item.itemType === 'non-teaching' || item.itemTypeID === 2;
      }
    });
  };

  const getVisibleSubGroups = () => {
    if (!selectedEmployeeID) return [];
    
    const visibleSubGroups: SubGroup[] = [];
    const filteredGroups = getFilteredGroups();
    
    filteredGroups.forEach(group => {
      group.subGroups.forEach(subGroup => {
        const items = itemsBySubGroup[subGroup.subGroupID] || [];
        
        const hasTeachingItems = shouldShowTeachingItems(selectedEmployeeID) && 
                                 getItemsByType(items, 'teaching').length > 0;
        const hasNonTeachingItems = shouldShowNonTeachingItems(selectedEmployeeID) && 
                                    getItemsByType(items, 'non-teaching').length > 0;
        
        if (hasTeachingItems || hasNonTeachingItems) {
          visibleSubGroups.push(subGroup);
        }
      });
    });
    
    return visibleSubGroups;
  };

  // Calculate efficiency rating in real-time
  const calculateEfficiencyRating = () => {
    if (scores.length === 0) return 0;
    
    const visibleSubGroups = getVisibleSubGroups();
    if (visibleSubGroups.length === 0) return 0;
    
    const totalScore = scores.reduce((sum, score) => sum + score.scoreValue, 0);
    const averageScore = totalScore / visibleSubGroups.length;
    
    return averageScore;
  };

  // Update efficiency rating whenever scores change
  useEffect(() => {
    const rating = calculateEfficiencyRating();
    setCurrentEfficiencyRating(rating);
  }, [scores, selectedEmployeeID]);

  // Get years of service for selected employee
  const getYearsOfService = (employeeID: number) => {
    const employee = employees.find(emp => emp.employeeID === employeeID);
    if (!employee || !employee.hireDate) return 0;
    
    const hireDate = new Date(employee.hireDate);
    const today = new Date();
    const years = (today.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    
    return Math.floor(years);
  };

  // Check if employee qualifies for performance bonus
  const checkBonusQualification = (efficiencyRating: number, employeeID: number) => {
    const employee = employees.find(emp => emp.employeeID === employeeID);
    if (!employee) return { qualifies: false, reason: "Employee not found" };
    
    const isAssistant = employee.position?.toLowerCase().includes('assistant');
    const requiredRating = isAssistant ? 4.5 : 4.2;
    
    if (efficiencyRating < requiredRating) {
      return { 
        qualifies: false, 
        reason: `Efficiency rating ${efficiencyRating.toFixed(2)} is below required ${requiredRating} for ${isAssistant ? 'Assistants' : 'regular employees'}` 
      };
    }
    
    return { 
      qualifies: true, 
      reason: `Meets efficiency rating requirement of ${requiredRating}+ (${isAssistant ? 'Assistant' : 'Regular Employee'})` 
    };
  };

  // Get rating color based on score
  const getRatingColor = (rating: number) => {
    if (rating >= 4.5) return '#52c41a'; // Green - Excellent
    if (rating >= 4.0) return '#73d13d'; // Light green - Very Satisfactory
    if (rating >= 3.5) return '#fadb14'; // Yellow - Good
    if (rating >= 3.0) return '#fa8c16'; // Orange - Satisfactory
    if (rating >= 2.0) return '#ff4d4f'; // Red - Fair
    return '#cf1322'; // Dark red - Poor
  };

  // Get rating label
  const getRatingLabel = (rating: number) => {
    if (rating >= 4.5) return 'Excellent';
    if (rating >= 4.0) return 'Very Satisfactory';
    if (rating >= 3.5) return 'Good';
    if (rating >= 3.0) return 'Satisfactory';
    if (rating >= 2.0) return 'Fair';
    return 'Poor';
  };

  const hasUserEvaluatedEmployee = (employeeID: number) => {
    return evaluations.some(evalItem => 
      evalItem.employeeID === employeeID && evalItem.evaluatorID === user?.employeeId
    );
  };

  const getUserDepartment = () => {
    if (!user?.employeeId || employees.length === 0) return null;
    
    const userEmployee = employees.find(emp => emp.employeeID === user.employeeId);
    if (!userEmployee) return null;
    
    return departments.find(dept => dept.departmentID === userEmployee.departmentID) || null;
  };

  const getAvailableDepartments = () => {
    const baseDepartments = isAdmin || isHR ? departments : (userDepartment ? [userDepartment] : []);
    
    if (isAdmin || isHR) {
      return [
        ...baseDepartments,
        {
          departmentID: NON_TEACHING_DEPARTMENT_ID,
          departmentName: "Non-teachers",
          description: "Non-teaching staff from all departments"
        }
      ];
    }
    
    return baseDepartments;
  };

  const filteredEmployees = selectedDepartmentID
    ? employees.filter(emp => {
        if (emp.employeeID === user?.employeeId) {
          return false;
        }
        
        const isNonTeachingDepartment = selectedDepartmentID === NON_TEACHING_DEPARTMENT_ID;
        
        if (isNonTeachingDepartment) {
          // For non-teaching department, show all employees (we'll filter by position)
          return true;
        } else {
          // For teaching departments, apply coordinator restrictions if needed
          if (isCoordinator) {
            // Coordinators can only evaluate teaching staff in their department
            const belongsToDepartment = 
              emp.departmentID === selectedDepartmentID ||
              emp.departmentID2 === selectedDepartmentID || 
              emp.departmentID3 === selectedDepartmentID;
            
            if (belongsToDepartment) {
              const userHasEvaluated = hasUserEvaluatedEmployee(emp.employeeID);
              return !userHasEvaluated;
            }
            return false;
          }
          
          // Regular teaching department filtering
          const belongsToDepartment = 
            emp.departmentID === selectedDepartmentID ||
            emp.departmentID2 === selectedDepartmentID || 
            emp.departmentID3 === selectedDepartmentID;
          
          if (belongsToDepartment) {
            const userHasEvaluated = hasUserEvaluatedEmployee(emp.employeeID);
            return !userHasEvaluated;
          }
          return false;
        }
      })
    : [];

  // Get positions for non-teaching employees from PositionService - filtered to only Security, Maintenance, and Admin Staff
  const getNonTeachingPositions = () => {
    // Filter positions that are actually used by non-teaching employees
    const nonTeachingEmployeePositions = new Set<string>();
    
    filteredEmployees.forEach(emp => {
      // Add positionID if available and valid
      if (emp.positionID && emp.positionID > 0) {
        nonTeachingEmployeePositions.add(emp.positionID.toString());
      }
      // Add position name if available
      if (emp.position) {
        nonTeachingEmployeePositions.add(emp.position);
      }
    });
    
    return positions.filter(position => {
      const positionIdStr = position.positionID?.toString() || '';
      const positionName = (position.positionName || '').toLowerCase();
      
      // Only include Security, Maintenance, and Admin Staff positions
      const isSecurity = positionName.includes('security') || positionName.includes('guard');
      const isMaintenance = positionName.includes('maintenance') || positionName.includes('janitor') || 
                           positionName.includes('technician') || positionName.includes('custodian');
      const isAdminStaff = positionName.includes('admin') || positionName.includes('staff') || 
                          positionName.includes('clerk') || positionName.includes('secretary') ||
                          positionName.includes('assistant');
      
      const isAllowedPosition = isSecurity || isMaintenance || isAdminStaff;
      
      return isAllowedPosition && (
        nonTeachingEmployeePositions.has(positionIdStr) || 
        nonTeachingEmployeePositions.has(position.positionName || '')
      );
    });
  };

  // Get employees filtered by selected position
  const getFilteredEmployeesByPosition = () => {
    if (selectedDepartmentID === NON_TEACHING_DEPARTMENT_ID) {
      // For non-teaching department, require position selection first
      if (!selectedPositionID) {
        return [];
      }
      
      const selectedPosition = positions.find(p => p.positionID === selectedPositionID);
      if (!selectedPosition) return [];
      
      return filteredEmployees.filter(emp => {
        // Match by positionID if available
        if (emp.positionID && emp.positionID === selectedPositionID) {
          return true;
        }
        // Match by position name as fallback
        if (emp.position && emp.position === selectedPosition.positionName) {
          return true;
        }
        return false;
      });
    }
    
    // For teaching departments, return all filtered employees
    return filteredEmployees;
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (employees.length > 0 && departments.length > 0 && user?.employeeId) {
      const department = getUserDepartment();
      setUserDepartment(department);
      
      if (department && !isAdmin && !isHR) {
        setSelectedDepartmentID(department.departmentID);
      }
    }
  }, [employees, departments, user, isAdmin, isHR]);

  useEffect(() => {
    setMissingScores([]);
    setSelectedPositionID(null);
    setSelectedEmployeeID(null); // Reset employee when department changes
    setScores([]);
    setCurrentEfficiencyRating(0);
  }, [selectedDepartmentID]);

  useEffect(() => {
    // Reset employee when position changes for non-teaching department
    if (selectedDepartmentID === NON_TEACHING_DEPARTMENT_ID) {
      setSelectedEmployeeID(null);
      setScores([]);
      setCurrentEfficiencyRating(0);
    }
  }, [selectedPositionID]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [groupsRes, employeesRes, departmentsRes, evaluationsRes, positionsRes] = await Promise.all([
        axios.get("/EvaluationStructure/groups"),
        axios.get("/Employees"),
        DepartmentService.getAll(),
        axios.get("/Evaluations"),
        PositionService.getAll()
      ]);

      const groupsData = await Promise.all(
        groupsRes.data.map(async (g: any) => {
          const resp = await axios.get(`/EvaluationStructure/subgroups/${g.groupID}`);
          return {
            ...g,
            subGroups: resp.data || [],
          };
        })
      );

      setGroups(groupsData);
      setDepartments(
        Array.isArray(departmentsRes)
          ? departmentsRes
              .filter((dept: any) => typeof dept.departmentID === "number")
              .map((dept: any) => ({
                departmentID: dept.departmentID,
                departmentName: dept.departmentName,
                description: dept.description,
              }))
          : []
      );
      
      const employeesData = Array.isArray(employeesRes.data) ? employeesRes.data : employeesRes.data.result || [];
      setEmployees(employeesData);

      setEvaluations(evaluationsRes.data);
      setPositions(positionsRes || []);

      const allSubgroups = groupsData.flatMap((g) => g.subGroups);
      const subItemsList = await Promise.all(
        allSubgroups.map(async (sub) => {
          try {
            const respItems = await axios.get(`/EvaluationStructure/items/by-subgroup/${sub.subGroupID}`);
            
            const items = (respItems.data || []).map((dbItem: any) => ({
              ...dbItem,
            }));
            
            return { subGroupID: sub.subGroupID, items };
          } catch (error) {
            console.error(`Error loading items for subgroup ${sub.subGroupID}:`, error);
            return { subGroupID: sub.subGroupID, items: [] };
          }
        })
      );

      const map: Record<number, Item[]> = {};
      subItemsList.forEach((entry) => {
        map[entry.subGroupID] = entry.items;
      });
      setItemsBySubGroup(map);

      try {
        const usersResponse = await axios.get("/Users");
        const users = usersResponse.data;
        
        const rolesMap: Record<number, number> = {};
        users.forEach((user: any) => {
          if (user.employeeId) {
            rolesMap[user.employeeId] = user.roleId;
          }
        });
        
        setEmployeeRoles(rolesMap);
      } catch (error) {
        console.error("Error fetching user roles:", error);
      }
      
    } catch (err) {
      console.error("Error loading data:", err);
      message.error("Failed to load evaluation data");
    } finally {
      setLoading(false);
    }
  };

  const handleDepartmentChange = (departmentID: number) => {
    setSelectedDepartmentID(departmentID);
    setSelectedEmployeeID(null);
    setSelectedPositionID(null);
    setScores([]);
    setMissingScores([]);
    setCurrentEfficiencyRating(0);
  };

  const handlePositionChange = (positionID: number | null) => {
    setSelectedPositionID(positionID);
    setSelectedEmployeeID(null);
    setScores([]);
    setMissingScores([]);
    setCurrentEfficiencyRating(0);
  };

  const handleScoreChange = (subGroupID: number, value: number) => {
    setScores((prev) => {
      const without = prev.filter((s) => s.subGroupID !== subGroupID);
      return [...without, { subGroupID, scoreValue: value }];
    });
    
    setMissingScores(prev => prev.filter(id => id !== subGroupID));
  };

  const handleSubmit = () => {
    if (selectedDepartmentID == null) {
      message.error("Please select department first.");
      return;
    }

    if (selectedEmployeeID == null) {
      message.error("Please select employee.");
      return;
    }

    if (selectedEmployeeID === user?.employeeId) {
      message.error("You cannot evaluate yourself.");
      return;
    }

    // Validate evaluation date
    const selectedDate = evaluationDate;
    const today = dayjs();
    
    if (selectedDate > today) {
      message.error("Evaluation date cannot be in the future.");
      return;
    }

    if (isCoordinator) {
      const targetEmployeeRole = employeeRoles[selectedEmployeeID];
      if (targetEmployeeRole === ROLES.Coordinator) {
        message.error("Coordinators cannot evaluate other coordinators.");
        return;
      }
      if (selectedDepartmentID === NON_TEACHING_DEPARTMENT_ID) {
        message.error("Coordinators cannot evaluate non-teaching staff.");
        return;
      }
    }

    if (hasUserEvaluatedEmployee(selectedEmployeeID)) {
      message.error("You have already evaluated this employee.");
      return;
    }

    if (!user?.employeeId) {
      message.error("Evaluator information missing. Please log in again.");
      return;
    }

    const visibleSubGroups = getVisibleSubGroups();
    const missingSubGroups = visibleSubGroups.filter(subGroup => 
      !scores.find(s => s.subGroupID === subGroup.subGroupID)
    );

    if (missingSubGroups.length > 0) {
      const missingIds = missingSubGroups.map(sg => sg.subGroupID);
      setMissingScores(missingIds);
      
      message.error({
        content: `Please answer all required questions. ${missingSubGroups.length} question(s) remaining.`,
        duration: 5
      });
      
      const firstMissingElement = document.getElementById(`subgroup-${missingIds[0]}`);
      if (firstMissingElement) {
        firstMissingElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      
      return;
    }

    const finalScore = calculateEfficiencyRating();

    const evaluation: Evaluation = {
      employeeID: selectedEmployeeID,
      evaluatorID: user.employeeId,
      evaluationDate: evaluationDate.format('YYYY-MM-DD'),
      comments: comments,
      scores: scores,
      finalScore: finalScore,
    };

    console.log('Submitting evaluation:', {
      employeeID: evaluation.employeeID,
      evaluatorID: evaluation.evaluatorID,
      evaluationDate: evaluation.evaluationDate,
      scoresCount: evaluation.scores.length,
      scores: evaluation.scores,
      comments: evaluation.comments,
      finalScore: evaluation.finalScore
    });

    setSubmitting(true);

    axios
      .post("/Evaluations", evaluation)
      .then((response) => {
        const bonusCheck = checkBonusQualification(finalScore, selectedEmployeeID);
        
        if (bonusCheck.qualifies) {
          message.success({
            content: `Evaluation submitted successfully! Employee qualifies for performance bonus with efficiency rating of ${finalScore.toFixed(2)}.`,
            duration: 8
          });
        } else {
          message.success({
            content: `Evaluation submitted successfully. Efficiency Rating: ${finalScore.toFixed(2)}`,
            duration: 5
          });
        }
        
        setEvaluations(prev => [...prev, response.data]);
        
        if (isAdmin || isHR) {
          setSelectedDepartmentID(null);
        } else {
          setSelectedDepartmentID(userDepartment?.departmentID || null);
        }
        setSelectedEmployeeID(null);
        setSelectedPositionID(null);
        setComments("");
        setScores([]);
        setMissingScores([]);
        setCurrentEfficiencyRating(0);
        setEvaluationDate(dayjs());
      })
      .catch((err: any) => {
        console.error("Error submitting evaluation:", err);
        console.error("Error response:", err.response?.data);
        message.error(`Error submitting evaluation: ${err.response?.data?.message || err.response?.data || err.message}`);
      })
      .finally(() => {
        setSubmitting(false);
      });
  };

  // Group editing functions
  const startEditingGroup = (groupID: number) => {
    setGroups(prev => prev.map(group => {
      if (group.groupID === groupID) {
        return { ...group, isEditing: true, tempDescription: group.description };
      }
      return group;
    }));
  };

  const cancelEditingGroup = (groupID: number) => {
    setGroups(prev => prev.map(group => {
      if (group.groupID === groupID) {
        return { ...group, isEditing: false, tempDescription: undefined };
      }
      return group;
    }));
  };

  const saveGroupDescription = async (groupID: number, newDescription: string) => {
    if (!newDescription.trim()) {
      message.error("Group description cannot be empty");
      return;
    }

    try {
      await axios.put(`/EvaluationStructure/groups/${groupID}`, {
        description: newDescription
      });

      setGroups(prev => prev.map(group => {
        if (group.groupID === groupID) {
          return { ...group, description: newDescription, isEditing: false, tempDescription: undefined };
        }
        return group;
      }));
      
      message.success("Group description updated successfully");
    } catch (error: any) {
      console.error("Error updating group:", error);
      message.error(`Failed to update group description: ${error.response?.data || error.message}`);
    }
  };

  const handleGroupDescriptionChange = (groupID: number, value: string) => {
    setGroups(prev => prev.map(group => {
      if (group.groupID === groupID) {
        return { ...group, tempDescription: value };
      }
      return group;
    }));
  };

  // SubGroup editing functions
  const startEditingSubGroup = (groupID: number, subGroupID: number) => {
    setGroups(prev => prev.map(group => {
      if (group.groupID === groupID) {
        return {
          ...group,
          subGroups: group.subGroups.map(sub => {
            if (sub.subGroupID === subGroupID) {
              return { ...sub, isEditing: true, tempName: sub.name };
            }
            return sub;
          })
        };
      }
      return group;
    }));
  };

  const cancelEditingSubGroup = (groupID: number, subGroupID: number) => {
    setGroups(prev => prev.map(group => {
      if (group.groupID === groupID) {
        return {
          ...group,
          subGroups: group.subGroups.map(sub => {
            if (sub.subGroupID === subGroupID) {
              return { ...sub, isEditing: false, tempName: undefined };
            }
            return sub;
          })
        };
      }
      return group;
    }));
  };

  const saveSubGroupName = async (groupID: number, subGroupID: number, newName: string) => {
    if (!newName.trim()) {
      message.error("SubGroup name cannot be empty");
      return;
    }

    try {
      await axios.put(`/EvaluationStructure/subgroups/${subGroupID}`, {
        groupID: groupID,
        name: newName
      });

      setGroups(prev => prev.map(group => {
        if (group.groupID === groupID) {
          return {
            ...group,
            subGroups: group.subGroups.map(sub => {
              if (sub.subGroupID === subGroupID) {
                return { ...sub, name: newName, isEditing: false, tempName: undefined };
              }
              return sub;
            })
          };
        }
        return group;
      }));
      
      message.success("SubGroup name updated successfully");
    } catch (error: any) {
      console.error("Error updating subgroup:", error);
      message.error(`Failed to update subgroup name: ${error.response?.data || error.message}`);
    }
  };

  const handleSubGroupNameChange = (groupID: number, subGroupID: number, value: string) => {
    setGroups(prev => prev.map(group => {
      if (group.groupID === groupID) {
        return {
          ...group,
          subGroups: group.subGroups.map(sub => {
            if (sub.subGroupID === subGroupID) {
              return { ...sub, tempName: value };
            }
            return sub;
          })
        };
      }
      return group;
    }));
  };

  // Item editing functions
  const startEditingItem = (subGroupID: number, itemID: number) => {
    setItemsBySubGroup(prev => {
      const updated = { ...prev };
      if (updated[subGroupID]) {
        updated[subGroupID] = updated[subGroupID].map(item => {
          if (item.itemID === itemID) {
            return { ...item, isEditing: true, tempDescription: item.description };
          }
          return item;
        });
      }
      return updated;
    });
  };

  const cancelEditingItem = (subGroupID: number, itemID: number) => {
    setItemsBySubGroup(prev => {
      const updated = { ...prev };
      if (updated[subGroupID]) {
        updated[subGroupID] = updated[subGroupID].map(item => {
          if (item.itemID === itemID) {
            return { ...item, isEditing: false, tempDescription: undefined };
          }
          return item;
        });
      }
      return updated;
    });
  };

  const saveItemDescription = async (subGroupID: number, itemID: number, newDescription: string) => {
    if (!newDescription.trim()) {
      message.error("Item description cannot be empty");
      return;
    }

    try {
      const currentItem = itemsBySubGroup[subGroupID]?.find(item => item.itemID === itemID);
      
      await axios.put(`/EvaluationStructure/items/${itemID}`, {
        description: newDescription,
        itemType: currentItem?.itemType,
        itemTypeID: currentItem?.itemTypeID
      });

      setItemsBySubGroup(prev => {
        const updated = { ...prev };
        if (updated[subGroupID]) {
          updated[subGroupID] = updated[subGroupID].map(item => {
            if (item.itemID === itemID) {
              return { 
                ...item, 
                description: newDescription, 
                isEditing: false, 
                tempDescription: undefined 
              };
            }
            return item;
          });
        }
        return updated;
      });
      
      message.success("Item description updated successfully");
    } catch (error: any) {
      console.error("Error updating item:", error);
      message.error(`Failed to update item description: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleItemDescriptionChange = (subGroupID: number, itemID: number, value: string) => {
    setItemsBySubGroup(prev => {
      const updated = { ...prev };
      if (updated[subGroupID]) {
        updated[subGroupID] = updated[subGroupID].map(item => {
          if (item.itemID === itemID) {
            return { ...item, tempDescription: value };
          }
          return item;
        });
      }
      return updated;
    });
  };

  const addNewSubGroup = async (groupID: number) => {
    try {
      const response = await axios.post("/EvaluationStructure/subgroups", {
        groupID: groupID,
        name: "New SubGroup"
      });
      
      const newSubGroup = response.data;
      
      setGroups(prev => prev.map(group => {
        if (group.groupID === groupID) {
          return {
            ...group,
            subGroups: [...group.subGroups, { ...newSubGroup, isEditing: true, tempName: "New SubGroup" }]
          };
        }
        return group;
      }));
      
      setItemsBySubGroup(prev => ({
        ...prev,
        [newSubGroup.subGroupID]: []
      }));
      
      message.success("New subgroup added successfully");
    } catch (error: any) {
      console.error("Error adding subgroup:", error);
      message.error(`Failed to add new subgroup: ${error.response?.data || error.message}`);
    }
  };

  const addNewItem = async (subGroupID: number, itemType: 'teaching' | 'non-teaching' = 'teaching') => {
    try {
      const response = await axios.post("/EvaluationStructure/items", {
        subGroupID: subGroupID,
        description: itemType === 'non-teaching' ? "New Non-Teaching Item" : "New Teaching Item",
        itemType: itemType,
        itemTypeID: itemType === 'non-teaching' ? 2 : 1
      });
      
      const newItem = response.data;
      
      setItemsBySubGroup(prev => {
        const updated = { ...prev };
        if (!updated[subGroupID]) {
          updated[subGroupID] = [];
        }
        updated[subGroupID] = [...updated[subGroupID], { 
          ...newItem, 
          isEditing: true, 
          tempDescription: itemType === 'non-teaching' ? "New Non-Teaching Item" : "New Teaching Item"
        }];
        return updated;
      });
      
      message.success(`New ${itemType} item added successfully`);
    } catch (error: any) {
      console.error("Error adding item:", error);
      message.error(`Failed to add new item: ${error.response?.data?.message || error.message}`);
    }
  };

  const deleteSubGroup = async (groupID: number, subGroupID: number) => {
    try {
      await axios.delete(`/EvaluationStructure/subgroups/${subGroupID}`);
      
      setGroups(prev => prev.map(group => {
        if (group.groupID === groupID) {
          return {
            ...group,
            subGroups: group.subGroups.filter(sub => sub.subGroupID !== subGroupID)
          };
        }
        return group;
      }));
      
      setItemsBySubGroup(prev => {
        const updated = { ...prev };
        delete updated[subGroupID];
        return updated;
      });
      
      message.success("SubGroup deleted successfully");
    } catch (error: any) {
      console.error("Error deleting subgroup:", error);
      message.error(`Failed to delete subgroup: ${error.response?.data || error.message}`);
    }
  };

  const deleteItem = async (subGroupID: number, itemID: number) => {
    try {
      await axios.delete(`/EvaluationStructure/items/${itemID}`);
      
      setItemsBySubGroup(prev => {
        const updated = { ...prev };
        if (updated[subGroupID]) {
          updated[subGroupID] = updated[subGroupID].filter(item => item.itemID !== itemID);
        }
        return updated;
      });
      
      message.success("Item deleted successfully");
    } catch (error: any) {
      console.error("Error deleting item:", error);
      message.error(`Failed to delete item: ${error.response?.data || error.message}`);
    }
  };

  const availableDepartments = getAvailableDepartments();
  const selectedEmployee = employees.find(emp => emp.employeeID === selectedEmployeeID);
  const yearsOfService = selectedEmployeeID ? getYearsOfService(selectedEmployeeID) : 0;
  const bonusQualification = selectedEmployeeID && currentEfficiencyRating > 0 
    ? checkBonusQualification(currentEfficiencyRating, selectedEmployeeID) 
    : null;
  const nonTeachingPositions = getNonTeachingPositions();
  const positionFilteredEmployees = getFilteredEmployeesByPosition();
  const filteredGroups = getFilteredGroups();

  return (
    <Spin spinning={loading || submitting} tip={submitting ? "Submitting..." : "Loading..."}>
      <div style={{ padding: 20 }} className="evaluation-page">
        <header className="page-header">
          <h1>Employee Evaluation Form</h1>
          <p>Employee Performance Assessment - BCAS Performance Bonus System</p>
          <p className="evaluator-info">
            Evaluator: <span>{user?.username}</span>
            {userDepartment && ` (${userDepartment.departmentName})`}
            {(isAdmin || isHR) && (
              <>
                <Button 
                  type="link" 
                  onClick={() => setEditing(!editing)}
                  style={{ marginLeft: 10 }}
                >
                  {editing ? "Exit Edit Mode" : "Edit Form Structure"}
                </Button>
                <Button 
                  type="link" 
                  onClick={loadData}
                  style={{ marginLeft: 10 }}
                  loading={loading}
                >
                  Refresh Data
                </Button>
              </>
            )}
          </p>
          
          {/* Performance Bonus Requirements Info */}
          <Alert
            message="Performance Bonus Requirements"
            description={
              <div>
                <p style={{ marginBottom: 8 }}>To qualify for annual performance bonus, employees must:</p>
                <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                  <li>Not have any memorandums for policy violations</li>
                  <li><strong>Have an efficiency rating of 4.2 and above</strong> (4.5 for Assistants)</li>
                </ul>
              </div>
            }
            type="info"
            icon={<InfoCircleOutlined />}
            showIcon
            style={{ marginTop: 16 }}
          />
          
          {selectedEmployeeID && (
            <div style={{ 
              padding: '12px 16px', 
              backgroundColor: '#fff7e6', 
              border: '1px solid #ffd591',
              borderRadius: 4,
              marginTop: 12
            }}>
              <span style={{ color: '#d46b08', fontWeight: 'bold' }}>
                ⚠️ All questions are required. Please answer every question before submitting.
              </span>
            </div>
          )}
        </header>

        <div style={{ marginBottom: 20 }} className="form-section">
          <h2>Employee Information</h2>
          <div className="form-row">
            {/* Department Selection */}
            {(isAdmin || isHR) ? (
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>Select Department: </label>
                <select
                  value={selectedDepartmentID ?? ""}
                  onChange={(e) => handleDepartmentChange(Number(e.target.value))}
                  className="form-control"
                >
                  <option value="" disabled>
                    Select a department
                  </option>
                  {availableDepartments.map((dept) => (
                    <option key={dept.departmentID} value={dept.departmentID}>
                      {dept.departmentName}
                      {dept.departmentID === NON_TEACHING_DEPARTMENT_ID && " (All Non-teaching Staff)"}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>Department: </label>
                <div style={{ padding: '8px 0', fontWeight: 'bold' }}>
                  {userDepartment ? userDepartment.departmentName : 'N/A'}
                </div>
                {!userDepartment && (
                  <div style={{ color: '#ff4d4f', fontSize: '14px', marginTop: 4 }}>
                    No department assigned. Please contact administrator.
                  </div>
                )}
              </div>
            )}

            {/* Position Selection for Non-teaching Department */}
            {selectedDepartmentID === NON_TEACHING_DEPARTMENT_ID && (
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>Select Position: </label>
                <select
                  value={selectedPositionID ?? ""}
                  onChange={(e) => handlePositionChange(e.target.value ? Number(e.target.value) : null)}
                  className="form-control"
                >
                  <option value="" disabled>
                    Select a position first
                  </option>
                  {nonTeachingPositions.map(position => (
                    <option key={position.positionID} value={position.positionID || ''}>
                      {position.positionName}
                    </option>
                  ))}
                </select>
                {nonTeachingPositions.length === 0 && selectedDepartmentID === NON_TEACHING_DEPARTMENT_ID && (
                  <div style={{ color: '#ff4d4f', fontSize: '14px', marginTop: 4 }}>
                    No positions available for non-teaching staff evaluation.
                  </div>
                )}
              </div>
            )}

            {/* Employee Selection */}
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>
                {selectedDepartmentID === NON_TEACHING_DEPARTMENT_ID ? "Select Employee: " : "Select Employee: "}
              </label>
              <select
                value={selectedEmployeeID ?? ""}
                onChange={(e) => {
                  setSelectedEmployeeID(Number(e.target.value));
                  setScores([]);
                  setMissingScores([]);
                }}
                className="form-control"
                disabled={!selectedDepartmentID || (selectedDepartmentID === NON_TEACHING_DEPARTMENT_ID && !selectedPositionID)}
              >
                <option value="" disabled>
                  {selectedDepartmentID ? 
                    (selectedDepartmentID === NON_TEACHING_DEPARTMENT_ID ? 
                      (selectedPositionID ? `-- Select employee for this position --` : "-- Select position first --") 
                      : "-- Select an employee --") 
                    : "-- Select department first --"}
                </option>
                
                {positionFilteredEmployees.map((emp) => {
                  if (selectedDepartmentID === NON_TEACHING_DEPARTMENT_ID) {
                    return (
                      <option key={emp.employeeID} value={emp.employeeID}>
                        {emp.firstName} {emp.lastName}
                      </option>
                    );
                  }
                  
                  // Regular teaching staff display
                  const primaryDept = departments.find(d => d.departmentID === emp.departmentID)?.departmentName;
                  const secondaryDept = emp.departmentID2 ? departments.find(d => d.departmentID === emp.departmentID2)?.departmentName : null;
                  const tertiaryDept = emp.departmentID3 ? departments.find(d => d.departmentID === emp.departmentID3)?.departmentName : null;
                  
                  let departmentsString = [primaryDept, secondaryDept, tertiaryDept]
                    .filter(Boolean)
                    .join(' / ');
                  
                  return (
                    <option key={emp.employeeID} value={emp.employeeID}>
                      {emp.firstName} {emp.lastName} - {departmentsString}
                    </option>
                  );
                })}
                
                {positionFilteredEmployees.length === 0 && (
                  <option value="" disabled>
                    {selectedDepartmentID ? 
                      (selectedDepartmentID === NON_TEACHING_DEPARTMENT_ID ?
                        (selectedPositionID ? "No employees found for this position" : "Select a position first")
                        : "No available employees to evaluate") 
                      : "-- Select department first --"}
                  </option>
                )}
              </select>
              {selectedDepartmentID && positionFilteredEmployees.length === 0 && (
                <div style={{ marginTop: 8, color: '#ff4d4f', fontSize: '14px' }}>
                  {isCoordinator 
                    ? "No employees available for evaluation in this department, or you have already evaluated all available employees. Note: Coordinators cannot evaluate other coordinators or non-teaching staff."
                    : selectedDepartmentID === NON_TEACHING_DEPARTMENT_ID
                    ? selectedPositionID 
                      ? "No employees found for the selected position."
                      : "Please select a position first."
                    : "No employees available for evaluation in this department, or you have already evaluated all employees."
                  }
                </div>
              )}
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
                Evaluation Date:
              </label>
              <DatePicker
                value={evaluationDate}
                onChange={(date) => setEvaluationDate(date || dayjs())}
                format="MMMM DD, YYYY"
                style={{ width: '100%', maxWidth: '300px' }}
                disabledDate={(current) => {
                  // Cannot select future dates
                  return current && current > dayjs().endOf('day');
                }}
                size="large"
                placeholder="Select evaluation date"
              />
              <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                Select the date when the evaluation was conducted
              </div>
            </div>
          </div>

         

          {/* Real-time Efficiency Rating Display */}
          {selectedEmployeeID && (
            <Card 
              style={{ 
                marginTop: 20, 
                backgroundColor: '#f0f5ff',
                border: `2px solid ${getRatingColor(currentEfficiencyRating)}`
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                <div style={{ flex: 1, minWidth: 250 }}>
                  <h3 style={{ margin: 0, marginBottom: 8 }}>
                    {selectedEmployee?.firstName} {selectedEmployee?.lastName}
                  </h3>
                  <p style={{ margin: 0, color: '#666' }}>
                    Position: {selectedEmployee?.position || 'N/A'} | 
                    Years of Service: {yearsOfService} {yearsOfService === 1 ? 'year' : 'years'}
                  </p>
                  <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
                    Evaluation Type: {getGroupTypeForEmployee(selectedEmployeeID) === 1 ? 'Teaching' : 
                                     getGroupTypeForEmployee(selectedEmployeeID) === 3 ? 'Admin Staff' :
                                     getGroupTypeForEmployee(selectedEmployeeID) === 4 ? 'Security' :
                                     getGroupTypeForEmployee(selectedEmployeeID) === 5 ? 'Maintenance' : 'General'}
                  </p>
                </div>
                
                <div style={{ textAlign: 'center', minWidth: 200 }}>
                  <div style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>
                    Current Efficiency Rating
                  </div>
                  <div style={{ 
                    fontSize: 36, 
                    fontWeight: 'bold', 
                    color: getRatingColor(currentEfficiencyRating)
                  }}>
                    {currentEfficiencyRating > 0 ? currentEfficiencyRating.toFixed(2) : '--'}
                  </div>
                  <div style={{ fontSize: 14, color: getRatingColor(currentEfficiencyRating), fontWeight: 500 }}>
                    {currentEfficiencyRating > 0 ? getRatingLabel(currentEfficiencyRating) : 'Not yet rated'}
                  </div>
                  
                  {currentEfficiencyRating > 0 && (
                    <Progress 
                      percent={(currentEfficiencyRating / 5) * 100} 
                      strokeColor={getRatingColor(currentEfficiencyRating)}
                      showInfo={false}
                      style={{ marginTop: 8 }}
                    />
                  )}
                </div>
                
                {bonusQualification && currentEfficiencyRating > 0 && (
                  <div style={{ 
                    flex: '0 0 auto', 
                    padding: '12px 16px', 
                    borderRadius: 8,
                    backgroundColor: bonusQualification.qualifies ? '#f6ffed' : '#fff1f0',
                    border: `1px solid ${bonusQualification.qualifies ? '#b7eb8f' : '#ffccc7'}`
                  }}>
                    <div style={{ 
                      fontSize: 14, 
                      fontWeight: 'bold',
                      color: bonusQualification.qualifies ? '#52c41a' : '#ff4d4f',
                      marginBottom: 4
                    }}>
                      {bonusQualification.qualifies ? '✓ Qualifies for Bonus' : '✗ Does Not Qualify'}
                    </div>
                    <div style={{ fontSize: 12, color: '#666' }}>
                      {bonusQualification.reason}
                    </div>
                  </div>
                )}
              </div>
              
              {scores.length > 0 && getVisibleSubGroups().length > 0 && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #d9d9d9' }}>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    Progress: {scores.length} / {getVisibleSubGroups().length} questions answered
                  </div>
                  <Progress 
                    percent={(scores.length / getVisibleSubGroups().length) * 100} 
                    strokeColor="#1890ff"
                    style={{ marginTop: 4 }}
                  />
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Show warning if no evaluation form available for selected employee */}
        {selectedEmployeeID && filteredGroups.length === 0 && (
          <Alert
            message="No Evaluation Form Available"
            description={`No evaluation form is configured for this employee's position type (${getGroupTypeForEmployee(selectedEmployeeID) === 1 ? 'Teaching' : 
                         getGroupTypeForEmployee(selectedEmployeeID) === 3 ? 'Admin Staff' :
                         getGroupTypeForEmployee(selectedEmployeeID) === 4 ? 'Security' :
                         getGroupTypeForEmployee(selectedEmployeeID) === 5 ? 'Maintenance' : 'General'}). Please contact administrator.`}
            type="warning"
            showIcon
            style={{ marginBottom: 20 }}
          />
        )}

        {filteredGroups.map((group) => (
          <div key={group.groupID} style={{ marginBottom: 30 }} className="form-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              {group.isEditing ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Input
                    value={group.tempDescription || group.description}
                    onChange={(e) => handleGroupDescriptionChange(group.groupID, e.target.value)}
                    style={{ width: 400 }}
                    placeholder="Enter group description"
                  />
                  <Button 
                    size="small" 
                    type="primary"
                    onClick={() => saveGroupDescription(group.groupID, group.tempDescription || group.description)}
                  >
                    Save
                  </Button>
                  <Button 
                    size="small" 
                    onClick={() => cancelEditingGroup(group.groupID)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <>
                  <h2 style={{ margin: 0 }}>
                    {group.description}
                    {editing && (
                      <Button 
                        type="link" 
                        size="small" 
                        icon={<EditOutlined />}
                        onClick={() => startEditingGroup(group.groupID)}
                        style={{ marginLeft: 8 }}
                      >
                        Edit Name
                      </Button>
                    )}
                  </h2>
                  {editing && (
                    <Button 
                      type="dashed" 
                      onClick={() => addNewSubGroup(group.groupID)}
                    >
                      + Add SubGroup
                    </Button>
                  )}
                </>
              )}
            </div>

            {group.subGroups && group.subGroups.length > 0 ? (
              group.subGroups.map((sub) => {
                const items = itemsBySubGroup[sub.subGroupID] || [];
                const hasTeachingItems = shouldShowTeachingItems(selectedEmployeeID || 0) && 
                                        getItemsByType(items, 'teaching').length > 0;
                const hasNonTeachingItems = shouldShowNonTeachingItems(selectedEmployeeID || 0) && 
                                           getItemsByType(items, 'non-teaching').length > 0;
                
                if (!editing && selectedEmployeeID && !hasTeachingItems && !hasNonTeachingItems) {
                  return null;
                }
                
                const isMissing = missingScores.includes(sub.subGroupID);
                
                return (
                  <div
                    key={sub.subGroupID}
                    id={`subgroup-${sub.subGroupID}`}
                    style={{ 
                      marginBottom: 20, 
                      border: isMissing ? '2px solid #ff4d4f' : '1px solid #d9d9d9', 
                      padding: 16, 
                      borderRadius: 8,
                      backgroundColor: isMissing ? '#fff1f0' : 'white',
                      transition: 'all 0.3s ease'
                    }}
                    className="rating-group"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                      <p style={{ margin: 0, flex: 1 }}>
                        <strong>Group:</strong> 
                        {sub.isEditing ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                            <Input
                              value={sub.tempName || sub.name}
                              onChange={(e) => handleSubGroupNameChange(group.groupID, sub.subGroupID, e.target.value)}
                              style={{ width: 300 }}
                              placeholder="Enter subgroup name"
                            />
                            <Button 
                              size="small" 
                              type="primary"
                              onClick={() => saveSubGroupName(group.groupID, sub.subGroupID, sub.tempName || sub.name)}
                            >
                              Save
                            </Button>
                            <Button 
                              size="small" 
                              onClick={() => cancelEditingSubGroup(group.groupID, sub.subGroupID)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <span style={{ marginLeft: 8 }}>
                            {sub.name}
                            {selectedEmployeeID && (
                              <span style={{ color: '#ff4d4f', marginLeft: 4, fontWeight: 'bold' }}>*</span>
                            )}
                            {editing && (
                              <div style={{ display: 'inline-flex', gap: 4, marginLeft: 8 }}>
                                <Button 
                                  type="link" 
                                  size="small" 
                                  icon={<EditOutlined />}
                                  onClick={() => startEditingSubGroup(group.groupID, sub.subGroupID)}
                                >
                                  Edit Name
                                </Button>
                                <Button 
                                  type="link" 
                                  size="small" 
                                  danger
                                  icon={<DeleteOutlined />}
                                  onClick={() => deleteSubGroup(group.groupID, sub.subGroupID)}
                                >
                                  Delete
                                </Button>
                              </div>
                            )}
                          </span>
                        )}
                      </p>
                    </div>
                    
                    {(!selectedEmployeeID || shouldShowTeachingItems(selectedEmployeeID)) && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          
                          {editing && (
                            <Button 
                              type="dashed" 
                              size="small"
                              onClick={() => addNewItem(sub.subGroupID, 'teaching')}
                            >
                              + Add Teaching Item
                            </Button>
                          )}
                        </div>
                        
                        {getItemsByType(items, 'teaching').length > 0 && (
                          <div style={{ padding: '8px 0', borderBottom: '1px solid #e8e8e8' }}>
                            <strong style={{ color: '#1890ff' }}>Items:</strong>
                          </div>
                        )}
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                          {getItemsByType(items, 'teaching').map((item) => (
                            <li key={item.itemID} style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                              {item.isEditing ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <Input
                                    value={item.tempDescription || item.description}
                                    onChange={(e) => handleItemDescriptionChange(sub.subGroupID, item.itemID, e.target.value)}
                                    style={{ flex: 1 }}
                                    placeholder="Enter item description"
                                  />
                                  <Button 
                                    size="small" 
                                    type="primary"
                                    onClick={() => saveItemDescription(sub.subGroupID, item.itemID, item.tempDescription || item.description)}
                                  >
                                    Save
                                  </Button>
                                  <Button 
                                    size="small" 
                                    onClick={() => cancelEditingItem(sub.subGroupID, item.itemID)}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ flex: 1 }}>{item.description}</span>
                                  {editing && (
                                    <div style={{ display: 'flex', gap: 4 }}>
                                      <Button 
                                        type="link" 
                                        size="small" 
                                        icon={<EditOutlined />}
                                        onClick={() => startEditingItem(sub.subGroupID, item.itemID)}
                                      >
                                        Edit
                                      </Button>
                                      <Button 
                                        type="link" 
                                        size="small" 
                                        danger
                                        icon={<DeleteOutlined />}
                                        onClick={() => deleteItem(sub.subGroupID, item.itemID)}
                                      >
                                        Delete
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {!isCoordinator && (!selectedEmployeeID || shouldShowNonTeachingItems(selectedEmployeeID)) && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                       
                          {editing && (
                            <Button 
                              type="dashed" 
                              size="small"
                              onClick={() => addNewItem(sub.subGroupID, 'non-teaching')}
                            >
                              + Add Non-Teaching Item
                            </Button>
                          )}
                        </div>
                        
                        {getItemsByType(items, 'non-teaching').length > 0 && (
                          <div style={{ padding: '8px 0', borderBottom: '1px solid #e8e8e8' }}>
                            <strong style={{ color: '#52c41a' }}>Items:</strong>
                          </div>
                        )}
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                          {getItemsByType(items, 'non-teaching').map((item) => (
                            <li key={item.itemID} style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                              {item.isEditing ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <Input
                                    value={item.tempDescription || item.description}
                                    onChange={(e) => handleItemDescriptionChange(sub.subGroupID, item.itemID, e.target.value)}
                                    style={{ flex: 1 }}
                                    placeholder="Enter item description"
                                  />
                                  <Button 
                                    size="small" 
                                    type="primary"
                                    onClick={() => saveItemDescription(sub.subGroupID, item.itemID, item.tempDescription || item.description)}
                                  >
                                    Save
                                  </Button>
                                  <Button 
                                    size="small" 
                                    onClick={() => cancelEditingItem(sub.subGroupID, item.itemID)}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ flex: 1 }}>{item.description}</span>
                                  {editing && (
                                    <div style={{ display: 'flex', gap: 4 }}>
                                      <Button 
                                        type="link" 
                                        size="small" 
                                        icon={<EditOutlined />}
                                        onClick={() => startEditingItem(sub.subGroupID, item.itemID)}
                                      >
                                        Edit
                                      </Button>
                                      <Button 
                                        type="link" 
                                        size="small" 
                                        danger
                                        icon={<DeleteOutlined />}
                                        onClick={() => deleteItem(sub.subGroupID, item.itemID)}
                                      >
                                        Delete
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {(!items || items.length === 0) && (
                      <div style={{ padding: '16px 0', textAlign: 'center' }}>
                        <p style={{ color: '#999', fontStyle: 'italic', margin: 0 }}>
                          No items available for this subgroup.
                          {editing && ' Click "Add Teaching Item" or "Add Non-Teaching Item" to create one.'}
                        </p>
                      </div>
                    )}
                    
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #e8e8e8' }}>
                      <strong>
                        Rating:
                        {selectedEmployeeID && (
                          <span style={{ color: '#ff4d4f', marginLeft: 4 }}>* </span>
                        )}
                        {isMissing && (
                          <span style={{ color: '#ff4d4f', marginLeft: 8, fontSize: '14px' }}>
                             Please select a rating
                          </span>
                        )}
                      </strong>
                      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                        {scoreChoices.map((choice) => (
                          <label key={choice.value} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                            <input
                              type="radio"
                              name={`subgroup-${sub.subGroupID}`}
                              value={choice.value}
                              checked={
                                scores.find((s) => s.subGroupID === sub.subGroupID)
                                  ?.scoreValue === choice.value
                              }
                              onChange={() => handleScoreChange(sub.subGroupID, choice.value)}
                              style={{ marginRight: 4 }}
                              disabled={!selectedEmployeeID}
                            />
                            {choice.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ padding: 24, textAlign: 'center', border: '1px dashed #d9d9d9', borderRadius: 8 }}>
                <p style={{ marginBottom: 16 }}>No subgroups under this group.</p>
                {editing && (
                  <Button 
                    type="dashed" 
                    onClick={() => addNewSubGroup(group.groupID)}
                  >
                    + Add First SubGroup
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
            Additional Comments:
          </label>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={4}
            style={{ 
              width: '100%', 
              maxWidth: 600,
              padding: 8, 
              border: '1px solid #d9d9d9', 
              borderRadius: 4,
              resize: 'vertical'
            }}
            placeholder="Enter additional comments about the employee's performance..."
            disabled={!selectedEmployeeID}
          />
        </div>

        <Button 
          type="primary" 
          size="large"
          onClick={handleSubmit}
          loading={submitting}
          disabled={!selectedDepartmentID || !selectedEmployeeID || getFilteredGroups().length === 0}
          style={{ minWidth: 200 }}
        >
          Submit Evaluation
        </Button>
      </div>
    </Spin>
  );
};

export default EvaluationFormPage;