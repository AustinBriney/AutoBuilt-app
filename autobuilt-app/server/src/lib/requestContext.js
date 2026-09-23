import { AsyncLocalStorage } from 'node:async_hooks';

// Holds the authenticated request's business_id for the lifetime of that
// request, without threading it through every function call. Set once by
// the requireAuth middleware, read anywhere downstream (route handlers,
// helper libs) via getCurrentBusinessId(). This is what makes the app
// actually multi-tenant: every read/write below this point is scoped to
// whichever business's token made the request.
export const businessContext = new AsyncLocalStorage();

export function getCurrentBusinessId() {
    return businessContext.getStore();
}
