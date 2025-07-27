// src/App.jsx (Version using "Proposal" terminology, before owner features)

import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import contractInfo from "./contractInfo.json"; // Assumes this ABI contains getProposalsCount, getProposal etc.
import "./App.css";

// Get contract address and ABI from the imported JSON file
const CONTRACT_ADDRESS = contractInfo.address;
const CONTRACT_ABI = contractInfo.abi; // This ABI is expected to match the 'proposal' contract

function App() {
  // States for provider, signer, contract instance
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [contract, setContract] = useState(null);

  // App specific states using "Proposal"
  const [account, setAccount] = useState(null);
  const [proposals, setProposals] = useState([]); // Using "proposals" state name
  const [hasVoted, setHasVoted] = useState(false);
  const [loading, setLoading] = useState(false); // General loading
  const [actionLoading, setActionLoading] = useState(false); // Loading for voting action
  const [error, setError] = useState("");
  const [networkName, setNetworkName] = useState("");

  // --- Core Blockchain Interaction Functions ---

  const connectWallet = useCallback(async () => {
    setError("");
    setLoading(true);
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({
          method: "eth_requestAccounts",
        });
        if (accounts.length > 0) {
          const currentAccount = accounts[0];
          setAccount(currentAccount);

          const web3Provider = new ethers.BrowserProvider(window.ethereum);
          setProvider(web3Provider);

          const web3Signer = await web3Provider.getSigner();
          setSigner(web3Signer);

          const network = await web3Provider.getNetwork();
          setNetworkName(
            network.chainId === 31337n ? "Localhost/Hardhat" : network.name
          );

          console.log("Wallet connected:", currentAccount);
          console.log(
            "Network:",
            network.name,
            "(Chain ID:",
            network.chainId.toString() + ")"
          );
        } else {
          setError(
            "No accounts found. Please unlock or create an account in MetaMask."
          );
        }
      } catch (err) {
        console.error("Error connecting wallet:", err);
        if (err.code === 4001) {
          setError("Connection rejected. Please connect your wallet.");
        } else {
          setError(`Connection error: ${err.message}`);
        }
        setAccount(null);
      } finally {
        setLoading(false);
      }
    } else {
      setError("MetaMask not detected. Please install MetaMask!");
      setLoading(false);
    }
  }, []);

  // Function to load data from the smart contract (Using "Proposal")
  const loadContractData = useCallback(async () => {
    if (!contract) {
      // Check only contract, account needed only for hasVoted
      console.log("Contract instance not available yet.");
      return;
    }
    if (!account) {
      console.log("Account not connected, cannot check voted status yet.");
    }

    console.log("Loading contract data (proposals/voted status)...");
    setLoading(true);
    setError("");
    try {
      // 1. Fetch Proposals (Using proposal function names)
      console.log("Attempting to call getProposalsCount...");
      const count = await contract.getProposalsCount(); // Expecting getProposalsCount
      console.log("Proposal count raw:", count);
      const proposalsArray = [];
      for (let i = 0; i < Number(count); i++) {
        console.log(`Attempting to call getProposal(${i})...`);
        const [name, voteCount] = await contract.getProposal(i); // Expecting getProposal
        console.log(`Proposal ${i}:`, name, voteCount);
        proposalsArray.push({
          index: i,
          name: name,
          voteCount: Number(voteCount),
        });
      }
      setProposals(proposalsArray); // Using setProposals
      console.log("Proposals loaded:", proposalsArray);

      // 2. Check if the connected account has already voted
      if (account) {
        console.log(`Attempting to call hasVoted(${account})...`);
        const votedStatus = await contract.hasVoted(account);
        setHasVoted(votedStatus);
        console.log(`Account ${account} has voted: ${votedStatus}`);
      } else {
        setHasVoted(false); // Reset if account disconnected
      }
    } catch (err) {
      console.error("Error loading contract data:", err); // Log the full error object
      // Add specific error checks based on potential issues
      if (err.code === "CALL_EXCEPTION" || err.code === "BAD_DATA") {
        setError(
          `Failed to load data: ${
            err.message
          }. Ensure contract address (${CONTRACT_ADDRESS}) is correct on network ${
            networkName || "N/A"
          } and ABI has 'getProposalsCount'/'getProposal'.`
        );
      } else if (
        typeof err === "object" &&
        err !== null &&
        "message" in err &&
        err.message.includes("contract not found")
      ) {
        setError(
          `Contract not found at ${CONTRACT_ADDRESS} on network ${
            networkName || "N/A"
          }. Check deployment and network connection.`
        );
      } else if (
        err instanceof TypeError &&
        err.message.includes("is not a function")
      ) {
        setError(
          `Contract interaction error: ${err.message}. Check if the function exists in the ABI (contractInfo.json).`
        );
      } else {
        setError(`Error loading data: ${err.message}. Check console.`);
      }
      setProposals([]); // Using setProposals
      setHasVoted(false);
    } finally {
      setLoading(false);
    }
  }, [contract, account, networkName]); // Dependencies: contract, account, network name

  // Function to handle casting a vote (Using "Proposal")
  const handleVote = async (proposalIndex) => {
    // Using proposalIndex
    if (!contract || !signer || hasVoted) {
      setError(
        hasVoted
          ? "You have already voted."
          : "Connect wallet and ensure contract is loaded."
      );
      return;
    }

    console.log(`Attempting to vote for proposal index: ${proposalIndex}`); // Using proposalIndex
    setActionLoading(true); // Use action loading state
    setError("");

    try {
      // The 'vote' function likely remains the same, taking the index
      const tx = await contract.connect(signer).vote(proposalIndex); // Pass proposalIndex

      console.log("Vote transaction sent:", tx.hash);
      const receipt = await tx.wait();
      console.log("Vote transaction confirmed! Receipt:", receipt);

      setHasVoted(true); // Mark as voted immediately
      await loadContractData(); // Refresh data
    } catch (err) {
      console.error("Voting failed:", err);
      if (err.code === "ACTION_REJECTED") {
        setError("Transaction rejected in wallet.");
      } else if (err?.reason) {
        setError(`Voting Error: ${err.reason}`);
      } else {
        setError(`Voting failed: ${err.message}. Check console.`);
      }
      // Refresh data even on failure
      await loadContractData();
    } finally {
      setActionLoading(false); // Stop action loading
    }
  };

  // --- useEffect Hooks for Lifecycle Management ---

  // Effect 1: Create contract instance
  useEffect(() => {
    if (
      provider &&
      CONTRACT_ADDRESS !== "YOUR_CONTRACT_ADDRESS_HERE" &&
      ethers.isAddress(CONTRACT_ADDRESS)
    ) {
      try {
        const contractInstance = new ethers.Contract(
          CONTRACT_ADDRESS,
          CONTRACT_ABI, // Expecting ABI with "proposal" functions
          provider
        );
        setContract(contractInstance);
        console.log("Contract instance created");
      } catch (err) {
        console.error("Error creating contract instance:", err);
        setError(
          `Failed to create contract instance. Is the ABI (contractInfo.json) correct and address ${CONTRACT_ADDRESS} valid?`
        );
      }
    } else {
      setContract(null);
      if (
        CONTRACT_ADDRESS === "YOUR_CONTRACT_ADDRESS_HERE" ||
        (CONTRACT_ADDRESS && !ethers.isAddress(CONTRACT_ADDRESS))
      ) {
        setError(
          "Contract address not set or invalid in src/contractInfo.json. Deploy your contract first."
        );
      }
    }
  }, [provider, CONTRACT_ADDRESS, CONTRACT_ABI]);

  // Effect 2: Load proposal list and voted status when contract/account ready
  useEffect(() => {
    // Load data if contract exists. Account is handled inside loadContractData.
    if (contract) {
      console.log("Contract ready, loading initial proposals/vote status...");
      loadContractData();
    } else {
      setProposals([]); // Use setProposals
      setHasVoted(false);
    }
  }, [contract, account, loadContractData]); // loadContractData is memoized

  // Effect 3: Set up listeners for MetaMask events
  useEffect(() => {
    const eth = window.ethereum;
    if (eth) {
      const handleAccountsChanged = async (accounts) => {
        console.log("Accounts changed:", accounts);
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          const web3Provider = new ethers.BrowserProvider(eth);
          setProvider(web3Provider);
          const web3Signer = await web3Provider.getSigner();
          setSigner(web3Signer);
        } else {
          console.log("Wallet disconnected");
          setAccount(null);
          setSigner(null);
          setProvider(null);
          setContract(null);
          setHasVoted(false); // Clear vote status
          setProposals([]); // Clear proposals
          setError("Wallet disconnected. Please connect.");
        }
      };

      const handleChainChanged = (_chainId) => {
        console.log("Network chain changed:", _chainId);
        setError("Network changed. Please reload the page and reconnect.");
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
    }
  }, []); // Run only once

  // --- Render Logic (Using "Proposal") ---
  return (
    <div className="App">
      <header className="App-header">
        <div className="App-voting">
        <h1>Decentralized Voting</h1>
        </div>
        
        {account ? (
          <div>
            <p>
              Connected:{" "}
              <span className="account-address">
                {account.substring(0, 6)}...
                {account.substring(account.length - 4)}
              </span>
            </p>
            <p>Network: {networkName || "Loading..."}</p>
          </div>
        ) : (
          <button onClick={connectWallet} disabled={loading}>
            {loading ? "Connecting..." : "Connect Wallet"}
          </button>
        )}
      </header>

      {error && <p className="error-message">{error}</p>}

      {/* No Owner Section in this version */}

      <main className="App-main">
        <h2>Proposals</h2> {/* Using "Proposals" heading */}
        {loading && <p>Loading Data...</p>}
        {actionLoading && <p>Processing Transaction...</p>}
        {/* Use "proposals" state variable */}
        {account && !loading && !actionLoading && proposals.length === 0 && (
          <p>No proposals found or unable to load.</p>
        )}
        {/* Use "proposals" state variable and "proposal" item */}
        {account && !loading && proposals.length > 0 && (
          <ul className="proposals-list">
            {" "}
            {/* Use proposals-list class */}
            {proposals.map(
              (
                proposal // Map over proposals, use proposal item
              ) => (
                <li key={proposal.index}>
                  <span>
                    {proposal.name} ({proposal.voteCount} votes)
                  </span>
                  {!hasVoted && (
                    <button
                      onClick={() => handleVote(proposal.index)} // Pass proposal.index
                      disabled={actionLoading}
                      className="vote-button"
                    >
                      Vote
                    </button>
                  )}
                </li>
              )
            )}
          </ul>
        )}
        {account && !loading && hasVoted && (
          <p className="voted-message">
            You have already cast your vote on this network.
          </p>
        )}
        {!account && !loading && (
          <p className="info-message">
            Connect your wallet to view proposals and vote.
          </p>
        )}
        {/* Refresh button - class added for potential styling */}
        {account && contract && (
          <button
            onClick={loadContractData}
            disabled={loading || actionLoading}
            className="refresh-button"
          >
            {loading
              ? "Refreshing..."
              : actionLoading
              ? "Processing..."
              : "Refresh Data"}
          </button>
        )}
      </main>
    </div>
  );
}
export default App;

