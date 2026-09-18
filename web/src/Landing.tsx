import { useEffect, useRef, useState } from "react";

function enterApp() {
  window.history.pushState({}, "", "/app");
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function sine(
  loopWidth: number,
  periodWidth: number,
  y: number,
  amp: number,
  periods: number,
  phase = 0,
) {
  const n = 160;
  const pts: string[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = t * loopWidth;
    const py = y + Math.sin(phase + (x / periodWidth) * Math.PI * 2 * periods) * amp;
    pts.push(`${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${py.toFixed(2)}`);
  }
  return pts.join(" ");
}

type Cargo = "usd" | "usdc" | "nvda" | "eur" | "gbp" | "stock" | "btc" | "eth" | "aapl";

const WAVE = 800;

type WaveSpec = {
  y: number;
  amp: number;
  periods: number;
  phase: number;
  className: string;
  cargo: { t: number; kind: Cargo }[];
};

const WAVES: WaveSpec[] = [
  {
    y: 48,
    amp: 20,
    periods: 2,
    phase: 0.2,
    className: "flow-a",
    cargo: [
      { t: 0.12, kind: "usd" },
      { t: 0.38, kind: "nvda" },
      { t: 0.71, kind: "btc" },
    ],
  },
  {
    y: 108,
    amp: 26,
    periods: 1,
    phase: 1.4,
    className: "flow-b",
    cargo: [
      { t: 0.22, kind: "usdc" },
      { t: 0.55, kind: "eth" },
      { t: 0.84, kind: "stock" },
    ],
  },
  {
    y: 168,
    amp: 18,
    periods: 3,
    phase: 0.5,
    className: "flow-c",
    cargo: [
      { t: 0.08, kind: "aapl" },
      { t: 0.47, kind: "usd" },
      { t: 0.91, kind: "gbp" },
    ],
  },
  {
    y: 228,
    amp: 28,
    periods: 2,
    phase: 2.1,
    className: "flow-d",
    cargo: [
      { t: 0.31, kind: "eur" },
      { t: 0.63, kind: "btc" },
      { t: 0.78, kind: "aapl" },
    ],
  },
  {
    y: 292,
    amp: 16,
    periods: 3,
    phase: 1.0,
    className: "flow-e",
    cargo: [
      { t: 0.18, kind: "eth" },
      { t: 0.52, kind: "nvda" },
      { t: 0.88, kind: "usdc" },
    ],
  },
  {
    y: 348,
    amp: 22,
    periods: 1,
    phase: 2.8,
    className: "flow-f",
    cargo: [
      { t: 0.27, kind: "usd" },
      { t: 0.69, kind: "eur" },
      { t: 0.88, kind: "stock" },
    ],
  },
];

function Ticker({
  label,
  fill,
  stroke,
  ink,
}: {
  label: string;
  fill: string;
  stroke: string;
  ink: string;
}) {
  const w = label.length > 3 ? 40 : 34;
  return (
    <>
      <rect
        x={-w / 2}
        y="-9"
        width={w}
        height="18"
        rx="4"
        fill={fill}
        stroke={stroke}
        strokeWidth="1.4"
      />
      <text y="4" textAnchor="middle" fontSize="8" fontWeight="800" fill={ink}>
        {label}
      </text>
    </>
  );
}

function TokenMark({ kind }: { kind: Cargo }) {
  if (kind === "usd") {
    return (
      <g className="flow-token">
        <circle r="11" fill="#10cbff" />
        <circle r="8" fill="none" stroke="#041018" strokeWidth="1.5" />
        <text y="4" textAnchor="middle" fontSize="12" fontWeight="800" fill="#041018">
          $
        </text>
      </g>
    );
  }
  if (kind === "usdc") {
    return (
      <g className="flow-token">
        <circle r="11" fill="#ffffff" />
        <circle r="8" fill="none" stroke="#10cbff" strokeWidth="1.6" />
        <text y="4" textAnchor="middle" fontSize="9" fontWeight="800" fill="#041018">
          $
        </text>
      </g>
    );
  }
  if (kind === "nvda") {
    return (
      <g className="flow-token">
        <Ticker label="NVDA" fill="#041018" stroke="#10cbff" ink="#10cbff" />
      </g>
    );
  }
  if (kind === "aapl") {
    return (
      <g className="flow-token">
        <Ticker label="AAPL" fill="#041018" stroke="#ffffff" ink="#ffffff" />
      </g>
    );
  }
  if (kind === "btc") {
    return (
      <g className="flow-token">
        <Ticker label="BTC" fill="#10cbff" stroke="#041018" ink="#041018" />
      </g>
    );
  }
  if (kind === "eth") {
    return (
      <g className="flow-token">
        <Ticker label="ETH" fill="#ffffff" stroke="#10cbff" ink="#041018" />
      </g>
    );
  }
  if (kind === "eur") {
    return (
      <g className="flow-token">
        <circle r="11" fill="#10cbff" />
        <text y="4.5" textAnchor="middle" fontSize="13" fontWeight="800" fill="#041018">
          €
        </text>
      </g>
    );
  }
  if (kind === "gbp") {
    return (
      <g className="flow-token">
        <circle r="11" fill="#ffffff" />
        <text y="4.5" textAnchor="middle" fontSize="12" fontWeight="800" fill="#041018">
          £
        </text>
      </g>
    );
  }
  return (
    <g className="flow-token">
      <rect
        x="-16"
        y="-9"
        width="32"
        height="18"
        rx="4"
        fill="#041018"
        stroke="#ffffff"
        strokeWidth="1.4"
      />
      <polyline
        points="-9,4 -3,-2 2,2 9,-5"
        fill="none"
        stroke="#10cbff"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

function FlowToken({
  kind,
  x,
  y,
  yScale,
}: {
  kind: Cargo;
  x: number;
  y: number;
  yScale: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(1 ${yScale})`}>
      <TokenMark kind={kind} />
    </g>
  );
}

function cargoY(wave: WaveSpec, t: number) {
  return wave.y + Math.sin(wave.phase + t * Math.PI * 2 * wave.periods) * wave.amp;
}

function CapitalFlow() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [yScale, setYScale] = useState(1);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const read = () => {
      const svg = root.querySelector(":scope > .flow-track > svg");
      if (!(svg instanceof SVGSVGElement)) return;
      const { width, height } = svg.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      setYScale(width / (WAVE * 2) / (height / 400));
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(root);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="capital-flow" ref={rootRef} aria-hidden="true">
      {WAVES.map((wave) => (
        <div key={wave.className} className={`flow-track ${wave.className}`}>
          <svg viewBox={`0 0 ${WAVE * 2} 400`} preserveAspectRatio="none">
            <path d={sine(WAVE * 2, WAVE, wave.y, wave.amp, wave.periods, wave.phase)} />
            {wave.cargo.flatMap((item) =>
              [0, WAVE].map((shift) => (
                <FlowToken
                  key={`${item.kind}-${item.t}-${shift}`}
                  kind={item.kind}
                  x={item.t * WAVE + shift}
                  y={cargoY(wave, item.t)}
                  yScale={yScale}
                />
              )),
            )}
          </svg>
        </div>
      ))}
    </div>
  );
}

const FAQ = [
  {
    q: "Why would I want an agentic treasury?",
    a: "You are a founder, not a treasurer. Until you are revenue positive, runway is the whole game, and even after that leftover cash is leftover time. Nobody on a small team should be clicking around DeFi at 1am. An agentic treasury works idle USDC overnight, inside limits you set once, and still pays a vendor when you type a sentence.",
  },
  {
    q: "Can idle cash actually add runway?",
    a: "Cash that sits is weeks you do not get back. Cash that works overnight is extra time before you raise or hit revenue. TreasureFlow does not quote a forward number. The screen shows trailing fee yield from the pool you are in. The point is the money is growing instead of waiting.",
  },
  {
    q: "Can the agent spend my personal wallet?",
    a: "No. You connect one external wallet for rewards and deposits. You sign those yourself. The agent only moves the company treasury it already holds.",
  },
  {
    q: "Is this a yield promise?",
    a: "No. TreasureFlow is not a fund and not a rate. You keep your own USDC. Fee yield is whatever the pool paid, shown after the fact.",
  },
  {
    q: "What happens when I need to pay someone?",
    a: "Type the amount and the address. If the cash buffer is short, the agent unwinds only the shortfall from the pool, then sends. Payments over your cap do not go out.",
  },
  {
    q: "Who is this for?",
    a: "Founders holding their own company USDC. One company, one policy, one agent. Not other people's money.",
  },
  {
    q: "What stops a bad send?",
    a: "An allowlist, a per-payment cap in the connected wallet, a daily cap, and a cash buffer that is never swept. If a send is over the cap, nothing moves.",
  },
];

export function Landing() {
  useEffect(() => {
    document.documentElement.classList.add("page-landing");
    document.body.classList.add("page-landing");
    return () => {
      document.documentElement.classList.remove("page-landing");
      document.body.classList.remove("page-landing");
    };
  }, []);

  return (
    <div className="landing">
      <header className="landing-top">
        <img src="/logo.svg" alt="TreasureFlow" />
      </header>
      <main className="landing-hero">
        <div className="landing-copy">
          <h1>
            Idle capital should always be
            <br />
            <em>adding runway</em>.
          </h1>
          <p className="landing-sub">
            TreasureFlow is an agentic treasury solution for companies. We take idle
            company assets and put them to work to earn for you. Auto-rebalancing based on
            rules and available every time you need to pay someone.
          </p>
          <a className="btn landing-cta" href="/app" onClick={enterApp}>
            Enter app
          </a>
        </div>
        <CapitalFlow />
      </main>
      <section className="landing-faq" aria-labelledby="faq-title">
        <h2 id="faq-title">FAQ</h2>
        {FAQ.map((item) => (
          <details key={item.q}>
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))}
      </section>
    </div>
  );
}
