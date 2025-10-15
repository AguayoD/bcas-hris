import React, { useEffect, useState } from 'react';
import { Table, Spin, Typography, Button, message, Select, Modal } from 'antd';
import { RedoOutlined, PrinterOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import axios from '../api/_axiosInstance';
import moment from 'moment';
import { ROLES } from '../types/auth';
import { useAuth } from '../types/useAuth';

const { Title } = Typography;
const { Option } = Select;

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
  departmentName?: string;
}

const EvaluatedPage: React.FC = () => {
  const [evaluations, setEvaluations] = useState<EvalWithNames[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [resetting, setResetting] = useState<boolean>(false);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedEvaluation, setSelectedEvaluation] = useState<EvalWithNames | null>(null);
  const [evaluationAnswers, setEvaluationAnswers] = useState<SubGroupAnswer[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const { user } = useAuth();
  const isAdmin = user?.roleId === ROLES.Admin;
  const isHR = user?.roleId === ROLES.HR;

  useEffect(() => {
    fetchEvaluations();
  }, []);

  const fetchEvaluations = async () => {
    try {
      const res = await axios.get('/Evaluations');
      // Fetch department information for each evaluation
      const evaluationsWithDepartments = await Promise.all(
        res.data.map(async (evaluation: EvalWithNames) => {
          try {
            // Get employee details to find department
            const employeeRes = await axios.get(`/Employees/${evaluation.employeeID}`);
            const employeeData = employeeRes.data;
            
            // The department name might be in different places in the response
            // Try these common patterns:
            let departmentName = 'N/A';
            
            if (employeeData.departmentName) {
              departmentName = employeeData.departmentName;
            } else if (employeeData.department && employeeData.department.departmentName) {
              departmentName = employeeData.department.departmentName;
            } else if (employeeData.departmentID) {
              // If we only have departmentID, we need to fetch the department separately
              const deptRes = await axios.get(`/Department/${employeeData.departmentID}`);
              departmentName = deptRes.data.departmentName || 'N/A';
            }
            
            return {
              ...evaluation,
              departmentName
            };
          } catch (error) {
            console.error(`Error fetching department for employee ${evaluation.employeeID}:`, error);
            return {
              ...evaluation,
              departmentName: 'N/A'
            };
          }
        })
      );
      setEvaluations(evaluationsWithDepartments);
    } catch (error) {
      console.error('Error fetching evaluations:', error);
      message.error('Failed to fetch evaluations');
    } finally {
      setLoading(false);
    }
  };

  // Get unique departments for the filter
  const departments = Array.from(new Set(evaluations.map(evalItem => evalItem.departmentName).filter(Boolean))) as string[];

  // Sort evaluations by finalScore (highest to lowest)
  const sortedEvaluations = [...evaluations].sort((a, b) => b.finalScore - a.finalScore);

  // Filter evaluations based on selected department and maintain sort order
  const filteredEvaluations = selectedDepartment === 'all' 
    ? sortedEvaluations 
    : sortedEvaluations.filter(evalItem => evalItem.departmentName === selectedDepartment);

  const handleReset = async () => {
    setResetting(true);
    try {
      console.log('Sending reset request to /Evaluations/reset');
      
      // Call your reset API endpoint
      const response = await axios.post('/Evaluations/reset');
      console.log('Reset response:', response);
      
      message.success('Evaluation data reset successfully');
      
      // Refresh the evaluations data
      await fetchEvaluations();
      
      // Trigger a custom event to notify Dashboard about the reset
      window.dispatchEvent(new CustomEvent('evaluationsReset'));
    } catch (error: any) {
      console.error('Error resetting evaluations:', error);
      console.log('Error response:', error.response);
      console.log('Error status:', error.response?.status);
      console.log('Error data:', error.response?.data);
      message.error('Failed to reset evaluation data');
    } finally {
      setResetting(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      message.error("Popup blocked! Please allow popups for printing.");
      return;
    }

    // Sort filtered evaluations by finalScore (highest to lowest) for printing
    const sortedForPrint = [...filteredEvaluations].sort((a, b) => b.finalScore - a.finalScore);

    // Calculate summary statistics for the filtered data
    const totalEvaluations = sortedForPrint.length;
    const averageScore = totalEvaluations > 0 
      ? sortedForPrint.reduce((sum, evalItem) => sum + evalItem.finalScore, 0) / totalEvaluations 
      : 0;
    const maxScore = totalEvaluations > 0 
      ? Math.max(...sortedForPrint.map(evalItem => evalItem.finalScore)) 
      : 0;
    const minScore = totalEvaluations > 0 
      ? Math.min(...sortedForPrint.map(evalItem => evalItem.finalScore)) 
      : 0;

    const tableHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Employee Evaluations Report${selectedDepartment !== 'all' ? ` - ${selectedDepartment} Department` : ''}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .print-header { text-align: center; margin-bottom: 20px; }
          .print-title { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
          .print-date { font-size: 14px; color: #666; margin-bottom: 20px; }
          .print-department { font-size: 18px; color: #333; margin-bottom: 15px; }
          .summary-stats { 
            margin: 20px 0; 
            padding: 15px; 
            background-color: #f5f5f5; 
            border-radius: 5px;
          }
          .summary-stats h3 { margin-top: 0; }
          .stats-grid { 
            display: grid; 
            grid-template-columns: repeat(2, 1fr); 
            gap: 10px; 
          }
          .stat-item { display: flex; justify-content: space-between; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          .score-cell { text-align: center; }
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
            .summary-stats { background-color: #f5f5f5 !important; }
          }
        </style>
      </head>
      <body>
        <div class="print-header">
          <div class="print-title">Employee Evaluations Report</div>
          ${selectedDepartment !== 'all' ? `<div class="print-department">Department: ${selectedDepartment}</div>` : ''}
          <div class="print-date">Generated on: ${moment().format("MMMM D, YYYY h:mm A")}</div>
        </div>
        
        ${totalEvaluations > 0 ? `
        <div class="summary-stats">
          <h3>Summary Statistics</h3>
          <div class="stats-grid">
            <div class="stat-item">
              <span>Total Evaluations:</span>
              <span><strong>${totalEvaluations}</strong></span>
            </div>
            <div class="stat-item">
              <span>Average Score:</span>
              <span><strong>${averageScore.toFixed(2)}</strong></span>
            </div>
            <div class="stat-item">
              <span>Highest Score:</span>
              <span><strong>${maxScore.toFixed(2)}</strong></span>
            </div>
            <div class="stat-item">
              <span>Lowest Score:</span>
              <span><strong>${minScore.toFixed(2)}</strong></span>
            </div>
          </div>
        </div>
        ` : ''}
        
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Department</th>
              <th>Evaluator</th>
              <th>Evaluation Date</th>
              <th>Final Score</th>
            </tr>
          </thead>
          <tbody>
            ${sortedForPrint.length > 0 ? sortedForPrint
              .map(
                (evaluation) => `
              <tr>
                <td>${evaluation.employeeName || 'N/A'}</td>
                <td>${evaluation.departmentName || 'N/A'}</td>
                <td>${evaluation.evaluatorName || 'N/A'}</td>
                <td>${evaluation.evaluationDate ? moment(evaluation.evaluationDate).format("YYYY-MM-DD") : 'N/A'}</td>
                <td class="score-cell"><strong>${evaluation.finalScore.toFixed(2)}</strong></td>
              </tr>
            `
              )
              .join("") : `
              <tr>
                <td colspan="5" style="text-align: center;">No evaluation data available</td>
              </tr>
            `}
          </tbody>
        </table>
        <div class="no-print" style="margin-top: 20px; text-align: center;">
          <button onclick="window.print()" style="padding: 10px 20px; margin: 0 10px; cursor: pointer;">Print</button>
          <button onclick="window.close()" style="padding: 10px 20px; margin: 0 10px; cursor: pointer;">Close</button>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(tableHtml);
    printWindow.document.close();
  };

  const showModal = async (evaluation: EvalWithNames) => {
    setSelectedEvaluation(evaluation);
    setIsModalVisible(true);
    setModalLoading(true);

    try {
      const res = await axios.get<EvaluationAnswerResponse>(`/Evaluations/${evaluation.evaluationID}/answers`);
      setEvaluationAnswers(res.data.answers);
    } catch (error) {
      console.error('Error fetching evaluation answers:', error);
      setEvaluationAnswers([]);
    } finally {
      setModalLoading(false);
    }
  };

  const handleModalClose = () => {
    setIsModalVisible(false);
    setSelectedEvaluation(null);
    setEvaluationAnswers([]);
  };

  const columns: ColumnsType<EvalWithNames> = [
    {
      title: 'Employee',
      dataIndex: 'employeeName',
      key: 'employeeName',
    },
    {
      title: 'Department',
      dataIndex: 'departmentName',
      key: 'departmentName',
      render: (department: string) => department || 'N/A',
    },
    {
      title: 'Evaluator',
      dataIndex: 'evaluatorName',
      key: 'evaluatorName',
    },
    {
      title: 'Date',
      dataIndex: 'evaluationDate',
      key: 'evaluationDate',
      render: (d: string) => new Date(d).toLocaleDateString(),
    },
    {
      title: 'Evaluation Score Average',
      dataIndex: 'finalScore',
      key: 'finalScore',
      render: (score: number) => score.toFixed(2),
      sorter: (a, b) => a.finalScore - b.finalScore,
      defaultSortOrder: 'descend',
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Button type="link" onClick={() => showModal(record)}>
          View Details
        </Button>
      ),
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={2} style={{ margin: 0 }}>Evaluations</Title>
        <div style={{ display: 'flex', gap: 8 }}>
          <Select
            value={selectedDepartment}
            onChange={setSelectedDepartment}
            style={{ width: 200 }}
            placeholder="Filter by department"
          >
            <Option value="all">All Departments</Option>
            {departments.map(dept => (
              <Option key={dept} value={dept}>{dept}</Option>
            ))}
          </Select>
          <Button 
            type="primary" 
            icon={<PrinterOutlined />}
            onClick={handlePrint}
          >
            Print Report
          </Button>
          {(isAdmin || isHR) && (
            <>
          <Button 
            type="primary" 
            icon={<RedoOutlined />}
            loading={resetting}
            onClick={handleReset}
            danger
          >
            Reset Evaluation Data
          </Button>
          </>
          )}
        </div>
      </div>
      <Spin spinning={loading || resetting}>
        <Table
          rowKey="evaluationID"
          columns={columns}
          dataSource={filteredEvaluations}
          bordered
          pagination={{ pageSize: 10 }}
          sortDirections={['descend', 'ascend']}
        />
      </Spin>

      <Modal
        title="Evaluation Answers"
        open={isModalVisible}
        onCancel={handleModalClose}
        footer={null}
        width={700}
      >
        {selectedEvaluation && (
          <>
            <p><strong>Evaluator:</strong> {selectedEvaluation.evaluatorName}</p>
            <p><strong>Employee Evaluated:</strong> {selectedEvaluation.employeeName}</p>
            <p><strong>Department:</strong> {selectedEvaluation.departmentName || 'N/A'}</p>
            <p><strong>Final Score:</strong> {selectedEvaluation.finalScore.toFixed(2)}</p>
            <p><strong>Evaluation Date:</strong> {new Date(selectedEvaluation.evaluationDate).toLocaleDateString()}</p>

            <Spin spinning={modalLoading}>
              <Table<SubGroupAnswer>
                rowKey="subGroupID"
                dataSource={evaluationAnswers}
                pagination={false}
                bordered
                size="small"
                columns={[
                  {
                    title: 'SubGroup',
                    dataIndex: 'subGroupName',
                    key: 'subGroupName',
                  },
                  {
                    title: 'Score',
                    dataIndex: 'scoreValue',
                    key: 'scoreValue',
                    render: (value) => <strong>{value}</strong>,
                  },
                  {
                    title: 'Label',
                    dataIndex: 'scoreLabel',
                    key: 'scoreLabel',
                  },
                ]}
              />
            </Spin>
          </>
        )}
      </Modal>
    </div>
  );
  
};

export default EvaluatedPage;