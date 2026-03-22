import { createContext, useContext } from "react";
import { useWallet as useWalletHook } from "../hooks/useWallet";

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const wallet = useWalletHook();

  return (
    <WalletContext.Provider value={wallet}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWalletContext() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWalletContext must be used within a WalletProvider");
  }
  return context;
}
