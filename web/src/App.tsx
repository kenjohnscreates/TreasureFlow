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
  CHAT_DRY_COPY,
  FLASH_LADDER_COPY,
  FLASH_ORDERS,
  LIVE_RECEIPTS,
  basescanTxUrl,
  truncateHash,
} from "../../src/demo/evidence";
import {
  type AgentStatus,
  type ChatReply,
  type FlashOrdersStatus,
  type TreasuryStatus,
  type UnsignedTx,
  fetchFlashOrders,
  fetchStatus,
  fetchTreasury,
  postChat,
} from "./agent";
import { dynamicEnabled } from "./dynamicClient";

export function App() {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [treasury, setTreasury] = useState<TreasuryStatus | null>(null);
  const [flashOrders, setFlashOrders] = useState<FlashOrdersStatus | null>(null);
  const [statusErr, setStatusErr] = useState("");
  useEffect(() => {
    fetchStatus()
      .then(setStatus)
      .catch(() => setStatusErr("Agent not reachable. Run pnpm agent."));
    fetchTreasury()
      .then(setTreasury)
      .catch(() => setTreasury({ live: false, treasuryDisplay: null }));
    fetchFlashOrders()
      .then(setFlashOrders)
      .catch(() => setFlashOrders(null));
  }, []);
  return (
    <>
      <header>
        <h1>TreasureFlow</h1>
        <p className="lede">
          One external rewards wallet (manual sign). Bankr embedded wallet is the company
          treasury. Chat plans sweep, stock LP, pay, and limits. Trailing fee yield only.
        </p>
      </header>
      {statusErr ? <p className="muted">{statusErr}</p> : null}
      <PolicyChips status={status} />
      <div className="grid two">
        <Wallets status={status} treasury={treasury} />
        <LendPanel />
      </div>
      <div className="grid two">
        <ReceiptsPanel />
        <FlashLadderPanel live={flashOrders} />
      </div>
      <ChatBox dest={status?.payDestinations?.[0]} />
    </>
  );
}

function PolicyChips({ status }: { status: AgentStatus | null }) {
  const p = status?.policy;
  return (
    <div className="chips">
      <div className="chip">
        buffer <b>{p?.bufferUsdc ?? "15"}</b>
      </div>
      <div className="chip">
        per-call <b>{p?.perCallCapUsdc ?? "10"}</b>
      </div>
      <div className="chip">
        daily <b>{p?.dailyCapUsdc ?? "30"}</b>
      </div>
      <span className="muted">USDC. Fee yield, not APY.</span>
    </div>
  );
}

function Wallets({
  status,
  treasury,
}: {
  status: AgentStatus | null;
  treasury: TreasuryStatus | null;
}) {
  return (
    <section className="card">
      <h2>Wallets</h2>
      <p>
        <b>Treasury</b> (Bankr embedded, in-app)
      </p>
      <p className="mono">{status?.treasuryAddress ?? "not set"}</p>
      {status?.treasuryDisplay ? (
        <p className="muted">shown truncated in logs as {status.treasuryDisplay}</p>
      ) : null}
      <IdleCash treasury={treasury} />
      <p>
        <b>External rewards wallet</b>
      </p>
      <p className="muted">secondary, read-only for the agent. Manual sign only.</p>
      {dynamicEnabled ? (
        <ConnectControls />
      ) : (
        <p>
          fill VITE_DYNAMIC_ENVIRONMENT_ID in web/.env to Connect the founder wallet. Does
          not create a server wallet.
        </p>
      )}
    </section>
  );
}

function ConnectControls() {
  const { data: providers = [] } = useGetAvailableWalletProvidersData();
  const { mutateAsync: connect, isPending } = useConnectWithWalletProvider();
  const { data: accounts = [] } = useGetWalletAccounts();
  const { mutate: remove } = useRemoveWalletAccount();
  const account = accounts[0];
  return (
    <div>
      {account ? (
        <p className="mono">{account.address}</p>
      ) : (
        <p className="muted">Not connected</p>
      )}
      <div className="row">
        {providers.map((provider) => (
          <button
            key={provider.key}
            type="button"
            disabled={isPending}
            onClick={() => void connect({ walletProviderKey: provider.key })}
          >
            Connect {provider.metadata.displayName}
          </button>
        ))}
        {account ? (
          <button
            className="ghost"
            type="button"
            onClick={() => remove({ walletAccount: account })}
          >
            Disconnect
          </button>
        ) : null}
      </div>
    </div>
  );
}

function IdleCash({ treasury }: { treasury: TreasuryStatus | null }) {
  return (
    <div className="idle-cash">
      <p>
        <b>Idle cash</b>
      </p>
      {treasury?.live ? (
        <ul className="balances">
          <li>
            ETH <span className="mono">{treasury.eth ?? "0"}</span>
          </li>
          <li>
            USDC <span className="mono">{treasury.usdc ?? "0"}</span>
          </li>
          <li>
            USDT <span className="mono">{treasury.usdt ?? "0"}</span>
          </li>
          <li>
            NVDAc <span className="mono">{treasury.nvdac ?? "0"}</span>
          </li>
          {treasury.tokenCount !== undefined ? (
            <li>
              tokens <span className="mono">{treasury.tokenCount}</span>
            </li>
          ) : null}
        </ul>
      ) : (
        <p className="muted">
          Balances omitted. live:false. Chat still plans on the demo snapshot.
        </p>
      )}
    </div>
  );
}

