export const LEGAL_PAGES = {
  about: {
    title: 'About Us',
    subtitle: 'Your home for movies and TV series discovery.',
    sections: [
      {
        heading: 'Who we are',
        body: `NK Movie Hub is an entertainment platform that helps visitors discover movies and TV series, browse curated collections, and find where to watch their favourite titles. We focus on a clean browsing experience, useful descriptions, and organised franchise collections.`
      },
      {
        heading: 'What we offer',
        list: [
          'A searchable catalogue of movies and TV shows',
          'Curated collections such as Marvel, DC, Harry Potter, and more',
          'Title details including cast, overview, ratings, and release information',
          'A simple way to request missing titles through our contact form'
        ]
      },
      {
        heading: 'Our mission',
        body: `We want NK Movie Hub to be a reliable, easy-to-use destination for entertainment fans. We continue to improve the site with better discovery, collections, and user experience.`
      },
      {
        heading: 'Contact',
        body: `Questions or feedback? Email us at qwe730375@gmail.com or use the request form on our home page.`
      }
    ]
  },
  privacy: {
    title: 'Privacy Policy',
    subtitle: 'Last updated: August 2026',
    sections: [
      {
        heading: 'Introduction',
        body: `NK Movie Hub ("we", "us", "our") respects your privacy. This policy explains what information we collect, how we use it, and your choices when you use our website.`
      },
      {
        heading: 'Information we collect',
        list: [
          'Usage data — pages visited, titles viewed, and general interaction with the site (via Google Analytics 4 when enabled)',
          'Contact form submissions — message content and optional name or email you provide',
          'Technical data — browser type, device type, and approximate locale or timezone',
          'Account data — if you register or sign in as an admin, we store account details needed for authentication'
        ]
      },
      {
        heading: 'How we use information',
        list: [
          'To operate and improve the website',
          'To respond to title requests and contact messages',
          'To understand traffic and usage patterns',
          'To maintain security and prevent abuse'
        ]
      },
      {
        heading: 'Cookies & analytics',
        body: `We may use cookies and similar technologies through Google Analytics 4 to measure site traffic. You can control cookies through your browser settings. Third-party embed players may set their own cookies when you play content.`
      },
      {
        heading: 'Sharing of data',
        body: `We do not sell your personal information. We may share data with service providers (such as hosting or analytics) only as needed to run the site, or when required by law.`
      },
      {
        heading: 'Your rights',
        body: `You may contact us to request access, correction, or deletion of personal data you have submitted through our contact form, subject to applicable law.`
      },
      {
        heading: 'Contact',
        body: `Privacy questions: qwe730375@gmail.com`
      }
    ]
  },
  terms: {
    title: 'Terms & Conditions',
    subtitle: 'Last updated: August 2026',
    sections: [
      {
        heading: 'Acceptance',
        body: `By accessing NK Movie Hub, you agree to these Terms & Conditions. If you do not agree, please do not use the site.`
      },
      {
        heading: 'Content standards',
        body: `NK Movie Hub is intended for general audiences. We do not publish sexually explicit, pornographic, or adult-only entertainment. Titles that violate our content standards may be removed or hidden without notice.`
      },
      {
        heading: 'Use of the service',
        list: [
          'The site is provided for personal, non-commercial entertainment browsing',
          'You must not attempt to disrupt, hack, or overload the service',
          'You must not use automated tools to scrape or abuse the platform',
          'Admin accounts are for authorised personnel only'
        ]
      },
      {
        heading: 'Content',
        body: `Movie and TV information, images, and descriptions may originate from third-party sources and remain the property of their respective owners. NK Movie Hub does not claim ownership of third-party media. Embedded players and external links are provided by third parties and are subject to their own terms.`
      },
      {
        heading: 'Disclaimer',
        body: `The site is provided "as is" without warranties of any kind. We do not guarantee uninterrupted access, accuracy of all metadata, or availability of any particular title.`
      },
      {
        heading: 'Limitation of liability',
        body: `To the fullest extent permitted by law, NK Movie Hub and its operators shall not be liable for any indirect, incidental, or consequential damages arising from use of the site.`
      },
      {
        heading: 'Changes',
        body: `We may update these terms at any time. Continued use of the site after changes constitutes acceptance of the updated terms.`
      },
      {
        heading: 'Contact',
        body: `Questions about these terms: qwe730375@gmail.com`
      }
    ]
  },
  dmca: {
    title: 'DMCA / Copyright Policy',
    subtitle: 'We respect intellectual property rights.',
    sections: [
      {
        heading: 'Policy',
        body: `NK Movie Hub respects the intellectual property rights of others and expects users to do the same. If you believe that content accessible on or through our site infringes your copyright, you may submit a notice as described below.`
      },
      {
        heading: 'Filing a copyright complaint',
        body: `Please send a written notice to our designated contact with the following information:`,
        list: [
          'Your full name and contact details (email and/or postal address)',
          'Identification of the copyrighted work you claim has been infringed',
          'The exact URL(s) on NK Movie Hub where the material appears',
          'A statement that you have a good-faith belief that use of the material is not authorised by the copyright owner, its agent, or the law',
          'A statement, under penalty of perjury, that the information in your notice is accurate and that you are the copyright owner or authorised to act on the owner\'s behalf',
          'Your physical or electronic signature'
        ]
      },
      {
        heading: 'Counter-notification',
        body: `If you believe content was removed in error, you may submit a counter-notification including your contact details, identification of the removed material, a statement under penalty of perjury that removal was a mistake, and your consent to jurisdiction of the appropriate courts.`
      },
      {
        heading: 'Response',
        body: `We review valid copyright notices promptly and may remove or disable access to allegedly infringing material. Repeat infringers may have access restricted where appropriate.`
      },
      {
        heading: 'Designated contact',
        body: `Email: qwe730375@gmail.com\nSubject line: DMCA Notice — NK Movie Hub`
      },
      {
        heading: 'Note',
        body: `This page is provided for informational purposes and does not constitute legal advice. Consult a qualified attorney for specific legal guidance.`
      }
    ]
  }
};

export const getLegalPage = (slug) => LEGAL_PAGES[slug] || null;
