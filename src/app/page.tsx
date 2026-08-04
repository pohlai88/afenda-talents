import { Playfair_Display } from "next/font/google";

/* Bodoni Moda is the higher-contrast alternative if the display needs more bite. */
const display = Playfair_Display({
  weight: ["400", "500"],
  style: ["normal", "italic"],
  subsets: ["latin"],
});

/**
 * Afenda Talents — public landing, set as a poster rather than a page. Its only
 * legitimate audience is an invited candidate who typed the domain instead of opening
 * their link, so it sends them back to their email — plus the hiring manager, who gets
 * one quiet sign-in link in the bottom bar. That link points at /admin/login, which was
 * always a public route: the password is the credential, not the URL's obscurity.
 *
 * House system inherited from The Machine: near-black sheet, bone Didone display,
 * gold at low coverage, the diamond glyph, THE set vertically beside the display
 * word, a numbered series with one member lit, a gold hairline into body copy, and
 * the italic voice line bottom left.
 *
 * The instrument is a radar, not a rose — Detect is the parent brand's own verb, and
 * a sweep is time-based where a compass rose is inert. One 8s rotation, five bearings
 * at 72°, so each contact lights 1.6s after the last. The axis names run the same
 * keyframes at the same offsets: they light because the sweep just crossed them.
 * Entirely CSS — no timer, no client component.
 */
const AXES = ["Judgement", "Rigour", "Ownership", "Candour", "Pace"];

/* Blip offsets from centre, r = 31% of the dish, clockwise from due north. */
const BLIPS = [
  { x: "0%", y: "-31%" },
  { x: "29.5%", y: "-9.6%" },
  { x: "18.2%", y: "25.1%" },
  { x: "-18.2%", y: "25.1%" },
  { x: "-29.5%", y: "-9.6%" },
];

