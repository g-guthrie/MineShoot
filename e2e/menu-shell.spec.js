const { test, expect } = require('@playwright/test');

async function openAuth(page) {
  await page.locator('#account-toggle-btn').click();
  await expect(page.locator('#auth-overlay')).toBeVisible();
}

async function getMenuBorderTokens(page) {
  return page.evaluate(() => {
    const surface = document.getElementById('menu-surface');
    const styles = surface ? getComputedStyle(surface) : null;
    return {
      shell: styles ? styles.getPropertyValue('--menu-shell-border').trim() : '',
      action: styles ? styles.getPropertyValue('--menu-action-border').trim() : '',
      subaction: styles ? styles.getPropertyValue('--menu-subaction-border').trim() : ''
    };
  });
}

test('menu boots without gameplay runtime and supports auth/docs/lazy gameplay loading', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('#menu-party-id-value')).not.toHaveText('------');
  await expect(page.locator('#menu-screen-mode')).toBeVisible();
  expect(await page.evaluate(() => !!window.__MAYHEM_RUNTIME.GameWorld)).toBe(false);
  expect(await page.evaluate(() => !!window.__MAYHEM_RUNTIME.GameMain)).toBe(false);

  await openAuth(page);
  await expect.poll(() => page.evaluate(() => document.activeElement && document.activeElement.id)).toBe('auth-username');
  await page.locator('#auth-username').fill('ALPHA_E2E');
  await page.locator('#auth-pin').fill('12');
  await page.locator('#auth-play-btn').click();
  await expect(page.locator('#auth-status')).toContainText('PIN must be exactly 4 digits.');
  await page.locator('#auth-close-btn').click();
  await expect(page.locator('#auth-overlay')).toBeHidden();

  await page.locator('#utility-toggle-btn').click();
  await page.locator('#open-manual-btn').click();
  await expect(page.locator('#docs-panel')).toBeVisible();
  await expect(page.locator('#docs-title')).toContainText('FIELD MANUAL');
  await page.locator('#docs-close-btn').click();
  await expect(page.locator('#docs-panel')).toBeHidden();
  await page.locator('#utility-close-btn').click();

  await page.locator('#game-modes-toggle-btn').click();
  await page.locator('#practice-mode-btn').click();
  await page.locator('#primary-launch-btn').click();
  await expect.poll(() => page.evaluate(() => !!window.__MAYHEM_RUNTIME.GameWorld)).toBe(true);
  await expect.poll(() => page.evaluate(() => !!window.__MAYHEM_RUNTIME.GameMain)).toBe(true);
});

test('three-menu hero layout keeps the home hero contained without horizontal overflow', async ({ page }) => {
  await page.goto('/');

  await page.evaluate(() => {
    const mainHeroes = document.getElementById('menu-main-heroes');
    const partyHero = document.getElementById('menu-party-hero');
    const playModeOptions = document.getElementById('play-mode-options');
    if (mainHeroes) mainHeroes.setAttribute('data-columns', '3');
    if (partyHero) partyHero.hidden = false;
    if (playModeOptions) playModeOptions.hidden = false;
  });

  const metrics = await page.evaluate(() => {
    const home = document.getElementById('menu-home-hero');
    const title = document.getElementById('mode-screen-title');
    const toolbar = document.getElementById('play-mode-toolbar');
    const options = document.getElementById('play-mode-options');
    const homeRect = home.getBoundingClientRect();
    const nodes = [title, toolbar, options].filter(Boolean);
    const within = nodes.every((node) => {
      const rect = node.getBoundingClientRect();
      return rect.left >= homeRect.left - 1 && rect.right <= homeRect.right + 1;
    });
    return {
      within,
      viewportOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
    };
  });

  expect(metrics.within).toBe(true);
  expect(metrics.viewportOverflow).toBe(false);
});

