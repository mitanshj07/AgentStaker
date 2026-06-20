// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {AIPass} from "../src/AIPass.sol";
import {AMMPool} from "../src/AMMPool.sol";
import {CreatorVault} from "../src/CreatorVault.sol";
import {ExchangeBook} from "../src/ExchangeBook.sol";
import {ForecastArena} from "../src/ForecastArena.sol";
import {LeagueFactory} from "../src/LeagueFactory.sol";
import {MarketFactory} from "../src/MarketFactory.sol";
import {OracleCouncil} from "../src/OracleCouncil.sol";
import {ParlayEngine} from "../src/ParlayEngine.sol";
import {Reputation} from "../src/Reputation.sol";
import {ResponsibleLimits} from "../src/ResponsibleLimits.sol";
import {RiskGovernor} from "../src/RiskGovernor.sol";
import {SharedLiquidityVault} from "../src/SharedLiquidityVault.sol";
import {BetSlipNFT} from "../src/BetSlipNFT.sol";
import {SocialMarket} from "../src/SocialMarket.sol";
import {BattleArena} from "../src/BattleArena.sol";
import {SignalMarketplace} from "../src/SignalMarketplace.sol";
import {FantasyContest} from "../src/FantasyContest.sol";
import {AgentNFT} from "../src/AgentNFT.sol";

