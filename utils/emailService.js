const nodemailer = require('nodemailer');
const dateUtils = require('./dateUtils');

// Check if we're in development mode
const isDevelopment = process.env.NODE_ENV === 'development';

// Development logging helper
const devLog = (message, data = null) => {
  if (isDevelopment) {
    const timestamp = new Date().toISOString();
    console.log(`[EMAIL ${timestamp}] ${message}`);
    if (data) {
      console.log(`[EMAIL ${timestamp}] Data:`, JSON.stringify(data, null, 2));
    }
  }
};

// Create transporter
const createTransporter = () => {
  const config = {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS ? '***' : undefined // Hide password in logs
    }
  };

  devLog('Creating email transporter', {
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.auth.user,
    hasPassword: !!process.env.EMAIL_PASS
  });

  const transporter = nodemailer.createTransport(config);

  // Verify connection in development
  if (isDevelopment) {
    transporter.verify((error, success) => {
      if (error) {
        devLog('❌ Email transporter verification FAILED', { error: error.message });
      } else {
        devLog('✅ Email transporter verified successfully');
      }
    });
  }

  return transporter;
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
    devLog('📧 Starting email send process', {
      to: Array.isArray(to) ? to : [to],
      subject: subject,
      hasHtml: !!html,
      hasText: !!text
    });

    const transporter = createTransporter();

    const mailOptions = {
      from: `"Brosted 4 U" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject: subject,
      html: html,
      text: text || subject
    };

    devLog('📤 Sending email', {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject,
      htmlLength: html ? html.length : 0,
      textLength: text ? text.length : 0
    });

    const info = await transporter.sendMail(mailOptions);

    devLog('✅ Email sent successfully', {
      messageId: info.messageId,
      response: info.response,
      accepted: info.accepted,
      rejected: info.rejected,
      pending: info.pending
    });

    console.log('Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    devLog('❌ Error sending email', {
      error: error.message,
      stack: error.stack,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode
    });

    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
};

// Email templates for different events

// Helper function to format dates for emails using Saudi timezone (Gregorian calendar)
const formatEmailDate = (date, language = 'en') => {
  const locale = language === 'ar' ? 'ar-SA' : 'en-US';
  // Explicitly use Gregorian calendar to avoid Hijri dates
  return dateUtils.formatDate(date, { calendar: 'gregory' }, locale);
};

// Form submitted email
const getFormSubmittedEmail = (formData, language = 'en') => {
  const isRTL = language === 'ar';
  const title = isRTL ? 'تم إرسال نموذج جديد' : 'New Form Submitted';
  const formTitle = isRTL ? formData.templateTitle?.ar : formData.templateTitle?.en;
  const userName = formData.filledBy?.name || 'User';
  const department = formData.department || 'N/A';
  const date = formatEmailDate(formData.date, language);
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
      ${formData.approvalDate ? `<p><strong>${isRTL ? 'تاريخ الموافقة:' : 'Approval Date:'}</strong> ${formatEmailDate(formData.approvalDate, language)}</p>` : ''}
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
      ${formData.rejectionDate ? `<p><strong>${isRTL ? 'تاريخ الرفض:' : 'Rejection Date:'}</strong> ${formatEmailDate(formData.rejectionDate, language)}</p>` : ''}
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
  const startDate = formatEmailDate(leaveData.startDate, language);
  const endDate = formatEmailDate(leaveData.endDate, language);
  const department = leaveData.department || 'N/A';

  // Calculate duration in hours if less than 1 day
  let durationText = '';
  if (days < 1 && days > 0) {
    const hours = Math.round(days * 24);
    durationText = `${hours} ${isRTL ? 'ساعة' : 'hour(s)'}`;
  } else {
    durationText = `${days} ${isRTL ? 'يوم' : 'day(s)'}`;
  }

  const content = `
    <h2>${title}</h2>
    <p>${isRTL ? `تم تقديم طلب إجازة جديد من ${userName}` : `A new leave request has been submitted by ${userName}`}</p>
    <div class="info-box">
      <p><strong>${isRTL ? 'الموظف:' : 'Employee:'}</strong> ${userName}</p>
      <p><strong>${isRTL ? 'القسم:' : 'Department:'}</strong> ${department}</p>
      <p><strong>${isRTL ? 'نوع الإجازة:' : 'Leave Type:'}</strong> ${leaveType}</p>
      <p><strong>${isRTL ? 'من:' : 'From:'}</strong> ${startDate}</p>
      <p><strong>${isRTL ? 'إلى:' : 'To:'}</strong> ${endDate}</p>
      <p><strong>${isRTL ? 'المدة:' : 'Duration:'}</strong> ${durationText}</p>
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
  const startDate = formatEmailDate(leaveData.startDate, language);
  const endDate = formatEmailDate(leaveData.endDate, language);
  const approvedBy = leaveData.approvedBy?.name || 'Admin';

  // Calculate duration in hours if less than 1 day
  let durationText = '';
  if (days < 1 && days > 0) {
    const hours = Math.round(days * 24);
    durationText = `${hours} ${isRTL ? 'ساعة' : 'hour(s)'}`;
  } else {
    durationText = `${days} ${isRTL ? 'يوم' : 'day(s)'}`;
  }

  const content = `
    <h2>${title}</h2>
    <p>${isRTL ? 'تمت الموافقة على طلب الإجازة الخاص بك' : 'Your leave request has been approved'}</p>
    <div class="info-box">
      <p><strong>${isRTL ? 'نوع الإجازة:' : 'Leave Type:'}</strong> ${leaveType}</p>
      <p><strong>${isRTL ? 'من:' : 'From:'}</strong> ${startDate}</p>
      <p><strong>${isRTL ? 'إلى:' : 'To:'}</strong> ${endDate}</p>
      <p><strong>${isRTL ? 'المدة:' : 'Duration:'}</strong> ${durationText}</p>
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
  const startDate = formatEmailDate(leaveData.startDate, language);
  const endDate = formatEmailDate(leaveData.endDate, language);
  const rejectedBy = leaveData.rejectedBy?.name || 'Admin';
  const notes = leaveData.rejectionNotes || '';

  // Calculate duration in hours if less than 1 day
  let durationText = '';
  if (days < 1 && days > 0) {
    const hours = Math.round(days * 24);
    durationText = `${hours} ${isRTL ? 'ساعة' : 'hour(s)'}`;
  } else {
    durationText = `${days} ${isRTL ? 'يوم' : 'day(s)'}`;
  }

  const content = `
    <h2>${title}</h2>
    <p>${isRTL ? 'تم رفض طلب الإجازة الخاص بك' : 'Your leave request has been rejected'}</p>
    <div class="info-box">
      <p><strong>${isRTL ? 'نوع الإجازة:' : 'Leave Type:'}</strong> ${leaveType}</p>
      <p><strong>${isRTL ? 'من:' : 'From:'}</strong> ${startDate}</p>
      <p><strong>${isRTL ? 'إلى:' : 'To:'}</strong> ${endDate}</p>
      <p><strong>${isRTL ? 'المدة:' : 'Duration:'}</strong> ${durationText}</p>
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
    devLog('👥 Sending email to admins', { department });

    const User = require('../models/User');

    // Get all admin users
    let query = { role: 'admin', isActive: true };

    // If department is specified, only send to that department's admins
    if (department && department !== 'all') {
      query.department = department;
    }

    const admins = await User.find(query).select('email languagePreference');

    devLog('📋 Found admins', {
      count: admins.length,
      emails: admins.map(a => a.email),
      languages: admins.map(a => a.languagePreference || 'ar')
    });

    if (admins.length === 0) {
      devLog('⚠️ No admin users found to send email to');
      console.log('No admin users found to send email to');
      return { success: false, message: 'No admin users found' };
    }

    const results = [];
    for (const admin of admins) {
      const language = admin.languagePreference || 'ar';
      devLog(`📧 Preparing email for admin: ${admin.email}`, { language });

      const email = emailData(language);

      const result = await sendEmail({
        to: admin.email,
        subject: email.subject,
        html: email.html
      });

      results.push({ email: admin.email, ...result });
      devLog(`✅ Email sent to admin: ${admin.email}`, { success: result.success });
    }

    devLog('✅ Completed sending emails to admins', {
      total: admins.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    });

    return { success: true, results };
  } catch (error) {
    devLog('❌ Error sending email to admins', {
      error: error.message,
      stack: error.stack
    });
    console.error('Error sending email to admins:', error);
    return { success: false, error: error.message };
  }
};

