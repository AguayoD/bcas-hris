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
  Switch,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined
} from "@ant-design/icons";
import { EducationalAttainmentService } from "../api/EducationalAttainmentService";
import { EducationalAttainmentTypes } from "../types/tblEducationalAttainment";
import type { ColumnsType } from "antd/lib/table";

const { TextArea } = Input;

const EducationalAttainmentPage: React.FC = () => {
  const [form] = Form.useForm();
  const [attainments, setAttainments] = useState<EducationalAttainmentTypes[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [editingAttainment, setEditingAttainment] = useState<EducationalAttainmentTypes | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [submitPopconfirmVisible, setSubmitPopconfirmVisible] = useState<boolean>(false);
  const [formValues, setFormValues] = useState<EducationalAttainmentTypes | null>(null);

  useEffect(() => {
    fetchAttainments();
  }, [refreshKey]);

  const fetchAttainments = async () => {
    setLoading(true);
    try {
      const data = await EducationalAttainmentService.getAll();
      setAttainments(data);
    } catch (error) {
      message.error("Failed to fetch educational attainments");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values: EducationalAttainmentTypes) => {
    console.log('Submitting data:', values);
    console.log('Editing attainment:', editingAttainment);
    
    try {
      if (editingAttainment?.educationalAttainmentID) {
        const updateData = {
          ...values,
          educationalAttainmentID: editingAttainment.educationalAttainmentID,
        };
        await EducationalAttainmentService.update(
          editingAttainment.educationalAttainmentID,
          updateData
        );
        message.success("Educational attainment updated successfully");
      } else {
        await EducationalAttainmentService.create(values);
        message.success("Educational attainment created successfully");
      }
      setIsModalVisible(false);
      setSubmitPopconfirmVisible(false);
      form.resetFields();
      setEditingAttainment(null);
      setFormValues(null);
      setRefreshKey((prevKey) => prevKey + 1);
    } catch (error: any) {
      message.error(
        error.message || 
        (editingAttainment 
          ? "Failed to update educational attainment" 
          : "Failed to create educational attainment")
      );
      console.error('Detailed error:', error);
      setSubmitPopconfirmVisible(false);
    }
  };

  const handleFormFinish = (values: EducationalAttainmentTypes) => {
    setFormValues(values);
    if (editingAttainment) {
      setSubmitPopconfirmVisible(true);
    } else {
      handleSubmit(values);
    }
  };

  const handleConfirmUpdate = () => {
    if (formValues) {
      handleSubmit(formValues);
    }
    setSubmitPopconfirmVisible(false);
  };

  const handleCancelUpdate = () => {
    setSubmitPopconfirmVisible(false);
    setFormValues(null);
  };

  const handleDelete = async (attainmentId: number) => {
    try {
      await EducationalAttainmentService.delete(attainmentId);
      message.success("Educational attainment deleted successfully");
      setRefreshKey((prevKey) => prevKey + 1);
    } catch (error: any) {
      message.error(error.message || "Failed to delete educational attainment");
      console.error(error);
    }
  };

  const handleEdit = (record: EducationalAttainmentTypes) => {
    setEditingAttainment(record);
    form.setFieldsValue({
      attainmentName: record.attainmentName,
      description: record.description,
      isActive: record.isActive ?? true,
    });
    setIsModalVisible(true);
  };

  const showAddModal = () => {
    setEditingAttainment(null);
    form.resetFields();
    form.setFieldsValue({ isActive: true });
    setIsModalVisible(true);
  };

  const handleModalClose = () => {
    setIsModalVisible(false);
    setSubmitPopconfirmVisible(false);
    setFormValues(null);
    setEditingAttainment(null);
    form.resetFields();
  };

  const columns: ColumnsType<EducationalAttainmentTypes> = [
    {
      title: "Attainment Name",
      dataIndex: "attainmentName",
      key: "attainmentName",
      width: "25%",
      sorter: (a, b) => {
        if (!a.attainmentName || !b.attainmentName) return 0;
        return a.attainmentName.localeCompare(b.attainmentName);
      },
    },
    {
      title: "Description",
      dataIndex: "description",
      key: "description",
      width: "35%",
    },
    {
      title: "Active Status",
      dataIndex: "isActive",
      key: "isActive",
      width: "15%",
      render: (isActive: boolean) => (
        <span>{isActive ? "Active" : "Inactive"}</span>
      ),
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
            title="Are you sure you want to delete this educational attainment?"
            onConfirm={() => handleDelete(record.educationalAttainmentID!)}
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
    <div className="educational-attainment-page">
      <Card
        title="Educational Attainment Management"
        extra={
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={showAddModal}
            >
              Add Educational Attainment
            </Button>
          </Space>
        }
      >
        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={attainments}
            rowKey="educationalAttainmentID"
            pagination={{ pageSize: 10 }}
          />
        </Spin>
      </Card>

      <Modal
        title={editingAttainment ? "Edit Educational Attainment" : "Add Educational Attainment"}
        open={isModalVisible}
        onCancel={handleModalClose}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleFormFinish}>
          <Form.Item
            name="attainmentName"
            label="Attainment Name"
            rules={[
              { required: true, message: "Please enter attainment name" },
              { max: 100, message: "Attainment name cannot exceed 100 characters" },
            ]}
          >
            <Input placeholder="Enter attainment name (e.g., Bachelor's Degree)" />
          </Form.Item>

          <Form.Item 
            name="description" 
            label="Description"
            rules={[
              { max: 500, message: "Description cannot exceed 500 characters" },
            ]}
          >
            <TextArea rows={4} placeholder="Enter attainment description" />
          </Form.Item>

          <Form.Item 
            name="isActive" 
            label="Active Status"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item>
            <Space>
              <Popconfirm
                title="Are you sure you want to update this educational attainment?"
                open={submitPopconfirmVisible}
                onConfirm={handleConfirmUpdate}
                onCancel={handleCancelUpdate}
                okText="Yes"
                cancelText="No"
              >
                <span>
                  {/* Empty span wrapper for Popconfirm */}
                </span>
              </Popconfirm>
              <Button 
                type="primary" 
                htmlType="submit"
              >
                {editingAttainment ? "Update" : "Create"}
              </Button>
              <Button onClick={handleModalClose}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default EducationalAttainmentPage;