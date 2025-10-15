import React from 'react';
import ContactForm from './ContactForm';
import './ContactSection.css';

const ContactSection = () => {
  return (
    <section id="contact" className="contact-section">
      <div className="contact-container">
        <div className="contact-header">
          <h2>Get In Touch</h2>
          <p>Have questions about our movies? Need help with your account? We're here to help!</p>
        </div>

        <div className="contact-content">
          <div className="contact-info">
            <div className="contact-card">
              <div className="contact-icon">📧</div>
              <h3>Email Us</h3>
              <p>Send us an email and we'll respond within 24 hours</p>
              <a href="mailto:support@nkmoviehub.com" className="contact-link">
                support@nkmoviehub.com
              </a>
            </div>

            <div className="contact-card">
              <div className="contact-icon">⏰</div>
              <h3>Response Time</h3>
              <p>We typically respond to all inquiries within 24 hours</p>
              <span className="contact-detail">Monday - Friday: 9 AM - 6 PM</span>
            </div>

            <div className="contact-card">
              <div className="contact-icon">💬</div>
              <h3>Live Support</h3>
              <p>Need immediate assistance? Use our contact form below</p>
              <span className="contact-detail">Available 24/7</span>
            </div>
          </div>

          <div className="contact-form-wrapper">
            <ContactForm />
          </div>
        </div>

        <div className="contact-footer">
          <div className="contact-stats">
            <div className="stat-item">
              <span className="stat-number">24h</span>
              <span className="stat-label">Response Time</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">99%</span>
              <span className="stat-label">Satisfaction Rate</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">1000+</span>
              <span className="stat-label">Happy Users</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ContactSection;