test('active-match shell wraps the stat pills cleanly at narrow width without rendering hidden placeholders', async ({ page }) => {
  await page.setViewportSize({ width: 760, height: 1200 });
  await page.goto('/');

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('mayhem-session-state', {
      detail: {
        runtimeReady: true,
        inMatch: false,
        awaitingInputCapture: false,
        canResume: true,
        activityState: 'paused',
        launchContext: {}
      }
    }));
    window.dispatchEvent(new CustomEvent('mayhem-menu-match-model', {
      detail: {
        ready: true,
        banner: null,
        modePill: { label: 'MODE', value: 'TDM' },
        contextPill: { label: 'LEAD', value: '7' },
        primaryPill: { label: 'KILLS', value: '12' },
        secondaryPill: { label: 'DEATHS', value: '3' }
      }
    }));
  });

  const metrics = await page.evaluate(() => {
    const overlay = document.getElementById('overlay');
    const header = document.getElementById('menu-header');
    const menuSurface = document.getElementById('menu-surface');
    const mainHeroes = document.getElementById('menu-main-heroes');
    const homeHero = document.getElementById('menu-home-hero');
    const socialHero = document.getElementById('menu-social-hero');
    const partyHero = document.getElementById('menu-party-hero');
    const sessionActions = document.getElementById('active-match-shell');
    const sessionStats = document.getElementById('active-match-pill-grid');
    const sessionStatus = document.getElementById('active-match-mode-pill');
    const sessionContext = document.getElementById('active-match-context-pill');
    const sessionKd = document.getElementById('active-match-primary-stat-pill');
    const sessionMeta = document.getElementById('active-match-secondary-stat-pill');
    const headerFeedback = document.getElementById('active-match-header-feedback');
    const activeBanner = document.getElementById('active-match-primary-banner');
    const friendInput = document.getElementById('active-match-friend-id-input');
    const inviteFriend = document.getElementById('active-match-invite-friend-btn');
    const joinFriend = document.getElementById('active-match-join-friend-btn');
    const visiblePills = [sessionStatus, sessionContext, sessionKd, sessionMeta].filter((pill) => pill && getComputedStyle(pill).display !== 'none');
    const pillRows = new Set(visiblePills.map((pill) => Math.round(pill.getBoundingClientRect().top))).size;

    function alphaOf(color) {
      if (!color || color === 'transparent') return 0;
      const match = String(color).match(/rgba?\(([^)]+)\)/);
      if (!match) return 1;
      const parts = match[1].split(',').map((part) => Number(String(part).trim()));
      return parts.length >= 4 ? parts[3] : 1;
    }

    function withinRect(node, bounds) {
      if (!node) return false;
      const rect = node.getBoundingClientRect();
      return rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1;
    }

    const headerRect = header ? header.getBoundingClientRect() : { left: 0, right: 0 };
    const sessionRect = sessionActions ? sessionActions.getBoundingClientRect() : { left: 0, right: 0 };
    const shellRect = document.documentElement.getBoundingClientRect();

    return {
      mainHeroesHidden: !!(mainHeroes && mainHeroes.hidden),
      homeHeroHidden: !!(homeHero && homeHero.hidden),
      socialHeroHidden: !!(socialHero && socialHero.hidden),
      partyHeroHidden: !!(partyHero && partyHero.hidden),
      sessionActionsVisible: !!(sessionActions && !sessionActions.hidden),
      headerContainsFriendControls: withinRect(friendInput, headerRect) && withinRect(inviteFriend, headerRect) && withinRect(joinFriend, headerRect),
      sessionPillsContained: withinRect(sessionStats, sessionRect) && withinRect(sessionStatus, sessionRect) && withinRect(sessionContext, sessionRect) && withinRect(sessionKd, sessionRect) && withinRect(sessionMeta, sessionRect),
      hiddenHeaderFeedback: headerFeedback ? getComputedStyle(headerFeedback).display === 'none' : false,
      hiddenBanner: activeBanner ? getComputedStyle(activeBanner).display === 'none' : false,
      pillRowCount: pillRows,
      overlayContext: overlay ? overlay.getAttribute('data-menu-context') : '',
      surfaceContext: menuSurface ? menuSurface.getAttribute('data-menu-context') : '',
      surfaceIsGlassy: alphaOf(menuSurface ? getComputedStyle(menuSurface).backgroundColor : '') < 0.9,
      structuredPillsApplied: !!(
        sessionStatus &&
        sessionStatus.textContent.trim() === 'TDM' &&
        sessionContext &&
        sessionContext.textContent.trim() === '7' &&
        sessionKd &&
        sessionKd.textContent.trim() === '12' &&
        sessionMeta &&
        sessionMeta.textContent.trim() === '3'
      ),
      viewportOverflow: shellRect.width < document.documentElement.scrollWidth
    };
  });

  expect(metrics.mainHeroesHidden).toBe(true);
  expect(metrics.homeHeroHidden).toBe(true);
  expect(metrics.socialHeroHidden).toBe(true);
  expect(metrics.partyHeroHidden).toBe(true);
  expect(metrics.sessionActionsVisible).toBe(true);
  expect(metrics.headerContainsFriendControls).toBe(true);
  expect(metrics.sessionPillsContained).toBe(true);
  expect(metrics.hiddenHeaderFeedback).toBe(true);
  expect(metrics.hiddenBanner).toBe(true);
  expect(metrics.pillRowCount).toBeGreaterThan(1);
  expect(metrics.overlayContext).toBe('active-match');
  expect(metrics.surfaceContext).toBe('active-match');
  expect(metrics.surfaceIsGlassy).toBe(true);
  expect(metrics.structuredPillsApplied).toBe(true);
  expect(metrics.viewportOverflow).toBe(false);
});