// Send email to user
const sendEmailToUser = async (userEmail, emailData, language = 'ar') => {
  try {
    devLog('👤 Sending email to user', { userEmail, language });

    const email = emailData(language);

    devLog('📧 Email prepared for user', {
      userEmail,
      subject: email.subject,
      htmlLength: email.html ? email.html.length : 0
    });

    const result = await sendEmail({
      to: userEmail,
      subject: email.subject,
      html: email.html
    });

    devLog(`✅ Email sent to user: ${userEmail}`, { success: result.success });

    return result;
  } catch (error) {
    devLog('❌ Error sending email to user', {
      userEmail,
      error: error.message,
      stack: error.stack
    });
    console.error('Error sending email to user:', error);
    return { success: false, error: error.message };
  }
};

// Password reset email
const getPasswordResetEmail = (resetData, language = 'en') => {
  const isRTL = language === 'ar';
  const title = isRTL ? 'إعادة تعيين كلمة المرور' : 'Password Reset';
  const resetLink = resetData.resetLink;
  const userName = resetData.userName || 'User';
  const expiresIn = resetData.expiresIn || '1 hour';

  const content = `
    <h2>${title}</h2>
    <p>${isRTL ? `مرحباً ${userName},` : `Hello ${userName},`}</p>
    <p>${isRTL ? 'لقد طلبت إعادة تعيين كلمة المرور لحسابك.' : 'You have requested to reset your password.'}</p>
    <p>${isRTL ? 'انقر على الزر أدناه لإعادة تعيين كلمة المرور:' : 'Click the button below to reset your password:'}</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetLink}" class="email-button" style="display: inline-block; padding: 12px 30px; background-color: #dc2328; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: 600;">
        ${isRTL ? 'إعادة تعيين كلمة المرور' : 'Reset Password'}
      </a>
    </div>
    <p style="font-size: 14px; color: #6b7280;">
      ${isRTL ? `أو انسخ والصق هذا الرابط في المتصفح: ${resetLink}` : `Or copy and paste this link in your browser: ${resetLink}`}
    </p>
    <p style="font-size: 14px; color: #dc2328;">
      ${isRTL ? `⚠️ هذا الرابط سينتهي خلال ${expiresIn}.` : `⚠️ This link will expire in ${expiresIn}.`}
    </p>
    <p style="font-size: 14px; color: #6b7280;">
      ${isRTL ? 'إذا لم تطلب إعادة تعيين كلمة المرور، يرجى تجاهل هذا الإيميل.' : 'If you did not request a password reset, please ignore this email.'}
    </p>
  `;

  return {
    subject: title,
    html: getEmailTemplate(title, content, language)
  };
};

