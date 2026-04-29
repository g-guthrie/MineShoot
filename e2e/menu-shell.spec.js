import { test, expect } from '@playwright/test';

const IPHONE_SAFARI_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';

async function openAuth(page) {
  await page.locator('#account-toggle-btn').click();
  await expect(page.locator('#auth-overlay')).toBeVisible();
}

async function getMenuBorderTokens(page) {
  return page.evaluate(() => {
    const surface = document.getElementById('menu-surface');
    const styles = surface ? getComputedStyle(surface) : null;
    return {
      shell: styles ? styles.getPropertyValue('--border-shell').trim() : '',
      action: styles ? styles.getPropertyValue('--border-action').trim() : '',
      subaction: styles ? styles.getPropertyValue('--border-subaction').trim() : ''
    };
  });
}

async function expectCleanMenuLayout(page) {
  const metrics = await page.evaluate(() => {
    function isVisible(node) {
      if (!node) return false;
      if (node.hidden) return false;
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }

    function containedInViewport(node) {
      if (!node || !isVisible(node)) return true;
      const rect = node.getBoundingClientRect();
      return rect.left >= -1 &&
        rect.right <= window.innerWidth + 1 &&
        rect.top >= -1 &&
        rect.bottom <= window.innerHeight + 1;
    }

    const visibleMenuNodes = Array.from(document.querySelectorAll([
      '#menu-shell.menu-shell-v4',
      '#menu-shell.menu-shell-v4 #menu-surface',
      '#menu-shell.menu-shell-v4 #menu-body',
      '#menu-shell.menu-shell-v4 .card',
      '#menu-shell.menu-shell-v4 .banner',
      '#menu-shell.menu-shell-v4 .flow',
      '#menu-shell.menu-shell-v4 .grid',
      '#menu-shell.menu-shell-v4 button',
      '#menu-shell.menu-shell-v4 input',
      '.modal-overlay:not([hidden]) .modal-card',
      '.modal-overlay:not([hidden]) button',
      '.modal-overlay:not([hidden]) input'
    ].join(','))).filter(isVisible);

    const overflowers = visibleMenuNodes
      .filter((node) => node.scrollWidth > node.clientWidth + 1)
      .map((node) => ({
        id: node.id || '',
        className: typeof node.className === 'string' ? node.className : '',
        tagName: node.tagName,
        scrollWidth: node.scrollWidth,
        clientWidth: node.clientWidth
      }))
      .slice(0, 6);

    const surface = document.getElementById('menu-surface');
    const utility = document.getElementById('utility-overlay');
    const modalCard = document.querySelector('.modal-overlay:not([hidden]) .modal-card');

    return {
      viewportOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      overflowers,
      surfaceContained: containedInViewport(surface),
      utilityContained: containedInViewport(utility),
      modalContained: containedInViewport(modalCard)
    };
  });

  expect(metrics.viewportOverflow).toBe(false);
  expect(metrics.overflowers).toEqual([]);
  expect(metrics.surfaceContained).toBe(true);
  expect(metrics.utilityContained).toBe(true);
  expect(metrics.modalContained).toBe(true);
}

test('menu boots without gameplay runtime and supports auth/docs/lazy gameplay loading', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/');

  await expect(page.locator('#menu-party-id-value')).not.toHaveText('------');
  await expect(page.locator('#menu-screen-mode')).toBeVisible();
  expect(await page.evaluate(() => !!window.__MAYHEM_RUNTIME.GameWorld)).toBe(false);
  expect(await page.evaluate(() => !!(window.__MAYHEM_RUNTIME.GameRuntimeLoader && window.__MAYHEM_RUNTIME.GameRuntimeLoader.getLoadedGameplayRuntime && window.__MAYHEM_RUNTIME.GameRuntimeLoader.getLoadedGameplayRuntime()))).toBe(false);

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
  await expect(page.locator('#docs-title')).toContainText(/field manual/i);
  await page.locator('#docs-close-btn').click();
  await expect(page.locator('#docs-panel')).toBeHidden();
  await page.locator('#party-back-btn').click();

  await page.locator('#game-modes-toggle-btn').click();
  await page.locator('#sandbox-mode-btn').click();
  await page.locator('#primary-launch-btn').click();
  await expect(page.locator('#active-match-shell')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#play-btn')).toHaveText(/enter match/i);
  await page.evaluate(() => document.getElementById('play-btn')?.click());
  await expect.poll(() => page.evaluate(() => !!window.__MAYHEM_RUNTIME.GameWorld), { timeout: 20_000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => !!(window.__MAYHEM_RUNTIME.GameRuntimeLoader && window.__MAYHEM_RUNTIME.GameRuntimeLoader.getLoadedGameplayRuntime && window.__MAYHEM_RUNTIME.GameRuntimeLoader.getLoadedGameplayRuntime())), { timeout: 20_000 }).toBe(true);
});

