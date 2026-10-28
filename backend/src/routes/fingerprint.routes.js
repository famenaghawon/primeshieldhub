// Fingerprint routes - extracted, matching real handler signatures
export async function handleFingerprintRoutes(request, env, ctx, routePath, corsHeaders, ip, fingerprint, requestInfo) {
  const method = request.method;

  if (routePath === '/api/fingerprint/token' && method === 'POST') {
    const { handleFingerprintToken } = await import('../handlers/fingerprint.js');
    return handleFingerprintToken(request, env, ctx);
  }

  return null;
}
