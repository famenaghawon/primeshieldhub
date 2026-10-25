// backend/src/handlers/reviews.js
import { requireAuth } from '../middleware/auth.js';
import { getCorsHeaders } from '../middleware/cors.js';
import { logEvent, logAudit } from '../utils/logging.js';
import { validateString } from '../utils/validation.js';

// GET /api/reviews?product_id=<uuid>
export async function handleGetReviews(request, env, ctx) {
    const cors = getCorsHeaders(request, env);
    try {
        const url = new URL(request.url);
        const productId = url.searchParams.get('product_id');
        if (!productId) {
            return new Response(JSON.stringify({ success: false, error: 'product_id required' }), {
                status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
            });
        }
        const { results } = await env.DB.prepare(
            'SELECT r.*, u.name AS user_name FROM reviews r JOIN users u ON u.id = r.user_id WHERE r.product_id = ? ORDER BY r.created_at DESC LIMIT 50'
        ).bind(productId).all();
        return new Response(JSON.stringify({ success: true, reviews: results }), {
            headers: { ...cors, 'Content-Type': 'application/json' }
        });
    } catch (err) {
        await logEvent(env, 'reviews_list_error', { error: String(err) });
        return new Response(JSON.stringify({ success: false, error: 'Server error' }), {
            status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
        });
    }
}

// POST /api/reviews  (authenticated)
export async function handleCreateReview(request, env, ctx) {
    const cors = getCorsHeaders(request, env);
    try {
        const user = await requireAuth(request, env);
        if (!user) {
            return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
                status: 401, headers: { ...cors, 'Content-Type': 'application/json' }
            });
        }
        const body = await request.json();
        if (!validateString(body.product_id) || !validateString(body.text)) {
            return new Response(JSON.stringify({ success: false, error: 'Invalid input' }), {
                status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
            });
        }
        const rating = Number(body.rating);
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            return new Response(JSON.stringify({ success: false, error: 'Rating must be 1-5' }), {
                status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
            });
        }
        const id = crypto.randomUUID();
        await env.DB.prepare(
            'INSERT INTO reviews (id, product_id, user_id, rating, text) VALUES (?, ?, ?, ?, ?)'
        ).bind(id, body.product_id, user.id, rating, body.text).run();
        await logEvent(env, 'review_created', { userId: user.id, productId: body.product_id });
        await logAudit(env, 'review_created', { reviewId: id, userId: user.id });
        return new Response(JSON.stringify({ success: true, id }), {
            status: 201, headers: { ...cors, 'Content-Type': 'application/json' }
        });
    } catch (err) {
        await logEvent(env, 'reviews_create_error', { error: String(err) });
        return new Response(JSON.stringify({ success: false, error: 'Server error' }), {
            status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
        });
    }
}

// DELETE /api/reviews/:id  (owner or admin)
export async function handleDeleteReview(request, env, ctx, reviewId) {
    const cors = getCorsHeaders(request, env);
    try {
        const user = await requireAuth(request, env);
        if (!user) {
            return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
                status: 401, headers: { ...cors, 'Content-Type': 'application/json' }
            });
        }
        const review = await env.DB.prepare('SELECT * FROM reviews WHERE id = ?').bind(reviewId).first();
        if (!review) return new Response(JSON.stringify({ success: false, error: 'Not found' }), {
            status: 404, headers: { ...cors, 'Content-Type': 'application/json' }
        });
        if (review.user_id !== user.id && user.role !== 'admin') {
            return new Response(JSON.stringify({ success: false, error: 'Forbidden' }), {
                status: 403, headers: { ...cors, 'Content-Type': 'application/json' }
            });
        }
        await env.DB.prepare('DELETE FROM reviews WHERE id = ?').bind(reviewId).run();
        await logAudit(env, 'review_deleted', { reviewId, userId: user.id });
        return new Response(JSON.stringify({ success: true }), {
            headers: { ...cors, 'Content-Type': 'application/json' }
        });
    } catch (err) {
        await logEvent(env, 'reviews_delete_error', { error: String(err) });
        return new Response(JSON.stringify({ success: false, error: 'Server error' }), {
            status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
        });
    }
}