// Password reset request email (to admins)
const getPasswordResetRequestEmail = (requestData, language = 'en') => {
  const isRTL = language === 'ar';
  const title = isRTL ? 'طلب إعادة تعيين كلمة المرور' : 'Password Reset Request';
  const userName = requestData.userName || 'User';
  const userEmail = requestData.userEmail || 'N/A';
  const department = requestData.department || 'N/A';
  const requestDate = formatEmailDate(requestData.requestDate, language);

  const content = `
    <h2>${title}</h2>
    <p>${isRTL ? `تم طلب إعادة تعيين كلمة المرور من قبل مستخدم:` : `A password reset has been requested by a user:`}</p>
    <div class="info-box">
      <p><strong>${isRTL ? 'اسم المستخدم:' : 'User Name:'}</strong> ${userName}</p>
      <p><strong>${isRTL ? 'البريد الإلكتروني:' : 'Email:'}</strong> ${userEmail}</p>
      <p><strong>${isRTL ? 'القسم:' : 'Department:'}</strong> ${department}</p>
      <p><strong>${isRTL ? 'تاريخ الطلب:' : 'Request Date:'}</strong> ${requestDate}</p>
    </div>
    <p>${isRTL ? 'يرجى مراجعة الطلب وإعادة تعيين كلمة المرور للمستخدم من لوحة التحكم.' : 'Please review the request and reset the user\'s password from the dashboard.'}</p>
  `;

  return {
    subject: title,
    html: getEmailTemplate(title, content, language)
  };
};

