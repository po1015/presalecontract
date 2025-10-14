// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title RateLimiter
 * @notice Implements rate limiting to prevent bot activities
 * @dev Tracks transaction count and timing per address
 */
contract RateLimiter is AccessControl {
    bytes32 public constant RATE_ADMIN_ROLE = keccak256("RATE_ADMIN_ROLE");
    bytes32 public constant SALE_ROUND_ROLE = keccak256("SALE_ROUND_ROLE");
    
    struct RateLimit {
        uint256 lastTransactionTime;
        uint256 transactionCount;
        uint256 periodStart;
    }
    
    mapping(address => RateLimit) private _limits;
    
    // Configurable parameters
    uint256 public minTimeBetweenTx = 30; // 30 seconds between transactions
    uint256 public maxTxPerPeriod = 10; // Maximum 10 transactions per period
    uint256 public period = 1 days; // Period duration
    
    event RateLimitExceeded(address indexed account, string reason);
    event RateLimitUpdated(uint256 minTimeBetweenTx, uint256 maxTxPerPeriod, uint256 period);
    event LimitReset(address indexed account);
    
    /**
     * @dev Constructor sets up initial roles
     * @param admin Address that will have admin roles
     */
    constructor(address admin) {
        require(admin != address(0), "RateLimiter: zero address");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(RATE_ADMIN_ROLE, admin);
    }
    
    /**
     * @notice Check rate limit and update if passed
     * @param account Address to check
     * @dev Reverts if rate limit is exceeded
     */
    function checkAndUpdateLimit(address account) external onlyRole(SALE_ROUND_ROLE) {
        RateLimit storage limit = _limits[account];
        uint256 currentTime = block.timestamp;
        
        // Check minimum time between transactions
        if (currentTime < limit.lastTransactionTime + minTimeBetweenTx) {
            emit RateLimitExceeded(account, "Too frequent");
            revert("RateLimiter: too frequent");
        }
        
        // Reset period if needed
        if (currentTime >= limit.periodStart + period) {
            limit.periodStart = currentTime;
            limit.transactionCount = 0;
        }
        
        // Check max transactions per period
        if (limit.transactionCount >= maxTxPerPeriod) {
            emit RateLimitExceeded(account, "Period limit exceeded");
            revert("RateLimiter: period limit exceeded");
        }
        
        // Update limits
        limit.lastTransactionTime = currentTime;
        limit.transactionCount++;
    }
    
    /**
     * @notice Reset rate limit for an address
     * @param account Address to reset
     */
    function resetLimit(address account) external onlyRole(RATE_ADMIN_ROLE) {
        delete _limits[account];
        emit LimitReset(account);
    }
    
    /**
     * @notice Update rate limit parameters
     * @param _minTimeBetweenTx New minimum time between transactions
     * @param _maxTxPerPeriod New maximum transactions per period
     * @param _period New period duration
     */
    function updateRateLimitConfig(
        uint256 _minTimeBetweenTx,
        uint256 _maxTxPerPeriod,
        uint256 _period
    ) external onlyRole(RATE_ADMIN_ROLE) {
        require(_minTimeBetweenTx > 0, "RateLimiter: invalid min time");
        require(_maxTxPerPeriod > 0, "RateLimiter: invalid max tx");
        require(_period > 0, "RateLimiter: invalid period");
        
        minTimeBetweenTx = _minTimeBetweenTx;
        maxTxPerPeriod = _maxTxPerPeriod;
        period = _period;
        
        emit RateLimitUpdated(_minTimeBetweenTx, _maxTxPerPeriod, _period);
    }
    
    /**
     * @notice Get rate limit info for an address
     * @param account Address to query
     * @return lastTxTime Last transaction timestamp
     * @return txCount Transaction count in current period
     * @return periodStart Start of current period
     */
    function getRateLimitInfo(address account) external view returns (
        uint256 lastTxTime,
        uint256 txCount,
        uint256 periodStart
    ) {
        RateLimit memory limit = _limits[account];
        return (limit.lastTransactionTime, limit.transactionCount, limit.periodStart);
    }
}

