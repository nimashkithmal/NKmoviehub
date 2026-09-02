import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const API_URL = '/api/users/admins';

const AdminManagement = ({ token }) => {
  const { user: currentUser } = useAuth();
  const [formData, setFormData] = useState({ name: '', email: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [admins, setAdmins] = useState([]);
  const [canInviteAdmins, setCanInviteAdmins] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);

  const currentUserId = String(currentUser?.id || currentUser?._id || '');

  const fetchAdmins = useCallback(async () => {
    try {
      setListLoading(true);
      setListError('');
      const response = await fetch(API_URL, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setAdmins(data.data.admins || []);
        setCanInviteAdmins(Boolean(data.data.canInviteAdmins));
      } else {
        setAdmins([]);
        setListError(data.message || 'Could not load administrators');
      }
    } catch (err) {
      console.error('Error fetching admins:', err);
      setAdmins([]);
      setListError('Failed to load administrators. Is the server running?');
    } finally {
      setListLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchAdmins();
  }, [token, fetchAdmins]);

  const handleToggleStatus = async (admin) => {
    const adminId = admin._id || admin.id;
    const nextLabel = admin.status === 'active' ? 'deactivate' : 'activate';
    if (!window.confirm(`Are you sure you want to ${nextLabel} ${admin.name}?`)) {
      return;
    }

    try {
      setStatusUpdatingId(adminId);
      setError('');
      setSuccess('');
      const response = await fetch(`${API_URL}/${adminId}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setSuccess(data.message);
        await fetchAdmins();
      } else {
        setError(data.message || 'Could not update administrator status');
      }
    } catch (err) {
      console.error('Toggle admin status error:', err);
      setError('Network error. Please try again.');
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const { name, email } = formData;
    if (!name.trim() || !email.trim()) {
      setError('Please fill in full name and email');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: name.trim(), email: email.trim() })
      });
      const data = await response.json();

      if (data.success) {
        setSuccess(data.message);
        setFormData({ name: '', email: '' });
        fetchAdmins();
      } else {
        setError(data.message || 'Could not invite the administrator.');
      }
    } catch (err) {
      console.error('Invite admin error:', err);
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="dashboard-header">
        <h2>Admin Management</h2>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <h3 style={{ marginTop: '10px' }}>Current Administrators</h3>
      {listLoading ? (
        <p style={{ color: '#666' }}>Loading administrators...</p>
      ) : listError ? (
        <div className="alert alert-error">
          {listError}
          <button
            type="button"
            className="btn btn-secondary"
            style={{ marginLeft: '10px' }}
            onClick={fetchAdmins}
          >
            Retry
          </button>
        </div>
      ) : admins.length === 0 ? (
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
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {admins.map((admin) => {
              const adminId = String(admin._id || admin.id || '');
              const isSelf = adminId === currentUserId;
              const isUpdating = statusUpdatingId === adminId || statusUpdatingId === admin._id;

              return (
                <tr key={adminId}>
                  <td>
                    {admin.name}
                    {isSelf ? (
                      <span style={{ marginLeft: '8px', color: '#888', fontSize: '12px' }}>(you)</span>
                    ) : null}
                  </td>
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
                  <td>
                    {isSelf ? (
                      <span style={{ color: '#999', fontSize: '12px' }}>—</span>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '5px 10px', fontSize: '12px' }}
                        disabled={isUpdating}
                        onClick={() => handleToggleStatus(admin)}
                      >
                        {isUpdating
                          ? 'Updating...'
                          : admin.status === 'active'
                            ? 'Deactivate'
                            : 'Activate'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {canInviteAdmins && (
        <>
          <h3 style={{ marginTop: '30px' }}>Add New Admin</h3>
          <form onSubmit={handleSubmit}>
            <p style={{ marginBottom: '20px', color: '#666' }}>
              Enter the new admin&apos;s name and email. NK Movie Hub will email them a
              temporary password. They log in, verify with an OTP, then set their own password.
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
              <small>A temporary password will be emailed to this address</small>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Sending invite...' : 'Send Admin Invite'}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
};

export default AdminManagement;
