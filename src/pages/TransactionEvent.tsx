// src/pages/TransactionEventsPage.tsx
import React, { useState, useEffect } from "react";
import { Table, Card, DatePicker, Select, Button, Space, Modal, Typography, message, Tag } from "antd";
import { ReloadOutlined, EyeOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import type { ColumnsType } from "antd/es/table";
import type { Key } from "antd/es/table/interface";
import axios from "../api/_axiosInstance";

const { RangePicker } = DatePicker;
const { Title } = Typography;
const { Option } = Select;

interface TransactionEvent {
    transactionEventID: number;
    action: string;
    description: string;
    userID: number;
    userName: string;
    fullname: string;
    timestamp: string;
}

const TransactionEventsPage: React.FC = () => {
    const [events, setEvents] = useState<TransactionEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<TransactionEvent | null>(null);
    const [detailModalVisible, setDetailModalVisible] = useState(false);

    // Filters
    const [filters, setFilters] = useState({
        action: "",
        userName: "",
        dateRange: null as [dayjs.Dayjs, dayjs.Dayjs] | null,
    });

    // Fetch transaction events from API
    const fetchEvents = async () => {
        try {
            setLoading(true);
            const response = await axios.get<TransactionEvent[]>("/TransactionEvents");
            let data = response.data;

            // Apply client-side filtering
            if (filters.action) {
                data = data.filter(e => e.action.toLowerCase() === filters.action.toLowerCase());
            }
            if (filters.userName) {
                data = data.filter(e => e.userName?.toLowerCase().includes(filters.userName.toLowerCase()));
            }
            if (filters.dateRange) {
                const [start, end] = filters.dateRange;
                data = data.filter(e => {
                    const ts = dayjs(e.timestamp);
                    return ts.isAfter(start.startOf("day")) && ts.isBefore(end.endOf("day"));
                });
            }

            setEvents(data);
        } catch (error: any) {
            console.error("Error fetching events:", error);
            message.error("Failed to fetch transaction events");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEvents();
    }, [filters]);

    const columns: ColumnsType<TransactionEvent> = [
        {
            title: "Action",
            dataIndex: "action",
            key: "action",
            render: (text: string) => <Tag color={text === "CREATE" ? "green" : text === "UPDATE" ? "blue" : "red"}>{text}</Tag>,
            filters: [
                { text: "CREATE", value: "CREATE" },
                { text: "UPDATE", value: "UPDATE" },
                { text: "DELETE", value: "DELETE" },
            ],
            onFilter: (value: boolean | Key, record: TransactionEvent) => record.action === value.toString(),
        },
        {
            title: "Description",
            dataIndex: "description",
            key: "description",
        },
        {
            title: "User",
            dataIndex: "userName",
            key: "userName",
            sorter: (a: TransactionEvent, b: TransactionEvent) => (a.userName || "").localeCompare(b.userName || ""),
        },
        {
            title: "Fullname",
            dataIndex: "fullname",
            key: "fullname",
            sorter: (a: TransactionEvent, b: TransactionEvent) => (a.fullname || "").localeCompare(b.fullname || ""),
        },
        {
            title: "Timestamp",
            dataIndex: "timestamp",
            key: "timestamp",
            render: (text: string) => dayjs(text).format("YYYY-MM-DD HH:mm:ss"),
            sorter: (a: TransactionEvent, b: TransactionEvent) => dayjs(a.timestamp).unix() - dayjs(b.timestamp).unix(),
        },
        {
            title: "Actions",
            key: "actions",
            render: (_: any, record: TransactionEvent) => (
                <Button
                    icon={<EyeOutlined />}
                    onClick={() => {
                        setSelectedEvent(record);
                        setDetailModalVisible(true);
                    }}
                >
                    View
                </Button>
            ),
        },
    ];

    const handleResetFilters = () => {
        setFilters({ action: "", userName: "", dateRange: null });
    };

    return (
        <Card style={{ margin: 16 }}>
            <Title level={3}>Audit Logs</Title>

            <Space style={{ marginBottom: 16 }} wrap>
                <Select
                    placeholder="Filter by Action"
                    style={{ width: 180 }}
                    allowClear
                    value={filters.action || undefined}
                    onChange={(value) => setFilters(f => ({ ...f, action: value || "" }))}
                >
                    <Option value="CREATE">CREATE</Option>
                    <Option value="UPDATE">UPDATE</Option>
                    <Option value="DELETE">DELETE</Option>
                </Select>

                <Select
                    placeholder="Filter by User"
                    style={{ width: 180 }}
                    allowClear
                    value={filters.userName || undefined}
                    onChange={(value) => setFilters(f => ({ ...f, userName: value || "" }))}
                >
                    {/* TODO: populate users dynamically */}
                </Select>

                <RangePicker
                    value={filters.dateRange}
                    onChange={(dates) => setFilters(f => ({ ...f, dateRange: dates as [dayjs.Dayjs, dayjs.Dayjs] | null }))}
                />

                <Button icon={<ReloadOutlined />} onClick={handleResetFilters}>
                    Reset Filters
                </Button>
            </Space>

            <Table
                dataSource={events}
                columns={columns}
                rowKey="transactionEventID"
                loading={loading}
                pagination={{ pageSize: 20 }}
                scroll={{ x: true }}
            />

            {/* Detail Modal */}
            <Modal
                title="Transaction Event Details"
                open={detailModalVisible}
                onCancel={() => setDetailModalVisible(false)}
                footer={null}
                width={600}
            >
                {selectedEvent && (
                    <div>
                        <p><strong>Action:</strong> <Tag color={selectedEvent.action === "CREATE" ? "green" : selectedEvent.action === "UPDATE" ? "blue" : "red"}>{selectedEvent.action}</Tag></p>
                        <p><strong>Description:</strong> {selectedEvent.description}</p>
                        <p><strong>User:</strong> {selectedEvent.userName}</p>
                        <p><strong>Fullname:</strong> {selectedEvent.fullname}</p>
                        <p><strong>Timestamp:</strong> {dayjs(selectedEvent.timestamp).format("YYYY-MM-DD HH:mm:ss")}</p>
                    </div>
                )}
            </Modal>
        </Card>
    );
};

export default TransactionEventsPage;