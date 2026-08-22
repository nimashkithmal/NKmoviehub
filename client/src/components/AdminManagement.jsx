import React, { useState, useEffect } from 'react';

const API_URL = 'http://localhost:5001/api/users/admins';

/**
 * Administration section of the admin dashboard.
 *
 * Creating an admin is a two-step flow: the details are submitted, a code is
 * emailed to the new admin's address, and the account is only created once
 * that code is entered here.
 */
const AdminManagement = ({ token, admins = [], onAdminCreated }) => {
  // details -> otp
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

  const request = async (path, body) => {
    const response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(body)
    });
    return { ok: response.ok, data: await response.json() };
  };

  const validateForm = () => {
    const { name, email, password, confirmPassword } = formData;

    if (!name || !email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return false;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return false;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
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
      const { data } = await request('', {
        name: formData.name,
        email: formData.email,
        password: formData.password
      });

      if (data.success) {
        setStep('otp');
        setSuccess(data.message);
        setCooldown(data.data.resendAfterSeconds || 60);
      } else {
        setError(data.message || 'Could not start admin creation.');
      }
    } catch (err) {
      console.error('Start admin creation error:', err);
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (otp.length !== 6) {
      setError('Please enter the 6-digit code from the email');
      return;
    }

    setLoading(true);

    try {
      const { data } = await request('/verify', { email: formData.email, otp });

      if (data.success) {
        setSuccess(`Admin account created for ${data.data.user.email}.`);
        setStep('details');
        setFormData({ name: '', email: '', password: '', confirmPassword: '' });
        setOtp('');
        setCooldown(0);
        if (onAdminCreated) onAdminCreated();
      } else {
        setError(data.message || 'Verification failed.');
      }
    } catch (err) {
      console.error('Verify admin creation error:', err);
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const { data } = await request('/resend', { email: formData.email });

      if (data.success) {
        setSuccess(data.message);
        setCooldown(data.data.resendAfterSeconds || 60);
      } else {
        if (data.data && data.data.resendAfterSeconds) {
          setCooldown(data.data.resendAfterSeconds);
        }
        setError(data.message || 'Could not send a new code.');
      }
    } catch (err) {
      console.error('Resend admin code error:', err);
      setError('Network error. Please check your connection.');
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
    <div className="card">
      <div className="dashboard-header">
        <h2>Admin Management</h2>
      </div>

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

      <h3 style={{ marginTop: '10px' }}>Current Administrators</h3>
      {admins.length === 0 ? (
        <div className="empty-state">
          <h3>No administrators found</h3>
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {admins.map((admin) => (
              <tr key={admin._id || admin.id}>
                <td>{admin.name}</td>
                <td>{admin.email}</td>
                <td>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    backgroundColor: admin.status === 'active' ? '#28a745' : '#6c757d',
                    color: 'white',
                    fontSize: '12px'
                  }}>
                    {admin.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 style={{ marginTop: '30px' }}>
        {step === 'details' ? 'Add New Admin' : 'Verify Email Address'}
      </h3>

      {step === 'details' && (
        <form onSubmit={handleSubmit}>
          <p style={{ marginBottom: '20px', color: '#666' }}>
            A verification code is emailed to the new admin. The account is created
            only after that code is entered here.
          </p>

          <div className="form-group">
            <label htmlFor="admin-name">Full Name</label>
            <input
              type="text"
              id="admin-name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter the new admin's full name"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="admin-email">Email</label>
            <input
              type="email"
              id="admin-email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter the new admin's email"
              required
            />
            <small>The verification code is sent to this address</small>
          </div>

          <div className="form-group">
            <label htmlFor="admin-password">Password</label>
            <input
              type="password"
              id="admin-password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Set a password (min 6 characters)"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="admin-confirm-password">Confirm Password</label>
            <input
              type="password"
              id="admin-confirm-password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Re-enter the password"
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
            A 6-digit code was sent to <strong>{formData.email}</strong>. It expires
            in 10 minutes. The admin account is created once the code is verified.
          </p>

          <div className="form-group">
            <label htmlFor="admin-otp">Verification Code</label>
            <input
              type="text"
              id="admin-otp"
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
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Verifying...' : 'Verify & Create Admin'}
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
              Cancel and start over
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default AdminManagement;
