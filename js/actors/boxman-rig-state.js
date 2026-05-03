import {
    createDirectionalLocomotionState,
    resolveMoveIntent,
    STOP_DIRECTIONAL_SETTLE_DURATION
} from './boxman-directional-locomotion.js';

export function createRigMotionState() {
    return {
        wasGrounded: true,
        wasMoving: false,
        lastSprinting: false,
        lastMoveForward: false,
        lastMoveBackward: false,
        lastMoveLeft: false,
        lastMoveRight: false,
        lastMoveIntent: resolveMoveIntent(null),
        lastMoveDirectionalSnapshot: null,
        recentForwardStopRemaining: 0,
        recentForwardStopWeight: 0,
        stopSettleRemaining: 0,
        stopSettleDuration: STOP_DIRECTIONAL_SETTLE_DURATION,
        stopDirectionalSnapshot: null,
        stopLockDuration: 0,
        lastYaw: null,
        lockName: '',
        lockRemaining: 0,
        jumpTriggered: false,
        lastGroundedSpeed: 0,
        airborneStartFootY: null,
        lastLandingDropDistance: 0,
        lastLandingHorizontalSpeed: 0,
        directional: createDirectionalLocomotionState(),
        turnEntryDirection: 0,
        idleAimCurrentPitch: 0,
        idleAimCurrentYaw: 0,
        manualRollActive: false,
        manualRollReverse: false,
        manualRollFacingYaw: 0
    };
}

export function clearManualRollState(motionState) {
    motionState.manualRollActive = false;
    motionState.manualRollReverse = false;
    motionState.manualRollFacingYaw = 0;
}

export function clearStopRecoveryState(motionState) {
    if (!motionState) return false;
    var hadStopRecovery = (
        (motionState.lockName === 'stop' && Number(motionState.lockRemaining || 0) > 0) ||
        Number(motionState.stopSettleRemaining || 0) > 0 ||
        !!motionState.stopDirectionalSnapshot
    );
    if (!hadStopRecovery) return false;
    if (motionState.lockName === 'stop') {
        motionState.lockName = '';
        motionState.lockRemaining = 0;
    }
    motionState.stopLockDuration = 0;
    motionState.stopSettleRemaining = 0;
    motionState.stopDirectionalSnapshot = null;
    return true;
}
