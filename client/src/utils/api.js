class ApiClient {
  constructor() {
    this.baseURL = 'http://localhost:5000/api';
    this.retryCount = 0;
    this.maxRetries = 3;
    this.isRefreshing = false;
    this.refreshQueue = [];
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        // Handle token expiration with refresh mechanism
        if (data.code === 'TOKEN_EXPIRED' && this.retryCount < this.maxRetries) {
          return await this.handleTokenRefresh(endpoint, options);
        }
        
        throw new Error(data.message || 'Something went wrong');
      }

      this.retryCount = 0;
      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  async handleTokenRefresh(originalEndpoint, originalOptions) {
    if (this.isRefreshing) {
      // If already refreshing, add to queue
      return new Promise((resolve, reject) => {
        this.refreshQueue.push({ resolve, reject });
      }).then(() => this.request(originalEndpoint, originalOptions));
    }

    this.isRefreshing = true;
    this.retryCount++;

    try {
      const refreshToken = this.getRefreshToken();
      
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const refreshResponse = await this.request('/auth/refresh-token', {
        method: 'POST',
        body: { refreshToken },
      });

      if (refreshResponse.success) {
        const { accessToken, refreshToken: newRefreshToken } = refreshResponse.data;
        this.setToken(accessToken);
        this.setRefreshToken(newRefreshToken);

        // Process queued requests
        this.refreshQueue.forEach(({ resolve }) => resolve());
        this.refreshQueue = [];

        // Retry original request
        return await this.request(originalEndpoint, {
          ...originalOptions,
          headers: {
            ...originalOptions.headers,
            Authorization: `Bearer ${accessToken}`,
          },
        });
      }
    } catch (refreshError) {
      // Process queued requests with error
      this.refreshQueue.forEach(({ reject }) => reject(refreshError));
      this.refreshQueue = [];
      
      this.clearTokens();
      window.location.href = '/login';
      throw new Error('Session expired. Please login again.');
    } finally {
      this.isRefreshing = false;
    }
  }

  // Auth methods
  async register(userData) {
    return this.request('/auth/register', {
      method: 'POST',
      body: userData,
    });
  }

  async login(credentials) {
    return this.request('/auth/login', {
      method: 'POST',
      body: credentials,
    });
  }

  async refreshToken(refreshToken) {
    return this.request('/auth/refresh-token', {
      method: 'POST',
      body: { refreshToken },
    });
  }

  async logout(refreshToken) {
    const token = this.getToken();
    return this.request('/auth/logout', {
      method: 'POST',
      body: { refreshToken },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  async logoutAll() {
    const token = this.getToken();
    return this.request('/auth/logout-all', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  async getCurrentUser() {
    const token = this.getToken();
    return this.request('/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  async updateProfile(userData) {
    const token = this.getToken();
    return this.request('/auth/profile', {
      method: 'PUT',
      body: userData,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  async changePassword(passwordData) {
    const token = this.getToken();
    return this.request('/auth/change-password', {
      method: 'PUT',
      body: passwordData,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  async getSessions() {
    const token = this.getToken();
    return this.request('/auth/sessions', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  async revokeSession(sessionId) {
    const token = this.getToken();
    return this.request(`/auth/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  // Token management
  setToken(token) {
    localStorage.setItem('accessToken', token);
  }

  getToken() {
    return localStorage.getItem('accessToken');
  }

  setRefreshToken(token) {
    localStorage.setItem('refreshToken', token);
  }

  getRefreshToken() {
    return localStorage.getItem('refreshToken');
  }

  clearTokens() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  isAuthenticated() {
    return !!this.getToken();
  }
}

export const apiClient = new ApiClient();