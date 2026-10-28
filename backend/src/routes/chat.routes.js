// Chat routes - extracted, matching real handler signatures
export async function handleChatRoutes(request, env, ctx, routePath, corsHeaders, ip, fingerprint, requestInfo) {
  const method = request.method;

  if (routePath === '/api/chat/rooms' && method === 'GET') {
    const { handleGetRooms } = await import('../handlers/chat.js');
    return handleGetRooms(request, env, ctx, corsHeaders);
  }

  if (routePath.match(/^\/api\/chat\/rooms\/[^\/]+\/messages$/) && method === 'GET') {
    const { handleGetMessages } = await import('../handlers/chat.js');
    return handleGetMessages(request, env, ctx, corsHeaders);
  }

  if (routePath.match(/^\/api\/chat\/rooms\/[^\/]+\/messages$/) && method === 'POST') {
    const { handleSendMessage } = await import('../handlers/chat.js');
    return handleSendMessage(request, env, ctx, corsHeaders);
  }

  if (routePath === '/api/chat/private' && method === 'POST') {
    const { handleCreatePrivateRoom } = await import('../handlers/chat.js');
    return handleCreatePrivateRoom(request, env, ctx, corsHeaders);
  }

  if (routePath === '/api/chat/unread' && method === 'GET') {
    const { handleGetUnreadCount } = await import('../handlers/chat.js');
    return handleGetUnreadCount(request, env, ctx, corsHeaders);
  }

  if (routePath === '/api/chat/online' && method === 'GET') {
    const { handleGetOnlineUsers } = await import('../handlers/chat.js');
    return handleGetOnlineUsers(request, env, ctx, corsHeaders);
  }

  return null;
}
