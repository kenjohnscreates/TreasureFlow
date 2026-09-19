import { type FormEvent, useEffect, useState } from "react";
import { type Address } from "viem";
import { base } from "viem/chains";
import { useAccount, useSwitchChain, useWalletClient } from "wagmi";
import { ExternalAddr } from "./externalWallet";
import {
  FLASH_ORDERS,
  LIVE_RECEIPTS,
  basescanTxUrl,
  truncateHash,
} from "../../src/demo/evidence";
import {
  type AgentStatus,
  type FlashOrderLive,
  type FlashOrdersStatus,
  type TreasuryStatus,
  type UnsignedTx,
  emptyTreasury,
  fetchChallenge,
  fetchFlashOrders,
  fetchFounderOk,
  fetchStatus,
  fetchTreasury,
  postChat,
  postPause,
  TREASURY_POLL_MS,
} from "./agent";

type View = "home" | "orders";
type LogLine = { role: "you" | "agent"; text: string };
type PendingWrite = {
  prompt: string;
  kind: string;
  amount: string;
  dest: string;
};

const NOT_LIVE = "--";
const SEND_CHIP = "send 8 USDC to PAY_DEST_1";

function needsConfirm(reply: { kind: string; plan: Record<string, string | number | boolean> }): boolean {
  const action = reply.plan.action;
  if (action === "rejected") return false;
  if (reply.kind === "pay") return action === "pay" || action === "unwind_and_pay";
  if (reply.kind === "sweep") return action === "add_liquidity" || action === "noop";
  if (reply.kind === "lp_stocks") return action === "lp_stocks";
  if (reply.kind === "demo_flash") return action === "demo_flash" || action === "noop";
  return false;
}

