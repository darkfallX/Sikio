// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockTUSD8
 * @notice 6-decimal ERC-20 mock matching QDay Aevum Testnet's tUSD8 (0x456569838f1d43009A91ebA4263147Afd7233483)
 *         for deterministic local Hardhat tests only.
 */
contract MockTUSD8 is ERC20 {
    constructor() ERC20("Test USD8", "tUSD8") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
