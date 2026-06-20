// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ResponsibleLimits {
    struct LimitConfig {
        uint256 dailyLimit;
        uint256 spentToday;
        uint256 maxPositionExposure;
        uint256 openExposure;
        uint256 maxOpenOrders;
        uint256 openOrders;
        uint256 dailyLossLimit;
        uint256 lossToday;
        uint256 aiExecutionCap;
        uint256 aiExecutedToday;
        uint64 dayBucket;
        uint64 excludedUntil;
        bool pointsOnly;
    }

    address public owner;
    mapping(address => LimitConfig) public limits;
    mapping(address => bool) public authorizedSpender;

    event DailyLimitSet(address indexed user, uint256 amount);
    event SelfExcluded(address indexed user, uint64 until);
    event PointsOnlySet(address indexed user, bool enabled);
    event SpendRecorded(address indexed user, uint256 amount, uint256 spentToday);
    event AuthorizedSpenderSet(address indexed spender, bool enabled);
    event ExposureLimitSet(address indexed user, uint256 amount);
    event OpenOrderLimitSet(address indexed user, uint256 count);
    event DailyLossLimitSet(address indexed user, uint256 amount);
    event AiExecutionCapSet(address indexed user, uint256 amount);
    event ExposureRecorded(address indexed user, uint256 amount, uint256 openExposure);
    event OpenOrderRecorded(address indexed user, uint256 openOrders);
    event LossRecorded(address indexed user, uint256 amount, uint256 lossToday);
    event AiExecutionRecorded(address indexed user, uint256 amount, uint256 aiExecutedToday);

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    modifier onlyAuthorizedSpender() {
        require(authorizedSpender[msg.sender], "NOT_AUTHORIZED");
        _;
    }

    constructor() {
        owner = msg.sender;
        authorizedSpender[msg.sender] = true;
    }

    function setAuthorizedSpender(address spender, bool enabled) external onlyOwner {
        authorizedSpender[spender] = enabled;
        emit AuthorizedSpenderSet(spender, enabled);
    }

    function setDailyLimit(uint256 amount) external {
        limits[msg.sender].dailyLimit = amount;
        emit DailyLimitSet(msg.sender, amount);
    }

    function setExposureLimit(uint256 amount) external {
        limits[msg.sender].maxPositionExposure = amount;
        emit ExposureLimitSet(msg.sender, amount);
    }

    function setOpenOrderLimit(uint256 count) external {
        limits[msg.sender].maxOpenOrders = count;
        emit OpenOrderLimitSet(msg.sender, count);
    }

    function setDailyLossLimit(uint256 amount) external {
        limits[msg.sender].dailyLossLimit = amount;
        emit DailyLossLimitSet(msg.sender, amount);
    }

    function setAiExecutionCap(uint256 amount) external {
        limits[msg.sender].aiExecutionCap = amount;
        emit AiExecutionCapSet(msg.sender, amount);
    }

    function selfExclude(uint64 until) external {
        require(until > block.timestamp, "BAD_UNTIL");
        limits[msg.sender].excludedUntil = until;
        emit SelfExcluded(msg.sender, until);
    }

    function setPointsOnly(bool enabled) external {
        limits[msg.sender].pointsOnly = enabled;
        emit PointsOnlySet(msg.sender, enabled);
    }

    function checkCanTrade(address user, uint256 stake) external view returns (bool) {
        LimitConfig memory config = limits[user];
        if (config.excludedUntil >= block.timestamp || config.pointsOnly) return false;
        uint64 todayBucket = uint64(block.timestamp / 1 days);
        uint256 spent = config.dayBucket == todayBucket ? config.spentToday : 0;
        uint256 loss = config.dayBucket == todayBucket ? config.lossToday : 0;
        return (config.dailyLimit == 0 || spent + stake <= config.dailyLimit)
            && (config.dailyLossLimit == 0 || loss < config.dailyLossLimit);
    }

    function recordSpend(address user, uint256 stake) external onlyAuthorizedSpender {
        LimitConfig storage config = limits[user];
        require(config.excludedUntil < block.timestamp, "SELF_EXCLUDED");
        require(!config.pointsOnly, "POINTS_ONLY");

        _rollDay(config);

        require(config.dailyLimit == 0 || config.spentToday + stake <= config.dailyLimit, "DAILY_LIMIT");
        config.spentToday += stake;
        emit SpendRecorded(user, stake, config.spentToday);
    }

    function recordExposure(address user, uint256 amount) external onlyAuthorizedSpender {
        LimitConfig storage config = limits[user];
        require(config.maxPositionExposure == 0 || config.openExposure + amount <= config.maxPositionExposure, "EXPOSURE_LIMIT");
        config.openExposure += amount;
        emit ExposureRecorded(user, amount, config.openExposure);
    }

    function releaseExposure(address user, uint256 amount) external onlyAuthorizedSpender {
        LimitConfig storage config = limits[user];
        config.openExposure = amount >= config.openExposure ? 0 : config.openExposure - amount;
        emit ExposureRecorded(user, 0, config.openExposure);
    }

    function recordOpenOrder(address user, uint256 exposureAmount) external onlyAuthorizedSpender {
        LimitConfig storage config = limits[user];
        require(config.maxOpenOrders == 0 || config.openOrders + 1 <= config.maxOpenOrders, "OPEN_ORDER_LIMIT");
        require(config.maxPositionExposure == 0 || config.openExposure + exposureAmount <= config.maxPositionExposure, "EXPOSURE_LIMIT");
        config.openOrders += 1;
        emit OpenOrderRecorded(user, config.openOrders);
    }

    function releaseOpenOrder(address user) external onlyAuthorizedSpender {
        LimitConfig storage config = limits[user];
        if (config.openOrders > 0) config.openOrders -= 1;
        emit OpenOrderRecorded(user, config.openOrders);
    }

    function recordLoss(address user, uint256 amount) external onlyAuthorizedSpender {
        LimitConfig storage config = limits[user];
        _rollDay(config);
        config.lossToday += amount;
        require(config.dailyLossLimit == 0 || config.lossToday <= config.dailyLossLimit, "DAILY_LOSS_LIMIT");
        emit LossRecorded(user, amount, config.lossToday);
    }

    function recordAiExecution(address user, uint256 amount) external onlyAuthorizedSpender {
        LimitConfig storage config = limits[user];
        _rollDay(config);
        require(config.aiExecutionCap == 0 || config.aiExecutedToday + amount <= config.aiExecutionCap, "AI_EXECUTION_CAP");
        config.aiExecutedToday += amount;
        emit AiExecutionRecorded(user, amount, config.aiExecutedToday);
    }

    function _rollDay(LimitConfig storage config) internal {
        uint64 todayBucket = uint64(block.timestamp / 1 days);
        if (config.dayBucket != todayBucket) {
            config.dayBucket = todayBucket;
            config.spentToday = 0;
            config.lossToday = 0;
            config.aiExecutedToday = 0;
        }
    }
}
