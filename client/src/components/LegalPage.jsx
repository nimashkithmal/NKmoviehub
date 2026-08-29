import React, { useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { getLegalPage } from '../content/legalPages';
import ContactForm from './ContactForm';
import './LegalPage.css';

const LegalPage = ({ slug }) => {
  const page = getLegalPage(slug);

  useEffect(() => {
    if (page) {
      document.title = `${page.title} | NK Movie Hub`;
    }
  }, [page]);

  if (!page) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="legal-page">
      <div className="legal-shell">
        <nav className="legal-breadcrumb" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span aria-hidden="true">/</span>
          <span>{page.title}</span>
        </nav>

        <header className="legal-header">
          <h1>{page.title}</h1>
          {page.subtitle ? <p className="legal-subtitle">{page.subtitle}</p> : null}
        </header>

        <div className="legal-content">
          {page.sections.map((section) => (
            <section key={section.heading} className="legal-section">
              <h2>{section.heading}</h2>
              {section.body ? <p>{section.body}</p> : null}
              {section.list ? (
                <ul>
                  {section.list.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
};

export const ContactPage = () => {
  useEffect(() => {
    document.title = 'Contact Us | NK Movie Hub';
  }, []);

  return (
    <div className="legal-page">
    <div className="legal-shell">
      <nav className="legal-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span aria-hidden="true">/</span>
        <span>Contact Us</span>
      </nav>

      <header className="legal-header">
        <h1>Contact Us</h1>
        <p className="legal-subtitle">
          Request a movie or TV series, ask a question, or report an issue.
        </p>
      </header>

      <div className="legal-contact-grid">
        <div className="legal-contact-info">
          <h2>Get in touch</h2>
          <p>
            Use the form to request a title or send us a message.
          </p>
          <p>
            <strong>Email:</strong>{' '}
            <a href="mailto:qwe730375@gmail.com">qwe730375@gmail.com</a>
          </p>
          <p>
            <strong>DMCA / copyright:</strong>{' '}
            <Link to="/dmca">Copyright policy</Link>
          </p>
        </div>
        <ContactForm compact />
      </div>
    </div>
  </div>
  );
};

export default LegalPage;
