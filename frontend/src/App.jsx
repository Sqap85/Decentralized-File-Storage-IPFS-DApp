// File: App.jsx
import React, { useState, useEffect } from "react";
import {
  getDefaultConfig,
  RainbowKitProvider,
  ConnectButton,
  darkTheme,
} from "@rainbow-me/rainbowkit";
import { WagmiProvider, useAccount, useWalletClient } from "wagmi";
import { sepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ethers } from "ethers";
import IPFSStorageABI from "./IPFSStorageABI.json";
import { create as createIPFSClient } from "ipfs-http-client";
import "@rainbow-me/rainbowkit/styles.css";
import "./App.css";
import { FaGithub } from "react-icons/fa";

const WALLETCONNECT_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;
const CONTRACT_ADDRESS = "0xcf5Df6513F267192c6bEB5A3a5f29FB6FcFB7b41";

const config = getDefaultConfig({
  appName: "IPFS DApp",
  projectId: WALLETCONNECT_PROJECT_ID,
  chains: [sepolia],
});

const queryClient = new QueryClient();
const ipfs = createIPFSClient({ 
  url: "http://localhost:5001/api/v0",
  timeout: 60000
});

function InnerApp() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [contract, setContract] = useState(null);
  const [files, setFiles] = useState([]);
  const [filteredFiles, setFilteredFiles] = useState([]);
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState("");
  const [contractLoading, setContractLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  const [hasInteracted, setHasInteracted] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [retryCounts, setRetryCounts] = useState({});
  const currentYear = new Date().getFullYear();
  
  
  // Pending dosyaları kaydet
useEffect(() => {
  if (pendingFiles.length > 0) {
    localStorage.setItem('pendingFiles', JSON.stringify(pendingFiles));
  }
}, [pendingFiles]);

// Pending dosyaları yükle
useEffect(() => {
  const saved = localStorage.getItem('pendingFiles');
  if (saved) setPendingFiles(JSON.parse(saved));
}, []);

const cleanupMaxRetryFiles = () => {
  setPendingFiles(prevFiles => {
    // 3 veya daha fazla denemesi olanları filtrele
    const filtered = prevFiles.filter(file => (file.retries || 0) < 3);
    
    // Eğer filtreleme sonucu değişiklik olduysa
    if (filtered.length !== prevFiles.length) {
      // localStorage'ı güncelle
      localStorage.setItem('pendingFiles', JSON.stringify(filtered));
      return filtered;
    }
    return prevFiles;
  });
};
// Pending dosyaları temizleme efekti
useEffect(() => {
  cleanupMaxRetryFiles();
}, [pendingFiles]); // pendingFiles değiştiğinde çalışır

// Component mount olduğunda da çalıştır
useEffect(() => {
  cleanupMaxRetryFiles();
}, []); // Sadece mount olduğunda çalışır

  // Initialize contract
  useEffect(() => {
    const initContract = async () => {
      setContractLoading(true);
      try {
        if (walletClient && isConnected) {
          const provider = new ethers.BrowserProvider(walletClient.transport);
          const signer = await provider.getSigner();
          const c = new ethers.Contract(CONTRACT_ADDRESS, IPFSStorageABI, signer);
          try {
            await c.getMyFiles();
            setContract(c);
          } catch (err) {
            throw new Error(`Invalid contract address or mismatched ABI: ${CONTRACT_ADDRESS}`);
          }
        } else {
          setContract(null);
        }
      } catch (err) {
        console.error("Contract initialization error:", err);
        setInfo(err.message);
        setContract(null);
      } finally {
        setContractLoading(false);
      }
    };
    initContract();
  }, [walletClient, isConnected]);

  // Fetch files when contract changes
  useEffect(() => {
    if (contract) fetchFiles();
  }, [contract]);

  // Filter and sort files
  useEffect(() => {
    filterAndSortFiles();
  }, [files, pendingFiles, searchTerm, dateFilter, sortOrder]);

  const filterAndSortFiles = () => {
    // Only show confirmed files in main list
    let result = [...files];
    
    if (searchTerm) {
      result = result.filter(file => 
        file.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (dateFilter === "") {
      setFilteredFiles([]);
      return;
    }
    
    if (dateFilter && dateFilter !== "all") {
      const now = new Date();
      let cutoffDate = new Date();
      
      switch (dateFilter) {
        case "today": cutoffDate.setDate(now.getDate() - 1); break;
        case "week": cutoffDate.setDate(now.getDate() - 7); break;
        case "month": cutoffDate.setMonth(now.getMonth() - 1); break;
        case "year": cutoffDate.setFullYear(now.getFullYear() - 1); break;
        default: break;
      }
      
      result = result.filter(file => {
        const fileDate = new Date(Number(file.timestamp) * 1000);
        return fileDate >= cutoffDate;
      });
    }
    
    result.sort((a, b) => {
      return sortOrder === "newest" ? 
        Number(b.timestamp) - Number(a.timestamp) : 
        Number(a.timestamp) - Number(b.timestamp);
    });
    
    setFilteredFiles(result);
  };

  const handleFilterInteraction = () => {
    if (!hasInteracted) setHasInteracted(true);
  };

  const uploadToIPFS = async (file) => {
    setInfo("Connecting to IPFS...");
    try {
      // Check if IPFS is available
      await ipfs.version();
      
      setInfo("Uploading file...");
      setUploadProgress(0);
      
      const added = await ipfs.add(file, {
        progress: (bytes) => {
          const progress = file.size ? Math.round((bytes / file.size) * 100) : 0;
          setUploadProgress(progress);
        }
      });
      
      if (!added.path && !added.cid) {
        throw new Error("IPFS returned invalid response");
      }
      
      return added.path || added.cid.toString();
    } catch (err) {
      console.error("IPFS Error:", err);
      if (err.message.includes("Failed to fetch")) {
        throw new Error("Could not connect to IPFS node. Make sure your local IPFS daemon is running.");
      }
      throw err;
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    setInfo("");
    setUploadProgress(0);
  
    const fileExists = [...files, ...pendingFiles].some(f => 
      f.name.toLowerCase() === fileName.toLowerCase()
    );
    if (fileExists) {
      setInfo("A file with this name already exists.");
      return;
    }
  
    if (!file || !fileName || !contract) {
      setInfo("Please select a file, enter a name, and connect your wallet.");
      return;
    }
  
    setLoading(true);
    let ipfsHash = null;
    const tempId = Date.now();

    try {
      // Optimistically add to pending files
      setPendingFiles(prev => [...prev, {
        id: tempId,
        name: fileName,
        status: 'uploading',
        timestamp: Math.floor(Date.now() / 1000),
        retries: 0
      }]);

      // 1. Upload to IPFS
      ipfsHash = await uploadToIPFS(file);
      
      // 2. Register on blockchain
      const tx = await contract.addFile(ipfsHash, fileName);
      await tx.wait();
      
      // Success - remove from pending
      setPendingFiles(prev => prev.filter(f => f.id !== tempId));
      setInfo("File uploaded successfully!");
      fetchFiles();
      
    } catch (err) {
      console.error("Upload error:", err);
      
      // Error handling
      setPendingFiles(prev => prev.map(f => 
        f.id === tempId ? { 
          ...f, 
          status: 'failed', 
          ipfsHash: ipfsHash || null,
          error: err.shortMessage || err.message
        } : f
      ));

      const errorMsg = err.message.includes("user rejected") 
        ? "Transaction canceled by user" 
        : err.shortMessage || err.message;
      
      setInfo(errorMsg);
      
    } finally {
      setLoading(false);
      setFile(null);
      setFileName("");
      setUploadProgress(0);
      document.querySelector('input[type="file"]').value = "";
    }
  };

  const retryUpload = async (pendingFile) => {
    if (!pendingFile.ipfsHash) return;
    
    setLoading(true);
    try {
      // Update retry count
      const newRetryCount = (pendingFile.retries || 0) + 1;
      
      // Eğer 3 deneme yapıldıysa dosyayı sil
      if (newRetryCount > 3) {
        setPendingFiles(prev => prev.filter(f => f.id !== pendingFile.id));
        setInfo("Maximum retry attempts (3) reached. File removed from pending.");
        return;
      }
      
      setPendingFiles(prev => prev.map(f => 
        f.id === pendingFile.id ? { 
          ...f, 
          status: 'retrying',
          retries: newRetryCount
        } : f
      ));
      
      setInfo(`Retrying (Attempt ${newRetryCount})...`);
      const tx = await contract.addFile(pendingFile.ipfsHash, pendingFile.name);
      await tx.wait();
      
      // Success - remove from pending
      setPendingFiles(prev => prev.filter(f => f.id !== pendingFile.id));
      setInfo("File successfully registered on blockchain!");
      fetchFiles();
      
    } catch (err) {
      const newRetryCount = (pendingFile.retries || 0) + 1;
      
      // Eğer 3 deneme yapıldıysa dosyayı sil
      if (newRetryCount >= 3) {
        setPendingFiles(prev => prev.filter(f => f.id !== pendingFile.id));
        setInfo("Maximum retry attempts (3) reached. File removed from pending.");
        return;
      }
      
      setPendingFiles(prev => prev.map(f => 
        f.id === pendingFile.id ? { 
          ...f, 
          status: 'failed',
          retries: newRetryCount,
          error: err.shortMessage || err.message
        } : f
      ));
      
      setInfo(`Retry failed: ${err.shortMessage || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const removePendingFile = (id) => {
    setPendingFiles(prev => prev.filter(f => f.id !== id));
    setInfo("Pending file removed");
  };

  const fetchFiles = async () => {
    if (!contract) return;
    setInfo("Loading files...");
    try {
      const filesArr = await contract.getMyFiles();
      setFiles(filesArr);
      setInfo("");
    } catch (err) {
      console.error("Fetch files error:", err);
      setInfo("Failed to fetch files: " + (err.shortMessage || err.message));
    }
  };

  const deleteFile = async (index) => {
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
  };

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
          
          <form onSubmit={handleUpload} className="upload-form">
            <input 
              type="file" 
              onChange={(e) => setFile(e.target.files[0])} 
              required 
              disabled={loading}
            />
            <input
              type="text"
              placeholder="File name"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              required
              disabled={loading}
            />
            <button 
              type="submit" 
              disabled={loading || !contract || contractLoading}
            >
              {loading ? "Processing..." : "Upload"}
            </button>
            
            {loading && uploadProgress > 0 && (
              <div className="upload-progress">
                <progress value={uploadProgress} max="100" />
                <span>{uploadProgress}%</span>
              </div>
            )}
          </form>
          
          <div className="files-section">
            <hr/>
            <h2>My Files</h2>
            
            <div className="filter-controls">
              <input
                type="text"
                placeholder="Search files..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  handleFilterInteraction();
                }}
              />
              <select
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value);
                  handleFilterInteraction();
                }}
              >
                <option value="">Select time period</option>
                <option value="all">All time</option>
                <option value="today">Today</option>
                <option value="week">This week</option>
                <option value="month">This month</option>
                <option value="year">This year</option>
              </select>
              <select
                value={sortOrder}
                onChange={(e) => {
                  setSortOrder(e.target.value);
                  handleFilterInteraction();
                }}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>
            
            {hasInteracted && (
              <div className="file-count">
                Showing {filteredFiles.length} files
                {pendingFiles.length > 0 && ` (${pendingFiles.length} pending)`}
              </div>
            )}
          </div>
          
          <ul className="files-list">
            {hasInteracted ? (
              filteredFiles.length > 0 || pendingFiles.length > 0 ? (
                <>
                  {/* Confirmed files */}
                  {filteredFiles.map((f, idx) => (
                    <li key={f.id || idx} className="file-item">
                      <span>
                        <a 
                          href={`https://ipfs.io/ipfs/${f.ipfsHash}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                        >
                          {f.name}
                        </a>
                        <span className="file-date">
                          ({new Date(Number(f.timestamp) * 1000).toLocaleString()})
                        </span>
                      </span>
                      <button 
                        onClick={() => deleteFile(idx)} 
                        disabled={loading}
                        className="delete-button"
                      >
                        Delete
                      </button>
                    </li>
                  ))}
                
                  
                  {/* Pending files section */}
                  {pendingFiles.length > 0 && (
                    <li className="files-divider">Pending Uploads</li>
                  )}
                  
                  {pendingFiles.filter(file => (file.retries || 0) < 3).map((file) => (
                    <li 
                      key={`pending-${file.id}`} 
                      className={`file-item ${file.status}`}
                    >
                      <span>
                        {file.name}
                        <span className="file-status">
                          {file.status === 'failed' && `(Failed - Attempt ${file.retries})`}
                          {file.status === 'uploading' && '(Uploading...)'}
                          {file.status === 'retrying' && '(Retrying...)'}
                          {' '}
                          {new Date(file.timestamp * 1000).toLocaleString()}
                        </span>
                      </span>
                      <div>
                        {file.status === 'failed' && file.ipfsHash && (
                          <>
                            <button
                              onClick={() => retryUpload(file)}
                              disabled={loading || (file.retries || 0) >= 3}
                              className="retry-button"
                            >
                              Retry({file.retries || 0}/3)
                            </button>
                            <button
                              onClick={() => removePendingFile(file.id)}
                              disabled={loading}
                              className="remove-button"
                            >
                              Remove
                            </button>
                            
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </>
              ) : (
                <li className="no-files">No files found matching your criteria.</li>
              )
            ) : (
              <li className="no-files">Please use the filters above to view your files.</li>
            )}
          </ul>
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

export default function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme()}>
          <InnerApp />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}