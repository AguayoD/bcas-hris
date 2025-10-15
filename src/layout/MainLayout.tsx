import { Layout, Menu, Button } from "antd";
import {
  DashboardOutlined,
  TeamOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  FolderOutlined,
  BookOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { useState, useEffect } from "react";
import { useNavigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../types/useAuth";
import { ROLES } from "../types/auth";
import './MainLayout.css';

const { Header, Content, Sider } = Layout;
const { SubMenu } = Menu;

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
  const isHR = user?.roleId === ROLES.HR;

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

  // Define menu item type
  type MenuItem = {
    key: string;
    icon: React.ReactNode;
    label: string;
    children?: MenuItem[];
  };

  // Define menu items based on user role
  const getMenuItems = (): MenuItem[] => {
    const baseItems: MenuItem[] = [
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

    // Admin-only menu items grouped in a submenu
    const adminSubMenu = isAdmin || isHR ? [
      {
        key: "submenu-admin",
        icon: <SettingOutlined />,
        label: "System Management",
        children: [
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
            key: 'educational-attainment',
            icon: <BookOutlined />,
            label: 'Educational Attainment',
          },
          {
            key: 'employment-status', 
            icon: <TeamOutlined />,
            label: 'Employment Status',
          },
          {
            key: "users",
            icon: <UserOutlined />,
            label: "User Management",
          },
        ]
      }
    ] : [];

    const logoutItem = {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "Logout",
    };

    // Build menu items array based on user role
    let menuItems = [...baseItems];
    
    // Add evaluation items for both admin and coordinator
    if (isAdmin || isCoordinator || isHR) {
      menuItems = [...menuItems, ...evaluationItems];
    }
    
    // Add common items
    menuItems = [...menuItems, ...commonItems];
    
    // Add admin submenu right before logout
    if (isAdmin || isHR) {
      menuItems = [...menuItems, ...adminSubMenu];
    }
    
    // Add logout item at the end
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
        >
          {getMenuItems().map(item => 
            item.children ? (
              <SubMenu
                key={item.key}
                icon={item.icon}
                title={item.label}
              >
                {item.children.map(child => (
                  <Menu.Item key={child.key} icon={child.icon}>
                    {child.label}
                  </Menu.Item>
                ))}
              </SubMenu>
            ) : (
              <Menu.Item key={item.key} icon={item.icon}>
                {item.label}
              </Menu.Item>
            )
          )}
        </Menu>
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