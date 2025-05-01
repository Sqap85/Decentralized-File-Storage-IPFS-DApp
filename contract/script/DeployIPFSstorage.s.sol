// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import { IPFSStorage } from "../src/IPFSStorage.sol";

contract DeployIPFSStorage is Script {
    function run() external {
        vm.startBroadcast();

        IPFSStorage storageContract = new IPFSStorage();
        console.log("IPFSStorage deployed to:", address(storageContract));

        vm.stopBroadcast();
    }
}
