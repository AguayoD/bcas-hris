// pages/EmploymentStatusPage.tsx
import React, { useState, useEffect } from "react";
import {
  Card,
  Form,
  Input,
  Button,
  Table,
  Space,
  message,
  Spin,
  Popconfirm,
  Modal,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined
} from "@ant-design/icons";
import { EmploymentStatusService } from "../api/EmploymentStatusService";
import { EmploymentStatusTypes } from "../types/tblEmploymentStatus";
import type { ColumnsType } from "antd/lib/table";

const { TextArea } = Input;

const EmploymentStatusPage: React.FC = () => {
  const [form] = Form.useForm();
  const [employmentStatuses, setEmploymentStatuses] = useState<EmploymentStatusTypes[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [editingStatus, setEditingStatus] = useState<EmploymentStatusTypes | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  useEffect(() => {
    fetchEmploymentStatuses();
  }, [refreshKey]);

  const fetchEmploymentStatuses = async () => {
    setLoading(true);
    try {
      const data = await EmploymentStatusService.getAll();
      setEmploymentStatuses(data);
    } catch (error) {
      message.error("Failed to fetch employment statuses");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values: EmploymentStatusTypes) => {
    try {
      if (editingStatus?.employmentStatusID) {
        const updateData = {
          ...values,
          employmentStatusID: editingStatus.employmentStatusID,
        };
        await EmploymentStatusService.update(
          editingStatus.employmentStatusID,
          updateData
        );
        message.success("Employment status updated successfully");
      } else {
        await EmploymentStatusService.create(values);
        message.success("Employment status created successfully");
      }
      setIsModalVisible(false);
      form.resetFields();
      setEditingStatus(null);
      setRefreshKey((prevKey) => prevKey + 1);
    } catch (error) {
      message.error(
        editingStatus
          ? "Failed to update employment status"
          : "Failed to create employment status"
      );
      console.error(error);
    }
  };

  const handleDelete = async (statusId: number) => {
    try {
      await EmploymentStatusService.delete(statusId);
      message.success("Employment status deleted successfully");
      setRefreshKey((prevKey) => prevKey + 1);
    } catch (error) {
      message.error("Failed to delete employment status");
      console.error(error);
    }
  };

  const handleEdit = (record: EmploymentStatusTypes) => {
    setEditingStatus(record);
    form.setFieldsValue({
      statusName: record.statusName,
      description: record.description,
    });
    setIsModalVisible(true);
  };

  const showAddModal = () => {
    setEditingStatus(null);
    form.resetFields();
    form.setFieldsValue({ isActive: true });
    setIsModalVisible(true);
  };

  const columns: ColumnsType<EmploymentStatusTypes> = [
    {
      title: "Status Name",
      dataIndex: "statusName",
      key: "statusName",
      width: "30%",
      sorter: (a, b) => {
        if (!a.statusName || !b.statusName) return 0;
        return a.statusName.localeCompare(b.statusName);
      },
    },
    {
      title: "Description",
      dataIndex: "description",
      key: "description",
      width: "40%",
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="Are you sure you want to delete this employment status?"
            onConfirm={() => handleDelete(record.employmentStatusID!)}
            okText="Yes"
            cancelText="No"
          >
            <Button type="link" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="employment-status-page">
      <Card
        title="Employment Status Management"
        extra={
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={showAddModal}
            >
              Add Employment Status
            </Button>
          </Space>
        }
      >
        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={employmentStatuses}
            rowKey="employmentStatusID"
            pagination={{ pageSize: 10 }}
          />
        </Spin>
      </Card>

      <Modal
        title={editingStatus ? "Edit Employment Status" : "Add Employment Status"}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="statusName"
            label="Status Name"
            rules={[
              { required: true, message: "Please enter status name" },
              { max: 100, message: "Status name cannot exceed 100 characters" },
            ]}
          >
            <Input placeholder="Enter status name (e.g., Hired, Probation)" />
          </Form.Item>

          <Form.Item 
            name="description" 
            label="Description"
            rules={[
              { max: 500, message: "Description cannot exceed 500 characters" },
            ]}
          >
            <TextArea rows={4} placeholder="Enter status description" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingStatus ? "Update" : "Create"}
              </Button>
              <Button onClick={() => setIsModalVisible(false)}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default EmploymentStatusPage;