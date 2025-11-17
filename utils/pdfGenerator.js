const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class PDFGenerator {
  constructor() {
    // Path to Arabic font (you'll need to add an Arabic font file)
    this.arabicFontPath = path.join(__dirname, '../fonts/NotoSansArabic-Regular.ttf');
  }

  async generateFormPDF(formInstance, template, user, language = 'en') {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ 
          size: 'A4', 
          margin: 50,
          bufferPages: true
        });
        
        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Register Arabic font if available
        if (fs.existsSync(this.arabicFontPath)) {
          doc.registerFont('Arabic', this.arabicFontPath);
        }

        const isRTL = language === 'ar';
        const title = template.title[language] || template.title.en;
        const description = template.description?.[language] || template.description?.en || '';

        // Header
        this.addHeader(doc, title, isRTL);
        doc.moveDown();

        // General Information
        this.addGeneralInfo(doc, formInstance, user, language, isRTL);
        doc.moveDown();

        // Form Sections
        template.sections.forEach((section, index) => {
          this.addSection(doc, section, formInstance.values, language, isRTL);
          if (index < template.sections.length - 1) {
            doc.moveDown();
          }
        });

        // Status and Approval
        this.addApprovalSection(doc, formInstance, language, isRTL);

        // Footer
        this.addFooter(doc, isRTL);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  addHeader(doc, title, isRTL) {
    // Restaurant Name/Logo Section
    doc.fontSize(20)
       .fillColor('#dc2328')
       .text('Brosted-4U', { align: 'center' });
    
    doc.fontSize(16)
       .fillColor('#000000')
       .text(title, { align: 'center' });
    
    doc.moveTo(50, doc.y + 10)
       .lineTo(doc.page.width - 50, doc.y + 10)
       .stroke();
  }

  addGeneralInfo(doc, formInstance, user, language, isRTL) {
    doc.fontSize(12).fillColor('#000000');
    
    const labels = {
      en: {
        date: 'Date',
        filledBy: 'Filled By',
        department: 'Department',
        shift: 'Shift',
        status: 'Status'
      },
      ar: {
        date: 'التاريخ',
        filledBy: 'تم الملء بواسطة',
        department: 'القسم',
        shift: 'الوردية',
        status: 'الحالة'
      }
    };

    const lang = labels[language] || labels.en;
    
    const infoLines = [
      `${lang.date}: ${new Date(formInstance.date).toLocaleDateString()}`,
      `${lang.filledBy}: ${user.name}`,
      `${lang.department}: ${formInstance.department}`,
      `${lang.shift}: ${formInstance.shift}`,
      `${lang.status}: ${formInstance.status}`
    ];

    infoLines.forEach(line => {
      doc.text(line, { align: isRTL ? 'right' : 'left' });
    });
  }

  addSection(doc, section, values, language, isRTL) {
    // Section Header
    doc.fontSize(14)
       .fillColor('#dc2328')
       .text(section.label[language] || section.label.en, { 
         align: isRTL ? 'right' : 'left',
         underline: true 
       });
    
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#000000');

    // Section Fields
    section.fields.forEach(field => {
      const fieldKey = `${section.id}.${field.key}`;
      const value = values.get ? values.get(fieldKey) : values[fieldKey];
      const label = field.label[language] || field.label.en;
      
      let displayValue = value !== undefined && value !== null ? value : '-';
      
      // Format boolean values
      if (field.type === 'boolean') {
        displayValue = value ? (language === 'ar' ? 'نعم' : 'Yes') : (language === 'ar' ? 'لا' : 'No');
      }
      
      // Format date values
      if (field.type === 'date' && value) {
        displayValue = new Date(value).toLocaleDateString();
      }

      doc.text(`${label}: ${displayValue}`, { 
        align: isRTL ? 'right' : 'left' 
      });
    });
  }

  addApprovalSection(doc, formInstance, language, isRTL) {
    doc.moveDown();
    doc.fontSize(12).fillColor('#000000');

    const labels = {
      en: {
        approval: 'Approval Information',
        approvedBy: 'Approved By',
        approvalDate: 'Approval Date',
        notes: 'Notes'
      },
      ar: {
        approval: 'معلومات الموافقة',
        approvedBy: 'تمت الموافقة بواسطة',
        approvalDate: 'تاريخ الموافقة',
        notes: 'ملاحظات'
      }
    };

    const lang = labels[language] || labels.en;

    if (formInstance.status === 'approved' && formInstance.approvedBy) {
      doc.fontSize(13)
         .fillColor('#dc2328')
         .text(lang.approval, { align: isRTL ? 'right' : 'left' });
      
      doc.fontSize(11).fillColor('#000000');
      doc.text(`${lang.approvedBy}: ${formInstance.approvedBy.name || 'N/A'}`, { 
        align: isRTL ? 'right' : 'left' 
      });
      
      if (formInstance.approvalDate) {
        doc.text(`${lang.approvalDate}: ${new Date(formInstance.approvalDate).toLocaleString()}`, { 
          align: isRTL ? 'right' : 'left' 
        });
      }
      
      if (formInstance.approvalNotes) {
        doc.text(`${lang.notes}: ${formInstance.approvalNotes}`, { 
          align: isRTL ? 'right' : 'left' 
        });
      }
    }
  }

  addFooter(doc, isRTL) {
    const pages = doc.bufferedPageRange();
    
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      
      doc.fontSize(9)
         .fillColor('#666666')
         .text(
           `Page ${i + 1} of ${pages.count}`,
           50,
           doc.page.height - 50,
           { align: 'center' }
         );
      
      doc.text(
        'Brosted-4U Restaurant Management System',
        50,
        doc.page.height - 35,
        { align: 'center' }
      );
    }
  }
}

module.exports = new PDFGenerator();