test('active-match shell keeps the full four-pill layout on one row at wide width', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('mayhem-session-state', {
      detail: {
        runtimeReady: true,
        inMatch: false,
        awaitingInputCapture: false,
        canResume: true,
        activityState: 'paused',
        launchContext: {}
      }
    }));
    window.dispatchEvent(new CustomEvent('mayhem-menu-match-model', {
      detail: {
        ready: true,
        banner: null,
        modePill: { label: 'MODE', value: 'TDM' },
        contextPill: { label: 'LEAD', value: '7' },
        primaryPill: { label: 'KILLS', value: '12' },
        secondaryPill: { label: 'DEATHS', value: '3' }
      }
    }));
  });

  const metrics = await page.evaluate(() => {
    const sessionStats = document.getElementById('active-match-pill-grid');
    const sessionStatus = document.getElementById('active-match-mode-pill');
    const sessionContext = document.getElementById('active-match-context-pill');
    const sessionKd = document.getElementById('active-match-primary-stat-pill');
    const sessionMeta = document.getElementById('active-match-secondary-stat-pill');
    const hiddenHeaderFeedback = document.getElementById('active-match-header-feedback');
    const hiddenBanner = document.getElementById('active-match-primary-banner');
    const visiblePills = [sessionStatus, sessionContext, sessionKd, sessionMeta].filter((pill) => pill && getComputedStyle(pill).display !== 'none');
    const pillRows = new Set(visiblePills.map((pill) => Math.round(pill.getBoundingClientRect().top))).size;

    return {
      statsVisible: !!(sessionStats && getComputedStyle(sessionStats).display !== 'none'),
      rowCount: pillRows,
      hiddenHeaderFeedback: hiddenHeaderFeedback ? getComputedStyle(hiddenHeaderFeedback).display === 'none' : false,
      hiddenBanner: hiddenBanner ? getComputedStyle(hiddenBanner).display === 'none' : false
    };
  });

  expect(metrics.statsVisible).toBe(true);
  expect(metrics.rowCount).toBe(1);
  expect(metrics.hiddenHeaderFeedback).toBe(true);
  expect(metrics.hiddenBanner).toBe(true);
});

test('active-match header feedback wraps long text without overflowing the shell', async ({ page }) => {
  await page.setViewportSize({ width: 760, height: 1200 });
  await page.goto('/');

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('mayhem-session-state', {
      detail: {
        runtimeReady: true,
        inMatch: false,
        awaitingInputCapture: false,
        canResume: true,
        activityState: 'paused',
        launchContext: {}
      }
    }));
    const feedback = document.getElementById('active-match-header-feedback');
    if (feedback) {
      feedback.hidden = false;
      feedback.textContent = 'Invite pending for EXTRAORDINARILY-LONG-PLAYER-NAME-WITH-MULTIPLE-SECTIONS.';
    }
  });

  const metrics = await page.evaluate(() => {
    const shell = document.getElementById('menu-surface');
    const feedback = document.getElementById('active-match-header-feedback');
    if (!shell || !feedback) return { contained: false, wraps: false };
    const shellRect = shell.getBoundingClientRect();
    const feedbackRect = feedback.getBoundingClientRect();
    return {
      contained: feedbackRect.left >= shellRect.left - 1 && feedbackRect.right <= shellRect.right + 1,
      wraps: feedbackRect.height > 30
    };
  });

  expect(metrics.contained).toBe(true);
  expect(metrics.wraps).toBe(true);
});

