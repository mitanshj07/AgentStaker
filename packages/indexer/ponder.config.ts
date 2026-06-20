import { createConfig } from 'ponder'
import {
  AIPassAbi,
  AMMPoolAbi,
  CreatorVaultAbi,
  ExchangeBookAbi,
  ForecastArenaAbi,
  LeagueFactoryAbi,
  MarketFactoryAbi,
  OracleCouncilAbi,
  ParlayEngineAbi,
  ReputationAbi,
  ResponsibleLimitsAbi,
  RiskGovernorAbi,
  SharedLiquidityVaultAbi,
  BetSlipNFTAbi,
  SocialMarketAbi,
  BattleArenaAbi,
  SignalMarketplaceAbi,
  FantasyContestAbi,
  AgentNFTAbi,
} from './src/abis'

const deploymentBlock = Number(process.env.DEPLOYMENT_BLOCK ?? process.env.START_BLOCK ?? 1)

export default createConfig({
  chains: {
    monadTestnet: {
      id: 10143,
      rpc: process.env.PONDER_RPC_URL ?? 'https://testnet-rpc.monad.xyz',
    },
  },
  contracts: {
    MarketFactory: {
      abi: MarketFactoryAbi,
      address: process.env.MARKET_FACTORY as `0x${string}` | undefined,
      chain: 'monadTestnet',
      startBlock: deploymentBlock,
    },
    AMMPool: {
      abi: AMMPoolAbi,
      address: process.env.AMM_POOL as `0x${string}` | undefined,
      chain: 'monadTestnet',
      startBlock: deploymentBlock,
    },
    OracleCouncil: {
      abi: OracleCouncilAbi,
      address: process.env.ORACLE_COUNCIL as `0x${string}` | undefined,
      chain: 'monadTestnet',
      startBlock: deploymentBlock,
    },
    ExchangeBook: {
      abi: ExchangeBookAbi,
      address: process.env.EXCHANGE_BOOK as `0x${string}` | undefined,
      chain: 'monadTestnet',
      startBlock: deploymentBlock,
    },
    RiskGovernor: {
      abi: RiskGovernorAbi,
      address: process.env.RISK_GOVERNOR as `0x${string}` | undefined,
      chain: 'monadTestnet',
      startBlock: deploymentBlock,
    },
    ParlayEngine: {
      abi: ParlayEngineAbi,
      address: process.env.PARLAY_ENGINE as `0x${string}` | undefined,
      chain: 'monadTestnet',
      startBlock: deploymentBlock,
    },
    ForecastArena: {
      abi: ForecastArenaAbi,
      address: process.env.FORECAST_ARENA as `0x${string}` | undefined,
      chain: 'monadTestnet',
      startBlock: deploymentBlock,
    },
    SharedLiquidityVault: {
      abi: SharedLiquidityVaultAbi,
      address: process.env.SHARED_LIQUIDITY_VAULT as `0x${string}` | undefined,
      chain: 'monadTestnet',
      startBlock: deploymentBlock,
    },
    AIPass: {
      abi: AIPassAbi,
      address: process.env.AI_PASS as `0x${string}` | undefined,
      chain: 'monadTestnet',
      startBlock: deploymentBlock,
    },
    CreatorVault: {
      abi: CreatorVaultAbi,
      address: process.env.CREATOR_VAULT as `0x${string}` | undefined,
      chain: 'monadTestnet',
      startBlock: deploymentBlock,
    },
    LeagueFactory: {
      abi: LeagueFactoryAbi,
      address: process.env.LEAGUE_FACTORY as `0x${string}` | undefined,
      chain: 'monadTestnet',
      startBlock: deploymentBlock,
    },
    Reputation: {
      abi: ReputationAbi,
      address: process.env.REPUTATION as `0x${string}` | undefined,
      chain: 'monadTestnet',
      startBlock: deploymentBlock,
    },
    ResponsibleLimits: {
      abi: ResponsibleLimitsAbi,
      address: process.env.RESPONSIBLE_LIMITS as `0x${string}` | undefined,
      chain: 'monadTestnet',
      startBlock: deploymentBlock,
    },
    BetSlipNFT: {
      abi: BetSlipNFTAbi,
      address: process.env.BET_SLIP_NFT as `0x${string}` | undefined,
      chain: 'monadTestnet',
      startBlock: deploymentBlock,
    },
    SocialMarket: {
      abi: SocialMarketAbi,
      address: process.env.SOCIAL_MARKET as `0x${string}` | undefined,
      chain: 'monadTestnet',
      startBlock: deploymentBlock,
    },
    BattleArena: {
      abi: BattleArenaAbi,
      address: process.env.BATTLE_ARENA as `0x${string}` | undefined,
      chain: 'monadTestnet',
      startBlock: deploymentBlock,
    },
    SignalMarketplace: {
      abi: SignalMarketplaceAbi,
      address: process.env.SIGNAL_MARKETPLACE as `0x${string}` | undefined,
      chain: 'monadTestnet',
      startBlock: deploymentBlock,
    },
    FantasyContest: {
      abi: FantasyContestAbi,
      address: process.env.FANTASY_CONTEST as `0x${string}` | undefined,
      chain: 'monadTestnet',
      startBlock: deploymentBlock,
    },
    AgentNFT: {
      abi: AgentNFTAbi,
      address: process.env.AGENT_NFT as `0x${string}` | undefined,
      chain: 'monadTestnet',
      startBlock: deploymentBlock,
    },
  },
})
