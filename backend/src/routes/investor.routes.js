// Investor routes - extracted, matching real handler signatures
export async function handleInvestorRoutes(request, env, ctx, routePath, corsHeaders, ip, fingerprint, requestInfo) {
  const method = request.method;

  if (routePath === '/api/investor/apply' && method === 'POST') {
    const { handleInvestorApply } = await import('../handlers/investor.js');
    return handleInvestorApply(request, env, ctx, corsHeaders);
  }

  if (routePath === '/api/investor/status' && method === 'GET') {
    const { handleInvestorStatus } = await import('../handlers/investor.js');
    return handleInvestorStatus(request, env, ctx, corsHeaders);
  }

  return null;
}
