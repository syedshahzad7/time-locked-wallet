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

  // lock UI state
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
      const unlock = await contract.unlockTime();
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

  // ---- Write: withdraw (owner-only in contract) ----
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
      setStatus(
        "Withdraw failed: " + (err?.reason || err?.message || "Unknown error")
      );
    }
  };

  // ---- Write: extend lock (owner-only in contract) ----
  const handleExtendLock = async (e) => {
    e.preventDefault();
    try {
      const valueNum = Number(lockDurationValue);
      if (!valueNum || valueNum <= 0) {
        setStatus("Enter a positive lock duration.");
        return;
      }

      if (!unlockTime) {
        await refreshOnChainData();
      }

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
      const additionalSeconds = desiredEnd - unlockTime;

      if (additionalSeconds <= 0) {
        setStatus("New lock time must be later than the current unlock time.");
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

  return (
    // OUTER SHELL – full width, centered content
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, #1d4ed8 0, #020617 45%, #020617 100%)",
        padding: "2rem 1rem",
        display: "flex",
        justifyContent: "center",
        boxSizing: "border-box",
      }}
    >
      {/* MAIN CONTAINER – max width, centered */}
      <div
        style={{
          width: "100%",
          maxWidth: "1100px",
          margin: "0 auto",
          background: "#020617",
          borderRadius: "18px",
          padding: "2rem 2rem 2.5rem",
          boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
          color: "#e5e7eb",
          fontFamily:
            "-apple-system,BlinkMacSystemFont,system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif",
        }}
      >
        {/* Header */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.9rem",
            marginBottom: "1.25rem",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              width: "46px",
              height: "46px",
              borderRadius: "999px",
              background:
                "conic-gradient(from 120deg, #22c55e, #0ea5e9, #facc15, #22c55e)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 10px 25px rgba(15,23,42,0.8)",
            }}
          >
            <span
              style={{
                background: "#020617",
                width: "34px",
                height: "34px",
                borderRadius: "999px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px",
              }}
            >
              🔒
            </span>
          </div>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: "1.6rem",
                fontWeight: 700,
                letterSpacing: "0.02em",
              }}
            >
              MetaLocked: A Time-Locked Savings Wallet
            </h1>
            <p
              style={{
                margin: "0.3rem 0 0",
                color: "#9ca3af",
                fontSize: "0.95rem",
              }}
            >
              A Sepolia-based smart contract that helps you lock your ETH for a
              chosen period, so you don&apos;t touch your savings before you
              planned.
            </p>
          </div>
        </header>

        {/* Intro / How to use */}
        <section
          style={{
            marginBottom: "1.8rem",
            background: "#020617",
            borderRadius: "14px",
            padding: "1.35rem 1.4rem",
            border: "1px solid rgba(148,163,184,0.25)",
          }}
        >
          <h2
            style={{
              marginTop: 0,
              marginBottom: "0.7rem",
              fontSize: "1.15rem",
              color: "#e5e7eb",
            }}
          >
            What is MetaLocked?
          </h2>
          <p
            style={{
              marginTop: 0,
              marginBottom: "1rem",
              color: "#cbd5f5",
              fontSize: "0.95rem",
              lineHeight: 1.5,
            }}
          >
            MetaLocked is a simple time-locked savings wallet built on the
            Ethereum Sepolia testnet. When you deposit ETH into this contract,
            those funds stay locked until the unlock time is reached.
            Withdrawals are enforced on-chain by the smart contract, so even if
            you&apos;re tempted, you can&apos;t withdraw before the lock
            expires.
          </p>

          <h3
            style={{
              margin: 0,
              marginBottom: "0.5rem",
              fontSize: "1rem",
              color: "#e5e7eb",
            }}
          >
            How to use MetaLocked
          </h3>
          <ol
            style={{
              margin: 0,
              paddingLeft: "1.25rem",
              color: "#cbd5f5",
              fontSize: "0.95rem",
              lineHeight: 1.55,
            }}
          >
            <li>Install MetaMask and switch your network to Sepolia.</li>
            <li>
              Click <strong>Connect Wallet</strong> below to connect your
              account and confirm the network.
            </li>
            <li>
              Use <strong>Deposit</strong> to send ETH into the contract. The
              balance and unlock time are shown in the On-chain Info panel.
            </li>
            <li>
              Use <strong>Extend Lock</strong> to push the unlock time further
              into the future (e.g., +7 days from now). This transaction can
              only be sent by the <strong>contract owner</strong>.
            </li>
            <li>
              After the unlock time passes, use <strong>Withdraw</strong> to
              move ETH from the contract back to the owner&apos;s wallet. Early
              withdrawal attempts by the owner will fail on-chain.
            </li>
            <li>
              Other users can deposit ETH and monitor the contract, but only the
              owner can actually move funds out. If friends deposit, the owner
              must withdraw and send ETH back to them from their wallet.
            </li>
          </ol>
          <p
            style={{
              marginTop: "0.75rem",
              fontSize: "0.82rem",
              color: "#9ca3af",
            }}
          >
            This owner-only design reduces the attack surface and makes the
            vault easier to reason about: one address controls withdrawals and
            lock extensions, while everyone can verify the rules and
            transactions publicly on Etherscan.
          </p>
        </section>

        {/* MAIN GRID */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "1.2rem",
          }}
        >
          {/* Wallet + On-chain panel (stacked) */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
            {/* Wallet Connection */}
            <section
              style={{
                background: "#020617",
                borderRadius: "14px",
                padding: "1.1rem 1.2rem",
                border: "1px solid rgba(148,163,184,0.25)",
              }}
            >
              <h3
                style={{
                  marginTop: 0,
                  marginBottom: "0.6rem",
                  fontSize: "1.02rem",
                  color: "#e5e7eb",
                }}
              >
                Wallet Connection
              </h3>
              <p
                style={{
                  marginTop: 0,
                  marginBottom: "0.8rem",
                  color: "#9ca3af",
                  fontSize: "0.9rem",
                }}
              >
                Connect your MetaMask wallet on the Sepolia network to start
                interacting with MetaLocked.
              </p>
              <button
                onClick={connectWallet}
                style={{
                  background: "linear-gradient(to right, #4f46e5, #0ea5e9)",
                  border: "none",
                  color: "white",
                  padding: "0.55rem 1.2rem",
                  borderRadius: "999px",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 10px 20px rgba(15,23,42,0.7)",
                }}
              >
                Connect Wallet
              </button>
              <div style={{ marginTop: "0.8rem", fontSize: "0.85rem" }}>
                <p style={{ margin: "0.25rem 0" }}>
                  <strong>Wallet:</strong>{" "}
                  <span style={{ color: "#cbd5f5" }}>
                    {walletAddress || "Not connected"}
                  </span>
                </p>
                <p style={{ margin: "0.25rem 0" }}>
                  <strong>Network:</strong>{" "}
                  <span style={{ color: "#cbd5f5" }}>
                    {network || "Unknown"}
                  </span>
                </p>
              </div>
            </section>

            {/* On-chain Info */}
            <section
              style={{
                background: "#020617",
                borderRadius: "14px",
                padding: "1.1rem 1.2rem",
                border: "1px solid rgba(148,163,184,0.25)",
              }}
            >
              <h3
                style={{
                  marginTop: 0,
                  marginBottom: "0.6rem",
                  fontSize: "1.02rem",
                  color: "#e5e7eb",
                }}
              >
                On-chain Info
              </h3>
              <p
                style={{
                  margin: "0.3rem 0",
                  fontSize: "0.88rem",
                  color: "#9ca3af",
                }}
              >
                <strong>Contract:</strong> {CONTRACT_ADDRESS}
              </p>
              <p
                style={{
                  margin: "0.3rem 0",
                  fontSize: "0.9rem",
                  color: "#cbd5f5",
                }}
              >
                <strong>Current Balance:</strong> {balance} ETH
              </p>
              <p
                style={{
                  margin: "0.3rem 0 0.8rem",
                  fontSize: "0.9rem",
                  color: "#cbd5f5",
                }}
              >
                <strong>Unlock Time:</strong> {formattedUnlockTime}
              </p>
              <button
                onClick={refreshOnChainData}
                style={{
                  background: "rgba(148,163,184,0.15)",
                  border: "1px solid rgba(148,163,184,0.4)",
                  color: "#e5e7eb",
                  padding: "0.45rem 0.9rem",
                  borderRadius: "8px",
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                Refresh
              </button>
            </section>
          </div>

          {/* Right side cards: Deposit, Withdraw, Extend Lock */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
            {/* Deposit */}
            <section
              style={{
                background: "#020617",
                borderRadius: "14px",
                padding: "1.1rem 1.2rem",
                border: "1px solid rgba(148,163,184,0.25)",
              }}
            >
              <h3
                style={{
                  marginTop: 0,
                  marginBottom: "0.6rem",
                  fontSize: "1.02rem",
                  color: "#e5e7eb",
                }}
              >
                Deposit
              </h3>
              <p
                style={{
                  marginTop: 0,
                  marginBottom: "0.8rem",
                  color: "#9ca3af",
                  fontSize: "0.9rem",
                }}
              >
                Send ETH into MetaLocked. These funds will remain in the contract
                until the unlock time has passed.
              </p>
              <form
                onSubmit={handleDeposit}
                style={{ display: "flex", gap: "0.45rem" }}
              >
                <input
                  type="number"
                  step="0.0001"
                  placeholder="Amount in ETH"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "0.45rem 0.6rem",
                    borderRadius: "8px",
                    border: "1px solid rgba(148,163,184,0.45)",
                    background: "#020617",
                    color: "#e5e7eb",
                    fontSize: "0.9rem",
                  }}
                />
                <button
                  type="submit"
                  style={{
                    background: "linear-gradient(to right, #22c55e, #16a34a)",
                    border: "none",
                    color: "white",
                    padding: "0.5rem 1.1rem",
                    borderRadius: "999px",
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Deposit
                </button>
              </form>
            </section>

            {/* Withdraw */}
            <section
              style={{
                background: "#020617",
                borderRadius: "14px",
                padding: "1.1rem 1.2rem",
                border: "1px solid rgba(148,163,184,0.25)",
              }}
            >
              <h3
                style={{
                  marginTop: 0,
                  marginBottom: "0.6rem",
                  fontSize: "1.02rem",
                  color: "#e5e7eb",
                }}
              >
                Withdraw
              </h3>
              <p
                style={{
                  marginTop: 0,
                  marginBottom: "0.8rem",
                  color: "#9ca3af",
                  fontSize: "0.9rem",
                }}
              >
                After the unlock time, the <strong>contract owner</strong> can
                withdraw ETH back to their wallet. If someone else deposited
                funds, the owner must send ETH back to them with a regular
                wallet transfer.
              </p>
              <form
                onSubmit={handleWithdraw}
                style={{ display: "flex", gap: "0.45rem" }}
              >
                <input
                  type="number"
                  step="0.0001"
                  placeholder="Amount in ETH"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "0.45rem 0.6rem",
                    borderRadius: "8px",
                    border: "1px solid rgba(148,163,184,0.45)",
                    background: "#020617",
                    color: "#e5e7eb",
                    fontSize: "0.9rem",
                  }}
                />
                <button
                  type="submit"
                  style={{
                    background: "linear-gradient(to right, #e11d48, #fb923c)",
                    border: "none",
                    color: "white",
                    padding: "0.5rem 1.1rem",
                    borderRadius: "999px",
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Withdraw
                </button>
              </form>
              <p
                style={{
                  fontSize: "0.82rem",
                  marginTop: "0.6rem",
                  color: "#9ca3af",
                }}
              >
                If a non-owner tries to call <code>withdraw</code>, the
                transaction will revert because of the on-chain{" "}
                <code>onlyOwner</code> access control in the smart contract.
              </p>
            </section>

            {/* Extend Lock */}
            <section
              style={{
                background: "#020617",
                borderRadius: "14px",
                padding: "1.1rem 1.2rem",
                border: "1px solid rgba(148,163,184,0.25)",
              }}
            >
              <h3
                style={{
                  marginTop: 0,
                  marginBottom: "0.6rem",
                  fontSize: "1.02rem",
                  color: "#e5e7eb",
                }}
              >
                Extend Lock
              </h3>
              <p
                style={{
                  marginTop: 0,
                  marginBottom: "0.8rem",
                  color: "#9ca3af",
                  fontSize: "0.9rem",
                }}
              >
                Choose how much longer to keep your savings locked. The new
                unlock time will always be in the future compared to the current
                one. Only the <strong>contract owner</strong> can send this
                transaction.
              </p>
              <form
                onSubmit={handleExtendLock}
                style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}
              >
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Duration"
                  value={lockDurationValue}
                  onChange={(e) => setLockDurationValue(e.target.value)}
                  style={{
                    flex: "1 1 120px",
                    padding: "0.45rem 0.6rem",
                    borderRadius: "8px",
                    border: "1px solid rgba(148,163,184,0.45)",
                    background: "#020617",
                    color: "#e5e7eb",
                    fontSize: "0.9rem",
                  }}
                />
                <select
                  value={lockDurationUnit}
                  onChange={(e) => setLockDurationUnit(e.target.value)}
                  style={{
                    flex: "0 0 120px",
                    padding: "0.45rem 0.6rem",
                    borderRadius: "8px",
                    border: "1px solid rgba(148,163,184,0.45)",
                    background: "#020617",
                    color: "#e5e7eb",
                    fontSize: "0.9rem",
                  }}
                >
                  <option value="seconds">seconds</option>
                  <option value="minutes">minutes</option>
                  <option value="hours">hours</option>
                  <option value="days">days</option>
                </select>
                <button
                  type="submit"
                  style={{
                    background: "linear-gradient(to right, #0ea5e9, #22c55e)",
                    border: "none",
                    color: "white",
                    padding: "0.5rem 1.1rem",
                    borderRadius: "999px",
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Extend Lock
                </button>
              </form>
              <p
                style={{
                  fontSize: "0.82rem",
                  marginTop: "0.6rem",
                  color: "#9ca3af",
                }}
              >
                MetaLocked computes <strong>now + duration</strong> and only
                pushes the unlock time forward, never backward. Non-owners who
                attempt to call <code>extendLock</code> will see their
                transaction reverted by the contract&apos;s{" "}
                <code>onlyOwner</code> modifier.
              </p>
            </section>
          </div>
        </div>

        {/* Status */}
        <section
          style={{
            marginTop: "1.6rem",
            background: "#020617",
            borderRadius: "14px",
            padding: "1rem 1.2rem",
            border: "1px solid rgba(148,163,184,0.25)",
          }}
        >
          <h3
            style={{
              marginTop: 0,
              marginBottom: "0.5rem",
              fontSize: "1.02rem",
              color: "#e5e7eb",
            }}
          >
            Status / Result
          </h3>
          <p
            style={{
              marginTop: 0,
              marginBottom: "0.55rem",
              fontSize: "0.9rem",
              color: "#e5e7eb",
            }}
          >
            {status || "No recent transactions yet."}
          </p>
          {lastTxHash && (
            <p
              style={{
                margin: 0,
                fontSize: "0.86rem",
              }}
            >
              Last Tx:{" "}
              <a
                href={`https://sepolia.etherscan.io/tx/${lastTxHash}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: "#38bdf8", textDecoration: "none" }}
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
