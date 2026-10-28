// Profile routes - extracted, matching real handler signatures
export async function handleProfileRoutes(request, env, ctx, routePath, corsHeaders, ip, fingerprint, requestInfo) {
  const method = request.method;

  if (routePath === '/api/profile' && method === 'GET') {
    const { handleGetProfile } = await import('../handlers/profile.js');
    return handleGetProfile(request, env, corsHeaders, requestInfo);
  }

  if (routePath === '/api/profile' && method === 'PUT') {
    const { handleUpdateProfile } = await import('../handlers/profile.js');
    return handleUpdateProfile(request, env, corsHeaders, ip, fingerprint);
  }

  if (routePath === '/api/profile/avatar' && method === 'POST') {
    const { handleUploadAvatar } = await import('../handlers/profile.js');
    return handleUploadAvatar(request, env, corsHeaders, ip, fingerprint);
  }

  if (routePath === '/api/profile/avatar' && method === 'DELETE') {
    const { handleRemoveAvatar } = await import('../handlers/profile.js');
    return handleRemoveAvatar(request, env, corsHeaders, ip, fingerprint);
  }

  if (routePath === '/api/profile/documents' && method === 'GET') {
    const { handleGetDocuments } = await import('../handlers/profile.js');
    return handleGetDocuments(request, env, corsHeaders);
  }

  if (routePath === '/api/profile/subscription' && method === 'GET') {
    const { handleGetSubscription } = await import('../handlers/profile.js');
    return handleGetSubscription(request, env, corsHeaders);
  }

  if (routePath === '/api/profile/preferences' && method === 'POST') {
    const { handleSavePreferences } = await import('../handlers/profile.js');
    return handleSavePreferences(request, env, corsHeaders);
  }

  return null;
}
