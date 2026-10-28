// Staff routes - extracted, matching real handler signatures
export async function handleStaffRoutes(request, env, ctx, routePath, corsHeaders, ip, fingerprint, requestInfo) {
  const method = request.method;

  if (routePath === '/api/staff/me' && method === 'GET') {
    const { handleStaffMe } = await import('../handlers/staff.js');
    return handleStaffMe(request, env, corsHeaders);
  }

  if (routePath === '/api/staff/dashboard' && method === 'GET') {
    const { handleStaffDashboard } = await import('../handlers/staff.js');
    return handleStaffDashboard(request, env, corsHeaders);
  }

  if (routePath === '/api/staff/location' && method === 'POST') {
    const { handleStaffLocation } = await import('../handlers/staff.js');
    return handleStaffLocation(request, env, corsHeaders);
  }

  if (routePath === '/api/staff/capture' && method === 'POST') {
    const { handleStaffCapture } = await import('../handlers/staff.js');
    return handleStaffCapture(request, env, corsHeaders, ip, fingerprint);
  }

  if (routePath === '/api/staff/clock-in' && method === 'POST') {
    const { handleClockIn } = await import('../handlers/staff.js');
    return handleClockIn(request, env, corsHeaders);
  }

  if (routePath === '/api/staff/clock-out' && method === 'POST') {
    const { handleClockOut } = await import('../handlers/staff.js');
    return handleClockOut(request, env, corsHeaders);
  }

  if (routePath === '/api/staff/stats' && method === 'GET') {
    const { handleStaffStats } = await import('../handlers/staff.js');
    return handleStaffStats(request, env, corsHeaders);
  }

  if (routePath === '/api/staff/activity' && method === 'GET') {
    const { handleStaffActivity } = await import('../handlers/staff.js');
    return handleStaffActivity(request, env, corsHeaders);
  }

  // Payroll / wallet subset
  if (routePath === '/api/staff/wallet' && method === 'GET') {
    const { handleGetWallet } = await import('../handlers/staff-payout.js');
    return handleGetWallet(request, env, corsHeaders);
  }

  if (routePath === '/api/staff/payroll/history' && method === 'GET') {
    const { handlePayrollHistory } = await import('../handlers/staff-payout.js');
    return handlePayrollHistory(request, env, corsHeaders);
  }

  return null;
}
