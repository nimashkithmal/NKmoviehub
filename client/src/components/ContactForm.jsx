import React, { useState } from 'react';

const ContactForm = ({ compact = false, onDone }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear validation error for this field
    if (validationErrors[name]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    } else if (formData.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters long';
    } else if (formData.name.trim().length > 100) {
      errors.name = 'Name cannot exceed 100 characters';
    }
    
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please provide a valid email address';
    }
    
    if (!formData.subject.trim()) {
      errors.subject = 'Subject is required';
    } else if (formData.subject.trim().length < 5) {
      errors.subject = 'Subject must be at least 5 characters long';
    } else if (formData.subject.trim().length > 200) {
      errors.subject = 'Subject cannot exceed 200 characters';
    }
    
    if (!formData.message.trim()) {
      errors.message = 'Message is required';
    } else if (formData.message.trim().length < 10) {
      errors.message = 'Message must be at least 10 characters long';
    } else if (formData.message.trim().length > 2000) {
      errors.message = 'Message cannot exceed 2000 characters';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(true);
        setFormData({
          name: '',
          email: '',
          subject: '',
          message: ''
        });
        setValidationErrors({});
        if (typeof onDone === 'function') {
          setTimeout(() => onDone(), 1800);
        }
      } else {
        setError(result.message || 'Failed to send message. Please try again.');
      }
    } catch (err) {
      console.error('Error sending contact form:', err);
      setError('Failed to send message. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const getFieldError = (fieldName) => {
    return validationErrors[fieldName];
  };

  const isFieldValid = (fieldName) => {
    return !validationErrors[fieldName];
  };

  if (success) {
    return (
      <div className="contact-success">
        <div className="success-icon">✓</div>
        <h3>Request received</h3>
        <p>Thanks — we&apos;ll review your request and get back to you soon.</p>
        <button 
          className="btn btn-primary"
          onClick={() => setSuccess(false)}
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <div className={`contact-form-container${compact ? ' is-compact' : ''}`}>
      <form onSubmit={handleSubmit} className="contact-form">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="name">Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className={`form-input ${getFieldError('name') ? 'form-error' : isFieldValid('name') && formData.name ? 'form-valid' : ''}`}
              placeholder="Your name"
              maxLength={100}
            />
            {getFieldError('name') && (
              <small className="error-message">{getFieldError('name')}</small>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="email">Email *</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className={`form-input ${getFieldError('email') ? 'form-error' : isFieldValid('email') && formData.email ? 'form-valid' : ''}`}
              placeholder="you@email.com"
              maxLength={100}
            />
            {getFieldError('email') && (
              <small className="error-message">{getFieldError('email')}</small>
            )}
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="subject">Subject *</label>
          <input
            type="text"
            id="subject"
            name="subject"
            value={formData.subject}
            onChange={handleInputChange}
            className={`form-input ${getFieldError('subject') ? 'form-error' : isFieldValid('subject') && formData.subject ? 'form-valid' : ''}`}
            placeholder="e.g. Movie request: Avengers: Doomsday"
            maxLength={200}
          />
          {getFieldError('subject') && (
            <small className="error-message">{getFieldError('subject')}</small>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="message">Message *</label>
          <textarea
            id="message"
            name="message"
            value={formData.message}
            onChange={handleInputChange}
            className={`form-textarea ${getFieldError('message') ? 'form-error' : isFieldValid('message') && formData.message ? 'form-valid' : ''}`}
            placeholder="Movie or TV show name, year if you know it, and anything else that helps us find it..."
            rows={compact ? 3 : 6}
            maxLength={2000}
          />
          {!compact && (
            <div className="character-count">
              {formData.message.length}/2000 characters
            </div>
          )}
          {getFieldError('message') && (
            <small className="error-message">{getFieldError('message')}</small>
          )}
        </div>

        {error && (
          <div className="error-alert">
            <span className="error-icon">!</span>
            {error}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary btn-large"
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="loading-spinner"></span>
              Sending...
            </>
          ) : (
            'Send request'
          )}
        </button>
      </form>
    </div>
  );
};

export default ContactForm;
