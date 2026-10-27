// backend/src/index.js
// Clean entry point. All real logic currently lives in legacy-handler.js
// while we extract routes safely.

export { ChatRoom } from './durable-objects/ChatRoom.js';

import { routeRequest } from './router.js';

export default {
  async fetch(request, env, ctx) {
    return routeRequest(request, env, ctx);
  },
};

export async function scheduled(event, env, ctx) {
  // TODO: delete once legacy-handler.js is removed.
  let legacy;
  try {
    legacy = await import('./legacy-handler.js');
  } catch (e) {
    console.error('Failed to load legacy-handler for scheduled event:', e);
    throw e;
  }

  if (typeof legacy.scheduled !== 'function') {
    console.warn('legacy-handler has no scheduled export; cron did nothing');
    return;
  }

  return await legacy.scheduled(event, env, ctx);
}
