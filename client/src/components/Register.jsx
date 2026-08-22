import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Register = () => {
  // details -> otp: the account is only created once the code is verified
  const [step, setStep] = useState('details');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [otp, setOtp] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const { register, verifyRegistration, resendRegistrationOtp } = useAuth();
  const navigate = useNavigate();

  // Count the resend cooldown down to zero
  useEffect(() => {
    if (cooldown <= 0) return undefined;

    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const validateForm = () => {
    if (!formData.name || !formData.email || !formData.password || !formData.confirmPassword) {
      setError('Please fill in all fields');
      return false;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const result = await register(formData.name, formData.email, formData.password);

      if (result.success) {
        setStep('otp');
        setSuccess(result.message);
        setCooldown(result.resendAfterSeconds || 60);
      } else {
        setError(result.error || 'Registration failed. Please try again.');
      }
    } catch (error) {
      console.error('Registration error:', error);
      setError('An unexpected error occurred. Please try again.');
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
      const result = await verifyRegistration(formData.email, otp);

      if (result.success) {
        setSuccess('Email verified! Account created successfully. Redirecting...');
        // Add a longer delay to show success state before redirecting
        setTimeout(() => {
          navigate('/');
        }, 2000);
      } else {
        setError(result.error || 'Verification failed. Please try again.');
      }
    } catch (error) {
      console.error('Verify registration error:', error);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const result = await resendRegistrationOtp(formData.email);

      if (result.success) {
        setSuccess(result.message);
        setCooldown(result.resendAfterSeconds || 60);
      } else {
        if (result.resendAfterSeconds) {
          setCooldown(result.resendAfterSeconds);
        }
        setError(result.error || 'Could not send a new code.');
      }
    } catch (error) {
      console.error('Resend registration code error:', error);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const startOver = () => {
    setStep('details');
    setOtp('');
    setError('');
    setSuccess('');
    setCooldown(0);
  };

  return (
    <div className="auth-container">
      <div className="card">
        <h2>{step === 'details' ? 'Create Your Account' : 'Verify Your Email'}</h2>

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

        {step === 'details' && (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter your full name"
                required
              />
            </div>

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
              <small>We'll send a verification code to this address</small>
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password (min 6 characters)"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm your password"
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
              We sent a 6-digit code to <strong>{formData.email}</strong>. It expires in 10 minutes.
              Your account is created once the code is verified.
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
                {loading ? 'Verifying...' : 'Verify & Create Account'}
              </button>
            </div>

            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <button
                type="button"
                className="btn"
                onClick={handleResend}
                disabled={loading || cooldown > 0}
                style={{ background: 'none', color: cooldown > 0 ? '#999' : '#e74c3c', padding: 0 }}
              >
                {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
              </button>
            </div>

            <div style={{ textAlign: 'center', marginTop: '10px' }}>
              <button
                type="button"
                className="btn"
                onClick={startOver}
                disabled={loading}
                style={{ background: 'none', color: '#666', padding: 0 }}
              >
                Use a different email
              </button>
            </div>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <p>Already have an account? <Link to="/login">Login here</Link></p>
        </div>
      </div>
    </div>
  );
};

export default Register;
