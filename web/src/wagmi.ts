import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import { injectedWallet, walletConnectWallet } from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { base } from "wagmi/chains";

const walletConnectProjectId = (
  import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? ""
).trim();

const wallets = [
  {
    groupName: "Installed",
    wallets: [injectedWallet],
  },
  ...(walletConnectProjectId
    ? [
        {
          groupName: "WalletConnect",
          wallets: [walletConnectWallet],
        },
      ]
    : []),
];

export const wagmiConfig = createConfig({
  chains: [base],
  connectors: connectorsForWallets(wallets, {
    appName: "TreasureFlow",
    projectId: walletConnectProjectId,
  }),
  transports: {
    [base.id]: http(),
  },
});