export function App() {
  const [view, setView] = useState<View>("home");
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [treasury, setTreasury] = useState<TreasuryStatus | null>(null);
  const [flashOrders, setFlashOrders] = useState<FlashOrdersStatus | null>(null);
  const [chatKey, setChatKey] = useState("");
  function refreshTreasury() {
    fetchTreasury()
      .then(setTreasury)
      .catch(() => setTreasury(emptyTreasury()));
  }
  useEffect(() => {
    fetchStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
    fetchFlashOrders()
      .then(setFlashOrders)
      .catch(() => setFlashOrders(null));
  }, []);
  useEffect(() => {
    refreshTreasury();
    const id = window.setInterval(refreshTreasury, TREASURY_POLL_MS);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    const stage = document.getElementById("stage");
    const frame = document.getElementById("stage-frame");
    if (!stage || !frame) return;
    const fit = () => {
      const s = window.innerWidth / 1920;
      stage.style.transform = `scale(${s})`;
      frame.style.height = `${stage.scrollHeight * s}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(stage);
    window.addEventListener("resize", fit);
    return () => {
      window.removeEventListener("resize", fit);
      ro.disconnect();
    };
  }, [view]);
  const p = status?.policy;
  const orders: FlashOrderLive[] = flashOrders?.orders?.length
    ? flashOrders.orders
    : FLASH_ORDERS.map((order) => ({ ...order, status: "resting" }));
  return (
    <div className="stage-frame" id="stage-frame">
      <div className="stage" id="stage">
        <header className="top">
          <img src="/logo.svg" alt="TreasureFlow" />
          <nav>
            <button
              type="button"
              aria-current={view === "home" ? "page" : undefined}
              onClick={() => setView("home")}
            >
              Home
            </button>
            <button
              type="button"
              aria-current={view === "orders" ? "page" : undefined}
              onClick={() => setView("orders")}
            >
              Limits & Orders
            </button>
          </nav>
          <div className="head-right">
            <PauseBar
              paused={status?.paused === true}
              chatKey={chatKey}
              setChatKey={setChatKey}
              onStatus={setStatus}
              showStatus={false}
            />
            <span className="dot" aria-hidden="true" />
            On Base
          </div>
        </header>
        <section className="wallets">
          <div className="wallet primary">
            <div className="tag">Company treasury</div>
            <h2>TreasureFlow</h2>
            <aside>
              <b>{status?.treasuryDisplay ?? "not created"}</b>
            </aside>
            <div className="cash">
              {liveTotalUsd(treasury)}
              <small>USD</small>
            </div>
            <div className="wallet-bals treasury-held">
              <span>ETH {liveEthLine(treasury)}</span>
              <span>USDT {liveAmt(treasury, "usdt")}</span>
              <span>NVDAc {liveAmt(treasury, "nvdac")}</span>
            </div>
          </div>
          <div className="wallet">
            <div className="tag">External Wallet</div>
            <h2>Company</h2>
            <aside>
              <ExternalAddr usdcToken={status?.tokens.usdc} />
            </aside>
          </div>
        </section>
        <section className={view === "home" ? "page on" : "page"} id="home">
          <div className="stack">
            <div className="panel grow">
              <h3>Active positions</h3>
              <table>
                <thead>
                  <tr>
                    <th>Position</th>
                    <th>Asset</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Cash</td>
                    <td>USDC</td>
                    <td className="mono">{liveAmt(treasury, "usdc")}</td>
                  </tr>
                  <tr>
                    <td>Held</td>
                    <td>USDT</td>
                    <td className="mono">{liveAmt(treasury, "usdt")}</td>
                  </tr>
                  <tr>
                    <td>Held</td>
                    <td>NVDAc</td>
                    <td className="mono">{liveAmt(treasury, "nvdac")}</td>
                  </tr>
                  {treasury?.live && treasury.eth !== undefined ? (
                    <tr>
                      <td>Held</td>
                      <td>ETH</td>
                      <td className="mono">{treasury.eth}</td>
                    </tr>
                  ) : null}
                  {hasSammLp(treasury) ? (
                    <tr>
                      <td>LP</td>
                      <td>USDC/USDT sAMM</td>
                      <td className="mono">{sammLine(treasury)}</td>
                    </tr>
                  ) : null}
                  {(treasury?.live ? treasury.slipstream : undefined)?.map((row) => (
                    <tr key={row.tokenId}>
                      <td>LP</td>
                      <td>NVDAc Slipstream</td>
                      <td className="mono">{slipstreamLine(row)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <ChatPanel
            chatKey={chatKey}
            setChatKey={setChatKey}
            policy={p}
            paused={status?.paused === true}
            onTreasuryRefresh={refreshTreasury}
          />
        </section>
        <section className={view === "orders" ? "page on" : "page"} id="orders">
          <div className="stack">
            <LimitsPanel policy={p} />
            <div className="panel">
              <h3>Buy-the-dip orders</h3>
              <table>
                <thead>
                  <tr>
                    <th>Rung</th>
                    <th>Price</th>
                    <th>Qty</th>
                    <th>Status</th>
                    <th>Id</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td>{order.rungPct}%</td>
                      <td className="mono">${order.limitPriceUsd}</td>
                      <td className="mono">{order.qtyUsdc}</td>
                      <td>{order.status || "resting"}</td>
                      <td className="mono">{order.id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="panel grow">
              <h3>Receipts</h3>
              <table>
                <thead>
                  <tr>
                    <th>Tx</th>
                    <th>Note</th>
                    <th>BaseScan</th>
                  </tr>
                </thead>
                <tbody>
                  {LIVE_RECEIPTS.map((receipt) => (
                    <tr key={receipt.id}>
                      <td>{receipt.label}</td>
                      <td className="muted">{receipt.note}</td>
                      <td>
                        <a
                          className="mono"
                          href={basescanTxUrl(receipt.hash)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {truncateHash(receipt.hash)}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function clampUsd(raw: string | undefined, fallback: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(0, Math.round(n)));
}

function LimitsPanel({ policy }: { policy: AgentStatus["policy"] | undefined }) {
  const [buffer, setBuffer] = useState(() => clampUsd(policy?.bufferUsdc, 15, 100));
  const [perCall, setPerCall] = useState(() => clampUsd(policy?.perCallCapUsdc, 10, 100));
  const [daily, setDaily] = useState(() => clampUsd(policy?.dailyCapUsdc, 30, 100));
  useEffect(() => {
    setBuffer(clampUsd(policy?.bufferUsdc, 15, 100));
    setPerCall(clampUsd(policy?.perCallCapUsdc, 10, 100));
    setDaily(clampUsd(policy?.dailyCapUsdc, 30, 100));
  }, [policy]);
  return (
    <dl className="limits">
      <div>
        <dt>Keep this much cash</dt>
        <dd>{buffer}</dd>
        <span className="sub">Never swept overnight</span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={buffer}
          aria-label="Keep this much cash"
          onChange={(e) => setBuffer(clampUsd(e.target.value, 15, 100))}
        />
      </div>
      <div>
        <dt>Max per payment</dt>
        <dd>{perCall}</dd>
        <span className="sub">In the agent</span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={perCall}
          aria-label="Max per payment"
          onChange={(e) => setPerCall(clampUsd(e.target.value, 10, 100))}
        />
      </div>
      <div>
        <dt>Left to send today</dt>
        <dd>{daily}</dd>
        <span className="sub">Rolling 24h, orchestrator</span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={daily}
          aria-label="Left to send today"
          onChange={(e) => setDaily(clampUsd(e.target.value, 30, 100))}
        />
      </div>
    </dl>
  );
}

function PauseBar({
  paused,
  chatKey,
  setChatKey,
  onStatus,
  showStatus = true,
}: {
  paused: boolean;
  chatKey: string;
  setChatKey: (value: string) => void;
  onStatus: (status: AgentStatus) => void;
  showStatus?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function toggle(next: boolean) {
    setBusy(true);
    setErr("");
    try {
      await postPause(next, chatKey || undefined);
      const nextStatus = await fetchStatus();
      onStatus(nextStatus);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "pause failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="pause-bar">
      <div className="pause-bar-row">
        {showStatus ? (
          <span className={paused ? "ok" : "muted"}>{paused ? "Paused" : "Live"}</span>
        ) : null}
        <button
          className="btn ghost"
          type="button"
          disabled={busy}
          onClick={() => void toggle(true)}
        >
          Pause
        </button>
        <button
          className="btn ghost"
          type="button"
          disabled={busy}
          onClick={() => void toggle(false)}
        >
          Resume
        </button>
        <label className="composer-key">
          <span>Write key</span>
          <input
            type="password"
            autoComplete="off"
            aria-label="Chat write key"
            value={chatKey}
            onChange={(e) => setChatKey(e.target.value)}
          />
        </label>
      </div>
      {err ? <span className="muted">{err}</span> : null}
    </div>
  );
}

function liveAmt(
  treasury: TreasuryStatus | null,
  key: "usdc" | "usdt" | "nvdac" | "eth",
): string {
  if (!treasury?.live) return NOT_LIVE;
  return treasury[key] ?? NOT_LIVE;
}

function liveTotalUsd(treasury: TreasuryStatus | null): string {
  if (!treasury?.live || treasury.totalUsd === undefined) return NOT_LIVE;
  return fmtUsd(treasury.totalUsd);
}

function hasSammLp(treasury: TreasuryStatus | null): treasury is TreasuryStatus {
  if (!treasury?.live) return false;
  if (treasury.sammLpUsdc === undefined && treasury.sammLpUsdt === undefined) return false;
  const usdc = Number(treasury.sammLpUsdc ?? "0");
  const usdt = Number(treasury.sammLpUsdt ?? "0");
  return (Number.isFinite(usdc) && usdc > 0) || (Number.isFinite(usdt) && usdt > 0);
}

function sammLine(treasury: TreasuryStatus): string {
  const usdc = treasury.sammLpUsdc ?? "0";
  const usdt = treasury.sammLpUsdt ?? "0";
  const pair = `${usdc} USDC + ${usdt} USDT`;
  const usd = Number(usdc) + Number(usdt);
  if (!Number.isFinite(usd) || usd <= 0) return pair;
  return `${pair} ≈ $${fmtUsd(String(usd))}`;
}

function slipstreamLine(row: { tokenId: string; staked: boolean; usd?: string }): string {
  let line = `NFT #${row.tokenId}`;
  if (row.staked) line += " staked";
  if (row.usd !== undefined) line += ` ≈ $${fmtUsd(row.usd)}`;
  return line;
}

function fmtUsd(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function liveEthLine(treasury: TreasuryStatus | null): string {
  if (!treasury?.live) return NOT_LIVE;
  const eth = treasury.eth ?? NOT_LIVE;
  if (treasury.ethUsdValue === undefined) return eth;
  return `${eth} ≈ $${fmtUsd(treasury.ethUsdValue)}`;
}

function shortAddr(addr: string | null | undefined): string {
  if (!addr) return "not created";
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function ChatPanel({
  chatKey,
  setChatKey,
  policy,
  paused,
  onTreasuryRefresh,
}: {
  chatKey: string;
  setChatKey: (value: string) => void;
  policy: AgentStatus["policy"] | undefined;
  paused: boolean;
  onTreasuryRefresh: () => void;
}) {
  const chips = [
    { label: "Deposit 20 USDC", prompt: "deposit 20 USDC" },
    { label: "Sweep extra cash", prompt: "sweep" },
    { label: "LP stocks", prompt: "lp stocks" },
    {
      label: "Buy 1 USDC cbBTC",
      prompt: "buy 1 USDC of cbBTC 0.01 percent below spot",
    },
    { label: "Send 8", prompt: SEND_CHIP },
  ];
  const [prompt, setPrompt] = useState("");
  const [lines, setLines] = useState<LogLine[]>([
    {
      role: "agent",
      text: "Hi. I only move the company treasury, and only inside the limits.",
    },
  ]);
  const [unsigned, setUnsigned] = useState<UnsignedTx | null>(null);
  const [encoded, setEncoded] = useState<UnsignedTx[]>([]);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingWrite | null>(null);
  const [confirmErr, setConfirmErr] = useState("");
  const [confirmBusy, setConfirmBusy] = useState(false);

  async function send(next: string) {
    const text = next.trim();
    if (!text) return;
    setBusy(true);
    setLines((cur) => [...cur, { role: "you", text }]);
    try {
      const reply = await postChat(text);
      setLines((cur) => [...cur, { role: "agent", text: reply.summary }]);
      onTreasuryRefresh();
      setUnsigned(reply.kind === "deposit" ? (reply.unsignedTx ?? null) : null);
      setEncoded(reply.encodedTxs ?? []);
      if (needsConfirm(reply)) {
        setPending({
          prompt: text,
          kind: reply.kind,
          amount: String(reply.plan.amountUsdc ?? reply.plan.qtyUsdc ?? ""),
          dest: String(reply.plan.to ?? ""),
        });
        setConfirmErr("");
      } else {
        setPending(null);
      }
    } catch {
      setLines((cur) => [
        ...cur,
        { role: "agent", text: "Agent not reachable. Run pnpm agent." },
      ]);
      setUnsigned(null);
      setEncoded([]);
      setPending(null);
    } finally {
      setBusy(false);
      setPrompt("");
    }
  }

  function cancelConfirm() {
    setPending(null);
    setConfirmErr("");
    setChatKey("");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(prompt);
  }

  return (
    <aside className="panel chat grow">
      <header className="chat-head">
        <h3>Ask TreasureFlow</h3>
        <span className={paused ? "chat-status is-paused" : "chat-status is-live"}>
          {paused ? "Paused" : "Live"}
        </span>
      </header>
      <div className="log">
        {lines.map((line, i) => (
          <div className={"msg " + line.role} key={i}>
            <span>{line.role === "you" ? "You" : "TreasureFlow"}</span>
            <p>{line.text}</p>
          </div>
        ))}
        {unsigned ? <SignDeposit tx={unsigned} /> : null}
        {encoded.length ? (
          <div>
            {encoded.map((tx) => (
              <p className="muted" key={tx.label ?? tx.to}>
                {tx.label}: {shortAddr(tx.to)}
              </p>
            ))}
            <p className="muted">Treasury signs these later. Not your wallet.</p>
          </div>
        ) : null}
        {pending ? (
          <ConfirmModal
            pending={pending}
            policy={policy}
            chatKey={chatKey}
            busy={confirmBusy}
            setBusy={setConfirmBusy}
            err={confirmErr}
            setErr={setConfirmErr}
            onCancel={cancelConfirm}
            onReply={(summary, sent) => {
              setLines((cur) => [...cur, { role: "agent", text: summary }]);
              onTreasuryRefresh();
              if (sent) {
                setPending(null);
                setChatKey("");
              }
            }}
          />
        ) : null}
      </div>
      <form className="composer" onSubmit={onSubmit}>
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          aria-label="Ask TreasureFlow"
          placeholder="Deposit, sweep, or send"
        />
        <button className="btn" type="submit" disabled={busy}>
          Send
        </button>
      </form>
      <section className="chip-block" aria-label="Quick actions">
        <div className="chips">
          {chips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              disabled={busy}
              onClick={() => void send(chip.prompt)}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
}

function ConfirmModal({
  pending,
  policy,
  chatKey,
  busy,
  setBusy,
  err,
  setErr,
  onCancel,
  onReply,
}: {
  pending: PendingWrite;
  policy: AgentStatus["policy"] | undefined;
  chatKey: string;
  busy: boolean;
  setBusy: (value: boolean) => void;
  err: string;
  setErr: (value: string) => void;
  onCancel: () => void;
  onReply: (summary: string, sent: boolean) => void;
}) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  async function confirm() {
    setBusy(true);
    setErr("");
    try {
      if (!address || !walletClient) {
        setErr("Connect the founder wallet.");
        return;
      }
      const challenge = await fetchChallenge();
      const sig = await walletClient.signMessage({ message: challenge.message });
      const reply = await postChat(pending.prompt, {
        chatKey: chatKey || undefined,
        nonce: challenge.nonce,
        sig,
      });
      onReply(reply.summary, reply.plan.sent === true);
      if (reply.plan.sent !== true) setErr(reply.summary);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "confirm failed");
    } finally {
      setBusy(false);
    }
  }
  const caps = `${policy?.bufferUsdc ?? "15"} / ${policy?.perCallCapUsdc ?? "10"} / ${policy?.dailyCapUsdc ?? "30"}`;
  const copy =
    pending.kind === "sweep"
      ? `Sweep extra cash into USDC/USDT. Caps ${caps}.`
      : pending.kind === "lp_stocks"
        ? `LP stocks (NVDAc). Notional under 15 USDC. Caps ${caps}.`
        : pending.kind === "demo_flash"
          ? `Buy 1 USDC of cbBTC 0.01 percent below spot. Buys more on dips. No performance claim. Caps ${caps}.`
          : `Send ${pending.amount} USDC to ${pending.dest}. Caps ${caps}.`;
  return (
    <div className="confirm-modal" role="dialog" aria-label="Confirm">
      <p>{copy}</p>
      {err ? <p className="muted">{err}</p> : null}
      <div className="row">
        <button
          className="btn"
          type="button"
          disabled={busy}
          onClick={() => void confirm()}
        >
          Confirm
        </button>
        <button className="btn ghost" type="button" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function SignDeposit({ tx }: { tx: UnsignedTx }) {
  const { address, chainId } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();
  const [hash, setHash] = useState("");
  const [err, setErr] = useState("");
  const [founderOk, setFounderOk] = useState(false);
  useEffect(() => {
    if (!address) {
      setFounderOk(false);
      return;
    }
    fetchFounderOk(address)
      .then(setFounderOk)
      .catch(() => setFounderOk(false));
  }, [address]);
  if (!address || !founderOk) {
    return <p className="muted">Connect the founder wallet.</p>;
  }
  async function sign() {
    setErr("");
    if (tx.chainId !== base.id) {
      setErr("Deposit is Base only.");
      return;
    }
    if (!walletClient) {
      setErr("Connect the founder wallet.");
      return;
    }
    if (chainId !== base.id) {
      await switchChainAsync({ chainId: base.id });
    }
    const sent = await walletClient.sendTransaction({
      chain: base,
      to: tx.to as Address,
      data: tx.data,
      value: 0n,
    });
    setHash(sent);
  }
  return (
    <div className="row">
      <button
        className="btn"
        type="button"
        onClick={() => void sign().catch((e: unknown) => setErr(String(e)))}
      >
        Sign deposit
      </button>
      {hash ? <span className="mono">{shortAddr(hash)}</span> : null}
      {err ? <span className="muted">{err}</span> : null}
    </div>
  );
}
