// Security admin routes - extracted, matching real handler signatures
export async function handleSecurityAdminRoutes(request, env, ctx, routePath, corsHeaders, ip, fingerprint, requestInfo) {
  const method = request.method;

  if (routePath === '/api/admin/security/incidents' && method === 'GET') {
    const { handleSecurityIncidents } = await import('../handlers/security-admin.js');
    return handleSecurityIncidents(request, env, ctx, corsHeaders);
  }

  if (routePath === '/api/admin/security/blacklist' && method === 'GET') {
    const { handleGetBlacklist } = await import('../handlers/security-admin.js');
    return handleGetBlacklist(request, env, ctx, corsHeaders);
  }

  if (routePath === '/api/admin/security/blacklist' && method === 'POST') {
    const { handleAddToBlacklist } = await import('../handlers/security-admin.js');
    return handleAddToBlacklist(request, env, ctx, corsHeaders, ip, fingerprint);
  }

  return null;
}
