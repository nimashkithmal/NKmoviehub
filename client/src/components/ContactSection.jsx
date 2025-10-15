import React from 'react';
import ContactForm from './ContactForm';
import './ContactSection.css';

const ContactSection = () => {
  return (
    <section id="contact" className="contact-section">
      <div className="contact-container">
        <div className="contact-header">
          <h2>Contact Us</h2>
          <p>Have questions? We're here to help!</p>
        </div>

        <div className="contact-content">
          <div className="contact-info">
            <div className="contact-card">
              <div className="contact-icon">📧</div>
              <h3>Email Us</h3>
              <p>Send us an email and we'll respond within 24 hours</p>
              <a href="mailto:qwe730375@gmail.com" className="contact-link">
                qwe730375@gmail.com
              </a>
            </div>

            <div className="contact-card">
              <div className="contact-icon">⏰</div>
              <h3>Response Time</h3>
              <p>We typically respond within 24 hours</p>
              <span className="contact-detail">Monday - Friday: 9 AM - 6 PM</span>
            </div>
          </div>

          <div className="contact-form-wrapper">
            <ContactForm />
          </div>
        </div>
      </div>
    </section>
  );
};

export default ContactSection;