test('clicking the dimmed paused background resumes gameplay while clicks inside the menu do not', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');

  await page.evaluate(() => {
    window.__pauseOverlayResumeCalls = [];
    window.__MAYHEM_RUNTIME = window.__MAYHEM_RUNTIME || {};
    window.__MAYHEM_RUNTIME.GameSession = window.__MAYHEM_RUNTIME.GameSession || {};
    window.__MAYHEM_RUNTIME.GameSession.resumeGameplay = function () {
      window.__pauseOverlayResumeCalls.push('resume');
      return Promise.resolve({ ok: true, entered: false, error: 'Pointer lock denied.' });
    };
    window.dispatchEvent(new CustomEvent('mayhem-session-state', {
      detail: {
        runtimeReady: true,
        inMatch: false,
        awaitingInputCapture: false,
        canResume: true,
        activityState: 'paused',
        launchContext: {}
      }
    }));
  });

  await page.locator('#menu-surface').click();
  expect(await page.evaluate(() => window.__pauseOverlayResumeCalls.length)).toBe(0);

  const surfaceBox = await page.locator('#menu-surface').boundingBox();
  expect(surfaceBox).toBeTruthy();
  await page.mouse.click(Math.max(5, surfaceBox.x - 20), surfaceBox.y + 20);

  expect(await page.evaluate(() => window.__pauseOverlayResumeCalls.length)).toBe(1);
});

test('paused fallback state hides blank banner chrome and empty stat pills', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('mayhem-session-state', {
      detail: {
        runtimeReady: true,
        inMatch: false,
        awaitingInputCapture: false,
        canResume: true,
        activityState: 'paused',
        launchContext: {}
      }
    }));
  });

  const metrics = await page.evaluate(() => {
    const headerFeedback = document.getElementById('active-match-header-feedback');
    const activeBanner = document.getElementById('active-match-primary-banner');
    const sessionStats = document.getElementById('active-match-pill-grid');
    const sessionStatus = document.getElementById('active-match-mode-pill');
    const sessionContext = document.getElementById('active-match-context-pill');
    const sessionKd = document.getElementById('active-match-primary-stat-pill');
    const sessionMeta = document.getElementById('active-match-secondary-stat-pill');
    const loadoutShell = document.getElementById('loadout-expanded-shell');
    const statsStyle = sessionStats ? getComputedStyle(sessionStats) : null;
    const loadoutStyle = loadoutShell ? getComputedStyle(loadoutShell) : null;
    const visiblePills = [sessionStatus, sessionContext, sessionKd, sessionMeta].filter((pill) => pill && getComputedStyle(pill).display !== 'none');
    const pillRows = new Set(visiblePills.map((pill) => Math.round(pill.getBoundingClientRect().top))).size;

    return {
      hiddenHeaderFeedback: headerFeedback ? getComputedStyle(headerFeedback).display === 'none' : false,
      hiddenBanner: activeBanner ? getComputedStyle(activeBanner).display === 'none' : false,
      hiddenSecondaryPill: sessionMeta ? getComputedStyle(sessionMeta).display === 'none' : false,
      statsRole: sessionStats ? sessionStats.getAttribute('data-rounded-role') : '',
      statsRadius: statsStyle ? statsStyle.borderRadius : '',
      loadoutRadius: loadoutStyle ? loadoutStyle.borderRadius : '',
      visiblePillCount: visiblePills.length,
      rowCount: pillRows,
      modeText: sessionStatus ? sessionStatus.textContent.trim() : '',
      contextText: sessionContext ? sessionContext.textContent.trim() : '',
      primaryText: sessionKd ? sessionKd.textContent.trim() : '',
      statsHeight: sessionStats ? Math.round(sessionStats.getBoundingClientRect().height) : 0
    };
  });

  expect(metrics.hiddenHeaderFeedback).toBe(true);
  expect(metrics.hiddenBanner).toBe(true);
  expect(metrics.hiddenSecondaryPill).toBe(true);
  expect(metrics.statsRole).toBe('container');
  expect(metrics.statsRadius).toBe(metrics.loadoutRadius);
  expect(metrics.visiblePillCount).toBe(3);
  expect(metrics.rowCount).toBe(1);
  expect(metrics.modeText).toBe('FFA');
  expect(metrics.contextText).toBe('PAUSED');
  expect(metrics.primaryText).toBe('Change loadout or return to the match.');
  expect(metrics.statsHeight).toBeGreaterThan(0);
});

