// Reviews routes - extracted, matching real handler signatures
export async function handleReviewsRoutes(request, env, ctx, routePath, corsHeaders, ip, fingerprint, requestInfo) {
  const method = request.method;

  if (routePath === '/api/reviews' && method === 'GET') {
    const { handleGetReviews } = await import('../handlers/reviews.js');
    return handleGetReviews(request, env, ctx);
  }

  if (routePath === '/api/reviews' && method === 'POST') {
    const { handleCreateReview } = await import('../handlers/reviews.js');
    return handleCreateReview(request, env, ctx);
  }

  if (routePath.match(/^\/api\/reviews\/[^\/]+$/) && method === 'DELETE') {
    const reviewId = routePath.split('/').pop();
    const { handleDeleteReview } = await import('../handlers/reviews.js');
    return handleDeleteReview(request, env, ctx, reviewId);
  }

  return null;
}
