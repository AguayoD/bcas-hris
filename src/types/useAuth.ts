
import { useEffect, useState } from 'react';
import { AuthenticationTypes } from '../types/auth';

export const useAuth = () => {
  const [user, setUser] = useState<AuthenticationTypes['user'] | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = () => {
      const token = localStorage.getItem('authToken');
      const userData = localStorage.getItem('userData');
      
      if (token && userData) {
        try {
          setIsAuthenticated(true);
          setUser(JSON.parse(userData));
        } catch (error) {
          console.error('Failed to parse user data', error);
          logout();
        }
      }
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const login = (data: AuthenticationTypes) => {
    localStorage.setItem('authToken', data.token);
    localStorage.setItem('userData', JSON.stringify(data.user));
    setUser(data.user);
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    setUser(null);
    setIsAuthenticated(false);
  };

  return { 
    user, 
    isAuthenticated, 
    isLoading,
    login, 
    logout 
  };
};