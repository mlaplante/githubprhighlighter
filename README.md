# GitHub PR Merge Ready Highlighter

A Chrome extension that visually highlights pull requests that are ready to be merged on GitHub.

## Features

- **Notification Bar**: A sticky notification bar at the top of the page shows how many PRs are ready to merge
- **Visual Highlighting**: PRs ready to merge are highlighted with a green background gradient and left border
- **Ready Badge**: A "✓ Ready" badge appears on merge-ready PRs
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

In the React view the review decision exists *only* inside
`[data-testid="review-decision-icon"]` ("Approved" / "Review required" /
"Changes requested"), and is absent entirely when a PR has no reviews. It is read
from that icon rather than from the row's text so a PR whose title happens to
contain the word "approved" is not mistaken for an approved PR.

## Contributing

Feel free to submit issues or pull requests to improve the extension!

## License

MIT License - feel free to use and modify as needed.