test('rounded container language stays consistent across active banner, active stats shell, loadout shell, room tray, and member block', async ({ page }) => {
  await page.goto('/');

  const metrics = await page.evaluate(() => {
    const activeBanner = document.getElementById('active-match-primary-banner');
    const activeStats = document.getElementById('active-match-pill-grid');
    const loadoutShell = document.getElementById('loadout-expanded-shell');
    const menuSurface = document.getElementById('menu-surface');
    if (activeBanner) {
      activeBanner.hidden = false;
      const copy = document.getElementById('active-match-primary-banner-copy');
      if (copy) copy.textContent = 'Invite from BRAVO.';
    }
    if (activeStats) activeStats.hidden = false;

    const fixtureTray = document.createElement('div');
    fixtureTray.id = 'fixture-rounded-room-tray';
    fixtureTray.className = 'private-room-team-tray';
    fixtureTray.setAttribute('data-rounded-role', 'container');
    const fixtureMember = document.createElement('div');
    fixtureMember.id = 'fixture-rounded-room-member';
    fixtureMember.className = 'private-room-member-pill';
    fixtureMember.setAttribute('data-rounded-role', 'container');
    fixtureMember.textContent = 'ALPHA';
    fixtureTray.appendChild(fixtureMember);
    (menuSurface || document.body).appendChild(fixtureTray);

    const bannerStyle = activeBanner ? getComputedStyle(activeBanner) : null;
    const statsStyle = activeStats ? getComputedStyle(activeStats) : null;
    const shellStyle = loadoutShell ? getComputedStyle(loadoutShell) : null;
    const trayStyle = getComputedStyle(fixtureTray);
    const memberStyle = getComputedStyle(fixtureMember);

    return {
      activeBannerRole: activeBanner ? activeBanner.getAttribute('data-rounded-role') : '',
      activeStatsRole: activeStats ? activeStats.getAttribute('data-rounded-role') : '',
      loadoutShellRole: loadoutShell ? loadoutShell.getAttribute('data-rounded-role') : '',
      trayRole: fixtureTray.getAttribute('data-rounded-role') || '',
      memberRole: fixtureMember.getAttribute('data-rounded-role') || '',
      activeBannerRadius: bannerStyle ? bannerStyle.borderRadius : '',
      activeStatsRadius: statsStyle ? statsStyle.borderRadius : '',
      loadoutShellRadius: shellStyle ? shellStyle.borderRadius : '',
      trayRadius: trayStyle.borderRadius,
      memberRadius: memberStyle.borderRadius
    };
  });

  expect(metrics.activeBannerRole).toBe('container');
  expect(metrics.activeStatsRole).toBe('container');
  expect(metrics.loadoutShellRole).toBe('container');
  expect(metrics.trayRole).toBe('container');
  expect(metrics.memberRole).toBe('container');
  expect(metrics.activeBannerRadius).toBe(metrics.loadoutShellRadius);
  expect(metrics.activeStatsRadius).toBe(metrics.loadoutShellRadius);
  expect(metrics.trayRadius).toBe(metrics.loadoutShellRadius);
  expect(metrics.memberRadius).toBe(metrics.loadoutShellRadius);
});

test('menu v4 border hierarchy distinguishes shells actions and subactions', async ({ page }) => {
  await page.goto('/');

  await page.evaluate(() => {
    const actionsPane = document.getElementById('menu-social-actions-pane');
    if (!actionsPane) return;
    const subaction = document.createElement('button');
    subaction.id = 'border-hierarchy-subaction';
    subaction.type = 'button';
    subaction.className = 'friend-preview-btn secondary';
    subaction.textContent = 'Remove Friend';
    actionsPane.appendChild(subaction);
  });

  const tokens = await getMenuBorderTokens(page);
  const styles = await page.evaluate(() => {
    const shell = document.getElementById('menu-home-hero');
    const action = document.getElementById('game-modes-toggle-btn');
    const subaction = document.getElementById('border-hierarchy-subaction');
    return {
      shell: shell ? getComputedStyle(shell).boxShadow : '',
      action: action ? getComputedStyle(action).boxShadow : '',
      subaction: subaction ? getComputedStyle(subaction).boxShadow : ''
    };
  });

  expect(styles.shell).toContain(tokens.shell);
  expect(styles.action).toContain(tokens.action);
  expect(styles.subaction).toContain(tokens.subaction);
  expect(styles.action).not.toContain(tokens.subaction);
});

