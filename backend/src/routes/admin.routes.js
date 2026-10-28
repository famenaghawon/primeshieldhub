// Admin routes - extracted, matching real handler signatures
export async function handleAdminRoutes(request, env, ctx, routePath, corsHeaders, ip, fingerprint, requestInfo) {
  const method = request.method;

  if (routePath === '/api/admin/stats' && method === 'GET') {
    const { handleAdminStats } = await import('../handlers/admin-unified.js');
    return handleAdminStats(request, env, ctx, corsHeaders);
  }

  if (routePath === '/api/admin/orders' && method === 'GET') {
    const { handleAdminOrders } = await import('../handlers/admin-unified.js');
    return handleAdminOrders(request, env, ctx, corsHeaders);
  }

  if (routePath.match(/^\/api\/admin\/orders\/[^\/]+\/status$/) && method === 'PUT') {
    const { handleAdminOrderStatus } = await import('../handlers/admin-unified.js');
    return handleAdminOrderStatus(request, env, ctx, corsHeaders, ip, fingerprint);
  }

  if (routePath === '/api/admin/customers' && method === 'GET') {
    const { handleAdminCustomers } = await import('../handlers/admin-unified.js');
    return handleAdminCustomers(request, env, ctx, corsHeaders);
  }

  if (routePath === '/api/admin/staff' && method === 'GET') {
    const { handleAdminStaffList } = await import('../handlers/admin-unified.js');
    return handleAdminStaffList(request, env, ctx, corsHeaders);
  }

  if (routePath.match(/^\/api\/admin\/staff\/[^\/]+$/) && method === 'GET') {
    const { handleAdminGetStaff } = await import('../handlers/admin-unified.js');
    return handleAdminGetStaff(request, env, ctx, corsHeaders);
  }

  if (routePath === '/api/admin/branches' && method === 'GET') {
    const { handleAdminBranches } = await import('../handlers/admin-unified.js');
    return handleAdminBranches(request, env, ctx, corsHeaders);
  }

  if (routePath === '/api/admin/settings' && method === 'GET') {
    const { handleAdminSettingsGet } = await import('../handlers/admin-unified.js');
    return handleAdminSettingsGet(request, env, ctx, corsHeaders);
  }

  if (routePath === '/api/admin/logs' && method === 'GET') {
    const { handleAdminLogs } = await import('../handlers/admin-unified.js');
    return handleAdminLogs(request, env, ctx, corsHeaders);
  }

  return null;
}
