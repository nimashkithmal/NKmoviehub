import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import './ContactManagement.css';

const ContactManagement = () => {
  const { token, user } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [selectedContact, setSelectedContact] = useState(null);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);
  const [stats, setStats] = useState({
    totalContacts: 0,
    newContacts: 0,
    readContacts: 0,
    repliedContacts: 0,
    closedContacts: 0,
    urgentContacts: 0
  });

  // Fetch contacts from backend
  const fetchContacts = useCallback(async () => {
    if (!token) {
      console.error('No token available for fetching contacts');
      setError('Authentication required. Please login as admin.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      let url = 'http://localhost:5001/api/contacts?limit=1000';
      if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;
      if (statusFilter) url += `&status=${statusFilter}`;
      if (priorityFilter) url += `&priority=${priorityFilter}`;
      
      console.log('Fetching contacts with URL:', url);
      console.log('Using token:', token ? 'Present' : 'Missing');
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Response status:', response.status);
      const result = await response.json();
      console.log('Response data:', result);

      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`);
      }
      
      if (result.success) {
        setContacts(result.data.contacts);
        console.log('Contacts loaded:', result.data.contacts.length);
      } else {
        throw new Error(result.message || 'Failed to fetch contacts');
      }
    } catch (err) {
      console.error('Error fetching contacts:', err);
      setError(err.message || 'Failed to load contacts. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [token, searchTerm, statusFilter, priorityFilter]);

  // Fetch contact statistics
  const fetchStats = useCallback(async () => {
    if (!token) {
      console.error('No token available for fetching stats');
      return;
    }

    try {
      console.log('Fetching contact stats...');
      const response = await fetch('http://localhost:5001/api/contacts/stats', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Stats response status:', response.status);
      const result = await response.json();
      console.log('Stats response data:', result);

      if (response.ok && result.success) {
        setStats(result.data);
        console.log('Stats loaded:', result.data);
      } else {
        console.error('Failed to fetch stats:', result.message);
      }
    } catch (err) {
      console.error('Error fetching contact stats:', err);
    }
  }, [token]);

  // Fetch contacts and stats on component mount
  useEffect(() => {
    fetchContacts();
    fetchStats();
  }, [fetchContacts, fetchStats]);

  // Update contact status
  const updateContactStatus = async (contactId, newStatus) => {
    try {
      const response = await fetch(`http://localhost:5001/api/contacts/${contactId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setContacts(prev => prev.map(contact => 
            contact._id === contactId ? { ...contact, status: newStatus } : contact
          ));
          showNotification(`Contact marked as ${newStatus}`, 'success');
        }
      }
    } catch (err) {
      console.error('Error updating contact status:', err);
      showNotification('Failed to update contact status', 'error');
    }
  };

  // Add admin reply
  const addAdminReply = async () => {
    if (!replyMessage.trim() || !selectedContact) return;

    // Validate message length
    if (replyMessage.trim().length < 5) {
      showNotification('Reply message must be at least 5 characters long', 'error');
      return;
    }

    if (replyMessage.trim().length > 2000) {
      showNotification('Reply message cannot exceed 2000 characters', 'error');
      return;
    }

    setReplyLoading(true);
    try {
      const response = await fetch(`http://localhost:5001/api/contacts/${selectedContact._id}/reply`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: replyMessage })
      });

      const result = await response.json();

      if (response.ok) {
        if (result.success) {
          setContacts(prev => prev.map(contact => 
            contact._id === selectedContact._id ? result.data.contact : contact
          ));
          setShowReplyModal(false);
          setReplyMessage('');
          setSelectedContact(null);
          showNotification('Reply sent successfully', 'success');
        } else {
          showNotification(result.message || 'Failed to send reply', 'error');
        }
      } else {
        showNotification(result.message || 'Failed to send reply', 'error');
      }
    } catch (err) {
      console.error('Error adding reply:', err);
      showNotification('Failed to send reply', 'error');
    } finally {
      setReplyLoading(false);
    }
  };

  // Delete contact
  const deleteContact = async (contactId) => {
    if (!window.confirm('Are you sure you want to delete this contact message?')) return;

    try {
      const response = await fetch(`http://localhost:5001/api/contacts/${contactId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setContacts(prev => prev.filter(contact => contact._id !== contactId));
        showNotification('Contact deleted successfully', 'success');
      }
    } catch (err) {
      console.error('Error deleting contact:', err);
      showNotification('Failed to delete contact', 'error');
    }
  };

  // Notification system
  const showNotification = (message, type = 'info') => {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-message">${message}</span>
        <button class="notification-close">×</button>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 5000);
    
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'new': return '#3b82f6';
      case 'read': return '#f59e0b';
      case 'replied': return '#10b981';
      case 'closed': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return '#ef4444';
      case 'high': return '#f59e0b';
      case 'medium': return '#3b82f6';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Check if user is admin
  if (!user || user.role !== 'admin') {
    return (
      <div className="contact-management">
        <div className="error-state">
          <h3>Access Denied</h3>
          <p>You need admin privileges to access contact management.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="contact-management">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <h3>Loading contacts...</h3>
          <p>Please wait while we fetch the contact messages.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="contact-management">
      <div className="contact-header">
        <h2>Contact Management</h2>
        <p>Manage user inquiries and support requests</p>
      </div>

      {/* Statistics Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📧</div>
          <div className="stat-content">
            <h3>{stats.totalContacts}</h3>
            <p>Total Contacts</p>
          </div>
        </div>
        <div className="stat-card new">
          <div className="stat-icon">🆕</div>
          <div className="stat-content">
            <h3>{stats.newContacts}</h3>
            <p>New Messages</p>
          </div>
        </div>
        <div className="stat-card replied">
          <div className="stat-icon">💬</div>
          <div className="stat-content">
            <h3>{stats.repliedContacts}</h3>
            <p>Replied</p>
          </div>
        </div>
        <div className="stat-card urgent">
          <div className="stat-icon">⚠️</div>
          <div className="stat-content">
            <h3>{stats.urgentContacts}</h3>
            <p>Urgent</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="filter-group">
          <input
            type="text"
            placeholder="Search contacts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="filter-group">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-select"
          >
            <option value="">All Status</option>
            <option value="new">New</option>
            <option value="read">Read</option>
            <option value="replied">Replied</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        <div className="filter-group">
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="filter-select"
          >
            <option value="">All Priority</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <button 
          className="btn btn-primary"
          onClick={fetchContacts}
        >
          🔄 Refresh
        </button>
      </div>

      {/* Contacts List */}
      {error ? (
        <div className="error-state">
          <h3>Error loading contacts</h3>
          <p>{error}</p>
          <button 
            className="btn btn-primary"
            onClick={fetchContacts}
          >
            Try Again
          </button>
        </div>
      ) : contacts.length === 0 ? (
        <div className="empty-state">
          <h3>No contacts found</h3>
          <p>No contact messages match your current filters.</p>
        </div>
      ) : (
        <div className="contacts-list">
          {contacts.map((contact) => (
            <div key={contact._id} className="contact-card">
              <div className="contact-header-info">
                <div className="contact-meta">
                  <h3>{contact.name}</h3>
                  <p className="contact-email">{contact.email}</p>
                  <p className="contact-subject">{contact.subject}</p>
                </div>
                <div className="contact-badges">
                  <span 
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(contact.status) }}
                  >
                    {contact.status}
                  </span>
                  <span 
                    className="priority-badge"
                    style={{ backgroundColor: getPriorityColor(contact.priority) }}
                  >
                    {contact.priority}
                  </span>
                </div>
              </div>
              
              <div className="contact-message">
                <p>{contact.message}</p>
              </div>
              
              <div className="contact-footer">
                <div className="contact-dates">
                  <small>Received: {formatDate(contact.createdAt)}</small>
                  {contact.adminReply && (
                    <small>Replied: {formatDate(contact.adminReply.repliedAt)}</small>
                  )}
                </div>
                <div className="contact-actions">
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => updateContactStatus(contact._id, 'read')}
                    disabled={contact.status === 'read'}
                  >
                    Mark as Read
                  </button>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => {
                      setSelectedContact(contact);
                      setShowReplyModal(true);
                    }}
                  >
                    Reply
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => deleteContact(contact._id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
              
              {contact.adminReply && (
                <div className="admin-reply">
                  <h4>Admin Reply:</h4>
                  <p>{contact.adminReply.message}</p>
                  <small>Replied by: {contact.adminReply.repliedBy?.name || 'Admin'}</small>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reply Modal */}
      {showReplyModal && selectedContact && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Reply to {selectedContact.name}</h3>
              <button 
                className="modal-close"
                onClick={() => {
                  setShowReplyModal(false);
                  setReplyMessage('');
                  setSelectedContact(null);
                }}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="original-message">
                <h4>Original Message:</h4>
                <p>{selectedContact.message}</p>
              </div>
              <div className="reply-form">
                <label htmlFor="replyMessage">Your Reply:</label>
                <textarea
                  id="replyMessage"
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="Type your reply here..."
                  rows={6}
                  className="reply-textarea"
                />
                <div className="character-count">
                  {replyMessage.length}/2000 characters
                  {replyMessage.length < 5 && replyMessage.length > 0 && (
                    <span className="character-warning"> (Minimum 5 characters required)</span>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowReplyModal(false);
                  setReplyMessage('');
                  setSelectedContact(null);
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={addAdminReply}
                disabled={!replyMessage.trim() || replyLoading}
              >
                {replyLoading ? 'Sending...' : 'Send Reply'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContactManagement;
