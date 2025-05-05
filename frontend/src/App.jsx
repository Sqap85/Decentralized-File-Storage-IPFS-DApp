import React from "react";
import {
  getDefaultConfig,
  RainbowKitProvider,
  darkTheme,
} from "@rainbow-me/rainbowkit";
import { WagmiConfig as WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { sepolia } from "wagmi/chains";
import "@rainbow-me/rainbowkit/styles.css";
import "./App.css";
import Dashboard from "./Dashboard";

const WALLETCONNECT_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;

// Wagmi + RainbowKit default config
const config = getDefaultConfig({
  appName: "IPFS DApp",
  projectId: WALLETCONNECT_PROJECT_ID,
  chains: [sepolia],
});

// React Query client
const queryClient = new QueryClient();

export default function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme()}>
          <Dashboard />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
