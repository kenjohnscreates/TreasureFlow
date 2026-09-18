import { type FormEvent, useEffect, useState } from "react";
import { isEvmWalletAccount } from "@dynamic-labs-sdk/evm";
import { createWalletClientForWalletAccount } from "@dynamic-labs-sdk/evm/viem";
import {
  useConnectWithWalletProvider,
  useGetAvailableWalletProvidersData,
  useGetWalletAccounts,
  useRemoveWalletAccount,
} from "@dynamic-labs-sdk/react-hooks";
import { type Address } from "viem";
import { base } from "viem/chains";
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
  fetchFlashOrders,
  fetchStatus,
  fetchTreasury,
  postChat,
} from "./agent";
import { dynamicEnabled } from "./dynamicClient";

const CHAT_KEY_STORAGE = "treasureflow-chat-key";

type View = "home" | "orders" | "limits";
type LogLine = { role: "you" | "agent"; text: string };

const NOT_LIVE = "--";

export function App() {
  const [view, setView] = useState<View>("home");
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [treasury, setTreasury] = useState<TreasuryStatus | null>(null);
  const [flashOrders, setFlashOrders] = useState<FlashOrdersStatus | null>(null);
  useEffect(() => {
    fetchStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
    fetchTreasury()
      .then(setTreasury)
      .catch(() => setTreasury({ live: false, treasuryDisplay: null }));
    fetchFlashOrders()
      .then(setFlashOrders)
      .catch(() => setFlashOrders(null));
  }, []);
  useEffect(() => {
    const stage = document.getElementById("stage");
    const fit = () => {
      if (!stage) return;
      const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
      stage.style.transform = `scale(${s})`;
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  const p = status?.policy;
  const orders: FlashOrderLive[] = flashOrders?.orders?.length
    ? flashOrders.orders
    : FLASH_ORDERS.map((order) => ({ ...order, status: "resting" }));
  return (
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
            Orders
          </button>
          <button
            type="button"
            aria-current={view === "limits" ? "page" : undefined}
            onClick={() => setView("limits")}
          >
            Limits
          </button>
          <button type="button" disabled>
            Lend
          </button>
        </nav>
        <div className="head-right">
          <span className="dot" aria-hidden="true" />
          On Base
          <ConnectButton />
        </div>
      </header>
      <section className="wallets">
        <div className="wallet primary">
          <div className="tag">Company treasury</div>
          <h2>TreasureFlow</h2>
          <aside>
            <b>{status?.treasuryDisplay ?? shortAddr(status?.treasuryAddress)}</b>
          </aside>
        </div>
        <div className="wallet">
          <div className="tag">Your wallet</div>
          <h2>Founder</h2>
          <aside>
            <ExternalAddr />
          </aside>
        </div>
      </section>
      <section className={view === "home" ? "page on" : "page"} id="home">
        <div className="stack">
          <div className="panel">
            <h3>Balance</h3>
            <div className="cash">
              {liveAmt(treasury, "usdc")}
              <small>USDC</small>
            </div>
          </div>
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
              </tbody>
            </table>
          </div>
        </div>
        <ChatPanel dest={status?.payDestinations?.[0]} />
      </section>
      <section className={view === "orders" ? "page on" : "page"} id="orders">
        <div className="stack">
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
            <p className="muted">Buys more on dips. No performance claim.</p>
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
      <section className={view === "limits" ? "page on" : "page"} id="limits">
        <LimitsPanel policy={p} />
      </section>
    </div>
  );
}

function clampUsd(raw: string | undefined, fallback: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(0, Math.round(n)));
}

function LimitsPanel({ policy }: { policy: AgentStatus["policy"] | undefined }) {
  const [buffer, setBuffer] = useState(15);
  const [perCall, setPerCall] = useState(10);
  const [daily, setDaily] = useState(30);
  useEffect(() => {
    setBuffer(clampUsd(policy?.bufferUsdc, 15, 30));
    setPerCall(clampUsd(policy?.perCallCapUsdc, 10, 15));
    setDaily(clampUsd(policy?.dailyCapUsdc, 30, 30));
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
          max={30}
          step={1}
          value={buffer}
          aria-label="Keep this much cash"
          onChange={(e) => setBuffer(clampUsd(e.target.value, 15, 30))}
        />
      </div>
      <div>
        <dt>Max per payment</dt>
        <dd>{perCall}</dd>
        <span className="sub">Set in the wallet</span>
        <input
          type="range"
          min={0}
          max={15}
          step={1}
          value={perCall}
          aria-label="Max per payment"
          onChange={(e) => setPerCall(clampUsd(e.target.value, 10, 15))}
        />
      </div>
      <div>
        <dt>Left to send today</dt>
        <dd>{daily}</dd>
        <span className="sub">Rolling 24h, orchestrator</span>
        <input
          type="range"
          min={0}
          max={30}
          step={1}
          value={daily}
          aria-label="Left to send today"
          onChange={(e) => setDaily(clampUsd(e.target.value, 30, 30))}
        />
      </div>
    </dl>
  );
}

function liveAmt(
  treasury: TreasuryStatus | null,
  key: "usdc" | "usdt" | "nvdac",
): string {
  if (!treasury?.live) return NOT_LIVE;
  return treasury[key] ?? NOT_LIVE;
}

function shortAddr(addr: string | null | undefined): string {
  if (!addr) return "not created";
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function ConnectButton() {
  if (!dynamicEnabled) {
    return (
      <button className="btn ghost" type="button" disabled>
        Connect
      </button>
    );
  }
  return <ConnectControls compact />;
}

function ExternalAddr() {
  if (!dynamicEnabled) return <b>You sign</b>;
  return (
    <>
      <ConnectedLabel />
      <ConnectControls />
    </>
  );
}

function ConnectedLabel() {
  const { data: accounts = [] } = useGetWalletAccounts();
  const account = accounts[0];
  return <b>{account ? shortAddr(account.address) : "You sign"}</b>;
}

function ConnectControls({ compact }: { compact?: boolean }) {
  const { data: providers = [] } = useGetAvailableWalletProvidersData();
  const { mutateAsync: connect, isPending } = useConnectWithWalletProvider();
  const { data: accounts = [] } = useGetWalletAccounts();
  const { mutate: remove } = useRemoveWalletAccount();
  const account = accounts[0];
  if (compact) {
    if (account) {
      return (
        <button
          className="btn"
          type="button"
          onClick={() => remove({ walletAccount: account })}
        >
          Disconnect
        </button>
      );
    }
    const first = providers[0];
    return (
      <button
        className="btn"
        type="button"
        disabled={isPending}
        onClick={() => first && void connect({ walletProviderKey: first.key })}
      >
        {first ? `Connect ${String(first.key)}` : "Connect"}
      </button>
    );
  }
  if (account) return null;
  if (!providers.length) return <p className="muted">No injected wallet found.</p>;
  return (
    <div className="row">
      {providers.map((provider) => (
        <button
          className="btn ghost"
          type="button"
          key={provider.key}
          disabled={isPending}
          onClick={() => void connect({ walletProviderKey: provider.key })}
        >
          {String(provider.key)}
        </button>
      ))}
    </div>
  );
}

function ChatPanel({ dest }: { dest?: string }) {
  const chips = [
    { label: "Deposit 20 USDC", prompt: "deposit 20 USDC" },
    { label: "Sweep extra cash", prompt: "sweep" },
    { label: "LP stocks", prompt: "lp stocks" },
    {
      label: "Send 8",
      prompt: dest
        ? `send 8 USDC to ${dest}`
        : "send 8 USDC to 0x000000000000000000000000000000000000dEaD",
    },
    {
      label: "Send 50",
      prompt: dest
        ? `send 50 USDC to ${dest}`
        : "send 50 USDC to 0x000000000000000000000000000000000000dEaD",
    },
  ];
  const [prompt, setPrompt] = useState("Sweep extra cash");
  const [lines, setLines] = useState<LogLine[]>([
    {
      role: "agent",
      text: "Hi. I only move the company treasury, and only inside the limits.",
    },
  ]);
  const [unsigned, setUnsigned] = useState<UnsignedTx | null>(null);
  const [encoded, setEncoded] = useState<UnsignedTx[]>([]);
  const [busy, setBusy] = useState(false);
  const [chatKey, setChatKey] = useState(() => {
    try {
      return sessionStorage.getItem(CHAT_KEY_STORAGE) ?? "";
    } catch {
      return "";
    }
  });

  function persistChatKey(value: string) {
    setChatKey(value);
    try {
      if (value) sessionStorage.setItem(CHAT_KEY_STORAGE, value);
      else sessionStorage.removeItem(CHAT_KEY_STORAGE);
    } catch {
      /* private mode */
    }
  }

  async function send(next: string) {
    const text = next.trim();
    if (!text) return;
    setBusy(true);
    setLines((cur) => [...cur, { role: "you", text }]);
    try {
      const reply = await postChat(text, chatKey || undefined);
      setLines((cur) => [...cur, { role: "agent", text: reply.summary }]);
      setUnsigned(reply.kind === "deposit" ? (reply.unsignedTx ?? null) : null);
      setEncoded(reply.encodedTxs ?? []);
    } catch {
      setLines((cur) => [
        ...cur,
        { role: "agent", text: "Agent not reachable. Run pnpm agent." },
      ]);
      setUnsigned(null);
      setEncoded([]);
    } finally {
      setBusy(false);
      setPrompt("");
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(prompt);
  }

  return (
    <aside className="panel chat grow">
      <h3>Ask TreasureFlow</h3>
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
      <div className="log">
        {lines.map((line, i) => (
          <div className={"msg " + line.role} key={i}>
            <span>{line.role === "you" ? "You" : "TreasureFlow"}</span>
            <p>{line.text}</p>
          </div>
        ))}
        {unsigned ? (
          dynamicEnabled ? (
            <SignDeposit tx={unsigned} />
          ) : (
            <p className="muted">Connect is off until web/.env has the Dynamic id.</p>
          )
        ) : null}
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
      </div>
      <form className="composer" onSubmit={onSubmit}>
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          aria-label="Ask TreasureFlow"
        />
        <button className="btn" type="submit" disabled={busy}>
          Send
        </button>
      </form>
      <label className="composer-key">
        <span>Write key</span>
        <input
          type="password"
          autoComplete="off"
          aria-label="Chat write key"
          value={chatKey}
          onChange={(e) => persistChatKey(e.target.value)}
        />
      </label>
    </aside>
  );
}

function SignDeposit({ tx }: { tx: UnsignedTx }) {
  const { data: accounts = [] } = useGetWalletAccounts();
  const account = accounts.find(isEvmWalletAccount);
  const [hash, setHash] = useState("");
  const [err, setErr] = useState("");
  if (!account) {
    return <p className="muted">Connect your wallet, then sign the deposit.</p>;
  }
  const connected = account;
  async function sign() {
    setErr("");
    if (tx.chainId !== base.id) {
      setErr("Deposit is Base only.");
      return;
    }
    const walletClient = await createWalletClientForWalletAccount({
      walletAccount: connected,
    });
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
