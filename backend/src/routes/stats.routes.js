// Stats routes - extracted, matching real handler signatures
export async function handleStatsRoutes(request, env, ctx, routePath, corsHeaders, ip, fingerprint, requestInfo) {
  const method = request.method;

  if (routePath === '/api/stats' && method === 'GET') {
    const { handleStats } = await import('../handlers/stats.js');
    return handleStats(request, env, ctx, corsHeaders);
  }

  return null;
}
