// Configuration for blocking labels (case-insensitive)
const BLOCKING_LABELS = [
  'dont merge',
  'don\'t merge',
  'do not merge',
  'needs more review',
  'needs review',
  'wip',
  'work in progress'
];

/**
 * Check if a PR has any blocking labels
 */
function hasBlockingLabel(prElement) {
  const labels = prElement.querySelectorAll('.labels .IssueLabel');
  
  for (const label of labels) {
    const labelText = label.textContent.trim().toLowerCase();
    if (BLOCKING_LABELS.some(blocking => labelText.includes(blocking))) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if a PR has "Review required" status
 */
function hasReviewRequired(prElement) {
  // Look for review status indicators
  const reviewStatus = prElement.querySelector('[aria-label*="review"]');
  
  if (reviewStatus) {
    const statusText = reviewStatus.getAttribute('aria-label')?.toLowerCase() || '';
    const innerText = reviewStatus.textContent.toLowerCase();
    
    // Check for "review required" or "changes requested"
    if (statusText.includes('review required') || 
        statusText.includes('changes requested') ||
        innerText.includes('review required') ||
        innerText.includes('changes requested')) {
      return true;
    }
  }
  
  // Alternative: Check for review state in the PR row
  const reviewElements = prElement.querySelectorAll('[data-test-selector="pr-review-state"]');
  for (const elem of reviewElements) {
    const text = elem.textContent.toLowerCase();
    if (text.includes('review required') || text.includes('changes requested')) {
      return true;
    }
  }
  
  // Check for octicon review icons with specific states
  const reviewIcons = prElement.querySelectorAll('.octicon-dot-fill, .octicon-circle');
  for (const icon of reviewIcons) {
    const parent = icon.closest('[aria-label]');
    if (parent) {
      const label = parent.getAttribute('aria-label')?.toLowerCase() || '';
      if (label.includes('review required') || label.includes('changes requested')) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Check if a PR is ready to merge
 */
function isPRReadyToMerge(prElement) {
  // Must not have blocking labels
  if (hasBlockingLabel(prElement)) {
    return false;
  }
  
  // Must not have "review required" status
  if (hasReviewRequired(prElement)) {
    return false;
  }
  
  return true;
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
    
    // Insert at the top of the page
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
  // Find all PR items in the list
  const prItems = document.querySelectorAll('[data-id][data-hovercard-type="pull_request"]');
  
  let readyCount = 0;
  
  prItems.forEach(prElement => {
    // Remove existing highlight class first
    prElement.classList.remove('merge-ready-pr');
    
    // Check if PR is ready to merge
    if (isPRReadyToMerge(prElement)) {
      prElement.classList.add('merge-ready-pr');
      readyCount++;
    }
  });
  
  // Update notification bar with count
  updateNotificationBar(readyCount);
}

/**
 * Initialize the extension
 */
function init() {
  // Initial highlighting
  highlightMergeReadyPRs();
  
  // Watch for DOM changes (GitHub uses dynamic loading)
  const observer = new MutationObserver((mutations) => {
    // Debounce to avoid excessive calls
    clearTimeout(observer.timeoutId);
    observer.timeoutId = setTimeout(() => {
      highlightMergeReadyPRs();
    }, 300);
  });
  
  // Observe the PR list container
  const prListContainer = document.querySelector('[aria-label="Issues"]') || 
                          document.querySelector('.js-navigation-container') ||
                          document.body;
  
  if (prListContainer) {
    observer.observe(prListContainer, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'aria-label']
    });
  }
}

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
