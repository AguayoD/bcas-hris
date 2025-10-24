// File: src/pages/EvaluationFormPage.tsx

import { useEffect, useState } from "react";
import axios from "../api/_axiosInstance";
import DepartmentService from "../api/DepartmentService";
import { Spin, Input, Button, message } from "antd";
import { EditOutlined } from "@ant-design/icons";
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

// Department type
type Department = {
  departmentID: number;
  departmentName: string;
  description?: string;
};

// Employee type with department info
type Employee = {
  employeeID: number;
  firstName: string;
  lastName: string;
  departmentID: number;
  departmentID2?: number | null;
  departmentID3?: number | null;
  departmentName?: string;
};

// Static score choices
const scoreChoices: ScoreChoice[] = [
  { value: 1, label: "Poor" },
  { value: 2, label: "Fair" },
  { value: 3, label: "Satisfactory" },
  { value: 4, label: "Very Satisfactory" },
  { value: 5, label: "Excellent" },
];

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
  const [userData, setUserData] = useState<any>(null);
  const [userDepartment, setUserDepartment] = useState<Department | null>(null);
  const [editing, setEditing] = useState<boolean>(false);
  const { user } = useAuth();
  const isAdmin = user?.roleId === ROLES.Admin;
  const isHR = user?.roleId === ROLES.HR;
  const isCoordinator = user?.roleId === ROLES.Coordinator;

  // A map from subGroupID → list of items
  const [itemsBySubGroup, setItemsBySubGroup] = useState<Record<number, Item[]>>({});

  // Employee roles mapping (employeeID -> roleId)
  const [employeeRoles, setEmployeeRoles] = useState<Record<number, number>>({});

  // Function to check if current user has already evaluated a specific employee
  const hasUserEvaluatedEmployee = (employeeID: number) => {
    return evaluations.some(evalItem => 
      evalItem.employeeID === employeeID && evalItem.evaluatorID === userData?.employeeId
    );
  };

  // Get user's department from employees list
  const getUserDepartment = () => {
    if (!userData?.employeeId || employees.length === 0) return null;
    
    const userEmployee = employees.find(emp => emp.employeeID === userData.employeeId);
    if (!userEmployee) return null;
    
    return departments.find(dept => dept.departmentID === userEmployee.departmentID) || null;
  };

  // Get available departments based on user role
  const getAvailableDepartments = () => {
    if (isAdmin || isHR) {
      return departments;
    }
    // Regular users can only see their own department
    return userDepartment ? [userDepartment] : [];
  };

  // Filtered employees based on selected department AND prevent self-evaluation AND prevent duplicate evaluation by same user AND prevent coordinators from evaluating other coordinators
  const filteredEmployees = selectedDepartmentID
    ? employees.filter(emp => {
        // Prevent evaluators from evaluating themselves
        if (emp.employeeID === userData?.employeeId) {
          return false;
        }
        
        // Prevent coordinators from evaluating other coordinators
        if (isCoordinator) {
          const targetEmployeeRole = employeeRoles[emp.employeeID];
          if (targetEmployeeRole === ROLES.Coordinator) {
            return false;
          }
        }
        
        // Check if employee belongs to selected department (primary, secondary, or tertiary)
        const belongsToDepartment = 
          emp.departmentID === selectedDepartmentID ||
          emp.departmentID2 === selectedDepartmentID || 
          emp.departmentID3 === selectedDepartmentID;
        
        if (belongsToDepartment) {
          // Check if current user has already evaluated this employee
          const userHasEvaluated = hasUserEvaluatedEmployee(emp.employeeID);
          
          // If user has already evaluated this employee, don't show them
          if (userHasEvaluated) {
            return false;
          }
          
          return true;
        }
        return false;
      })
    : [];

  useEffect(() => {
    const userDataStr = localStorage.getItem("userData");
    
    if (userDataStr) {
      try {
        const user = JSON.parse(userDataStr);
        setUserData(user);
      } catch (e) {
        console.error("Invalid userData in localStorage");
      }
    }

    loadData();
  }, []);

  // Update user department when employees and departments are loaded
  useEffect(() => {
    if (employees.length > 0 && departments.length > 0 && userData?.employeeId) {
      const department = getUserDepartment();
      setUserDepartment(department);
      
      // Auto-select department for non-admin/HR users
      if (department && !isAdmin && !isHR) {
        setSelectedDepartmentID(department.departmentID);
      }
    }
  }, [employees, departments, userData]);

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

      // Store full evaluations instead of just IDs
      setEvaluations(evaluationsRes.data);

      // Fetch items for all subgroups
      const allSubgroups = groupsData.flatMap((g) => g.subGroups);
      const subItemsList = await Promise.all(
        allSubgroups.map(async (sub) => {
          try {
            const respItems = await axios.get(`/EvaluationStructure/items/by-subgroup/${sub.subGroupID}`);
            return { subGroupID: sub.subGroupID, items: respItems.data || [] };
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

      // Fetch user data to get roles for all employees
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

    // Additional check to prevent self-evaluation
    if (selectedEmployeeID === userData?.employeeId) {
      message.error("You cannot evaluate yourself.");
      return;
    }

    // Additional check to prevent coordinators from evaluating other coordinators
    if (isCoordinator) {
      const targetEmployeeRole = employeeRoles[selectedEmployeeID];
      if (targetEmployeeRole === ROLES.Coordinator) {
        message.error("Coordinators cannot evaluate other coordinators.");
        return;
      }
    }

    // Additional check to prevent duplicate evaluation
    if (hasUserEvaluatedEmployee(selectedEmployeeID)) {
      message.error("You have already evaluated this employee.");
      return;
    }

    if (!userData?.employeeId) {
      message.error("Evaluator information missing. Please log in again.");
      return;
    }

    if (scores.length === 0) {
      message.error("Please provide ratings for at least one subgroup.");
      return;
    }

    const evaluation: Evaluation = {
      employeeID: selectedEmployeeID,
      evaluatorID: userData.employeeId,
      evaluationDate: new Date().toISOString(),
      comments: comments,
      scores: scores,
    };

    setSubmitting(true);

    axios
      .post("/Evaluations", evaluation)
      .then((response) => {
        message.success("Evaluation submitted successfully.");
        
        // Add the new evaluation to evaluations state
        setEvaluations(prev => [...prev, response.data]);
        
        // Reset form
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
        message.error("Error submitting evaluation.");
      })
      .finally(() => {
        setSubmitting(false);
      });
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
      await axios.put(`/EvaluationStructure/items/${itemID}`, {
        subGroupID: subGroupID,
        description: newDescription
      });

      setItemsBySubGroup(prev => {
        const updated = { ...prev };
        if (updated[subGroupID]) {
          updated[subGroupID] = updated[subGroupID].map(item => {
            if (item.itemID === itemID) {
              return { ...item, description: newDescription, isEditing: false, tempDescription: undefined };
            }
            return item;
          });
        }
        return updated;
      });
      
      message.success("Item description updated successfully");
    } catch (error: any) {
      console.error("Error updating item:", error);
      message.error(`Failed to update item description: ${error.response?.data || error.message}`);
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
      
      // Initialize empty items array for this new subgroup
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

  // Add new item
  const addNewItem = async (subGroupID: number) => {
    try {
      const response = await axios.post("/EvaluationStructure/items", {
        subGroupID: subGroupID,
        description: "New Item Description"
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
          tempDescription: "New Item Description" 
        }];
        return updated;
      });
      
      message.success("New item added successfully");
    } catch (error: any) {
      console.error("Error adding item:", error);
      message.error(`Failed to add new item: ${error.response?.data || error.message}`);
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
            Evaluator: <span>{userData?.username}</span>
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
                onChange={(e) => setSelectedEmployeeID(Number(e.target.value))}
                className="form-control"
                disabled={!selectedDepartmentID}
              >
                <option value="" disabled>
                  {selectedDepartmentID ? "-- Select an employee --" : "-- Select department first --"}
                </option>
                {filteredEmployees.length > 0 ? (
                  filteredEmployees.map((emp) => {
                    // Get all department names
                    const primaryDept = departments.find(d => d.departmentID === emp.departmentID)?.departmentName;
                    const secondaryDept = emp.departmentID2 ? departments.find(d => d.departmentID === emp.departmentID2)?.departmentName : null;
                    const tertiaryDept = emp.departmentID3 ? departments.find(d => d.departmentID === emp.departmentID3)?.departmentName : null;
                    
                    // Create departments string
                    const departmentsString = [primaryDept, secondaryDept, tertiaryDept]
                      .filter(Boolean)
                      .join(' / ');
                    
                    return (
                      <option key={emp.employeeID} value={emp.employeeID}>
                        {emp.firstName} {emp.lastName} ({departmentsString})
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
                    ? "No employees available for evaluation in this department, or you have already evaluated all available employees. Note: Coordinators cannot evaluate other coordinators."
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
              <h2 style={{ margin: 0 }}>{group.description}</h2>
              {editing && (
                <Button 
                  type="dashed" 
                  onClick={() => addNewSubGroup(group.groupID)}
                >
                  + Add SubGroup
                </Button>
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
                            <Button 
                              type="link" 
                              size="small" 
                              icon={<EditOutlined />}
                              onClick={() => startEditingSubGroup(group.groupID, sub.subGroupID)}
                              style={{ marginLeft: 8 }}
                            >
                              Edit Name
                            </Button>
                          )}
                        </span>
                      )}
                    </p>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <strong>Evaluation Items:</strong>
                    {editing && (
                      <Button 
                        type="dashed" 
                        size="small"
                        onClick={() => addNewItem(sub.subGroupID)}
                      >
                        + Add Item
                      </Button>
                    )}
                  </div>
                  
                  {itemsBySubGroup[sub.subGroupID] && itemsBySubGroup[sub.subGroupID].length > 0 ? (
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                      {itemsBySubGroup[sub.subGroupID].map((item) => (
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
                                <Button 
                                  type="link" 
                                  size="small" 
                                  icon={<EditOutlined />}
                                  onClick={() => startEditingItem(sub.subGroupID, item.itemID)}
                                >
                                  Edit
                                </Button>
                              )}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div style={{ padding: '16px 0', textAlign: 'center' }}>
                      <p style={{ color: '#999', fontStyle: 'italic', margin: 0 }}>
                        No items available for this subgroup.
                        {editing && ' Click "Add Item" to create one.'}
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