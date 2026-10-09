import 'dotenv/config'
import { Resend } from 'resend'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// Get current directory (needed for ES modules)
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const resend = new Resend(process.env.RESEND_API_KEY)

// For each branch worker, loop through this
const workerEmail = 'ceo@primeshieldhub.com'
const workerName = 'Emmanuel'
const branchName = 'Newton Main'
const amount = '30,000.00'
const paymentDate = '30 June 2026'
const transactionRef = 'PSH-June-2026-001'

// Read the receipt image and convert to base64
const receiptPath = join(__dirname, 'receipt.png')
const receiptBuffer = readFileSync(receiptPath)
const receiptBase64 = receiptBuffer.toString('base64')

const response = await resend.emails.send({
  from: 'PrimeShieldHub Payroll <alerts@primeshieldhub.com>',
  to: 'emmanuelot2boy@gmail.com',
  subject: `💰 Salary Disbursement: June 2026 – ${branchName} Branch`,
  html: `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
          background: #f0f2f5;
          padding: 20px;
          line-height: 1.6;
        }
        
        .container {
          max-width: 600px;
          margin: 0 auto;
          background: #ffffff;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 24px rgba(0,0,0,0.06);
        }
        
        /* HEADER */
        .header {
          background: linear-gradient(135deg, #0d1b2a 0%, #1b3a5c 100%);
          padding: 32px 36px 28px;
          color: #ffffff;
        }
        
        .logo {
          font-size: 20px;
          font-weight: 700;
          letter-spacing: -0.3px;
        }
        
        .logo span {
          color: #f0b429;
        }
        
        .header-sub {
          margin-top: 12px;
        }
        
        .greeting {
          font-size: 22px;
          font-weight: 600;
          color: #ffffff;
        }
        
        .greeting-sub {
          font-size: 13px;
          color: rgba(255,255,255,0.7);
          margin-top: 2px;
        }
        
        /* BODY */
        .body-content {
          padding: 28px 36px 20px;
        }
        
        .message {
          font-size: 14px;
          color: #1a1a2e;
          margin-bottom: 24px;
          line-height: 1.7;
        }
        
        /* PAYMENT CARD */
        .payment-card {
          background: #f8f9fc;
          border-radius: 12px;
          padding: 20px 24px;
          margin: 20px 0 16px;
          border: 1px solid #e8ecf2;
        }
        
        .payment-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          padding-bottom: 12px;
          border-bottom: 1px solid #e8ecf2;
        }
        
        .payment-header .title {
          font-size: 12px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #d1fae5;
          padding: 3px 12px;
          border-radius: 100px;
          font-size: 11px;
          font-weight: 600;
          color: #065f46;
        }
        
        .status-badge .dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #059669;
          display: inline-block;
        }
        
        .payment-row {
          display: flex;
          justify-content: space-between;
          padding: 5px 0;
          font-size: 13px;
        }
        
        .payment-row .label {
          color: #6b7280;
        }
        
        .payment-row .value {
          color: #1a1a2e;
          font-weight: 500;
        }
        
        .payment-row .value.ref {
          font-family: 'Courier New', monospace;
          font-size: 12px;
          font-weight: 400;
          color: #4b5563;
        }
        
        .amount-section {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          padding-top: 14px;
          margin-top: 10px;
          border-top: 2px solid #e8ecf2;
        }
        
        .amount-section .label {
          font-size: 13px;
          color: #6b7280;
        }
        
        .amount-section .amount {
          font-size: 32px;
          font-weight: 700;
          color: #0d1b2a;
        }
        
        .amount-section .currency {
          font-size: 18px;
          color: #0d1b2a;
          margin-right: 2px;
        }
        
        /* VERIFICATION */
        .verification {
          background: #f8f9fc;
          border-radius: 8px;
          padding: 12px 16px;
          margin: 16px 0 20px;
          border: 1px solid #e8ecf2;
        }
        
        .verification .label {
          font-size: 10px;
          font-weight: 600;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.8px;
        }
        
        .verification .ref {
          font-family: 'Courier New', monospace;
          font-size: 12px;
          color: #4b5563;
          margin-top: 2px;
        }
        
        .verification .status {
          font-size: 10px;
          color: #059669;
          font-weight: 600;
          letter-spacing: 0.5px;
        }
        
        /* RECEIPT ATTACHMENT */
        .receipt-box {
          display: flex;
          align-items: center;
          gap: 14px;
          background: #f0f7ff;
          border: 1px solid #dbeafe;
          border-radius: 10px;
          padding: 14px 18px;
          margin: 20px 0;
        }
        
        .receipt-box .icon {
          font-size: 22px;
        }
        
        .receipt-box .info {
          flex: 1;
        }
        
        .receipt-box .info .title {
          font-size: 13px;
          font-weight: 600;
          color: #1a1a2e;
        }
        
        .receipt-box .info .sub {
          font-size: 11px;
          color: #6b7280;
        }
        
        .receipt-box .badge {
          background: #dbeafe;
          padding: 3px 12px;
          border-radius: 100px;
          font-size: 10px;
          font-weight: 600;
          color: #1e40af;
        }
        
        /* SIGNATURE */
        .signature {
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid #e8ecf2;
        }
        
        .signature .name {
          font-size: 15px;
          font-weight: 600;
          color: #1a1a2e;
        }
        
        .signature .title {
          font-size: 12px;
          color: #6b7280;
        }
        
        .signature .links {
          margin-top: 4px;
        }
        
        .signature .links a {
          color: #1b3a5c;
          text-decoration: none;
          font-size: 12px;
          font-weight: 500;
        }
        
        .signature .links a:hover {
          text-decoration: underline;
        }
        
        .signature .links .sep {
          color: #d1d5db;
          margin: 0 8px;
        }
        
        /* FOOTER */
        .footer {
          background: #f8f9fc;
          padding: 18px 36px 22px;
          text-align: center;
          border-top: 1px solid #e8ecf2;
        }
        
        .footer .text {
          font-size: 11px;
          color: #9ca3af;
          line-height: 1.7;
        }
        
        .footer .text a {
          color: #6b7280;
          text-decoration: none;
        }
        
        .footer .text a:hover {
          color: #1b3a5c;
        }
        
        .footer .divider {
          width: 30px;
          height: 2px;
          background: #d1d5db;
          margin: 8px auto;
          border-radius: 2px;
        }
        
        /* MOBILE */
        @media (max-width: 480px) {
          .header { padding: 24px 20px; }
          .body-content { padding: 20px 20px 16px; }
          .footer { padding: 14px 20px 18px; }
          .greeting { font-size: 18px; }
          .amount-section .amount { font-size: 26px; }
          .payment-card { padding: 16px 18px; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- HEADER -->
        <div class="header">
          <div class="logo">PrimeShieldHub <span>Gadgets Ltd.</span></div>
          <div class="header-sub">
            <div class="greeting">Hello, ${workerName}</div>
            <div class="greeting-sub">Your salary has been processed successfully</div>
          </div>
        </div>
        
        <!-- BODY -->
        <div class="body-content">
          <div class="message">
            Your salary for <strong>June 2026</strong> has been disbursed to your registered bank account as of today, <strong>${paymentDate}</strong>.
          </div>
          
          <!-- PAYMENT CARD -->
          <div class="payment-card">
            <div class="payment-header">
              <span class="title">Payment Details</span>
              <span class="status-badge">
                <span class="dot"></span>
                Completed
              </span>
            </div>
            
            <div class="payment-row">
              <span class="label">Branch</span>
              <span class="value">${branchName}</span>
            </div>
            <div class="payment-row">
              <span class="label">Period</span>
              <span class="value">June 2026</span>
            </div>
            <div class="payment-row">
              <span class="label">Payment Date</span>
              <span class="value">${paymentDate}</span>
            </div>
            <div class="payment-row">
              <span class="label">Reference</span>
              <span class="value ref">${transactionRef}</span>
            </div>
            
            <div class="amount-section">
              <span class="label">Net Salary</span>
              <span>
                <span class="currency">₦</span>
                <span class="amount">${amount}</span>
              </span>
            </div>
          </div>
          
          <!-- VERIFICATION -->
          <div class="verification">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div>
                <div class="label">Transaction Verification</div>
                <div class="ref">ID: ${transactionRef.slice(0, 8)}...${transactionRef.slice(-4)}</div>
              </div>
              <span class="status">✓ VERIFIED</span>
            </div>
          </div>
          
          <!-- RECEIPT ATTACHMENT -->
          <div class="receipt-box">
            <span class="icon">📄</span>
            <div class="info">
              <div class="title">Payment Receipt Attached</div>
              <div class="sub">Salary_Receipt_June_2026.png</div>
            </div>
            <span class="badge">Attached</span>
          </div>
          
          <div style="font-size:13px;color:#4b5563;margin:16px 0 0;">
            We appreciate your continued dedication and professionalism at PrimeShieldHub Gadgets Ltd.
          </div>
          
          <!-- SIGNATURE -->
          <div class="signature">
            <div class="name">Management</div>
            <div class="title">PrimeShieldHub Gadgets Ltd.</div>
            <div class="links">
              <a href="https://www.primeshieldhub.com">www.primeshieldhub.com</a>
              <span class="sep">·</span>
              <a href="mailto:accounts@primeshieldhub.com">accounts@primeshieldhub.com</a>
            </div>
          </div>
        </div>
        
        <!-- FOOTER -->
        <div class="footer">
          <div class="divider"></div>
          <div class="text">
            Automated payroll notification from PrimeShieldHub Gadgets Ltd.<br>
            For inquiries, contact <a href="mailto:accounts@primeshieldhub.com">accounts@primeshieldhub.com</a>
          </div>
        </div>
      </div>
    </body>
    </html>
  `,
  attachments: [
    {
      filename: 'Salary_Receipt_June_2026.png',
      content: receiptBase64,
      content_type: 'image/png'
    }
  ]
})

console.log(response)
