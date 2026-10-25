# Interactive Museum Exhibit

An interactive digital exhibit showcasing a rare 1896 cabinet card photograph of James J. "Gentleman Jim" Corbett, the heavyweight boxing champion. Built with HTML5, CSS3, and vanilla JavaScript.

## Features

- **3D Card Flip Animation**: Smoothly flip between the front photograph and the reverse biographical text
- **Interactive Hotspots**: Transparent polygon overlays highlight specific regions; hover or click to explore
- **Museum Curator Panel**: Instant updates with historical narratives and external resource links
- **Fully Responsive**: Adapts beautifully from desktop monitors to tablets
- **Keyboard Accessible**: All hotspots are focusable with visible focus states and ARIA labels
- **Reduced Motion Support**: Respects user preferences for reduced animations
- **Static Build**: No frameworks, no build step, no npm—100% GitHub Pages compatible

## Quick Start

1. Clone or download this repository
2. Serve the files with any static server:

```bash
# Python 3
python3 -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000

# Node.js (if http-server is installed)
npx http-server
```

3. Open `http://localhost:8000` in your browser

## Project Structure

```
museum-exhibit-demo/
├── index.html          # Main HTML file
├── css/
│   └── styles.css      # All styles, including responsive breakpoints
├── js/
│   └── app.js          # Application logic (vanilla JavaScript)
├── data/
│   └── hotspots.js     # Hotspot definitions with coordinates
├── assets/
│   └── images/
│       └── corbett-front.jpg   # Cabinet card photograph
└── README.md
```

## Adding New Hotspots

### Using Edit Mode (Recommended)

1. Add `?edit=1` to the URL (e.g., `http://localhost:8000/?edit=1`)
2. A red banner will appear indicating Edit Mode is active
3. Click points on the image to define your polygon region
4. Press `C` to copy the coordinate array to your clipboard
5. Press `R` to reset and start over
6. Add the new hotspot to `data/hotspots.js`

### Manual Entry

Each hotspot in `data/hotspots.js` follows this structure:

```javascript
{
  id: 'unique-id',           // Unique identifier
  side: 'front',             // 'front' or 'reverse'
  title: 'Hotspot Title',    // Display title
  polygon: [                 // Array of [x, y] coordinates
    [100, 100],              // Top-left
    [200, 100],              // Top-right
    [200, 200],              // Bottom-right
    [100, 200]               // Bottom-left
  ],
  narrative: `<p>HTML content for the curator panel.</p>`,
  link: {
    url: 'https://example.com',
    label: 'External Resource'
  }
}
```

### Coordinate System

- **Front side viewBox**: 807 × 1024 pixels (matches image dimensions)
- **Reverse side viewBox**: 807 × 1024 pixels
- Coordinates are relative to the viewBox, so hotspots scale automatically at any size

## Keyboard Navigation

| Key | Action |
|-----|--------|
| `Tab` | Move focus between hotspots |
| `Enter` / `Space` | Select focused hotspot |
| `Escape` | Close contact modal |

## Accessibility

- Skip link for keyboard users
- All interactive elements have focus indicators
- ARIA labels on hotspots and interactive regions
- `aria-pressed` state on flip button
- `prefers-reduced-motion` media query respected
- Semantic HTML structure

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Image Credits

**Front Image**: [James J. Corbett by Elmer Chickering](https://www.loc.gov/item/96516350/)  
Library of Congress, Prints & Photographs Division, LC-USZ62-116944  
Cabinet card, c. 1896  
**License**: No known copyright restrictions (Public Domain)

**Reverse Side**: Demo reconstruction created for this exhibit. The historical facts presented are accurate; the typeset layout is a modern interpretation of period printing styles. The reverse is labeled as a reconstruction in the exhibit footer.

## Deploying to GitHub Pages

### Option 1: GitHub Actions (Automated)

This repository includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that automatically deploys to GitHub Pages when you push to the `main` branch.

To enable:
1. Go to your repository Settings → Pages
2. Under "Build and deployment", select "GitHub Actions" as the source
3. Push to `main` and the workflow will deploy automatically

### Option 2: Manual Setup

1. Go to your repository Settings → Pages
2. Under "Build and deployment", select "Deploy from a branch"
3. Choose `main` branch and `/ (root)` folder
4. Click Save

The site will be available at `https://<username>.github.io/<repository>/`

## Local Development

The exhibit requires no build process. Simply edit the HTML, CSS, or JavaScript files and refresh your browser.

For live reload during development, you can use:

```bash
# Using browser-sync (if installed)
npx browser-sync start --server --files "**/*"

# Or use VS Code's Live Server extension
```

## License

The code in this repository is available under the MIT License. The historical photograph is in the public domain.
