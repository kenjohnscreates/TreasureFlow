import { ConnectButton } from "@rainbow-me/rainbowkit";
import { type Address, formatUnits, isAddress } from "viem";
import { base } from "viem/chains";
import { useAccount, useBalance, useDisconnect } from "wagmi";

/** Known Base USDC; prefer GET /status tokens.usdc when present. */
export const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address;

export function resolveUsdcToken(fromStatus?: string): Address {
  return fromStatus && isAddress(fromStatus) ? fromStatus : BASE_USDC;
}

function shortAddr(addr: string): string {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function fmtBal(value: bigint | undefined, decimals: number): string {
  if (value === undefined) return "--";
  const n = Number(formatUnits(value, decimals));
  if (!Number.isFinite(n)) return formatUnits(value, decimals);
  const max = decimals <= 6 ? 2 : 6;
  return n.toLocaleString("en-US", { maximumFractionDigits: max });
}

export function ExternalAddr({ usdcToken }: { usdcToken?: string }) {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const token = resolveUsdcToken(usdcToken);
  const eth = useBalance({
    address,
    chainId: base.id,
    query: { enabled: Boolean(address) },
  });
  const usdc = useBalance({
    address,
    chainId: base.id,
    token,
    query: { enabled: Boolean(address) },
  });

  return (
    <ConnectButton.Custom>
      {({ openConnectModal, mounted }) => {
        if (!mounted) return null;
        if (!isConnected || !address) {
          return (
            <div className="wallet-connect">
              <button className="btn" type="button" onClick={openConnectModal}>
                Connect Wallet
              </button>
            </div>
          );
        }
        return (
          <div className="wallet-ext">
            <b>{shortAddr(address)}</b>
            <div className="wallet-bals">
              <span>{fmtBal(eth.data?.value, eth.data?.decimals ?? 18)} ETH</span>
              <span>{fmtBal(usdc.data?.value, usdc.data?.decimals ?? 6)} USDC</span>
            </div>
            <button className="btn ghost" type="button" onClick={() => disconnect()}>
              Disconnect
            </button>
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
