import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Layout from '../components/Layout';
import {
  Check,
  Sparkles,
  Camera,
  Building2,
  Infinity,
  Crown,
  Zap,
} from 'lucide-react';
import { PERSONAL_PLANS, BUSINESS_PLANS, PLAN_LIST, PlanConfig } from '../config/plans';

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
      className={`relative bg-[#131313] rounded-xl p-8 flex flex-col transition-all duration-200 ${
        plan.popular
          ? 'ring-1 ring-[#c19cff]/40 shadow-lg shadow-[#c19cff]/10'
          : ''
      }`}
    >
      {plan.popular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#9146ff] to-[#c19cff] text-white text-xs font-bold px-4 py-1.5 rounded-full flex items-center gap-1.5 whitespace-nowrap shadow-lg">
          <Sparkles className="w-3 h-3" />
          Most Popular
        </div>
      )}

      {isCurrent && (
        <div className="absolute top-4 right-4 bg-[#c19cff]/10 text-[#c19cff] text-xs font-semibold px-2.5 py-1 rounded-lg">
          Current
        </div>
      )}

      <div className="mb-6">
        <h3
          className="font-bold text-xl text-white mb-3"
          style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
        >
          {plan.name}
        </h3>
        <div className="flex items-baseline gap-1.5">
          {plan.price === 0 ? (
            <span
              className="text-4xl font-extrabold text-white"
              style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
            >
              Free
            </span>
          ) : (
            <>
              <span
                className="text-4xl font-extrabold text-white"
                style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
              >
                ${plan.price.toFixed(2)}
              </span>
              <span className="text-sm text-[#adaaaa]">
                {plan.billing === 'per-event' ? '/ event' : '/ month'}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-3 mb-8">
        {plan.features.map((feature, i) => (
          <div key={i} className="flex items-start gap-2.5 text-sm">
            <Check className="w-4 h-4 text-[#c19cff] flex-shrink-0 mt-0.5" />
            <span className="text-[#adaaaa]">{feature}</span>
          </div>
        ))}
      </div>

      {isCurrent ? (
        <div className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#9146ff] to-[#c19cff] text-white text-sm font-semibold text-center">
          Current Plan
        </div>
      ) : (
        <button
          onClick={() => onSelect(plan.id)}
          className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 ${
            plan.popular
              ? 'bg-gradient-to-r from-[#9146ff] to-[#c19cff] text-white hover:opacity-90'
              : 'bg-[#262626] text-white hover:bg-[#2c2c2c]'
          }`}
        >
          {plan.price === 0 ? 'Get Started' : 'Select Plan'}
        </button>
      )}
    </div>
  );
}

const COMPARISON_ROWS = [
  {
    label: 'Max Events',
    key: 'maxEvents',
    format: (v: number) => (v === -1 ? '∞' : String(v)),
  },
  {
    label: 'Guests / Event',
    key: 'maxGuestsPerEvent',
    format: (v: number) => (v === -1 ? '∞' : String(v)),
  },
  {
    label: 'Photos / Guest',
    key: 'maxPhotosPerGuest',
    format: (v: number) => (v === -1 ? '∞' : String(v)),
  },
  {
    label: 'Storage',
    key: 'maxStorageMb',
    format: (v: number) => {
      if (v >= 1024) return `${v / 1024} GB`;
      return `${v} MB`;
    },
  },
  {
    label: 'Billing',
    key: 'billing',
    format: (v: string) => {
      if (v === 'free') return 'Free';
      if (v === 'per-event') return 'Per event';
      return 'Monthly';
    },
  },
];

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
    alert(
      `Plan upgrade to "${planId}" noted! Payment integration coming soon. Contact admin to activate your plan.`
    );
  };

  const plans = tab === 'personal' ? PERSONAL_PLANS : BUSINESS_PLANS;

  if (authLoading) {
    return (
      <Layout title="Pricing" subtitle="PLANS">
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#c19cff] border-t-transparent" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Pricing" subtitle="PLANS">
      <div className="max-w-5xl mx-auto">
        {/* Hero */}
        <div className="text-center mb-10">
          <h1
            className="font-extrabold text-4xl text-white mb-3"
            style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
          >
            Choose Your Plan
          </h1>
          <p className="text-[#adaaaa] max-w-md mx-auto text-base">
            From intimate gatherings to large-scale events. Pick the plan that fits your needs.
          </p>
        </div>

        {/* Category Toggle */}
        <div className="flex justify-center mb-10">
          <div className="grid grid-cols-2 bg-[#262626] rounded-xl p-1 w-full max-w-sm">
            <button
              onClick={() => setTab('personal')}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                tab === 'personal'
                  ? 'bg-[#2c2c2c] text-white shadow-sm'
                  : 'text-[#adaaaa] hover:text-white'
              }`}
            >
              <Camera className="w-4 h-4" />
              Personal
            </button>
            <button
              onClick={() => setTab('business')}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                tab === 'business'
                  ? 'bg-[#2c2c2c] text-white shadow-sm'
                  : 'text-[#adaaaa] hover:text-white'
              }`}
            >
              <Building2 className="w-4 h-4" />
              Business
            </button>
          </div>
        </div>

        {/* Business description */}
        {tab === 'business' && (
          <div className="text-center mb-8 p-4 bg-[#c19cff]/5 rounded-xl border border-[#c19cff]/10">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Crown className="w-5 h-5 text-[#c19cff]" />
              <span
                className="font-semibold text-white"
                style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
              >
                Built for professionals
              </span>
            </div>
            <p className="text-sm text-[#adaaaa]">
              Perfect for photographers, event planners, wedding coordinators, and agencies
              who need to manage multiple events with premium features.
            </p>
          </div>
        )}

        {/* Plan Cards */}
        <div
          className={`grid gap-6 ${
            plans.length >= 3
              ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
              : 'grid-cols-1 sm:grid-cols-2'
          } mb-16`}
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

        {/* Feature Comparison Table */}
        <div className="mb-12">
          <h2
            className="font-bold text-xl text-white mb-6 text-center"
            style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
          >
            Compare All Plans
          </h2>
          <div className="overflow-x-auto w-full rounded-xl">
          <div className="bg-[#131313] overflow-hidden min-w-[560px]">
            {/* Header */}
            <div
              className="grid border-b border-[#484847]"
              style={{ gridTemplateColumns: `1fr repeat(${PLAN_LIST.length}, 1fr)` }}
            >
              <div className="p-4 text-xs font-semibold text-[#adaaaa] uppercase tracking-wider">
                Feature
              </div>
              {PLAN_LIST.map((p) => (
                <div
                  key={p.id}
                  className={`p-4 text-center text-xs font-bold uppercase tracking-wider ${
                    p.id === currentPlan ? 'text-[#c19cff]' : 'text-[#adaaaa]'
                  }`}
                  style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
                >
                  {p.name}
                </div>
              ))}
            </div>

            {/* Rows */}
            {COMPARISON_ROWS.map((row, i) => (
              <div
                key={row.key}
                className={`grid border-b border-[#484847]/50 last:border-0 ${
                  i % 2 === 0 ? 'bg-transparent' : 'bg-[#0e0e0e]'
                }`}
                style={{ gridTemplateColumns: `1fr repeat(${PLAN_LIST.length}, 1fr)` }}
              >
                <div className="p-4 text-sm text-[#adaaaa]">{row.label}</div>
                {PLAN_LIST.map((p) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const val = (p as any)[row.key];
                  const formatted = (row.format as (v: any) => string)(val);
                  const isInfinite = formatted === '∞';
                  return (
                    <div
                      key={p.id}
                      className={`p-4 text-center text-sm font-medium ${
                        p.id === currentPlan ? 'text-[#c19cff]' : 'text-white'
                      }`}
                    >
                      {isInfinite ? (
                        <Infinity className="w-4 h-4 inline text-[#c19cff]" />
                      ) : (
                        formatted
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          </div>
        </div>

        {/* Footer Notes */}
        <div className="text-center text-sm text-[#adaaaa]/60 space-y-1">
          <p>All plans include SSL encryption, mobile-optimized cameras, and QR code sharing.</p>
          <p>Per-event plans are one-time payments. Business plans are billed monthly.</p>
          <p>
            Need a custom plan? Contact us at{' '}
            <span className="text-[#c19cff]">support@zilware.mu</span>
          </p>
        </div>
      </div>
    </Layout>
  );
}
