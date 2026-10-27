// Auth routes - extracted from legacy handler.
// IMPORTANT: matches the legacy call signatures exactly, including
// ip / fingerprint / requestInfo, so behavior is identical.

export async function handleAuthRoutes(request, env, ctx, routePath, corsHeaders, ip, fingerprint, requestInfo) {
  const method = request.method;

  if (routePath === '/api/auth/login' && method === 'POST') {
    const { handleLogin } = await import('../handlers/auth.js');
    return handleLogin(request, env, ctx, corsHeaders, ip, fingerprint);
  }

  if (routePath === '/api/auth/register' && method === 'POST') {
    const { handleRegister } = await import('../handlers/auth.js');
    return handleRegister(request, env, ctx, corsHeaders, ip, fingerprint);
  }

  if (routePath === '/api/auth/me' && method === 'GET') {
    const { handleMe } = await import('../handlers/auth.js');
    return handleMe(request, env, corsHeaders, requestInfo);
  }

  if (routePath === '/api/auth/logout' && method === 'POST') {
    const { handleLogout } = await import('../handlers/auth.js');
    return handleLogout(request, env, corsHeaders, ip, fingerprint);
  }

  return null;
}
