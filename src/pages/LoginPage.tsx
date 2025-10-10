import { Form, Input, Button, Card, Typography, message } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import { useNavigate, useLocation, Link  } from "react-router-dom";
import { useState } from "react";
import authenticationService from "../api/authenticationService";
import { AuthenticationTypes } from "../types/auth";
import { LoginTypes, } from "../types/auth";
import { useAuth } from "../types/useAuth";
import "./LoginPage.css"; 

const { Title } = Typography;

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm(); // Add form instance

  const onFinish = async (data: LoginTypes) => {
    const hardcodedUsername = "admin";
    const hardcodedPassword = "admin";

    // ✅ Hardcoded login check first
    if (data.username === hardcodedUsername && data.password === hardcodedPassword) {
      const mockUser: AuthenticationTypes = {
        token: "hardcoded-token",
        user: {
          userId: 1,
          employeeId: 123,
          roleId: 1,
          firstName: "Admin",
          lastName: "User",
          username: "admin",
          roles: [
            { roleId: 1, roleName: "admin" }
          ],
        },
      };

      login(mockUser);
      message.success('Login successful!');
      const from = location.state?.from?.pathname || "/dashboard";
      navigate(from, { replace: true });
      return;
    }

    // ⬇️ If not hardcoded login, continue with normal API call
    try {
      setLoading(true);
      const response = await authenticationService.login(data);

      if (response) {
        login(response);
        message.success('Login successful!');
        const from = location.state?.from?.pathname || "/dashboard";
        navigate(from, { replace: true });
      } else {
        // Set form field errors with red markings
        form.setFields([
          {
            name: 'username',
            errors: ['Invalid username or password'],
          },
          {
            name: 'password',
            errors: ['Invalid username or password'],
          },
        ]);
        message.error('Invalid username or password.');
      }
    } catch (error) {
      console.error('Login failed:', error);
      
      // Set form field errors for API errors too
      form.setFields([
        {
          name: 'username',
          errors: ['Invalid username or password.'],
        },
        {
          name: 'password',
          errors: ['Invalid username or password.'],
        },
      ]);
      message.error('Invalid username or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "rgb(255 255 255)",
      }}
    >
      <Card style={{ width: 350 }}>
        <Title level={3} style={{ textAlign: "center" }}>
          Login
        </Title>
        <Form
          form={form} // Connect form instance
          name="login-form"
          initialValues={{ remember: true }}
          onFinish={onFinish}
          layout="vertical"
        >
          <Form.Item
            label="Username"
            name="username"
            rules={[{ required: true, message: "Please input your username!" }]}
          >
            <Input prefix={<UserOutlined />} placeholder="Username" />
          </Form.Item>

          <Form.Item
            label="Password"
            name="password"
            rules={[{ required: true, message: "Please input your password!" }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Password" />
          </Form.Item>

          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              block 
              loading={loading}
              className="login-button"
            >
              Login
            </Button>
            <Link to="/forgot-password">Forgot password?</Link>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default LoginPage;