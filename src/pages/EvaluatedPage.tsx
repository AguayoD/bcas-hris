import React, { useEffect, useState } from "react";
import {
  Table,
  Spin,
  Typography,
  Button,
  message,
  Select,
  Modal,
  Tag,
  Tabs,
  Card,
  Row,
  Col,
  Statistic,
} from "antd";
import {
  RedoOutlined,
  HistoryOutlined,
  CalendarOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import axios from "../api/_axiosInstance";
import moment from "moment";
import { ROLES } from "../types/auth";
import { useAuth } from "../types/useAuth";

const { Title } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

interface SubGroupAnswer {
  subGroupID: number;
  subGroupName: string;
  scoreValue: number;
  scoreLabel: string;
}

interface EvaluationAnswerResponse {
  evaluatorName: string;
  answers: SubGroupAnswer[];
}

interface EvalWithNames {
  evaluationID: number;
  employeeID: number;
  employeeName: string;
  evaluatorID: number;
  evaluatorName: string;
  evaluationDate: string;
  finalScore: number;
  createdAt: string;
  employeeDepartments?: string[];
}

interface EvaluationHistoryItem {
  evaluationHistoryID: number;
  originalEvaluationID: number;
  employeeID: number;
  employeeName: string;
  evaluatorID: number;
  evaluatorName: string;
  evaluationDate: string;
  comments: string;
  finalScore: number;
  createdAt: string;
  archivedAt: string;
  scoresJson: string;
  scores: SubGroupAnswer[];
}

interface SemesterData {
  S1: EvalWithNames[];
  S2: EvalWithNames[];
  Q1: EvalWithNames[];
  Q2: EvalWithNames[];
  Q3: EvalWithNames[];
  Q4: EvalWithNames[];
}

interface EmployeeTotalScore {
  employeeID: number;
  employeeName: string;
  employeeDepartments?: string[];
  firstSemesterScore?: number;
  secondSemesterScore?: number;
  q1Score?: number;
  q2Score?: number;
  q3Score?: number;
  q4Score?: number;
  totalScore?: number;
  evaluationCount: number;
  isQuarterBased: boolean;
}

interface ResetEvaluationResponse {
  message: string;
  archivedCount: number;
}

const EvaluatedPage: React.FC = () => {
  const [evaluations, setEvaluations] = useState<EvalWithNames[]>([]);
  const [evaluationHistory, setEvaluationHistory] = useState<EvaluationHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [resetting, setResetting] = useState<boolean>(false);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [selectedSemester, setSelectedSemester] = useState<string>("S1");
  const [selectedHistoryDepartment, setSelectedHistoryDepartment] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isResetModalVisible, setIsResetModalVisible] = useState(false);
  const [selectedEvaluation, setSelectedEvaluation] = useState<EvalWithNames | null>(null);
  const [selectedHistoryEvaluation, setSelectedHistoryEvaluation] = useState<EvaluationHistoryItem | null>(null);
  const [evaluationAnswers, setEvaluationAnswers] = useState<SubGroupAnswer[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [historyModalLoading, setHistoryModalLoading] = useState(false);
  const [semesterData, setSemesterData] = useState<SemesterData>({
    S1: [],
    S2: [],
    Q1: [],
    Q2: [],
    Q3: [],
    Q4: [],
  });
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [employeeTotals, setEmployeeTotals] = useState<EmployeeTotalScore[]>([]);
  const [coordinatorDepartment, setCoordinatorDepartment] = useState<string | null>(null);
  const [coordinatorLoading, setCoordinatorLoading] = useState<boolean>(true);
  const [selectedEmployeeHistory, setSelectedEmployeeHistory] = useState<EvalWithNames[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [isArchivedDetailsModalVisible, setIsArchivedDetailsModalVisible] = useState(false);

  const { user } = useAuth();
  const isAdmin = user?.roleId === ROLES.Admin;
  const isHR = user?.roleId === ROLES.HR;
  const isCoordinator = user?.roleId === ROLES.Coordinator;

  // Helper function to check if department is quarter-based
  const isQuarterBasedDepartment = (dept: string): boolean => {
    if (!dept || dept === "all") return false;
    const deptLower = dept.toLowerCase();

    // Quarter-based departments: Pre Elementary, Elementary, High School
    const isPreElementary =
      deptLower.includes("pre elementary") ||
      deptLower.includes("pre-elementary");
    const isElementary = deptLower.includes("elementary");
    const isHighSchool =
      (deptLower.includes("high school") || deptLower.includes("highschool")) &&
      !deptLower.includes("senior");

    return isPreElementary || isElementary || isHighSchool;
  };

  const isEmployeeQuarterBased = (departments?: string[]): boolean => {
    if (!departments || departments.length === 0) return false;

    return departments.some((dept) => {
      const deptLower = dept.toLowerCase();
      const isPreElementary =
        deptLower.includes("pre elementary") ||
        deptLower.includes("pre-elementary");
      const isElementary = deptLower.includes("elementary");
      const isHighSchool =
        (deptLower.includes("high school") ||
          deptLower.includes("highschool")) &&
        !deptLower.includes("senior");

      return isPreElementary || isElementary || isHighSchool;
    });
  };

  const isEmployeeSemesterBased = (departments?: string[]): boolean => {
    if (!departments || departments.length === 0) return false;

    return departments.some((dept) => {
      const deptLower = dept.toLowerCase();
      const isCollege = deptLower.includes("college");
      const isSeniorHigh =
        deptLower.includes("senior high") || deptLower.includes("senior-high");

      return isCollege || isSeniorHigh;
    });
  };

  // FIXED: Properly determine coordinator department type
  useEffect(() => {
    if (isCoordinator) {
      console.log("Coordinator detected, determining department type");

      const fetchCoordinatorDepartment = async () => {
        try {
          // Try to fetch coordinator details from backend
          const coordinatorRes = await axios.get(
            `/Employees/${user?.employeeId}`
          );
          const coordinatorData = coordinatorRes.data;

          // Check departments to determine department type
          const employeeDeptIDs = [
            coordinatorData.departmentID,
            coordinatorData.departmentID2,
            coordinatorData.departmentID3,
          ].filter((id) => id != null && id !== 0);

          let departmentMap = new Map();
          try {
            const departmentsRes = await axios.get("/Departments");
            if (departmentsRes.data && Array.isArray(departmentsRes.data)) {
              departmentsRes.data.forEach((dept) => {
                if (dept.departmentID && dept.departmentName) {
                  departmentMap.set(dept.departmentID, dept.departmentName);
                }
              });
            }
          } catch (error) {
            console.error("Error fetching departments:", error);
          }

          const coordinatorDeptNames: string[] = [];
          for (const deptID of employeeDeptIDs) {
            const deptNameFromMap = departmentMap.get(deptID);
            if (deptNameFromMap) {
              coordinatorDeptNames.push(deptNameFromMap);
            } else {
              try {
                const deptRes = await axios.get(`/Department/${deptID}`);
                const deptName =
                  deptRes.data?.departmentName || deptRes.data?.name;
                if (deptName) {
                  coordinatorDeptNames.push(deptName);
                }
              } catch (error) {
                console.error(`Error fetching department ${deptID}:`, error);
              }
            }
          }

          // Determine coordinator's primary department
          let primaryDepartment = coordinatorDeptNames[0] || "High School";

          // Set the coordinator department and appropriate semester system
          setCoordinatorDepartment(primaryDepartment);
          setSelectedDepartment(primaryDepartment);
          setSelectedHistoryDepartment(primaryDepartment);

          // Set initial semester based on department type
          if (isQuarterBasedDepartment(primaryDepartment)) {
            setSelectedSemester("Q1");
            console.log(
              `${primaryDepartment} coordinator detected - using quarterly system`
            );
          } else {
            setSelectedSemester("S1");
            console.log(
              `${primaryDepartment} coordinator detected - using semester system`
            );
          }
        } catch (error) {
          console.error("Error fetching coordinator details:", error);
          // Fallback: check user data for hints about department
          const isSeniorHigh = user?.departmentId?.includes("Senior High");
          const isCollege = user?.departmentId?.includes("College");

          if (isSeniorHigh || isCollege) {
            setCoordinatorDepartment("Senior High School");
            setSelectedDepartment("Senior High School");
            setSelectedHistoryDepartment("Senior High School");
            setSelectedSemester("S1");
          } else {
            setCoordinatorDepartment("High School");
            setSelectedDepartment("High School");
            setSelectedHistoryDepartment("High School");
            setSelectedSemester("Q1");
          }
        } finally {
          setCoordinatorLoading(false);
        }
      };

      fetchCoordinatorDepartment();
    } else {
      setCoordinatorLoading(false);
    }
  }, [isCoordinator, user]);

  useEffect(() => {
    fetchEvaluations();
    fetchEvaluationHistory();
  }, []);

  const fetchEvaluationHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await axios.get("/Evaluations/history");
      setEvaluationHistory(res.data);
    } catch (error) {
      console.error("Error fetching evaluation history:", error);
      message.error("Failed to fetch evaluation history");
    } finally {
      setHistoryLoading(false);
    }
  };

  const getSemesterFromDate = (
    date: string,
    isQuarterBased: boolean = false
  ): string => {
    const momentDate = moment(date);
    const month = momentDate.month(); // 0-11

    if (isQuarterBased) {
      if (month >= 0 && month <= 2) return "Q1";
      else if (month >= 3 && month <= 5) return "Q2";
      else if (month >= 6 && month <= 8) return "Q3";
      else return "Q4";
    } else {
      if (month >= 0 && month <= 5) return "S1";
      else return "S2";
    }
  };

  const organizeBySemester = (evals: EvalWithNames[]): SemesterData => {
    const data: SemesterData = {
      S1: [],
      S2: [],
      Q1: [],
      Q2: [],
      Q3: [],
      Q4: [],
    };

    evals.forEach((evaluation) => {
      const semesterPeriod = getSemesterFromDate(
        evaluation.evaluationDate,
        false
      );
      const quarterPeriod = getSemesterFromDate(
        evaluation.evaluationDate,
        true
      );

      data[semesterPeriod as keyof SemesterData].push(evaluation);
      data[quarterPeriod as keyof SemesterData].push(evaluation);
    });

    Object.keys(data).forEach((period) => {
      data[period as keyof SemesterData].sort(
        (a, b) => b.finalScore - a.finalScore
      );
    });

    return data;
  };

  const organizeByYear = (
    evals: EvalWithNames[]
  ): { [year: string]: EvalWithNames[] } => {
    const data: { [year: string]: EvalWithNames[] } = {};

    evals.forEach((evaluation) => {
      const year = moment(evaluation.evaluationDate).year().toString();

      if (!data[year]) {
        data[year] = [];
      }
      data[year].push(evaluation);
    });

    Object.keys(data).forEach((year) => {
      data[year].sort((a, b) => b.finalScore - a.finalScore);
    });

    return data;
  };

  const calculateEmployeeTotals = (
    evals: EvalWithNames[],
    year: string
  ): EmployeeTotalScore[] => {
    const employeeMap = new Map<number, EmployeeTotalScore>();

    const yearEvals =
      year === "all"
        ? evals
        : evals.filter(
            (e) => moment(e.evaluationDate).year().toString() === year
          );

    yearEvals.forEach((evaluation) => {
      const empId = evaluation.employeeID;

      if (!employeeMap.has(empId)) {
        const hasQuarterDept = isEmployeeQuarterBased(
          evaluation.employeeDepartments
        );

        employeeMap.set(empId, {
          employeeID: empId,
          employeeName: evaluation.employeeName,
          employeeDepartments: evaluation.employeeDepartments,
          evaluationCount: 0,
          isQuarterBased: hasQuarterDept,
        });
      }

      const empData = employeeMap.get(empId)!;
      empData.evaluationCount++;

      const semesterPeriod = getSemesterFromDate(
        evaluation.evaluationDate,
        false
      );
      const quarterPeriod = getSemesterFromDate(
        evaluation.evaluationDate,
        true
      );

      if (semesterPeriod === "S1")
        empData.firstSemesterScore = evaluation.finalScore;
      else if (semesterPeriod === "S2")
        empData.secondSemesterScore = evaluation.finalScore;

      if (quarterPeriod === "Q1") empData.q1Score = evaluation.finalScore;
      else if (quarterPeriod === "Q2") empData.q2Score = evaluation.finalScore;
      else if (quarterPeriod === "Q3") empData.q3Score = evaluation.finalScore;
      else if (quarterPeriod === "Q4") empData.q4Score = evaluation.finalScore;

      if (empData.isQuarterBased) {
        if (
          empData.q1Score !== undefined &&
          empData.q2Score !== undefined &&
          empData.q3Score !== undefined &&
          empData.q4Score !== undefined
        ) {
          empData.totalScore =
            (empData.q1Score +
              empData.q2Score +
              empData.q3Score +
              empData.q4Score) /
            4;
        }
      } else {
        if (
          empData.firstSemesterScore !== undefined &&
          empData.secondSemesterScore !== undefined
        ) {
          empData.totalScore =
            (empData.firstSemesterScore + empData.secondSemesterScore) / 2;
        }
      }
    });

    return Array.from(employeeMap.values()).sort((a, b) => {
      if (a.totalScore !== undefined && b.totalScore !== undefined) {
        return b.totalScore - a.totalScore;
      }
      if (a.totalScore !== undefined) return -1;
      if (b.totalScore !== undefined) return 1;
      return 0;
    });
  };

  const filterEvaluationsByCoordinator = (
    evals: EvalWithNames[]
  ): EvalWithNames[] => {
    if (!isCoordinator || !coordinatorDepartment) {
      return evals;
    }

    return evals.filter((evaluation) =>
      evaluation.employeeDepartments?.includes(coordinatorDepartment)
    );
  };

  const fetchEvaluations = async () => {
    try {
      const res = await axios.get("/Evaluations");

      let departmentMap = new Map();
      try {
        const departmentsRes = await axios.get("/Departments");
        if (departmentsRes.data && Array.isArray(departmentsRes.data)) {
          departmentsRes.data.forEach((dept) => {
            if (dept.departmentID && dept.departmentName) {
              departmentMap.set(dept.departmentID, dept.departmentName);
            }
          });
        }
      } catch (error) {
        console.error("Error fetching departments:", error);
      }

      const evaluationsWithDetails = await Promise.all(
        res.data.map(async (evaluation: EvalWithNames) => {
          try {
            const employeeRes = await axios.get(
              `/Employees/${evaluation.employeeID}`
            );
            const employeeData = employeeRes.data;

            const employeeDeptIDs = [
              employeeData.departmentID,
              employeeData.departmentID2,
              employeeData.departmentID3,
            ].filter((id) => id != null && id !== 0);

            const employeeDeptNames: string[] = [];

            for (const deptID of employeeDeptIDs) {
              const deptNameFromMap = departmentMap.get(deptID);
              if (deptNameFromMap) {
                employeeDeptNames.push(deptNameFromMap);
              } else {
                try {
                  const deptRes = await axios.get(`/Department/${deptID}`);
                  const deptName =
                    deptRes.data?.departmentName || deptRes.data?.name;
                  if (deptName) {
                    employeeDeptNames.push(deptName);
                    departmentMap.set(deptID, deptName);
                  } else {
                    employeeDeptNames.push(`Department ${deptID}`);
                  }
                } catch (error) {
                  console.error(`Error fetching department ${deptID}:`, error);
                  employeeDeptNames.push(`Department ${deptID}`);
                }
              }
            }

            if (employeeDeptNames.length === 0) {
              if (employeeData.departmentName) {
                employeeDeptNames.push(employeeData.departmentName);
              }
              if (employeeData.departmentID2Name) {
                employeeDeptNames.push(employeeData.departmentID2Name);
              }
              if (employeeData.departmentID3Name) {
                employeeDeptNames.push(employeeData.departmentID3Name);
              }
            }

            return {
              ...evaluation,
              employeeDepartments:
                employeeDeptNames.length > 0
                  ? employeeDeptNames
                  : ["No Department"],
            };
          } catch (error) {
            console.error(
              `Error fetching details for evaluation ${evaluation.evaluationID}:`,
              error
            );
            return {
              ...evaluation,
              employeeDepartments: ["No Department"],
            };
          }
        })
      );

      // Keep original for history
      setEvaluations(evaluationsWithDetails);

      // Only filter for CURRENT/TABS view
      const filteredEvaluations = filterEvaluationsByCoordinator(
        evaluationsWithDetails
      );

      const organized = organizeBySemester(filteredEvaluations);
      setSemesterData(organized);

      const yearlyOrganized = organizeByYear(filteredEvaluations);
      const years = Object.keys(yearlyOrganized).sort(
        (a, b) => parseInt(b) - parseInt(a)
      );
      setAvailableYears(years);

      if (years.length > 0) {
        const defaultYear = selectedYear || years[0];
        setSelectedYear(defaultYear);

        const totals = calculateEmployeeTotals(
          filteredEvaluations,
          defaultYear
        );
        console.log("Employee Totals:", totals);
        setEmployeeTotals(totals);
      }
    } catch (error) {
      console.error("Error fetching evaluations:", error);
      message.error("Failed to fetch evaluations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedYear && evaluations.length > 0) {
      const totals = calculateEmployeeTotals(evaluations, selectedYear);
      setEmployeeTotals(totals);
    }
  }, [selectedYear, evaluations]);

  const allDepartments = evaluations.flatMap(
    (evalItem) => evalItem.employeeDepartments || []
  );
  const departments =
    isCoordinator && coordinatorDepartment
      ? [coordinatorDepartment]
      : (Array.from(new Set(allDepartments)).filter(
          (dept) => dept && dept !== "No Department"
        ) as string[]);

  const sortedEvaluations = [...evaluations].sort(
    (a, b) => b.finalScore - a.finalScore
  );

  const filteredEvaluations =
    selectedDepartment === "all"
      ? sortedEvaluations
      : sortedEvaluations.filter((evalItem) =>
          evalItem.employeeDepartments?.includes(selectedDepartment)
        );

  const uniqueEmployees = Object.values(
    filteredEvaluations.reduce((acc: { [key: number]: EvalWithNames }, curr) => {
      const existing = acc[curr.employeeID];
      if (
        !existing ||
        new Date(curr.evaluationDate) > new Date(existing.evaluationDate)
      ) {
        acc[curr.employeeID] = curr;
      }
      return acc;
    }, {})
  ) as EvalWithNames[];

  const showResetConfirmation = () => {
    setIsResetModalVisible(true);
  };

  const allHistoryEvaluations = [...evaluations].sort(
    (a, b) =>
      new Date(b.evaluationDate).getTime() -
      new Date(a.evaluationDate).getTime()
  );

  const handleResetConfirm = async () => {
    setIsResetModalVisible(false);
    setResetting(true);
    try {
      const response = await axios.post<ResetEvaluationResponse>("/Evaluations/reset");
      message.success(response.data.message);
      await fetchEvaluations();
      await fetchEvaluationHistory(); // Refresh history after reset
      window.dispatchEvent(new CustomEvent("evaluationsReset"));
    } catch (error: any) {
      console.error("Error resetting evaluations:", error);
      message.error("Failed to reset evaluation data");
    } finally {
      setResetting(false);
    }
  };

  const handleResetCancel = () => {
    setIsResetModalVisible(false);
  };

  const showModal = async (evaluation: EvalWithNames) => {
    setSelectedEvaluation(evaluation);
    setIsModalVisible(true);
    setModalLoading(true);

    try {
      const res = await axios.get<EvaluationAnswerResponse>(
        `/Evaluations/${evaluation.evaluationID}/answers`
      );
      setEvaluationAnswers(res.data.answers);
    } catch (error) {
      console.error("Error fetching evaluation answers:", error);
      setEvaluationAnswers([]);
    } finally {
      setModalLoading(false);
    }
  };

  const showArchivedDetailsModal = async (evaluation: EvaluationHistoryItem) => {
    setSelectedHistoryEvaluation(evaluation);
    setIsArchivedDetailsModalVisible(true);
    setHistoryModalLoading(true);

    try {
      // If scores are not already loaded, fetch them
      if (!evaluation.scores || evaluation.scores.length === 0) {
        const res = await axios.get(`/Evaluations/history/${evaluation.evaluationHistoryID}`);
        setSelectedHistoryEvaluation(res.data);
      }
    } catch (error) {
      console.error("Error fetching archived evaluation details:", error);
    } finally {
      setHistoryModalLoading(false);
    }
  };

  const handleModalClose = () => {
    setIsModalVisible(false);
    setSelectedEvaluation(null);
    setEvaluationAnswers([]);
  };

  const handleArchivedModalClose = () => {
    setIsArchivedDetailsModalVisible(false);
    setSelectedHistoryEvaluation(null);
  };

  const columns: ColumnsType<EvalWithNames> = [
    {
      title: "Employee",
      dataIndex: "employeeName",
      key: "employeeName",
    },
    {
      title: "Departments",
      dataIndex: "employeeDepartments",
      key: "employeeDepartments",
      render: (departments: string[]) =>
        departments && departments.length > 0 ? (
          <div>
            {departments.map((dept, index) => (
              <Tag key={index} color="blue" style={{ margin: "2px" }}>
                {dept}
              </Tag>
            ))}
          </div>
        ) : (
          "No Department"
        ),
    },
    {
      title: "Evaluator",
      dataIndex: "evaluatorName",
      key: "evaluatorName",
    },
    {
      title: "Date",
      dataIndex: "evaluationDate",
      key: "evaluationDate",
      render: (d: string) => new Date(d).toLocaleDateString(),
    },
    {
      title: "Evaluation Score Average",
      dataIndex: "finalScore",
      key: "finalScore",
      render: (score: number) => score.toFixed(2),
      sorter: (a, b) => a.finalScore - b.finalScore,
      defaultSortOrder: "descend",
    },
    {
      title: "Action",
      key: "action",
      render: (_, record) => (
        <Button type="link" onClick={() => showModal(record)}>
          View Details
        </Button>
      ),
    },
    {
      title: "History",
      key: "history",
      render: (_, record) => (
        <Button
          type="link"
          onClick={() => {
            // Filter all evaluations of this employee
            const history = allHistoryEvaluations.filter(
              (e) => e.employeeID === record.employeeID
            );

            console.log("FULL HISTORY:", history);

            // Open modal and show employee history
            setSelectedEmployeeHistory(history);
            setShowHistoryModal(true);
          }}
        >
          View History
        </Button>
      ),
    },
  ];

  const columnsV2: ColumnsType<EvalWithNames> = [
    {
      title: "Employee",
      dataIndex: "employeeName",
      key: "employeeName",
    },
    {
      title: "Departments",
      dataIndex: "employeeDepartments",
      key: "employeeDepartments",
      render: (departments: string[]) =>
        departments && departments.length > 0 ? (
          <div>
            {departments.map((dept, index) => (
              <Tag key={index} color="blue" style={{ margin: "2px" }}>
                {dept}
              </Tag>
            ))}
          </div>
        ) : (
          "No Department"
        ),
    },
    {
      title: "Evaluator",
      dataIndex: "evaluatorName",
      key: "evaluatorName",
    },
    {
      title: "Date",
      dataIndex: "evaluationDate",
      key: "evaluationDate",
      render: (d: string) => new Date(d).toLocaleDateString(),
    },
    {
      title: "Evaluation Score Average",
      dataIndex: "finalScore",
      key: "finalScore",
      render: (score: number) => score.toFixed(2),
      sorter: (a, b) => a.finalScore - b.finalScore,
      defaultSortOrder: "descend",
    },
    {
      title: "Action",
      key: "action",
      render: (_, record) => (
        <Button type="link" onClick={() => showModal(record)}>
          View Details
        </Button>
      ),
    },
  ];

  const archivedColumns: ColumnsType<EvaluationHistoryItem> = [
    {
      title: "Employee",
      dataIndex: "employeeName",
      key: "employeeName",
    },
    {
      title: "Evaluator",
      dataIndex: "evaluatorName",
      key: "evaluatorName",
    },
    {
      title: "Evaluation Date",
      dataIndex: "evaluationDate",
      key: "evaluationDate",
      render: (d: string) => new Date(d).toLocaleDateString(),
    },
    {
      title: "Final Score",
      dataIndex: "finalScore",
      key: "finalScore",
      render: (score: number) => score.toFixed(2),
    },
    {
      title: "Archived Date",
      dataIndex: "archivedAt",
      key: "archivedAt",
      render: (d: string) => new Date(d).toLocaleDateString(),
    },
    {
      title: "Action",
      key: "action",
      render: (_, record) => (
        <Button type="link" onClick={() => showArchivedDetailsModal(record)}>
          View Details
        </Button>
      ),
    },
  ];

  const semesterColumns: ColumnsType<EmployeeTotalScore> = [
    {
      title: "Employee",
      dataIndex: "employeeName",
      key: "employeeName",
      width: 150,
    },
    {
      title: "Departments",
      dataIndex: "employeeDepartments",
      key: "employeeDepartments",
      width: 200,
      render: (departments: string[]) =>
        departments && departments.length > 0 ? (
          <div>
            {departments.map((dept, index) => (
              <Tag key={index} color="blue" style={{ margin: "2px" }}>
                {dept}
              </Tag>
            ))}
          </div>
        ) : (
          "No Department"
        ),
    },
    {
      title: "1st Semester",
      dataIndex: "firstSemesterScore",
      key: "firstSemesterScore",
      width: 120,
      render: (score?: number) =>
        score !== undefined ? score.toFixed(2) : "-",
    },
    {
      title: "2nd Semester",
      dataIndex: "secondSemesterScore",
      key: "secondSemesterScore",
      width: 120,
      render: (score?: number) =>
        score !== undefined ? score.toFixed(2) : "-",
    },
    {
      title: "Total Average",
      dataIndex: "totalScore",
      key: "totalScore",
      width: 120,
      render: (score?: number) =>
        score !== undefined ? (
          <strong style={{ color: "#1890ff", fontSize: "16px" }}>
            {score.toFixed(2)}
          </strong>
        ) : (
          "-"
        ),
      sorter: (a, b) => {
        const aScore = a.totalScore ?? -1;
        const bScore = b.totalScore ?? -1;
        return bScore - aScore;
      },
      defaultSortOrder: "descend",
    },
    {
      title: "Status",
      key: "status",
      width: 150,
      render: (_, record) => {
        if (record.totalScore !== undefined) {
          return <Tag color="green">Complete</Tag>;
        } else if (record.evaluationCount > 0) {
          const completedSemesters = [
            record.firstSemesterScore !== undefined,
            record.secondSemesterScore !== undefined,
          ].filter(Boolean).length;
          return (
            <Tag color="orange">{completedSemesters}/2 Semesters Complete</Tag>
          );
        }
        return <Tag color="red">No Evaluations</Tag>;
      },
    },
  ];

  const quarterColumns: ColumnsType<EmployeeTotalScore> = [
    {
      title: "Employee",
      dataIndex: "employeeName",
      key: "employeeName",
      width: 150,
    },
    {
      title: "Departments",
      dataIndex: "employeeDepartments",
      key: "employeeDepartments",
      width: 200,
      render: (departments: string[]) =>
        departments && departments.length > 0 ? (
          <div>
            {departments.map((dept, index) => (
              <Tag key={index} color="blue" style={{ margin: "2px" }}>
                {dept}
              </Tag>
            ))}
          </div>
        ) : (
          "No Department"
        ),
    },
    {
      title: "1st Quarter",
      dataIndex: "q1Score",
      key: "q1Score",
      width: 100,
      render: (score?: number) =>
        score !== undefined ? score.toFixed(2) : "-",
    },
    {
      title: "2nd Quarter",
      dataIndex: "q2Score",
      key: "q2Score",
      width: 100,
      render: (score?: number) =>
        score !== undefined ? score.toFixed(2) : "-",
    },
    {
      title: "3rd Quarter",
      dataIndex: "q3Score",
      key: "q3Score",
      width: 100,
      render: (score?: number) =>
        score !== undefined ? score.toFixed(2) : "-",
    },
    {
      title: "4th Quarter",
      dataIndex: "q4Score",
      key: "q4Score",
      width: 100,
      render: (score?: number) =>
        score !== undefined ? score.toFixed(2) : "-",
    },
    {
      title: "Total Average",
      dataIndex: "totalScore",
      key: "totalScore",
      width: 120,
      render: (score?: number) =>
        score !== undefined ? (
          <strong style={{ color: "#1890ff", fontSize: "16px" }}>
            {score.toFixed(2)}
          </strong>
        ) : (
          "-"
        ),
      sorter: (a, b) => {
        const aScore = a.totalScore ?? -1;
        const bScore = b.totalScore ?? -1;
        return bScore - aScore;
      },
      defaultSortOrder: "descend",
    },
    {
      title: "Status",
      key: "status",
      width: 150,
      render: (_, record) => {
        if (record.totalScore !== undefined) {
          return <Tag color="green">Complete</Tag>;
        } else if (record.evaluationCount > 0) {
          const completedQuarters = [
            record.q1Score !== undefined,
            record.q2Score !== undefined,
            record.q3Score !== undefined,
            record.q4Score !== undefined,
          ].filter(Boolean).length;
          return (
            <Tag color="orange">{completedQuarters}/4 Quarters Complete</Tag>
          );
        }
        return <Tag color="red">No Evaluations</Tag>;
      },
    },
  ];

  const getFilteredEmployeeTotals = () => {
    return employeeTotals;
  };

  const getSemesterBasedEmployees = () => {
    const filtered = getFilteredEmployeeTotals();
    return filtered.filter((emp) =>
      isEmployeeSemesterBased(emp.employeeDepartments)
    );
  };

  const getQuarterBasedEmployees = () => {
    const filtered = getFilteredEmployeeTotals();
    return filtered.filter((emp) =>
      isEmployeeQuarterBased(emp.employeeDepartments)
    );
  };

  const getCurrentSemesterData = () => {
    const data = semesterData[selectedSemester as keyof SemesterData];

    let filteredData = data;

    if (selectedSemester === "S1" || selectedSemester === "S2") {
      filteredData = data.filter((evalItem) =>
        isEmployeeSemesterBased(evalItem.employeeDepartments)
      );
    } else if (["Q1", "Q2", "Q3", "Q4"].includes(selectedSemester)) {
      filteredData = data.filter((evalItem) =>
        isEmployeeQuarterBased(evalItem.employeeDepartments)
      );
    }

    if (isCoordinator || selectedHistoryDepartment === "all") {
      return filteredData;
    } else {
      return filteredData.filter((evalItem) =>
        evalItem.employeeDepartments?.includes(selectedHistoryDepartment)
      );
    }
  };

  const getSemesterLabel = (period: string) => {
    const labels: { [key: string]: string } = {
      S1: "First Semester (January - June)",
      S2: "Second Semester (July - December)",
      Q1: "First Quarter (January - March)",
      Q2: "Second Quarter (April - June)",
      Q3: "Third Quarter (July - September)",
      Q4: "Fourth Quarter (October - December)",
    };
    return labels[period] || period;
  };

  // FIXED: Tab visibility functions
  const shouldShowSemesterTab = () => {
    // Allow semester tab for semester-based department coordinators
    if (isCoordinator && coordinatorDepartment) {
      return !isQuarterBasedDepartment(coordinatorDepartment);
    }
    // Never show semester tab for quarter-based coordinators
    if (isCoordinator) return false;
    // Show for Admin and HR
    return isAdmin || isHR;
  };

  const shouldShowQuarterlyTab = () => {
    // Show quarterly tab for quarter-based department coordinators
    if (isCoordinator && coordinatorDepartment) {
      return isQuarterBasedDepartment(coordinatorDepartment);
    }
    // Don't show quarterly tab for semester-based coordinators
    if (isCoordinator) return false;
    // Show for Admin and HR
    return isAdmin || isHR;
  };

  const shouldShowCurrentEvaluationsTab = () => {
    return isAdmin || isHR;
  };

  const currentSemesterData = getCurrentSemesterData();
  const semesterBasedEmployees = getSemesterBasedEmployees();
  const quarterBasedEmployees = getQuarterBasedEmployees();

  console.log("Tab Visibility:", {
    isCoordinator,
    coordinatorDepartment,
    shouldShowSemester: shouldShowSemesterTab(),
    shouldShowQuarterly: shouldShowQuarterlyTab(),
    shouldShowCurrent: shouldShowCurrentEvaluationsTab(),
  });

  console.log("Coordinator Debug:", {
    isCoordinator,
    coordinatorDepartment,
    selectedSemester,
  });

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <Title level={2} style={{ margin: 0 }}>
          Evaluations
        </Title>
        <div style={{ display: "flex", gap: 8 }}>
          {(isAdmin || isHR) && (
            <Button
              type="primary"
              icon={<RedoOutlined />}
              loading={resetting}
              onClick={showResetConfirmation}
              danger
            >
              Archive & Reset Current Evaluations
            </Button>
          )}
        </div>
      </div>

      <Spin spinning={loading || resetting || coordinatorLoading}>
        <Tabs defaultActiveKey="history" type="card">
          {shouldShowCurrentEvaluationsTab() && (
            <TabPane tab="Current Evaluations" key="current">
              <Table
                rowKey="evaluationID"
                columns={columns}
                dataSource={allHistoryEvaluations}
                bordered
                pagination={{ pageSize: 10 }}
                sortDirections={["descend", "ascend"]}
              />
            </TabPane>
          )}

          <TabPane
            tab={
              <span>
                <HistoryOutlined /> Evaluation History
              </span>
            }
            key="history"
          >
            <div style={{ marginBottom: 16, display: "flex", gap: 12 }}>
              {!isCoordinator && (
                <Select
                  value={selectedHistoryDepartment}
                  onChange={(value) => {
                    setSelectedHistoryDepartment(value);
                    if (value !== "all") {
                      if (isQuarterBasedDepartment(value)) {
                        setSelectedSemester("Q1");
                      } else {
                        setSelectedSemester("S1");
                      }
                    }
                  }}
                  style={{ width: 250 }}
                  placeholder="Filter by department"
                  size="large"
                >
                  <Option value="all">All Departments</Option>
                  {departments.map((dept) => (
                    <Option key={dept} value={dept}>
                      {dept}
                    </Option>
                  ))}
                </Select>
              )}
              <Select
                value={selectedSemester}
                onChange={setSelectedSemester}
                style={{ width: 400 }}
                placeholder="Select Period"
                size="large"
              >
                {/* FOR COORDINATORS: Show appropriate options based on department type */}
                {isCoordinator ? (
                  isQuarterBasedDepartment(coordinatorDepartment || "") ? (
                    // Quarter-based department coordinators see quarter options
                    <>
                      <Option value="Q1">
                        First Quarter (January - March)
                      </Option>
                      <Option value="Q2">Second Quarter (April - June)</Option>
                      <Option value="Q3">
                        Third Quarter (July - September)
                      </Option>
                      <Option value="Q4">
                        Fourth Quarter (October - December)
                      </Option>
                    </>
                  ) : (
                    // Semester-based department coordinators see semester options
                    <>
                      <Option value="S1">
                        First Semester (January - June)
                      </Option>
                      <Option value="S2">
                        Second Semester (July - December)
                      </Option>
                    </>
                  )
                ) : (
                  /* FOR ADMIN/HR: Show both options */
                  <>
                    <Option value="S1">First Semester (January - June)</Option>
                    <Option value="S2">
                      Second Semester (July - December)
                    </Option>
                    <Option value="Q1">First Quarter (January - March)</Option>
                    <Option value="Q2">Second Quarter (April - June)</Option>
                    <Option value="Q3">Third Quarter (July - September)</Option>
                    <Option value="Q4">
                      Fourth Quarter (October - December)
                    </Option>
                  </>
                )}
              </Select>
            </div>

            <div
              style={{
                marginBottom: 16,
                padding: "12px",
                backgroundColor: "#f5f5f5",
                borderRadius: "4px",
              }}
            >
              <Title level={4} style={{ margin: 0, marginBottom: 8 }}>
                {getSemesterLabel(selectedSemester)}
              </Title>
              <div style={{ display: "flex", gap: 24 }}>
                <div>
                  <strong>Total Evaluations:</strong>{" "}
                  {currentSemesterData.length}
                </div>
              </div>
            </div>

            {currentSemesterData.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px",
                  backgroundColor: "#fafafa",
                  borderRadius: "4px",
                }}
              >
                <p style={{ fontSize: "16px", color: "#999" }}>
                  No evaluations found for {getSemesterLabel(selectedSemester)}
                </p>
              </div>
            ) : (
              <Table<EvalWithNames>
                rowKey="employeeID"
                columns={columns}
                dataSource={uniqueEmployees}
                bordered
                pagination={{ pageSize: 10 }}
                sortDirections={["descend", "ascend"]}
                onRow={(record) => ({
                  onClick: () => {
                    const history: EvalWithNames[] =
                      allHistoryEvaluations.filter(
                        (e) => e.employeeID === record.employeeID
                      );

                    // Open modal with this employee's full history
                    setSelectedEmployeeHistory(history);
                    setShowHistoryModal(true);
                  },
                })}
              />
            )}
          </TabPane>

          <TabPane
            tab={
              <span>
                <DeleteOutlined /> Archived Evaluations
              </span>
            }
            key="archived"
          >
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <Card>
                  <Statistic
                    title="Total Archived Evaluations"
                    value={evaluationHistory.length}
                    prefix={<DeleteOutlined />}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card>
                  <Statistic
                    title="Current Evaluations"
                    value={evaluations.length}
                    prefix={<FileTextOutlined />}
                  />
                </Card>
              </Col>
            </Row>

            <Spin spinning={historyLoading}>
              {evaluationHistory.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "40px",
                    backgroundColor: "#fafafa",
                    borderRadius: "4px",
                  }}
                >
                  <DeleteOutlined style={{ fontSize: 48, color: "#d9d9d9", marginBottom: 16 }} />
                  <p style={{ fontSize: "16px", color: "#999" }}>
                    No archived evaluations found
                  </p>
                  <p style={{ fontSize: "14px", color: "#666", marginTop: 8 }}>
                    Archived evaluations will appear here after using the "Archive & Reset" function
                  </p>
                </div>
              ) : (
                <Table
                  rowKey="evaluationHistoryID"
                  columns={archivedColumns}
                  dataSource={evaluationHistory}
                  bordered
                  pagination={{ pageSize: 10 }}
                />
              )}
            </Spin>
          </TabPane>

          {shouldShowSemesterTab() && (
            <TabPane
              tab={
                <span>
                  <CalendarOutlined /> Semester Totals
                </span>
              }
              key="semester"
            >
              <div style={{ marginBottom: 16 }}>
                <Select
                  value={selectedYear}
                  onChange={setSelectedYear}
                  style={{ width: 150 }}
                >
                  <Option value="all">All Years</Option>
                  {availableYears.map((year) => (
                    <Option key={year} value={year}>
                      {year}
                    </Option>
                  ))}
                </Select>
              </div>

              {semesterBasedEmployees.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "40px",
                    backgroundColor: "#fafafa",
                    borderRadius: "4px",
                  }}
                >
                  <p style={{ fontSize: "16px", color: "#999" }}>
                    No semester-based evaluations found for Year {selectedYear}
                  </p>
                  <p style={{ fontSize: "14px", color: "#666", marginTop: 8 }}>
                    Semester-based departments: College, Senior High School
                  </p>
                </div>
              ) : (
                <Table
                  rowKey="employeeID"
                  columns={semesterColumns}
                  dataSource={semesterBasedEmployees}
                  bordered
                  pagination={{ pageSize: 10 }}
                  sortDirections={["descend", "ascend"]}
                />
              )}
            </TabPane>
          )}

          {shouldShowQuarterlyTab() && (
            <TabPane
              tab={
                <span>
                  <CalendarOutlined /> Quarterly Totals
                </span>
              }
              key="quarterly"
            >
              <div style={{ marginBottom: 16 }}>
                <Select
                  value={selectedYear}
                  onChange={setSelectedYear}
                  style={{ width: 400 }}
                  placeholder="Select Year"
                  size="large"
                >
                  {availableYears.map((year) => (
                    <Option key={year} value={year}>
                      Year {year}
                    </Option>
                  ))}
                </Select>
              </div>

              {quarterBasedEmployees.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "40px",
                    backgroundColor: "#fafafa",
                    borderRadius: "4px",
                  }}
                >
                  <p style={{ fontSize: "16px", color: "#999" }}>
                    No quarter-based evaluations found for Year {selectedYear}
                  </p>
                  <p style={{ fontSize: "14px", color: "#666", marginTop: 8 }}>
                    Quarter-based departments: Pre Elementary, Elementary, High
                    School
                  </p>
                </div>
              ) : (
                <Table
                  rowKey="employeeID"
                  columns={quarterColumns}
                  dataSource={quarterBasedEmployees}
                  bordered
                  pagination={{ pageSize: 10 }}
                  sortDirections={["descend", "ascend"]}
                />
              )}
            </TabPane>
          )}
        </Tabs>
      </Spin>

      {/* Reset Confirmation Modal */}
      <Modal
        title={
          <span>
            <ExclamationCircleOutlined
              style={{ color: "#ff4d4f", marginRight: 8 }}
            />
            Archive and Reset Current Evaluations
          </span>
        }
        open={isResetModalVisible}
        onOk={handleResetConfirm}
        onCancel={handleResetCancel}
        okText="Yes, Archive and Reset"
        cancelText="Cancel"
        okButtonProps={{ danger: true }}
        width={600}
      >
        <p style={{ fontSize: "14px", marginBottom: 12 }}>
          Are you sure you want to archive current evaluations and reset the system?
        </p>
        <p style={{ fontSize: "14px", color: "#ff4d4f", fontWeight: 500 }}>
          This will:
        </p>
        <ul style={{ fontSize: "14px", color: "#ff4d4f", paddingLeft: 20, marginBottom: 12 }}>
          <li>Move all current evaluations to history/archive</li>
          <li>Clear current evaluation data for new evaluations</li>
          <li>Preserve all historical data in the archive</li>
        </ul>
        <p style={{ fontSize: "14px", marginTop: 12 }}>
          Previous evaluations will be available in the "Archived Evaluations" tab.
        </p>
      </Modal>

      {/* Current Evaluation Details Modal */}
      <Modal
        title="Evaluation Answers"
        open={isModalVisible}
        onCancel={handleModalClose}
        footer={null}
        width={700}
        style={{ zIndex: 1050 }}
      >
        {selectedEvaluation && (
          <>
            <p>
              <strong>Evaluator:</strong> {selectedEvaluation.evaluatorName}
            </p>
            <p>
              <strong>Employee Evaluated:</strong>{" "}
              {selectedEvaluation.employeeName}
            </p>
            <p>
              <strong>Final Score:</strong>{" "}
              {selectedEvaluation.finalScore.toFixed(2)}
            </p>
            <p>
              <strong>Evaluation Date:</strong>{" "}
              {new Date(selectedEvaluation.evaluationDate).toLocaleDateString()}
            </p>

            <Spin spinning={modalLoading}>
              <Table<SubGroupAnswer>
                rowKey="subGroupID"
                dataSource={evaluationAnswers}
                pagination={false}
                bordered
                size="small"
                columns={[
                  {
                    title: "SubGroup",
                    dataIndex: "subGroupName",
                    key: "subGroupName",
                  },
                  {
                    title: "Score",
                    dataIndex: "scoreValue",
                    key: "scoreValue",
                    render: (value) => <strong>{value}</strong>,
                  },
                  {
                    title: "Label",
                    dataIndex: "scoreLabel",
                    key: "scoreLabel",
                  },
                ]}
              />
            </Spin>
          </>
        )}
      </Modal>

      {/* Archived Evaluation Details Modal */}
      <Modal
        title="Archived Evaluation Details"
        open={isArchivedDetailsModalVisible}
        onCancel={handleArchivedModalClose}
        footer={null}
        width={700}
        style={{ zIndex: 1050 }}
      >
        {selectedHistoryEvaluation && (
          <>
            <p>
              <strong>Evaluator:</strong> {selectedHistoryEvaluation.evaluatorName}
            </p>
            <p>
              <strong>Employee Evaluated:</strong>{" "}
              {selectedHistoryEvaluation.employeeName}
            </p>
            <p>
              <strong>Final Score:</strong>{" "}
              {selectedHistoryEvaluation.finalScore.toFixed(2)}
            </p>
            <p>
              <strong>Evaluation Date:</strong>{" "}
              {new Date(selectedHistoryEvaluation.evaluationDate).toLocaleDateString()}
            </p>
            <p>
              <strong>Archived Date:</strong>{" "}
              {new Date(selectedHistoryEvaluation.archivedAt).toLocaleDateString()}
            </p>

            {selectedHistoryEvaluation.comments && (
              <p>
                <strong>Comments:</strong> {selectedHistoryEvaluation.comments}
              </p>
            )}

            <Spin spinning={historyModalLoading}>
              <Table<SubGroupAnswer>
                rowKey="subGroupID"
                dataSource={selectedHistoryEvaluation.scores}
                pagination={false}
                bordered
                size="small"
                columns={[
                  {
                    title: "SubGroup",
                    dataIndex: "subGroupName",
                    key: "subGroupName",
                  },
                  {
                    title: "Score",
                    dataIndex: "scoreValue",
                    key: "scoreValue",
                    render: (value) => <strong>{value}</strong>,
                  },
                  {
                    title: "Label",
                    dataIndex: "scoreLabel",
                    key: "scoreLabel",
                  },
                ]}
              />
            </Spin>
          </>
        )}
      </Modal>

      {/* Employee Evaluation History Modal */}
      <Modal
        title="Employee Evaluation History"
        open={showHistoryModal}
        onCancel={() => setShowHistoryModal(false)}
        footer={null}
        width={800}
        getContainer={false} 
      >
        <Table<EvalWithNames>
          rowKey="evaluationID"
          columns={columnsV2}
          dataSource={selectedEmployeeHistory}
          pagination={{ pageSize: 5 }}
          bordered
        />
      </Modal>
    </div>
  );
};

export default EvaluatedPage;