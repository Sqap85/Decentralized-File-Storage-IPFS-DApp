import React, { useState, useEffect, useRef } from "react";

// File hash calculation function (SHA-256)
async function getFileHash(file) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function FileUploadForm({
  contract,
  ipfsClient,
  files,
  setFiles,
  pendingFiles,
  setPendingFiles,
  loading,
  setLoading,
  uploadProgress,
  setUploadProgress,
  setInfo,
  fetchFiles,
  onUploadSuccess,
}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef(null);
  const [fileInputKey, setFileInputKey] = useState(Date.now());

  // Store uploaded file hashes in localStorage
  const [uploadedHashes, setUploadedHashes] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("uploadedHashes") || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("uploadedHashes", JSON.stringify(uploadedHashes));
  }, [uploadedHashes]);

  async function uploadToIPFS(file) {
    setInfo("Connecting to IPFS...");
    try {
      await ipfsClient.version();
      setInfo("Uploading file...");
      setUploadProgress(0);

      const added = await ipfsClient.add(file, {
        progress: (bytes) => {
          const prog = file.size ? Math.round((bytes / file.size) * 100) : 0;
          setUploadProgress(prog);
        },
      });
      if (!added.path && !added.cid) {
        throw new Error("IPFS returned invalid response");
      }
      return added.path || added.cid.toString();
    } catch (err) {
      console.error("IPFS Error:", err);
      if (err.message.includes("Failed to fetch")) {
        throw new Error(
          "Could not connect to IPFS node. Make sure your IPFS daemon is running."
        );
      }
      throw err;
    }
  }

  async function handleUpload(e) {
    e.preventDefault();
    setInfo("");
    setUploadProgress(0);

    if (!selectedFile || !fileName || !contract) {
      setInfo("Please select a file and enter a name.");
      return;
    }

    // Calculate file hash
    const fileHash = await getFileHash(selectedFile);

    // Check if the hash exists on the blockchain (could be ipfsHash or hash field)
    const blockchainHashExists = files.some(
      (f) =>
        f.fileHash === fileHash ||
        f.hash === fileHash ||
        f.ipfsHash === fileHash
    );
    if (blockchainHashExists) {
      setInfo(
        "This file is already registered on the blockchain. You cannot upload it again."
      );
      return;
    }

    // Was it previously uploaded to IPFS? (check hash in localStorage)
    const hashRecord = uploadedHashes.find((h) => h.hash === fileHash);
    if (hashRecord) {
      setInfo(
        "This file was previously uploaded to IPFS but NOT to the blockchain. Now saving to blockchain..."
      );
      setLoading(true);
      try {
        const tx = await contract.addFile(hashRecord.ipfsHash, fileName);
        await tx.wait();
        setInfo("File successfully saved to blockchain!");
        fetchFiles();
        if (onUploadSuccess) {
          setSelectedFile(null);
          setFileName("");
          setFileInputKey(Date.now());
          if (fileInputRef.current) fileInputRef.current.value = "";
          onUploadSuccess();
        }
      } catch (err) {
        setInfo(
          err.message.includes("user rejected")
            ? "Transaction canceled by user"
            : err.shortMessage || err.message
        );
      } finally {
        setLoading(false);
        setUploadProgress(0);
      }
      return;
    }

    // Is there a pending file with the same name and ipfsHash?
    const alreadyUploaded = pendingFiles.find(
      (f) => f.name.toLowerCase() === fileName.toLowerCase() && f.ipfsHash
    );
    if (alreadyUploaded) {
      setInfo(
        "This file is already uploaded to IPFS and pending. Please remove it from the pending list or complete the operation first."
      );
      return;
    }

    // Is there a file with the same name?
    const isDup = [...files, ...pendingFiles].some(
      (f) => f.name.toLowerCase() === fileName.toLowerCase()
    );
    if (isDup) {
      setInfo("A file with this name already exists.");
      return;
    }

    setLoading(true);
    let ipfsHash = null;
    const tempId = Date.now();

    try {
      setPendingFiles((prev) => [
        ...prev,
        {
          id: tempId,
          name: fileName,
          status: "uploading",
          timestamp: Math.floor(Date.now() / 1000),
          retries: 0,
        },
      ]);

      ipfsHash = await uploadToIPFS(selectedFile);

      // Save hash and ipfsHash
      setUploadedHashes((prev) => [...prev, { hash: fileHash, ipfsHash }]);

      setPendingFiles((prev) =>
        prev.map((f) =>
          f.id === tempId ? { ...f, ipfsHash, status: "confirming" } : f
        )
      );

      const tx = await contract.addFile(ipfsHash, fileName);
      await tx.wait();

      setPendingFiles((prev) => prev.filter((f) => f.id !== tempId));
      setInfo("File uploaded successfully!");
      fetchFiles();
      if (onUploadSuccess) {
        setSelectedFile(null);
        setFileName("");
        setFileInputKey(Date.now());
        if (fileInputRef.current) fileInputRef.current.value = "";
        onUploadSuccess();
      }
    } catch (err) {
      console.error("Upload error:", err);
      setPendingFiles((prev) =>
        prev.map((f) =>
          f.id === tempId
            ? {
                ...f,
                status: "failed",
                ipfsHash: ipfsHash || null,
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
      setUploadProgress(0);
    }
  }

  return (
    <form onSubmit={handleUpload} className="upload-form">
      <input
        key={fileInputKey}
        type="file"
        ref={fileInputRef}
        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
        disabled={loading}
      />
      <input
        type="text"
        placeholder="File name"
        value={fileName}
        onChange={(e) => setFileName(e.target.value)}
        disabled={loading}
      />
      <button type="submit" disabled={loading || !contract}>
        {loading ? "Processing..." : "Upload"}
      </button>

      {loading && uploadProgress > 0 && (
        <div className="upload-progress">
          <progress value={uploadProgress} max="100" />
          <span>{uploadProgress}%</span>
        </div>
      )}
    </form>
  );
}