test('expanded party and friend controls keep parent pills darker than nested subactions', async ({ page }) => {
  await page.goto('/');

  await page.evaluate(() => {
    const partyHero = document.getElementById('menu-party-hero');
    const friendsPane = document.getElementById('menu-social-friends-pane');
    const socialLayout = document.getElementById('menu-social-layout');
    const partyMembers = document.getElementById('party-hero-members');
    const friendsList = document.getElementById('social-friends-list');
    if (partyHero) partyHero.hidden = false;
    if (friendsPane) friendsPane.hidden = false;
    if (socialLayout) socialLayout.setAttribute('data-layout', 'split');
    if (partyMembers) {
      partyMembers.innerHTML = `
        <div class="menu-member-card">
          <button type="button" id="fixture-party-member" class="menu-member-pill">BRAVO</button>
          <div class="menu-member-subpills">
            <button type="button" id="fixture-party-subaction" class="friend-preview-btn secondary">Kick from Party</button>
          </div>
        </div>
      `;
    }
    if (friendsList) {
      friendsList.innerHTML = `
        <div class="menu-friend-card">
          <button type="button" id="fixture-friend-pill" class="menu-friend-pill">
            <div class="menu-friend-pill-name"><span>ALLY</span></div>
          </button>
          <div class="menu-member-subpills">
            <button type="button" id="fixture-friend-subaction" class="friend-preview-btn secondary">Remove Friend</button>
          </div>
        </div>
      `;
    }
  });

  const tokens = await getMenuBorderTokens(page);
  const styles = await page.evaluate(() => {
    const partyPill = document.getElementById('fixture-party-member');
    const partySubaction = document.getElementById('fixture-party-subaction');
    const friendPill = document.getElementById('fixture-friend-pill');
    const friendSubaction = document.getElementById('fixture-friend-subaction');
    return {
      partyPill: partyPill ? getComputedStyle(partyPill).boxShadow : '',
      partySubaction: partySubaction ? getComputedStyle(partySubaction).boxShadow : '',
      friendPill: friendPill ? getComputedStyle(friendPill).boxShadow : '',
      friendSubaction: friendSubaction ? getComputedStyle(friendSubaction).boxShadow : ''
    };
  });

  expect(styles.partyPill).toContain(tokens.action);
  expect(styles.partySubaction).toContain(tokens.subaction);
  expect(styles.friendPill).toContain(tokens.action);
  expect(styles.friendSubaction).toContain(tokens.subaction);
});

test('room controls separate primary actions from contextual subactions', async ({ page }) => {
  await page.goto('/');

  await page.evaluate(() => {
    const modeScreen = document.getElementById('menu-screen-mode');
    const roomScreen = document.getElementById('menu-screen-room');
    const roomView = document.getElementById('private-room-view');
    if (modeScreen) modeScreen.hidden = true;
    if (roomScreen) roomScreen.hidden = false;
    if (roomView) roomView.hidden = false;
    if (roomView) {
      roomView.insertAdjacentHTML('beforeend', '<button type="button" id="fixture-room-subaction" class="private-room-member-move">Move to Bravo</button>');
    }
  });

  const tokens = await getMenuBorderTokens(page);
  const styles = await page.evaluate(() => {
    const shell = document.getElementById('party-room-section');
    const action = document.getElementById('private-room-start-btn');
    const inviteRow = document.getElementById('private-room-invite-lock-btn');
    const memberMove = document.getElementById('fixture-room-subaction');
    return {
      shell: shell ? getComputedStyle(shell).boxShadow : '',
      action: action ? getComputedStyle(action).boxShadow : '',
      inviteRow: inviteRow ? getComputedStyle(inviteRow).boxShadow : '',
      memberMove: memberMove ? getComputedStyle(memberMove).boxShadow : ''
    };
  });

  expect(styles.shell).toContain(tokens.shell);
  expect(styles.action).toContain(tokens.action);
  expect(styles.inviteRow).toContain(tokens.subaction);
  expect(styles.memberMove).toContain(tokens.subaction);
});

test('narrow menu surfaces reflow without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 760, height: 1200 });
  await page.goto('/');

  const metrics = await page.evaluate(() => {
    const loadoutShell = document.getElementById('loadout-expanded-shell');
    const partyScreen = document.getElementById('menu-screen-party');
    const modeScreen = document.getElementById('menu-screen-mode');
    if (modeScreen) modeScreen.hidden = true;
    if (partyScreen) partyScreen.hidden = false;

    const loadoutOverflow = loadoutShell ? loadoutShell.scrollWidth > loadoutShell.clientWidth + 1 : false;
    const partyGrid = document.getElementById('party-screen-grid');
    const partyOverflow = partyGrid ? partyGrid.scrollWidth > partyGrid.clientWidth + 1 : false;
    return {
      loadoutOverflow,
      partyOverflow,
      viewportOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
    };
  });

  expect(metrics.loadoutOverflow).toBe(false);
  expect(metrics.partyOverflow).toBe(false);
  expect(metrics.viewportOverflow).toBe(false);
});
