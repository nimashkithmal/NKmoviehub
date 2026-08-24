import React, { useState } from 'react';
import ContactForm from './ContactForm';
import './ContactSection.css';

const ContactSection = () => {
  const [open, setOpen] = useState(false);

  return (
    <section id="contact" className="contact-strip">
      <div className="contact-strip-inner">
        <div className="contact-strip-copy">
          <span className="contact-strip-eyebrow">Still watching?</span>
          <h2 className="contact-strip-title">Drop us a line</h2>
          <p className="contact-strip-text">
            Bugs, requests, or just saying hi — we reply within a day.
          </p>
          <a href="mailto:qwe730375@gmail.com" className="contact-strip-mail">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M4 6h16v12H4z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <path
                d="M4 7l8 6 8-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              />
            </svg>
            qwe730375@gmail.com
          </a>
        </div>

        <div className="contact-strip-action">
          {!open ? (
            <button
              type="button"
              className="contact-strip-cta"
              onClick={() => setOpen(true)}
            >
              Write a message
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M5 12h14M13 6l6 6-6 6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              className="contact-strip-close"
              onClick={() => setOpen(false)}
              aria-label="Close contact form"
            >
              Close
            </button>
          )}
        </div>
      </div>

      <div className={`contact-strip-panel${open ? ' is-open' : ''}`}>
        <div className="contact-strip-form">
          <ContactForm compact onDone={() => setOpen(false)} />
        </div>
      </div>
    </section>
  );
};

export default ContactSection;
