import React, { useState } from 'react';
import ContactForm from './ContactForm';
import './ContactSection.css';

const ContactSection = () => {
  const [open, setOpen] = useState(false);

  return (
    <section id="contact" className="contact-strip">
      <div className="contact-strip-inner">
        <div className="contact-strip-copy">
          <span className="contact-strip-eyebrow">Can&apos;t find something?</span>
          <h2 className="contact-strip-title">Request a title</h2>
          <p className="contact-strip-text">
            Missing a movie or TV series? Send us the name — we&apos;ll try to add it.
            Bugs and feedback welcome too.
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
              Request a title
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