// Password reset by admin email
const getPasswordResetByAdminEmail = (resetData, language = 'en') => {
  const isRTL = language === 'ar';
  const title = isRTL ? 'تم إعادة تعيين كلمة المرور' : 'Password Has Been Reset';
  const userName = resetData.userName || 'User';
  const newPassword = resetData.newPassword || '';
  const resetBy = resetData.resetBy || 'Admin';

  const content = `
    <h2>${title}</h2>
    <p>${isRTL ? `مرحباً ${userName},` : `Hello ${userName},`}</p>
    <p>${isRTL ? 'تم إعادة تعيين كلمة المرور لحسابك من قبل المدير.' : 'Your password has been reset by an administrator.'}</p>
    <div class="info-box">
      <p><strong>${isRTL ? 'تمت إعادة التعيين بواسطة:' : 'Reset By:'}</strong> ${resetBy}</p>
      ${newPassword ? `<p><strong>${isRTL ? 'كلمة المرور الجديدة:' : 'New Password:'}</strong> <code style="background-color: #f3f4f6; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${newPassword}</code></p>` : ''}
    </div>
    <p style="color: #dc2328; font-weight: 600;">
      ${isRTL ? '⚠️ يرجى تغيير كلمة المرور بعد تسجيل الدخول.' : '⚠️ Please change your password after logging in.'}
    </p>
    <p>${isRTL ? 'يمكنك تسجيل الدخول الآن باستخدام كلمة المرور الجديدة.' : 'You can now log in using your new password.'}</p>
  `;

  return {
    subject: title,
    html: getEmailTemplate(title, content, language)
  };
};

// Employee report email
const getEmployeeReportEmail = (data, language = 'en') => {
  const isRTL = language === 'ar';
  const title = isRTL ? 'تقرير الأداء الشهري' : 'Monthly Performance Report';
  const content = `
    <p style="text-align: ${isRTL ? 'right' : 'left'}; margin-bottom: 15px;">${isRTL ? `مرحباً ${data.employeeName},` : `Hello ${data.employeeName},`}</p>
    <p style="text-align: ${isRTL ? 'right' : 'left'}; margin-bottom: 15px;">${isRTL ? 'نود إعلامك بأن تقرير الأداء الشهري الخاص بك جاهز. يرجى النقر على الرابط أدناه لعرض التقرير.' : 'We would like to inform you that your monthly performance report is ready. Please click the link below to view your report.'}</p>
    <div class="info-box" style="background-color: #f9fafb; border-left: 4px solid #dc2328; padding: 15px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 5px 0; font-size: 14px;"><strong style="color: #dc2328;">${isRTL ? 'الفترة:' : 'Period:'}</strong> ${data.month} ${data.year}</p>
      <p style="margin: 5px 0; font-size: 14px;"><strong style="color: #dc2328;">${isRTL ? 'القسم:' : 'Department:'}</strong> ${data.department}</p>
    </div>
    <p style="text-align: ${isRTL ? 'right' : 'left'}; margin-bottom: 15px;">${isRTL ? 'يرجى الاطلاع على التقرير للحصول على تفاصيل كاملة عن حضورك وإجازاتك وأدائك خلال هذا الشهر.' : 'Please review the report for complete details about your attendance, leaves, and performance during this month.'}</p>
    <p style="text-align: ${isRTL ? 'right' : 'left'}; margin-bottom: 15px;">${isRTL ? 'إذا كان لديك أي استفسارات، يرجى التواصل معنا.' : 'If you have any questions, please feel free to contact us.'}</p>
    <p style="text-align: ${isRTL ? 'right' : 'left'}; font-size: 12px; color: #6b7280;">${isRTL ? 'فريق إدارة Brosted-4U' : 'Brosted-4U Management Team'}</p>
  `;
  return {
    subject: title,
    html: getEmailTemplate(title, content, language)
  };
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
  getLeaveRejectedEmail,
  getPasswordResetEmail,
  getPasswordResetRequestEmail,
  getPasswordResetByAdminEmail,
  getEmployeeReportEmail
};

