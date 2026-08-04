import { Instrument_Serif } from "next/font/google";

const display = Instrument_Serif({ weight: "400", subsets: ["latin"] });

/**
 * Public landing. Its only legitimate audience is an invited candidate who typed the
 * domain instead of opening their link — send them back to their email. It links to
 * nothing and names no entry point (invitation-only posture, build-skill invariant 1).
 *
 * The five strokes are the product's own output — a five-dimension profile — used as
 * the brand mark. Heights are arbitrary and constant; they depict no real result.
 */
const STROKES = [40, 72, 52, 88, 62];

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#12312B] px-6 py-16 text-[#FAFAF8]">
      <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-[#93AFA6]">
        Afenda Talents · By invitation
      </p>

      <svg
        viewBox="0 0 120 96"
        className="mt-12 h-20 w-24 motion-safe:[&_rect]:animate-[rise_0.9s_cubic-bezier(0.22,1,0.36,1)_both]"
        aria-hidden="true"
      >
        {STROKES.map((height, i) => (
          <rect
            key={i}
            x={i * 26 + 4}
            y={92 - height}
            width={6}
            height={height}
            rx={3}
            fill="#B99356"
            style={{ animationDelay: `${i * 90}ms`, transformOrigin: `${i * 26 + 7}px 92px` }}
          />
        ))}
      </svg>

      <h1
        className={`${display.className} mt-10 max-w-md text-balance text-center text-4xl leading-tight sm:text-5xl`}
      >
        This assessment opens by invitation.
      </h1>

      <p className="mt-6 max-w-sm text-center text-[15px] leading-relaxed text-[#FAFAF8]/75">
        If you were invited, your personal link is in your email. There are no right or wrong
        answers — and nothing to prepare.
      </p>

      <div className="mt-14 h-px w-10 bg-[#3E6B5E]" aria-hidden="true" />

      <p className="mt-6 max-w-xs text-center text-xs leading-relaxed text-[#93AFA6]">
        Responses are seen only by the hiring team and are deleted after the round.
      </p>
    </main>
  );
}
