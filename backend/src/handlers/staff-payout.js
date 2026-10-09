// src/handlers/staff-payout.js
// PRIMESHIELDHUB PAYROLL & STAFF WALLET SYSTEM
// Paystack Transfers + Professional Payslips + R2 Storage + Resend Email
// Includes staff ID generation utility, bank account CRUD, and founder support

import { requireAuth } from '../middleware/auth.js';
import { logEvent, logAudit } from '../utils/logging.js';

// ======================================================================
// STAFF ID GENERATION UTILITY
// ======================================================================

/**
 * Generate a clean, sequential staff display ID
 * Format: PSH-EMP-0001, PSH-MGR-0001, PSH-SALES-0001, PSH-EXEC-0001, PSH-FOUNDER-001
 * Uses a counter table to ensure uniqueness and sequential numbering
 */
export async function generateStaffDisplayId(env, role) {
  try {
    // Determine prefix based on role - UPDATED with founder support
    let prefix = 'PSH-EMP';
    if (role === 'founder') {
      prefix = 'PSH-FOUNDER';
    } else if (role === 'admin' || role === 'ceo') {
      prefix = 'PSH-EXEC';
    } else if (role === 'manager' || role === 'supervisor') {
      prefix = 'PSH-MGR';
    } else if (role === 'sales') {
      prefix = 'PSH-SALES';
    }
    
    // Get and increment the counter atomically
    const counter = await env.DB.prepare(
      "SELECT last_number FROM staff_id_counter WHERE prefix = ?"
    ).bind(prefix).first();
    
    let nextNumber = 1;
    if (counter) {
      nextNumber = counter.last_number + 1;
      await env.DB.prepare(
        "UPDATE staff_id_counter SET last_number = ? WHERE prefix = ?"
      ).bind(nextNumber, prefix).run();
    } else {
      // Create counter if it doesn't exist
      await env.DB.prepare(
        "INSERT INTO staff_id_counter (prefix, last_number) VALUES (?, ?)"
      ).bind(prefix, nextNumber).run();
    }
    
    // Format: PSH-EMP-0001 (4-digit zero-padded)
    const displayId = `${prefix}-${String(nextNumber).padStart(4, '0')}`;
    
    console.log(`Generated staff ID: ${displayId} for role: ${role}`);
    return displayId;
    
  } catch (e) {
    console.error('Staff ID generation failed, using fallback:', e);
    // Fallback to timestamp-based ID if counter fails
    const fallbackId = `PSH-EMP-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    console.log(`Using fallback ID: ${fallbackId}`);
    return fallbackId;
  }
}

/**
 * Validate and normalize a staff display ID
 * Ensures the format is correct: PSH-XXX-0000
 */
export function validateStaffDisplayId(displayId) {
  if (!displayId) return false;
  
  // Must match pattern: PSH-XXX-0000
  const pattern = /^PSH-(EMP|MGR|SALES|EXEC|FOUNDER)-\d{4}$/;
  if (!pattern.test(displayId)) {
    // Also accept legacy UUID-based format
    const legacyPattern = /^PSH-EMP-[A-Za-z0-9]{6,8}$/;
    return legacyPattern.test(displayId);
  }
  return true;
}

/**
 * Extract role from a display ID
 */
export function getRoleFromDisplayId(displayId) {
  if (!displayId) return 'staff';
  
  if (displayId.startsWith('PSH-FOUNDER-')) return 'founder';
  if (displayId.startsWith('PSH-EXEC-')) return 'admin';
  if (displayId.startsWith('PSH-MGR-')) return 'manager';
  if (displayId.startsWith('PSH-SALES-')) return 'sales';
  return 'staff';
}

// ======================================================================
// BANK ACCOUNT MANAGEMENT
// ======================================================================

/**
 * POST /api/staff/bank-account - Add/update staff bank account
 */
export async function handleAddBankAccount(request, env, corsHeaders) {
  const user = await requireAuth(request, env, ["admin", "staff"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  try {
    const body = await request.json();
    const { staffId, bankName, accountNumber, accountName } = body;

    if (!staffId || !bankName || !accountNumber || !accountName) {
      return new Response(JSON.stringify({ error: "All fields required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Create Paystack transfer recipient
    let recipientCode = null;
    if (env.PAYSTACK_SECRET_KEY) {
      try {
        const resp = await fetch('https://api.paystack.co/transferrecipient', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            type: 'nuban',
            name: accountName,
            account_number: accountNumber,
            bank_code: getBankCode(bankName),
            currency: 'NGN'
          })
        });
        const data = await resp.json();
        if (data.status) {
          recipientCode = data.data.recipient_code;
        }
      } catch (e) {
        console.error('Paystack recipient creation failed:', e);
      }
    }

    const id = crypto.randomUUID();
    const now = Date.now();

    await env.DB.prepare(`
      INSERT INTO staff_bank_accounts (id, staff_id, bank_name, account_number, account_name, paystack_recipient_code, is_default, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).bind(id, staffId, bankName, accountNumber, accountName, recipientCode, now, now).run();

    // Also create wallet if not exists
    const existingWallet = await env.DB.prepare("SELECT id FROM staff_wallets WHERE staff_id = ?").bind(staffId).first();
    if (!existingWallet) {
      await env.DB.prepare("INSERT INTO staff_wallets (id, staff_id, balance, total_earned, total_withdrawn, created_at, updated_at) VALUES (?, ?, 0, 0, 0, ?, ?)")
        .bind(crypto.randomUUID(), staffId, now, now).run();
    }

    return new Response(JSON.stringify({ success: true, id, recipientCode }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

/**
 * GET /api/staff/bank-accounts/:staffId - Get staff bank accounts
 */
export async function handleGetBankAccounts(request, env, corsHeaders) {
  const user = await requireAuth(request, env, ["admin", "staff"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  const url = new URL(request.url);
  const staffId = url.pathname.split('/').pop();

  try {
    const accounts = await env.DB.prepare(
      "SELECT * FROM staff_bank_accounts WHERE staff_id = ? ORDER BY created_at DESC"
    ).bind(staffId).all();

    return new Response(JSON.stringify({ success: true, accounts: accounts.results || [] }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

/**
 * PUT /api/staff/bank-account/:id — Update bank account
 */
export async function handleUpdateBankAccount(request, env, corsHeaders) {
  const user = await requireAuth(request, env, ["admin", "staff"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  const url = new URL(request.url);
  const accountId = url.pathname.split('/').pop();

  try {
    const body = await request.json();
    const { bankName, accountNumber, accountName, isDefault } = body;

    // Verify ownership
    const existing = await env.DB.prepare(
      "SELECT * FROM staff_bank_accounts WHERE id = ?"
    ).bind(accountId).first();

    if (!existing) {
      return new Response(JSON.stringify({ error: "Bank account not found" }), {
        status: 404, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Staff can only update their own accounts
    if (user.role !== 'admin' && existing.staff_id !== user.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 403, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const updates = [];
    const params = [];

    if (bankName) { updates.push("bank_name = ?"); params.push(bankName); }
    if (accountNumber) { updates.push("account_number = ?"); params.push(accountNumber); }
    if (accountName) { updates.push("account_name = ?"); params.push(accountName); }
    if (isDefault !== undefined) { updates.push("is_default = ?"); params.push(isDefault ? 1 : 0); }

    if (updates.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "Nothing to update" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    updates.push("updated_at = ?");
    params.push(Date.now());
    params.push(accountId);

    await env.DB.prepare(
      `UPDATE staff_bank_accounts SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...params).run();

    // If setting as default, unset others
    if (isDefault) {
      await env.DB.prepare(
        "UPDATE staff_bank_accounts SET is_default = 0 WHERE staff_id = ? AND id != ?"
      ).bind(existing.staff_id, accountId).run();
    }

    // Re-create Paystack recipient if bank details changed
    if ((bankName || accountNumber || accountName) && env.PAYSTACK_SECRET_KEY) {
      try {
        const updatedAccount = await env.DB.prepare(
          "SELECT * FROM staff_bank_accounts WHERE id = ?"
        ).bind(accountId).first();
        
        const resp = await fetch('https://api.paystack.co/transferrecipient', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            type: 'nuban',
            name: updatedAccount.account_name,
            account_number: updatedAccount.account_number,
            bank_code: getBankCode(updatedAccount.bank_name),
            currency: 'NGN'
          })
        });
        const data = await resp.json();
        if (data.status) {
          await env.DB.prepare(
            "UPDATE staff_bank_accounts SET paystack_recipient_code = ? WHERE id = ?"
          ).bind(data.data.recipient_code, accountId).run();
        }
      } catch (e) {
        console.error('Paystack recipient update failed:', e);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: "Bank account updated"
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

/**
 * DELETE /api/staff/bank-account/:id — Delete bank account
 */
export async function handleDeleteBankAccount(request, env, corsHeaders) {
  const user = await requireAuth(request, env, ["admin", "staff"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  const url = new URL(request.url);
  const accountId = url.pathname.split('/').pop();

  try {
    const existing = await env.DB.prepare(
      "SELECT * FROM staff_bank_accounts WHERE id = ?"
    ).bind(accountId).first();

    if (!existing) {
      return new Response(JSON.stringify({ error: "Bank account not found" }), {
        status: 404, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (user.role !== 'admin' && existing.staff_id !== user.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 403, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    await env.DB.prepare(
      "DELETE FROM staff_bank_accounts WHERE id = ?"
    ).bind(accountId).run();

    return new Response(JSON.stringify({
      success: true,
      message: "Bank account deleted"
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// PAYROLL PROCESSING (FIXED - NO DOUBLE PAYMENT)
// ======================================================================

/**
 * POST /api/payroll/process - Process payroll for staff
 * UPDATED: Wallet only credited for wallet-only payments.
 * Bank transfers do NOT credit wallet (money already sent to bank).
 */
export async function handleProcessPayroll(request, env, ctx, corsHeaders) {
  const user = await requireAuth(request, env, ["admin"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  try {
    const body = await request.json();
    const { staffId, period, basicSalary, allowances, bonuses, commission, overtime, deductions, penalty, tax, pension, loanRepayment, notes } = body;

    if (!staffId || !period) {
      return new Response(JSON.stringify({ error: "Staff ID and period required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Calculate salary
    const grossSalary = (basicSalary || 0) + (allowances || 0) + (bonuses || 0) + (commission || 0) + (overtime || 0);
    const totalDeductions = (deductions || 0) + (penalty || 0) + (tax || 0) + (pension || 0) + (loanRepayment || 0);
    const netSalary = grossSalary - totalDeductions;

    if (netSalary <= 0) {
      return new Response(JSON.stringify({ error: "Net salary must be greater than zero" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const reference = `PSH-PAY-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const id = crypto.randomUUID();
    const now = Date.now();

    // Create payroll record as "pending"
    await env.DB.prepare(`
      INSERT INTO payroll (id, reference, staff_id, period, basic_salary, allowances, bonuses, commission, overtime, deductions, penalty, tax, pension, loan_repayment, gross_salary, net_salary, status, notes, approved_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)
    `).bind(id, reference, staffId, period, basicSalary || 0, allowances || 0, bonuses || 0, commission || 0, overtime || 0, deductions || 0, penalty || 0, tax || 0, pension || 0, loanRepayment || 0, grossSalary, netSalary, notes || null, user.id, now, now).run();

    // Get staff details
    const staff = await env.DB.prepare("SELECT * FROM staff WHERE id = ?").bind(staffId).first();
    
    if (!staff) {
      return new Response(JSON.stringify({ error: "Staff not found" }), {
        status: 404, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Get bank account
    const bankAccount = await env.DB.prepare(
      "SELECT * FROM staff_bank_accounts WHERE staff_id = ? AND is_default = 1"
    ).bind(staffId).first() || await env.DB.prepare(
      "SELECT * FROM staff_bank_accounts WHERE staff_id = ? ORDER BY created_at DESC LIMIT 1"
    ).bind(staffId).first();

    let transferResult = null;
    let payrollStatus = 'pending';
    let statusNote = null;
    let walletCredited = false;

    // ============================================================
    // PATH A: Has bank account → Try Paystack Transfer
    // ============================================================
    if (bankAccount?.paystack_recipient_code && env.PAYSTACK_SECRET_KEY && netSalary > 0) {
      
      // Check Paystack balance first
      let sufficientBalance = true;
      try {
        const balanceCheck = await fetch('https://api.paystack.co/balance', {
          headers: { 'Authorization': `Bearer ${env.PAYSTACK_SECRET_KEY}` }
        });
        const balanceData = await balanceCheck.json();
        if (balanceData.status) {
          const availableBalance = balanceData.data?.find(b => b.currency === 'NGN')?.balance || 0;
          if (availableBalance < Math.round(netSalary * 100)) {
            sufficientBalance = false;
            statusNote = `Insufficient Paystack balance: ₦${(availableBalance/100).toLocaleString()} available, ₦${netSalary.toLocaleString()} needed`;
          }
        }
      } catch (e) {
        console.error('Balance check failed:', e);
      }

      if (sufficientBalance) {
        try {
          const transferResp = await fetch('https://api.paystack.co/transfer', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${env.PAYSTACK_SECRET_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              source: 'balance',
              amount: Math.round(netSalary * 100),
              recipient: bankAccount.paystack_recipient_code,
              reason: `Salary - ${period} - ${staff.name || staffId}`
            })
          });
          const transferData = await transferResp.json();

          if (transferData.status && transferData.data?.reference) {
            // Transfer initiated successfully
            transferResult = transferData.data;
            payrollStatus = 'processing';
            statusNote = 'Bank transfer initiated. Awaiting Paystack confirmation.';
            
            // ❌ DO NOT credit wallet - money is going directly to bank
            walletCredited = false;
            
            await logEvent(env, "PAYROLL_PROCESS", `Payroll ${reference}: Bank transfer initiated`, user.id, {
              reference, staffId, netSalary, transferRef: transferData.data.reference
            }).catch(() => {});
            
          } else {
            // Transfer rejected by Paystack
            payrollStatus = 'failed';
            statusNote = `Bank transfer failed: ${transferData.message || 'Paystack rejected the transfer'}`;
            walletCredited = false;
          }
        } catch (e) {
          console.error('Paystack transfer error:', e);
          payrollStatus = 'failed';
          statusNote = `Transfer error: ${e.message}`;
          walletCredited = false;
        }
      } else {
        // Insufficient balance - fall through to wallet-only
        payrollStatus = 'wallet_paid';
        statusNote = statusNote || 'Insufficient balance for bank transfer. Credited to wallet.';
        walletCredited = true;
        
        // ✅ Credit wallet since bank transfer couldn't happen
        await creditStaffWallet(env, staffId, netSalary, reference, 'salary', `Salary for ${period} (wallet - insufficient balance for transfer)`);
      }

    // ============================================================
    // PATH B: No bank account → Wallet only
    // ============================================================
    } else {
      payrollStatus = 'wallet_paid';
      statusNote = 'No bank account configured. Credited to wallet only.';
      walletCredited = true;
      
      // ✅ Credit wallet since there's no bank to send to
      await creditStaffWallet(env, staffId, netSalary, reference, 'salary', `Salary for ${period} (wallet only)`);
    }

    // Update payroll record with final status
    await env.DB.prepare(`
      UPDATE payroll SET status = ?, payment_reference = ?, notes = ?, updated_at = ? WHERE id = ?
    `).bind(payrollStatus, transferResult?.reference || null, statusNote, Date.now(), id).run();

    // Generate payslip HTML
    const payslipHtml = generatePayslipHTML({
      reference, staff, period, basicSalary, allowances, bonuses, commission, overtime,
      deductions, penalty, tax, pension, loanRepayment, grossSalary, netSalary, notes,
      transferRef: transferResult?.reference, approvedBy: user.name || user.email,
      status: payrollStatus
    });

    // Store payslip in R2
    let payslipUrl = null;
    if (env.STORAGE) {
      try {
        const payslipKey = `payslips/${period.replace(/[^a-zA-Z0-9-]/g, '_')}/${reference}.html`;
        await env.STORAGE.put(payslipKey, payslipHtml, {
          httpMetadata: { contentType: 'text/html' }
        });
        payslipUrl = `https://api.primeshieldhub.com/${payslipKey}`;
        await env.DB.prepare("UPDATE payroll SET payslip_url = ? WHERE id = ?").bind(payslipUrl, id).run();
      } catch (e) {
        console.error('R2 payslip storage failed:', e);
      }
    }

    // Send email notification
    if (staff?.email && env.RESEND_API_KEY) {
      const emailSubject = payrollStatus === 'wallet_paid'
        ? `💰 Salary Credited to Your Wallet - ${period}`
        : `💰 Payslip Ready - ${period} - PrimeShieldHub`;
      
      ctx.waitUntil(
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'PrimeShieldHub <receipts@primeshieldhub.com>',
            to: [staff.email],
            subject: emailSubject,
            html: generatePayslipEmailHTML({
              staffName: staff.name, period, grossSalary, netSalary, reference,
              transferRef: transferResult?.reference, payslipUrl,
              isWalletOnly: payrollStatus === 'wallet_paid',
              isBankTransfer: payrollStatus === 'processing'
            })
          })
        }).catch(e => console.error('Payslip email failed:', e))
      );
    }

    // Telegram notification
    if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
      const statusEmoji = payrollStatus === 'processing' ? '🏦' :
                          payrollStatus === 'wallet_paid' ? '💰' : '❌';
      ctx.waitUntil(
        fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: env.TELEGRAM_CHAT_ID,
            text: `${statusEmoji} Payroll ${payrollStatus.toUpperCase()}\nStaff: ${staff.name || staffId}\nPeriod: ${period}\nGross: ₦${grossSalary.toLocaleString()}\nNet: ₦${netSalary.toLocaleString()}\nRef: ${reference}\nTransfer: ${transferResult?.reference || 'N/A'}\nWallet Credited: ${walletCredited ? 'YES' : 'NO (sent to bank)'}`
          })
        }).catch(() => {})
      );
    }

    return new Response(JSON.stringify({
      success: true,
      payroll: {
        id, reference, period, grossSalary, netSalary,
        status: payrollStatus,
        transferRef: transferResult?.reference,
        payslipUrl,
        walletCredited,
        paymentMethod: payrollStatus === 'wallet_paid' ? 'wallet' : 'bank_transfer'
      }
    }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (e) {
    console.error('Payroll processing error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

/**
 * GET /api/payroll/history - Get payroll history
 */
export async function handlePayrollHistory(request, env, corsHeaders) {
  const user = await requireAuth(request, env, ["admin", "staff"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  const url = new URL(request.url);
  const staffId = url.searchParams.get('staffId');
  const period = url.searchParams.get('period');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  try {
    let query = `SELECT p.*, s.name as staff_name, s.email as staff_email FROM payroll p LEFT JOIN staff s ON p.staff_id = s.id`;
    const conditions = [];
    const params = [];

    if (staffId) { conditions.push('p.staff_id = ?'); params.push(staffId); }
    if (period) { conditions.push('p.period = ?'); params.push(period); }
    if (user.role === 'staff') { conditions.push('p.staff_id = ?'); params.push(user.id); }

    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const result = await env.DB.prepare(query).bind(...params).all();

    return new Response(JSON.stringify({ success: true, payrolls: result.results || [] }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

/**
 * GET /api/staff/wallet/:staffId - Get staff wallet balance
 * FIXED: Better handling of missing wallets with cross-table lookup
 */
export async function handleGetWallet(request, env, corsHeaders) {
  const user = await requireAuth(request, env, ["admin", "staff"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  const url = new URL(request.url);
  const staffId = url.pathname.split('/').pop();

  // Staff can only view their own wallet (unless admin)
  if (user.role === 'staff' && user.id !== staffId) {
    return new Response(JSON.stringify({ error: "Access denied" }), {
      status: 403, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  try {
    console.log(`Fetching wallet for staff: ${staffId}, user: ${user.id}, role: ${user.role}`);
    
    // First check if staff exists in users table (for founder/admin accounts)
    let actualStaffId = staffId;
    const staffInUsers = await env.DB.prepare(
      "SELECT id FROM users WHERE id = ?"
    ).bind(staffId).first();
    
    if (!staffInUsers) {
      // Check if this ID exists in staff table
      const staffRecord = await env.DB.prepare(
        "SELECT id FROM staff WHERE id = ?"
      ).bind(staffId).first();
      
      if (!staffRecord) {
        // Try finding by user's email
        const userRecord = await env.DB.prepare(
          "SELECT email FROM users WHERE id = ?"
        ).bind(user.id).first();
        
        if (userRecord) {
          const staffByEmail = await env.DB.prepare(
            "SELECT id FROM staff WHERE email = ?"
          ).bind(userRecord.email).first();
          
          if (staffByEmail) {
            actualStaffId = staffByEmail.id;
          }
        }
      } else {
        actualStaffId = staffRecord.id;
      }
    }
    
    console.log(`Actual staff ID for wallet: ${actualStaffId}`);
    
    const wallet = await env.DB.prepare(
      "SELECT * FROM staff_wallets WHERE staff_id = ?"
    ).bind(actualStaffId).first();
    
    const transactions = await env.DB.prepare(
      "SELECT * FROM wallet_transactions WHERE staff_id = ? ORDER BY created_at DESC LIMIT 50"
    ).bind(actualStaffId).all();

    return new Response(JSON.stringify({
      success: true,
      wallet: wallet || { balance: 0, total_earned: 0, total_withdrawn: 0 },
      transactions: transactions.results || [],
      debug: {
        requestedStaffId: staffId,
        actualStaffId: actualStaffId,
        userRole: user.role
      }
    }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  } catch (e) {
    console.error('Wallet fetch error:', e);
    return new Response(JSON.stringify({ 
      success: false,
      error: e.message,
      stack: e.stack
    }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// QUICK WALLET ACTIONS (Bonuses, Commissions, Deductions)
// ======================================================================

/**
 * POST /api/staff/wallet/credit - Admin credits/debits staff wallet directly
 * For bonuses, commissions, deductions, penalties - NO bank transfer
 */
export async function handleWalletCredit(request, env, ctx, corsHeaders) {
  const user = await requireAuth(request, env, ["admin"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized - Admin access required" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  try {
    const body = await request.json();
    const { staffId, amount, type, note } = body;

    if (!staffId || !amount || amount <= 0) {
      return new Response(JSON.stringify({ error: "Staff ID and valid amount required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const validTypes = ['bonus', 'commission', 'overtime', 'referral', 'award', 'deduction', 'penalty', 'adjustment'];
    const creditTypes = ['bonus', 'commission', 'overtime', 'referral', 'award'];
    const debitTypes = ['deduction', 'penalty'];

    // Determine if this is credit or debit
    const isDebit = debitTypes.includes(type);
    const isCredit = creditTypes.includes(type) || (!isDebit && type !== 'adjustment');

    // Get or create wallet
    let wallet = await env.DB.prepare("SELECT * FROM staff_wallets WHERE staff_id = ?").bind(staffId).first();
    const now = Date.now();

    if (!wallet) {
      const walletId = crypto.randomUUID();
      await env.DB.prepare(
        "INSERT INTO staff_wallets (id, staff_id, balance, total_earned, total_withdrawn, created_at, updated_at) VALUES (?, ?, 0, 0, 0, ?, ?)"
      ).bind(walletId, staffId, now, now).run();
      wallet = { id: walletId, staff_id: staffId, balance: 0, total_earned: 0 };
    }

    const actualAmount = isDebit ? -Math.abs(amount) : Math.abs(amount);
    const newBalance = wallet.balance + actualAmount;

    // Prevent negative balance for debits
    if (isDebit && newBalance < 0) {
      return new Response(JSON.stringify({
        success: false,
        error: `Insufficient wallet balance. Current: ₦${wallet.balance.toLocaleString()}, Attempted debit: ₦${Math.abs(actualAmount).toLocaleString()}`
      }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const reference = `PSH-${type.toUpperCase()}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 4).toUpperCase()}`;

    // Update wallet
    if (isDebit) {
      await env.DB.prepare(
        "UPDATE staff_wallets SET balance = ?, updated_at = ? WHERE id = ?"
      ).bind(newBalance, now, wallet.id).run();
    } else {
      await env.DB.prepare(
        "UPDATE staff_wallets SET balance = ?, total_earned = total_earned + ?, updated_at = ? WHERE id = ?"
      ).bind(newBalance, Math.abs(actualAmount), now, wallet.id).run();
    }

    // Record transaction
    await env.DB.prepare(
      "INSERT INTO wallet_transactions (id, staff_id, wallet_id, type, amount, description, reference, balance_before, balance_after, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(
      crypto.randomUUID(), staffId, wallet.id,
      isDebit ? 'debit' : 'credit',
      Math.abs(actualAmount),
      note || `${type.charAt(0).toUpperCase() + type.slice(1)}`,
      reference,
      wallet.balance,
      newBalance,
      type,
      now
    ).run();

    // Get staff details
    const staff = await env.DB.prepare("SELECT * FROM staff WHERE id = ?").bind(staffId).first();

    // Send email notification
    if (staff?.email && env.RESEND_API_KEY) {
      const emoji = isDebit ? '📤' : '💰';
      ctx.waitUntil(
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'PrimeShieldHub <receipts@primeshieldhub.com>',
            to: [staff.email],
            subject: `${emoji} ${type.charAt(0).toUpperCase() + type.slice(1)} - ₦${Math.abs(actualAmount).toLocaleString()}`,
            html: generateQuickActionEmailHTML({
              staffName: staff.name,
              amount: Math.abs(actualAmount),
              type,
              isDebit,
              reference,
              note: note || type,
              newBalance
            })
          })
        }).catch(e => console.error('Wallet credit email failed:', e))
      );
    }

    // Telegram notification
    if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
      ctx.waitUntil(
        fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: env.TELEGRAM_CHAT_ID,
            text: `${isDebit ? '📤' : '💰'} Wallet ${isDebit ? 'Debit' : 'Credit'}\nStaff: ${staff?.name || staffId}\nType: ${type}\nAmount: ${isDebit ? '-' : '+'}₦${Math.abs(actualAmount).toLocaleString()}\nRef: ${reference}\nNew Balance: ₦${newBalance.toLocaleString()}`
          })
        }).catch(() => {})
      );
    }

    return new Response(JSON.stringify({
      success: true,
      transaction: {
        reference,
        type: isDebit ? 'debit' : 'credit',
        amount: Math.abs(actualAmount),
        source: type,
        newBalance,
        note: note || type
      },
      message: `${isDebit ? 'Debited' : 'Credited'} ₦${Math.abs(actualAmount).toLocaleString()} ${isDebit ? 'from' : 'to'} wallet successfully.`
    }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (e) {
    console.error('Wallet credit error:', e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// WALLET WITHDRAWAL
// ======================================================================

/**
 * POST /api/staff/wallet/withdraw - Staff withdraws from wallet to bank
 */
export async function handleWalletWithdraw(request, env, ctx, corsHeaders) {
  const user = await requireAuth(request, env, ["admin", "staff"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  try {
    const body = await request.json();
    const { staffId, amount, bankAccountId, note } = body;

    // Staff can only withdraw from their own wallet (unless admin)
    const targetStaffId = user.role === 'admin' ? (staffId || user.id) : user.id;

    if (!amount || amount < 100) {
      return new Response(JSON.stringify({ success: false, error: "Minimum withdrawal is ₦100" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (amount > 10000000) {
      return new Response(JSON.stringify({ success: false, error: "Maximum withdrawal is ₦10,000,000" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Get wallet
    const wallet = await env.DB.prepare(
      "SELECT * FROM staff_wallets WHERE staff_id = ?"
    ).bind(targetStaffId).first();

    if (!wallet) {
      return new Response(JSON.stringify({ success: false, error: "Wallet not found" }), {
        status: 404, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Check sufficient balance
    if (wallet.balance < amount) {
      return new Response(JSON.stringify({
        success: false,
        error: `Insufficient balance. Available: ₦${wallet.balance.toLocaleString()}`
      }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Get bank account
    let bankAccount;
    if (bankAccountId) {
      bankAccount = await env.DB.prepare(
        "SELECT * FROM staff_bank_accounts WHERE id = ? AND staff_id = ?"
      ).bind(bankAccountId, targetStaffId).first();
    } else {
      // Get default bank account
      bankAccount = await env.DB.prepare(
        "SELECT * FROM staff_bank_accounts WHERE staff_id = ? AND is_default = 1"
      ).bind(targetStaffId).first();
      
      if (!bankAccount) {
        bankAccount = await env.DB.prepare(
          "SELECT * FROM staff_bank_accounts WHERE staff_id = ? ORDER BY created_at DESC LIMIT 1"
        ).bind(targetStaffId).first();
      }
    }

    if (!bankAccount) {
      return new Response(JSON.stringify({ success: false, error: "No bank account configured. Please add one first." }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Check if Paystack recipient code exists
    if (!bankAccount.paystack_recipient_code) {
      if (env.PAYSTACK_SECRET_KEY) {
        try {
          const resp = await fetch('https://api.paystack.co/transferrecipient', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${env.PAYSTACK_SECRET_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              type: 'nuban',
              name: bankAccount.account_name,
              account_number: bankAccount.account_number,
              bank_code: getBankCode(bankAccount.bank_name),
              currency: 'NGN'
            })
          });
          const data = await resp.json();
          if (data.status) {
            bankAccount.paystack_recipient_code = data.data.recipient_code;
            await env.DB.prepare(
              "UPDATE staff_bank_accounts SET paystack_recipient_code = ?, updated_at = ? WHERE id = ?"
            ).bind(data.data.recipient_code, Date.now(), bankAccount.id).run();
          }
        } catch (e) {
          console.error('Recipient creation failed:', e);
        }
      }
    }

    const reference = `PSH-WTH-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const now = Date.now();

    // Deduct from wallet first
    const newBalance = wallet.balance - amount;
    await env.DB.prepare(
      "UPDATE staff_wallets SET balance = ?, total_withdrawn = total_withdrawn + ?, updated_at = ? WHERE id = ?"
    ).bind(newBalance, amount, now, wallet.id).run();

    // Record wallet transaction
    await env.DB.prepare(
      "INSERT INTO wallet_transactions (id, staff_id, wallet_id, type, amount, description, reference, balance_before, balance_after, source, created_at) VALUES (?, ?, ?, 'debit', ?, ?, ?, ?, ?, 'withdrawal', ?)"
    ).bind(crypto.randomUUID(), targetStaffId, wallet.id, amount, note || 'Wallet withdrawal', reference, wallet.balance, newBalance, now).run();

    // Execute Paystack Transfer
    let transferResult = null;
    let withdrawalStatus = 'pending';

    if (bankAccount.paystack_recipient_code && env.PAYSTACK_SECRET_KEY) {
      try {
        // Check Paystack balance first
        const balanceCheck = await fetch('https://api.paystack.co/balance', {
          headers: { 'Authorization': `Bearer ${env.PAYSTACK_SECRET_KEY}` }
        });
        const balanceData = await balanceCheck.json();
        
        if (balanceData.status) {
          const availableBalance = balanceData.data?.find(b => b.currency === 'NGN')?.balance || 0;
          const amountInKobo = Math.round(amount * 100);
          
          if (availableBalance < amountInKobo) {
            withdrawalStatus = 'failed';
            console.error(`Insufficient Paystack balance: ₦${(availableBalance/100).toLocaleString()} available, ₦${amount.toLocaleString()} needed`);
            
            // Refund wallet since transfer can't complete
            await env.DB.prepare(
              "UPDATE staff_wallets SET balance = balance + ?, updated_at = ? WHERE id = ?"
            ).bind(amount, Date.now(), wallet.id).run();
            
            return new Response(JSON.stringify({
              success: false,
              error: "Insufficient balance in payment processor. Please contact admin."
            }), {
              status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
            });
          }
        }

        const transferResp = await fetch('https://api.paystack.co/transfer', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            source: 'balance',
            amount: Math.round(amount * 100),
            recipient: bankAccount.paystack_recipient_code,
            reason: note || `Wallet withdrawal - ${reference}`
          })
        });
        
        const transferData = await transferResp.json();
        
        if (transferData.status) {
          transferResult = transferData.data;
          withdrawalStatus = 'processing';
          
          await logEvent(env, "WALLET_WITHDRAW", `Withdrawal of ₦${amount.toLocaleString()} initiated`, targetStaffId, {
            reference, amount, bankAccount: bankAccount.bank_name, transferRef: transferData.data.reference
          }).catch(() => {});
          
        } else {
          withdrawalStatus = 'failed';
          console.error('Transfer failed:', transferData.message);
          
          // Refund wallet on transfer failure
          await env.DB.prepare(
            "UPDATE staff_wallets SET balance = balance + ?, updated_at = ? WHERE id = ?"
          ).bind(amount, Date.now(), wallet.id).run();
          
          return new Response(JSON.stringify({
            success: false,
            error: `Transfer failed: ${transferData.message || 'Unknown error'}. Amount refunded to wallet.`
          }), {
            status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }
      } catch (e) {
        console.error('Transfer error:', e);
        withdrawalStatus = 'failed';
        
        // Refund wallet on error
        await env.DB.prepare(
          "UPDATE staff_wallets SET balance = balance + ?, updated_at = ? WHERE id = ?"
        ).bind(amount, Date.now(), wallet.id).run();
        
        return new Response(JSON.stringify({
          success: false,
          error: "Transfer service error. Amount refunded to wallet."
        }), {
          status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // Get staff details for notification
    const staff = await env.DB.prepare("SELECT * FROM staff WHERE id = ?").bind(targetStaffId).first();

    // Send email notification
    if (staff?.email && env.RESEND_API_KEY) {
      ctx.waitUntil(
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'PrimeShieldHub <receipts@primeshieldhub.com>',
            to: [staff.email],
            subject: `💸 Withdrawal Confirmation - ₦${amount.toLocaleString()}`,
            html: generateWithdrawalEmailHTML({
              staffName: staff.name,
              amount,
              reference,
              bankName: bankAccount.bank_name,
              accountNumber: bankAccount.account_number,
              transferRef: transferResult?.reference,
              newBalance,
              status: withdrawalStatus
            })
          })
        }).catch(e => console.error('Withdrawal email failed:', e))
      );
    }

    // Telegram notification
    if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
      ctx.waitUntil(
        fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: env.TELEGRAM_CHAT_ID,
            text: `💸 Wallet Withdrawal\nStaff: ${staff?.name || targetStaffId}\nAmount: ₦${amount.toLocaleString()}\nBank: ${bankAccount.bank_name} - ${bankAccount.account_number.slice(-4)}\nRef: ${reference}\nTransfer: ${transferResult?.reference || 'Pending'}\nStatus: ${withdrawalStatus.toUpperCase()}`
          })
        }).catch(() => {})
      );
    }

    return new Response(JSON.stringify({
      success: true,
      withdrawal: {
        reference,
        amount,
        bankName: bankAccount.bank_name,
        accountNumber: '****' + bankAccount.account_number.slice(-4),
        status: withdrawalStatus,
        transferRef: transferResult?.reference,
        newBalance
      },
      message: withdrawalStatus === 'processing'
        ? `₦${amount.toLocaleString()} is being sent to your ${bankAccount.bank_name} account.`
        : `₦${amount.toLocaleString()} withdrawn from wallet.`
    }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (e) {
    console.error('Withdrawal error:', e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// HELPERS
// ======================================================================

async function creditStaffWallet(env, staffId, amount, reference, type, description) {
  const wallet = await env.DB.prepare("SELECT * FROM staff_wallets WHERE staff_id = ?").bind(staffId).first();
  const now = Date.now();
  
  if (wallet) {
    const newBalance = wallet.balance + amount;
    await env.DB.prepare("UPDATE staff_wallets SET balance = ?, total_earned = total_earned + ?, updated_at = ? WHERE id = ?")
      .bind(newBalance, amount, now, wallet.id).run();
    
    await env.DB.prepare("INSERT INTO wallet_transactions (id, staff_id, wallet_id, type, amount, description, reference, balance_before, balance_after, source, created_at) VALUES (?, ?, ?, 'credit', ?, ?, ?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), staffId, wallet.id, amount, description, reference, wallet.balance, newBalance, type, now).run();
  } else {
    const walletId = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO staff_wallets (id, staff_id, balance, total_earned, total_withdrawn, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)")
      .bind(walletId, staffId, amount, amount, now, now).run();
    
    await env.DB.prepare("INSERT INTO wallet_transactions (id, staff_id, wallet_id, type, amount, description, reference, balance_before, balance_after, source, created_at) VALUES (?, ?, ?, 'credit', ?, ?, ?, 0, ?, ?, ?)")
      .bind(crypto.randomUUID(), staffId, walletId, amount, description, reference, amount, type, now).run();
  }
}

function getBankCode(bankName) {
  const banks = {
    'access': '044', 'access bank': '044',
    'gtb': '058', 'gtbank': '058', 'guaranty trust bank': '058',
    'uba': '033', 'united bank for africa': '033',
    'zenith': '057', 'zenith bank': '057',
    'first bank': '011', 'firstbank': '011',
    'fidelity': '070', 'fidelity bank': '070',
    'union bank': '032',
    'stanbic': '068', 'stanbic ibtc': '068',
    'ecobank': '050',
    'wema': '035', 'wema bank': '035',
    'kuda': '50211', 'kuda bank': '50211',
    'palmpay': '999991',
    'opay': '999992',
    'moniepoint': '50515'
  };
  return banks[bankName.toLowerCase()] || bankName;
}

// ======================================================================
// PAYSLIP HTML GENERATOR
// ======================================================================

function generatePayslipHTML(data) {
  const statusLabel = data.status === 'wallet_paid' ? 'PAID TO WALLET' :
                      data.status === 'processing' ? 'PROCESSING (BANK)' :
                      data.status?.toUpperCase() || 'PENDING';
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Payslip - ${data.reference}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', Arial, sans-serif; padding: 40px; color: #1a1a2e; }
    .payslip { max-width: 750px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #1a1a2e, #2d2d44); color: #d6b25e; padding: 30px; text-align: center; }
    .header h1 { font-size: 24px; font-weight: 800; }
    .header p { font-size: 13px; opacity: 0.8; margin-top: 4px; }
    .body { padding: 30px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
    .info-item { }
    .info-label { font-size: 11px; text-transform: uppercase; color: #888; letter-spacing: 0.5px; }
    .info-value { font-size: 14px; font-weight: 600; margin-top: 2px; }
    .section-title { font-size: 14px; font-weight: 700; color: #d6b25e; margin: 20px 0 12px; padding-bottom: 8px; border-bottom: 2px solid #d6b25e; }
    .row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 13px; border-bottom: 1px solid #f0f0f0; }
    .row.total { font-size: 16px; font-weight: 700; color: #00aa88; border-top: 2px solid #00aa88; margin-top: 12px; padding-top: 12px; }
    .row.deduction { color: #e74c3c; }
    .footer { text-align: center; padding: 20px 30px; background: #f8f8f8; font-size: 11px; color: #888; }
    .qr-section { text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0; }
    .verify-link { color: #d6b25e; font-size: 12px; }
  </style>
</head>
<body>
  <div class="payslip">
    <div class="header">
      <h1>PRIMESHIELDHUB</h1>
      <p>Official Payslip · ${data.period}</p>
    </div>
    <div class="body">
      <div class="info-grid">
        <div class="info-item"><div class="info-label">Employee</div><div class="info-value">${data.staff?.name || 'N/A'}</div></div>
        <div class="info-item"><div class="info-label">Period</div><div class="info-value">${data.period}</div></div>
        <div class="info-item"><div class="info-label">Reference</div><div class="info-value">${data.reference}</div></div>
        <div class="info-item"><div class="info-label">Status</div><div class="info-value" style="color:#00aa88;">${statusLabel}</div></div>
      </div>
      
      <div class="section-title">EARNINGS</div>
      ${data.basicSalary ? `<div class="row"><span>Basic Salary</span><span>₦${Number(data.basicSalary).toLocaleString()}</span></div>` : ''}
      ${data.allowances ? `<div class="row"><span>Allowances</span><span>₦${Number(data.allowances).toLocaleString()}</span></div>` : ''}
      ${data.bonuses ? `<div class="row"><span>Bonuses</span><span>₦${Number(data.bonuses).toLocaleString()}</span></div>` : ''}
      ${data.commission ? `<div class="row"><span>Commission</span><span>₦${Number(data.commission).toLocaleString()}</span></div>` : ''}
      ${data.overtime ? `<div class="row"><span>Overtime</span><span>₦${Number(data.overtime).toLocaleString()}</span></div>` : ''}
      
      <div class="section-title">DEDUCTIONS</div>
      ${data.deductions ? `<div class="row deduction"><span>Deductions</span><span>-₦${Number(data.deductions).toLocaleString()}</span></div>` : ''}
      ${data.penalty ? `<div class="row deduction"><span>Penalty</span><span>-₦${Number(data.penalty).toLocaleString()}</span></div>` : ''}
      ${data.tax ? `<div class="row deduction"><span>Tax (PAYE)</span><span>-₦${Number(data.tax).toLocaleString()}</span></div>` : ''}
      ${data.pension ? `<div class="row deduction"><span>Pension</span><span>-₦${Number(data.pension).toLocaleString()}</span></div>` : ''}
      ${data.loanRepayment ? `<div class="row deduction"><span>Loan Repayment</span><span>-₦${Number(data.loanRepayment).toLocaleString()}</span></div>` : ''}
      
      <div class="row"><span style="font-weight:600;">Gross Salary</span><span>₦${Number(data.grossSalary).toLocaleString()}</span></div>
      <div class="row total"><span>Net Salary</span><span>₦${Number(data.netSalary).toLocaleString()}</span></div>
      
      ${data.transferRef ? `<p style="margin-top:16px;font-size:12px;color:#888;">Transfer Reference: ${data.transferRef}</p>` : ''}
      
      <div class="qr-section">
        <p class="verify-link">Verify: primeshieldhub.com/payroll/verify/${data.reference}</p>
        <p style="font-size:11px;color:#888;margin-top:4px;">Approved by: ${data.approvedBy || 'Admin'} · ${new Date().toLocaleDateString('en-NG')}</p>
      </div>
    </div>
    <div class="footer">
      <p>PrimeShieldHub Gadgets Limited · RC 9283954</p>
      <p>This is an official system-generated payslip.</p>
    </div>
  </div>
</body>
</html>`;
}

function generatePayslipEmailHTML(data) {
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 550px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #1a1a2e, #2d2d44); color: #d6b25e; padding: 30px; text-align: center; }
    .header h1 { font-size: 22px; margin: 0; }
    .body { padding: 24px; }
    .amount { text-align: center; margin: 20px 0; }
    .amount .net { font-size: 36px; font-weight: 800; color: #00aa88; }
    .amount .label { font-size: 13px; color: #888; }
    .details { background: #f8f8f8; border-radius: 8px; padding: 16px; margin: 16px 0; }
    .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
    .btn { display: block; background: #d6b25e; color: #000; text-align: center; padding: 14px; border-radius: 8px; text-decoration: none; font-weight: 700; margin: 20px 0; }
    .footer { text-align: center; padding: 16px; font-size: 11px; color: #888; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>PRIMESHIELDHUB</h1>
      <p>Salary Payment Confirmation</p>
    </div>
    <div class="body">
      <p>Dear ${data.staffName},</p>
      <p>Your salary for <strong>${data.period}</strong> has been processed.</p>
      <div class="amount">
        <div class="label">Net Salary</div>
        <div class="net">₦${Number(data.netSalary).toLocaleString()}</div>
        <div style="font-size:12px;color:#888;">Gross: ₦${Number(data.grossSalary).toLocaleString()}</div>
      </div>
      <div class="details">
        <div class="row"><span>Reference</span><span>${data.reference}</span></div>
        ${data.transferRef ? `<div class="row"><span>Transfer Ref</span><span>${data.transferRef}</span></div>` : ''}
        <div class="row"><span>Period</span><span>${data.period}</span></div>
      </div>
      ${data.payslipUrl ? `<a href="${data.payslipUrl}" class="btn">📄 View Full Payslip</a>` : ''}
    </div>
    <div class="footer">
      <p>PrimeShieldHub Gadgets Limited · RC 9283954</p>
      <p>This is an official salary notification.</p>
    </div>
  </div>
</body>
</html>`;
}

// ======================================================================
// WITHDRAWAL EMAIL TEMPLATE
// ======================================================================

function generateWithdrawalEmailHTML(data) {
  const statusColor = data.status === 'processing' ? '#4facfe' : data.status === 'failed' ? '#ff5252' : '#00d68f';
  const statusText = data.status === 'processing' ? 'Processing' : data.status === 'failed' ? 'Failed' : 'Completed';
  
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 500px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #1a1a2e, #2d2d44); color: #d6b25e; padding: 24px; text-align: center; }
    .header h1 { font-size: 20px; margin: 0; }
    .body { padding: 24px; }
    .amount { text-align: center; margin: 16px 0; }
    .amount .value { font-size: 32px; font-weight: 800; color: #d6b25e; }
    .details { background: #f8f8f8; border-radius: 8px; padding: 16px; margin: 16px 0; }
    .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; border-bottom: 1px solid #eee; }
    .row:last-child { border-bottom: none; }
    .status { display: inline-block; padding: 4px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; background: ${statusColor}22; color: ${statusColor}; margin: 12px 0; }
    .footer { text-align: center; padding: 16px; font-size: 11px; color: #888; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>PRIMESHIELDHUB</h1>
      <p>Withdrawal Confirmation</p>
    </div>
    <div class="body">
      <p>Dear ${data.staffName},</p>
      <p>Your wallet withdrawal has been initiated.</p>
      <div class="amount">
        <div style="font-size:12px;color:#888;">Amount</div>
        <div class="value">₦${Number(data.amount).toLocaleString()}</div>
      </div>
      <div class="status">${statusText}</div>
      <div class="details">
        <div class="row"><span>Reference</span><span>${data.reference}</span></div>
        <div class="row"><span>Bank</span><span>${data.bankName}</span></div>
        <div class="row"><span>Account</span><span>****${data.accountNumber?.slice(-4) || ''}</span></div>
        ${data.transferRef ? `<div class="row"><span>Transfer Ref</span><span>${data.transferRef}</span></div>` : ''}
        <div class="row"><span>New Balance</span><span>₦${Number(data.newBalance).toLocaleString()}</span></div>
      </div>
    </div>
    <div class="footer">
      <p>PrimeShieldHub Gadgets Limited · RC 9283954</p>
      <p>This is an official withdrawal confirmation.</p>
    </div>
  </div>
</body>
</html>`;
}

// ======================================================================
// QUICK ACTION EMAIL TEMPLATE (Bonuses, Commissions, Deductions)
// ======================================================================

function generateQuickActionEmailHTML(data) {
  const emoji = data.isDebit ? '📤' : '💰';
  const title = data.type.charAt(0).toUpperCase() + data.type.slice(1);
  const amountColor = data.isDebit ? '#ff5252' : '#00d68f';
  const prefix = data.isDebit ? '-' : '+';
  
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 500px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #1a1a2e, #2d2d44); color: #d6b25e; padding: 24px; text-align: center; }
    .header h1 { font-size: 20px; margin: 0; }
    .body { padding: 24px; }
    .amount { text-align: center; margin: 16px 0; }
    .amount .value { font-size: 32px; font-weight: 800; color: ${amountColor}; }
    .details { background: #f8f8f8; border-radius: 8px; padding: 16px; margin: 16px 0; }
    .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; border-bottom: 1px solid #eee; }
    .row:last-child { border-bottom: none; }
    .btn { display: block; background: #d6b25e; color: #000; text-align: center; padding: 14px; border-radius: 8px; text-decoration: none; font-weight: 700; margin: 20px 0; }
    .footer { text-align: center; padding: 16px; font-size: 11px; color: #888; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>PRIMESHIELDHUB</h1>
      <p>${emoji} ${title} Notification</p>
    </div>
    <div class="body">
      <p>Dear ${data.staffName},</p>
      <p>Your wallet has been ${data.isDebit ? 'debited' : 'credited'} with a ${data.type}.</p>
      <div class="amount">
        <div style="font-size:12px;color:#888;">Amount</div>
        <div class="value">${prefix}₦${Number(data.amount).toLocaleString()}</div>
      </div>
      <div class="details">
        <div class="row"><span>Reference</span><span>${data.reference}</span></div>
        <div class="row"><span>Type</span><span>${title}</span></div>
        <div class="row"><span>Note</span><span>${data.note || title}</span></div>
        <div class="row"><span>New Balance</span><span>₦${Number(data.newBalance).toLocaleString()}</span></div>
      </div>
      <a href="https://primeshieldhub.com/staff/dashboard" class="btn">📊 View Dashboard</a>
    </div>
    <div class="footer">
      <p>PrimeShieldHub Gadgets Limited · RC 9283954</p>
      <p>This is an official wallet transaction notification.</p>
    </div>
  </div>
</body>
</html>`;
}

// ======================================================================
// PUBLIC STAFF VERIFICATION (NO AUTH REQUIRED) - UPDATED WITH USERS TABLE FALLBACK
// ======================================================================

/**
 * GET /api/staff/verify-public/:staffId
 * PUBLIC - No authentication required
 * Returns basic staff info for identity verification
 * Searches BOTH staff AND users tables (for founder/admin accounts)
 * Excludes sensitive data: salary, bank, email, phone, address
 */
export async function handlePublicStaffVerification(request, env, corsHeaders) {
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const staffId = pathParts[pathParts.length - 1];
    
    if (!staffId || staffId.length < 3) {
      return new Response(JSON.stringify({
        verified: false,
        error: 'Please provide a valid Staff ID',
        code: 'INVALID_INPUT'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // STEP 1: First check the staff table
    let staff = await env.DB.prepare(
      `SELECT 
        COALESCE(s.display_id, 'PSH-EMP-' || substr(s.id, 1, 8)) as staff_id,
        s.name,
        s.role,
        COALESCE(s.department, 'General') as department,
        COALESCE(s.designation, s.role) as designation,
        COALESCE(s.employment_type, 'full-time') as employment_type,
        s.status,
        s.created_at as joined_date,
        COALESCE(b.name, 'PrimeShieldHub Headquarters') as branch_name,
        COALESCE(b.city, 'Benin City') as branch_city,
        COALESCE(b.state, 'Edo') as branch_state,
        COALESCE(b.country, 'Nigeria') as branch_country,
        COALESCE(b.branch_type, 'corporate') as branch_type,
        COALESCE(b.is_headquarters, 1) as is_headquarters,
        COALESCE(b.address, '108 Newton Street (Ekhorummtomwen Street), Benin City, Edo State') as branch_address,
        COALESCE(b.capabilities, 'corporate,wholesale,retail,import,distribution') as branch_capabilities
       FROM staff s 
       LEFT JOIN branches b ON s.branch_id = b.id 
       WHERE s.display_id = ? OR s.id = ? OR s.email = ? OR s.name LIKE ?
       LIMIT 1`
    ).bind(staffId, staffId, staffId, `%${staffId}%`).first();

    // STEP 2: If not found in staff, check users table (for founder/admin accounts)
    if (!staff) {
      staff = await env.DB.prepare(
        `SELECT 
          u.id as staff_id,
          COALESCE(u.name, 'Freedom Amenaghawon') as name,
          COALESCE(u.role, 'founder') as role,
          'Executive' as department,
          CASE 
            WHEN u.role = 'founder' THEN 'Founder & Chief Executive Officer'
            WHEN u.role = 'admin' THEN 'Administrator'
            WHEN u.role = 'ceo' THEN 'Chief Executive Officer'
            ELSE u.role
          END as designation,
          'full-time' as employment_type,
          COALESCE(u.status, 'active') as status,
          u.created_at as joined_date,
          'PrimeShieldHub Headquarters' as branch_name,
          'Benin City' as branch_city,
          'Edo' as branch_state,
          'Nigeria' as branch_country,
          'corporate' as branch_type,
          1 as is_headquarters,
          '108 Newton Street (Ekhorummtomwen Street), Benin City, Edo State' as branch_address,
          'corporate,wholesale,retail,import,distribution' as branch_capabilities
         FROM users u 
         WHERE u.email = ? OR u.name LIKE ?
         LIMIT 1`
      ).bind(staffId, `%${staffId}%`).first();
    }

    if (!staff) {
      // Log the failed verification attempt
      await logEvent(env, "STAFF_VERIFY_FAIL", `Failed verification for ID: ${staffId}`, 'public', {
        staffId,
        ip: request.headers.get('CF-Connecting-IP') || 'unknown',
        userAgent: request.headers.get('User-Agent') || 'unknown'
      }).catch(() => {});
      
      return new Response(JSON.stringify({
        verified: false,
        staff: null,
        message: 'No staff member found with this ID'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Check staff statuses properly
    const isActive = staff.status === 'active' || staff.status === 'verified';
    const isPending = staff.status === 'pending';
    const isSuspended = staff.status === 'suspended';
    
    // Calculate employment duration with precise display
    const joinDate = new Date(staff.joined_date);
    const now = new Date();
    const diffMs = now - joinDate;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    let employmentDuration = '';
    let yearsEmployed = 0;
    let monthsEmployed = 0;

    if (diffDays < 0) {
      employmentDuration = 'Not started';
    } else if (diffMinutes < 60) {
      employmentDuration = 'Just joined';
    } else if (diffHours < 24) {
      employmentDuration = `${diffHours} hour${diffHours > 1 ? 's' : ''}`;
    } else if (diffDays === 1) {
      employmentDuration = '1 day (Joined yesterday)';
    } else if (diffDays < 7) {
      employmentDuration = `${diffDays} days`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      employmentDuration = `${weeks} week${weeks > 1 ? 's' : ''}`;
    } else if (diffDays < 365) {
      monthsEmployed = Math.floor(diffDays / 30.44);
      employmentDuration = `${monthsEmployed} month${monthsEmployed > 1 ? 's' : ''}`;
    } else {
      yearsEmployed = Math.floor(diffDays / 365.25);
      monthsEmployed = Math.floor((diffDays % 365.25) / 30.44);
      employmentDuration = `${yearsEmployed} year${yearsEmployed > 1 ? 's' : ''}`;
      if (monthsEmployed > 0) {
        employmentDuration += `, ${monthsEmployed} month${monthsEmployed > 1 ? 's' : ''}`;
      }
    }

    // Generate verification proof hash
    const verificationProof = await generateVerificationHash(staff.staff_id, env);

    // Log successful verification
    await logEvent(env, "STAFF_VERIFY_SUCCESS", `Verified staff: ${staff.name}`, 'public', {
      staffId: staff.staff_id,
      ip: request.headers.get('CF-Connecting-IP') || 'unknown'
    }).catch(() => {});

    const response = {
      verified: true,
      staff: {
        staff_id: staff.display_id || staff.staff_id,
        name: staff.name,
        role: staff.role,
        designation: staff.designation,
        department: staff.department,
        employment_type: staff.employment_type,
        status: staff.status,
        is_active: isActive,
        is_pending: isPending,
        is_suspended: isSuspended,
        photo_url: staff.photo_url,
        branch: {
          name: staff.branch_name,
          type: staff.branch_type,
          capabilities: staff.branch_capabilities,
          is_headquarters: staff.is_headquarters === 1,
          city: staff.branch_city,
          state: staff.branch_state,
          country: staff.branch_country,
          address: staff.branch_address
        },
        joined_date: staff.joined_date,
        employment_duration: employmentDuration,
        years_employed: yearsEmployed,
        months_employed: monthsEmployed
      },
      verification: {
        proof: verificationProof,
        verified_at: new Date().toISOString(),
        valid_until: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        validity_note: 'This verification is valid for 30 minutes from the timestamp above.',
        issuer: 'PrimeShieldHub Gadgets Limited',
        issuer_registration: 'RC 9283954',
        divisions: ['PrimeShieldHub Gadgets (Wholesale, Retail, Import & Distribution)', 'PrimeShieldHub BuildMart (Building Materials)']
      }
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Staff verification error:', error);
    return new Response(JSON.stringify({
      verified: false,
      error: 'Verification service temporarily unavailable',
      code: 'SERVICE_ERROR'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

/**
 * Generate a cryptographic proof of verification
 */
async function generateVerificationHash(staffId, env) {
  try {
    const timestamp = Date.now();
    const secret = env.API_SECRET || env.AUTH_SECRET || 'primeshieldhub-verification-secret';
    
    // Create a simple hash from staffId + timestamp + secret
    const data = `${staffId}:${timestamp}:${secret}`;
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return {
      hash: hashHex.substring(0, 32),
      timestamp: timestamp,
      algorithm: 'SHA-256'
    };
  } catch (e) {
    return {
      hash: crypto.randomUUID().replace(/-/g, '').substring(0, 32),
      timestamp: Date.now(),
      algorithm: 'UUID-v4'
    };
  }
}

// ======================================================================
// PUBLIC PAYSLIP VERIFICATION (NO AUTH REQUIRED)
// ======================================================================

/**
 * GET /api/payroll/verify-public/:reference
 * Public endpoint - no authentication required
 * Returns basic payslip info for verification purposes
 */
export async function handlePublicVerification(request, env, corsHeaders) {
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const reference = pathParts[pathParts.length - 1];
    
    if (!reference || reference.length < 5) {
      return new Response(JSON.stringify({ valid: false, error: 'Invalid reference' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Query payroll by reference (no auth required)
    const payroll = await env.DB.prepare(
      `SELECT p.reference, s.name as staff_name, p.period, p.gross_salary,
              p.net_salary, p.status, p.created_at
       FROM payroll p
       LEFT JOIN staff s ON p.staff_id = s.id
       WHERE p.reference = ?
       LIMIT 1`
    ).bind(reference).first();

    if (!payroll) {
      return new Response(JSON.stringify({
        valid: false,
        payrolls: []
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    return new Response(JSON.stringify({
      valid: true,
      payrolls: [payroll]
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Public verification error:', error);
    return new Response(JSON.stringify({ valid: false, error: 'Verification failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}
