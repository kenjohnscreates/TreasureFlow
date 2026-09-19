import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { base } from "wagmi/chains";
import { App } from "./App";
import { Landing } from "./Landing";
import { wagmiConfig } from "./wagmi";
import "@rainbow-me/rainbowkit/styles.css";
import "./index.css";

const queryClient = new QueryClient();

const rkTheme = darkTheme({
  accentColor: "#10cbff",
  accentColorForeground: "#0b0d10",
  borderRadius: "medium",
});
rkTheme.colors.modalBackground = "#0b0d10";

function Root() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const tree = path.startsWith("/app") ? <App /> : <Landing />;
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={rkTheme} initialChain={base}>
          {tree}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

const el = document.getElementById("root");
if (!el) throw new Error("root missing");
createRoot(el).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
