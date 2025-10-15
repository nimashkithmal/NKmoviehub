const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    // Check if we have valid email credentials
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || 
        process.env.EMAIL_PASS === 'your-16-character-app-password-here' ||
        process.env.EMAIL_PASS.trim() === '') {
      console.log('⚠️  Email service disabled - Please configure EMAIL_USER and EMAIL_PASS in config.env');
      console.log('Current EMAIL_USER:', process.env.EMAIL_USER);
      console.log('Current EMAIL_PASS:', process.env.EMAIL_PASS ? 'Set' : 'Not set');
      this.transporter = null;
      return;
    }

    // Gmail SMTP configuration
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER, // Your Gmail address
        pass: process.env.EMAIL_PASS  // Your Gmail App Password
      }
    });

    // Verify connection configuration
    this.transporter.verify((error, success) => {
      if (error) {
        console.error('❌ Email service configuration error:', error);
        console.log('💡 To fix this:');
        console.log('   1. Enable 2-Step Verification in your Google Account');
        console.log('   2. Generate an App Password');
        console.log('   3. Update EMAIL_PASS in config.env with the App Password');
      } else {
        console.log('✅ Email service is ready to send messages');
      }
    });
  }

  async sendContactReply(contactData, replyMessage, adminName = 'NK Movie Hub Admin') {
    if (!this.transporter) {
      console.log('⚠️  Email service disabled - Reply not sent via email');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const mailOptions = {
        from: {
          name: 'NK Movie Hub',
          address: process.env.EMAIL_USER
        },
        to: contactData.email,
        subject: `Re: ${contactData.subject}`,
        html: this.generateReplyEmailTemplate(contactData, replyMessage, adminName)
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('📧 Email sent successfully:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Error sending email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendContactConfirmation(contactData) {
    if (!this.transporter) {
      console.log('⚠️  Email service disabled - Confirmation not sent via email');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const mailOptions = {
        from: {
          name: 'NK Movie Hub',
          address: process.env.EMAIL_USER
        },
        to: contactData.email,
        subject: 'Thank you for contacting NK Movie Hub',
        html: this.generateConfirmationEmailTemplate(contactData)
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('📧 Confirmation email sent successfully:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Error sending confirmation email:', error);
      return { success: false, error: error.message };
    }
  }

  generateReplyEmailTemplate(contactData, replyMessage, adminName) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reply from NK Movie Hub</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
          .header { text-align: center; border-bottom: 3px solid #e74c3c; padding-bottom: 20px; margin-bottom: 30px; }
          .logo { font-size: 28px; font-weight: bold; color: #e74c3c; margin-bottom: 10px; }
          .tagline { color: #666; font-size: 14px; }
          .content { margin-bottom: 30px; }
          .original-message { background: #f8f9fa; padding: 20px; border-left: 4px solid #e74c3c; margin: 20px 0; border-radius: 0 5px 5px 0; }
          .reply-message { background: #e8f5e8; padding: 20px; border-left: 4px solid #28a745; margin: 20px 0; border-radius: 0 5px 5px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px; }
          .btn { display: inline-block; padding: 12px 25px; background: #e74c3c; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
          .btn:hover { background: #c0392b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🎬 NK Movie Hub</div>
            <div class="tagline">Your Ultimate Movie Experience</div>
          </div>
          
          <div class="content">
            <h2>Hello ${contactData.name}!</h2>
            
            <p>Thank you for reaching out to us. We've received your message and here's our response:</p>
            
            <div class="original-message">
              <h4>Your Original Message:</h4>
              <p><strong>Subject:</strong> ${contactData.subject}</p>
              <p><strong>Message:</strong></p>
              <p>${contactData.message.replace(/\n/g, '<br>')}</p>
            </div>
            
            <div class="reply-message">
              <h4>Our Reply:</h4>
              <p>${replyMessage.replace(/\n/g, '<br>')}</p>
              <p><em>Best regards,<br>${adminName}<br>NK Movie Hub Team</em></p>
            </div>
            
            <p>If you have any further questions, please don't hesitate to contact us again.</p>
            
            <div style="text-align: center;">
              <a href="http://localhost:3000" class="btn">Visit Our Website</a>
            </div>
          </div>
          
          <div class="footer">
            <p>This email was sent from NK Movie Hub Contact System</p>
            <p>© 2024 NK Movie Hub. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  generateConfirmationEmailTemplate(contactData) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Message Received - NK Movie Hub</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
          .header { text-align: center; border-bottom: 3px solid #e74c3c; padding-bottom: 20px; margin-bottom: 30px; }
          .logo { font-size: 28px; font-weight: bold; color: #e74c3c; margin-bottom: 10px; }
          .tagline { color: #666; font-size: 14px; }
          .content { margin-bottom: 30px; }
          .message-details { background: #f8f9fa; padding: 20px; border-left: 4px solid #e74c3c; margin: 20px 0; border-radius: 0 5px 5px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px; }
          .btn { display: inline-block; padding: 12px 25px; background: #e74c3c; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
          .btn:hover { background: #c0392b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🎬 NK Movie Hub</div>
            <div class="tagline">Your Ultimate Movie Experience</div>
          </div>
          
          <div class="content">
            <h2>Thank you for contacting us, ${contactData.name}!</h2>
            
            <p>We've successfully received your message and our team will get back to you as soon as possible.</p>
            
            <div class="message-details">
              <h4>Message Details:</h4>
              <p><strong>Subject:</strong> ${contactData.subject}</p>
              <p><strong>Message:</strong></p>
              <p>${contactData.message.replace(/\n/g, '<br>')}</p>
              <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
            </div>
            
            <p>We typically respond within 24 hours. If you have any urgent inquiries, please don't hesitate to contact us again.</p>
            
            <div style="text-align: center;">
              <a href="http://localhost:3000" class="btn">Browse Our Movies</a>
            </div>
          </div>
          
          <div class="footer">
            <p>This is an automated confirmation email from NK Movie Hub</p>
            <p>© 2024 NK Movie Hub. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

module.exports = new EmailService();
