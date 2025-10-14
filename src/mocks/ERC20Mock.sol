// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ERC20Mock is ERC20 {
    uint8 private _decimals;
    
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        _decimals = 6; // Default to 6 decimals for USDC/USDT simulation
    }
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
    
    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }
    
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
    
    function setDecimals(uint8 decimals_) external {
        _decimals = decimals_;
    }
}

