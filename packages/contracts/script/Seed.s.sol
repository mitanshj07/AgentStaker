// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {AMMPool} from "../src/AMMPool.sol";
import {FantasyContest} from "../src/FantasyContest.sol";
import {LeagueFactory} from "../src/LeagueFactory.sol";
import {MarketFactory} from "../src/MarketFactory.sol";
import {SharedLiquidityVault} from "../src/SharedLiquidityVault.sol";
import {SocialMarket} from "../src/SocialMarket.sol";

contract Seed is Script {
    function run() external {
        MarketFactory marketFactory = MarketFactory(vm.envAddress("MARKET_FACTORY"));
        AMMPool ammPool = AMMPool(vm.envAddress("AMM_POOL"));
        address oracle = vm.envAddress("ORACLE_SOURCE");
        address vaultAddress = vm.envOr("SHARED_LIQUIDITY_VAULT", address(0));
        address socialAddress = vm.envOr("SOCIAL_MARKET", address(0));
        address leagueAddress = vm.envOr("LEAGUE_FACTORY", address(0));
        address fantasyAddress = vm.envOr("FANTASY_CONTEST", address(0));
        uint256 poolLiquidity = vm.envOr("SEED_POOL_LIQUIDITY", uint256(2 ether));
        uint256 vaultDeposit = vm.envOr("SEED_VAULT_DEPOSIT", uint256(0));
        uint256 socialPrizePool = vm.envOr("SEED_SOCIAL_PRIZE_POOL", uint256(0));

        uint64 lockTime = uint64(block.timestamp + 2 days);
        uint64 resolveTime = uint64(block.timestamp + 3 days);

        vm.startBroadcast();

        uint256 btcMarket = marketFactory.createBinaryMarket(
            "Will BTC/USD close above $100,000 this Friday at 23:59 UTC?",
            "Crypto",
            lockTime,
            resolveTime,
            oracle
        );
        ammPool.createPool{value: poolLiquidity}(btcMarket, 200);

        uint256 cricketMarket = marketFactory.createBinaryMarket(
            "Will India win its next international cricket match before Sunday 23:59 UTC?",
            "Sports",
            lockTime,
            resolveTime,
            oracle
        );
        ammPool.createPool{value: poolLiquidity}(cricketMarket, 200);

        uint256 monadMarket = marketFactory.createBinaryMarket(
            "Will a Monad ecosystem protocol announce a public testnet deployment before Sunday 20:00 UTC?",
            "Monad",
            lockTime,
            resolveTime,
            oracle
        );
        ammPool.createPool{value: poolLiquidity}(monadMarket, 200);

        uint256 aiMarket = marketFactory.createBinaryMarket(
            "Will Forecast Agent Alpha finish with a Brier score below 0.15 in the ArenaX tournament?",
            "AI Arena",
            lockTime,
            resolveTime,
            oracle
        );
        ammPool.createPool{value: poolLiquidity}(aiMarket, 200);

        if (vaultAddress != address(0) && vaultDeposit > 0) {
            SharedLiquidityVault vault = SharedLiquidityVault(payable(vaultAddress));
            vault.deposit{value: vaultDeposit}();
            vault.allocate(btcMarket, vaultDeposit / 2);
            vault.allocate(monadMarket, vaultDeposit / 2);
        }

        if (socialAddress != address(0)) {
            SocialMarket socialMarket = SocialMarket(payable(socialAddress));
            socialMarket.createMarket{value: socialPrizePool}(
                "https://youtube.com/watch?v=monad-arenax-demo",
                "@monadarenax",
                SocialMarket.Platform.YOUTUBE,
                SocialMarket.Metric.VIEWS,
                42_000,
                50_000,
                resolveTime
            );
        }

        uint256 leagueId;
        if (leagueAddress != address(0)) {
            LeagueFactory leagueFactory = LeagueFactory(leagueAddress);
            leagueId = leagueFactory.createLeague("Monad Weekend Cup", "ipfs://arenax/league/monad-weekend-cup", true);
        }
        if (fantasyAddress != address(0)) {
            FantasyContest(fantasyAddress).createContest(
                "Monad Weekend Cup DFS",
                "ipfs://arenax/dfs/monad-weekend-cup",
                leagueId,
                lockTime,
                resolveTime
            );
        }

        vm.stopBroadcast();
    }
}
