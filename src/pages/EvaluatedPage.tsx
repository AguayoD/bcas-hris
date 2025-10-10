import React, { useEffect, useState } from 'react';
import { Table, Spin, Typography, Button, message } from 'antd';
import { RedoOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import axios from '../api/_axiosInstance';

const { Title } = Typography;

interface EvalWithNames {
  evaluationID: number;
  employeeID: number;
  employeeName: string;
  evaluatorID: number;
  evaluatorName: string;
  evaluationDate: string;
  finalScore: number;
  createdAt: string;
}

const EvaluatedPage: React.FC = () => {
  const [evaluations, setEvaluations] = useState<EvalWithNames[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [resetting, setResetting] = useState<boolean>(false);

  useEffect(() => {
    fetchEvaluations();
  }, []);

  const fetchEvaluations = async () => {
    try {
      const res = await axios.get('/Evaluations');
      setEvaluations(res.data);
    } catch (error) {
      console.error('Error fetching evaluations:', error);
      message.error('Failed to fetch evaluations');
    } finally {
      setLoading(false);
    }
  };

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

  const columns: ColumnsType<EvalWithNames> = [
    {
      title: 'Employee',
      dataIndex: 'employeeName',
      key: 'employeeName',
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
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={2} style={{ margin: 0 }}>Evaluations</Title>
        <Button 
          type="primary" 
          icon={<RedoOutlined />}
          loading={resetting}
          onClick={handleReset}
          danger
        >
          Reset Evaluation Data
        </Button>
      </div>
      <Spin spinning={loading || resetting}>
        <Table
          rowKey="evaluationID"
          columns={columns}
          dataSource={evaluations}
          bordered
          pagination={{ pageSize: 10 }}
        />
      </Spin>
    </div>
  );
};

export default EvaluatedPage;