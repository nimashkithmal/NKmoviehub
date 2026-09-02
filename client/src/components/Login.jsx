import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_URL = '/api/auth';

const Login = () => {
  const [step, setStep] = useState('login');
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [passwords, setPasswords] = useState({ newPassword: '', confirmPassword: '' });
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, logout, completeSession } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handlePasswordFieldChange = (e) => {
    setPasswords((prev) => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (!formData.email || !formData.password) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    try {
      const result = await login(formData.email, formData.password);

      if (result.requiresPasswordSetup) {
        setStep('otp');
        setSuccess(result.message || 'A verification code was sent to your email.');
        setCooldown(result.resendAfterSeconds || 60);
        return;
      }

      if (result.success) {
        if (result.user?.role !== 'admin') {
          logout();
          setError('This login is for administrators only.');
          return;
        }

        setSuccess('Login successful! Redirecting...');
        setTimeout(() => navigate('/admin'), 1500);
      } else {
        setError(result.error || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email })
      });
      const data = await response.json();
      if (data.success) {
        setSuccess('A new verification code has been sent.');
        setCooldown((data.data && data.data.resendAfterSeconds) || 60);
      } else {
        setError(data.message || 'Could not send a new code.');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (otp.length !== 6) {
      setError('Please enter the 6-digit code from your email');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, otp })
      });
      const data = await response.json();

      if (data.success) {
        setResetToken(data.data.resetToken);
        setStep('password');
        setSuccess('Code verified. Set your new password.');
      } else {
        setError(data.message || 'Verification failed.');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const { newPassword, confirmPassword } = passwords;
    if (!newPassword || !confirmPassword) {
      setError('Please fill in both password fields');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken, newPassword, confirmPassword })
      });
      const data = await response.json();

      if (data.success && data.data?.token) {
        completeSession(data.data.user, data.data.token);
        setSuccess('Password set! Redirecting to admin dashboard...');
        setTimeout(() => navigate('/admin'), 1500);
      } else if (data.success) {
        setStep('login');
        setFormData((prev) => ({ ...prev, password: '' }));
        setOtp('');
        setResetToken('');
        setPasswords({ newPassword: '', confirmPassword: '' });
        setSuccess(data.message || 'Password updated. You can now log in.');
      } else {
        setError(data.message || 'Could not update password.');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="card">
        <h2>
          {step === 'login' && 'Admin Login'}
          {step === 'otp' && 'Verify Email'}
          {step === 'password' && 'Set New Password'}
        </h2>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {step === 'login' && (
          <form onSubmit={handleLoginSubmit}>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter your email"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password"
                required
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Logging in...' : 'Login'}
              </button>
            </div>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleOtpSubmit}>
            <p style={{ marginBottom: '20px', color: '#666' }}>
              Enter the 6-digit code sent to <strong>{formData.email}</strong>.
            </p>

            <div className="form-group">
              <label htmlFor="otp">Verification Code</label>
              <input
                type="text"
                id="otp"
                name="otp"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                inputMode="numeric"
                style={{ letterSpacing: '8px', textAlign: 'center', fontSize: '20px' }}
                required
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Verifying...' : 'Verify Code'}
              </button>
            </div>

            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <button
                type="button"
                className="btn"
                onClick={handleResendOtp}
                disabled={loading || cooldown > 0}
                style={{ background: 'none', color: cooldown > 0 ? '#999' : '#e74c3c', padding: 0 }}
              >
                {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
              </button>
            </div>
          </form>
        )}

        {step === 'password' && (
          <form onSubmit={handlePasswordSubmit}>
            <p style={{ marginBottom: '20px', color: '#666' }}>
              Choose a permanent password for <strong>{formData.email}</strong>.
            </p>

            <div className="form-group">
              <label htmlFor="newPassword">New Password</label>
              <input
                type="password"
                id="newPassword"
                name="newPassword"
                value={passwords.newPassword}
                onChange={handlePasswordFieldChange}
                placeholder="At least 6 characters"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={passwords.confirmPassword}
                onChange={handlePasswordFieldChange}
                placeholder="Re-enter your password"
                required
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving...' : 'Save Password & Continue'}
              </button>
            </div>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          {step === 'login' && <p><Link to="/forgot-password">Forgot Password?</Link></p>}
          <p><Link to="/">Back to NKMovieHUB</Link></p>
        </div>
      </div>
    </div>
  );
};

export default Login;
