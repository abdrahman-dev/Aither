import type { ReactNode } from "react";
import logoUrl from "../../assets/AitherLogo.png";

// Tiny presentational label icons — same stroke vocabulary as the planner's
// field labels, so the landing and the tool read as one product.
function Icon({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`h-4 w-4 shrink-0 ${className ?? ""}`}
    >
      {children}
    </svg>
  );
}

const STEPS: { n: number; icon: ReactNode; title: string; body: string }[] = [
  {
    n: 1,
    icon: (
      <Icon className="text-brand">
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
        <circle cx="12" cy="10" r="3" />
      </Icon>
    ),
    title: "Pick your route",
    body: "Tap your start and destination on the map."
  },
  {
    n: 2,
    icon: (
      <Icon>
        <circle cx="6" cy="19" r="3" />
        <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
        <circle cx="18" cy="5" r="3" />
      </Icon>
    ),
    title: "Choose your mode",
    body: "Walking, driving, or cycling — plus the time you plan to travel."
  },
  {
    n: 3,
    icon: (
      <Icon>
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </Icon>
    ),
    title: "We compare using real data",
    body: "Every route is scored against measured historical temperature data, not a forecast."
  },
  {
    n: 4,
    icon: (
      <Icon className="text-brand-secondary">
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1Z" />
        <line x1="4" x2="4" y1="22" y2="15" />
      </Icon>
    ),
    title: "Go the cooler way",
    body: "See the tradeoff: minutes added vs. heat exposure avoided."
  }
];

// Hero illustration echoing the app's own route-comparison rendering: two
// routes over a schematic street grid, risk-tier colors and A/B pins matching
// BaseMap's visual language. Qualitative chips only — no invented numbers.
function HeroRouteIllustration() {
  return (
    <div
      aria-hidden="true"
      className="w-full max-w-lg rounded-panel border-[1.5px] border-border-subtle bg-glass-soft p-3 shadow-card backdrop-blur-lg"
    >
      <svg viewBox="0 0 440 330" className="block h-auto w-full">
        <defs>
          <linearGradient id="aither-cool-route" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#34D399" />
          </linearGradient>
          <filter id="aither-route-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" />
          </filter>
        </defs>

        {/* Map canvas */}
        <rect x="0.75" y="0.75" width="438.5" height="328.5" rx="18" fill="#EEF4F8" stroke="#E2EAF3" strokeWidth="1.5" />

        {/* Water + park hints (Voyager-style landcover cues) */}
        <circle cx="66" cy="282" r="38" fill="#38BDF8" opacity="0.14" />
        <circle cx="104" cy="306" r="18" fill="#38BDF8" opacity="0.10" />
        <rect x="298" y="36" width="126" height="92" rx="16" fill="#34D399" opacity="0.13" />

        {/* Schematic street grid */}
        <g stroke="#E2EAF3" strokeWidth="6" strokeLinecap="round">
          <line x1="-10" y1="70" x2="450" y2="70" />
          <line x1="-10" y1="150" x2="450" y2="150" />
          <line x1="-10" y1="230" x2="450" y2="230" />
          <line x1="100" y1="-10" x2="100" y2="340" />
          <line x1="220" y1="-10" x2="220" y2="340" />
          <line x1="340" y1="-10" x2="340" y2="340" />
        </g>

        {/* Hot route: straight shot along the mid streets */}
        <path d="M70 230 H190 V150 H370" fill="none" stroke="#FFFFFF" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
        <path d="M70 230 H190 V150 H370" fill="none" stroke="#DC2626" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Cooler route: longer detour arcing through the north side */}
        <path d="M70 230 V78 Q70 70 78 70 H332 Q340 70 344 77 L370 143" fill="none" stroke="url(#aither-cool-route)" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" opacity="0.20" filter="url(#aither-route-glow)" />
        <path d="M70 230 V78 Q70 70 78 70 H332 Q340 70 344 77 L370 143" fill="none" stroke="#FFFFFF" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
        <path d="M70 230 V78 Q70 70 78 70 H332 Q340 70 344 77 L370 143" fill="none" stroke="url(#aither-cool-route)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Risk-tier chips mirroring §2.4 token pairs */}
        <rect x="176" y="196" width="52" height="22" rx="11" fill="#FCA5A5" />
        <text x="202" y="211" textAnchor="middle" fontSize="11" fontWeight="800" fill="#DC2626">HIGH</text>
        <rect x="186" y="42" width="46" height="22" rx="11" fill="#FDE68A" />
        <text x="209" y="57" textAnchor="middle" fontSize="11" fontWeight="800" fill="#059669">LOW</text>

        {/* A/B endpoint pins matching the map markers */}
        <g>
          <circle cx="70" cy="230" r="12" fill="#38BDF8" stroke="#FFFFFF" strokeWidth="3.5" />
          <text x="70" y="234.5" textAnchor="middle" fontSize="11" fontWeight="800" fill="#FFFFFF">A</text>
        </g>
        <g>
          <circle cx="370" cy="150" r="12" fill="#34D399" stroke="#FFFFFF" strokeWidth="3.5" />
          <text x="370" y="154.5" textAnchor="middle" fontSize="11" fontWeight="800" fill="#FFFFFF">B</text>
        </g>
      </svg>
    </div>
  );
}

