
 // SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Первый токен — VLC
contract VLCToken is ERC20 {
    constructor() ERC20("Vlad Lab Coin", "VLC") {
        _mint(msg.sender, 1_000_000 * 10 ** decimals());
    }
}

// Второй токен — mUSD
contract MockUSD is ERC20 {
    constructor() ERC20("Mock USD", "mUSD") {
        _mint(msg.sender, 1_000_000 * 10 ** decimals());
    }
}
