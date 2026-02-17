export interface PlanConfig {
  id: string;
  name: string;
  category: 'personal' | 'business';
  price: number;
  priceLabel: string;
  billing: 'free' | 'per-event' | 'monthly';
  maxEvents: number;        // -1 = unlimited
  maxGuestsPerEvent: number; // -1 = unlimited
  maxPhotosPerGuest: number; // -1 = unlimited
  maxStorageMb: number;
  features: string[];
  popular?: boolean;
}

export const PLANS: Record<string, PlanConfig> = {
  free: {
    id: 'free',
    name: 'Free',
    category: 'personal',
    price: 0,
    priceLabel: 'Free',
    billing: 'free',
    maxEvents: 1,
    maxGuestsPerEvent: 10,
    maxPhotosPerGuest: 5,
    maxStorageMb: 100,
    features: [
      '1 event',
      'Up to 10 guests',
      '5 photos per guest',
      '100 MB storage',
      'Basic themes',
    ],
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    category: 'personal',
    price: 19.99,
    priceLabel: '$19.99',
    billing: 'per-event',
    maxEvents: 1,
    maxGuestsPerEvent: 250,
    maxPhotosPerGuest: 25,
    maxStorageMb: 2048,
    popular: true,
    features: [
      '1 event',
      'Up to 250 guests',
      '25 photos per guest',
      '2 GB storage',
      'All themes',
      'Gallery export',
      'Custom event icon',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    category: 'personal',
    price: 49.99,
    priceLabel: '$49.99',
    billing: 'per-event',
    maxEvents: 3,
    maxGuestsPerEvent: 500,
    maxPhotosPerGuest: -1,
    maxStorageMb: 10240,
    features: [
      'Up to 3 events',
      'Up to 500 guests',
      'Unlimited photos per guest',
      '10 GB storage',
      'All themes',
      'Priority export',
      'Custom event icon',
    ],
  },
  business: {
    id: 'business',
    name: 'Business',
    category: 'business',
    price: 89.99,
    priceLabel: '$89.99',
    billing: 'monthly',
    maxEvents: 10,
    maxGuestsPerEvent: -1,
    maxPhotosPerGuest: -1,
    maxStorageMb: 51200,
    popular: true,
    features: [
      'Up to 10 events',
      'Unlimited guests',
      'Unlimited photos',
      '50 GB storage',
      'All themes',
      'Priority export',
      'Custom branding',
      'Ideal for photographers & freelancers',
    ],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    category: 'business',
    price: 199.99,
    priceLabel: '$199.99',
    billing: 'monthly',
    maxEvents: -1,
    maxGuestsPerEvent: -1,
    maxPhotosPerGuest: -1,
    maxStorageMb: 102400,
    features: [
      'Unlimited events',
      'Unlimited guests',
      'Unlimited photos',
      '100 GB storage',
      'All themes',
      'Priority export',
      'Custom branding',
      'Dedicated support',
      'Ideal for agencies & large venues',
    ],
  },
};

export const PLAN_IDS = Object.keys(PLANS) as Array<keyof typeof PLANS>;

export function getPlan(planId: string): PlanConfig {
  return PLANS[planId] || PLANS.free;
}
