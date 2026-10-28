// Charging routes - extracted, matching real handler signatures
export async function handleChargingRoutes(request, env, ctx, routePath, corsHeaders, ip, fingerprint, requestInfo) {
  const method = request.method;

  if (routePath === '/api/charging/start' && method === 'POST') {
    const { handleChargingStart } = await import('../handlers/charging.js');
    return handleChargingStart(request, env, ctx, corsHeaders, ip, fingerprint);
  }

  if (routePath.match(/^\/api\/charging\/session\/[^\/]+$/) && method === 'GET') {
    const { handleGetSession } = await import('../handlers/charging.js');
    return handleGetSession(request, env, ctx, corsHeaders);
  }

  if (routePath.match(/^\/api\/charging\/session\/[^\/]+\/pause$/) && method === 'POST') {
    const { handleChargingPause } = await import('../handlers/charging.js');
    return handleChargingPause(request, env, ctx, corsHeaders, ip, fingerprint);
  }

  if (routePath.match(/^\/api\/charging\/session\/[^\/]+\/resume$/) && method === 'POST') {
    const { handleChargingResume } = await import('../handlers/charging.js');
    return handleChargingResume(request, env, ctx, corsHeaders, ip, fingerprint);
  }

  if (routePath.match(/^\/api\/charging\/session\/[^\/]+\/complete$/) && method === 'POST') {
    const { handleChargingComplete } = await import('../handlers/charging.js');
    return handleChargingComplete(request, env, ctx, corsHeaders, ip, fingerprint);
  }

  if (routePath === '/api/charging/stats' && method === 'GET') {
    const { handleChargingStats } = await import('../handlers/charging.js');
    return handleChargingStats(request, env, ctx, corsHeaders);
  }

  if (routePath === '/api/charging/bays' && method === 'GET') {
    const { handleGetBays } = await import('../handlers/charging.js');
    return handleGetBays(request, env, ctx, corsHeaders);
  }

  return null;
}