function LendPanel() {
  return (
    <section className="card disabled-panel">
      <h2>Lend / Borrow</h2>
      <p>not live in v1</p>
    </section>
  );
}

function ReceiptsPanel() {
  return (
    <section className="card">
      <h2>Live</h2>
      <p className="muted">
        Shipped BaseScan receipts. Static from NOTES. Fills unverified.
      </p>
      <ul className="receipts">
        {LIVE_RECEIPTS.map((receipt) => (
          <li key={receipt.id}>
            <span>
              {receipt.label}
              <span className="muted"> {receipt.note}</span>
            </span>
            <a
              className="mono"
              href={basescanTxUrl(receipt.hash)}
              target="_blank"
              rel="noreferrer"
            >
              {truncateHash(receipt.hash)}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FlashLadderPanel({ live }: { live: FlashOrdersStatus | null }) {
  const orders = live?.orders?.length
    ? live.orders
    : FLASH_ORDERS.map((order) => ({ ...order, status: "resting" }));
  return (
    <section className="card">
      <h2>Flash ladder</h2>
      <table className="ladder">
        <thead>
          <tr>
            <th>Rung</th>
            <th>Limit</th>
            <th>Qty</th>
            <th>State</th>
            <th>Order</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td>{order.rungPct}% below</td>
              <td className="mono">${order.limitPriceUsd}</td>
              <td className="mono">{order.qtyUsdc} USDC</td>
              <td>{order.status || "resting"}</td>
              <td className="mono">{order.id}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted">
        {FLASH_LADDER_COPY} {live?.live ? "Live Flash GET." : "live:false. NOTES copy."}
      </p>
    </section>
  );
}

function ChatBox({ dest }: { dest?: string }) {
  const [prompt, setPrompt] = useState("deposit 8 USDC");
  const [reply, setReply] = useState<ChatReply | null>(null);
  const [busy, setBusy] = useState(false);
  async function send(next: string) {
    const text = next.trim();
    if (!text) return;
    setBusy(true);
    try {
      setReply(await postChat(text));
    } catch {
      setReply({
        kind: "error",
        summary: "Agent not reachable. Run pnpm agent.",
        plan: { action: "error" },
      });
    } finally {
      setBusy(false);
    }
  }
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await send(prompt);
  }
  return (
    <section className="card" style={{ marginTop: 16 }}>
      <h2>Chat</h2>
      <p className="muted">{CHAT_DRY_COPY}</p>
      <div className="row">
        <button type="button" disabled={busy} onClick={() => void send("deposit 8 USDC")}>
          Deposit 8 USDC
        </button>
        <button
          type="button"
          disabled={busy || !dest}
          onClick={() => dest && void send(`send 8 USDC to ${dest}`)}
        >
          Send 8
        </button>
        <button
          type="button"
          className="reject-hint"
          title="Reject path. Per-call cap is 10 USDC."
          disabled={busy || !dest}
          onClick={() => dest && void send(`send 50 USDC to ${dest}`)}
        >
          Send 50
        </button>
        <button type="button" disabled={busy} onClick={() => void send("lp stocks")}>
          LP NVDA
        </button>
        <button type="button" disabled={busy} onClick={() => void send("sweep")}>
          Sweep
        </button>
        <button type="button" disabled={busy} onClick={() => void send("limits")}>
          Limits
        </button>
      </div>
      <form onSubmit={(e) => void onSubmit(e)}>
        <textarea rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        <div className="row">
          <button type="submit" disabled={busy}>
            Send
          </button>
        </div>
      </form>
      {reply ? (
        <div>
          <p className={reply.plan.action === "rejected" ? "rejected" : undefined}>
            {reply.summary}
          </p>
          <pre>{JSON.stringify(reply.plan, null, 2)}</pre>
          {reply.unsignedTx ? <DepositTx tx={reply.unsignedTx} /> : null}
        </div>
      ) : null}
    </section>
  );
}

function DepositTx({ tx }: { tx: UnsignedTx }) {
  return (
    <div>
      <p className="muted">Unsigned tx. Agent does not broadcast.</p>
      <pre>{JSON.stringify(tx, null, 2)}</pre>
      {dynamicEnabled ? (
        <SignDeposit tx={tx} />
      ) : (
        <p>
          Connect is disabled until VITE_DYNAMIC_ENVIRONMENT_ID is set. Founder wallet
          only.
        </p>
      )}
    </div>
  );
}

function SignDeposit({ tx }: { tx: UnsignedTx }) {
  const { data: accounts = [] } = useGetWalletAccounts();
  const account = accounts.find(isEvmWalletAccount);
  const [hash, setHash] = useState("");
  const [err, setErr] = useState("");
  async function sign() {
    if (!account) return;
    setErr("");
    if (tx.chainId !== base.id) {
      setErr("Deposit is Base only.");
      return;
    }
    const walletClient = await createWalletClientForWalletAccount({
      walletAccount: account,
    });
    const sent = await walletClient.sendTransaction({
      chain: base,
      to: tx.to as Address,
      data: tx.data,
      value: 0n,
    });
    setHash(sent);
  }
  if (!account) {
    return (
      <p className="muted">
        No wallet connected. Sign the payload elsewhere, or Connect first.
      </p>
    );
  }
  return (
    <div className="row">
      <button
        type="button"
        onClick={() => void sign().catch((e: unknown) => setErr(String(e)))}
      >
        Sign deposit
      </button>
      {hash ? <span className="mono">{hash}</span> : null}
      {err ? <span className="muted">{err}</span> : null}
    </div>
  );
}
