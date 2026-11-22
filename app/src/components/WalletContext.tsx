"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { createPublicClient, formatUnits, http } from "viem";
import { aevumTestnet, AEVUM_CONFIG, ERC20_ABI } from "@/lib/aevum";

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, cb: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, cb: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

interface WalletContextValue {
  address: `0x${string}` | null;
  chainId: number | null;
  isAevum: boolean;
  tusd8Balance: string | null;
  tqdayBalance: string | null;
  connecting: boolean;
  error: string | null;
  connectWallet: () => Promise<void>;
  switchToAevum: () => Promise<void>;
  addTusd8ToWallet: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextValue>({
  address: null,
  chainId: null,
  isAevum: false,
  tusd8Balance: null,
  tqdayBalance: null,
  connecting: false,
  error: null,
  connectWallet: async () => {},
  switchToAevum: async () => {},
  addTusd8ToWallet: async () => {},
  disconnect: () => {},
});

const publicClient = createPublicClient({
  chain: aevumTestnet,
  transport: http(AEVUM_CONFIG.rpcUrl),
});

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [tusd8Balance, setTusd8Balance] = useState<string | null>(null);
  const [tqdayBalance, setTqdayBalance] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalances = useCallback(async (addr: `0x${string}`) => {
    try {
      const [nativeBal, tokenBal] = await Promise.all([
        publicClient.getBalance({ address: addr }),
        publicClient.readContract({
          address: AEVUM_CONFIG.tusd8Address,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [addr],
        }),
      ]);
      setTqdayBalance(Number(formatUnits(nativeBal, 18)).toFixed(3));
      setTusd8Balance(Number(formatUnits(tokenBal, 6)).toFixed(2));
    } catch {
      setTqdayBalance(null);
      setTusd8Balance(null);
    }
  }, []);

  const switchToAevum = useCallback(async () => {
    if (!window.ethereum) {
      setError("No browser wallet detected. Sandbox Mode remains active.");
      return;
    }
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: AEVUM_CONFIG.chainIdHex }],
      });
      setChainId(AEVUM_CONFIG.chainId);
      setError(null);
    } catch (switchErr: unknown) {
      const code = (switchErr as { code?: number })?.code;
      if (code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: AEVUM_CONFIG.chainIdHex,
              chainName: AEVUM_CONFIG.chainName,
              rpcUrls: [AEVUM_CONFIG.rpcUrl],
              blockExplorerUrls: [AEVUM_CONFIG.explorerUrl],
              nativeCurrency: {
                name: "tQDAY",
                symbol: "tQDAY",
                decimals: 18,
              },
            },
          ],
        });
        setChainId(AEVUM_CONFIG.chainId);
        setError(null);
      } else {
        setError("Could not switch wallet to QDay Aevum (44005).");
      }
    }
  }, []);

  const connectWallet = useCallback(async () => {
    setError(null);
    if (!window.ethereum) {
      setError("Install MetaMask or an EIP-1193 wallet to connect to Aevum.");
      return;
    }
    setConnecting(true);
    try {
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];
      const hexChain = (await window.ethereum.request({
        method: "eth_chainId",
      })) as string;
      const numericChain = parseInt(hexChain, 16);
      setChainId(numericChain);

      if (accounts[0]) {
        const addr = accounts[0] as `0x${string}`;
        setAddress(addr);
        if (numericChain !== AEVUM_CONFIG.chainId) {
          await switchToAevum();
        }
        await fetchBalances(addr);
      }
    } catch {
      setError("Wallet connection was cancelled.");
    } finally {
      setConnecting(false);
    }
  }, [fetchBalances, switchToAevum]);

  const addTusd8ToWallet = useCallback(async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: "wallet_watchAsset",
        params: [
          {
            type: "ERC20",
            options: {
              address: AEVUM_CONFIG.tusd8Address,
              symbol: "tUSD8",
              decimals: 6,
            },
          },
        ],
      });
    } catch {
      // User dismissed token prompt
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setTusd8Balance(null);
    setTqdayBalance(null);
    setError(null);
  }, []);

  useEffect(() => {
    const eth = window.ethereum;
    if (!eth?.on) return;
    const onAccountsChanged = (accs: unknown) => {
      const list = accs as string[];
      if (list[0]) {
        const addr = list[0] as `0x${string}`;
        setAddress(addr);
        fetchBalances(addr);
      } else {
        setAddress(null);
      }
    };
    const onChainChanged = (hex: unknown) => {
      setChainId(parseInt(String(hex), 16));
    };
    eth.on("accountsChanged", onAccountsChanged);
    eth.on("chainChanged", onChainChanged);
    return () => {
      eth.removeListener?.("accountsChanged", onAccountsChanged);
      eth.removeListener?.("chainChanged", onChainChanged);
    };
  }, [fetchBalances]);

  return (
    <WalletContext.Provider
      value={{
        address,
        chainId,
        isAevum: chainId === AEVUM_CONFIG.chainId,
        tusd8Balance,
        tqdayBalance,
        connecting,
        error,
        connectWallet,
        switchToAevum,
        addTusd8ToWallet,
        disconnect,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
