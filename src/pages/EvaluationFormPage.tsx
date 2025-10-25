// File: src/pages/EvaluationFormPage.tsx

import { useEffect, useState } from "react";
import axios from "../api/_axiosInstance";
import DepartmentService from "../api/DepartmentService";
import { Spin, Input, Button, message } from "antd";
import { EditOutlined, DeleteOutlined } from "@ant-design/icons";
import './EvaluationPage.css';
import { ROLES } from "../types/auth";
import { useAuth } from "../types/useAuth";

// Types
type ScoreChoice = {
  value: number;
  label: string;
};

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
  position?: string; // Add position field
};

const scoreChoices: ScoreChoice[] = [
  { value: 1, label: "Poor" },
  { value: 2, label: "Fair" },
  { value: 3, label: "Satisfactory" },
  { value: 4, label: "Very Satisfactory" },
  { value: 5, label: "Excellent" },
];

// Special ID for the virtual Non-teachers department
const NON_TEACHING_DEPARTMENT_ID = -1;

const EvaluationFormPage = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [selectedDepartmentID, setSelectedDepartmentID] = useState<number | null>(null);
  const [selectedEmployeeID, setSelectedEmployeeID] = useState<number | null>(null);
  const [comments, setComments] = useState("");
  const [scores, setScores] = useState<SubGroupScore[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [userDepartment, setUserDepartment] = useState<Department | null>(null);
  const [editing, setEditing] = useState<boolean>(false);
  
  // Use useAuth hook properly
  const { user } = useAuth();
  
  const isAdmin = user?.roleId === ROLES.Admin;
  const isHR = user?.roleId === ROLES.HR;
  const isCoordinator = user?.roleId === ROLES.Coordinator;

  const [itemsBySubGroup, setItemsBySubGroup] = useState<Record<number, Item[]>>({});
  const [employeeRoles, setEmployeeRoles] = useState<Record<number, number>>({});

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
    
    // Add Non-teachers as a virtual department option for Admin/HR
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

  // Helper functions to determine which items to show based on employee role
  const shouldShowTeachingItems = (employeeID: number) => {
    if (!employeeID) return true;
    const role = employeeRoles[employeeID];
    // Non-teaching employees should never show teaching items
    return role !== ROLES.NonTeaching && 
           (role === ROLES.Teaching || role === ROLES.Coordinator || role === ROLES.Admin || role === ROLES.HR);
  };

  const shouldShowNonTeachingItems = (employeeID: number) => {
    if (!employeeID) return true;
    const role = employeeRoles[employeeID];
    
    // Coordinators should never see non-teaching items
    if (isCoordinator) {
      return false;
    }
    
    // Only non-teaching employees should show non-teaching items for other roles
    return role === ROLES.NonTeaching || role === ROLES.Admin || role === ROLES.HR;
  };

  // Helper to filter items by type using actual database fields - FIXED LOGIC
  const getItemsByType = (items: Item[], type: 'teaching' | 'non-teaching') => {
    if (!items) return [];
    
    return items.filter(item => {
      if (type === 'teaching') {
        // Show items that are explicitly teaching OR have no type specified (default to teaching)
        return item.itemType === 'teaching' || item.itemTypeID === 1 || !item.itemType || item.itemTypeID === null;
      } else {
        // Show only items that are explicitly non-teaching
        return item.itemType === 'non-teaching' || item.itemTypeID === 2;
      }
    });
  };

  const filteredEmployees = selectedDepartmentID
    ? employees.filter(emp => {
        if (emp.employeeID === user?.employeeId) {
          return false;
        }
        
        // Check if this is the "Non-teachers" department
        const isNonTeachingDepartment = selectedDepartmentID === NON_TEACHING_DEPARTMENT_ID;
        
        if (isNonTeachingDepartment) {
          // Only show non-teaching employees in the Non-teachers department
          const targetEmployeeRole = employeeRoles[emp.employeeID];
          return targetEmployeeRole === ROLES.NonTeaching;
        } else {
          // For regular departments, exclude non-teaching employees
          const targetEmployeeRole = employeeRoles[emp.employeeID];
          if (targetEmployeeRole === ROLES.NonTeaching) {
            return false;
          }
          
          if (isCoordinator) {
            if (targetEmployeeRole === ROLES.Coordinator || targetEmployeeRole === ROLES.NonTeaching) {
              return false;
            }
          }
          
          const belongsToDepartment = 
            emp.departmentID === selectedDepartmentID ||
            emp.departmentID2 === selectedDepartmentID || 
            emp.departmentID3 === selectedDepartmentID;
          
          if (belongsToDepartment) {
            const userHasEvaluated = hasUserEvaluatedEmployee(emp.employeeID);
            if (userHasEvaluated) {
              return false;
            }
            
            return true;
          }
          return false;
        }
      })
    : [];

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

  const loadData = async () => {
    setLoading(true);
    try {
      const [groupsRes, employeesRes, departmentsRes, evaluationsRes] = await Promise.all([
        axios.get("/EvaluationStructure/groups"),
        axios.get("/Employees"),
        DepartmentService.getAll(),
        axios.get("/Evaluations")
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

      const allSubgroups = groupsData.flatMap((g) => g.subGroups);
      const subItemsList = await Promise.all(
        allSubgroups.map(async (sub) => {
          try {
            const respItems = await axios.get(`/EvaluationStructure/items/by-subgroup/${sub.subGroupID}`);
            
            // Use actual database fields
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
    setScores([]); // Reset scores when department changes
  };

  const handleScoreChange = (subGroupID: number, value: number) => {
    setScores((prev) => {
      const without = prev.filter((s) => s.subGroupID !== subGroupID);
      return [...without, { subGroupID, scoreValue: value }];
    });
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

    if (isCoordinator) {
      const targetEmployeeRole = employeeRoles[selectedEmployeeID];
      if (targetEmployeeRole === ROLES.Coordinator) {
        message.error("Coordinators cannot evaluate other coordinators.");
        return;
      }
      if (targetEmployeeRole === ROLES.NonTeaching) {
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

    // SIMPLIFIED VALIDATION - Just check if at least one score is provided
    if (scores.length === 0) {
      message.error("Please provide ratings for at least one subgroup.");
      return;
    }

    const evaluation: Evaluation = {
      employeeID: selectedEmployeeID,
      evaluatorID: user.employeeId,
      evaluationDate: new Date().toISOString(),
      comments: comments,
      scores: scores,
    };

    // Debug log
    console.log('Submitting evaluation:', {
      employeeID: evaluation.employeeID,
      evaluatorID: evaluation.evaluatorID,
      scoresCount: evaluation.scores.length,
      scores: evaluation.scores,
      comments: evaluation.comments
    });

    setSubmitting(true);

    axios
      .post("/Evaluations", evaluation)
      .then((response) => {
        message.success("Evaluation submitted successfully.");
        
        setEvaluations(prev => [...prev, response.data]);
        
        if (isAdmin || isHR) {
          setSelectedDepartmentID(null);
        } else {
          setSelectedDepartmentID(userDepartment?.departmentID || null);
        }
        setSelectedEmployeeID(null);
        setComments("");
        setScores([]);
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

  // Item editing functions - FIXED: Now includes itemType and itemTypeID
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
      // Get the current item to preserve itemType and itemTypeID
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

  // Add new subgroup
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

  // Add new item - using actual database fields
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

  // Delete subgroup
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

  // Delete item
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

  return (
    <Spin spinning={loading || submitting} tip={submitting ? "Submitting..." : "Loading..."}>
      <div style={{ padding: 20 }} className="evaluation-page">
        <h1>Employee Evaluation</h1>

        <header className="page-header">
          <h1>Employee Evaluation Form</h1>
          <p>Employee Performance Assessment</p>
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
        </header>

        <div style={{ marginBottom: 20 }} className="form-section">
          <h2>Employee Information</h2>
          <div className="form-row">
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

            <div className="form-group">
              <label>Select Employee: </label>
              <select
                value={selectedEmployeeID ?? ""}
                onChange={(e) => {
                  setSelectedEmployeeID(Number(e.target.value));
                  setScores([]); // Reset scores when employee changes
                }}
                className="form-control"
                disabled={!selectedDepartmentID}
              >
                <option value="" disabled>
                  {selectedDepartmentID ? "-- Select an employee --" : "-- Select department first --"}
                </option>
                {filteredEmployees.length > 0 ? (
                  filteredEmployees.map((emp) => {
                    const role = employeeRoles[emp.employeeID];
                    const isNonTeaching = role === ROLES.NonTeaching;
                    
                    // For Non-teaching employees, show position instead of role and department
                    if (isNonTeaching) {
                      return (
                        <option key={emp.employeeID} value={emp.employeeID}>
                          {emp.firstName} {emp.lastName} - {emp.position || 'Non-Teaching Staff'}
                        </option>
                      );
                    }
                    
                    // For other employees, show role and department as before
                    const primaryDept = departments.find(d => d.departmentID === emp.departmentID)?.departmentName;
                    const secondaryDept = emp.departmentID2 ? departments.find(d => d.departmentID === emp.departmentID2)?.departmentName : null;
                    const tertiaryDept = emp.departmentID3 ? departments.find(d => d.departmentID === emp.departmentID3)?.departmentName : null;
                    
                    let departmentsString = [primaryDept, secondaryDept, tertiaryDept]
                      .filter(Boolean)
                      .join(' / ');
                    
                    const roleName = role === ROLES.Teaching ? 'Teaching' : 
                                   role === ROLES.Coordinator ? 'Coordinator' : 
                                   role === ROLES.Admin ? 'Admin' : 
                                   role === ROLES.HR ? 'HR' : 'Unknown';
                    
                    return (
                      <option key={emp.employeeID} value={emp.employeeID}>
                        {emp.firstName} {emp.lastName} ({roleName}) - {departmentsString}
                      </option>
                    );
                  })
                ) : (
                  <option value="" disabled>
                    {selectedDepartmentID ? "No available employees to evaluate" : "-- Select department first --"}
                  </option>
                )}
              </select>
              {selectedDepartmentID && filteredEmployees.length === 0 && (
                <div style={{ marginTop: 8, color: '#ff4d4f', fontSize: '14px' }}>
                  {isCoordinator 
                    ? "No employees available for evaluation in this department, or you have already evaluated all available employees. Note: Coordinators cannot evaluate other coordinators or non-teaching staff."
                    : selectedDepartmentID === NON_TEACHING_DEPARTMENT_ID
                    ? "No non-teaching employees available for evaluation, or you have already evaluated all non-teaching staff."
                    : "No employees available for evaluation in this department, or you have already evaluated all employees."
                  }
                </div>
              )}
            </div>
          </div>
        </div>

        {groups.map((group) => (
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
              group.subGroups.map((sub) => (
                <div
                  key={sub.subGroupID}
                  style={{ marginBottom: 20, border: '1px solid #d9d9d9', padding: 16, borderRadius: 8 }}
                  className="rating-group"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <p style={{ margin: 0, flex: 1 }}>
                      <strong>SubGroup:</strong> 
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
                  
                  {/* Teaching Items Section */}
                  {(!selectedEmployeeID || shouldShowTeachingItems(selectedEmployeeID)) && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <strong>Teaching Evaluation Items:</strong>
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
                      
                      {getItemsByType(itemsBySubGroup[sub.subGroupID] || [], 'teaching').length > 0 && (
                        <div style={{ padding: '8px 0', borderBottom: '1px solid #e8e8e8' }}>
                          <strong style={{ color: '#1890ff' }}>Teaching Items:</strong>
                        </div>
                      )}
                      <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                        {getItemsByType(itemsBySubGroup[sub.subGroupID] || [], 'teaching').map((item) => (
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

                  {/* Non-Teaching Items Section - Completely hidden from Coordinators */}
                  {!isCoordinator && (!selectedEmployeeID || shouldShowNonTeachingItems(selectedEmployeeID)) && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <strong>Non-Teaching Evaluation Items:</strong>
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
                      
                      {getItemsByType(itemsBySubGroup[sub.subGroupID] || [], 'non-teaching').length > 0 && (
                        <div style={{ padding: '8px 0', borderBottom: '1px solid #e8e8e8' }}>
                          <strong style={{ color: '#52c41a' }}>Non-Teaching Items:</strong>
                        </div>
                      )}
                      <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                        {getItemsByType(itemsBySubGroup[sub.subGroupID] || [], 'non-teaching').map((item) => (
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

                  {/* No Items Message */}
                  {(!itemsBySubGroup[sub.subGroupID] || itemsBySubGroup[sub.subGroupID].length === 0) && (
                    <div style={{ padding: '16px 0', textAlign: 'center' }}>
                      <p style={{ color: '#999', fontStyle: 'italic', margin: 0 }}>
                        No items available for this subgroup.
                        {editing && ' Click "Add Teaching Item" or "Add Non-Teaching Item" to create one.'}
                      </p>
                    </div>
                  )}
                  
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #e8e8e8' }}>
                    <strong>Rating:</strong>
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
                          />
                          {choice.label}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              ))
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
          />
        </div>

        <Button 
          type="primary" 
          size="large"
          onClick={handleSubmit}
          loading={submitting}
          disabled={!selectedDepartmentID || !selectedEmployeeID || scores.length === 0}
          style={{ minWidth: 200 }}
        >
          Submit Evaluation
        </Button>
      </div>
    </Spin>
  );
};

export default EvaluationFormPage;