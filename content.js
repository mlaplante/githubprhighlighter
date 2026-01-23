// Configuration for blocking labels (case-insensitive)
const BLOCKING_LABELS = [
  'dont merge',
  'don\'t merge',
  'do not merge',
  'wip',
  'work in progress'
];

// Add a visible debug panel
function addDebugPanel(message) {
  let debugPanel = document.getElementById('pr-highlighter-debug');
  if (!debugPanel) {
    debugPanel = document.createElement('div');
    debugPanel.id = 'pr-highlighter-debug';
    debugPanel.style.cssText = `
      position: fixed;
      bottom: 10px;
      right: 10px;
      background: #1f2937;
      color: #10b981;
      padding: 15px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 11px;
      max-width: 400px;
      max-height: 300px;
      overflow-y: auto;
      z-index: 10000;
      box-shadow: 0 4px 6px rgba(0,0,0,0.3);
      border: 2px solid #10b981;
    `;
    document.body.appendChild(debugPanel);
  }
  
  const timestamp = new Date().toLocaleTimeString();
  debugPanel.innerHTML = `<div><strong>[${timestamp}]</strong> ${message}</div>` + debugPanel.innerHTML;
  console.log(`[PR Highlighter] ${message}`);
}

/**
 * Check if a PR has any blocking labels
 */
