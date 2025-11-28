const nodemailer = require('nodemailer');

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

// Email template with company branding
const getEmailTemplate = (title, content, language = 'en') => {
  const isRTL = language === 'ar';
  const direction = isRTL ? 'rtl' : 'ltr';
  const textAlign = isRTL ? 'right' : 'left';
  const primaryColor = '#dc2328';
  const secondaryColor = '#b51c20';

  return `
<!DOCTYPE html>
<html lang="${language}" dir="${direction}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f3f4f6;
      padding: 20px;
      direction: ${direction};
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .email-header {
      background: linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%);
      padding: 30px 20px;
      text-align: center;
      color: #ffffff;
    }
    .email-header img {
      max-width: 150px;
      height: auto;
      margin-bottom: 15px;
    }
    .email-header h1 {
      font-size: 24px;
      font-weight: bold;
      margin: 0;
      color: #ffffff;
    }
    .email-body {
      padding: 30px 20px;
      color: #1f2937;
      line-height: 1.6;
    }
    .email-body h2 {
      font-size: 20px;
      font-weight: 600;
      color: ${primaryColor};
      margin-bottom: 20px;
      text-align: ${textAlign};
    }
    .email-body p {
      font-size: 16px;
      margin-bottom: 15px;
      text-align: ${textAlign};
      color: #4b5563;
    }
    .email-body .info-box {
      background-color: #f9fafb;
      border-left: 4px solid ${primaryColor};
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .email-body .info-box p {
      margin: 5px 0;
      font-size: 14px;
    }
    .email-body .info-box strong {
      color: ${primaryColor};
      font-weight: 600;
    }
    .email-button {
      display: inline-block;
      padding: 12px 30px;
      background-color: ${primaryColor};
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      margin: 20px 0;
      text-align: center;
    }
    .email-button:hover {
      background-color: ${secondaryColor};
    }
    .email-footer {
      background-color: #f9fafb;
      padding: 20px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
      color: #6b7280;
      font-size: 14px;
    }
    .email-footer p {
      margin: 5px 0;
    }
    .divider {
      height: 1px;
      background-color: #e5e7eb;
      margin: 20px 0;
    }
    @media only screen and (max-width: 600px) {
      .email-container {
        width: 100% !important;
      }
      .email-body {
        padding: 20px 15px;
      }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <h1>Brosted 4 U</h1>
      <p style="margin: 0; font-size: 14px; opacity: 0.9;">${language === 'ar' ? 'نظام إدارة Brosted-4U' : 'Brosted-4U Management System'}</p>
    </div>
    <div class="email-body">
      ${content}
    </div>
    <div class="email-footer">
      <p><strong>Brosted 4 U</strong></p>
      <p>${language === 'ar' ? '© 2025 Brosted-4U. جميع الحقوق محفوظة.' : '© 2025 Brosted-4U. All rights reserved.'}</p>
      <p style="font-size: 12px; margin-top: 10px;">
        ${language === 'ar' ? 'هذا إيميل تلقائي، يرجى عدم الرد عليه.' : 'This is an automated email, please do not reply.'}
      </p>
    </div>
  </div>
</body>
</html>
  `;
};

// Send email function
const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"Brosted 4 U" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject: subject,
      html: html,
      text: text || subject
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
};

// Email templates for different events

// Form submitted email
const getFormSubmittedEmail = (formData, language = 'en') => {
  const isRTL = language === 'ar';
  const title = isRTL ? 'تم إرسال نموذج جديد' : 'New Form Submitted';
  const formTitle = isRTL ? formData.templateTitle?.ar : formData.templateTitle?.en;
  const userName = formData.filledBy?.name || 'User';
  const department = formData.department || 'N/A';
  const date = new Date(formData.date).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US');
  const shift = formData.shift || 'N/A';

  const content = `
    <h2>${title}</h2>
    <p>${isRTL ? `تم إرسال نموذج جديد بواسطة ${userName}` : `A new form has been submitted by ${userName}`}</p>
    <div class="info-box">
      <p><strong>${isRTL ? 'اسم النموذج:' : 'Form Name:'}</strong> ${formTitle}</p>
      <p><strong>${isRTL ? 'المستخدم:' : 'User:'}</strong> ${userName}</p>
      <p><strong>${isRTL ? 'القسم:' : 'Department:'}</strong> ${department}</p>
      <p><strong>${isRTL ? 'التاريخ:' : 'Date:'}</strong> ${date}</p>
      <p><strong>${isRTL ? 'الوردية:' : 'Shift:'}</strong> ${shift}</p>
    </div>
    <p>${isRTL ? 'يرجى مراجعة النموذج والموافقة عليه أو رفضه.' : 'Please review and approve or reject the form.'}</p>
  `;

  return {
    subject: title,
    html: getEmailTemplate(title, content, language)
  };
};

