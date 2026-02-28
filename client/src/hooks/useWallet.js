import { useState, useEffect, useCallback } from "react";
import * as freighterApi from "@stellar/freighter-api";
import { getWalletTokenBalances, fetchExchangeRates } from "../services/sorobanService";

/**
 * Custom hook for managing Freighter wallet connection + multi-token balances
 */
export function useWallet() {
  const [walletAddress, setWalletAddress] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [isFreighterInstalled, setIsFreighterInstalled] = useState(true);
  const [checkingInstallation, setCheckingInstallation] = useState(true);

  // Multi-currency state
  const [tokenBalances, setTokenBalances] = useState([]);
  const [selectedToken, setSelectedToken] = useState(null);
  const [exchangeRates, setExchangeRates] = useState({});
  const [loadingBalances, setLoadingBalances] = useState(false);

  // Check if Freighter is installed and if already connected
  useEffect(() => {
    let mounted = true;

    const checkFreighter = async () => {
      try {
        const { isConnected } = await freighterApi.isConnected();
        if (!mounted) return;

        setIsFreighterInstalled(true);
        setCheckingInstallation(false);

        if (isConnected) {
          const { isAllowed } = await freighterApi.isAllowed();
          if (isAllowed) {
            const { address } = await freighterApi.getAddress();
            if (address && mounted) {
              setWalletAddress(address);
            }
          }
        }
      } catch (err) {
        if (!mounted) return;
        if (err.message?.includes("Freighter") || err.message?.includes("extension")) {
          setIsFreighterInstalled(false);
        }
        setCheckingInstallation(false);
      }
    };

    const timer = setTimeout(checkFreighter, 300);
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, []);

  // Fetch token balances + exchange rates whenever wallet connects
  useEffect(() => {
    if (!walletAddress) {
      setTokenBalances([]);
      setSelectedToken(null);
      return;
    }

    const loadBalancesAndRates = async () => {
      setLoadingBalances(true);
      try {
        const [balances, rates] = await Promise.all([
          getWalletTokenBalances(walletAddress),
          fetchExchangeRates(),
        ]);

        setTokenBalances(balances);
        setExchangeRates(rates);

        // Auto-select first token with balance, or XLM by default
        if (balances.length > 0 && !selectedToken) {
          const withBalance = balances.find((b) => b.balance > 0) || balances[0];
          setSelectedToken(withBalance);
        }
      } catch (err) {
        console.error("Failed to load balances:", err);
      } finally {
        setLoadingBalances(false);
      }
    };

    loadBalancesAndRates();
  }, [walletAddress]);

  // Refresh balances manually
  const refreshBalances = useCallback(async () => {
    if (!walletAddress) return;
    setLoadingBalances(true);
    try {
      const [balances, rates] = await Promise.all([
        getWalletTokenBalances(walletAddress),
        fetchExchangeRates(),
      ]);
      setTokenBalances(balances);
      setExchangeRates(rates);
    } catch (err) {
      console.error("Failed to refresh balances:", err);
    } finally {
      setLoadingBalances(false);
    }
  }, [walletAddress]);

  // Get USD value of an amount in a given token
  const getUsdValue = useCallback(
    (amount, tokenSymbol) => {
      const rate = exchangeRates[tokenSymbol];
      if (!rate) return null;
      return amount * rate;
    },
    [exchangeRates]
  );

  // Connect wallet
  const connectWallet = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const { isConnected } = await freighterApi.isConnected();

      if (!isConnected) {
        setIsFreighterInstalled(false);
        throw new Error("Freighter wallet not detected. Please install from https://freighter.app");
      }

      setIsFreighterInstalled(true);
      await freighterApi.setAllowed();

      const { address } = await freighterApi.getAddress();

      if (address) {
        setWalletAddress(address);

        try {
          const { network } = await freighterApi.getNetwork();
        } catch (e) {
          // Silent fallback if network cannot be fetched
        }

        return address;
      } else {
        throw new Error("Failed to get public key. Please unlock Freighter and try again.");
      }
    } catch (err) {
      console.error("Freighter connection error:", err);

      if (err.message?.includes("User declined") || err.message?.includes("rejected")) {
        setError("Connection declined. Please approve in Freighter.");
      } else if (err.message?.includes("not detected") || err.message?.includes("not installed")) {
        setIsFreighterInstalled(false);
        setError("Freighter not installed. Please install from freighter.app");
      } else {
        setError(err.message || "Failed to connect wallet");
      }
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    setWalletAddress(null);
    setError(null);
    setTokenBalances([]);
    setSelectedToken(null);
  }, []);

  const formatAddress = useCallback((address) => {
    if (!address) return "";
    return `${address.substring(0, 6)}...${address.slice(-4)}`;
  }, []);

  return {
    walletAddress,
    isConnecting,
    isConnected: !!walletAddress,
    error,
    isFreighterInstalled,
    checkingInstallation,
    connectWallet,
    disconnectWallet,
    formatAddress,
    // Multi-currency
    tokenBalances,
    selectedToken,
    setSelectedToken,
    exchangeRates,
    loadingBalances,
    refreshBalances,
    getUsdValue,
  };
}

export default useWallet;