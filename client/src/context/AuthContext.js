import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    // Check if user is logged in on app start
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      try {
        setUser(JSON.parse(userData));
        setToken(token);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const response = await fetch('http://localhost:5001/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.success) {
        const { user, token, redirectTo } = data.data;
        
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        
        setUser(user);
        setToken(token);
        setIsAuthenticated(true);
        
        return { 
          success: true, 
          user, 
          redirectTo 
        };
      } else {
        return { 
          success: false, 
          error: data.message 
        };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { 
        success: false, 
        error: 'Network error. Please check your connection.' 
      };
    }
  };

  // Step one of registration: the account is not created yet, a verification
  // code is emailed and the details are held server-side until it comes back
  const register = async (name, email, password) => {
    try {
      const response = await fetch('http://localhost:5001/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (data.success) {
        return {
          success: true,
          email: data.data.email,
          resendAfterSeconds: data.data.resendAfterSeconds,
          message: data.message
        };
      } else {
        return {
          success: false,
          error: data.message
        };
      }
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        error: 'Network error. Please check your connection.'
      };
    }
  };

  // Step two: a correct code creates the account and logs straight in
  const verifyRegistration = async (email, otp) => {
    try {
      const response = await fetch('http://localhost:5001/api/auth/verify-registration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, otp }),
      });

      const data = await response.json();

      if (data.success) {
        const { user, token } = data.data;

        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));

        setUser(user);
        setToken(token);
        setIsAuthenticated(true);

        return { success: true, user };
      } else {
        return {
          success: false,
          error: data.message
        };
      }
    } catch (error) {
      console.error('Verify registration error:', error);
      return {
        success: false,
        error: 'Network error. Please check your connection.'
      };
    }
  };

  const resendRegistrationOtp = async (email) => {
    try {
      const response = await fetch('http://localhost:5001/api/auth/resend-registration-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (data.success) {
        return {
          success: true,
          resendAfterSeconds: data.data.resendAfterSeconds,
          message: data.message
        };
      } else {
        return {
          success: false,
          error: data.message,
          resendAfterSeconds: data.data && data.data.resendAfterSeconds
        };
      }
    } catch (error) {
      console.error('Resend registration code error:', error);
      return {
        success: false,
        error: 'Network error. Please check your connection.'
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setToken(null);
    setIsAuthenticated(false);
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const value = {
    user,
    isAuthenticated,
    loading,
    login,
    register,
    verifyRegistration,
    resendRegistrationOtp,
    logout,
    updateUser,
    token
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 