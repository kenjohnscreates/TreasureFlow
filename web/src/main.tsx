import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DynamicProvider } from "@dynamic-labs-sdk/react-hooks";
import { App } from "./App";
import { Landing } from "./Landing";
import { dynamicClient } from "./dynamicClient";
import "./index.css";

const queryClient = new QueryClient();

function Root() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const tree = path.startsWith("/app") ? <App /> : <Landing />;
  return (
    <QueryClientProvider client={queryClient}>
      {dynamicClient ? (
        <DynamicProvider client={dynamicClient}>{tree}</DynamicProvider>
      ) : (
        tree
      )}
    </QueryClientProvider>
  );
}

const el = document.getElementById("root");
if (!el) throw new Error("root missing");
createRoot(el).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
