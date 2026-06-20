// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
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
import {AgentWallet} from "../src/AgentWallet.sol";
import {BattleArena} from "../src/BattleArena.sol";
import {BetSlipNFT} from "../src/BetSlipNFT.sol";
import {FantasyContest} from "../src/FantasyContest.sol";
import {SignalMarketplace} from "../src/SignalMarketplace.sol";
import {SocialMarket} from "../src/SocialMarket.sol";

contract ArenaXTest is Test {
    MarketFactory internal marketFactory;
    ResponsibleLimits internal responsibleLimits;
    AMMPool internal ammPool;
    ParlayEngine internal parlayEngine;
    ExchangeBook internal exchangeBook;
    AIPass internal aiPass;
    CreatorVault internal creatorVault;
    RiskGovernor internal riskGovernor;
    ForecastArena internal forecastArena;
    SharedLiquidityVault internal sharedLiquidityVault;
    LeagueFactory internal leagueFactory;
    OracleCouncil internal oracleCouncil;
    BetSlipNFT internal betSlipNFT;
    SocialMarket internal socialMarket;
    BattleArena internal battleArena;
    SignalMarketplace internal signalMarketplace;
    FantasyContest internal fantasyContest;
    Reputation internal reputation;
    address internal user = address(0xA11CE);
    uint256 internal makerPk = 0xA11CE;
    address internal maker;

    function setUp() public {
        marketFactory = new MarketFactory(address(this));
        responsibleLimits = new ResponsibleLimits();
        ammPool = new AMMPool(marketFactory, responsibleLimits);
        parlayEngine = new ParlayEngine(marketFactory, responsibleLimits, ammPool);
        oracleCouncil = new OracleCouncil(marketFactory, address(this));
        exchangeBook = new ExchangeBook(marketFactory, responsibleLimits, address(this));
        aiPass = new AIPass();
        creatorVault = new CreatorVault();
        riskGovernor = new RiskGovernor(responsibleLimits);
        leagueFactory = new LeagueFactory();
        reputation = new Reputation(address(this));
        forecastArena = new ForecastArena(marketFactory, reputation);
        sharedLiquidityVault = new SharedLiquidityVault(ammPool);
        betSlipNFT = new BetSlipNFT();
        socialMarket = new SocialMarket(betSlipNFT, responsibleLimits);
        battleArena = new BattleArena(betSlipNFT, leagueFactory, reputation, creatorVault, responsibleLimits, address(this));
        signalMarketplace = new SignalMarketplace(aiPass);
        fantasyContest = new FantasyContest(leagueFactory, reputation);
        
        marketFactory.setOperator(address(oracleCouncil));

        responsibleLimits.setAuthorizedSpender(address(ammPool), true);
        responsibleLimits.setAuthorizedSpender(address(parlayEngine), true);
        responsibleLimits.setAuthorizedSpender(address(exchangeBook), true);
        responsibleLimits.setAuthorizedSpender(address(riskGovernor), true);
        responsibleLimits.setAuthorizedSpender(address(socialMarket), true);
        betSlipNFT.grantRole(betSlipNFT.MINTER_ROLE(), address(socialMarket));
        betSlipNFT.grantRole(betSlipNFT.BATTLE_ROLE(), address(battleArena));
        reputation.setReporter(address(battleArena), true);
        reputation.setReporter(address(fantasyContest), true);
        leagueFactory.setScorer(address(battleArena), true);
        leagueFactory.setScorer(address(fantasyContest), true);
        aiPass.setConsumer(address(signalMarketplace), true);
        maker = vm.addr(makerPk);
        vm.deal(user, 100 ether);
        vm.deal(maker, 100 ether);
        vm.deal(address(this), 100 ether);
    }

    receive() external payable {}

    // Original tests updated:
    function testBuyMovesOddsAndRecordsLimitSpend() public {
        uint256 marketId = _createMarket("Will BTC close above 100k on Friday at 23:59 UTC?");
        ammPool.createPool{value: 10 ether}(marketId, 200);

        vm.prank(user);
        responsibleLimits.setDailyLimit(2 ether);

        vm.prank(user);
        ammPool.buy{value: 1 ether}(marketId, 0, 0);

        (, uint256 spentToday,,,,,,,,,,,) = responsibleLimits.limits(user);
        assertEq(spentToday, 1 ether);
        assertGt(ammPool.getOutcomeOdds(marketId, 0), 0.5 ether);
    }

    function testDailyLimitBlocksTrade() public {
        uint256 marketId = _createMarket("Will India win the next listed demo match before Sunday UTC?");
        ammPool.createPool{value: 10 ether}(marketId, 200);

        vm.prank(user);
        responsibleLimits.setDailyLimit(0.5 ether);

        vm.expectRevert(AMMPool.LimitBlocked.selector);
        vm.prank(user);
        ammPool.buy{value: 1 ether}(marketId, 0, 0);
    }

    function testParlayRejectsDuplicateMarket() public {
        uint256 marketId = _createMarket("Will Monad publish a public ecosystem announcement before Sunday UTC?");
        ParlayEngine.ParlayLeg[] memory legs = new ParlayEngine.ParlayLeg[](2);
        legs[0] = ParlayEngine.ParlayLeg({marketId: marketId, outcomeIndex: 0, oddsAtTime: 2 ether});
        legs[1] = ParlayEngine.ParlayLeg({marketId: marketId, outcomeIndex: 1, oddsAtTime: 2 ether});

        vm.expectRevert(ParlayEngine.DuplicateMarket.selector);
        vm.prank(user);
        parlayEngine.createParlay{value: 1 ether}(legs, 10 ether);
    }

    function testLeagueJoinAndScore() public {
        uint256 leagueId = leagueFactory.createLeague("Monad Weekend Cup", "ipfs://demo", true);

        vm.prank(user);
        leagueFactory.joinLeague(leagueId);

        leagueFactory.recordScore(leagueId, user, 100);
        assertEq(leagueFactory.points(leagueId, user), 100);
    }

    function testExchangeBookFillsSignedOrderAndBlocksReplayOverfill() public {
        uint256 marketId = _createMarket("Will signed orders settle on Monad testnet before Sunday UTC?");
        ExchangeBook.Order memory order = ExchangeBook.Order({
            maker: maker,
            marketId: marketId,
            outcomeIndex: 0,
            side: ExchangeBook.Side.BACK,
            tif: ExchangeBook.TimeInForce.GTC,
            price1e18: 0.55 ether,
            size: 2 ether,
            nonce: 7,
            expiry: uint64(block.timestamp + 1 days),
            reduceOnly: false
        });
        bytes memory signature = _signOrder(order);

        vm.prank(maker);
        exchangeBook.deposit{value: 2 ether}();

        exchangeBook.fillOrder{value: 1 ether}(order, 1 ether, user, signature);
        assertEq(exchangeBook.filledSize(exchangeBook.hashOrder(order)), 1 ether);

        vm.expectRevert(ExchangeBook.Overfill.selector);
        exchangeBook.fillOrder{value: 2 ether}(order, 2 ether, user, signature);
    }

    function testExchangeBookCancelBlocksFill() public {
        uint256 marketId = _createMarket("Will canceled orders fail before the next Monad block?");
        ExchangeBook.Order memory order = ExchangeBook.Order({
            maker: maker,
            marketId: marketId,
            outcomeIndex: 1,
            side: ExchangeBook.Side.LAY,
            tif: ExchangeBook.TimeInForce.POST_ONLY,
            price1e18: 0.45 ether,
            size: 1 ether,
            nonce: 9,
            expiry: uint64(block.timestamp + 1 days),
            reduceOnly: false
        });
        bytes memory signature = _signOrder(order);

        vm.prank(maker);
        exchangeBook.deposit{value: 1 ether}();

        vm.prank(maker);
        exchangeBook.cancelOrder(order.nonce);

        vm.expectRevert(ExchangeBook.OrderCanceled.selector);
        exchangeBook.fillOrder{value: 1 ether}(order, 1 ether, user, signature);
    }

    function testAIPassMintsCreditsAndCreatorVaultSplitsFees() public {
        vm.prank(user);
        aiPass.mintPass{value: 1 ether}(uint256(AIPass.Tier.PRO));
        assertEq(aiPass.aiCredits(user), 750);
        assertEq(aiPass.balanceOf(user, uint256(AIPass.Tier.PRO)), 1);

        address referrer = address(0xBEEF);
        creatorVault.recordFee{value: 1 ether}(user, referrer);
        assertEq(creatorVault.creatorBalance(user), 0.7 ether);
        assertEq(creatorVault.referralBalance(user, referrer), 0.15 ether);
        assertEq(creatorVault.protocolFees(), 0.15 ether);
    }

    function testResponsibleLimitsBlocksOpenOrdersByCount() public {
        uint256 marketId = _createMarket("Will open order caps protect users before Sunday UTC?");
        ExchangeBook.Order memory order = ExchangeBook.Order({
            maker: maker,
            marketId: marketId,
            outcomeIndex: 0,
            side: ExchangeBook.Side.BACK,
            tif: ExchangeBook.TimeInForce.GTC,
            price1e18: 0.51 ether,
            size: 1 ether,
            nonce: 11,
            expiry: uint64(block.timestamp + 1 days),
            reduceOnly: false
        });
        bytes memory signature = _signOrder(order);

        vm.prank(maker);
        exchangeBook.deposit{value: 2 ether}();

        vm.prank(maker);
        responsibleLimits.setOpenOrderLimit(0);
        
        exchangeBook.fillOrder{value: 0.5 ether}(order, 0.5 ether, user, signature);

        vm.prank(maker);
        responsibleLimits.setOpenOrderLimit(1);
        ExchangeBook.Order memory nextOrder = order;
        nextOrder.nonce = 12;
        bytes memory nextSignature = _signOrder(nextOrder);

        vm.expectRevert(bytes("OPEN_ORDER_LIMIT"));
        exchangeBook.fillOrder{value: 0.5 ether}(nextOrder, 0.5 ether, user, nextSignature);
    }

    function testRiskGovernorProposalRequiresUserApprovalBeforeExecution() public {
        uint256 proposalId = riskGovernor.propose(
            user,
            RiskGovernor.ProposalKind.HEDGE,
            101,
            1 ether,
            1200,
            2400,
            keccak256("simulation"),
            "ipfs://risk-report"
        );

        vm.expectRevert("NOT_APPROVED");
        riskGovernor.markExecuted(proposalId);

        vm.prank(user);
        riskGovernor.approve(proposalId);
        riskGovernor.markExecuted(proposalId);

        (,,,,,,,,,, bool executed,) = _proposalTuple(proposalId);
        assertTrue(executed);
    }

    function testRiskGovernorBlocksUnsafeProposalAndAiCap() public {
        vm.prank(user);
        responsibleLimits.setAiExecutionCap(0.5 ether);

        vm.expectRevert("AI_EXECUTION_CAP");
        riskGovernor.propose(
            user,
            RiskGovernor.ProposalKind.PLACE_ORDER,
            101,
            1 ether,
            1200,
            2400,
            keccak256("cap"),
            "ipfs://risk-report"
        );

        vm.expectRevert("DRAWDOWN_LIMIT");
        riskGovernor.propose(
            user,
            RiskGovernor.ProposalKind.REMOVE_LIQUIDITY,
            101,
            0.1 ether,
            2600,
            2400,
            keccak256("drawdown"),
            "ipfs://risk-report"
        );
    }

    // New tests:
    function testAMMPoolSellAndRedeem() public {
        uint256 marketId = _createMarket("Test AMM Sell and Redeem");
        ammPool.createPool{value: 10 ether}(marketId, 200);

        // Buy YES
        vm.prank(user);
        uint256 sharesBought = ammPool.buy{value: 1 ether}(marketId, 0, 0);
        assertGt(sharesBought, 0);

        // Sell some YES
        vm.prank(user);
        uint256 ethReturned = ammPool.sell(marketId, 0, sharesBought / 2, 0);
        assertGt(ethReturned, 0);

        // Resolve market
        oracleCouncil.commitResult{value: 0.1 ether}(marketId, keccak256(abi.encode(marketId, 0, bytes32(0))));
        oracleCouncil.revealResult(marketId, 0, bytes32(0));
        
        vm.warp(block.timestamp + 1 days);
        oracleCouncil.finalizeResult(marketId);

        // Redeem
        uint256 userBalBefore = user.balance;
        vm.prank(user);
        ammPool.redeem(marketId);
        assertGt(user.balance, userBalBefore);
    }

    function testOracleCouncilChallengeAndResolve() public {
        uint256 marketId = _createMarket("Test Oracle Challenge");
        
        oracleCouncil.commitResult{value: 1 ether}(marketId, keccak256(abi.encode(marketId, 0, bytes32(0))));
        oracleCouncil.revealResult(marketId, 0, bytes32(0));

        // Challenge with outcome 1
        address challenger = address(0x1234);
        vm.deal(challenger, 2 ether);
        vm.prank(challenger);
        oracleCouncil.challengeResult{value: 1 ether}(marketId, 1);

        // Resolve in favor of challenger
        uint256 balBefore = challenger.balance;
        oracleCouncil.resolveChallenge(marketId, 1);
        
        // Challenger should get 2 ether (their bond + submitter bond)
        assertEq(challenger.balance, balBefore + 2 ether);
    }

    function testParlayEngineHouseFundingAndInsolvency() public {
        uint256 marketId1 = _createMarket("Test Parlay 1");
        uint256 marketId2 = _createMarket("Test Parlay 2");

        ammPool.createPool{value: 10 ether}(marketId1, 200);
        ammPool.createPool{value: 10 ether}(marketId2, 200);
        
        ParlayEngine.ParlayLeg[] memory legs = new ParlayEngine.ParlayLeg[](2);
        legs[0] = ParlayEngine.ParlayLeg({marketId: marketId1, outcomeIndex: 0, oddsAtTime: 2 ether});
        legs[1] = ParlayEngine.ParlayLeg({marketId: marketId2, outcomeIndex: 0, oddsAtTime: 2 ether});

        vm.expectRevert(ParlayEngine.InsufficientHouseBalance.selector);
        vm.prank(user);
        parlayEngine.createParlay{value: 1 ether}(legs, 5 ether);

        parlayEngine.fundHouse{value: 5 ether}();
        vm.prank(user);
        uint256 parlayId = parlayEngine.createParlay{value: 1 ether}(legs, 5 ether);

        // Resolve both markets
        oracleCouncil.commitResult{value: 0.1 ether}(marketId1, keccak256(abi.encode(marketId1, 0, bytes32(0))));
        oracleCouncil.revealResult(marketId1, 0, bytes32(0));
        oracleCouncil.commitResult{value: 0.1 ether}(marketId2, keccak256(abi.encode(marketId2, 0, bytes32(0))));
        oracleCouncil.revealResult(marketId2, 0, bytes32(0));

        vm.warp(block.timestamp + 1 days);
        oracleCouncil.finalizeResult(marketId1);
        oracleCouncil.finalizeResult(marketId2);

        parlayEngine.settleParlay(parlayId);

        uint256 balBefore = user.balance;
        vm.prank(user);
        parlayEngine.claim(parlayId);
        assertEq(user.balance, balBefore + 4 ether);
    }

    function testParlayNftTransfersAndCashoutUsesLiveAmmOdds() public {
        uint256 marketId1 = _createMarket("Cashout market one");
        uint256 marketId2 = _createMarket("Cashout market two");
        ammPool.createPool{value: 10 ether}(marketId1, 200);
        ammPool.createPool{value: 10 ether}(marketId2, 200);
        parlayEngine.fundHouse{value: 10 ether}();

        ParlayEngine.ParlayLeg[] memory legs = new ParlayEngine.ParlayLeg[](2);
        legs[0] = ParlayEngine.ParlayLeg({marketId: marketId1, outcomeIndex: 0, oddsAtTime: 2 ether});
        legs[1] = ParlayEngine.ParlayLeg({marketId: marketId2, outcomeIndex: 0, oddsAtTime: 2 ether});

        vm.prank(user);
        uint256 parlayId = parlayEngine.createParlay{value: 1 ether}(legs, 5 ether);
        assertEq(parlayEngine.ownerOf(parlayId), user);
        assertEq(parlayEngine.reservedLiability(), 4 ether);

        address buyer = address(0xB0B);
        vm.prank(user);
        parlayEngine.transferFrom(user, buyer, parlayId);
        assertEq(parlayEngine.ownerOf(parlayId), buyer);

        uint256 quote = parlayEngine.quoteCashout(parlayId);
        assertGt(quote, 0);
        vm.deal(buyer, 1 ether);
        vm.prank(buyer);
        parlayEngine.cashoutParlay(parlayId, quote);
        assertEq(parlayEngine.reservedLiability(), 0);
    }

    function testParlayVoidedLegIsRemovedFromCashoutAndSettlementMath() public {
        uint256 marketId1 = _createMarket("Voided parlay leg one");
        uint256 marketId2 = _createMarket("Resolved parlay leg two");
        ammPool.createPool{value: 10 ether}(marketId1, 200);
        ammPool.createPool{value: 10 ether}(marketId2, 200);
        parlayEngine.fundHouse{value: 10 ether}();

        ParlayEngine.ParlayLeg[] memory legs = new ParlayEngine.ParlayLeg[](2);
        legs[0] = ParlayEngine.ParlayLeg({marketId: marketId1, outcomeIndex: 0, oddsAtTime: 99 ether});
        legs[1] = ParlayEngine.ParlayLeg({marketId: marketId2, outcomeIndex: 0, oddsAtTime: 99 ether});

        vm.prank(user);
        uint256 parlayId = parlayEngine.createParlay{value: 1 ether}(legs, 5 ether);

        vm.prank(address(oracleCouncil));
        marketFactory.voidMarket(marketId1, "Source unavailable");
        assertEq(parlayEngine.quoteCashout(parlayId), 0.94 ether);

        oracleCouncil.commitResult{value: 0.1 ether}(marketId2, keccak256(abi.encode(marketId2, 0, bytes32(0))));
        oracleCouncil.revealResult(marketId2, 0, bytes32(0));
        vm.warp(block.timestamp + 1 days);
        oracleCouncil.finalizeResult(marketId2);
        parlayEngine.settleParlay(parlayId);

        ParlayEngine.Parlay memory parlay = parlayEngine.getParlay(parlayId);
        assertEq(uint256(parlay.status), uint256(ParlayEngine.ParlayStatus.PARTIALLY_VOIDED));
        assertEq(parlay.payout, 2 ether);
        assertEq(parlayEngine.reservedLiability(), 2 ether);
    }

    function testSharedVaultQueuesWithdrawalAndRebalances() public {
        uint256 marketId1 = _createMarket("Vault market one");
        uint256 marketId2 = _createMarket("Vault market two");
        ammPool.createPool{value: 10 ether}(marketId1, 200);
        ammPool.createPool{value: 10 ether}(marketId2, 200);

        vm.prank(user);
        sharedLiquidityVault.deposit{value: 4 ether}();
        sharedLiquidityVault.allocate(marketId1, 3 ether);
        assertEq(sharedLiquidityVault.deployedByMarket(marketId1), 3 ether);

        sharedLiquidityVault.rebalance(marketId1, marketId2, 1 ether, 0.9 ether);
        assertEq(sharedLiquidityVault.deployedByMarket(marketId2), 1 ether);

        vm.prank(user);
        sharedLiquidityVault.requestWithdraw(4 ether, 3 ether);
        assertGt(sharedLiquidityVault.pendingWithdrawal(user), 0);
    }

    function testSharedVaultPaysWithdrawalImmediatelyFromIdleLiquidity() public {
        vm.startPrank(user);
        sharedLiquidityVault.deposit{value: 4 ether}();
        uint256 balanceBefore = user.balance;
        sharedLiquidityVault.requestWithdraw(1 ether, 0.9 ether);
        vm.stopPrank();

        assertEq(sharedLiquidityVault.balanceOf(user), 3 ether);
        assertEq(sharedLiquidityVault.pendingWithdrawal(user), 0);
        assertEq(sharedLiquidityVault.idleBalance(), 3 ether);
        assertEq(user.balance, balanceBefore + 1 ether);
    }

    function testForecastArenaCommitRevealAndScore() public {
        Reputation forecastReputation = Reputation(address(forecastArena.REPUTATION()));
        forecastReputation.setReporter(address(forecastArena), true);
        uint256 marketId = _createMarket("Forecast arena market");
        bytes32 salt = keccak256("forecast-salt");
        bytes32 commitment = keccak256(abi.encode(user, marketId, 0.7 ether, salt));

        vm.startPrank(user);
        forecastArena.registerAgent("Alpha Forecaster", "ipfs://alpha");
        forecastArena.commitForecast(marketId, commitment, uint64(block.timestamp + 1 days));
        forecastArena.revealForecast(marketId, 0.7 ether, salt);
        vm.stopPrank();

        oracleCouncil.commitResult{value: 0.1 ether}(marketId, keccak256(abi.encode(marketId, 0, bytes32(0))));
        oracleCouncil.revealResult(marketId, 0, bytes32(0));
        vm.warp(block.timestamp + 1 days);
        oracleCouncil.finalizeResult(marketId);
        forecastArena.scoreForecast(user, marketId);

        (,,, uint256 forecasts,) = forecastReputation.profiles(user);
        assertEq(forecasts, 1);
    }

    function testAMMPoolForwardsCreatorFees() public {
        uint256 marketId = _createMarket("Creator fee market");
        ammPool.createPool{value: 10 ether}(marketId, 200);
        creatorVault.setAuthorized(address(ammPool), true);
        ammPool.setCreatorVault(creatorVault);

        vm.prank(user);
        ammPool.buyWithReferrer{value: 1 ether}(marketId, 0, 0, address(0xBEEF));
        assertGt(creatorVault.creatorBalance(address(this)), 0);
    }

    function testAIPassOverpaymentRefund() public {
        uint256 balBefore = user.balance;
        vm.prank(user);
        // PRO tier costs 1 ether, sending 5 ether
        aiPass.mintPass{value: 5 ether}(uint256(AIPass.Tier.PRO));
        
        // Should only be charged 1 ether
        assertEq(user.balance, balBefore - 1 ether);
    }

    function testCreatorVaultAccessControl() public {
        vm.prank(user);
        vm.expectRevert(CreatorVault.NotAuthorized.selector);
        creatorVault.recordFee{value: 1 ether}(user, address(0));

        // Owner is authorized, so it works
        creatorVault.recordFee{value: 1 ether}(user, address(0));
    }

    function testAmmMintsCompanionBetSlip() public {
        uint256 marketId = _createMarket("Will the ArenaX slip locker mint a gameplay card?");
        ammPool.createPool{value: 10 ether}(marketId, 200);
        betSlipNFT.grantRole(betSlipNFT.MINTER_ROLE(), address(ammPool));
        ammPool.setBetSlipNFT(betSlipNFT);

        vm.prank(user);
        ammPool.buy{value: 1 ether}(marketId, 0, 0);

        assertEq(betSlipNFT.balanceOf(user), 1);
        BetSlipNFT.SlipData memory slip = betSlipNFT.getSlip(1);
        assertEq(slip.originContract, address(ammPool));
        assertEq(slip.marketIds[0], marketId);
        BetSlipNFT.CardStats memory stats = betSlipNFT.cardStats(1);
        assertGt(stats.power, 40);
        assertGt(stats.defense, 30);
        assertGt(stats.speed, 50);
        assertLt(stats.luck, 1_000);
        assertGt(bytes(betSlipNFT.tokenURI(1)).length, 1_000);
    }

    function testSocialMarketUsesEvidenceWindowAndMintsSlip() public {
        vm.prank(user);
        uint256 marketId = socialMarket.createMarket(
            "https://youtube.com/watch?v=arenax",
            "@arenax",
            SocialMarket.Platform.YOUTUBE,
            SocialMarket.Metric.VIEWS,
            42_000,
            50_000,
            uint64(block.timestamp + 1 hours)
        );

        vm.prank(user);
        socialMarket.bet{value: 1 ether}(marketId, true);
        assertEq(betSlipNFT.balanceOf(user), 1);

        vm.warp(block.timestamp + 1 hours + 1);
        socialMarket.proposeResolution(marketId, 51_000, "ipfs://evidence-proposed");
        vm.warp(block.timestamp + 31 minutes);
        socialMarket.finalize(marketId, 51_200, "ipfs://evidence-final");
        SocialMarket.Market memory market = socialMarket.getMarket(marketId);
        assertEq(uint256(market.state), uint256(SocialMarket.State.RESOLVED));
        assertTrue(market.hitTarget);
    }

    function testSocialVoidReturnsBetsAndCreatorPrizePool() public {
        uint256 creatorBalanceBefore = address(this).balance;
        uint256 marketId = socialMarket.createMarket{value: 2 ether}(
            "https://youtube.com/watch?v=refund",
            "@arenax",
            SocialMarket.Platform.YOUTUBE,
            SocialMarket.Metric.VIEWS,
            10,
            20,
            uint64(block.timestamp + 1 hours)
        );
        vm.prank(user);
        socialMarket.bet{value: 1 ether}(marketId, true);
        socialMarket.voidMarket(marketId);

        uint256 userBalanceBefore = user.balance;
        vm.prank(user);
        assertEq(socialMarket.refund(marketId), 1 ether);
        assertEq(user.balance, userBalanceBefore + 1 ether);
        assertEq(socialMarket.refundVoidedPrizePool(marketId), 2 ether);
        assertEq(address(this).balance, creatorBalanceBefore);
    }

    function testSocialResolutionWithNoWinningStakeBecomesRefundableVoid() public {
        vm.prank(user);
        uint256 marketId = socialMarket.createMarket(
            "https://youtube.com/watch?v=empty-winner",
            "@arenax",
            SocialMarket.Platform.YOUTUBE,
            SocialMarket.Metric.VIEWS,
            10,
            20,
            uint64(block.timestamp + 1 hours)
        );
        vm.prank(user);
        socialMarket.bet{value: 1 ether}(marketId, true);

        vm.warp(block.timestamp + 1 hours + 1);
        socialMarket.proposeResolution(marketId, 10, "ipfs://evidence-proposed");
        vm.warp(block.timestamp + 31 minutes);
        socialMarket.finalize(marketId, 10, "ipfs://evidence-final");

        SocialMarket.Market memory market = socialMarket.getMarket(marketId);
        assertEq(uint256(market.state), uint256(SocialMarket.State.VOIDED));
        vm.prank(user);
        assertEq(socialMarket.refund(marketId), 1 ether);
    }

    function testSignalUnlockConsumesAiPassCredits() public {
        vm.prank(user);
        aiPass.mintPass(uint256(AIPass.Tier.FREE));
        uint256 signalId = signalMarketplace.registerSignal(keccak256("bundle"), "ipfs://signal", 5, uint256(AIPass.Tier.FREE), uint64(block.timestamp));

        vm.prank(user);
        signalMarketplace.unlock(signalId);
        assertEq(aiPass.aiCredits(user), 20);
        assertTrue(signalMarketplace.unlocked(signalId, user));
    }

    function testFantasyContestScoresPointsOnlyLeague() public {
        uint256 leagueId = leagueFactory.createLeague("Synthetic DFS Cup", "ipfs://dfs", true);
        vm.prank(user);
        leagueFactory.joinLeague(leagueId);
        uint256 contestId = fantasyContest.createContest("Monad Weekend DFS", "ipfs://contest", leagueId, uint64(block.timestamp + 1 hours), uint64(block.timestamp + 2 hours));

        vm.prank(user);
        fantasyContest.submitLineup(contestId, keccak256("lineup"));
        vm.warp(block.timestamp + 1 hours);
        fantasyContest.scoreLineup(contestId, user, 182);
        vm.warp(block.timestamp + 2 hours + 1);
        fantasyContest.finalize(contestId);

        assertEq(leagueFactory.points(leagueId, user), 150);
        assertTrue(reputation.badges(user, fantasyContest.DFS_WINNER_BADGE()));
    }

    function testFantasyContestRejectsScoringAfterFinalization() public {
        uint256 leagueId = leagueFactory.createLeague("Finalized DFS Cup", "ipfs://dfs-final", true);
        vm.prank(user);
        leagueFactory.joinLeague(leagueId);
        vm.prank(maker);
        leagueFactory.joinLeague(leagueId);
        uint256 contestId = fantasyContest.createContest(
            "Monad Final DFS",
            "ipfs://contest-final",
            leagueId,
            uint64(block.timestamp + 1 hours),
            uint64(block.timestamp + 2 hours)
        );

        vm.prank(user);
        fantasyContest.submitLineup(contestId, keccak256("winning-lineup"));
        vm.prank(maker);
        fantasyContest.submitLineup(contestId, keccak256("late-lineup"));
        vm.warp(block.timestamp + 1 hours);
        fantasyContest.scoreLineup(contestId, user, 182);
        vm.warp(block.timestamp + 2 hours + 1);
        fantasyContest.finalize(contestId);

        vm.expectRevert("NOT_SCORABLE");
        fantasyContest.scoreLineup(contestId, maker, 999);
    }

    function testBattleArenaLocksWinningCardsAndAwardsBadge() public {
        uint256[] memory ids = new uint256[](1);
        bool[] memory sides = new bool[](1);
        ids[0] = 101;
        sides[0] = true;
        uint256 userCard = betSlipNFT.mintSlip(user, address(this), 1, ids, sides, 1 ether, 2 ether, 1, 2, keccak256("user-card"));
        uint256 makerCard = betSlipNFT.mintSlip(maker, address(this), 2, ids, sides, 1 ether, 2 ether, 1, 1, keccak256("maker-card"));
        betSlipNFT.updateStatus(userCard, BetSlipNFT.SlipStatus.WON);
        betSlipNFT.updateStatus(makerCard, BetSlipNFT.SlipStatus.WON);

        BattleArena.Move[3] memory userMoves = [BattleArena.Move.ATTACK, BattleArena.Move.DEFEND, BattleArena.Move.TRICK];
        BattleArena.Move[3] memory makerMoves = [BattleArena.Move.TRICK, BattleArena.Move.ATTACK, BattleArena.Move.DEFEND];
        bytes32 userSalt = keccak256("user-salt");
        bytes32 makerSalt = keccak256("maker-salt");
        vm.startPrank(user);
        betSlipNFT.approve(address(battleArena), userCard);
        uint256 battleId = battleArena.createBattle(userCard, 0, keccak256(abi.encode(user, userMoves, userSalt)));
        vm.stopPrank();
        vm.startPrank(maker);
        betSlipNFT.approve(address(battleArena), makerCard);
        battleArena.joinBattle(battleId, makerCard, keccak256(abi.encode(maker, makerMoves, makerSalt)));
        vm.stopPrank();
        vm.prank(user);
        battleArena.reveal(battleId, userMoves, userSalt);
        vm.prank(maker);
        battleArena.reveal(battleId, makerMoves, makerSalt);

        (,,,,,,,,,, BattleArena.State state, address winner) = battleArena.battles(battleId);
        assertEq(uint256(state), uint256(BattleArena.State.RESOLVED));
        assertTrue(reputation.badges(winner, battleArena.BATTLE_WINNER_BADGE()));
    }

    function testBattleArenaReturnsCardsAfterExpiredRevealWindow() public {
        uint256[] memory ids = new uint256[](1);
        bool[] memory sides = new bool[](1);
        ids[0] = 101;
        sides[0] = true;
        uint256 userCard = betSlipNFT.mintSlip(user, address(this), 11, ids, sides, 1 ether, 2 ether, 1, 2, keccak256("timeout-user"));
        uint256 makerCard = betSlipNFT.mintSlip(maker, address(this), 12, ids, sides, 1 ether, 2 ether, 1, 1, keccak256("timeout-maker"));
        betSlipNFT.updateStatus(userCard, BetSlipNFT.SlipStatus.WON);
        betSlipNFT.updateStatus(makerCard, BetSlipNFT.SlipStatus.WON);

        vm.startPrank(user);
        betSlipNFT.approve(address(battleArena), userCard);
        uint256 battleId = battleArena.createBattle(userCard, 0, keccak256("user-timeout-commit"));
        vm.stopPrank();
        vm.startPrank(maker);
        betSlipNFT.approve(address(battleArena), makerCard);
        battleArena.joinBattle(battleId, makerCard, keccak256("maker-timeout-commit"));
        vm.stopPrank();

        vm.warp(block.timestamp + battleArena.revealWindow() + 1);
        battleArena.resolveExpiredJoined(battleId);
        assertEq(betSlipNFT.ownerOf(userCard), user);
        assertEq(betSlipNFT.ownerOf(makerCard), maker);
    }

    function testAgentWalletAuthorizesCappedErc1271Fill() public {
        uint256 sessionPk = 0xB0B;
        address sessionKey = vm.addr(sessionPk);
        AgentWallet agentWallet = new AgentWallet(address(this), address(exchangeBook));
        agentWallet.authorizeSession(sessionKey, uint64(block.timestamp + 1 days), 1 ether);
        agentWallet.fundExchange{value: 2 ether}();
        uint256 marketId = _createMarket("Will capped ERC1271 CLOB sessions settle safely?");
        ExchangeBook.Order memory order = ExchangeBook.Order({
            maker: address(agentWallet),
            marketId: marketId,
            outcomeIndex: 0,
            side: ExchangeBook.Side.BACK,
            tif: ExchangeBook.TimeInForce.GTC,
            price1e18: 0.5 ether,
            size: 1 ether,
            nonce: 33,
            expiry: uint64(block.timestamp + 1 days),
            reduceOnly: false
        });
        bytes memory signature = _signOrderWithPk(order, sessionPk);
        exchangeBook.fillOrder{value: 0.5 ether}(order, 0.5 ether, user, signature);
        (,,, uint256 spentToday,) = agentWallet.sessions(sessionKey);
        assertEq(spentToday, 0.5 ether);
    }

    function testAgentWalletReturnsInvalidMagicValueForMalformedSignature() public {
        AgentWallet agentWallet = new AgentWallet(address(this), address(exchangeBook));
        assertEq(agentWallet.isValidSignature(keccak256("order"), hex"1234"), bytes4(0));
    }

    function _createMarket(string memory question) internal returns (uint256) {
        return marketFactory.createBinaryMarket(
            question,
            "Demo",
            uint64(block.timestamp + 1 days),
            uint64(block.timestamp + 2 days),
            address(this)
        );
    }

    function _signOrder(ExchangeBook.Order memory order) internal view returns (bytes memory) {
        bytes32 digest = exchangeBook.hashOrder(order);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(makerPk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _signOrderWithPk(ExchangeBook.Order memory order, uint256 privateKey) internal view returns (bytes memory) {
        bytes32 digest = exchangeBook.hashOrder(order);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function _proposalTuple(uint256 proposalId)
        internal
        view
        returns (
            address agent,
            address proposalUser,
            RiskGovernor.ProposalKind kind,
            uint256 marketId,
            uint256 value,
            uint256 riskScoreBps,
            uint256 correlationBps,
            bytes32 simulationHash,
            string memory rationaleURI,
            bool approved,
            bool executed,
            uint64 createdAt
        )
    {
        return riskGovernor.proposals(proposalId);
    }
}
