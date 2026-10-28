// Security routes - extracted, matching real handler signatures
export async function handleSecurityRoutes(request, env, ctx, routePath, corsHeaders, ip, fingerprint, requestInfo) {
  const method = request.method;

  if (routePath === '/api/security/anomalies' && method === 'GET') {
    const { handleSecurityAnomalies } = await import('../handlers/security.js');
    return handleSecurityAnomalies(request, env, corsHeaders);
  }

  if (routePath === '/api/security/verify-browser' && method === 'POST') {
    const { handleVerifyBrowser } = await import('../handlers/security.js');
    return handleVerifyBrowser(request, corsHeaders);
  }

  return null;
}
