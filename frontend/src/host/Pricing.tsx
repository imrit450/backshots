import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Layout from '../components/Layout';
import {
  Check,
  Sparkles,
  Camera,
  Building2,
  Users,
  Infinity,
  Crown,
} from 'lucide-react';
import { PERSONAL_PLANS, BUSINESS_PLANS, PlanConfig } from '../config/plans';

function PlanCard({
  plan,
  currentPlan,
  onSelect,
}: {
  plan: PlanConfig;
  currentPlan: string;
  onSelect: (planId: string) => void;
}) {
  const isCurrent = currentPlan === plan.id;

  return (
    <div
      className={`relative rounded-2xl border-2 p-6 flex flex-col transition-all ${
        plan.popular
          ? 'border-gold-400 shadow-lg shadow-gold-100 scale-[1.02]'
          : isCurrent
          ? 'border-pine-400 shadow-md'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      {plan.popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gold-400 text-pine-900 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          Most Popular
        </div>
      )}

      <div className="mb-4">
        <h3 className="font-display text-xl text-charcoal">{plan.name}</h3>
        <div className="mt-2 flex items-baseline gap-1">
          {plan.price === 0 ? (
            <span className="text-3xl font-display font-bold text-charcoal">Free</span>
          ) : (
            <>
              <span className="text-3xl font-display font-bold text-charcoal">
                ${plan.price.toFixed(2)}
              </span>
              <span className="text-sm text-gray-500">
                {plan.billing === 'per-event' ? '/ event' : '/ month'}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-3 mb-6">
        {plan.features.map((feature, i) => (
          <div key={i} className="flex items-start gap-2 text-sm">
            <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
            <span className="text-gray-600">{feature}</span>
          </div>
        ))}
      </div>

      {/* Plan limits summary */}
      <div className="flex items-center gap-3 text-xs text-gray-400 border-t border-gray-100 pt-4 mb-4">
        <div className="flex items-center gap-1">
          <Camera className="w-3.5 h-3.5" />
          {plan.maxEvents === -1 ? 'Unlimited' : plan.maxEvents} event{plan.maxEvents !== 1 ? 's' : ''}
        </div>
        <div className="flex items-center gap-1">
          <Users className="w-3.5 h-3.5" />
          {plan.maxGuestsPerEvent === -1 ? (
            <Infinity className="w-3.5 h-3.5" />
          ) : (
            `${plan.maxGuestsPerEvent}`
          )}{' '}
          guests
        </div>
      </div>

      {isCurrent ? (
        <div className="w-full py-2.5 rounded-xl bg-pine-100 text-pine-700 text-sm font-semibold text-center">
          Current Plan
        </div>
      ) : (
        <button
          onClick={() => onSelect(plan.id)}
          className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors ${
            plan.popular
              ? 'bg-gold-400 text-pine-900 hover:bg-gold-500'
              : 'bg-pine-800 text-white hover:bg-pine-700'
          }`}
        >
          {plan.price === 0 ? 'Get Started' : 'Select Plan'}
        </button>
      )}
    </div>
  );
}

export default function Pricing() {
  const navigate = useNavigate();
  const { host, isAuthenticated, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<'personal' | 'business'>('personal');

  const currentPlan = host?.plan || 'free';

  const handleSelect = (planId: string) => {
    if (!isAuthenticated) {
      navigate('/host/signup');
      return;
    }
    // For now, show a message. Payment integration can be added later.
    alert(
      `Plan upgrade to "${planId}" noted! Payment integration coming soon. Contact admin to activate your plan.`
    );
  };

  const plans = tab === 'personal' ? PERSONAL_PLANS : BUSINESS_PLANS;

  if (authLoading) {
    return (
      <Layout>
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-pine-800 border-t-transparent" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="font-display text-4xl text-charcoal mb-3">
            Choose Your Plan
          </h1>
          <p className="text-gray-500 max-w-md mx-auto">
            From intimate gatherings to large-scale events. Pick the plan that fits your needs.
          </p>
        </div>

        {/* Category Toggle */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setTab('personal')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                tab === 'personal'
                  ? 'bg-white text-charcoal shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Camera className="w-4 h-4" />
              Personal
            </button>
            <button
              onClick={() => setTab('business')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                tab === 'business'
                  ? 'bg-white text-charcoal shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Building2 className="w-4 h-4" />
              Business & Freelancers
            </button>
          </div>
        </div>

        {/* Business description */}
        {tab === 'business' && (
          <div className="text-center mb-8 p-4 bg-pine-50 rounded-xl border border-pine-100">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Crown className="w-5 h-5 text-gold-500" />
              <span className="font-semibold text-pine-800">Built for professionals</span>
            </div>
            <p className="text-sm text-pine-600">
              Perfect for photographers, event planners, wedding coordinators, and agencies
              who need to manage multiple events with premium features.
            </p>
          </div>
        )}

        {/* Plan Cards */}
        <div
          className={`grid gap-6 ${
            plans.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
          }`}
        >
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              currentPlan={currentPlan}
              onSelect={handleSelect}
            />
          ))}
        </div>

        {/* FAQ / Notes */}
        <div className="mt-12 text-center text-sm text-gray-400 space-y-1">
          <p>All plans include SSL encryption, mobile-optimized cameras, and QR code sharing.</p>
          <p>Per-event plans are one-time payments. Business plans are billed monthly.</p>
          <p>Need a custom plan? Contact us at <span className="text-pine-600">support@zilware.mu</span></p>
        </div>
      </div>
    </Layout>
  );
}
