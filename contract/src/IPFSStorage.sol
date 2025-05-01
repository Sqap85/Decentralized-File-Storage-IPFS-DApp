// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract IPFSStorage {
    struct FileInfo {
        string ipfsHash;
        string name;
        uint256 timestamp;
    }

    mapping(address => FileInfo[]) private userFiles;
    mapping(address => mapping(string => bool)) private fileExists;

    event FileAdded(address indexed user, string ipfsHash, string name, uint256 timestamp);
    event FileDeleted(address indexed user, string ipfsHash, uint256 index);

    // IPFS hash ekleme fonksiyonu
    function addFile(string memory ipfsHash, string memory name) external {
        require(bytes(ipfsHash).length > 0, "IPFS hash cannot be empty");
        require(!fileExists[msg.sender][ipfsHash], "File already exists");

        FileInfo memory newFile = FileInfo({
            ipfsHash: ipfsHash,
            name: name,
            timestamp: block.timestamp
        });

        userFiles[msg.sender].push(newFile);
        fileExists[msg.sender][ipfsHash] = true;

        emit FileAdded(msg.sender, ipfsHash, name, block.timestamp);
    }

    // Kendi dosyalarını listeleme
    function getMyFiles() external view returns (FileInfo[] memory) {
        return userFiles[msg.sender];
    }

    // Belirli dosyayı alma
    function getMyFile(uint256 index) external view returns (FileInfo memory) {
        require(index < userFiles[msg.sender].length, "Index out of bounds");
        return userFiles[msg.sender][index];
    }

    // Dosya sayısını öğrenme
    function getMyFileCount() external view returns (uint256) {
        return userFiles[msg.sender].length;
    }

    // Dosya silme
    function deleteMyFile(uint256 index) external {
        require(index < userFiles[msg.sender].length, "Index out of bounds");

        uint256 lastIndex = userFiles[msg.sender].length - 1;

        FileInfo memory deletedFile = userFiles[msg.sender][index];

        if (index != lastIndex) {
            userFiles[msg.sender][index] = userFiles[msg.sender][lastIndex];
        }

        userFiles[msg.sender].pop();
        fileExists[msg.sender][deletedFile.ipfsHash] = false;

        emit FileDeleted(msg.sender, deletedFile.ipfsHash, index);
    }
}