function hasBlockingLabel(prElement) {
  // Try multiple label selectors
  const labelSelectors = [
    '.labels .IssueLabel',
    '.IssueLabel',
    '[data-name]',
    '.Label'
  ];
  
  for (const selector of labelSelectors) {
    const labels = prElement.querySelectorAll(selector);
    if (labels.length > 0) {
      addDebugPanel(`Found ${labels.length} labels using selector: ${selector}`);
    }
    
    for (const label of labels) {
      const labelText = label.textContent.trim().toLowerCase();
      addDebugPanel(`Checking label: "${labelText}"`);
      
      if (BLOCKING_LABELS.some(blocking => labelText.includes(blocking))) {
        addDebugPanel(`❌ BLOCKING label found: "${labelText}"`);
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Check if a PR has been approved
 */
function hasApprovedStatus(prElement) {
  const prText = prElement.textContent || '';
  
  addDebugPanel(`Checking PR text for "Approved": ${prText.substring(0, 200)}...`);
  
  if (prText.includes('Approved') || prText.includes('approved')) {
    addDebugPanel('✓ Found "Approved" in PR text!');
    return true;
  }
  
  addDebugPanel('❌ "Approved" not found in PR text');
  return false;
}

/**
 * Check if a PR has blocking review status
 */
function hasBlockingReviewStatus(prElement) {
  const prText = prElement.textContent || '';
  
  const blockingPhrases = [
    'Changes requested',
    'Review required'
  ];
  
  for (const phrase of blockingPhrases) {
    if (prText.includes(phrase)) {
      addDebugPanel(`❌ Found blocking phrase: "${phrase}"`);
      return true;
    }
  }
  
  return false;
}

/**
 * Check if a PR is ready to merge
 */
function isPRReadyToMerge(prElement) {
  const hasBlocking = hasBlockingLabel(prElement);
  const hasBlockingReview = hasBlockingReviewStatus(prElement);
  const hasApproved = hasApprovedStatus(prElement);
  
  const isReady = !hasBlocking && !hasBlockingReview && hasApproved;
  
  addDebugPanel(`
    <strong>PR Ready Check:</strong><br>
    - No blocking labels: ${!hasBlocking ? '✓' : '❌'}<br>
    - No blocking review: ${!hasBlockingReview ? '✓' : '❌'}<br>
    - Has approved: ${hasApproved ? '✓' : '❌'}<br>
    - <strong>READY: ${isReady ? '✓ YES' : '❌ NO'}</strong>
  `);
  
  return isReady;
}

/**
 * Create or update the notification bar
 */
function createNotificationBar() {
  let notificationBar = document.getElementById('merge-ready-notification');
  
  if (!notificationBar) {
    notificationBar = document.createElement('div');
    notificationBar.id = 'merge-ready-notification';
    notificationBar.className = 'merge-ready-notification';
    
    const container = document.querySelector('.application-main') || document.body;
    container.insertBefore(notificationBar, container.firstChild);
  }
  
  return notificationBar;
}

/**
 * Update notification bar with count
 */
function updateNotificationBar(count) {
  const notificationBar = createNotificationBar();
  
  if (count > 0) {
    notificationBar.innerHTML = `
      <div class="notification-content">
        <svg class="notification-icon" viewBox="0 0 16 16" width="16" height="16">
          <path fill="currentColor" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"></path>
        </svg>
        <span class="notification-text">
          <strong>${count}</strong> ${count === 1 ? 'pull request is' : 'pull requests are'} ready to merge
        </span>
      </div>
    `;
    notificationBar.classList.add('visible');
  } else {
    notificationBar.innerHTML = `
      <div class="notification-content">
        <svg class="notification-icon" viewBox="0 0 16 16" width="16" height="16">
          <path fill="currentColor" d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8z"></path>
        </svg>
        <span class="notification-text">No pull requests ready to merge</span>
      </div>
    `;
    notificationBar.classList.add('visible');
  }
}

/**
 * Highlight merge-ready PRs and update notification
 */
function highlightMergeReadyPRs() {
  addDebugPanel('=== Starting PR scan ===');
  
  // Try MANY different selectors to find PR rows
  const prSelectors = [
    '[data-id][data-hovercard-type="pull_request"]',
    '.js-issue-row',
    '[id^="issue_"]',
    'div[id^="issue_"]',
    '.Box-row',
    '[data-hovercard-type="pull_request"]'
  ];
  
  let prItems = [];
  for (const selector of prSelectors) {
    prItems = document.querySelectorAll(selector);
    if (prItems.length > 0) {
      addDebugPanel(`✓ Found ${prItems.length} PRs using selector: "${selector}"`);
      break;
    } else {
      addDebugPanel(`Tried selector "${selector}" - found 0 items`);
    }
  }
  
  if (prItems.length === 0) {
    addDebugPanel('❌ NO PR ITEMS FOUND! Extension cannot work.');
    return;
  }
  
  let readyCount = 0;
  
  prItems.forEach((prElement, index) => {
    addDebugPanel(`<br>--- Checking PR #${index + 1} ---`);
    
    // Remove existing highlight
    prElement.classList.remove('merge-ready-pr');
    
    // Get PR title for logging
    const titleSelectors = ['.markdown-title', 'a.Link--primary', '.js-navigation-open'];
    let prTitle = `PR ${index + 1}`;
    for (const sel of titleSelectors) {
      const titleElem = prElement.querySelector(sel);
      if (titleElem) {
        prTitle = titleElem.textContent.trim();
        break;
      }
    }
    
    addDebugPanel(`<strong>PR Title: ${prTitle}</strong>`);
    
    // Check if ready
    if (isPRReadyToMerge(prElement)) {
      prElement.classList.add('merge-ready-pr');
      
      // Add inline styles as backup
      prElement.style.background = 'linear-gradient(90deg, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0.08) 100%)';
      prElement.style.borderLeft = '4px solid #10b981';
      prElement.style.paddingLeft = '12px';
      
      readyCount++;
      addDebugPanel(`✓✓✓ PR "${prTitle}" IS READY AND HIGHLIGHTED! ✓✓✓`);
    } else {
      addDebugPanel(`PR "${prTitle}" is NOT ready`);
    }
  });
  
  addDebugPanel(`<br><strong>TOTAL READY: ${readyCount}</strong>`);
  updateNotificationBar(readyCount);
}

/**
 * Initialize the extension
 */
function init() {
  addDebugPanel('🚀 PR Highlighter Extension Started!');
  addDebugPanel(`Current URL: ${window.location.href}`);
  
  // Initial highlighting
  setTimeout(() => {
    highlightMergeReadyPRs();
  }, 1000);
  
  // Watch for DOM changes
  const observer = new MutationObserver((mutations) => {
    clearTimeout(observer.timeoutId);
    observer.timeoutId = setTimeout(() => {
      addDebugPanel('DOM changed, re-scanning...');
      highlightMergeReadyPRs();
    }, 500);
  });
  
  const container = document.querySelector('.js-navigation-container') || 
                    document.querySelector('.container-lg') ||
                    document.body;
  
  if (container) {
    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }
}

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