// Form approved email
const getFormApprovedEmail = (formData, language = 'en') => {
  const isRTL = language === 'ar';
  const title = isRTL ? 'تمت الموافقة على النموذج' : 'Form Approved';
  const formTitle = isRTL ? formData.templateTitle?.ar : formData.templateTitle?.en;
  const approvedBy = formData.approvedBy?.name || 'Admin';

  const content = `
    <h2>${title}</h2>
    <p>${isRTL ? `تمت الموافقة على النموذج "${formTitle}"` : `Your form "${formTitle}" has been approved`}</p>
    <div class="info-box">
      <p><strong>${isRTL ? 'اسم النموذج:' : 'Form Name:'}</strong> ${formTitle}</p>
      <p><strong>${isRTL ? 'تمت الموافقة بواسطة:' : 'Approved By:'}</strong> ${approvedBy}</p>
      ${formData.approvalDate ? `<p><strong>${isRTL ? 'تاريخ الموافقة:' : 'Approval Date:'}</strong> ${new Date(formData.approvalDate).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')}</p>` : ''}
    </div>
    <p>${isRTL ? 'شكراً لاستخدامك نظام Brosted-4U.' : 'Thank you for using Brosted-4U system.'}</p>
  `;

  return {
    subject: title,
    html: getEmailTemplate(title, content, language)
  };
};

// Form rejected email
const getFormRejectedEmail = (formData, language = 'en') => {
  const isRTL = language === 'ar';
  const title = isRTL ? 'تم رفض النموذج' : 'Form Rejected';
  const formTitle = isRTL ? formData.templateTitle?.ar : formData.templateTitle?.en;
  const rejectedBy = formData.rejectedBy?.name || 'Admin';
  const notes = formData.rejectionNotes || '';

  const content = `
    <h2>${title}</h2>
    <p>${isRTL ? `تم رفض النموذج "${formTitle}"` : `Your form "${formTitle}" has been rejected`}</p>
    <div class="info-box">
      <p><strong>${isRTL ? 'اسم النموذج:' : 'Form Name:'}</strong> ${formTitle}</p>
      <p><strong>${isRTL ? 'تم الرفض بواسطة:' : 'Rejected By:'}</strong> ${rejectedBy}</p>
      ${formData.rejectionDate ? `<p><strong>${isRTL ? 'تاريخ الرفض:' : 'Rejection Date:'}</strong> ${new Date(formData.rejectionDate).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')}</p>` : ''}
      ${notes ? `<p><strong>${isRTL ? 'ملاحظات:' : 'Notes:'}</strong> ${notes}</p>` : ''}
    </div>
    <p>${isRTL ? 'يرجى مراجعة الملاحظات وإعادة إرسال النموذج بعد التصحيحات.' : 'Please review the notes and resubmit the form after corrections.'}</p>
  `;

  return {
    subject: title,
    html: getEmailTemplate(title, content, language)
  };
};

// Leave requested email
const getLeaveRequestedEmail = (leaveData, language = 'en') => {
  const isRTL = language === 'ar';
  const title = isRTL ? 'طلب إجازة جديد' : 'New Leave Request';
  const userName = leaveData.userName || 'User';
  const leaveType = isRTL ? leaveData.leaveType?.ar : leaveData.leaveType?.en;
  const days = leaveData.days || 0;
  const startDate = new Date(leaveData.startDate).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US');
  const endDate = new Date(leaveData.endDate).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US');
  const department = leaveData.department || 'N/A';

  const content = `
    <h2>${title}</h2>
    <p>${isRTL ? `تم تقديم طلب إجازة جديد من ${userName}` : `A new leave request has been submitted by ${userName}`}</p>
    <div class="info-box">
      <p><strong>${isRTL ? 'الموظف:' : 'Employee:'}</strong> ${userName}</p>
      <p><strong>${isRTL ? 'القسم:' : 'Department:'}</strong> ${department}</p>
      <p><strong>${isRTL ? 'نوع الإجازة:' : 'Leave Type:'}</strong> ${leaveType}</p>
      <p><strong>${isRTL ? 'من:' : 'From:'}</strong> ${startDate}</p>
      <p><strong>${isRTL ? 'إلى:' : 'To:'}</strong> ${endDate}</p>
      <p><strong>${isRTL ? 'المدة:' : 'Duration:'}</strong> ${days} ${isRTL ? 'يوم' : 'day(s)'}</p>
    </div>
    <p>${isRTL ? 'يرجى مراجعة طلب الإجازة والموافقة عليه أو رفضه.' : 'Please review and approve or reject the leave request.'}</p>
  `;

  return {
    subject: title,
    html: getEmailTemplate(title, content, language)
  };
};

// Leave approved email
const getLeaveApprovedEmail = (leaveData, language = 'en') => {
  const isRTL = language === 'ar';
  const title = isRTL ? 'تمت الموافقة على طلب الإجازة' : 'Leave Request Approved';
  const leaveType = isRTL ? leaveData.leaveType?.ar : leaveData.leaveType?.en;
  const days = leaveData.days || 0;
  const startDate = new Date(leaveData.startDate).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US');
  const endDate = new Date(leaveData.endDate).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US');
  const approvedBy = leaveData.approvedBy?.name || 'Admin';

  const content = `
    <h2>${title}</h2>
    <p>${isRTL ? 'تمت الموافقة على طلب الإجازة الخاص بك' : 'Your leave request has been approved'}</p>
    <div class="info-box">
      <p><strong>${isRTL ? 'نوع الإجازة:' : 'Leave Type:'}</strong> ${leaveType}</p>
      <p><strong>${isRTL ? 'من:' : 'From:'}</strong> ${startDate}</p>
      <p><strong>${isRTL ? 'إلى:' : 'To:'}</strong> ${endDate}</p>
      <p><strong>${isRTL ? 'المدة:' : 'Duration:'}</strong> ${days} ${isRTL ? 'يوم' : 'day(s)'}</p>
      <p><strong>${isRTL ? 'تمت الموافقة بواسطة:' : 'Approved By:'}</strong> ${approvedBy}</p>
    </div>
    <p>${isRTL ? 'نتمنى لك إجازة سعيدة!' : 'Have a great leave!'}</p>
  `;

  return {
    subject: title,
    html: getEmailTemplate(title, content, language)
  };
};

// Leave rejected email
const getLeaveRejectedEmail = (leaveData, language = 'en') => {
  const isRTL = language === 'ar';
  const title = isRTL ? 'تم رفض طلب الإجازة' : 'Leave Request Rejected';
  const leaveType = isRTL ? leaveData.leaveType?.ar : leaveData.leaveType?.en;
  const days = leaveData.days || 0;
  const startDate = new Date(leaveData.startDate).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US');
  const endDate = new Date(leaveData.endDate).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US');
  const rejectedBy = leaveData.rejectedBy?.name || 'Admin';
  const notes = leaveData.rejectionNotes || '';

  const content = `
    <h2>${title}</h2>
    <p>${isRTL ? 'تم رفض طلب الإجازة الخاص بك' : 'Your leave request has been rejected'}</p>
    <div class="info-box">
      <p><strong>${isRTL ? 'نوع الإجازة:' : 'Leave Type:'}</strong> ${leaveType}</p>
      <p><strong>${isRTL ? 'من:' : 'From:'}</strong> ${startDate}</p>
      <p><strong>${isRTL ? 'إلى:' : 'To:'}</strong> ${endDate}</p>
      <p><strong>${isRTL ? 'المدة:' : 'Duration:'}</strong> ${days} ${isRTL ? 'يوم' : 'day(s)'}</p>
      <p><strong>${isRTL ? 'تم الرفض بواسطة:' : 'Rejected By:'}</strong> ${rejectedBy}</p>
      ${notes ? `<p><strong>${isRTL ? 'ملاحظات:' : 'Notes:'}</strong> ${notes}</p>` : ''}
    </div>
    <p>${isRTL ? 'يرجى التواصل مع الإدارة لمزيد من المعلومات.' : 'Please contact the administration for more information.'}</p>
  `;

  return {
    subject: title,
    html: getEmailTemplate(title, content, language)
  };
};

// Send email to admins
const sendEmailToAdmins = async (emailData, department = null) => {
  try {
    const User = require('../models/User');

    // Get all admin users
    let query = { role: 'admin', isActive: true };

    // If department is specified, only send to that department's admins
    if (department && department !== 'all') {
      query.department = department;
    }

    const admins = await User.find(query).select('email languagePreference');

    if (admins.length === 0) {
      console.log('No admin users found to send email to');
      return { success: false, message: 'No admin users found' };
    }

    const results = [];
    for (const admin of admins) {
      const language = admin.languagePreference || 'ar';
      const email = emailData(language);

      const result = await sendEmail({
        to: admin.email,
        subject: email.subject,
        html: email.html
      });

      results.push({ email: admin.email, ...result });
    }

    return { success: true, results };
  } catch (error) {
    console.error('Error sending email to admins:', error);
    return { success: false, error: error.message };
  }
};

// Send email to user
const sendEmailToUser = async (userEmail, emailData, language = 'ar') => {
  try {
    const email = emailData(language);

    const result = await sendEmail({
      to: userEmail,
      subject: email.subject,
      html: email.html
    });

    return result;
  } catch (error) {
    console.error('Error sending email to user:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendEmail,
  sendEmailToAdmins,
  sendEmailToUser,
  getFormSubmittedEmail,
  getFormApprovedEmail,
  getFormRejectedEmail,
  getLeaveRequestedEmail,
  getLeaveApprovedEmail,
  getLeaveRejectedEmail
};