export default function HomePage() {
  return (
    <main className="af relative isolate min-h-[100svh] overflow-hidden bg-[#07070A] text-[#E9E1D1] antialiased">
      <style>{`
        .af { --bone:#E9E1D1; --gold:#C8A96A; --dim:#4E4E58 }
        .af-dish { position:absolute; left:66%; top:47%; width:min(112vh,105vw); aspect-ratio:1; transform:translate(-50%,-50%);
          -webkit-mask-image:radial-gradient(circle,#000 52%,transparent 97%); mask-image:radial-gradient(circle,#000 52%,transparent 97%) }
        .af-dish > * { position:absolute; inset:0; border-radius:50% }
        .af-glow { position:absolute; left:66%; top:47%; width:min(170vh,160vw); aspect-ratio:1; transform:translate(-50%,-50%);
          background:radial-gradient(circle,rgba(200,169,106,.09),rgba(7,7,10,0) 66%) }
        .af-rings { background:repeating-radial-gradient(circle,transparent 0 calc(6.2% - 1px),rgba(233,225,209,.08) calc(6.2% - 1px) 6.2%) }
        .af-spokes { background:repeating-conic-gradient(from 0deg,rgba(233,225,209,.11) 0deg .3deg,transparent .3deg 72deg) }
        .af-sweep { background:conic-gradient(from 0deg,
          rgba(200,169,106,0) 0deg, rgba(200,169,106,0) 262deg,
          rgba(200,169,106,.05) 302deg, rgba(200,169,106,.16) 346deg,
          rgba(233,225,209,.55) 359.5deg, rgba(233,225,209,0) 360deg) }
        .af-blip { position:absolute; left:66%; top:47%; width:7px; height:7px; background:var(--gold);
          rotate:45deg; opacity:.16 }
        .af-axis { color:var(--dim) }

        @media (prefers-reduced-motion: no-preference) {
          .af-sweep { animation:af-turn 8s linear infinite }
          .af-blip  { animation:af-flare 8s linear infinite }
          .af-axis  { animation:af-lit 8s linear infinite }
        }
        @media (prefers-reduced-motion: reduce) {
          .af-sweep { rotate:340deg }
          .af-axis:first-child { color:var(--bone) }
        }
        @keyframes af-turn  { to { rotate:360deg } }
        @keyframes af-flare { 0%,11% { opacity:1 } 44%,100% { opacity:.16 } }
        @keyframes af-lit   { 0%,11% { color:var(--bone) } 44%,100% { color:var(--dim) } }
      `}</style>

      <div aria-hidden="true" className="af-glow pointer-events-none" />
      <div aria-hidden="true" className="af-dish pointer-events-none">
        <div className="af-rings" />
        <div className="af-spokes" />
        <div className="af-sweep" />
      </div>
      {BLIPS.map((b, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="af-blip pointer-events-none"
          style={{ margin: `${b.y} 0 0 ${b.x}`, animationDelay: `${i * 1.6}s` }}
        />
      ))}

      {/* Trim frame and crop marks: this is a printed sheet, not a viewport. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-5 border border-[#E9E1D1]/[0.075] sm:inset-7" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 text-[#C8A96A]/45">
        <span className="absolute left-2 top-2 h-3.5 w-3.5 border-l border-t border-current sm:left-3 sm:top-3" />
        <span className="absolute right-2 top-2 h-3.5 w-3.5 border-r border-t border-current sm:right-3 sm:top-3" />
        <span className="absolute bottom-2 left-2 h-3.5 w-3.5 border-b border-l border-current sm:bottom-3 sm:left-3" />
        <span className="absolute bottom-2 right-2 h-3.5 w-3.5 border-b border-r border-current sm:bottom-3 sm:right-3" />
      </div>

      {/* Marginalia set into the edges, the way a poster carries its imprint. */}
      <span className="pointer-events-none absolute bottom-28 left-7 hidden font-mono text-[8.5px] tracking-[0.3em] text-[#43434C] [writing-mode:vertical-rl] lg:block">
        PRE-ONBOARDING ◆ TWENTY MINUTES ◆ ONE SITTING
      </span>
      <span className="pointer-events-none absolute right-7 top-36 hidden font-mono text-[8.5px] tracking-[0.3em] text-[#43434C] [writing-mode:vertical-rl] [transform:rotate(180deg)] lg:block">
        AFD · TAL · CMP — MMXXVI
      </span>

      <div className="relative z-10 flex min-h-[100svh] flex-col px-10 py-9 sm:px-16 sm:py-12">
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-[9px]">
            <span aria-hidden="true" className="h-[5px] w-[5px] rotate-45 bg-[#C8A96A]" />
            <span className="font-mono text-[10px] tracking-[0.28em]">AFENDA</span>
            <span className="font-mono text-[10px] tracking-[0.28em] text-[#6E6E78]">TALENTS</span>
          </span>
          <span className="font-mono text-[8.5px] tracking-[0.24em] text-[#4E4E58]">
            GUARDED CANDIDATE ASSESSMENT
          </span>
        </div>

        <div className="flex flex-1 flex-col justify-center py-16">
          <h1 className="flex items-end gap-3 sm:gap-4">
            <span
              aria-hidden="true"
              className="pb-4 font-mono text-[8.5px] tracking-[0.32em] text-[#4E4E58] [writing-mode:vertical-rl] [transform:rotate(180deg)]"
            >
              THE
            </span>
            <span className="sr-only">The Compass</span>
            <span
              aria-hidden="true"
              className={`${display.className} text-[clamp(3.1rem,13vw,11rem)] leading-[0.88]`}
            >
              Compass
            </span>
          </h1>

          <p className={`${display.className} ml-0 mt-4 text-[clamp(1.2rem,2.4vw,1.85rem)] italic text-[#C8A96A] sm:ml-9`}>
            Not a verdict. A bearing.
          </p>

          <ol
            className={`${display.className} mt-14 flex flex-wrap gap-x-8 gap-y-2 text-[clamp(1.1rem,1.9vw,1.6rem)] sm:ml-9`}
          >
            {AXES.map((axis, i) => (
              <li key={axis} className="af-axis" style={{ animationDelay: `${i * 1.6}s` }}>
                <span className="mr-[5px] align-[3px] font-mono text-[9px] tracking-[0.1em] text-[#7A6437]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {axis}.
              </li>
            ))}
          </ol>

          <div className="mt-7 flex max-w-sm gap-4 sm:ml-9">
            <span aria-hidden="true" className="mt-[9px] h-px w-6 shrink-0 bg-[#C8A96A]/50" />
            <p className="text-[13px] leading-[1.7] text-[#82828C]">
              Nobody passes or fails here. Five axes, one sitting.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-[10px]">
            <span aria-hidden="true" className="h-[5px] w-[5px] rotate-45 bg-[#8F7A4E]" />
            <span className={`${display.className} text-[15px] italic text-[#C8A96A]`}>
              Your link is in your invitation email.
            </span>
          </span>
          <span className="flex items-center gap-3 font-mono text-[8.5px] tracking-[0.2em] text-[#43434C]">
            <span>
              HIRING TEAM ONLY <span className="text-[#7A6437]">·</span> DELETED AFTER THE ROUND
            </span>
            <span aria-hidden="true" className="text-[#7A6437]">
              ·
            </span>
            <a
              href="/admin/login"
              className="text-[#7A6437] underline-offset-4 transition-colors hover:text-[#C8A96A] hover:underline focus-visible:text-[#C8A96A] focus-visible:underline focus-visible:outline-none"
            >
              HIRING TEAM SIGN IN
            </a>
          </span>
        </div>
      </div>
    </main>
  );
}
