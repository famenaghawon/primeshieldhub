// Dashboard routes - extracted, matching real handler signatures
export async function handleDashboardRoutes(request, env, ctx, routePath, corsHeaders, ip, fingerprint, requestInfo) {
  const method = request.method;

  if (routePath === '/api/dashboard' && method === 'GET') {
    const { handleDashboard } = await import('../handlers/dashboard.js');
    return handleDashboard(request, env, ctx, corsHeaders);
  }

  if (routePath === '/api/dashboard/notifications' && method === 'GET') {
    const { getNotifications } = await import('../handlers/dashboard.js');
    return getNotifications(request, env, ctx, corsHeaders);
  }

  return null;
}
