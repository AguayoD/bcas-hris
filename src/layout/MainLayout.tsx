import { Layout, Menu, Button } from "antd";
import {
  DashboardOutlined,
  TeamOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  FolderOutlined,
} from "@ant-design/icons";
import { useState, useEffect } from "react";
import { useNavigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../types/useAuth";
import { ROLES } from "../types/auth";
import './MainLayout.css';

const { Header, Content, Sider } = Layout;

const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileView, setMobileView] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  
  // Check if user is admin or coordinator
  const isAdmin = user?.roleId === ROLES.Admin;
  const isCoordinator = user?.roleId === ROLES.Coordinator;

  useEffect(() => {
    const handleResize = () => {
      setMobileView(window.innerWidth <= 992);
      if (window.innerWidth > 992) {
        setMobileMenuOpen(false);
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getActiveKey = () => {
    const path = location.pathname.split("/")[1] || "dashboard";
    return path;
  };

  const handleMenuClick = ({ key }: { key: string }) => {
    if (key === "logout") {
      // Use auth hook logout if available, fallback to localStorage
      if (logout) {
        logout();
      } else {
        localStorage.removeItem("authToken");
      }
      navigate("/");
    } else {
      navigate(`/${key}`);
    }
    if (mobileView) {
      setMobileMenuOpen(false);
    }
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  // Define menu items based on user role
  const getMenuItems = () => {
    const baseItems = [
      {
        key: "dashboard",
        icon: <DashboardOutlined />,
        label: "Dashboard",
      },
      {
        key: "faculty",
        icon: <TeamOutlined />,
        label: "Employees",
      }
    ];

    // Admin-only menu items
    const adminItems = [
      {
        key: "departments",
        icon: <TeamOutlined />,
        label: "Department",
      },
      {
        key: "positions",
        icon: <TeamOutlined />,
        label: "Positions",
      },
      {
        key: "users",
        icon: <UserOutlined />,
        label: "User Management",
      },
    ];

    // Items available for both Admin and Coordinator
    const evaluationItems = [
      {
        key: "evaluationForm",
        icon: <FolderOutlined />,
        label: "Evaluation Form",
      },
      {
        key: "evaluatedPage",
        icon: <FolderOutlined />,
        label: "Evaluated Employees",
      },
    ];

    const commonItems = [
      {
        key: "contracts",
        icon: <FolderOutlined />,
        label: "Contracts",
      },
    ];

    const logoutItem = {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "Logout",
    };

    // Build menu items array based on user role
    let menuItems = [...baseItems];
    
    // Add admin-only items if user is admin
    if (isAdmin) {
      menuItems = [...menuItems, ...adminItems];
    }
    
    // Add evaluation items for both admin and coordinator
    if (isAdmin || isCoordinator) {
      menuItems = [...menuItems, ...evaluationItems];
    }
    
    // Add common items
    menuItems = [...menuItems, ...commonItems];
    
    // Add logout item
    menuItems.push(logoutItem);

    return menuItems;
  };

  return (
    <Layout style={{ minHeight: "100vh", width: "100vw" }}>
      {mobileView && (
        <Button 
          className="mobile-menu-toggle"
          icon={mobileMenuOpen ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
          onClick={toggleMobileMenu}
        />
      )}
      
      <Sider
        collapsible
        collapsed={!mobileView && collapsed}
        onCollapse={(value) => setCollapsed(value)}
        className={`sidebar ${mobileMenuOpen ? "mobile-open" : ""}`}
        breakpoint="lg"
        collapsedWidth={mobileView ? 0 : 80}
        trigger={mobileView ? null : undefined}
        width={mobileView ? "80%" : undefined}
      >
        <div className="logo-container">
          <img 
            src="Images/logo.png" 
            alt="BCAS Logo"
            style={{
              width: (collapsed && !mobileView) ? '50px' : '160px',
              height: '50px',
              objectFit: 'contain',
              padding: (collapsed && !mobileView) ? '0' : '0 16px',
              transition: 'all 0.2s'
            }}
          />
        </div>
        <Menu
          theme="dark"
          selectedKeys={[getActiveKey()]}
          mode="inline"
          onClick={handleMenuClick}
          items={getMenuItems()}
        />
      </Sider>
      <Layout className="main-content">
        <Header style={{ padding: 0, background: "#fff", textAlign: "center" }}>
          <h3 style={{ margin: 0, padding: 16 }}>
            Welcome to BCAS HRMS
            {user && (
              <span style={{ fontSize: '14px', fontWeight: 'normal', marginLeft: '10px' }}>
                - {user.firstName} {user.lastName}
              </span>
            )}
          </h3>
        </Header>
        <Content style={{ margin: "16px" }}>
          {/* Outlet will render the child route components */}
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;