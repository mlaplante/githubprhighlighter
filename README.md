# GitHub PR Merge Ready Highlighter

A Chrome extension that visually highlights pull requests that are ready to be merged on GitHub.

## Features

- **Notification Bar**: A sticky notification bar at the top of the page shows how many PRs are ready to merge
- **Visual Highlighting**: PRs ready to merge are highlighted with a green background gradient and left border
- **Ready Badge**: A "✓ Ready" badge appears on merge-ready PRs
- **Smart Detection**: Automatically detects PRs that:
  - MUST have "Approved" status
  - Do NOT have "Review required" status
  - Do NOT have "Changes requested" status
  - Do NOT have blocking labels like "Don't Merge", "WIP", or "Work in progress"
  - Note: "Needs More Reviews" is treated as informational and does NOT block highlighting
- **Real-time Updates**: Uses MutationObserver to detect dynamically loaded content and updates the count automatically
- **Debug Logging**: Check browser console (F12) for detailed detection information per PR

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

5. **Troubleshooting**: Open browser console (F12) to see debug logs showing why each PR is or isn't highlighted

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

## Contributing

Feel free to submit issues or pull requests to improve the extension!

## License

MIT License - feel free to use and modify as needed.
