// Notifications routes - extracted, matching real handler signatures
export async function handleNotificationsRoutes(request, env, ctx, routePath, corsHeaders, ip, fingerprint, requestInfo) {
  const method = request.method;

  if (routePath === '/api/notifications/sms' && method === 'POST') {
    const { handleSendSMS } = await import('../handlers/notifications.js');
    return handleSendSMS(request, env, corsHeaders);
  }

  if (routePath === '/api/notifications/whatsapp' && method === 'POST') {
    const { handleSendWhatsApp } = await import('../handlers/notifications.js');
    return handleSendWhatsApp(request, env, corsHeaders);
  }

  if (routePath === '/api/notifications/telegram' && method === 'POST') {
    const { handleSendTelegram } = await import('../handlers/notifications.js');
    return handleSendTelegram(request, env, corsHeaders);
  }

  return null;
}
