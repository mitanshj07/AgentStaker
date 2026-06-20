export const MarketFactoryAbi = [
  {
    type: 'event',
    name: 'MarketCreated',
    inputs: [
      { indexed: true, name: 'marketId', type: 'uint256' },
      { indexed: true, name: 'creator', type: 'address' },
      { indexed: false, name: 'question', type: 'string' },
      { indexed: false, name: 'category', type: 'string' },
    ],
  },
  {
    type: 'event',
    name: 'MarketLocked',
    inputs: [{ indexed: true, name: 'marketId', type: 'uint256' }],
  },
  {
    type: 'event',
    name: 'MarketDisputed',
    inputs: [{ indexed: true, name: 'marketId', type: 'uint256' }],
  },
  {
    type: 'event',
    name: 'MarketResolved',
    inputs: [
      { indexed: true, name: 'marketId', type: 'uint256' },
      { indexed: true, name: 'winningOutcome', type: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'MarketVoided',
    inputs: [
      { indexed: true, name: 'marketId', type: 'uint256' },
      { indexed: false, name: 'reason', type: 'string' },
    ],
  },
] as const

export const AMMPoolAbi = [
  {
    type: 'event',
    name: 'LiquidityAdded',
    inputs: [
      { indexed: true, name: 'marketId', type: 'uint256' },
      { indexed: true, name: 'lp', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: false, name: 'units', type: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'LiquidityRemoved',
    inputs: [
      { indexed: true, name: 'marketId', type: 'uint256' },
      { indexed: true, name: 'lp', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: false, name: 'units', type: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'Trade',
    inputs: [
      { indexed: true, name: 'marketId', type: 'uint256' },
      { indexed: true, name: 'trader', type: 'address' },
      { indexed: false, name: 'outcomeIndex', type: 'uint256' },
      { indexed: false, name: 'amountIn', type: 'uint256' },
      { indexed: false, name: 'sharesOut', type: 'uint256' },
      { indexed: false, name: 'newOdds', type: 'uint256' },
    ],
  },
] as const

export const OracleCouncilAbi = [
  {
    type: 'event',
    name: 'ResultCommitted',
    inputs: [
      { indexed: true, name: 'marketId', type: 'uint256' },
      { indexed: true, name: 'submitter', type: 'address' },
      { indexed: false, name: 'commitHash', type: 'bytes32' },
    ],
  },
  {
    type: 'event',
    name: 'ResultRevealed',
    inputs: [
      { indexed: true, name: 'marketId', type: 'uint256' },
      { indexed: true, name: 'outcomeIndex', type: 'uint256' },
      { indexed: false, name: 'disputeDeadline', type: 'uint64' },
    ],
  },
  {
    type: 'event',
    name: 'ResultFinalized',
    inputs: [
      { indexed: true, name: 'marketId', type: 'uint256' },
      { indexed: true, name: 'outcomeIndex', type: 'uint256' },
    ],
  },
  {
    type: 'event', name: 'ResultChallenged',
    inputs: [
      { indexed: true, name: 'marketId', type: 'uint256' },
      { indexed: true, name: 'challenger', type: 'address' },
      { indexed: false, name: 'proposedOutcome', type: 'uint256' },
      { indexed: false, name: 'bond', type: 'uint256' },
    ],
  },
  {
    type: 'event', name: 'ChallengeResolved',
    inputs: [
      { indexed: true, name: 'marketId', type: 'uint256' },
      { indexed: false, name: 'finalOutcome', type: 'uint256' },
      { indexed: false, name: 'winner', type: 'address' },
      { indexed: false, name: 'totalBond', type: 'uint256' },
    ],
  },
] as const

export const ExchangeBookAbi = [
  {
    type: 'event',
    name: 'OrderFilled',
    inputs: [
      { indexed: true, name: 'orderHash', type: 'bytes32' },
      { indexed: true, name: 'maker', type: 'address' },
      { indexed: true, name: 'taker', type: 'address' },
      { indexed: false, name: 'marketId', type: 'uint256' },
      { indexed: false, name: 'outcomeIndex', type: 'uint256' },
      { indexed: false, name: 'side', type: 'uint8' },
      { indexed: false, name: 'fillSize', type: 'uint256' },
      { indexed: false, name: 'price1e18', type: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'OrderCanceledEvent',
    inputs: [
      { indexed: true, name: 'maker', type: 'address' },
      { indexed: true, name: 'nonce', type: 'uint256' },
    ],
  },
] as const

export const ParlayEngineAbi = [
  {
    type: 'event', name: 'ParlayCreated',
    inputs: [
      { indexed: true, name: 'parlayId', type: 'uint256' },
      { indexed: true, name: 'user', type: 'address' },
      { indexed: false, name: 'legs', type: 'uint256' },
      { indexed: false, name: 'stake', type: 'uint256' },
      { indexed: false, name: 'payout', type: 'uint256' },
    ],
  },
  {
    type: 'event', name: 'ParlayCashedOut',
    inputs: [
      { indexed: true, name: 'parlayId', type: 'uint256' },
      { indexed: true, name: 'user', type: 'address' },
      { indexed: false, name: 'cashoutValue', type: 'uint256' },
      { indexed: false, name: 'releasedLiability', type: 'uint256' },
    ],
  },
  {
    type: 'event', name: 'ParlaySettled',
    inputs: [
      { indexed: true, name: 'parlayId', type: 'uint256' },
      { indexed: false, name: 'status', type: 'uint8' },
      { indexed: false, name: 'payout', type: 'uint256' },
    ],
  },
  {
    type: 'event', name: 'ParlayClaimed',
    inputs: [
      { indexed: true, name: 'parlayId', type: 'uint256' },
      { indexed: true, name: 'user', type: 'address' },
      { indexed: false, name: 'payout', type: 'uint256' },
    ],
  },
] as const

export const ForecastArenaAbi = [
  {
    type: 'event', name: 'ForecastCommitted',
    inputs: [
      { indexed: true, name: 'agent', type: 'address' },
      { indexed: true, name: 'marketId', type: 'uint256' },
      { indexed: false, name: 'commitHash', type: 'bytes32' },
      { indexed: false, name: 'revealDeadline', type: 'uint64' },
    ],
  },
  {
    type: 'event', name: 'ForecastRevealed',
    inputs: [
      { indexed: true, name: 'agent', type: 'address' },
      { indexed: true, name: 'marketId', type: 'uint256' },
      { indexed: false, name: 'probabilityYes1e18', type: 'uint256' },
    ],
  },
  {
    type: 'event', name: 'ForecastScored',
    inputs: [
      { indexed: true, name: 'agent', type: 'address' },
      { indexed: true, name: 'marketId', type: 'uint256' },
      { indexed: false, name: 'probabilityYes1e18', type: 'uint256' },
      { indexed: false, name: 'outcomeHappened', type: 'bool' },
    ],
  },
] as const

export const SharedLiquidityVaultAbi = [
  {
    type: 'event', name: 'Deposited',
    inputs: [
      { indexed: true, name: 'user', type: 'address' },
      { indexed: false, name: 'assets', type: 'uint256' },
      { indexed: false, name: 'shares', type: 'uint256' },
    ],
  },
  {
    type: 'event', name: 'WithdrawalPaid',
    inputs: [
      { indexed: true, name: 'user', type: 'address' },
      { indexed: false, name: 'assets', type: 'uint256' },
      { indexed: false, name: 'shares', type: 'uint256' },
    ],
  },
  {
    type: 'event', name: 'WithdrawalQueued',
    inputs: [
      { indexed: true, name: 'user', type: 'address' },
      { indexed: false, name: 'assets', type: 'uint256' },
      { indexed: false, name: 'shares', type: 'uint256' },
    ],
  },
  {
    type: 'event', name: 'AllocationChanged',
    inputs: [
      { indexed: true, name: 'marketId', type: 'uint256' },
      { indexed: false, name: 'deployedAssets', type: 'uint256' },
      { indexed: false, name: 'lpUnits', type: 'uint256' },
    ],
  },
  {
    type: 'event', name: 'Rebalanced',
    inputs: [
      { indexed: true, name: 'fromMarketId', type: 'uint256' },
      { indexed: true, name: 'toMarketId', type: 'uint256' },
      { indexed: false, name: 'assets', type: 'uint256' },
    ],
  },
] as const

export const AIPassAbi = [{
  type: 'event', name: 'PassMinted',
  inputs: [
    { indexed: true, name: 'user', type: 'address' },
    { indexed: true, name: 'tier', type: 'uint256' },
    { indexed: false, name: 'credits', type: 'uint256' },
  ],
}] as const

export const CreatorVaultAbi = [{
  type: 'event', name: 'CreatorFeeRecorded',
  inputs: [
    { indexed: true, name: 'creator', type: 'address' },
    { indexed: true, name: 'referrer', type: 'address' },
    { indexed: false, name: 'creatorAmount', type: 'uint256' },
    { indexed: false, name: 'referralAmount', type: 'uint256' },
    { indexed: false, name: 'protocolAmount', type: 'uint256' },
  ],
}] as const

export const LeagueFactoryAbi = [{
  type: 'event', name: 'LeagueJoined',
  inputs: [
    { indexed: true, name: 'leagueId', type: 'uint256' },
    { indexed: true, name: 'member', type: 'address' },
  ],
}] as const

export const ReputationAbi = [{
  type: 'event', name: 'BadgeIssued',
  inputs: [
    { indexed: true, name: 'user', type: 'address' },
    { indexed: true, name: 'badge', type: 'bytes32' },
  ],
}] as const

export const ResponsibleLimitsAbi = [{
  type: 'event', name: 'SpendRecorded',
  inputs: [
    { indexed: true, name: 'user', type: 'address' },
    { indexed: false, name: 'amount', type: 'uint256' },
    { indexed: false, name: 'spentToday', type: 'uint256' },
  ],
}] as const

export const RiskGovernorAbi = [
  {
    type: 'event',
    name: 'ProposalCreated',
    inputs: [
      { indexed: true, name: 'proposalId', type: 'uint256' },
      { indexed: true, name: 'agent', type: 'address' },
      { indexed: true, name: 'user', type: 'address' },
      { indexed: false, name: 'kind', type: 'uint8' },
      { indexed: false, name: 'marketId', type: 'uint256' },
      { indexed: false, name: 'value', type: 'uint256' },
      { indexed: false, name: 'riskScoreBps', type: 'uint256' },
      { indexed: false, name: 'correlationBps', type: 'uint256' },
      { indexed: false, name: 'simulationHash', type: 'bytes32' },
    ],
  },
  {
    type: 'event',
    name: 'ProposalApproved',
    inputs: [
      { indexed: true, name: 'proposalId', type: 'uint256' },
      { indexed: true, name: 'user', type: 'address' },
    ],
  },
  {
    type: 'event',
    name: 'ProposalExecuted',
    inputs: [
      { indexed: true, name: 'proposalId', type: 'uint256' },
      { indexed: true, name: 'executor', type: 'address' },
    ],
  },
] as const

export const BetSlipNFTAbi = [
  {
    type: 'event', name: 'SlipMinted',
    inputs: [
      { indexed: true, name: 'tokenId', type: 'uint256' },
      { indexed: true, name: 'owner', type: 'address' },
      { indexed: true, name: 'originContract', type: 'address' },
      { indexed: false, name: 'originId', type: 'uint256' },
      { indexed: false, name: 'slipType', type: 'uint8' },
      { indexed: false, name: 'rarity', type: 'uint8' },
      { indexed: false, name: 'stakeWei', type: 'uint256' },
      { indexed: false, name: 'oddsSnapshot1e18', type: 'uint256' },
    ],
  },
  { type: 'event', name: 'SlipStatusUpdated', inputs: [{ indexed: true, name: 'tokenId', type: 'uint256' }, { indexed: false, name: 'status', type: 'uint8' }] },
] as const

export const SocialMarketAbi = [
  {
    type: 'event', name: 'SocialMarketCreated',
    inputs: [
      { indexed: true, name: 'marketId', type: 'uint256' },
      { indexed: true, name: 'creator', type: 'address' },
      { indexed: false, name: 'platform', type: 'uint8' },
      { indexed: false, name: 'metric', type: 'uint8' },
      { indexed: false, name: 'targetValue', type: 'uint256' },
      { indexed: false, name: 'resolveTime', type: 'uint64' },
    ],
  },
  { type: 'event', name: 'SocialResolutionFinalized', inputs: [{ indexed: true, name: 'marketId', type: 'uint256' }, { indexed: false, name: 'finalValue', type: 'uint256' }, { indexed: false, name: 'hitTarget', type: 'bool' }, { indexed: false, name: 'evidenceURI', type: 'string' }] },
  { type: 'event', name: 'SocialVoided', inputs: [{ indexed: true, name: 'marketId', type: 'uint256' }] },
  { type: 'event', name: 'SocialRefunded', inputs: [{ indexed: true, name: 'marketId', type: 'uint256' }, { indexed: true, name: 'user', type: 'address' }, { indexed: false, name: 'payout', type: 'uint256' }] },
  { type: 'event', name: 'SocialPrizePoolRefunded', inputs: [{ indexed: true, name: 'marketId', type: 'uint256' }, { indexed: true, name: 'creator', type: 'address' }, { indexed: false, name: 'payout', type: 'uint256' }] },
] as const

export const BattleArenaAbi = [
  {
    type: 'event', name: 'BattleResolved',
    inputs: [
      { indexed: true, name: 'battleId', type: 'uint256' },
      { indexed: true, name: 'winner', type: 'address' },
      { indexed: false, name: 'challengerScore', type: 'uint256' },
      { indexed: false, name: 'defenderScore', type: 'uint256' },
    ],
  },
  { type: 'event', name: 'BattleCancelled', inputs: [{ indexed: true, name: 'battleId', type: 'uint256' }] },
  {
    type: 'event', name: 'AgentDuelCreated',
    inputs: [
      { indexed: true, name: 'duelId', type: 'uint256' },
      { indexed: true, name: 'marketId', type: 'uint256' },
      { indexed: false, name: 'agentA', type: 'uint256' },
      { indexed: false, name: 'agentB', type: 'uint256' },
    ],
  },
  {
    type: 'event', name: 'AgentDuelStaked',
    inputs: [
      { indexed: true, name: 'duelId', type: 'uint256' },
      { indexed: true, name: 'user', type: 'address' },
      { indexed: false, name: 'supportA', type: 'bool' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
  },
  {
    type: 'event', name: 'DuelSettled',
    inputs: [
      { indexed: true, name: 'duelId', type: 'uint256' },
      { indexed: false, name: 'winnerAgent', type: 'uint256' },
      { indexed: false, name: 'totalPool', type: 'uint256' },
      { indexed: false, name: 'fee', type: 'uint256' },
    ],
  },
  {
    type: 'event', name: 'DuelRewardClaimed',
    inputs: [
      { indexed: true, name: 'duelId', type: 'uint256' },
      { indexed: true, name: 'user', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
  },
  {
    type: 'event', name: 'StrategyClashCreated',
    inputs: [
      { indexed: true, name: 'clashId', type: 'uint256' },
      { indexed: false, name: 'agentA', type: 'uint256' },
      { indexed: false, name: 'agentB', type: 'uint256' },
    ],
  },
  {
    type: 'event', name: 'StrategyClashStaked',
    inputs: [
      { indexed: true, name: 'clashId', type: 'uint256' },
      { indexed: true, name: 'user', type: 'address' },
      { indexed: false, name: 'supportA', type: 'bool' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: false, name: 'commitHash', type: 'bytes32' },
    ],
  },
  {
    type: 'event', name: 'StrategyClashSettled',
    inputs: [
      { indexed: true, name: 'clashId', type: 'uint256' },
      { indexed: false, name: 'winnerAgent', type: 'uint256' },
      { indexed: false, name: 'totalPool', type: 'uint256' },
      { indexed: false, name: 'fee', type: 'uint256' },
    ],
  },
  {
    type: 'event', name: 'CardBattleCreated',
    inputs: [
      { indexed: true, name: 'battleId', type: 'uint256' },
      { indexed: false, name: 'agentA', type: 'uint256' },
      { indexed: false, name: 'agentB', type: 'uint256' },
    ],
  },
  {
    type: 'event', name: 'CardBattleStaked',
    inputs: [
      { indexed: true, name: 'battleId', type: 'uint256' },
      { indexed: true, name: 'user', type: 'address' },
      { indexed: false, name: 'supportA', type: 'bool' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
  },
  {
    type: 'event', name: 'CardBattleSettled',
    inputs: [
      { indexed: true, name: 'battleId', type: 'uint256' },
      { indexed: false, name: 'winnerAgent', type: 'uint256' },
      { indexed: false, name: 'totalPool', type: 'uint256' },
      { indexed: false, name: 'fee', type: 'uint256' },
    ],
  },
] as const

export const AgentNFTAbi = [
  {
    type: 'event', name: 'AgentMinted',
    inputs: [
      { indexed: true, name: 'tokenId', type: 'uint256' },
      { indexed: true, name: 'owner', type: 'address' },
      { indexed: false, name: 'name', type: 'string' },
      { indexed: false, name: 'archetype', type: 'string' },
      { indexed: false, name: 'strategyHash', type: 'bytes32' },
    ],
  },
  {
    type: 'event', name: 'AgentStatsSynced',
    inputs: [
      { indexed: true, name: 'tokenId', type: 'uint256' },
      {
        indexed: false, name: 'stats', type: 'tuple', components: [
          { name: 'brierScore1e18', type: 'uint256' },
          { name: 'winRate1e4', type: 'uint256' },
          { name: 'calibration1e4', type: 'uint256' },
          { name: 'battleWins', type: 'uint256' },
          { name: 'battleLosses', type: 'uint256' },
          { name: 'streak', type: 'uint256' }
        ]
      },
    ],
  },
] as const

export const SignalMarketplaceAbi = [{
  type: 'event', name: 'SignalRegistered',
  inputs: [
    { indexed: true, name: 'signalId', type: 'uint256' },
    { indexed: true, name: 'agent', type: 'address' },
    { indexed: true, name: 'bundleHash', type: 'bytes32' },
    { indexed: false, name: 'creditCost', type: 'uint256' },
    { indexed: false, name: 'requiredTier', type: 'uint256' },
  ],
}] as const

export const FantasyContestAbi = [
  { type: 'event', name: 'LineupSubmitted', inputs: [{ indexed: true, name: 'contestId', type: 'uint256' }, { indexed: true, name: 'user', type: 'address' }, { indexed: false, name: 'picksHash', type: 'bytes32' }] },
  { type: 'event', name: 'LineupScored', inputs: [{ indexed: true, name: 'contestId', type: 'uint256' }, { indexed: true, name: 'user', type: 'address' }, { indexed: false, name: 'points', type: 'uint256' }] },
  { type: 'event', name: 'ContestFinalized', inputs: [{ indexed: true, name: 'contestId', type: 'uint256' }, { indexed: true, name: 'winner', type: 'address' }, { indexed: false, name: 'points', type: 'uint256' }] },
] as const
