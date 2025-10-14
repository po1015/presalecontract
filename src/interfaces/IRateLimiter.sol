// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IRateLimiter {
    function checkAndUpdateLimit(address account) external;
    function resetLimit(address account) external;
}

