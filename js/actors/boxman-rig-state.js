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
        manualRollFacingYaw: 0,
        manualRollPending: false,
        manualRollAlignElapsed: 0,
        manualRollAlignDuration: 0,
        manualRollAlignStartYaw: 0,
        manualRollAlignTargetYaw: 0
    };
}

export function clearManualRollState(motionState) {
    motionState.manualRollActive = false;
    motionState.manualRollReverse = false;
    motionState.manualRollFacingYaw = 0;
    motionState.manualRollPending = false;
    motionState.manualRollAlignElapsed = 0;
    motionState.manualRollAlignDuration = 0;
    motionState.manualRollAlignStartYaw = 0;
    motionState.manualRollAlignTargetYaw = 0;
}
