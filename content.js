// Configuration for blocking labels (case-insensitive)
// Note: "Needs More Reviews" is NOT blocking - it's informational
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
 * Check if a PR has been approved
 */
function hasApprovedStatus(prElement) {
  // Method 1: Check the entire text content of the PR row
  const prText = prElement.textContent || '';
  
  // Look for "Approved" or "approved" anywhere in the PR row text
  if (prText.includes('Approved') || prText.includes('approved')) {
    console.log('[PR Highlighter] Found "Approved" in text content');
    return true;
  }
  
  // Method 2: Check for elements with specific classes or attributes
  const statusElements = prElement.querySelectorAll(
    '.State, .State--open, .State--closed, .State--merged, ' +
    '[data-test-selector*="review"], [aria-label*="pproved"], ' +
    '.text-small, .color-fg-muted, .d-flex'
  );
  
  for (const elem of statusElements) {
    const text = elem.textContent.toLowerCase();
    if (text.includes('approved')) {
      console.log('[PR Highlighter] Found "approved" in status element:', elem);
      return true;
    }
  }
  
  // Method 3: Look in all small text elements
  const allSmallText = prElement.querySelectorAll('.text-small, .Link--muted, span');
  for (const elem of allSmallText) {
    if (elem.textContent.includes('Approved') || elem.textContent.includes('approved')) {
      console.log('[PR Highlighter] Found "Approved" in small text element');
      return true;
    }
  }
  
  // Method 4: Check all elements with aria-labels
  const elementsWithLabels = prElement.querySelectorAll('[aria-label]');
  for (const elem of elementsWithLabels) {
    const label = elem.getAttribute('aria-label')?.toLowerCase() || '';
    if (label.includes('approved')) {
      console.log('[PR Highlighter] Found "approved" in aria-label:', label);
      return true;
    }
  }
  
  return false;
}

/**
 * Check if a PR has blocking review status (changes requested, review required, etc.)
 */
function hasBlockingReviewStatus(prElement) {
  const prText = prElement.textContent || '';
  
  // Check for blocking phrases in the entire PR text
  const blockingPhrases = [
    'Changes requested',
    'changes requested',
    'Review required',
    'review required',
    'Awaiting review',
    'awaiting review',
    'Needs review',
    'needs review'
  ];
  
  for (const phrase of blockingPhrases) {
    if (prText.includes(phrase)) {
      console.log('[PR Highlighter] Found blocking phrase:', phrase);
      return true;
    }
  }
  
  // Specifically check the metadata line (the line with author, date, status)
  const metadataElements = prElement.querySelectorAll('.opened-by, .flex-auto, .d-flex');
  for (const elem of metadataElements) {
    const text = elem.textContent;
    if (text.includes('Review required') || text.includes('review required')) {
      console.log('[PR Highlighter] Found "Review required" in metadata');
      return true;
    }
    if (text.includes('Changes requested') || text.includes('changes requested')) {
      console.log('[PR Highlighter] Found "Changes requested" in metadata');
      return true;
    }
  }
  
  // Check aria-labels
  const elementsWithLabels = prElement.querySelectorAll('[aria-label]');
  for (const elem of elementsWithLabels) {
    const label = elem.getAttribute('aria-label')?.toLowerCase() || '';
    if (label.includes('changes requested') || label.includes('review required')) {
      console.log('[PR Highlighter] Found blocking status in aria-label:', label);
      return true;
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
  
  // Must not have blocking review status (changes requested, review required)
  if (hasBlockingReviewStatus(prElement)) {
    return false;
  }
  
  // Must have approved status
  if (!hasApprovedStatus(prElement)) {
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
  // Try multiple selectors to find PR items
  let prItems = document.querySelectorAll('[data-id][data-hovercard-type="pull_request"]');
  
  // Fallback: try alternative selectors
  if (prItems.length === 0) {
    prItems = document.querySelectorAll('.js-issue-row');
  }
  
  if (prItems.length === 0) {
    prItems = document.querySelectorAll('[id^="issue_"]');
  }
  
  console.log(`[PR Highlighter] Found ${prItems.length} PR items using selector`);
  
  // If still no items found, log the page structure
  if (prItems.length === 0) {
    console.log('[PR Highlighter] No PR items found. Page structure:', 
                document.querySelector('.js-navigation-container, .container-lg'));
    return;
  }
  
  let readyCount = 0;
  
  prItems.forEach((prElement, index) => {
    // Remove existing highlight class first
    prElement.classList.remove('merge-ready-pr');
    
    // Debug info for each PR
    const prTitle = prElement.querySelector('.markdown-title')?.textContent.trim() || 
                    prElement.querySelector('a.Link--primary')?.textContent.trim() ||
                    prElement.querySelector('.js-navigation-open')?.textContent.trim() ||
                    `PR ${index + 1}`;
    
    const hasBlocking = hasBlockingLabel(prElement);
    const hasBlockingReview = hasBlockingReviewStatus(prElement);
    const hasApproved = hasApprovedStatus(prElement);
    
    console.log(`[PR Highlighter] "${prTitle}":`, {
      hasBlockingLabel: hasBlocking,
      hasBlockingReviewStatus: hasBlockingReview,
      hasApprovedStatus: hasApproved,
      isReady: !hasBlocking && !hasBlockingReview && hasApproved,
      textContent: prElement.textContent.substring(0, 200) + '...'
    });
    
    // Check if PR is ready to merge
    if (isPRReadyToMerge(prElement)) {
      prElement.classList.add('merge-ready-pr');
      readyCount++;
      console.log(`[PR Highlighter] ✓ "${prTitle}" is ready to merge`);
    }
  });
  
  console.log(`[PR Highlighter] Total ready to merge: ${readyCount}`);
  
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
