// Customer routes - extracted, matching real handler signatures
export async function handleCustomerRoutes(request, env, ctx, routePath, corsHeaders, ip, fingerprint, requestInfo) {
  const method = request.method;

  if (routePath === '/api/customer/history' && method === 'GET') {
    const { handleCustomerHistory } = await import('../handlers/customer.js');
    return handleCustomerHistory(request, env, corsHeaders);
  }

  if (routePath === '/api/customers/top' && method === 'GET') {
    const { handleTopCustomers } = await import('../handlers/customer.js');
    return handleTopCustomers(request, env, corsHeaders);
  }

  return null;
}