contract Deploy is Script {
    function run() external {
        vm.startBroadcast();

        MarketFactory marketFactory = new MarketFactory(address(0));
        ResponsibleLimits responsibleLimits = new ResponsibleLimits();
        AMMPool ammPool = new AMMPool(marketFactory, responsibleLimits);
        ParlayEngine parlayEngine = new ParlayEngine(marketFactory, responsibleLimits, ammPool);
        OracleCouncil oracleCouncil = new OracleCouncil(marketFactory, vm.envOr("COUNCIL_ADDRESS", address(0)));
        ExchangeBook exchangeBook = new ExchangeBook(marketFactory, responsibleLimits, vm.envOr("MATCHER_ADDRESS", address(0)));
        AIPass aiPass = new AIPass();
        CreatorVault creatorVault = new CreatorVault();
        Reputation reputation = new Reputation(address(0));
        LeagueFactory leagueFactory = new LeagueFactory();
        RiskGovernor riskGovernor = new RiskGovernor(responsibleLimits);
        SharedLiquidityVault sharedLiquidityVault = new SharedLiquidityVault(ammPool);
        ForecastArena forecastArena = new ForecastArena(marketFactory, reputation);
        BetSlipNFT betSlipNFT = new BetSlipNFT();
        SocialMarket socialMarket = new SocialMarket(betSlipNFT, responsibleLimits);
        address operatorAddr = vm.envOr("MATCHER_ADDRESS", address(0));
        AgentNFT agentNFT = new AgentNFT();
        BattleArena battleArena = new BattleArena(betSlipNFT, agentNFT, leagueFactory, reputation, creatorVault, responsibleLimits, operatorAddr);
        SignalMarketplace signalMarketplace = new SignalMarketplace(aiPass);
        FantasyContest fantasyContest = new FantasyContest(leagueFactory, reputation);

        responsibleLimits.setAuthorizedSpender(address(ammPool), true);
        responsibleLimits.setAuthorizedSpender(address(parlayEngine), true);
        responsibleLimits.setAuthorizedSpender(address(exchangeBook), true);
        responsibleLimits.setAuthorizedSpender(address(riskGovernor), true);
        responsibleLimits.setAuthorizedSpender(address(socialMarket), true);
        responsibleLimits.setAuthorizedSpender(address(battleArena), true);
        marketFactory.setOperator(address(oracleCouncil));
        reputation.setReporter(address(oracleCouncil), true);
        reputation.setReporter(address(forecastArena), true);
        creatorVault.setAuthorized(address(ammPool), true);
        creatorVault.setAuthorized(address(exchangeBook), true);
        creatorVault.setAuthorized(address(socialMarket), true);
        creatorVault.setAuthorized(address(battleArena), true);
        ammPool.setCreatorVault(creatorVault);
        ammPool.setBetSlipNFT(betSlipNFT);
        parlayEngine.setBetSlipNFT(betSlipNFT);
        exchangeBook.setCreatorVault(creatorVault);
        socialMarket.setCreatorVault(creatorVault);
        aiPass.setConsumer(address(riskGovernor), true);
        aiPass.setConsumer(address(signalMarketplace), true);
        betSlipNFT.grantRole(betSlipNFT.MINTER_ROLE(), address(ammPool));
        betSlipNFT.grantRole(betSlipNFT.MINTER_ROLE(), address(parlayEngine));
        betSlipNFT.grantRole(betSlipNFT.MINTER_ROLE(), address(socialMarket));
        betSlipNFT.grantRole(betSlipNFT.STATUS_ROLE(), address(parlayEngine));
        betSlipNFT.grantRole(betSlipNFT.BATTLE_ROLE(), address(battleArena));
        agentNFT.grantRole(agentNFT.BATTLE_ROLE(), address(battleArena));
        reputation.setReporter(address(battleArena), true);
        reputation.setReporter(address(fantasyContest), true);
        leagueFactory.setScorer(address(battleArena), true);
        leagueFactory.setScorer(address(fantasyContest), true);

        uint256 houseFunding = vm.envOr("PARLAY_HOUSE_FUNDING", uint256(0));
        if (houseFunding > 0) parlayEngine.fundHouse{value: houseFunding}();

        agentNFT.mintAgent(operatorAddr, "Alpha Ensemble", "Momentum", keccak256("alpha"));
        agentNFT.mintAgent(operatorAddr, "Sigma Prophet", "Bayesian", keccak256("sigma"));
        agentNFT.mintAgent(operatorAddr, "Quant Razor", "Technical", keccak256("quant"));
        agentNFT.mintAgent(operatorAddr, "Neural Edge", "Contrarian", keccak256("neural"));

        vm.stopBroadcast();

        // Keep references in bytecode execution so forge broadcasts every deployment.
        require(address(ammPool) != address(0), "AMM");
        require(address(parlayEngine) != address(0), "PARLAY");
        require(address(exchangeBook) != address(0), "EXCHANGE");
        require(address(aiPass) != address(0), "AI_PASS");
        require(address(creatorVault) != address(0), "CREATOR");
        require(address(reputation) != address(0), "REP");
        require(address(leagueFactory) != address(0), "LEAGUE");
        require(address(riskGovernor) != address(0), "RISK");
        require(address(sharedLiquidityVault) != address(0), "LP_VAULT");
        require(address(forecastArena) != address(0), "FORECAST");
        require(address(betSlipNFT) != address(0), "BET_SLIP");
        require(address(socialMarket) != address(0), "SOCIAL");
        require(address(battleArena) != address(0), "BATTLE");
        require(address(signalMarketplace) != address(0), "SIGNALS");
        require(address(fantasyContest) != address(0), "DFS");
        require(address(agentNFT) != address(0), "AGENT_NFT");

        console2.log("MARKET_FACTORY=", address(marketFactory));
        console2.log("AMM_POOL=", address(ammPool));
        console2.log("PARLAY_ENGINE=", address(parlayEngine));
        console2.log("ORACLE_COUNCIL=", address(oracleCouncil));
        console2.log("RESPONSIBLE_LIMITS=", address(responsibleLimits));
        console2.log("EXCHANGE_BOOK=", address(exchangeBook));
        console2.log("AI_PASS=", address(aiPass));
        console2.log("CREATOR_VAULT=", address(creatorVault));
        console2.log("RISK_GOVERNOR=", address(riskGovernor));
        console2.log("SHARED_LIQUIDITY_VAULT=", address(sharedLiquidityVault));
        console2.log("FORECAST_ARENA=", address(forecastArena));
        console2.log("REPUTATION=", address(reputation));
        console2.log("LEAGUE_FACTORY=", address(leagueFactory));
        console2.log("BET_SLIP_NFT=", address(betSlipNFT));
        console2.log("SOCIAL_MARKET=", address(socialMarket));
        console2.log("BATTLE_ARENA=", address(battleArena));
        console2.log("FANTASY_CONTEST=", address(fantasyContest));
        console2.log("SIGNAL_MARKETPLACE=", address(signalMarketplace));
        console2.log("AGENT_NFT=", address(agentNFT));
    }
}
