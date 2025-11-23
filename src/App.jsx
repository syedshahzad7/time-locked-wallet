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

  // NEW: lock UI state
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

  // ---- NEW: Write: extend lock ----
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

  return (
    <div
      style={{
        maxWidth: "600px",
        margin: "0 auto",
        padding: "1.5rem",
        fontFamily: "sans-serif",
      }}
    >
      <h1>Time-Locked Savings Wallet</h1>

      {/* Connect Wallet */}
      <section style={{ marginBottom: "1.5rem" }}>
        <button onClick={connectWallet}>Connect Wallet</button>
        <div style={{ marginTop: "0.5rem" }}>
          <p>
            <strong>Wallet:</strong> {walletAddress || "Not connected"}
          </p>
          <p>
            <strong>Network:</strong> {network || "Unknown"}
          </p>
        </div>
      </section>

      {/* Read data */}
      <section style={{ marginBottom: "1.5rem" }}>
        <h3>On-chain Info</h3>
        <p>
          <strong>Contract Address:</strong> {CONTRACT_ADDRESS}
        </p>
        <p>
          <strong>Current Balance:</strong> {balance} ETH
        </p>
        <p>
          <strong>Unlock Time:</strong> {formattedUnlockTime}
        </p>
        <button onClick={refreshOnChainData}>Refresh</button>
      </section>

      {/* Deposit */}
      <section style={{ marginBottom: "1.5rem" }}>
        <h3>Deposit</h3>
        <form onSubmit={handleDeposit}>
          <input
            type="number"
            step="0.0001"
            placeholder="Amount in ETH"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
          />
          <button type="submit">Deposit</button>
        </form>
      </section>

      {/* Withdraw */}
      <section style={{ marginBottom: "1.5rem" }}>
        <h3>Withdraw</h3>
        <form onSubmit={handleWithdraw}>
          <input
            type="number"
            step="0.0001"
            placeholder="Amount in ETH"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
          />
          <button type="submit">Withdraw</button>
        </form>
      </section>

      {/* NEW: Extend Lock */}
      <section style={{ marginBottom: "1.5rem" }}>
        <h3>Extend Lock</h3>
        <form onSubmit={handleExtendLock}>
          <input
            type="number"
            min="0"
            step="1"
            placeholder="Duration"
            value={lockDurationValue}
            onChange={(e) => setLockDurationValue(e.target.value)}
            style={{ marginRight: "0.5rem" }}
          />
          <select
            value={lockDurationUnit}
            onChange={(e) => setLockDurationUnit(e.target.value)}
            style={{ marginRight: "0.5rem" }}
          >
            <option value="seconds">seconds</option>
            <option value="minutes">minutes</option>
            <option value="hours">hours</option>
            <option value="days">days</option>
          </select>
          <button type="submit">Extend Lock</button>
        </form>
        <p style={{ fontSize: "0.9rem", marginTop: "0.5rem" }}>
          This will lock funds until <strong>now + duration</strong>.  
          It always pushes the unlock time further into the future; it never shortens it.
        </p>
      </section>

      {/* Status + tx info */}
      <section>
        <h3>Status / Result</h3>
        <p>{status}</p>
        {lastTxHash && (
          <p>
            Last Tx:{" "}
            <a
              href={`https://sepolia.etherscan.io/tx/${lastTxHash}`}
              target="_blank"
              rel="noreferrer"
            >
              {lastTxHash.slice(0, 10)}...
            </a>
          </p>
        )}
      </section>
    </div>
  );
}

export default App;
