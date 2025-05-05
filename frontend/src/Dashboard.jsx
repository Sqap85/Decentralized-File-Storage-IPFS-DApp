import React, { useState, useEffect } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { ethers } from "ethers";
import { create as createIPFSClient } from "ipfs-http-client";
import IPFSStorageABI from "./IPFSStorageABI.json";
import FileUploadForm from "./components/FileUploadForm";
import FilterControls from "./components/FilterControls";
import FileList from "./components/FileList";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { FaGithub } from "react-icons/fa";
import "./App.css";

const CONTRACT_ADDRESS = "0xcf5Df6513F267192c6bEB5A3a5f29FB6FcFB7b41";
const ipfs = createIPFSClient({
  url: "http://localhost:5001/api/v0",
  timeout: 60000,
});

export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [contract, setContract] = useState(null);
  const [contractLoading, setContractLoading] = useState(false);
  const [files, setFiles] = useState([]);
  const [filteredFiles, setFilteredFiles] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  const [hasInteracted, setHasInteracted] = useState(false);

  const [pendingFiles, setPendingFiles] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("pendingFiles") || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("pendingFiles", JSON.stringify(pendingFiles));
  }, [pendingFiles]);

  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState("");
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    if (info.trim()) {
      const timer = setTimeout(() => setInfo(""), 6000);
      return () => clearTimeout(timer);
    }
  }, [info]);

  useEffect(() => {
    initContract();
  }, [walletClient, isConnected]);

  async function initContract() {
    setContractLoading(true);
    try {
      if (walletClient && isConnected) {
        const provider = new ethers.BrowserProvider(walletClient.transport);
        const signer = await provider.getSigner();
        const c = new ethers.Contract(CONTRACT_ADDRESS, IPFSStorageABI, signer);
        await c.getMyFiles();
        setContract(c);
      } else {
        setContract(null);
      }
    } catch (err) {
      console.error("Contract init error:", err);
      setInfo(err.message);
      setContract(null);
    } finally {
      setContractLoading(false);
    }
  }

  useEffect(() => {
    if (contract) fetchFiles();
  }, [contract]);

  useEffect(() => {
    filterAndSortFiles();
  }, [files, pendingFiles, searchTerm, dateFilter, sortOrder]);

  async function fetchFiles() {
    if (!contract) return;
    try {
      const filesArr = await contract.getMyFiles();
      setFiles(filesArr);
    } catch (err) {
      console.error("Fetch files error:", err);
      setInfo("Failed to fetch files: " + (err.shortMessage || err.message));
    }
  }

  function filterAndSortFiles() {
    let result = [...files];
    if (searchTerm) {
      result = result.filter((f) =>
        f.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (dateFilter === "") {
      setFilteredFiles([]);
      return;
    }

    if (dateFilter && dateFilter !== "all") {
      const now = new Date();
      const cutoff = new Date();
      switch (dateFilter) {
        case "today":
          cutoff.setDate(now.getDate() - 1);
          break;
        case "week":
          cutoff.setDate(now.getDate() - 7);
          break;
        case "month":
          cutoff.setMonth(now.getMonth() - 1);
          break;
        case "year":
          cutoff.setFullYear(now.getFullYear() - 1);
          break;
        default:
          break;
      }
      result = result.filter((f) => {
        const fileDate = new Date(Number(f.timestamp) * 1000);
        return fileDate >= cutoff;
      });
    }

    result.sort((a, b) =>
      sortOrder === "newest"
        ? Number(b.timestamp) - Number(a.timestamp)
        : Number(a.timestamp) - Number(b.timestamp)
    );

    setFilteredFiles(result);
  }

  function handleFilterInteraction() {
    if (!hasInteracted) setHasInteracted(true);
  }

  async function deleteFile(index) {
    if (!contract) return;
    setLoading(true);
    setInfo("Deleting file...");
    try {
      const tx = await contract.deleteMyFile(index);
      await tx.wait();
      setInfo("File deleted.");
      fetchFiles();
    } catch (err) {
      setInfo("Delete error: " + (err.shortMessage || err.message));
    } finally {
      setLoading(false);
    }
  }

  function removePendingFile(id) {
    setPendingFiles((prev) => prev.filter((f) => f.id !== id));
    setInfo("Pending file removed");
  }

  async function retryPendingFile(pf) {
    if (!contract) return;
    setLoading(true);
    setInfo("Retrying to save file on blockchain...");
    setPendingFiles((prev) =>
      prev.map((f) => (f.id === pf.id ? { ...f, status: "retrying" } : f))
    );
    try {
      const tx = await contract.addFile(pf.ipfsHash, pf.name);
      await tx.wait();
      setPendingFiles((prev) => prev.filter((f) => f.id !== pf.id));
      setInfo("Dosya blockchain'e başarıyla kaydedildi!");
      fetchFiles();
    } catch (err) {
      setPendingFiles((prev) =>
        prev.map((f) =>
          f.id === pf.id
            ? {
                ...f,
                status: "failed",
                error: {
                  message: err.shortMessage || err.message,
                  type: err.message.includes("user rejected")
                    ? "user_rejected"
                    : "other",
                },
              }
            : f
        )
      );
      setInfo(
        err.message.includes("user rejected")
          ? "Transaction canceled by user"
          : err.shortMessage || err.message
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="App">
      <h1>IPFS File Storage DApp</h1>

      <div className="connect-button-container">
        <ConnectButton />
      </div>

      {info && <div className="info-message">{info}</div>}

      {isConnected && (
        <div className="connected-container">
          <p className="connected-address">Connected: {address}</p>

          {contractLoading && (
            <div className="loading-message">Loading smart contract...</div>
          )}

          <FileUploadForm
            contract={contract}
            ipfsClient={ipfs}
            files={files}
            setFiles={setFiles}
            pendingFiles={pendingFiles}
            setPendingFiles={setPendingFiles}
            loading={loading}
            setLoading={setLoading}
            uploadProgress={uploadProgress}
            setUploadProgress={setUploadProgress}
            setInfo={setInfo}
            fetchFiles={fetchFiles}
            onUploadSuccess={() => {
              setUploadProgress(0);
            }}
          />

          <div className="files-section">
            <hr />
            <h2>My Files</h2>
            <FilterControls
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              dateFilter={dateFilter}
              setDateFilter={setDateFilter}
              sortOrder={sortOrder}
              setSortOrder={setSortOrder}
              handleFilterInteraction={handleFilterInteraction}
            />
            {hasInteracted && (
              <div className="file-count">
                Showing {filteredFiles.length} files
                {pendingFiles.length > 0 && ` (${pendingFiles.length} pending)`}
              </div>
            )}
          </div>

          <FileList
            filteredFiles={filteredFiles}
            pendingFiles={pendingFiles}
            loading={loading}
            onDelete={(filteredIndex) => {
              const fileToDelete = filteredFiles[filteredIndex];
              const actualIndex = files.findIndex(
                (f) => f.ipfsHash === fileToDelete.ipfsHash
              );
              deleteFile(actualIndex);
            }}
            onRemovePending={removePendingFile}
            onRetryPending={retryPendingFile}
          />
        </div>
      )}

      <footer className="app-footer">
        <div className="footer-content">
          <span>85 Company © {currentYear} - MIT License</span>
          <a
            href="https://github.com/Sqap85/Decentralized-File-Storage-IPFS-DApp"
            target="_blank"
            rel="noopener noreferrer"
            className="github-link"
          >
            <FaGithub className="github-icon" />
          </a>
        </div>
      </footer>
    </div>
  );
}
