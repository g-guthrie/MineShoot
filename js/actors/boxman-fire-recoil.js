export function createFireRecoilState() {
    return {
        weaponKick: 0,
        shoulderPitch: 0,
        shoulderYaw: 0,
        shoulderRoll: 0,
        lowerArmPitch: 0,
        side: 1,
        recoverPitchScale: 1,
        recoverYawScale: 1,
        recoverRollScale: 1
    };
}

export function applyFireRecoilPose(rig, recoilState) {
    if (!rig || !recoilState) return false;
    var weaponNode = rig.weaponRoot || rig.gun || rig.weaponCube || null;
    var weaponBasePos = rig.weaponRootBasePos || rig.gunBasePos || null;
    if (weaponNode && weaponBasePos && weaponNode.position && weaponNode.position.copy) {
        weaponNode.position.copy(weaponBasePos);
        weaponNode.position.x += Number(recoilState.side || 0) * Math.abs(Number(recoilState.weaponKick || 0)) * 0.18;
        weaponNode.position.z += Number(recoilState.weaponKick || 0);
    }
    if (rig.armLowerR && rig.armLowerR.rotation) {
        rig.armLowerR.rotation.x += Number(recoilState.lowerArmPitch || 0) * 0.2;
    }
    return true;
}

export function decayFireRecoilState(recoilState, dt) {
    if (!recoilState) return false;
    var step = Math.max(0, Number(dt || 0));
    var pitchBlend = Math.min(1, step * 24 * Math.max(0.2, Number(recoilState.recoverPitchScale || 1)));
    var yawBlend = Math.min(1, step * 28 * Math.max(0.2, Number(recoilState.recoverYawScale || 1)));
    var rollBlend = Math.min(1, step * 26 * Math.max(0.2, Number(recoilState.recoverRollScale || 1)));
    var lowerArmBlend = Math.min(1, step * 30 * Math.max(0.2, Number(recoilState.recoverPitchScale || 1)));
    var weaponBlend = Math.min(
        1,
        step * 18 * Math.max(0.2, (Number(recoilState.recoverPitchScale || 1) + Number(recoilState.recoverRollScale || 1)) * 0.5)
    );
    recoilState.weaponKick += (0 - recoilState.weaponKick) * weaponBlend;
    recoilState.shoulderPitch += (0 - recoilState.shoulderPitch) * pitchBlend;
    recoilState.shoulderYaw += (0 - recoilState.shoulderYaw) * yawBlend;
    recoilState.shoulderRoll += (0 - recoilState.shoulderRoll) * rollBlend;
    recoilState.lowerArmPitch += (0 - recoilState.lowerArmPitch) * lowerArmBlend;
    return true;
}

export function triggerFireRecoil(recoilState, options) {
    if (!recoilState) return false;
    var opts = options || {};
    var strength = Math.max(0, Number(opts.strength == null ? 1 : opts.strength));
    var side = Number(opts.side);
    if (!isFinite(side) || side === 0) {
        recoilState.side = recoilState.side > 0 ? -1 : 1;
        side = recoilState.side;
    } else {
        side = side > 0 ? 1 : -1;
        recoilState.side = side;
    }
    var shoulderPitch = Number.isFinite(Number(opts.shoulderPitch))
        ? Number(opts.shoulderPitch)
        : (0.024 * strength);
    var shoulderYaw = Number.isFinite(Number(opts.shoulderYaw))
        ? Number(opts.shoulderYaw)
        : (0.012 * strength);
    var shoulderRoll = Number.isFinite(Number(opts.shoulderRoll))
        ? Number(opts.shoulderRoll)
        : (side * 0.008 * strength);
    var lowerArmPitch = Number.isFinite(Number(opts.lowerArmPitch))
        ? Number(opts.lowerArmPitch)
        : (0.165 * strength);
    var weaponKick = Number.isFinite(Number(opts.weaponKick))
        ? Number(opts.weaponKick)
        : (-0.04 * strength);
    recoilState.weaponKick = Math.max(-0.22, Math.min(0.05, Number(recoilState.weaponKick || 0) + weaponKick));
    recoilState.shoulderPitch = Math.max(-0.5, Math.min(0.24, Number(recoilState.shoulderPitch || 0) + shoulderPitch));
    recoilState.shoulderYaw = Math.max(-0.18, Math.min(0.18, Number(recoilState.shoulderYaw || 0) + shoulderYaw));
    recoilState.shoulderRoll = Math.max(-0.12, Math.min(0.12, Number(recoilState.shoulderRoll || 0) + shoulderRoll));
    recoilState.lowerArmPitch = Math.max(-0.8, Math.min(2.5, Number(recoilState.lowerArmPitch || 0) + lowerArmPitch));
    recoilState.recoverPitchScale = Math.max(0.2, Number(opts.recoverPitchScale || recoilState.recoverPitchScale || 1));
    recoilState.recoverYawScale = Math.max(0.2, Number(opts.recoverYawScale || recoilState.recoverYawScale || 1));
    recoilState.recoverRollScale = Math.max(0.2, Number(opts.recoverRollScale || recoilState.recoverRollScale || 1));
    return true;
}
