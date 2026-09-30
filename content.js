(() => {
  'use strict';

  // Configuration for blocking labels (case-insensitive)
  const BLOCKING_LABELS = [
    'dont merge',
    'don\'t merge',
    'do not merge',
    'wip',
    'work in progress'
  ];

  const ROW_FLAG = 'merge-ready-pr';
  const REVIEW_FLAG = 'review-requested-pr';
  const CHANGES_FLAG = 'changes-requested-pr';
  const SEEN_ATTR = 'data-mrh-seen';

  // ---------------------------------------------------------------------------
  // Adapters
  //
  // GitHub currently serves two different PR-list markups: the legacy
  // Rails-rendered list (still what logged-out visitors and pre-rollout accounts
  // get) and the newer React list. Both are live at the same time, so we detect
  // which one is on the page rather than committing to either.
  //
  // Each adapter answers the same three questions about the page:
  //   listRoot() -> the element to observe for changes, or null if not this view
  //   rows(root) -> the per-PR row elements to highlight
  //   signals(row) -> { labels: string[], review: string } for the shared predicate
  // ---------------------------------------------------------------------------

  const LEGACY_ADAPTER = {
    name: 'legacy',

    listRoot() {
      const container = document.querySelector('.js-navigation-container');
      return container && container.querySelector('.js-issue-row') ? container : null;
    },

    rows(root) {
      return root.querySelectorAll('.js-issue-row');
    },

    signals(row) {
      const labels = [...row.querySelectorAll('.IssueLabel, .Label')]
        .map(el => el.textContent.trim());

      // The legacy row spells review state out in text content. It marks drafts
      // differently from the React view and this path can't be exercised while
      // signed in, so draft state is left unknown here rather than guessed at.
      return { labels, review: row.textContent || '', draft: false };
    }
  };

  // The React list (react-app[app-name="pull-requests"]). Its class names are
  // CSS-module hashes — PullsListItem-module__listItem__CSciQ — and the hash
  // suffix changes on every GitHub deploy, so match on the stable module-name
  // prefix only. Never hard-code the hash.
  const NEW_ADAPTER = {
    name: 'react',

    listRoot() {
      const ul = document.querySelector('ul[class*="ListView-module__ul"]');
      if (!ul || !ul.querySelector('li[class*="PullsListItem-module__listItem"]')) {
        return null;
      }
      // Observe the container rather than the <ul>: pagination and filtering
      // swap the whole list out, which would orphan an observer bound to the ul.
      return ul.closest('[class*="SharedListContainer-module__listContainer"]') || ul;
    },

    rows(root) {
      return root.querySelectorAll('li[class*="PullsListItem-module__listItem"]');
    },

    signals(row) {
      // Each label is a filter button wrapping a token; the accessible name is
      // "Filter by label <name>". The trailing space matters — it excludes the
      // toolbar's own "Filter by label" quick-filter button.
      let labels = [...row.querySelectorAll('[aria-label^="Filter by label "]')]
        .map(el => el.textContent.trim());

      if (labels.length === 0) {
        labels = [...row.querySelectorAll('[class*="prc-Token-IssueLabel"]')]
          .map(el => el.textContent.trim());
      }

      // Review state lives only in this icon ("· Approved", "· Review required",
      // "· Changes requested"), and is absent entirely when no review exists.
      // Read it from the icon rather than the row: a PR *titled* e.g. "Approved
      // vendor list" would otherwise match on row-wide text.
      const icon = row.querySelector('[data-testid="review-decision-icon"]');
      const review = icon ? icon.textContent.replace(/^[·\s]+/, '').trim() : '';

      // A draft can be approved, but GitHub still refuses to merge it, so it is
      // never "ready".
      const draft = !!row.querySelector('[aria-label="Draft pull request"]');

      return { labels, review, draft };
    }
  };

  const ADAPTERS = [NEW_ADAPTER, LEGACY_ADAPTER].filter(Boolean);

  function detectAdapter() {
    for (const adapter of ADAPTERS) {
      const root = adapter.listRoot();
      if (root) return { adapter, root };
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Shared predicate — identical rules for both views
  // ---------------------------------------------------------------------------

  function hasBlockingLabel({ labels }) {
    return labels.some(text => {
      const lower = text.toLowerCase();
      return BLOCKING_LABELS.some(blocking => lower.includes(blocking));
    });
  }

  function hasApprovedStatus({ review }) {
    return /approved/i.test(review);
  }

  function hasBlockingReviewStatus({ review }) {
    return /changes requested|review required/i.test(review);
  }

  function isPRReadyToMerge(signals) {
    return !signals.draft &&
           !hasBlockingLabel(signals) &&
           !hasBlockingReviewStatus(signals) &&
           hasApprovedStatus(signals);
  }

  // ---------------------------------------------------------------------------
  // Review requests and changes requested
  //
  // Neither list view puts requested reviewers or the author's identity on the
  // row in a form we can rely on (the avatar stack is assignees), so ask GitHub
  // instead: fetch this repo's list filtered by a search query and read the PR
  // numbers out of the JSON the React list embeds in the server-rendered page.
  // The request is same-origin, so it carries the signed-in session like any
  // other page load.
  // ---------------------------------------------------------------------------

  const MAX_QUERY_PAGES = 5;

  const REVIEW_REQUESTED_QUERY = 'is:pr is:open review-requested:@me';
  // Your own PRs with a changes-requested review. The qualifier is spelled with
  // an underscore; `changes-requested` is not recognised by GitHub search.
  const CHANGES_REQUESTED_QUERY = 'is:pr is:open author:@me review:changes_requested';

  // PR numbers awaiting the current user's review, or null until known.
  let reviewRequested = null;
  // The current user's PRs that have changes requested, or null until known.
  let changesRequested = null;
  // Bumped on every start/stop so a fetch that outlives its page is discarded.
  let queryGeneration = 0;

  function currentUser() {
    return document.querySelector('meta[name="user-login"]')?.content || '';
  }

  function queryURL(query, page = 1) {
    const url = new URL(location.pathname, location.origin);
    url.searchParams.set('q', query);
    if (page > 1) url.searchParams.set('page', page);
    return url;
  }

  async function fetchQueryPage(query, page) {
    const response = await fetch(queryURL(query, page), { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
    const data = doc.querySelector('script[data-target="react-app.embeddedData"]');
    const content = data && JSON.parse(data.textContent).payload?.repoPullsDashboardContentRoute;
    if (!content?.results) throw new Error(`payload not found for "${query}"`);
    return content;
  }

  async function fetchPRNumbers(query) {
    const numbers = new Set();
    for (let page = 1; page <= MAX_QUERY_PAGES; page++) {
      const content = await fetchQueryPage(query, page);
      content.results.forEach(pr => numbers.add(pr.number));
      if (page >= content.totalPages) break;
    }
    return numbers;
  }

  // Each set loads independently: one failing (best effort — merge-ready
  // highlighting doesn't depend on either) never discards the other.
  async function loadQuery(query, generation, assign) {
    let numbers;
    try {
      numbers = await fetchPRNumbers(query);
    } catch (err) {
      console.warn(`[PR Highlighter] could not load "${query}":`, err);
      return;
    }
    if (generation !== queryGeneration) return;
    assign(numbers);
    highlightMergeReadyPRs();
  }

  function loadUserQueries() {
    const generation = ++queryGeneration;
    reviewRequested = null;
    changesRequested = null;
    if (!currentUser()) return;

    loadQuery(REVIEW_REQUESTED_QUERY, generation, n => { reviewRequested = n; });
    loadQuery(CHANGES_REQUESTED_QUERY, generation, n => { changesRequested = n; });
  }

  function prNumber(row) {
    const link = row.querySelector('a[href*="/pull/"]');
    const match = link && link.getAttribute('href').match(/\/pull\/(\d+)/);
    return match ? Number(match[1]) : null;
  }

  function isReviewRequested(row) {
    return !!reviewRequested && reviewRequested.has(prNumber(row));
  }

  function hasChangesRequested(row) {
    return !!changesRequested && changesRequested.has(prNumber(row));
  }

  // ---------------------------------------------------------------------------
  // Notification bar
  // ---------------------------------------------------------------------------

  // Cached so a repeat pass with an unchanged count performs no DOM write at
  // all. The observer watches an ancestor of the bar, so an unconditional
  // innerHTML rewrite here would retrigger the observer forever.
  let lastRenderedKey = null;

  function createNotificationBar() {
    let bar = document.getElementById('merge-ready-notification');

    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'merge-ready-notification';
      bar.className = 'merge-ready-notification';

      const container = document.querySelector('.application-main') ||
                        document.querySelector('main') ||
                        document.body;
      container.insertBefore(bar, container.firstChild);
    }

    return bar;
  }

  function updateNotificationBar(count, reviewCount, changesCount) {
    const key = `${count}/${reviewCount}/${changesCount}`;
    if (key === lastRenderedKey && document.getElementById('merge-ready-notification')) {
      return;
    }
    lastRenderedKey = key;

    const bar = createNotificationBar();
    const reviewText = reviewCount > 0
      ? `<span class="notification-review"><strong>${reviewCount}</strong> awaiting your review</span>`
      : '';
    // A link rather than a plain count: your PRs needing fixes may be on another
    // page of the list, and the filtered view shows all of them.
    const changesText = changesCount > 0
      ? `<a class="notification-changes" href="${queryURL(CHANGES_REQUESTED_QUERY)}"><strong>${changesCount}</strong> of yours ${changesCount === 1 ? 'needs' : 'need'} changes</a>`
      : '';

    if (count > 0) {
      bar.innerHTML = `
      <div class="notification-content">
        <svg class="notification-icon" viewBox="0 0 16 16" width="16" height="16">
          <path fill="currentColor" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"></path>
        </svg>
        <span class="notification-text">
          <strong>${count}</strong> ${count === 1 ? 'pull request is' : 'pull requests are'} ready to merge
        </span>
        ${reviewText}
        ${changesText}
      </div>
    `;
    } else {
      bar.innerHTML = `
      <div class="notification-content">
        <svg class="notification-icon" viewBox="0 0 16 16" width="16" height="16">
          <path fill="currentColor" d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8z"></path>
        </svg>
        <span class="notification-text">No pull requests ready to merge</span>
        ${reviewText}
        ${changesText}
      </div>
    `;
    }

    bar.classList.add('visible');
  }

  function removeNotificationBar() {
    document.getElementById('merge-ready-notification')?.remove();
    lastRenderedKey = null;
  }

  // ---------------------------------------------------------------------------
  // Highlighting
  // ---------------------------------------------------------------------------

  // Set while we are writing to the DOM, so our own mutations don't schedule
  // another pass.
  let applying = false;

  function highlightMergeReadyPRs() {
    const found = detectAdapter();

    if (!found) {
      // List not on the page (or not mounted yet) — leave any existing bar alone
      // rather than flashing "0 ready" during a React remount.
      return false;
    }

    const rows = found.adapter.rows(found.root);
    if (rows.length === 0) return false;

    applying = true;
    let readyCount = 0;
    let reviewCount = 0;
    let changesCount = 0;

    try {
      rows.forEach(row => {
        const ready = isPRReadyToMerge(found.adapter.signals(row));
        // A PR can be both approved and still waiting on you. Ready wins the
        // row styling (it's mergeable without you); both are still counted.
        const review = isReviewRequested(row);
        // Changes requested blocks merging, so it never overlaps ready. It can
        // overlap review when a team you're on is requested on your own PR;
        // changes wins there, since only you can unblock it.
        const changes = hasChangesRequested(row);
        row.classList.toggle(ROW_FLAG, ready);
        row.classList.toggle(CHANGES_FLAG, changes && !ready);
        row.classList.toggle(REVIEW_FLAG, review && !ready && !changes);
        row.setAttribute(SEEN_ATTR, '');
        if (ready) readyCount++;
        if (review) reviewCount++;
        if (changes) changesCount++;
      });

      updateNotificationBar(readyCount, reviewCount, changesCount);
    } finally {
      applying = false;
    }

    return true;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  function isPullsPage() {
    return /^\/[^/]+\/[^/]+\/pulls\/?$/.test(location.pathname);
  }

  let observer = null;
  let observedRoot = null;
  let debounceTimer = null;

  function schedulePass() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      highlightMergeReadyPRs();
      attachObserver();
    }, 300);
  }

  function attachObserver() {
    const found = detectAdapter();
    if (!found || found.root === observedRoot) return;

    observer?.disconnect();
    observedRoot = found.root;
    observer = new MutationObserver(() => {
      if (applying) return;
      schedulePass();
    });
    observer.observe(observedRoot, { childList: true, subtree: true });
  }

  function detachObserver() {
    observer?.disconnect();
    observer = null;
    observedRoot = null;
  }

  // The React list mounts after document_idle, so poll briefly for it instead of
  // betting on a single fixed delay.
  function waitForList(attempt = 0) {
    if (highlightMergeReadyPRs()) {
      attachObserver();
      return;
    }
    if (attempt < 20) {
      setTimeout(() => waitForList(attempt + 1), 250);
    }
  }

  function start() {
    if (!isPullsPage()) return;
    waitForList();
    loadUserQueries();
  }

  function stop() {
    detachObserver();
    clearTimeout(debounceTimer);
    queryGeneration++;
    reviewRequested = null;
    changesRequested = null;
    removeNotificationBar();
    document.querySelectorAll(`.${ROW_FLAG}, .${REVIEW_FLAG}, .${CHANGES_FLAG}`)
      .forEach(el => el.classList.remove(ROW_FLAG, REVIEW_FLAG, CHANGES_FLAG));
  }

  // GitHub navigates client-side, so the script is injected once and then has to
  // notice the URL changing under it.
  let lastPath = location.pathname;

  function onNavigate() {
    if (location.pathname === lastPath) return;
    lastPath = location.pathname;
    stop();
    start();
  }

  for (const method of ['pushState', 'replaceState']) {
    const original = history[method];
    history[method] = function (...args) {
      const result = original.apply(this, args);
      queueMicrotask(onNavigate);
      return result;
    };
  }
  window.addEventListener('popstate', onNavigate);
  document.addEventListener('turbo:load', onNavigate);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
