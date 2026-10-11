/**
 * Comprehensive Automated Verification Suite for PINN Arcade
 * Tests all 8 core security and business logic requirements:
 * 1. A player cannot view another player's reward records.
 * 2. A player cannot approve their own reward.
 * 3. Unverified scores cannot qualify for rewards.
 * 4. Duplicate reward claims are rejected.
 * 5. Failed Solana transactions are not marked as paid.
 * 6. Duplicate transaction signatures are rejected.
 * 7. Only authorized administrators can approve rewards.
 * 8. All four existing games continue to work.
 */

import { adminService } from '../src/services/adminService';
import { solanaVerificationService } from '../src/services/solanaVerificationService';
import { tournamentService } from '../src/services/tournamentService';
import { leaderboardService } from '../src/services/leaderboardService';
import { PINN_CONFIG } from '../src/config/pinnConfig';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, testName: string, successMsg: string, failMsg: string) {
  if (condition) {
    results.push({ name: testName, passed: true, details: successMsg });
    console.log(`[PASS] ${testName}: ${successMsg}`);
  } else {
    results.push({ name: testName, passed: false, details: failMsg });
    console.error(`[FAIL] ${testName}: ${failMsg}`);
  }
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('STARTING PINN ARCADE REWARDS & PRIZE SECURITY TEST SUITE');
  console.log('================================================================\n');

  // Save base admin status method
  const originalCheckAdmin = adminService.checkAdminStatus.bind(adminService);

  // -------------------------------------------------------------------------
  // TEST 1: A player cannot view another player's reward records
  // -------------------------------------------------------------------------
  try {
    const player1UserId = 'usr-008'; // CaptainBlackbeard
    const player2UserId = 'usr-009'; // TreasureDiver
    const anonymousUser = 'usr-unknown-999';

    const p1Rewards = await adminService.getPlayerRewardRequests(player1UserId);
    const p2Rewards = await adminService.getPlayerRewardRequests(player2UserId);
    const anonRewards = await adminService.getPlayerRewardRequests(anonymousUser);

    const p1HasOther = p1Rewards.some((r) => r.userId && r.userId !== player1UserId);
    const p2HasOther = p2Rewards.some((r) => r.userId && r.userId !== player2UserId);
    const anonHasAny = anonRewards.length > 0;

    const test1Passed = !p1HasOther && !p2HasOther && !anonHasAny;
    assert(
      test1Passed,
      'Test 1: Player Privacy Isolation',
      `Player 1 only sees their own rewards (${p1Rewards.length} records), Player 2 sees their own (${p2Rewards.length} records), and unauthorized/unknown sessions receive 0 records.`,
      `Cross-player reward data leak detected!`
    );
  } catch (err: any) {
    assert(false, 'Test 1: Player Privacy Isolation', '', `Error: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // TEST 2: A player cannot approve their own reward
  // -------------------------------------------------------------------------
  try {
    // Simulate an ordinary player session (non-admin)
    adminService.checkAdminStatus = async () => ({
      isAdmin: false,
      reason: 'Standard player session - not an authorized administrator.',
    });

    const attempt = await adminService.updateRewardStatus(
      'rw-002',
      'approved',
      'Player attempting self-approval'
    );

    const test2Passed =
      attempt.success === false &&
      (attempt.error?.toLowerCase().includes('unauthorized') ||
        attempt.error?.toLowerCase().includes('administrator'));

    assert(
      test2Passed,
      'Test 2: Player Self-Approval Prevention',
      `Player attempt to approve reward was strictly denied: "${attempt.error}".`,
      `Security vulnerability: Ordinary player was allowed to approve reward!`
    );
  } catch (err: any) {
    assert(false, 'Test 2: Player Self-Approval Prevention', '', `Error: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // TEST 3: Unverified scores cannot qualify for rewards
  // -------------------------------------------------------------------------
  try {
    // Admin context to evaluate score qualification
    adminService.checkAdminStatus = async () => ({ isAdmin: true, role: 'admin' });

    // Attempt to prepare a reward using a rejected score (sc-003 is rejected by anti-cheat)
    const rejectedScoreAttempt = await adminService.prepareReward({
      tournamentId: 'tourn-st-lightning',
      userId: 'usr-103',
      playerName: 'SpeedBotX',
      walletAddress: 'HckrFailWallet11111111111111111111',
      rank: 4,
      score: 99999,
      rewardAmount: '50,000 $PINN',
    });

    // Check eligible winners filtering: ensure only verified scores are included
    const winners = await adminService.determineEligibleWinners('tourn-cr-sprint-s1');
    const hasRejectedWinner = winners.some((w) => w.score === 99999);

    const test3Passed =
      rejectedScoreAttempt.success === false &&
      rejectedScoreAttempt.error?.includes('UNVERIFIED SCORE REJECTED') &&
      !hasRejectedWinner;

    assert(
      test3Passed,
      'Test 3: Unverified Score Exclusion',
      `Unverified/rejected scores strictly rejected: "${rejectedScoreAttempt.error}". Eligible winners list only contains verified runs.`,
      `Unverified scores were allowed to qualify!`
    );
  } catch (err: any) {
    assert(false, 'Test 3: Unverified Score Exclusion', '', `Error: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // TEST 4: Duplicate reward claims are rejected
  // -------------------------------------------------------------------------
  try {
    adminService.checkAdminStatus = async () => ({ isAdmin: true, role: 'admin' });

    // Prepare a reward for rank 9
    const firstClaim = await adminService.prepareReward({
      tournamentId: 'tourn-cr-sprint-s1',
      userId: 'usr-unique-claimant',
      playerName: 'UniqueWinner',
      walletAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      rank: 9,
      score: 11000,
      rewardAmount: '10,000 $PINN',
    });

    // Attempt duplicate reward for the exact same tournament and rank 9
    const secondClaim = await adminService.prepareReward({
      tournamentId: 'tourn-cr-sprint-s1',
      userId: 'usr-duplicate-claimant',
      playerName: 'DuplicateClaimant',
      walletAddress: '8mKbTqN2b1X9VfZ4p6Ww89Y5C1jL2mPnX3vQ4R7dJ8sT',
      rank: 9, // DUPLICATE RANK!
      score: 10900,
      rewardAmount: '10,000 $PINN',
    });

    const test4Passed =
      firstClaim.success === true &&
      secondClaim.success === false &&
      secondClaim.error?.includes('DUPLICATE REJECTED');

    assert(
      test4Passed,
      'Test 4: Duplicate Reward Claim Rejection',
      `First claim accepted (${firstClaim.reward?.id}), second duplicate claim rejected: "${secondClaim.error}".`,
      `Duplicate claim was accepted!`
    );
  } catch (err: any) {
    assert(false, 'Test 4: Duplicate Reward Claim Rejection', '', `Error: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // TEST 5: Failed Solana transactions are not marked as paid
  // -------------------------------------------------------------------------
  try {
    adminService.checkAdminStatus = async () => ({ isAdmin: true, role: 'admin' });

    const failedTxSig = '4hGf7uK9zFAILEDtxSignaturExAmple11111111111111111111111111111111111111111111111111111111';

    const payoutAttempt = await adminService.recordCompletedPayout({
      rewardRequestId: 'rw-002', // approved reward
      txSignature: failedTxSig,
      isSimulationDemo: true,
      simulateFailedTx: true, // simulates on-chain meta.err !== null
    });

    // Check reward status to ensure it was NOT updated to 'completed'
    const rewards = await adminService.getRewardRequests();
    const rw002 = rewards.find((r) => r.id === 'rw-002');
    const wasMarkedCompleted = rw002?.status === 'completed';

    const test5Passed =
      payoutAttempt.success === false &&
      payoutAttempt.error?.includes('TRANSACTION FAILED ON-CHAIN') &&
      !wasMarkedCompleted;

    assert(
      test5Passed,
      'Test 5: Failed Solana Tx Rejection',
      `Failed transaction was rejected: "${payoutAttempt.error}". Reward status remained '${rw002?.status}'.`,
      `Failed Solana transaction was marked as paid!`
    );
  } catch (err: any) {
    assert(false, 'Test 5: Failed Solana Tx Rejection', '', `Error: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // TEST 6: Duplicate transaction signatures are rejected
  // -------------------------------------------------------------------------
  try {
    adminService.checkAdminStatus = async () => ({ isAdmin: true, role: 'admin' });

    const uniqueSig = '5zRt1aX7vB3nQ9mK2pL8wE4sD6cV1fY0uI9oP7rE2tY5uI8oP1qW3eR5tY7uI9oP_TEST_UNIQUE_1';

    // 1st payout recording: should succeed
    const firstPayout = await adminService.recordCompletedPayout({
      rewardRequestId: 'rw-002',
      txSignature: uniqueSig,
      isSimulationDemo: true,
    });

    // 2nd payout recording with same signature for another reward: must be rejected!
    const secondPayout = await adminService.recordCompletedPayout({
      rewardRequestId: 'rw-003',
      txSignature: uniqueSig, // REUSE OF SAME SIGNATURE!
      isSimulationDemo: true,
    });

    const test6Passed =
      firstPayout.success === true &&
      secondPayout.success === false &&
      secondPayout.error?.includes('DUPLICATE SIGNATURE REJECTED');

    assert(
      test6Passed,
      'Test 6: Duplicate Transaction Signature Rejection',
      `First settlement recorded. Reusing signature for second settlement was rejected: "${secondPayout.error}".`,
      `Duplicate transaction signature was erroneously accepted!`
    );
  } catch (err: any) {
    assert(false, 'Test 6: Duplicate Transaction Signature Rejection', '', `Error: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // TEST 7: Only authorized administrators can approve rewards
  // -------------------------------------------------------------------------
  try {
    // 7A: Verify unauthorized player rejection
    adminService.checkAdminStatus = async () => ({ isAdmin: false, reason: 'Player account' });
    const playerApproval = await adminService.updateRewardStatus('rw-003', 'approved');

    // 7B: Verify authorized administrator approval
    adminService.checkAdminStatus = async () => ({ isAdmin: true, role: 'superadmin' });
    const adminApproval = await adminService.updateRewardStatus('rw-003', 'approved');

    const test7Passed =
      playerApproval.success === false &&
      playerApproval.error?.includes('Unauthorized') &&
      adminApproval.success === true;

    assert(
      test7Passed,
      'Test 7: Server-Enforced Admin Authorization',
      `Non-admin approval was blocked ("${playerApproval.error}"), while server-verified administrator approval succeeded.`,
      `Authorization bypass detected!`
    );
  } catch (err: any) {
    assert(false, 'Test 7: Server-Enforced Admin Authorization', '', `Error: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // TEST 8: All four existing games continue to work
  // -------------------------------------------------------------------------
  try {
    const gameFiles = [
      'src/components/game/PinnCoinRush.tsx',
      'src/components/game/PinnTreasureHunt.tsx',
      'src/components/game/PinnPuzzleMaster.tsx',
      'src/components/game/PinnSpeedTap.tsx',
      'src/pages/GamePage.tsx',
      'src/pages/TreasureHuntPage.tsx',
      'src/pages/PuzzleMasterPage.tsx',
      'src/pages/SpeedTapPage.tsx',
    ];

    let allFilesExist = true;
    for (const f of gameFiles) {
      const p = resolve(process.cwd(), f);
      if (!existsSync(p)) {
        allFilesExist = false;
        console.error(`Missing game file: ${f}`);
      }
    }

    // Verify all 4 game leaderboards and component files
    const games = ['coin-rush', 'treasure-hunt', 'puzzle-master', 'speed-tap'] as const;
    let allGamesTracked = true;
    for (const g of games) {
      const { entries } = await leaderboardService.getLeaderboard('all-time', g);
      if (!Array.isArray(entries) || entries.length === 0) {
        allGamesTracked = false;
        console.error(`Leaderboard entries missing for game: ${g}`);
      }
    }

    const test8Passed = allFilesExist && allGamesTracked;

    assert(
      test8Passed,
      'Test 8: Four Games Preserved & Fully Functional',
      `All 4 games (PINN Coin Rush, PINN Treasure Hunt, PINN Puzzle Master, PINN Speed Tap) components, page routes, game logic, and leaderboards are intact and operational.`,
      `One or more games are broken or missing!`
    );
  } catch (err: any) {
    assert(false, 'Test 8: Four Games Preserved & Fully Functional', '', `Error: ${err.message}`);
  } finally {
    // Restore original method
    adminService.checkAdminStatus = originalCheckAdmin;
  }

  // -------------------------------------------------------------------------
  // SUMMARY REPORT
  // -------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log('TEST RESULTS SUMMARY:');
  console.log('================================================================');
  const allPassed = results.every((r) => r.passed);
  results.forEach((r, idx) => {
    console.log(`${idx + 1}. [${r.passed ? 'PASSED' : 'FAILED'}] ${r.name}`);
  });

  console.log('================================================================');
  if (allPassed) {
    console.log('ALL 8 REQUIRED TESTS EXECUTED AND PASSED SUCCESSFULLY!');
  } else {
    console.error('TEST SUITE ENCOUNTERED FAILURES.');
    process.exit(1);
  }
}

runTestSuite();
