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
import DepartmentService from "../api/DepartmentService";
import { DepartmentTypes } from "../types/tblDepartment";
import type { ColumnsType } from "antd/lib/table";

const { TextArea } = Input;

const DepartmentPage: React.FC = () => {
  const [form] = Form.useForm();
  const [departments, setDepartments] = useState<DepartmentTypes[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [editingDepartment, setEditingDepartment] = useState<DepartmentTypes | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  useEffect(() => {
    fetchDepartments();
  }, [refreshKey]);

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const data = await DepartmentService.getAll();
      setDepartments(data);
    } catch (error) {
      message.error("Failed to fetch departments");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values: DepartmentTypes) => {
    try {
      if (editingDepartment?.departmentID) {
        const updateData = {
          ...values,
          departmentID: editingDepartment.departmentID,
        };
        await DepartmentService.update(
          editingDepartment.departmentID,
          updateData
        );
        message.success("Department updated successfully");
      } else {
        await DepartmentService.create(values);
        message.success("Department created successfully");
      }
      setIsModalVisible(false);
      form.resetFields();
      setEditingDepartment(null);
      setRefreshKey((prevKey) => prevKey + 1);
    } catch (error) {
      message.error(
        editingDepartment
          ? "Failed to update department"
          : "Failed to create department"
      );
      console.error(error);
    }
  };

  const handleDelete = async (departmentId: number) => {
    try {
      await DepartmentService.delete(departmentId);
      message.success("Department deleted successfully");
      setRefreshKey((prevKey) => prevKey + 1);
    } catch (error) {
      message.error("Failed to delete department");
      console.error(error);
    }
  };

  const handleEdit = (record: DepartmentTypes) => {
    setEditingDepartment(record);
    form.setFieldsValue({
      departmentName: record.departmentName,
      description: record.description,
    });
    setIsModalVisible(true);
  };

  const showAddModal = () => {
    setEditingDepartment(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const columns: ColumnsType<DepartmentTypes> = [
    {
      title: "Department Name",
      dataIndex: "departmentName",
      key: "departmentName",
      width: "30%",
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
            title="Are you sure you want to delete this department?"
            onConfirm={() => handleDelete(record.departmentID!)}
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
    <div className="department-page">
      <Card
        title="Departments Management"
        extra={
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={showAddModal}
            >
              Add Department
            </Button>
          </Space>
        }
      >
        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={departments}
            rowKey="departmentID"
            pagination={{ pageSize: 10 }}
          />
        </Spin>
      </Card>

      <Modal
        title={editingDepartment ? "Edit Department" : "Add Department"}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="departmentName"
            label="Department Name"
            rules={[
              { required: true, message: "Please enter department name" },
            ]}
          >
            <Input placeholder="Enter department name" />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <TextArea rows={4} placeholder="Enter department description" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingDepartment ? "Update" : "Create"}
              </Button>
              <Button onClick={() => setIsModalVisible(false)}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DepartmentPage;
