import { Layout, Menu, Button, Badge } from "antd";
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
  BellOutlined,
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
  const [pendingUpdatesCount, setPendingUpdatesCount] = useState(0);
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

  // Fetch pending updates count for Admin/HR
  useEffect(() => {
    if (isAdmin || isHR) {
      fetchPendingUpdatesCount();
      // Set up interval to refresh the count every 30 seconds
      const intervalId = setInterval(fetchPendingUpdatesCount, 30000);
      return () => clearInterval(intervalId);
    }
  }, [isAdmin, isHR]);

  const fetchPendingUpdatesCount = async () => {
    try {
      // Import the EmployeeService dynamically to avoid circular dependencies
      const { EmployeeService } = await import("../api/EmployeeService");
      const updates = await EmployeeService.getAllUpdates();
      const pendingCount = updates.filter(update => update.status === 'pending').length;
      setPendingUpdatesCount(pendingCount);
    } catch (error) {
      console.error("Error fetching pending updates count:", error);
      setPendingUpdatesCount(0);
    }
  };

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
    label: React.ReactNode; // Changed to React.ReactNode to support Badge
    children?: MenuItem[];
  };

  // Define menu items based on user role
  const getMenuItems = (): MenuItem[] => {
    const baseItems: MenuItem[] = [
      {
        key: "dashboard",
        icon: <DashboardOutlined />,
        label: "Dashboard",
      }
    ];

    // Employees menu item - different behavior based on role
    const employeesMenuItem = (isAdmin || isCoordinator || isHR)
      ? {
          key: "faculty",
          icon: <TeamOutlined />,
          label: "Employees",
        }
      : {
          key: "faculty",
          icon: <UserOutlined />,
          label: "My Profile",
        };

    // Evaluation items - will be placed differently based on role
    const evaluationItems = [
      {
        key: "evaluationForm",
        icon: <FolderOutlined />,
        label: "Evaluation Form",
      },
    ];

    // Add evaluated page separately for different roles
    const evaluatedPageItem = {
      key: "evaluatedPage",
      icon: <FolderOutlined />,
      label: (isAdmin || isHR || isCoordinator) ? "Evaluated Employees" : "My Evaluations",
    };

    const commonItems = [
      {
        key: "contracts",
        icon: <FolderOutlined />,
        label: "Contracts",
      },
    ];

    // Admin and HR submenu items (including evaluation items)
    const adminSubMenuItems = [
      ...evaluationItems,
      evaluatedPageItem, // Moved evaluated page item here for Admin/HR
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
      {
        key: "logs",
        icon: <UserOutlined />,
        label: "Audit Logs",
      },
    ];

    // Admin/HR submenu
    const adminSubMenu = (isAdmin || isHR) ? [
      {
        key: "submenu-admin",
        icon: <SettingOutlined />,
        label: "System Management",
        children: adminSubMenuItems
      }
    ] : [];

    const logoutItem = {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "Logout",
    };

    // Build menu items array based on user role
    let menuItems = [...baseItems];
    
    // Add employees menu item
    menuItems.push(employeesMenuItem);
    
    // Add Pending Updates ONLY for Admin/HR (as separate menu item)
    if (isAdmin || isHR) {
      menuItems.push({
        key: 'pending-updates', 
        icon: <BellOutlined />,
        label: (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Pending Updates</span>
            {pendingUpdatesCount > 0 && (
              <Badge 
                count={pendingUpdatesCount} 
                size="small" 
                style={{ 
                  backgroundColor: '#fa8c16',
                  marginLeft: '8px',
                  fontSize: '10px',
                  height: '16px',
                  minWidth: '16px',
                  lineHeight: '16px'
                }} 
              />
            )}
          </div>
        ),
      });
    }
    
    // Add evaluation items directly for coordinator (not for admin/HR as they're in submenu)
    if (isCoordinator) {
      menuItems = [...menuItems, ...evaluationItems, evaluatedPageItem];
    }
    
    // Add evaluated page for normal employees (not admin/HR/coordinator)
    if (!isAdmin && !isHR && !isCoordinator) {
      menuItems.push(evaluatedPageItem);
    }
    
    // Add common items for all roles
    menuItems = [...menuItems, ...commonItems];
    
    // Add admin submenu right before logout (for admin and HR only)
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
            Welcome to BCAS HRIS
            {user && (
              <span style={{ fontSize: '14px', fontWeight: 'normal', marginLeft: '10px' }}>
                - {user.firstName} {user.lastName}
              </span>
            )}
            {/* Show pending updates count in header for Admin/HR */}
            {(isAdmin || isHR) && pendingUpdatesCount > 0 && (
              <Badge 
                count={pendingUpdatesCount} 
                size="small" 
                style={{ 
                  backgroundColor: '#fa8c16',
                  marginLeft: '10px',
                  fontSize: '12px',
                  height: '18px',
                  minWidth: '18px',
                  lineHeight: '18px',
                  verticalAlign: 'middle'
                }}
                title={`${pendingUpdatesCount} pending update(s)`}
              />
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