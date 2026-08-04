/**
 * Subscription plan definitions — single source of truth.
 *
 * Free   → ₹0/month,   1 application per month
 * Bronze → ₹100/month, 3 applications per month
 * Silver → ₹300/month, 5 applications per month
 * Gold   → ₹1000/month, unlimited applications
 */
const PLANS = {
  free: {
    id: "free",
    name: "Free Plan",
    price: 0,
    pricePaise: 0,
    monthlyLimit: 1,
    unlimited: false,
  },
  bronze: {
    id: "bronze",
    name: "Bronze Plan",
    price: 100,
    pricePaise: 100 * 100,
    monthlyLimit: 3,
    unlimited: false,
  },
  silver: {
    id: "silver",
    name: "Silver Plan",
    price: 300,
    pricePaise: 300 * 100,
    monthlyLimit: 5,
    unlimited: false,
  },
  gold: {
    id: "gold",
    name: "Gold Plan",
    price: 1000,
    pricePaise: 1000 * 100,
    monthlyLimit: Infinity,
    unlimited: true,
  },
};

const PLAN_IDS = Object.keys(PLANS);

/** Monthly application limit for a plan id (Infinity for gold). */
function planLimit(planId) {
  const plan = PLANS[planId] || PLANS.free;
  return plan.monthlyLimit;
}

/** The raw plan definition (fallback to free). */
function getPlan(planId) {
  return PLANS[planId] || PLANS.free;
}

module.exports = { PLANS, PLAN_IDS, planLimit, getPlan };
