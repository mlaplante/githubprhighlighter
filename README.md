# GitHub PR Merge Ready Highlighter

A Chrome extension that visually highlights pull requests that are ready to be merged on GitHub.

## Features

- **Notification Bar**: A sticky notification bar at the top of the page shows how many PRs are ready to merge
- **Visual Highlighting**: PRs ready to merge are highlighted with a green background gradient and left border
- **Ready Badge**: A "✓ Ready" badge appears on merge-ready PRs
- **Your Review Requests**: PRs awaiting *your* review get an amber highlight and a "● Your review" badge, and the notification bar shows how many are on the page
- **Your PRs With Changes Requested**: your own open PRs that a reviewer has requested changes on get a rose highlight and a "✎ Needs your fixes" badge, and the notification bar shows a count that links to the filtered list of all of them
- **Works with both GitHub PR list views**: supports the new React list and the older Rails-rendered list, detected at runtime
- **Survives client-side navigation**: re-applies when you move between GitHub pages without a full reload
- **Lightweight & Fast**: Optimized for performance with minimal resource usage
- **Smart Detection**: Automatically detects PRs that:
  - MUST have "Approved" status
  - Are NOT draft pull requests (GitHub refuses to merge a draft even when approved)
  - Do NOT have "Review required" status
  - Do NOT have "Changes requested" status
  - Do NOT have blocking labels like "Don't Merge", "WIP", or "Work in progress"
  - Note: "Needs More Reviews" is treated as informational and does NOT block highlighting
- **Real-time Updates**: Uses MutationObserver with intelligent debouncing to detect changes without slowing down the page

## Installation

### Loading the Extension in Chrome

1. **Download/Clone** this repository to your local machine

2. **Open Chrome Extensions Page**:
   - Navigate to `chrome://extensions/`
   - Or click the three dots menu → More Tools → Extensions

3. **Enable Developer Mode**:
   - Toggle the "Developer mode" switch in the top right corner

4. **Load the Extension**:
   - Click "Load unpacked"
   - Select the `github-pr-highlighter` folder

5. **Verify Installation**:
   - You should see the extension with a green checkmark icon
   - The extension is now active!

## Usage

1. Navigate to any GitHub repository's Pull Requests page (e.g., `https://github.com/owner/repo/pulls`)

2. The extension automatically runs and displays:
   - **Notification Bar**: A green bar at the top showing the count of merge-ready PRs (e.g., "3 pull requests are ready to merge")
   - **Highlighted PRs**: Each merge-ready PR is highlighted with:
     - Green background gradient
     - Green left border (4px)
     - "✓ Ready" badge in the top right
   - **Review-requested PRs**: Each open PR where you're a requested reviewer is highlighted with an amber background, amber left border, and a "● Your review" badge. If a PR is both merge-ready and waiting on you, the green ready styling wins (it's counted in both totals)
   - **Your PRs with changes requested**: Each of your own open PRs (drafts included) with a changes-requested review is highlighted with a rose background, rose left border, and a "✎ Needs your fixes" badge. The "N of yours need changes" pill in the notification bar links to `is:pr is:open author:@me review:changes_requested`, so PRs on other pages of the list are one click away

3. **Requirements for highlighting** - PRs will ONLY be highlighted if they meet ALL criteria:
   - ✓ Have "Approved" status
   - ✗ Do NOT have "Review required" status
   - ✗ Do NOT have "Changes requested" status
   - ✗ Do NOT have blocking labels: "Don't Merge", "Needs More Review", "WIP", etc.

4. The notification bar and highlights update automatically as you interact with the page

## Customization

You can customize the blocking labels by editing `content.js`:

```javascript
const BLOCKING_LABELS = [
  'dont merge',
  'needs more review',
  'wip',
  // Add your custom labels here
];
```

You can also customize the highlight styling in `styles.css`:

```css
.merge-ready-pr {
  background: /* your color gradient */;
  border-left: /* your border style */;
}
```

## Technical Details

### Files

- **manifest.json**: Extension configuration and permissions
- **content.js**: Main logic for detecting and highlighting merge-ready PRs
- **styles.css**: Styling for highlighted PRs
- **icon*.png**: Extension icons in various sizes

### Permissions

- `activeTab`: Access to the current tab
- `https://github.com/*`: Access to GitHub pages

### Browser Support

- Chrome (Manifest V3)
- Other Chromium-based browsers (Edge, Brave, etc.)

## Troubleshooting

**Extension not working?**
- Refresh the GitHub PR page after installation
- Check that the extension is enabled in `chrome://extensions/`
- Make sure you're on a GitHub Pull Requests list page

**PRs not highlighting?**
- Verify the PR doesn't have blocking labels
- Check that the PR doesn't have "Review required" status
- GitHub's DOM structure may have changed - open an issue if problems persist

### How the two views are supported

GitHub serves two different PR-list markups depending on the account and rollout
state, so `content.js` detects which one is present instead of assuming either:

| | New (React) view | Legacy view |
|---|---|---|
| List root | `[class*="SharedListContainer-module__listContainer"]` | `.js-navigation-container` |
| Row | `li[class*="PullsListItem-module__listItem"]` | `.js-issue-row` |
| Labels | `[aria-label^="Filter by label "]` | `.IssueLabel, .Label` |
| Review state | `[data-testid="review-decision-icon"]` | row text |
| Draft | `[aria-label="Draft pull request"]` | not detected (see below) |

The React view's class names are CSS-module hashes such as
`PullsListItem-module__listItem__CSciQ`. **The hash suffix changes on every
GitHub deploy**, so selectors match the stable module-name prefix with `class*=`
and must never hard-code the hash.

The legacy adapter's draft check is a deliberate no-op: that view marks drafts
differently, and it cannot be exercised while signed in (GitHub serves the React
view to logged-in users), so no unverified selector is guessed at there. The rest
of the legacy adapter preserves the previous behavior verbatim.

Review requests are not shown on list rows in either view, so the extension
fetches the same repo's PR list with `is:pr is:open review-requested:@me`
(up to 5 pages) and reads PR numbers from the JSON GitHub embeds in that page
(`script[data-target="react-app.embeddedData"]` →
`payload.repoPullsDashboardContentRoute.results[].number`). The fetch is
same-origin, so it uses your signed-in session; when signed out it is skipped.
`review-requested:` also matches requests made to a team you're on; switch the
query to `user-review-requested:@me` in `content.js` to limit it to direct
requests.

Your own PRs with changes requested are found the same way, with a second fetch
for `is:pr is:open author:@me review:changes_requested` (note the underscore —
GitHub search does not recognise `changes-requested`). The two fetches load and
fail independently. Changes requested blocks merging, so those rows are never
also "ready"; if one of your PRs is also in the review-requested set (a team you
belong to was requested on it), the rose changes-requested styling wins.

In the React view the review decision exists *only* inside
`[data-testid="review-decision-icon"]` ("Approved" / "Review required" /
"Changes requested"), and is absent entirely when a PR has no reviews. It is read
from that icon rather than from the row's text so a PR whose title happens to
contain the word "approved" is not mistaken for an approved PR.

## Contributing

Feel free to submit issues or pull requests to improve the extension!

## License

MIT License - feel free to use and modify as needed.
