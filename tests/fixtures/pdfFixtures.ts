import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export class PdfFixtures {
  /**
   * Generates a real Bank Statement PDF buffer
   */
  public static async createBankStatementPdf(options?: {
    bankName?: string;
    accountNo?: string;
    ifsc?: string;
    startDate?: string;
    endDate?: string;
    openingBalance?: number;
    closingBalance?: number;
  }): Promise<Buffer> {
    const doc = await PDFDocument.create();
    const page = doc.addPage([600, 800]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

    const bank = options?.bankName || 'AXIS BANK';
    const acc = options?.accountNo || 'XXXXXXXXXXX9843';
    const ifsc = options?.ifsc || 'UTIB0002491';
    const start = options?.startDate || '21/09/2025';
    const end = options?.endDate || '20/09/2026';
    const openBal = options?.openingBalance ?? 12749.56;
    const closeBal = options?.closingBalance ?? 14846.77;

    let y = 750;
    page.drawText(`${bank} - ACCOUNT STATEMENT`, { x: 50, y, size: 16, font: fontBold });
    y -= 30;
    page.drawText(`Customer Name: MR. RAJAT KUMAR SHARMA`, { x: 50, y, size: 10, font });
    y -= 15;
    page.drawText(`Account Number: ${acc}   Account Type: REGULAR SAVINGS`, { x: 50, y, size: 10, font });
    y -= 15;
    page.drawText(`IFSC Code: ${ifsc}   Customer ID: 88721901`, { x: 50, y, size: 10, font });
    y -= 15;
    page.drawText(`Statement Period: ${start} to ${end}`, { x: 50, y, size: 10, font });
    y -= 15;
    page.drawText(`Opening Balance: INR ${openBal.toFixed(2)}    Closing Balance: INR ${closeBal.toFixed(2)}`, {
      x: 50,
      y,
      size: 10,
      font: fontBold,
    });
    y -= 35;

    // Table Headers
    page.drawText('Date       | Description / Narration                | Chq/Ref No   | Debit (Dr) | Credit (Cr) | Balance', {
      x: 50,
      y,
      size: 9,
      font: fontBold,
    });
    y -= 10;
    page.drawLine({ start: { x: 50, y }, end: { x: 550, y }, thickness: 1, color: rgb(0.2, 0.2, 0.2) });
    y -= 18;

    const sampleRows = [
      '21/09/2025 UPI/P2M/528191649605/Swiggy/AXIS BANK           528191649605   839.00                    11910.56',
      '22/09/2025 IMPS/P2A/528229043993/RKBANSAL/RATNAKAR        528229043993                10584.00     22494.56',
      '23/09/2025 UPI/P2A/564837606963/SONIA PURI/JK BANK        564837606963   3500.00                   18994.56',
      '24/09/2025 NEFT/HDFCN/SPRINKLR INDIA PRIVATE SALARY       HDFC0001234                 174258.00    193252.56',
      '25/09/2025 ACH/DR/LOAN INSTALMENT BAJAJ FIN               ACH9918231    22492.00                  170760.56',
      '26/09/2025 UPI/P2M/Blinkit/HDFC BANK LTD                   564820844757   1132.00                   169628.56',
      '27/09/2025 ATM CASH WDL/AXIS ATM JAMMU                     ATM8817231    5000.00                   164628.56',
      '28/09/2025 UPI/P2A/BANESINGH BARGI/BANK OF BARODA          564962435322   50.00                     164578.56',
    ];

    for (const row of sampleRows) {
      page.drawText(row, { x: 50, y, size: 8, font });
      y -= 18;
    }

    const pdfBytes = await doc.save();
    return Buffer.from(pdfBytes);
  }

  /**
   * Generates an Aadhaar Card PDF (NOT a bank statement)
   */
  public static async createAadhaarPdf(): Promise<Buffer> {
    const doc = await PDFDocument.create();
    const page = doc.addPage([600, 800]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

    let y = 740;
    page.drawText('Government of India', { x: 200, y, size: 14, font: fontBold });
    y -= 25;
    page.drawText('Unique Identification Authority of India (UIDAI)', { x: 140, y, size: 13, font: fontBold });
    y -= 30;
    page.drawText('Enrollment No: 1024/50123/09876', { x: 50, y, size: 10, font });
    y -= 20;
    page.drawText('To: RAJAT KUMAR SHARMA', { x: 50, y, size: 11, font: fontBold });
    y -= 15;
    page.drawText("Father's Name: PARTAP SINGH SHARMA", { x: 50, y, size: 10, font });
    y -= 15;
    page.drawText('Address: SOBKA, JAMMU, JAMMU AND KASHMIR, 181122', { x: 50, y, size: 10, font });
    y -= 30;
    page.drawText('Mera Aadhaar, Meri Pehchan', { x: 200, y, size: 12, font: fontBold });
    y -= 25;
    page.drawText('Aadhaar Number: 9906 0801 8183', { x: 180, y, size: 14, font: fontBold });
    y -= 20;
    page.drawText('DOB: 16/09/1994   Gender: Male', { x: 200, y, size: 10, font });
    y -= 20;
    page.drawText('Download Date: 22/09/2026   VID: 9182 3847 2918 4721', { x: 150, y, size: 9, font });

    const pdfBytes = await doc.save();
    return Buffer.from(pdfBytes);
  }

  /**
   * Generates a PAN Card / Tax PDF (NOT a bank statement)
   */
  public static async createPanPdf(): Promise<Buffer> {
    const doc = await PDFDocument.create();
    const page = doc.addPage([600, 800]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

    let y = 740;
    page.drawText('INCOME TAX DEPARTMENT - GOVT. OF INDIA', { x: 150, y, size: 14, font: fontBold });
    y -= 30;
    page.drawText('Permanent Account Number Card', { x: 180, y, size: 12, font: fontBold });
    y -= 30;
    page.drawText('PAN: GGPPS0827C', { x: 220, y, size: 16, font: fontBold });
    y -= 25;
    page.drawText('Name: RAJAT KUMAR SHARMA', { x: 50, y, size: 11, font });
    y -= 15;
    page.drawText("Father's Name: PARTAP SINGH SHARMA", { x: 50, y, size: 11, font });
    y -= 15;
    page.drawText('Date of Birth: 16/09/1994', { x: 50, y, size: 11, font });

    const pdfBytes = await doc.save();
    return Buffer.from(pdfBytes);
  }

  /**
   * Generates a Tax Invoice PDF (NOT a bank statement)
   */
  public static async createInvoicePdf(): Promise<Buffer> {
    const doc = await PDFDocument.create();
    const page = doc.addPage([600, 800]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

    let y = 740;
    page.drawText('TAX INVOICE', { x: 250, y, size: 16, font: fontBold });
    y -= 30;
    page.drawText('Invoice No: INV-2026-9901    Date: 22/09/2026', { x: 50, y, size: 10, font });
    y -= 15;
    page.drawText('GSTIN: 07AABCU9603R1ZM    Place of Supply: Delhi (07)', { x: 50, y, size: 10, font });
    y -= 20;
    page.drawText('Bill To: ABC Technologies Pvt Ltd', { x: 50, y, size: 10, font: fontBold });
    y -= 15;
    page.drawText('Ship To: Tech Park, Sector 62, Noida', { x: 50, y, size: 10, font });
    y -= 25;
    page.drawText('Item Description | HSN/SAC | Qty | Unit Price | CGST 9% | SGST 9% | Total Amount', {
      x: 50,
      y,
      size: 9,
      font: fontBold,
    });
    y -= 20;
    page.drawText('Cloud Hosting Services | 998313 | 1 | 50,000.00 | 4,500.00 | 4,500.00 | 59,000.00', {
      x: 50,
      y,
      size: 9,
      font,
    });

    const pdfBytes = await doc.save();
    return Buffer.from(pdfBytes);
  }

  /**
   * Generates a Salary Slip PDF (NOT a bank statement)
   */
  public static async createSalarySlipPdf(): Promise<Buffer> {
    const doc = await PDFDocument.create();
    const page = doc.addPage([600, 800]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

    let y = 740;
    page.drawText('SPRINKLR INDIA PRIVATE LIMITED - PAYSLIP', { x: 120, y, size: 14, font: fontBold });
    y -= 25;
    page.drawText('Payslip for the month of August 2026', { x: 180, y, size: 11, font });
    y -= 25;
    page.drawText('Employee Name: Rajat Kumar Sharma    Emp ID: SPR-10928', { x: 50, y, size: 10, font });
    y -= 15;
    page.drawText('Designation: Lead Software Engineer    Working Days: 31', { x: 50, y, size: 10, font });
    y -= 25;
    page.drawText('EARNINGS                  | DEDUCTIONS', { x: 50, y, size: 10, font: fontBold });
    y -= 15;
    page.drawText('Basic Pay: 1,00,000.00     | Provident Fund (PF): 12,000.00', { x: 50, y, size: 9, font });
    y -= 15;
    page.drawText('HRA: 50,000.00             | Professional Tax: 200.00', { x: 50, y, size: 9, font });
    y -= 15;
    page.drawText('Special Allowance: 36,458.00 | Income Tax (TDS): 15,000.00', { x: 50, y, size: 9, font });
    y -= 25;
    page.drawText('Gross Earnings: 1,86,458.00 | Total Deductions: 27,200.00 | Net Pay: 1,59,258.00', {
      x: 50,
      y,
      size: 10,
      font: fontBold,
    });

    const pdfBytes = await doc.save();
    return Buffer.from(pdfBytes);
  }

  /**
   * Generates a Loan Agreement / Sanction Letter PDF (NOT a bank statement)
   */
  public static async createLoanSanctionPdf(): Promise<Buffer> {
    const doc = await PDFDocument.create();
    const page = doc.addPage([600, 800]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

    let y = 740;
    page.drawText('SANCTION LETTER / LOAN AGREEMENT', { x: 160, y, size: 14, font: fontBold });
    y -= 30;
    page.drawText('Facility Agreement Reference: HDFC-PL-2026-88192', { x: 50, y, size: 10, font });
    y -= 15;
    page.drawText('Borrower Details: Mr. Rajat Kumar Sharma', { x: 50, y, size: 10, font: fontBold });
    y -= 20;
    page.drawText('Sanctioned Amount: INR 15,00,000.00 (Fifteen Lakhs Only)', { x: 50, y, size: 11, font: fontBold });
    y -= 15;
    page.drawText('Interest Rate: 10.5% p.a. Reducing    Tenure: 48 Months', { x: 50, y, size: 10, font });
    y -= 15;
    page.drawText('Equated Monthly Installment (EMI): INR 38,410.00', { x: 50, y, size: 10, font: fontBold });
    y -= 15;
    page.drawText('Disbursal Schedule: Disbursed to Bank Account ending in 9843', { x: 50, y, size: 10, font });
    y -= 25;
    page.drawText('Terms of Sanction and Conditions of Facility Agreement...', { x: 50, y, size: 9, font });

    const pdfBytes = await doc.save();
    return Buffer.from(pdfBytes);
  }

  /**
   * Generates a Password-Protected / Encrypted PDF
   */
  public static createPasswordProtectedPdf(): Buffer {
    // A synthetic PDF byte stream with /Encrypt dictionary trailer
    const encryptedPdfString = `%PDF-1.4
1 0 obj
<<
  /Type /Catalog
  /Pages 2 0 R
>>
endobj
2 0 obj
<<
  /Type /Pages
  /Kids [3 0 R]
  /Count 1
>>
endobj
3 0 obj
<<
  /Type /Page
  /Parent 2 0 R
  /MediaBox [0 0 612 792]
  /Contents 4 0 R
>>
endobj
4 0 obj
<< /Length 15 >>
stream
(Secret content)
endstream
endobj
5 0 obj
<<
  /Filter /Standard
  /V 2
  /R 3
  /P -3904
  /O (12345678901234567890123456789012)
  /U (12345678901234567890123456789012)
>>
endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000117 00000 n 
0000000206 00000 n 
0000000270 00000 n 
trailer
<<
  /Size 6
  /Root 1 0 R
  /Encrypt 5 0 R
  /ID [<12345678901234567890123456789012><12345678901234567890123456789012>]
>>
startxref
400
%%EOF`;
    return Buffer.from(encryptedPdfString, 'utf-8');
  }

  /**
   * Generates a corrupted PDF buffer
   */
  public static createCorruptedPdf(): Buffer {
    return Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog ... corrupted broken PDF stream @@!#$#%^');
  }

  /**
   * Generates a 32-page Axis Bank statement with multiline transactions
   */
  public static async createAxisMultiLinePdf(pageCount: number = 32): Promise<Buffer> {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

    for (let p = 1; p <= pageCount; p++) {
      const page = doc.addPage([600, 850]);
      let y = 800;

      // Header on every page
      page.drawText('Statement of Axis Account No: 925010049111575', { x: 50, y, size: 12, font: fontBold });
      y -= 15;
      page.drawText('Customer Name: MR. RAJAT KUMAR SHARMA    IFSC Code: UTIB0004378', { x: 50, y, size: 9, font });
      y -= 15;
      page.drawText(`Statement Period: 18-03-2026 to 17-09-2026    Page ${p} of ${pageCount}`, { x: 50, y, size: 9, font });
      y -= 15;

      if (p === 1) {
        page.drawText('OPENING BALANCE: 49.13', { x: 50, y, size: 10, font: fontBold });
        y -= 20;
      }

      page.drawText('Tran Date  Chq No  Particulars  Debit  Credit  Balance  Init. Br', { x: 50, y, size: 9, font: fontBold });
      y -= 20;

      if (p === 1) {
        // IMPS Multiline Transaction
        page.drawText('18-03-2026', { x: 50, y, size: 8, font });
        y -= 12;
        page.drawText('IMPS/P2A/607717366683/IdfFinan/IDFCBank/Pa', { x: 50, y, size: 8, font });
        y -= 12;
        page.drawText('ymentd/9198452472199751001', { x: 50, y, size: 8, font });
        y -= 15;
        page.drawText('16758.00 16807.13 4378', { x: 50, y, size: 8, font });
        y -= 20;

        // UPI Same-line Transaction
        page.drawText('18-03-2026', { x: 50, y, size: 8, font });
        y -= 12;
        page.drawText('UPI/P2M/644329448132/REKHA SHAW', { x: 50, y, size: 8, font });
        y -= 12;
        page.drawText('/UPI/YES BANK LIMITED YBS 25.00 16782.13 4378', { x: 50, y, size: 8, font });
        y -= 20;

        // Self Cash Deposit
        page.drawText('27-03-2026', { x: 50, y, size: 8, font });
        y -= 12;
        page.drawText('SELF CASH DEP', { x: 50, y, size: 8, font });
        y -= 12;
        page.drawText('BNA/DPRH487201/6809/270326/NARAYAN', { x: 50, y, size: 8, font });
        y -= 15;
        page.drawText('15500.00 32282.13 4378', { x: 50, y, size: 8, font });
        y -= 20;

        // Salary NEFT
        page.drawText('07-04-2026', { x: 50, y, size: 8, font });
        y -= 12;
        page.drawText('NEFT/YESIG60970213984/KALIMATA', { x: 50, y, size: 8, font });
        y -= 12;
        page.drawText('VYAPAAR/YES BANK/KVPL070426-3', { x: 50, y, size: 8, font });
        y -= 12;
        page.drawText('SALARY MAR 26 YE', { x: 50, y, size: 8, font });
        y -= 15;
        page.drawText('40007.00 72289.13 248', { x: 50, y, size: 8, font });
        y -= 20;
      } else {
        // Subsequent pages with transactions
        page.drawText(`10-04-2026`, { x: 50, y, size: 8, font });
        y -= 12;
        page.drawText(`UPI/P2M/TRANSACTION RECORD PAGE ${p}`, { x: 50, y, size: 8, font });
        y -= 15;
        page.drawText(`100.00 ${72289.13 - (p - 1) * 100}.00 4378`, { x: 50, y, size: 8, font });
      }
    }

    const bytes = await doc.save();
    return Buffer.from(bytes);
  }

  /**
   * Generates a 100% scanned / image-based Kotak Bank statement with ZERO machine-readable native text
   */
  public static async createKotakScannedPdf(options?: {
    accountHolder?: string;
    accountNo?: string;
    ifsc?: string;
    startDate?: string;
    endDate?: string;
    openingBalance?: number;
    closingBalance?: number;
  }): Promise<Buffer> {
    const { createCanvas } = await import('@napi-rs/canvas');

    const holder = options?.accountHolder || 'Rani Devi';
    const accNo = options?.accountNo || '6947759513';
    const ifsc = options?.ifsc || 'KKBK0004587';
    const start = options?.startDate || '01 Aug 2026';
    const end = options?.endDate || '31 Aug 2026';
    const openBal = options?.openingBalance ?? 50.64;
    const closeBal = options?.closingBalance ?? 10.64;

    const width = 1200;
    const height = 1600;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Clean white canvas background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#000000';
    ctx.font = 'bold 36px Arial, sans-serif';
    ctx.fillText('Kotak Mahindra Bank', 80, 100);

    ctx.font = 'bold 28px Arial, sans-serif';
    ctx.fillText('Account Statement', 80, 150);

    ctx.font = '26px Arial, sans-serif';
    ctx.fillText(`Customer Name: ${holder}`, 80, 200);
    ctx.fillText(`Account Number: ${accNo}`, 80, 245);
    ctx.fillText(`Account Type: SAVINGS`, 80, 290);
    ctx.fillText(`IFSC Code: ${ifsc}`, 80, 335);
    ctx.fillText(`Statement Period: ${start} - ${end}`, 80, 380);
    ctx.fillText(`Opening Balance: ${openBal.toFixed(2)}`, 80, 425);

    // Table Header
    ctx.font = 'bold 22px Arial, sans-serif';
    ctx.fillText('# Date Description Chq/Ref. No. Withdrawal (Dr.) Deposit (Cr.) Balance', 80, 490);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 505);
    ctx.lineTo(1120, 505);
    ctx.stroke();

    // Transaction rows
    ctx.font = '24px Arial, sans-serif';
    ctx.fillText('1 01 Aug 2026 UPI/SURAJ KUMAR/YESB/621234 40.00 10.64', 80, 550);
    ctx.fillText('Sent using P', 80, 585);

    // Account Summary block
    ctx.font = 'bold 26px Arial, sans-serif';
    ctx.fillText('Account Summary', 80, 700);
    ctx.font = '24px Arial, sans-serif';
    ctx.fillText(`Opening Balance = ${openBal.toFixed(2)}`, 80, 745);
    ctx.fillText(`Closing Balance = ${closeBal.toFixed(2)}`, 80, 790);

    const pngBuffer = canvas.toBuffer('image/png');

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 800]);
    const image = await pdfDoc.embedPng(pngBuffer);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: 600,
      height: 800,
    });

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  /**
   * Generates a hybrid PDF (Page 1 native text, Page 2 scanned image)
   */
  public static async createHybridBankStatementPdf(): Promise<Buffer> {
    const { createCanvas } = await import('@napi-rs/canvas');

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Page 1: Native text
    const page1 = pdfDoc.addPage([600, 800]);
    let y = 750;
    page1.drawText('HDFC BANK - ACCOUNT STATEMENT', { x: 50, y, size: 14, font: fontBold });
    y -= 25;
    page1.drawText('Customer Name: MR. RAJAT KUMAR SHARMA', { x: 50, y, size: 10, font });
    y -= 15;
    page1.drawText('Account Number: 50100234567891    IFSC: HDFC0001234', { x: 50, y, size: 10, font });
    y -= 15;
    page1.drawText('Statement Period: 01/08/2026 to 31/08/2026', { x: 50, y, size: 10, font });
    y -= 15;
    page1.drawText('Opening Balance: INR 1000.00', { x: 50, y, size: 10, font: fontBold });
    y -= 30;
    page1.drawText('Date | Description | Withdrawal | Deposit | Balance', { x: 50, y, size: 9, font: fontBold });
    y -= 15;
    page1.drawText('01/08/2026 UPI/P2M/Swiggy 200.00 800.00', { x: 50, y, size: 8, font });

    // Page 2: Scanned bitmap canvas
    const canvas = createCanvas(1200, 1600);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 1200, 1600);

    ctx.fillStyle = '#000000';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('HDFC Bank Statement - Page 2 Continued', 80, 100);
    ctx.font = '20px sans-serif';
    ctx.fillText('05/08/2026 UPI/Refund/Amazon 500.00 1300.00', 80, 200);
    ctx.fillText('Closing Balance = 1300.00', 80, 400);

    const pngBuffer = canvas.toBuffer('image/png');
    const page2 = pdfDoc.addPage([600, 800]);
    const image = await pdfDoc.embedPng(pngBuffer);
    page2.drawImage(image, { x: 0, y: 0, width: 600, height: 800 });

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }
}
