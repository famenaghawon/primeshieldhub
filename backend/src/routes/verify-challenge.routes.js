// Verify challenge routes - extracted, matching real handler signatures
export async function handleVerifyChallengeRoutes(request, env, ctx, routePath, corsHeaders, ip, fingerprint, requestInfo) {
  const method = request.method;

  if (routePath === '/api/verify/challenge' && method === 'POST') {
    const { handleVerifyChallenge } = await import('../handlers/verify-challenge.js');
    return handleVerifyChallenge(request, env, ctx, corsHeaders);
  }

  if (routePath === '/api/verify/challenge' && method === 'OPTIONS') {
    const { handleVerifyChallengeOptions } = await import('../handlers/verify-challenge.js');
    return handleVerifyChallengeOptions(request);
  }

  return null;
}
