import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DynamicProvider } from "@dynamic-labs-sdk/react-hooks";
import { App } from "./App";
import { dynamicClient } from "./dynamicClient";
import "./index.css";

const queryClient = new QueryClient();

function Root() {
  const tree = <App />;
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
