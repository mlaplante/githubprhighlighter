// Configuration for blocking labels (case-insensitive)
const BLOCKING_LABELS = [
  'dont merge',
  'don\'t merge',
  'do not merge',
  'wip',
  'work in progress'
];

/**
 * Check if a PR has any blocking labels
 */
function hasBlockingLabel(prElement) {
  const labels = prElement.querySelectorAll('.IssueLabel, .Label');
  
  for (const label of labels) {
    const labelText = label.textContent.trim().toLowerCase();
    if (BLOCKING_LABELS.some(blocking => labelText.includes(blocking))) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if a PR has been approved
 */
function hasApprovedStatus(prElement) {
  const prText = prElement.textContent || '';
  return prText.includes('Approved') || prText.includes('approved');
}

/**
 * Check if a PR has blocking review status
 */
function hasBlockingReviewStatus(prElement) {
  const prText = prElement.textContent || '';
  
  return prText.includes('Changes requested') || 
         prText.includes('Review required');
}

/**
 * Check if a PR is ready to merge
 */
function isPRReadyToMerge(prElement) {
  return !hasBlockingLabel(prElement) && 
         !hasBlockingReviewStatus(prElement) && 
         hasApprovedStatus(prElement);
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
  // Find PR rows - try the most common selector first
  const prItems = document.querySelectorAll('.js-issue-row');
  
  if (prItems.length === 0) {
    return;
  }
  
  let readyCount = 0;
  
  prItems.forEach(prElement => {
    // Remove existing highlight
    prElement.classList.remove('merge-ready-pr');
    
    // Check if ready and apply highlight
    if (isPRReadyToMerge(prElement)) {
      prElement.classList.add('merge-ready-pr');
      readyCount++;
    }
  });
  
  // Update notification bar
  updateNotificationBar(readyCount);
}

/**
 * Initialize the extension
 */
function init() {
  // Wait a moment for page to load
  setTimeout(() => {
    highlightMergeReadyPRs();
  }, 500);
  
  // Watch for DOM changes with debouncing
  let debounceTimer;
  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      highlightMergeReadyPRs();
    }, 1000); // Increased debounce time to reduce load
  });
  
  // Observe only the PR container, not the entire body
  const container = document.querySelector('.js-navigation-container');
  
  if (container) {
    observer.observe(container, {
      childList: true,
      subtree: true
    });
  }
}

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

