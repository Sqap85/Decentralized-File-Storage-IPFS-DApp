// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../src/IPFSStorage.sol";

contract IPFSStorageTest is Test {
    IPFSStorage public storageContract;
    address user = address(0xABCD);

    function setUp() public {
        storageContract = new IPFSStorage();
        vm.prank(user);
        storageContract.addFile("QmHash1", "file1.txt");
    }

    function testAddFile() public {
        vm.prank(user);
        storageContract.addFile("QmHash2", "file2.txt");

        vm.prank(user);
        IPFSStorage.FileInfo memory file = storageContract.getMyFile(1);

        assertEq(file.ipfsHash, "QmHash2");
        assertEq(file.name, "file2.txt");
    }

    function testPreventDuplicateFile() public {
        vm.prank(user);
        vm.expectRevert("File already exists");
        storageContract.addFile("QmHash1", "file1.txt");
    }

    function testDeleteFile() public {
        vm.prank(user);
        storageContract.deleteMyFile(0);

        vm.prank(user);
        uint256 count = storageContract.getMyFileCount();
        assertEq(count, 0);
    }

    function testGetFileOutOfBounds() public {
        vm.prank(user);
        vm.expectRevert("Index out of bounds");
        storageContract.getMyFile(5);
    }
} 
