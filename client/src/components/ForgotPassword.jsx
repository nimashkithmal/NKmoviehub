import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const API_URL = 'http://localhost:5001/api/auth';

const ForgotPassword = () => {
  // email -> otp -> password -> done
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [passwords, setPasswords] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  // Count the resend cooldown down to zero
  useEffect(() => {
    if (cooldown <= 0) return undefined;

    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handlePasswordChange = (e) => {
    setPasswords({
      ...passwords,
      [e.target.name]: e.target.value
    });
  };

  const requestOtp = async (isResend = false) => {
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (data.success) {
        setStep('otp');
        setSuccess(isResend ? 'A new verification code has been sent.' : data.message);
        setCooldown((data.data && data.data.resendAfterSeconds) || 60);
      } else {
        setError(data.message || 'Could not send the verification code.');
      }
    } catch (err) {
      console.error('Forgot password error:', err);
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();

    if (!email) {
      setError('Please enter your registered email address');
      return;
    }

    await requestOtp(false);
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
        body: JSON.stringify({ email, otp })
      });

      const data = await response.json();

      if (data.success) {
        setResetToken(data.data.resetToken);
        setStep('password');
      } else {
        setError(data.message || 'Verification failed.');
      }
    } catch (err) {
      console.error('Verify OTP error:', err);
      setError('Network error. Please check your connection.');
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
      setError('Please fill in all fields');
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

      if (data.success) {
        setStep('done');
        setSuccess(data.message);
        // Give the admin a moment to read the message before the login page
        setTimeout(() => navigate('/login'), 3000);
      } else {
        setError(data.message || 'Could not update the password.');
      }
    } catch (err) {
      console.error('Reset password error:', err);
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="card">
        <h2>Reset Your Password</h2>

        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            {success}
          </div>
        )}

        {step === 'email' && (
          <form onSubmit={handleEmailSubmit}>
            <p style={{ marginBottom: '20px', color: '#666' }}>
              Enter your registered admin email and we'll send you a verification code.
            </p>

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your registered email"
                required
              />
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? 'Sending code...' : 'Send Verification Code'}
              </button>
            </div>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleOtpSubmit}>
            <p style={{ marginBottom: '20px', color: '#666' }}>
              We sent a 6-digit code to <strong>{email}</strong>. It expires in 10 minutes.
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
                autoComplete="one-time-code"
                style={{ letterSpacing: '8px', textAlign: 'center', fontSize: '20px' }}
                required
              />
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? 'Verifying...' : 'Verify Code'}
              </button>
            </div>

            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <button
                type="button"
                className="btn"
                onClick={() => requestOtp(true)}
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
              Choose a new password for <strong>{email}</strong>.
            </p>

            <div className="form-group">
              <label htmlFor="newPassword">New Password</label>
              <input
                type="password"
                id="newPassword"
                name="newPassword"
                value={passwords.newPassword}
                onChange={handlePasswordChange}
                placeholder="Enter your new password"
                required
              />
              <small>Must be at least 6 characters long</small>
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={passwords.confirmPassword}
                onChange={handlePasswordChange}
                placeholder="Re-enter your new password"
                required
              />
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? 'Updating password...' : 'Update Password'}
              </button>
            </div>
          </form>
        )}

        {step === 'done' && (
          <p style={{ textAlign: 'center', color: '#666' }}>
            Redirecting you to the login page...
          </p>
        )}

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <p>Remembered your password? <Link to="/login">Back to login</Link></p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
