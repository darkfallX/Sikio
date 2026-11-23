"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  formatUnits,
  http,
  keccak256,
  parseUnits,
  toHex,
} from "viem";
import {
  aevumTestnet,
  AEVUM_CONFIG,
  ERC20_ABI,
  REVIEW_ESCROW_ABI,
} from "@/lib/aevum";

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
  liveEscrowMode: boolean;
  setLiveEscrowMode: (enabled: boolean) => void;
  tusd8Balance: string | null;
  tqdayBalance: string | null;
  connecting: boolean;
  error: string | null;
  clearError: () => void;
  connectWallet: () => Promise<void>;
  switchToAevum: () => Promise<void>;
  addTusd8ToWallet: () => Promise<void>;
  payInferenceOnChain: (params: {
    batchId: number;
    requestId: string;
    provider: `0x${string}`;
    amountTusd8: number;
  }) => Promise<`0x${string}`>;
  acceptTaskOnChain: (taskIdBytes32: `0x${string}`) => Promise<`0x${string}`>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextValue>({
  address: null,
  chainId: null,
  isAevum: false,
  liveEscrowMode: false,
  setLiveEscrowMode: () => {},
  tusd8Balance: null,
  tqdayBalance: null,
  connecting: false,
  error: null,
  clearError: () => {},
  connectWallet: async () => {},
  switchToAevum: async () => {},
  addTusd8ToWallet: async () => {},
  payInferenceOnChain: async () => "0x0",
  acceptTaskOnChain: async () => "0x0",
  disconnect: () => {},
});

const publicClient = createPublicClient({
  chain: aevumTestnet,
  transport: http(AEVUM_CONFIG.rpcUrl),
});

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [liveEscrowMode, setLiveEscrowMode] = useState(false);
  const [tusd8Balance, setTusd8Balance] = useState<string | null>(null);
  const [tqdayBalance, setTqdayBalance] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

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
      setError("No browser wallet found. Sandbox mode is active and ready to run.");
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
        setError("Could not switch wallet to QDay Aevum (Chain 44005).");
      }
    }
  }, []);

  const connectWallet = useCallback(async () => {
    setError(null);
    if (typeof window === "undefined" || !window.ethereum) {
      setError(
        "No browser wallet detected. Install MetaMask to sign live Aevum 44005 transactions, or use Sandbox mode immediately."
      );
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
      // User dismissed token watch prompt
    }
  }, []);

  const getWalletClient = useCallback(() => {
    if (!window.ethereum || !address) {
      throw new Error("Connect a wallet on QDay Aevum (44005) first.");
    }
    if (chainId !== AEVUM_CONFIG.chainId) {
      throw new Error("Switch your wallet to QDay Aevum Testnet (Chain 44005).");
    }
    return createWalletClient({
      account: address,
      chain: aevumTestnet,
      transport: custom(window.ethereum),
    });
  }, [address, chainId]);

  const payInferenceOnChain = useCallback(
    async (params: {
      batchId: number;
      requestId: string;
      provider: `0x${string}`;
      amountTusd8: number;
    }): Promise<`0x${string}`> => {
      const wc = getWalletClient();
      const requestHash = keccak256(toHex(params.requestId));
      const hash = await wc.writeContract({
        address: AEVUM_CONFIG.reviewEscrowAddress,
        abi: REVIEW_ESCROW_ABI,
        functionName: "payInference",
        args: [
          BigInt(params.batchId),
          requestHash,
          params.provider,
          parseUnits(params.amountTusd8.toFixed(6), 6),
        ],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      if (address) await fetchBalances(address);
      return hash;
    },
    [address, fetchBalances, getWalletClient]
  );

  const acceptTaskOnChain = useCallback(
    async (taskIdBytes32: `0x${string}`): Promise<`0x${string}`> => {
      const wc = getWalletClient();
      const hash = await wc.writeContract({
        address: AEVUM_CONFIG.reviewEscrowAddress,
        abi: REVIEW_ESCROW_ABI,
        functionName: "acceptTask",
        args: [taskIdBytes32],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      if (address) await fetchBalances(address);
      return hash;
    },
    [address, fetchBalances, getWalletClient]
  );

  const disconnect = useCallback(() => {
    setAddress(null);
    setLiveEscrowMode(false);
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
        setLiveEscrowMode(false);
      }
    };
    const onChainChanged = (hex: unknown) => {
      const nextChain = parseInt(String(hex), 16);
      setChainId(nextChain);
      if (nextChain !== AEVUM_CONFIG.chainId) {
        setLiveEscrowMode(false);
      }
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
        liveEscrowMode: Boolean(address && chainId === AEVUM_CONFIG.chainId && liveEscrowMode),
        setLiveEscrowMode,
        tusd8Balance,
        tqdayBalance,
        connecting,
        error,
        clearError,
        connectWallet,
        switchToAevum,
        addTusd8ToWallet,
        payInferenceOnChain,
        acceptTaskOnChain,
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
