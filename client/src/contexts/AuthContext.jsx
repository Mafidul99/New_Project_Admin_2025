import React, { createContext, useState, useContext, useEffect } from 'react';
import { apiClient } from '../utils/api';

const AuthContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    if (apiClient.isAuthenticated()) {
      try {
        const response = await apiClient.getCurrentUser();
        setUser(response.data.user);
      } catch (error) {
        console.error('Auth check failed:', error);
        apiClient.clearTokens();
      }
    }
    setLoading(false);
  };

  const login = async (credentials) => {
    try {
      setError('');
      setLoading(true);
      const response = await apiClient.login(credentials);
      
      if (response.success) {
        const { user, tokens } = response.data;
        apiClient.setToken(tokens.accessToken);
        apiClient.setRefreshToken(tokens.refreshToken);
        setUser(user);
        return { success: true };
      }
    } catch (error) {
      const errorMessage = error.message || 'Login failed. Please try again.';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData) => {
    try {
      setError('');
      setLoading(true);
      const response = await apiClient.register(userData);
      
      if (response.success) {
        const { user, tokens } = response.data;
        apiClient.setToken(tokens.accessToken);
        apiClient.setRefreshToken(tokens.refreshToken);
        setUser(user);
        return { success: true };
      }
    } catch (error) {
      const errorMessage = error.message || 'Registration failed. Please try again.';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      const refreshToken = apiClient.getRefreshToken();
      if (refreshToken) {
        await apiClient.logout(refreshToken);
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      apiClient.clearTokens();
      setUser(null);
    }
  };

  const logoutAll = async () => {
    try {
      await apiClient.logoutAll();
    } catch (error) {
      console.error('Logout all error:', error);
    } finally {
      apiClient.clearTokens();
      setUser(null);
    }
  };

  const updateProfile = async (userData) => {
    try {
      setError('');
      const response = await apiClient.updateProfile(userData);
      
      if (response.success) {
        setUser(response.data.user);
        return { success: true };
      }
    } catch (error) {
      const errorMessage = error.message || 'Profile update failed.';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const changePassword = async (passwordData) => {
    try {
      setError('');
      const response = await apiClient.changePassword(passwordData);
      
      if (response.success) {
        return { success: true };
      }
    } catch (error) {
      const errorMessage = error.message || 'Password change failed.';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const clearError = () => setError('');

  const value = {
    user,
    loading,
    error,
    login,
    register,
    logout,
    logoutAll,
    updateProfile,
    changePassword,
    clearError,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isModerator: user?.role === 'manager' || user?.role === 'admin',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};