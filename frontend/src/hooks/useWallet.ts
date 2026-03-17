import { useState, useEffect, useCallback, useRef } from "react";
import { NearConnector, type NearWalletBase } from "@hot-labs/near-connect";
import { CONTRACT_ID } from "../lib/constants";
import type { Mutation } from "../lib/types";

const connector = new NearConnector({
  network: "mainnet",
  signIn: { contractId: CONTRACT_ID, methodNames: ["commit"] },
});

export function useWallet() {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const walletRef = useRef<NearWalletBase | null>(null);

  useEffect(() => {
    const onSignIn = async (event: { accounts: { accountId: string }[]; wallet: NearWalletBase }) => {
      if (event.accounts.length > 0) {
        setAccountId(event.accounts[0].accountId);
        walletRef.current = event.wallet;
      }
      setLoading(false);
    };

    const onSignOut = () => {
      setAccountId(null);
      walletRef.current = null;
    };

    connector.on("wallet:signIn", onSignIn);
    connector.on("wallet:signOut", onSignOut);

    // Check if already signed in from a previous session
    connector.getConnectedWallet().then(({ wallet, accounts }) => {
      if (accounts.length > 0) {
        setAccountId(accounts[0].accountId);
        walletRef.current = wallet;
      }
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    return () => {
      connector.off("wallet:signIn", onSignIn);
      connector.off("wallet:signOut", onSignOut);
    };
  }, []);

  const signIn = useCallback(async () => {
    await connector.connect();
  }, []);

  const signOut = useCallback(async () => {
    const wallet = walletRef.current;
    if (wallet) {
      await connector.disconnect(wallet);
      walletRef.current = null;
      setAccountId(null);
    }
  }, []);

  const callCommit = useCallback(
    async (mutations: Mutation[], traceContext?: Record<string, unknown>) => {
      const wallet = walletRef.current;
      if (!wallet) throw new Error("Wallet not connected");

      await wallet.signAndSendTransaction({
        receiverId: CONTRACT_ID,
        actions: [
          {
            type: "FunctionCall" as const,
            params: {
              methodName: "commit",
              args: { mutations, trace_context: traceContext },
              gas: "30000000000000",
              deposit: "0",
            },
          },
        ],
      });
    },
    []
  );

  return {
    accountId,
    loading,
    signIn,
    signOut,
    callCommit,
  };
}
