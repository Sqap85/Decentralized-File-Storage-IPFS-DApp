import React from "react";

export default function FileList({
  filteredFiles,
  pendingFiles,
  loading,
  onDelete,
  onRemovePending,
  onRetryPending,
}) {
  function handleRemovePending(pf) {
    if (pf.ipfsHash) {
      const confirmed = window.confirm(
        "This file has been uploaded to IPFS but NOT to the blockchain. Are you sure you want to remove it from the pending list?"
      );
      if (!confirmed) return;
    }
    onRemovePending(pf.id);
  }

  return (
    <ul className="files-list">
      {filteredFiles.length === 0 && pendingFiles.length === 0 && (
        <li className="no-files">No files found matching your criteria.</li>
      )}

      {filteredFiles.map((file, idx) => (
        <li key={file.id || idx} className="file-item">
          <span>
            <a
              href={`https://ipfs.io/ipfs/${file.ipfsHash}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {file.name}
            </a>
            <span className="file-status">
              {new Date(Number(file.timestamp) * 1000).toLocaleString()}
            </span>
          </span>
          <button
            onClick={() => onDelete(idx)}
            disabled={loading}
            className="delete-button"
          >
            Delete
          </button>
        </li>
      ))}

      {pendingFiles.length > 0 && (
        <>
          <li className="files-divider">Pending Files</li>
          {pendingFiles.map((pf) => (
            <li
              key={pf.id}
              className={`file-item ${pf.status} ${
                pf.status === "retrying" ? "retrying" : ""
              }`}
            >
              <span>
                {pf.name} - {pf.status.toUpperCase()}
              </span>
              <span style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
                {pf.status === "failed" && pf.ipfsHash && (
                  <button
                    onClick={() => onRetryPending(pf)}
                    className="retry-button"
                    disabled={loading}
                  >
                    Retry
                  </button>
                )}
                <button
                  onClick={() => handleRemovePending(pf)}
                  className="delete-button"
                  disabled={loading}
                >
                  Remove
                </button>
              </span>
            </li>
          ))}
        </>
      )}
    </ul>
  );
}
