// Mock Stripe adapter.
//
// AutoBuilt's own subscription billing (what the business owner pays
// AutoBuilt) lives in Stripe today via static payment links — this adapter
// is a placeholder for surfacing that subscription's status inside
// Settings later (plan name, next bill date, "update payment method" link)
// without the owner ever needing to visit stripe.com.

export async function getSubscriptionStatus(_businessId) {
  return {
    plan: 'Grow & retain',
    priceCents: 19700,
    status: 'active',
    nextBillingDate: null, // TODO: pull from real Stripe subscription once wired
    manageUrl: null, // TODO: Stripe customer portal link
  };
}