test('settings screen replaces the menu surface and keeps the menu glass spacing', async ({ page }) => {
  await page.setViewportSize({ width: 760, height: 560 });
  await page.goto('/');

  await page.locator('#utility-toggle-btn').click();
  await expect(page.locator('#utility-overlay')).toBeVisible();
  await expect(page.locator('#menu-screen-mode')).toBeHidden();
  await expect(page.locator('#party-back-btn')).toBeVisible();
  await expect(page.locator('#utility-toggle-btn')).toBeHidden();

  const metrics = await page.evaluate(() => {
    const overlay = document.getElementById('utility-overlay');
    const menuBody = document.getElementById('menu-body');
    const mainScreen = document.getElementById('menu-screen-mode');
    const surface = document.getElementById('menu-surface');
    const card = document.getElementById('utility-modal');
    const buttons = document.getElementById('utility-menu-buttons');
    const buttonNodes = buttons ? Array.from(buttons.querySelectorAll('button')) : [];
    if (!overlay || !menuBody || !mainScreen || !surface || !card || !buttons || !buttonNodes.length) {
      return { ready: false };
    }
    const overlayRect = overlay.getBoundingClientRect();
    const overlayStyle = getComputedStyle(overlay);
    const cardStyle = getComputedStyle(card);
    const buttonStyle = getComputedStyle(buttons);
    const surfaceStyle = getComputedStyle(surface);
    const blurStyle = cardStyle.backdropFilter || cardStyle.webkitBackdropFilter || '';
    const flowGap = Number.parseFloat(surfaceStyle.getPropertyValue('--gap-flow')) || 0;
    const buttonGap = Number.parseFloat(buttonStyle.rowGap || buttonStyle.gap) || 0;
    const buttonsContained = buttonNodes.every((button) => {
      const rect = button.getBoundingClientRect();
      return rect.left >= overlayRect.left - 1 &&
        rect.right <= overlayRect.right + 1 &&
        rect.top >= overlayRect.top - 1 &&
        rect.bottom <= overlayRect.bottom + 1;
    });

    return {
      ready: true,
      position: overlayStyle.position,
      parentId: overlay.parentElement ? overlay.parentElement.id : '',
      mainHidden: mainScreen.hidden,
      dataScreen: overlay.getAttribute('data-screen') || '',
      inViewport: overlayRect.top >= 0 &&
        overlayRect.left >= 0 &&
        overlayRect.right <= window.innerWidth &&
        overlayRect.bottom <= window.innerHeight,
      widthFitsSurface: overlayRect.width <= surface.getBoundingClientRect().width + 1,
      buttonsContained,
      usesGlassBlur: !!blurStyle && blurStyle !== 'none',
      buttonGap,
      flowGap
    };
  });

  expect(metrics.ready).toBe(true);
  expect(metrics.position).toBe('static');
  expect(metrics.parentId).toBe('menu-body');
  expect(metrics.mainHidden).toBe(true);
  expect(metrics.dataScreen).toBe('settings');
  expect(metrics.inViewport).toBe(true);
  expect(metrics.widthFitsSurface).toBe(true);
  expect(metrics.buttonsContained).toBe(true);
  expect(metrics.usesGlassBlur).toBe(true);
  expect(metrics.buttonGap).toBe(metrics.flowGap);
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
    return {
      homeOverflow: home ? home.scrollWidth > home.clientWidth + 1 : true,
      viewportOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
    };
  });

  expect(metrics.homeOverflow).toBe(false);
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
        modePill: { label: 'MODE', value: 'Team Death Match' },
        contextPill: { label: 'LEAD', value: '7' },
        primaryPill: { label: 'KILLS', value: '12' },
        secondaryPill: { label: 'DEATHS', value: '3' }
      }
    }));
  });

  const metrics = await page.evaluate(() => {
    const overlay = document.getElementById('overlay');
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

    const sessionRect = sessionActions ? sessionActions.getBoundingClientRect() : { left: 0, right: 0 };
    const shellRect = document.documentElement.getBoundingClientRect();

    return {
      mainHeroesHidden: !!(mainHeroes && mainHeroes.hidden),
      homeHeroHidden: !!(homeHero && homeHero.hidden),
      socialHeroHidden: !!(socialHero && socialHero.hidden),
      partyHeroHidden: !!(partyHero && partyHero.hidden),
      sessionActionsVisible: !!(sessionActions && !sessionActions.hidden),
      sessionPillsContained: withinRect(sessionStats, sessionRect) && withinRect(sessionStatus, sessionRect) && withinRect(sessionContext, sessionRect) && withinRect(sessionKd, sessionRect) && withinRect(sessionMeta, sessionRect),
      hiddenHeaderFeedback: headerFeedback ? getComputedStyle(headerFeedback).display === 'none' : false,
      hiddenBanner: activeBanner ? getComputedStyle(activeBanner).display === 'none' : false,
      pillRowCount: pillRows,
      overlayContext: overlay ? overlay.getAttribute('data-menu-context') : '',
      surfaceContext: menuSurface ? menuSurface.getAttribute('data-menu-context') : '',
      surfaceIsGlassy: alphaOf(menuSurface ? getComputedStyle(menuSurface).backgroundColor : '') < 0.9,
      structuredPillsApplied: !!(
        sessionStatus &&
        sessionStatus.textContent.trim() === 'Team Death Match' &&
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

test('active-match shell keeps the full four-pill layout contained at wide width', async ({ page }) => {
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
        modePill: { label: 'MODE', value: 'Team Death Match' },
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

    function withinRect(node, bounds) {
      if (!node) return false;
      const rect = node.getBoundingClientRect();
      return rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1;
    }

    const statsRect = sessionStats ? sessionStats.getBoundingClientRect() : { left: 0, right: 0 };

    return {
      statsVisible: !!(sessionStats && getComputedStyle(sessionStats).display !== 'none'),
      rowCount: pillRows,
      pillsContained: visiblePills.every((pill) => withinRect(pill, statsRect)),
      hiddenHeaderFeedback: hiddenHeaderFeedback ? getComputedStyle(hiddenHeaderFeedback).display === 'none' : false,
      hiddenBanner: hiddenBanner ? getComputedStyle(hiddenBanner).display === 'none' : false,
      viewportOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
    };
  });

  expect(metrics.statsVisible).toBe(true);
  expect(metrics.rowCount).toBeLessThanOrEqual(2);
  expect(metrics.pillsContained).toBe(true);
  expect(metrics.hiddenHeaderFeedback).toBe(true);
  expect(metrics.hiddenBanner).toBe(true);
  expect(metrics.viewportOverflow).toBe(false);
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
    const menuSurface = document.getElementById('menu-surface');
    const headerFeedback = document.getElementById('active-match-header-feedback');
    const activeBanner = document.getElementById('active-match-primary-banner');
    const sessionStats = document.getElementById('active-match-pill-grid');
    const sessionStatus = document.getElementById('active-match-mode-pill');
    const sessionContext = document.getElementById('active-match-context-pill');
    const sessionKd = document.getElementById('active-match-primary-stat-pill');
    const sessionMeta = document.getElementById('active-match-secondary-stat-pill');
    const statsStyle = sessionStats ? getComputedStyle(sessionStats) : null;
    const visiblePills = [sessionStatus, sessionContext, sessionKd, sessionMeta].filter((pill) => pill && getComputedStyle(pill).display !== 'none');
    const pillRows = new Set(visiblePills.map((pill) => Math.round(pill.getBoundingClientRect().top))).size;

    return {
      hiddenHeaderFeedback: headerFeedback ? getComputedStyle(headerFeedback).display === 'none' : false,
      hiddenBanner: activeBanner ? getComputedStyle(activeBanner).display === 'none' : false,
      hiddenSecondaryPill: sessionMeta ? getComputedStyle(sessionMeta).display === 'none' : false,
      statsRole: sessionStats ? sessionStats.getAttribute('data-rounded-role') : '',
      statsRadius: statsStyle ? statsStyle.borderRadius : '',
      expectedContainerRadius: menuSurface ? getComputedStyle(menuSurface).getPropertyValue('--radius-card').trim() : '',
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
  expect(metrics.statsRadius).toBe(metrics.expectedContainerRadius);
  expect(metrics.visiblePillCount).toBe(3);
  expect(metrics.rowCount).toBe(2);
  expect(metrics.modeText).toBe('Free For All');
  expect(metrics.contextText).toMatch(/paused/i);
  expect(metrics.primaryText).toBe('Change loadout or return to the match.');
  expect(metrics.statsHeight).toBeGreaterThan(0);
});

test('rounded container language stays consistent across active banner, active stats shell, room tray, and member block', async ({ page }) => {
  await page.goto('/');

  const metrics = await page.evaluate(() => {
    const activeBanner = document.getElementById('active-match-primary-banner');
    const activeStats = document.getElementById('active-match-pill-grid');
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
    const trayStyle = getComputedStyle(fixtureTray);
    const memberStyle = getComputedStyle(fixtureMember);
    const expectedContainerRadius = menuSurface ? getComputedStyle(menuSurface).getPropertyValue('--radius-card').trim() : '';

    return {
      activeBannerRole: activeBanner ? activeBanner.getAttribute('data-rounded-role') : '',
      activeStatsRole: activeStats ? activeStats.getAttribute('data-rounded-role') : '',
      trayRole: fixtureTray.getAttribute('data-rounded-role') || '',
      memberRole: fixtureMember.getAttribute('data-rounded-role') || '',
      activeBannerRadius: bannerStyle ? bannerStyle.borderRadius : '',
      activeStatsRadius: statsStyle ? statsStyle.borderRadius : '',
      trayRadius: trayStyle.borderRadius,
      memberRadius: memberStyle.borderRadius,
      expectedContainerRadius
    };
  });

  expect(metrics.activeBannerRole).toBe('container');
  expect(metrics.activeStatsRole).toBe('container');
  expect(metrics.trayRole).toBe('container');
  expect(metrics.memberRole).toBe('container');
  expect(metrics.activeBannerRadius).toBe(metrics.expectedContainerRadius);
  expect(metrics.activeStatsRadius).toBe(metrics.expectedContainerRadius);
  expect(metrics.trayRadius).toBe(metrics.expectedContainerRadius);
  expect(metrics.memberRadius).toBe(metrics.expectedContainerRadius);
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
    const loadoutRow = document.getElementById('loadout-row');
    const roomScreen = document.getElementById('menu-screen-room');
    const modeScreen = document.getElementById('menu-screen-mode');
    if (modeScreen) modeScreen.hidden = true;
    if (roomScreen) roomScreen.hidden = false;

    const loadoutOverflow = loadoutRow ? loadoutRow.scrollWidth > loadoutRow.clientWidth + 1 : false;
    const roomGrid = document.getElementById('room-screen-grid');
    const roomOverflow = roomGrid ? roomGrid.scrollWidth > roomGrid.clientWidth + 1 : false;
    return {
      loadoutOverflow,
      roomOverflow,
      viewportOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
    };
  });

  expect(metrics.loadoutOverflow).toBe(false);
  expect(metrics.roomOverflow).toBe(false);
  expect(metrics.viewportOverflow).toBe(false);
});

test('phone touch menu flow keeps main social settings auth and room surfaces contained', async ({ browser }) => {
  for (const size of [
    { width: 390, height: 844 },
    { width: 844, height: 390 }
  ]) {
    await test.step(`${size.width}x${size.height}`, async () => {
      const context = await browser.newContext({
        viewport: size,
        hasTouch: true,
        isMobile: true,
        userAgent: IPHONE_SAFARI_UA
      });
      const page = await context.newPage();
      try {
        await page.goto('/');
        await expect.poll(() => page.evaluate(() => ({
          phoneSizedTouch: !!(window.__MAYHEM_IS_PHONE_SIZED_TOUCH_DEVICE && window.__MAYHEM_IS_PHONE_SIZED_TOUCH_DEVICE()),
          touchPoints: Number(navigator.maxTouchPoints || 0) > 0,
          coarsePointer: !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
        }))).toEqual({
          phoneSizedTouch: true,
          touchPoints: true,
          coarsePointer: true
        });
        await expect(page.locator('#menu-surface')).toBeVisible();
        await expectCleanMenuLayout(page);

        await page.locator('#social-tools-toggle-btn').click();
        await expect(page.locator('#menu-social-hero')).toBeVisible();
        await expectCleanMenuLayout(page);

        await page.locator('#utility-toggle-btn').click();
        await expect(page.locator('#utility-overlay')).toBeVisible();
        await expectCleanMenuLayout(page);
        await page.locator('#party-back-btn').click();
        await expect(page.locator('#utility-overlay')).toBeHidden();

        await page.locator('#account-toggle-btn').click();
        await expect(page.locator('#auth-overlay')).toBeVisible();
        await expectCleanMenuLayout(page);
        await page.locator('#auth-close-btn').click();
        await expect(page.locator('#auth-overlay')).toBeHidden();

        await page.locator('#game-modes-toggle-btn').click();
        await expect(page.locator('#play-mode-options')).toBeVisible();
        await expectCleanMenuLayout(page);

        await page.evaluate(() => {
          const main = document.getElementById('menu-screen-mode');
          const roomScreen = document.getElementById('menu-screen-room');
          const roomView = document.getElementById('private-room-view');
          const sharePanel = document.getElementById('room-share-panel');
          const shareCode = document.getElementById('room-share-code');
          const rosterGrid = document.getElementById('private-room-roster-grid');
          const unassignedWrap = document.getElementById('private-room-unassigned-wrap');
          const teamCount = document.getElementById('private-room-team-count-actions');
          if (main) main.hidden = true;
          if (roomScreen) roomScreen.hidden = false;
          if (roomView) roomView.hidden = false;
          if (sharePanel) sharePanel.hidden = false;
          if (shareCode) shareCode.textContent = 'ABCD12';
          if (unassignedWrap) unassignedWrap.hidden = true;
          if (teamCount) teamCount.hidden = false;
          if (rosterGrid) {
            rosterGrid.replaceChildren();
            ['alpha', 'bravo', 'charlie', 'delta'].forEach((teamId, index) => {
              const lane = document.createElement('section');
              lane.className = 'private-room-team-lane';
              lane.setAttribute('data-team-id', teamId);
              const header = document.createElement('div');
              header.className = 'private-room-team-header';
              const name = document.createElement('div');
              name.className = 'private-room-team-name';
              name.textContent = `Team ${teamId}`;
              const meta = document.createElement('div');
              meta.className = 'private-room-team-subtitle';
              meta.textContent = index === 0 ? 'Host' : 'Ready';
              header.append(name, meta);
              const tray = document.createElement('div');
              tray.className = 'private-room-team-tray';
              const member = document.createElement('div');
              member.className = 'private-room-member-pill';
              member.setAttribute('data-rounded-role', 'container');
              const top = document.createElement('div');
              top.className = 'private-room-member-topline';
              const memberName = document.createElement('div');
              memberName.className = 'private-room-member-name';
              memberName.textContent = `PLAYER_${teamId.toUpperCase()}_${index}`;
              top.append(memberName);
              member.append(top);
              tray.append(member);
              lane.append(header, tray);
              rosterGrid.append(lane);
            });
          }
        });

        await page.locator('#private-room-action-row').scrollIntoViewIfNeeded();
        await expectCleanMenuLayout(page);
      } finally {
        await context.close();
      }
    });
  }
});

test('phone touch launch shows the no-fire-button acknowledgement before input capture', async ({ browser }) => {
  test.setTimeout(90_000);
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
    userAgent: IPHONE_SAFARI_UA
  });
  const page = await context.newPage();
  try {
    await page.goto('/');
    await expect.poll(() => page.evaluate(() => !!(window.__MAYHEM_IS_PHONE_SIZED_TOUCH_DEVICE && window.__MAYHEM_IS_PHONE_SIZED_TOUCH_DEVICE()))).toBe(true);

    await page.locator('#game-modes-toggle-btn').click();
    await page.locator('#sandbox-mode-btn').click();
    await page.locator('#primary-launch-btn').click();

    await expect(page.locator('#launch-flow')).toBeVisible({ timeout: 45_000 });
    await expect(page.locator('#launch-title')).toHaveText('Phone Shooting');
    await expect(page.locator('#launch-status')).toHaveText('There is no fire button.');
    await expect(page.locator('#launch-note')).toContainText('re-engage');
    await expect(page.locator('#launch-enter-btn')).toHaveText('I Understand');

    await page.locator('#launch-enter-btn').click();
    await expect(page.locator('#launch-flow')).toBeHidden();
    await expect(page.locator('#menu-stage')).toBeVisible();
    await expect(page.locator('#play-btn')).toHaveText(/enter match/i);
  } finally {
    await context.close();
  }
});

