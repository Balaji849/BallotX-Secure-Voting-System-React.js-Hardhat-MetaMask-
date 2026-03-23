// src/App.jsx — BallotX · Pure Tailwind Edition
// Logic unchanged. All styles via Tailwind + ballotx.css for custom tokens.

import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import contractInfo from "./contractInfo.json";
import "./index.css";

const CONTRACT_ADDRESS = contractInfo.address;
const CONTRACT_ABI = contractInfo.abi;

// ─── ProposalCard 

function ProposalCard({ proposal, hasVoted, actionLoading, onVote, maxVotes }) {
  const fillPct = maxVotes > 0 ? Math.round((proposal.voteCount / maxVotes) * 100) : 0;

  return (
    <li className="group rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-indigo-500/30 hover:bg-indigo-500/[0.04]">
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <span className="ballotx-font-display flex-1 text-[17px] font-bold leading-snug text-slate-100">
          {proposal.name}
        </span>
        <span className="shrink-0 rounded-full  bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-400">
          {proposal.voteCount} vote{proposal.voteCount !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Progress bar */}
      <div className="my-3 h-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-700"
          style={{ width: `${fillPct}%` }}
        />
      </div>

      {/* Vote button */}
      <div className="flex items-center justify-end pt-1">
        {!hasVoted && (
          <button
            onClick={() => onVote(proposal.index)}
            disabled={actionLoading}
            className="rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 px-5 py-2 text-sm font-medium text-white shadow-[0_0_16px_rgba(79,58,255,0.35)] transition-all duration-150 hover:-translate-y-px hover:shadow-[0_0_24px_rgba(79,58,255,0.55)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            {actionLoading ? "Processing…" : "Cast Vote →"}
          </button>
        )}
      </div>
    </li>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────

function App() {
  const [provider, setProvider]           = useState(null);
  const [signer, setSigner]               = useState(null);
  const [contract, setContract]           = useState(null);
  const [account, setAccount]             = useState(null);
  const [proposals, setProposals]         = useState([]);
  const [hasVoted, setHasVoted]           = useState(false);
  const [loading, setLoading]             = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError]                 = useState("");
  const [networkName, setNetworkName]     = useState("");

  // ── connectWallet ──────────────────────────────────────────────────────────
  const connectWallet = useCallback(async () => {
    setError("");
    setLoading(true);
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        if (accounts.length > 0) {
          const currentAccount = accounts[0];
          setAccount(currentAccount);
          const web3Provider = new ethers.BrowserProvider(window.ethereum);
          setProvider(web3Provider);
          const web3Signer = await web3Provider.getSigner();
          setSigner(web3Signer);
          const network = await web3Provider.getNetwork();
          setNetworkName(network.chainId === 31337n ? "Localhost/Hardhat" : network.name);
        } else {
          setError("No accounts found. Please unlock or create an account in MetaMask.");
        }
      } catch (err) {
        if (err.code === 4001) setError("Connection rejected. Please connect your wallet.");
        else setError(`Connection error: ${err.message}`);
        setAccount(null);
      } finally {
        setLoading(false);
      }
    } else {
      setError("No Web3 wallet detected. Install MetaMask or enable your browser extension");
      setLoading(false);
    }
  }, []);

  // ── loadContractData ───────────────────────────────────────────────────────
  const loadContractData = useCallback(async () => {
    if (!contract) return;
    setLoading(true);
    setError("");
    try {
      const count = await contract.getProposalsCount();
      const proposalsArray = [];
      for (let i = 0; i < Number(count); i++) {
        const [name, voteCount] = await contract.getProposal(i);
        proposalsArray.push({ index: i, name, voteCount: Number(voteCount) });
      }
      setProposals(proposalsArray);
      if (account) {
        const votedStatus = await contract.hasVoted(account);
        setHasVoted(votedStatus);
      } else {
        setHasVoted(false);
      }
    } catch (err) {
      if (err.code === "CALL_EXCEPTION" || err.code === "BAD_DATA") {
        setError(`Failed to load data: ${err.message}. Check contract address & ABI.`);
      } else {
        setError(`Error loading data: ${err.message}`);
      }
      setProposals([]);
      setHasVoted(false);
    } finally {
      setLoading(false);
    }
  }, [contract, account, networkName]);

  // ── handleVote ─────────────────────────────────────────────────────────────
  const handleVote = async (proposalIndex) => {
    if (!contract || !signer || hasVoted) {
      setError(hasVoted ? "You have already voted." : "Connect wallet and ensure contract is loaded.");
      return;
    }
    setActionLoading(true);
    setError("");
    try {
      const tx = await contract.connect(signer).vote(proposalIndex);
      await tx.wait();
      setHasVoted(true);
      await loadContractData();
    } catch (err) {
      if (err.code === "ACTION_REJECTED") setError("Transaction rejected in wallet.");
      else if (err?.reason) setError(`Voting Error: ${err.reason}`);
      else setError(`Voting failed: ${err.message}`);
      await loadContractData();
    } finally {
      setActionLoading(false);
    }
  };

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (
      provider &&
      CONTRACT_ADDRESS !== "YOUR_CONTRACT_ADDRESS_HERE" &&
      ethers.isAddress(CONTRACT_ADDRESS)
    ) {
      try {
        setContract(new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider));
      } catch (err) {
        setError(`Failed to create contract instance: ${err.message}`);
      }
    } else {
      setContract(null);
    }
  }, [provider]);

  useEffect(() => {
    if (contract) loadContractData();
    else { setProposals([]); setHasVoted(false); }
  }, [contract, account, loadContractData]);

  useEffect(() => {
    const eth = window.ethereum;
    if (!eth) return;
    const handleAccountsChanged = async (accounts) => {
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        const web3Provider = new ethers.BrowserProvider(eth);
        setProvider(web3Provider);
        setSigner(await web3Provider.getSigner());
      } else {
        setAccount(null); setSigner(null); setProvider(null);
        setContract(null); setHasVoted(false); setProposals([]);
        setError("Wallet disconnected. Please connect.");
      }
    };
    const handleChainChanged = () => {
      setError("Network changed. Please reload the page.");
      window.location.reload();
    };
    eth.on("accountsChanged", handleAccountsChanged);
    eth.on("chainChanged", handleChainChanged);
    return () => {
      if (eth.removeListener) {
        eth.removeListener("accountsChanged", handleAccountsChanged);
        eth.removeListener("chainChanged", handleChainChanged);
      }
    };
  }, []);

  const maxVotes   = proposals.length > 0 ? Math.max(...proposals.map((p) => p.voteCount), 1) : 1;
  const totalVotes = proposals.reduce((sum, p) => sum + p.voteCount, 0);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#080B14] text-slate-200">

      {/* Ambient orbs */}
      <div className="pointer-events-none fixed -left-32 -top-32 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(79,58,255,0.18),transparent_70%)] blur-[80px]" />
      <div className="pointer-events-none fixed -bottom-20 -right-20 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(0,229,160,0.14),transparent_70%)] blur-[80px]" />

      {/* Page */}
      <div className="relative z-10 mx-auto max-w-3xl px-6 pb-20">

        {/* ── Nav ── */}
        <nav className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] py-5">
          <div className="ballotx-font-display text-[22px] font-extrabold tracking-tight text-slate-100">
            Ballot<span className="text-indigo-500">X</span>
            <span className="ballotx-pulse ml-1 inline-block h-2 w-2 rounded-full bg-emerald-400 align-middle" />
          </div>

          {account ? (
            <div className="flex flex-wrap items-center gap-2.5">
              {networkName && (
                <span className="rounded-full font-semibold bg-white/5 px-4 py-1.5 text-xs text-gray-400">
                  {networkName}
                </span>
              )}
              <span className="flex items-center gap-2 rounded-full font-semibold bg-indigo-500/10 px-4 py-1.5 text-xs text-violet-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {account.substring(0, 6)}…{account.substring(account.length - 4)}
              </span>
            </div>
          ) : (
            <button
              onClick={connectWallet}
              disabled={loading}
              className="rounded-[14px] bg-gradient-to-br from-indigo-500 to-violet-500 px-5 py-2.5 text-sm font-medium text-white shadow-[0_0_24px_rgba(79,58,255,0.4)] transition-all duration-200 hover:-translate-y-px hover:shadow-[0_0_32px_rgba(79,58,255,0.6)] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
            >
              {loading ? "Connecting…" : "Connect Wallet"}
            </button>
          )}
        </nav>

        {/* ── Hero ── */}
        <div className="py-10 text-center">
          <div className="mb-6 inline-flex items-center gap-1.5 rounded-full  bg-indigo-500/15 px-4 py-1.5 text-[12px] uppercase tracking-widest text-violet-200 font-semibold">
            <span className="ballotx-pulse h-1.5 w-1.5 rounded-full bg-indigo-500" />
            Trustless voting protocol
          </div>

          <h1 className="ballotx-font-display ballotx-gradient-text mb-4 text-5xl font-extrabold leading-[1.05] tracking-[-2px] md:text-6xl">
            Vote on what<br />matters.
          </h1>

          <p className="mx-auto mb-11 mt-10 max-w-sm text-[17px]  leading-relaxed text-gray-400 font-semibold">
            Transparent, trustless, unstoppable. Every voice counted on the blockchain - Forever.
          </p>

          {!account && (
            <div className="flex flex-wrap justify-center gap-3">
              <button
                onClick={connectWallet}
                disabled={loading}
                className="rounded-[14px] bg-gradient-to-br from-indigo-500 to-violet-800 px-8 py-3.5 text-[15px] font-medium text-white shadow-[0_0_30px_rgba(79,58,255,0.4)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_40px_rgba(79,58,255,0.6)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Connecting…" : "Connect Wallet ➜"}
              </button>
            </div>
          )}
        </div>

        {/* ── Stats strip ── */}
        {account && (
          <div className="mb-12 grid grid-cols-3 gap-px overflow-hidden rounded-2xl bg-white/[0.06]">
            {[
              { num: totalVotes.toLocaleString(), lbl: "Total votes" },
              { num: proposals.length,            lbl: "Proposals"   },
              { num: hasVoted ? "✓" : "—",        lbl: "Your vote"   },
            ].map(({ num, lbl }) => (
              <div key={lbl} className="bg-white/[0.025] px-5 py-6 text-center">
                <div className="ballotx-font-display ballotx-gradient-text text-3xl font-extrabold">
                  {num}
                </div>
                <div className="mt-1 text-[11px] uppercase font-semibold tracking-widest text-gray-700">{lbl}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div className="mb-6 rounded-xl  bg-pink-500/30 px-2 py-3 text-center text-[13px] text-red-400">
            {error}
          </div>
        )}

        {/* ── Main ── */}
        <main>
          {account && (
            <p className="mb-4 text-[11px] uppercase tracking-[2px] text-gray-300 font-bold">
              Active Proposals
            </p>
          )}

          {/* Loading spinner */}
          {(loading || actionLoading) && (
            <div className="flex items-center justify-center gap-2.5 py-5 text-sm text-gray-600">
              <span className="ballotx-spin inline-block h-4 w-4 rounded-full border-2 border-indigo-500/20 border-t-indigo-500" />
              {actionLoading ? "Processing transaction…" : "Loading proposals…"}
            </div>
          )}

          {/* Empty */}
          {account && !loading && !actionLoading && proposals.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-700">
              No proposals found or unable to load.
            </p>
          )}

          {/* Proposal cards */}
          {account && !loading && proposals.length > 0 && (
            <ul className="flex list-none flex-col gap-3.5 p-0">
              {proposals.map((proposal) => (
                <ProposalCard
                  key={proposal.index}
                  proposal={proposal}
                  hasVoted={hasVoted}
                  actionLoading={actionLoading}
                  onVote={handleVote}
                  maxVotes={maxVotes}
                />
              ))}
            </ul>
          )}

          {/* Voted confirmation */}
          {account && !loading && hasVoted && (
            <div className="mx-auto mt-6 flex w-fit items-center gap-2.5 rounded-[14px] border border-emerald-400/20 bg-emerald-400/[0.08] px-6 py-3.5 text-sm font-medium text-emerald-400">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-[10px] font-extrabold text-[#080B14]">
                ✓
              </span>
              Your vote has been cast on-chain.
            </div>
          )}

          {/* No wallet */}
          {!account && !loading && (
            <div className=" text-center">
              <span className="inline-flex items-center gap-2 rounded-xl bg-white/[0.04] px-5 py-3 text-sm text-gray-500 font-semibold">
                Connect your wallet to view proposals and vote.
              </span>
            </div>
          )}

          {/* Refresh */}
          {account && contract && (
            <button
              onClick={loadContractData}
              disabled={loading || actionLoading}
              className="mx-auto mt-8 flex items-center gap-2 rounded-xl  bg-white/[0.04] px-6 py-2.5 text-[15px] font-semibold text-gray-400 transition-all duration-200 hover:border-white/20 hover:text-gray-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="text-base">↻</span>
              {loading ? "Refreshing…" : actionLoading ? "Processing…" : "Refresh Data"}
            </button>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;