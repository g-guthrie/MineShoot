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
    const teamAlpha = document.getElementById('private-room-team-alpha');
    if (modeScreen) modeScreen.hidden = true;
    if (roomScreen) roomScreen.hidden = false;
    if (roomView) roomView.hidden = false;
    if (teamAlpha) {
      teamAlpha.innerHTML = `
        <div class="private-room-member">
          <div class="private-room-member-head">
            <span>Host Alpha</span>
            <span>Team Alpha</span>
          </div>
          <div class="private-room-member-id">USR_ALPHA</div>
          <button type="button" id="fixture-room-subaction" class="private-room-member-move">Move to Bravo</button>
        </div>
      `;
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