test('postgame flow stays readable and fully visible on phone-sized screens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await page.locator('#game-modes-toggle-btn').click();
  await page.locator('#sandbox-mode-btn').click();
  await page.locator('#primary-launch-btn').click();
  await expect.poll(() => page.evaluate(() => {
    const session = window.__MAYHEM_RUNTIME && window.__MAYHEM_RUNTIME.GameSession;
    return !!(session && session.syncMatchState);
  }), { timeout: 15_000 }).toBe(true);

  await page.evaluate(() => {
    const session = window.__MAYHEM_RUNTIME && window.__MAYHEM_RUNTIME.GameSession;
    if (!session || !session.syncMatchState) throw new Error('GameSession.syncMatchState unavailable');
    session.syncMatchState({
      matchState: {
        ended: true,
        endedAt: 123456,
        resetAt: 127000,
        winnerId: 'usr_self',
        mode: 'ffa',
        targetScore: 10,
        scoreByPlayer: { usr_self: 10 }
      },
      selfState: {
        id: 'usr_self',
        kills: 10,
        deaths: 3
      }
    });
  });

  await page.waitForTimeout(150);

  const celebrationMetrics = await page.evaluate(() => {
    const flow = document.getElementById('postgame-flow');
    const celebration = document.getElementById('postgame-celebration');
    const results = document.getElementById('postgame-results');
    const winner = document.getElementById('postgame-winner-banner');
    const note = document.getElementById('postgame-celebration-note');
    const ghosts = Array.from(document.querySelectorAll('#postgame-ghost-stage .postgame-ghost'))
      .filter((node) => getComputedStyle(node).display !== 'none');
    const ghostColumns = new Set(ghosts.map((node) => Math.round(node.getBoundingClientRect().left))).size;
    return {
      flowVisible: !!flow && !flow.hidden,
      celebrationVisible: !!celebration && !celebration.hidden,
      resultsHidden: !!results && results.hidden,
      winnerFontSize: winner ? Number.parseFloat(getComputedStyle(winner).fontSize) : 0,
      noteFontSize: note ? Number.parseFloat(getComputedStyle(note).fontSize) : 0,
      ghostColumns,
      viewportOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
    };
  });

  expect(celebrationMetrics.flowVisible).toBe(true);
  expect(celebrationMetrics.celebrationVisible).toBe(true);
  expect(celebrationMetrics.resultsHidden).toBe(true);
  expect(celebrationMetrics.winnerFontSize).toBeGreaterThanOrEqual(28);
  expect(celebrationMetrics.noteFontSize).toBeGreaterThanOrEqual(12);
  expect(celebrationMetrics.ghostColumns).toBe(1);
  expect(celebrationMetrics.viewportOverflow).toBe(false);

  await page.waitForTimeout(2900);

  const resultsMetrics = await page.evaluate(() => {
    const celebration = document.getElementById('postgame-celebration');
    const results = document.getElementById('postgame-results');
    const continueBtn = document.getElementById('postgame-continue-btn');
    const resultCards = Array.from(document.querySelectorAll('#postgame-results-grid .match-stat-pill'));
    const resultColumns = new Set(resultCards.map((node) => Math.round(node.getBoundingClientRect().left))).size;
    const continueRect = continueBtn ? continueBtn.getBoundingClientRect() : null;
    return {
      celebrationHidden: !!celebration && celebration.hidden,
      resultsVisible: !!results && !results.hidden,
      resultColumns,
      continueBottom: continueRect ? continueRect.bottom : 0,
      viewportHeight: window.innerHeight,
      viewportOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
    };
  });

  expect(resultsMetrics.celebrationHidden).toBe(true);
  expect(resultsMetrics.resultsVisible).toBe(true);
  expect(resultsMetrics.resultColumns).toBe(1);
  expect(resultsMetrics.continueBottom).toBeLessThanOrEqual(resultsMetrics.viewportHeight);
  expect(resultsMetrics.viewportOverflow).toBe(false);
});
