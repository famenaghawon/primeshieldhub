// Anomalies routes - extracted, matching real handler signatures
export async function handleAnomaliesRoutes(request, env, ctx, routePath, corsHeaders, ip, fingerprint, requestInfo) {
  const method = request.method;

  if (routePath === '/api/anomalies' && method === 'GET') {
    const { handleAnomalies } = await import('../handlers/anomalies.js');
    return handleAnomalies(request, env, ctx);
  }

  if (routePath === '/api/anomalies' && method === 'OPTIONS') {
    const { handleAnomaliesOptions } = await import('../handlers/anomalies.js');
    return handleAnomaliesOptions(request);
  }

  return null;
}
