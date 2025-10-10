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
  EditOutlined,

} from "@ant-design/icons";
import type { ColumnsType } from "antd/lib/table";
import PositionService from "../api/PositionService";
import { PositionTypes } from "../types/tblPosition";

const PositionPage: React.FC = () => {
  const [positions, setPositions] = useState<PositionTypes[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [modalTitle, setModalTitle] = useState<string>("Add Position");
  const [form] = Form.useForm();
  const [editingPositionId, setEditingPositionId] = useState<number | null>(
    null
  );

  useEffect(() => {
    fetchPositions();
  }, []);

  const fetchPositions = async () => {
    setLoading(true);
    try {
      const data = await PositionService.getAll();
      setPositions(data);
    } catch (error) {
      message.error("Failed to fetch positions");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPosition = () => {
    setModalTitle("Add Position");
    setEditingPositionId(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEditPosition = async (positionId: number) => {
    setLoading(true);
    try {
      const position = await PositionService.getById(positionId);
      form.setFieldsValue({
        positionName: position.positionName,
        description: position.description,
      });
      setModalTitle("Edit Position");
      setEditingPositionId(positionId);
      setModalVisible(true);
    } catch (error) {
      message.error("Failed to fetch position details");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePosition = async (positionId: number) => {
    setLoading(true);
    try {
      await PositionService.delete(positionId);
      message.success("Position deleted successfully");
      fetchPositions();
    } catch (error) {
      message.error("Failed to delete position");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      if (editingPositionId) {
        const updateData: PositionTypes = {
          positionID: editingPositionId,
          positionName: values.positionName,
          description: values.description,
        };
        console.log("Sending update with data:", updateData);
        await PositionService.update(editingPositionId, updateData);
        message.success("Position updated successfully");
      } else {
        await PositionService.create(values);
        message.success("Position created successfully");
      }

      setModalVisible(false);
      fetchPositions();
    } catch (error) {
      console.error("Form validation or submission error:", error);
      message.error("Operation failed. Please check your data and try again.");
    } finally {
      setLoading(false);
    }
  };

  const columns: ColumnsType<PositionTypes> = [
    {
      title: "Position Name",
      dataIndex: "positionName",
      key: "positionName",
      width: "30%",
      sorter: (a, b) => {
        if (!a.positionName || !b.positionName) return 0;
        return a.positionName.localeCompare(b.positionName);
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
      width: "20%",
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEditPosition(record.positionID!)}
          ></Button>
          <Popconfirm
            title="Are you sure you want to delete this position?"
            onConfirm={() => handleDeletePosition(record.positionID!)}
            okText="Yes"
            cancelText="No"
          >
            <Button type="link" danger icon={<DeleteOutlined />}></Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="position-page">
      <Card
        title="Position Management"
        extra={
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddPosition}
            >
              Add Position
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={positions}
          rowKey="positionId"
          loading={loading}
          pagination={{
            defaultPageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ["10", "20", "50"],
          }}
        />
      </Card>

      {/* Add/Edit Position Modal */}
      <Modal
        title={modalTitle}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setModalVisible(false)}>
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={loading}
            onClick={handleSubmit}
          >
            Save
          </Button>,
        ]}
      >
        <Spin spinning={loading}>
          <Form form={form} layout="vertical" name="positionForm">
            <Form.Item
              name="positionName"
              label="Position Name"
              rules={[
                {
                  required: true,
                  message: "Please enter position name",
                },
                {
                  max: 100,
                  message: "Position name cannot exceed 100 characters",
                },
              ]}
            >
              <Input placeholder="Enter position name" />
            </Form.Item>
            <Form.Item
              name="description"
              label="Description"
              rules={[
                {
                  max: 500,
                  message: "Description cannot exceed 500 characters",
                },
              ]}
            >
              <Input.TextArea rows={4} placeholder="Enter description" />
            </Form.Item>
          </Form>
        </Spin>
      </Modal>
    </div>
  );
};

export default PositionPage;
