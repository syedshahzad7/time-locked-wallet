// src/App.jsx
import { useEffect, useState } from "react";
import { BrowserProvider, Contract, parseEther, formatEther } from "ethers";
import abi from "./abi.json";

const CONTRACT_ADDRESS = "0x85CeaE21aEE270cfe6d6829f02B1eB49f58B7AbE"; 
const SEPOLIA_CHAIN_ID = "0xaa36a7"; // 11155111 in hex

function App() {
  const [walletAddress, setWalletAddress] = useState("");
  const [network, setNetwork] = useState("");
  const [balance, setBalance] = useState("0");
  const [unlockTime, setUnlockTime] = useState(0);
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [status, setStatus] = useState("");
  const [lastTxHash, setLastTxHash] = useState("");

  // Lock UI state
  const [lockDurationValue, setLockDurationValue] = useState("");
  const [lockDurationUnit, setLockDurationUnit] = useState("minutes"); 

  // ---- Helpers ----
  const getProvider = () => {
    if (!window.ethereum) {
      alert("Please install MetaMask!");
      throw new Error("MetaMask not found");
    }
    return new BrowserProvider(window.ethereum);
  };

  const getSignerAndContract = async () => {
    const provider = getProvider();
    const signer = await provider.getSigner();
    const contract = new Contract(CONTRACT_ADDRESS, abi, signer);
    return { signer, contract, provider };
  };

  // ---- Wallet connect ----
  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        alert("Please install MetaMask!");
        return;
      }
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      const address = accounts[0];
      setWalletAddress(address);

      const chainId = await window.ethereum.request({
        method: "eth_chainId",
      });
      setNetwork(chainId === SEPOLIA_CHAIN_ID ? "Sepolia" : `Chain: ${chainId}`);

      await refreshOnChainData();
    } catch (err) {
      console.error(err);
      setStatus("Failed to connect wallet.");
    }
  };

  // ---- Read functions ----
  const refreshOnChainData = async () => {
    try {
      const { contract } = await getSignerAndContract();
      const bal = await contract.getBalance();
      const unlock = await contract.unlockTime(); // public variable -> auto getter
      setBalance(formatEther(bal));
      setUnlockTime(Number(unlock));
    } catch (err) {
      console.error(err);
      setStatus("Could not read contract data.");
    }
  };

  // ---- Write: deposit ----
  const handleDeposit = async (e) => {
    e.preventDefault();
    try {
      if (!depositAmount || Number(depositAmount) <= 0) {
        setStatus("Enter a positive deposit amount.");
        return;
      }

      setStatus("Sending deposit transaction...");
      const { contract } = await getSignerAndContract();
      const tx = await contract.deposit({
        value: parseEther(depositAmount),
      });
      setLastTxHash(tx.hash);
      setStatus("Deposit pending... waiting for confirmation.");
      await tx.wait();
      setStatus("Deposit successful!");
      await refreshOnChainData();
    } catch (err) {
      console.error(err);
      setStatus(
        "Deposit failed: " + (err?.reason || err?.message || "Unknown error")
      );
    }
  };

  // ---- Write: withdraw ----
  const handleWithdraw = async (e) => {
    e.preventDefault();
    try {
      if (!withdrawAmount || Number(withdrawAmount) <= 0) {
        setStatus("Enter a positive withdraw amount.");
        return;
      }

      setStatus("Sending withdraw transaction...");
      const { contract } = await getSignerAndContract();
      const tx = await contract.withdraw(parseEther(withdrawAmount));
      setLastTxHash(tx.hash);
      setStatus("Withdraw pending... waiting for confirmation.");
      await tx.wait();
      setStatus("Withdraw successful!");
      await refreshOnChainData();
    } catch (err) {
      console.error(err);
      // This will display require errors like "Funds are still locked"
      setStatus(
        "Withdraw failed: " + (err?.reason || err?.message || "Unknown error")
      );
    }
  };

  // ---- Write: extend lock ----
  const handleExtendLock = async (e) => {
    e.preventDefault();
    try {
      const valueNum = Number(lockDurationValue);
      if (!valueNum || valueNum <= 0) {
        setStatus("Enter a positive lock duration.");
        return;
      }

      // Make sure we know the current unlockTime
      if (!unlockTime) {
        await refreshOnChainData();
      }

      // Convert chosen unit to seconds
      let durationSeconds = valueNum;
      switch (lockDurationUnit) {
        case "minutes":
          durationSeconds *= 60;
          break;
        case "hours":
          durationSeconds *= 60 * 60;
          break;
        case "days":
          durationSeconds *= 60 * 60 * 24;
          break;
        case "seconds":
        default:
          break;
      }

      const now = Math.floor(Date.now() / 1000);
      const desiredEnd = now + durationSeconds;

      // We want the new unlock time to be strictly beyond the current one
      const additionalSeconds = desiredEnd - unlockTime;

      if (additionalSeconds <= 0) {
        setStatus(
          "New lock time must be later than the current unlock time."
        );
        return;
      }

      setStatus("Sending extendLock transaction...");
      const { contract } = await getSignerAndContract();
      const tx = await contract.extendLock(additionalSeconds);
      setLastTxHash(tx.hash);
      setStatus("Extend lock pending... waiting for confirmation.");
      await tx.wait();
      setStatus("Lock extended successfully!");
      setLockDurationValue("");
      await refreshOnChainData();
    } catch (err) {
      console.error(err);
      setStatus(
        "Extend lock failed: " + (err?.reason || err?.message || "Unknown error")
      );
    }
  };

  // Listen for account / network changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => {
      if (accounts.length > 0) {
        setWalletAddress(accounts[0]);
        refreshOnChainData();
      } else {
        setWalletAddress("");
      }
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      if (!window.ethereum) return;
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, []);

  const formattedUnlockTime =
    unlockTime > 0 ? new Date(unlockTime * 1000).toLocaleString() : "—";

  // Simple reusable card style
  const cardStyle = {
    backgroundColor: "#ffffff",
    borderRadius: "12px",
    padding: "1.25rem",
    marginBottom: "1.5rem",
    boxShadow: "0 8px 20px rgba(0,0,0,0.05)",
    border: "1px solid #edf2f7",
  };

  const labelStyle = { display: "block", marginBottom: "0.25rem", fontWeight: 500 };

  const inputStyle = {
    padding: "0.5rem 0.75rem",
    borderRadius: "8px",
    border: "1px solid #cbd5e0",
    marginRight: "0.5rem",
    minWidth: "0",
  };

  const buttonPrimary = {
    padding: "0.5rem 0.9rem",
    borderRadius: "8px",
    border: "none",
    background: "#2563eb",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
  };

  const buttonSecondary = {
    ...buttonPrimary,
    background: "#4b5563",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        margin: 0,
        padding: "2rem 1rem",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        background: "linear-gradient(135deg, #0f172a, #020617)",
        color: "#0f172a",
      }}
    >
      <div
        style={{
          maxWidth: "960px",
          margin: "0 auto",
          backgroundColor: "#f9fafb",
          borderRadius: "16px",
          padding: "2rem 1.75rem 2.5rem",
          boxShadow: "0 20px 45px rgba(15,23,42,0.6)",
          border: "1px solid rgba(148,163,184,0.4)",
        }}
      >
        {/* Header */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            marginBottom: "1rem",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "999px",
              background: "#e0f2fe",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.4rem",
            }}
          >
            👜
          </div>
          <div>
            <h1
              style={{
                fontSize: "1.6rem",
                margin: 0,
                color: "#0f172a",
                fontWeight: 700,
              }}
            >
              MetaLocked: A Time-Locked Savings Wallet
            </h1>
            <p
              style={{
                margin: "0.25rem 0 0",
                color: "#4b5563",
                fontSize: "0.95rem",
              }}
            >
              A Sepolia-based smart contract that helps you lock your ETH for a chosen period,
              so you don&apos;t touch your savings before you planned.
            </p>
          </div>
        </header>

        {/* Intro / How it works */}
        <section style={cardStyle}>
          <h2 style={{ marginTop: 0, fontSize: "1.15rem" }}>What is MetaLocked?</h2>
          <p style={{ margin: "0 0 0.75rem", color: "#4b5563", fontSize: "0.95rem" }}>
            MetaLocked is a simple time-locked savings wallet built on the Ethereum Sepolia
            testnet. When you deposit ETH into this contract, those funds stay locked until the
            unlock time is reached. Withdrawals are enforced on-chain by the smart contract, so
            even if you&apos;re tempted, you can&apos;t withdraw before the lock expires.
          </p>
          <h3 style={{ fontSize: "1.02rem", marginTop: "1rem" }}>How to use MetaLocked</h3>
          <ol
            style={{
              paddingLeft: "1.25rem",
              margin: "0.4rem 0 0.25rem",
              color: "#4b5563",
              fontSize: "0.95rem",
            }}
          >
            <li>Install MetaMask and switch your network to <strong>Sepolia</strong>.</li>
            <li>
              Click <strong>Connect Wallet</strong> below to connect your account and confirm
              the network.
            </li>
            <li>
              Use <strong>Deposit</strong> to send ETH into the contract. The balance and unlock
              time are shown in the On-chain Info panel.
            </li>
            <li>
              Use <strong>Extend Lock</strong> to push the unlock time further into the future
              (e.g., +7 days from now).
            </li>
            <li>
              After the unlock time passes, use <strong>Withdraw</strong> to move your ETH back
              to your wallet. Early withdrawal attempts will fail on-chain.
            </li>
          </ol>
          <p style={{ margin: "0.4rem 0 0", color: "#6b7280", fontSize: "0.9rem" }}>
            Only the contract owner (the address that deployed MetaLocked) can extend the lock
            and withdraw funds. Anyone can verify all actions on Etherscan.
          </p>
        </section>

        {/* Main layout: left column (wallet/info), right column (actions) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1.1fr)",
            gap: "1.5rem",
          }}
        >
          {/* Left column */}
          <div>
            {/* Connect Wallet */}
            <section style={cardStyle}>
              <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Wallet Connection</h2>
              <p style={{ color: "#4b5563", fontSize: "0.95rem", marginBottom: "0.75rem" }}>
                Connect your MetaMask wallet on the Sepolia network to start interacting
                with MetaLocked.
              </p>
              <button style={buttonPrimary} onClick={connectWallet}>
                Connect Wallet
              </button>
              <div style={{ marginTop: "0.75rem", fontSize: "0.92rem" }}>
                <p style={{ margin: "0.15rem 0" }}>
                  <span style={{ fontWeight: 600 }}>Wallet:</span>{" "}
                  <span style={{ color: "#111827" }}>
                    {walletAddress || "Not connected"}
                  </span>
                </p>
                <p style={{ margin: "0.15rem 0" }}>
                  <span style={{ fontWeight: 600 }}>Network:</span>{" "}
                  <span style={{ color: "#111827" }}>
                    {network || "Unknown"}
                  </span>
                </p>
              </div>
            </section>

            {/* On-chain Info */}
            <section style={cardStyle}>
              <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>On-chain Info</h2>
              <p style={{ margin: "0.2rem 0", fontSize: "0.9rem", color: "#4b5563" }}>
                <span style={{ fontWeight: 600 }}>Contract Address:</span>
                <br />
                <span
                  style={{
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                    fontSize: "0.85rem",
                  }}
                >
                  {CONTRACT_ADDRESS}
                </span>
              </p>
              <p style={{ margin: "0.2rem 0", fontSize: "0.95rem" }}>
                <span style={{ fontWeight: 600 }}>Current Balance:</span> {balance} ETH
              </p>
              <p style={{ margin: "0.2rem 0", fontSize: "0.95rem" }}>
                <span style={{ fontWeight: 600 }}>Unlock Time:</span> {formattedUnlockTime}
              </p>
              <button style={buttonSecondary} onClick={refreshOnChainData}>
                Refresh
              </button>
            </section>
          </div>

          {/* Right column */}
          <div>
            {/* Deposit */}
            <section style={cardStyle}>
              <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Deposit</h2>
              <p style={{ color: "#4b5563", fontSize: "0.95rem", marginBottom: "0.75rem" }}>
                Send ETH into MetaLocked. These funds will remain in the contract until the
                unlock time has passed.
              </p>
              <form onSubmit={handleDeposit} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <div style={{ flexGrow: 1, minWidth: "140px" }}>
                  <label style={labelStyle}>Amount (ETH)</label>
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="e.g. 0.01"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    style={{ ...inputStyle, width: "100%" }}
                  />
                </div>
                <div style={{ alignSelf: "flex-end" }}>
                  <button type="submit" style={buttonPrimary}>
                    Deposit
                  </button>
                </div>
              </form>
            </section>

            {/* Withdraw */}
            <section style={cardStyle}>
              <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Withdraw</h2>
              <p style={{ color: "#4b5563", fontSize: "0.95rem", marginBottom: "0.75rem" }}>
                Once the unlock time has passed, you can withdraw ETH back to the owner wallet.
                Attempts to withdraw too early will fail on-chain.
              </p>
              <form onSubmit={handleWithdraw} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <div style={{ flexGrow: 1, minWidth: "140px" }}>
                  <label style={labelStyle}>Amount (ETH)</label>
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="e.g. 0.01"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    style={{ ...inputStyle, width: "100%" }}
                  />
                </div>
                <div style={{ alignSelf: "flex-end" }}>
                  <button type="submit" style={buttonSecondary}>
                    Withdraw
                  </button>
                </div>
              </form>
            </section>

            {/* Extend Lock */}
            <section style={cardStyle}>
              <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Extend Lock</h2>
              <p style={{ color: "#4b5563", fontSize: "0.95rem", marginBottom: "0.75rem" }}>
                Push the unlock time further into the future, based on the duration you choose
                from now. This never shortens the current lock; it only extends it.
              </p>
              <form
                onSubmit={handleExtendLock}
                style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}
              >
                <div style={{ minWidth: "90px" }}>
                  <label style={labelStyle}>Duration</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="e.g. 7"
                    value={lockDurationValue}
                    onChange={(e) => setLockDurationValue(e.target.value)}
                    style={{ ...inputStyle, width: "100%" }}
                  />
                </div>
                <div style={{ minWidth: "110px" }}>
                  <label style={labelStyle}>Unit</label>
                  <select
                    value={lockDurationUnit}
                    onChange={(e) => setLockDurationUnit(e.target.value)}
                    style={{
                      ...inputStyle,
                      width: "100%",
                      paddingRight: "1.75rem",
                      cursor: "pointer",
                    }}
                  >
                    <option value="seconds">seconds</option>
                    <option value="minutes">minutes</option>
                    <option value="hours">hours</option>
                    <option value="days">days</option>
                  </select>
                </div>
                <div style={{ alignSelf: "flex-end" }}>
                  <button type="submit" style={buttonPrimary}>
                    Extend Lock
                  </button>
                </div>
              </form>
            </section>
          </div>
        </div>

        {/* Status + tx info */}
        <section style={{ ...cardStyle, marginBottom: 0 }}>
          <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Status & Transaction Info</h2>
          <p style={{ margin: "0.25rem 0 0.75rem", color: "#374151", fontSize: "0.95rem" }}>
            {status || "No recent actions yet. Use the controls above to interact with MetaLocked."}
          </p>
          {lastTxHash && (
            <p style={{ margin: 0, fontSize: "0.9rem" }}>
              <span style={{ fontWeight: 600 }}>Last Transaction:</span>{" "}
              <a
                href={`https://sepolia.etherscan.io/tx/${lastTxHash}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: "#2563eb", textDecoration: "none" }}
              >
                {lastTxHash.slice(0, 10)}...
              </a>
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

export default App;