export default function LandingPage({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="flex min-h-screen flex-col overflow-y-auto bg-map-base">
      <span
        aria-hidden="true"
        className="sticky inset-x-0 top-0 z-10 block h-1 bg-brand-gradient"
      />

      {/* Hero: split layout on desktop, soft brand washes behind */}
      <section className="relative mx-auto flex w-full max-w-6xl flex-col items-center gap-12 px-6 pb-16 pt-14 lg:flex-row lg:gap-14 lg:pb-24 lg:pt-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-28 -top-28 h-80 w-80 rounded-full bg-brand/15 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-36 -right-20 h-96 w-96 rounded-full bg-brand-secondary/15 blur-3xl"
        />

        <div className="relative max-w-xl text-center lg:text-left">
          <div className="flex items-center justify-center gap-3.5 lg:justify-start">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-panel border-[1.5px] border-border-subtle bg-glass-soft shadow-card backdrop-blur-lg">
              <img src={logoUrl} alt="" aria-hidden="true" className="h-10 w-10" />
            </span>
            <span className="bg-brand-gradient bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
              Aither
            </span>
          </div>
          <h1 className="mt-7 text-4xl font-black leading-[1.1] tracking-tight text-primary sm:text-5xl">
            Find the cooler way.
          </h1>
          <p className="mx-auto mt-5 max-w-md text-lg font-semibold leading-relaxed text-secondary lg:mx-0">
            Heat-aware routing, powered by real measured data.
          </p>
          <button
            type="button"
            onClick={onEnter}
            className="mt-9 inline-flex items-center justify-center rounded-control bg-brand-gradient px-8 py-3.5 text-base font-bold text-white shadow-button-primary transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            Compare routes now
          </button>
        </div>

        <div className="relative flex w-full flex-1 justify-center lg:justify-end">
          <HeroRouteIllustration />
        </div>
      </section>

      {/* How it works: timeline inside an app-style glass panel */}
      <section className="mx-auto w-full max-w-3xl px-6 pb-16">
        <p className="text-center text-xs font-extrabold uppercase tracking-[0.18em] text-brand-mid">
          How it works
        </p>
        <span
          aria-hidden="true"
          className="mx-auto mt-3 block h-0.5 w-12 rounded-full bg-brand-gradient"
        />
        <ol className="mt-10 rounded-panel border-[1.5px] border-border-subtle bg-glass-soft p-6 shadow-card backdrop-blur-lg sm:p-8">
          {STEPS.map((step, index) => (
            <li key={step.n} className="relative flex gap-4 pb-7 last:pb-0">
              {index < STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-0 left-[17px] top-11 w-0.5 rounded-full bg-border-subtle"
                />
              )}
              <span className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-sm font-extrabold text-white shadow-card">
                {step.n}
              </span>
              <div className="pt-0.5">
                <h2 className="flex items-center gap-2 text-base font-extrabold text-primary">
                  {step.icon}
                  {step.title}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-secondary">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Quiet closing note + attribution */}
      <section className="flex flex-col items-center px-6 pb-20">
        <span
          aria-hidden="true"
          className="block h-0.5 w-16 rounded-full bg-brand-gradient opacity-60"
        />
        <p className="mt-6 max-w-sm text-center text-xs leading-relaxed text-tertiary">
          Every number comes from real temperature data recorded by FortyGuard — never a guess or a
          forecast.
        </p>
        <p className="mt-3 text-center text-xs font-semibold text-secondary">
          Aither — built by Abdrahman Walied Mussa for the FortyGuard Global AI Hackathon.
        </p>
      </section>
    </div>
  );
}
