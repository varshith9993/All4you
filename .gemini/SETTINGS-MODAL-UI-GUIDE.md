# Settings - Content Region Modal UI

## Visual Structure

```
┌─────────────────────────────────────────────┐
│  Choose Content Region                      │
│  Select which posts you want to see         │
│  (Purple gradient header)                   │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  🗺️  India Only              ✓      │   │ ← Selected (Green)
│  │  See posts only from India.         │   │
│  │  Perfect for finding local          │   │
│  │  services and workers nearby.       │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  🌍  Around the World               │   │ ← Not selected (Gray)
│  │  See posts from all countries.      │   │
│  │  Explore services and               │   │
│  │  opportunities worldwide.           │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ⚠️ The app will reload to apply changes   │ ← Warning (Yellow box)
│                                             │
├─────────────────────────────────────────────┤
│  [ Cancel ]  [ Apply Changes ]              │
└─────────────────────────────────────────────┘
```

## Behavior

### When User Opens Modal:
1. Current selection is highlighted (green for local, indigo for global)
2. Checkmark (✓) appears next to current selection
3. Icon changes based on selection (🗺️ for local, 🌍 for global)

### When User Clicks an Option:
1. Selection updates immediately (visual feedback)
2. If different from current, warning message appears
3. "Apply Changes" button becomes enabled

### When User Clicks "Apply Changes":
1. Saves new scope to database (profiles collection)
2. Shows brief loading state
3. **App reloads automatically** (window.location.reload())
4. User sees content filtered by new scope

### When User Clicks "Cancel":
1. Modal closes
2. No changes are saved
3. pendingScope resets to null

## States

### Local Scope (India Only)
- Icon: 🗺️ (FiMap)
- Color: Green (#10b981)
- Display: "India Only"
- Description: "See posts only from India. Perfect for finding local services and workers nearby."

### Global Scope (Around the World)
- Icon: 🌍 (FiGlobe)
- Color: Indigo (#6366f1)
- Display: "Around the World"
- Description: "See posts from all countries. Explore services and opportunities worldwide."

## Code Flow

```javascript
// 1. User clicks "Content Region" in Settings
onClick={() => setShowScopeConfirm(true)}

// 2. Modal opens with current scope highlighted
{showScopeConfirm && (
  // Modal renders with two options
)}

// 3. User clicks an option
onClick={() => setPendingScope('local')}  // or 'global'

// 4. User clicks "Apply Changes"
onClick={confirmScopeChange}

// 5. Function saves and reloads
const confirmScopeChange = async () => {
  await updateDoc(doc(db, "profiles", user.uid), {
    countryScope: pendingScope
  });
  window.location.reload();  // Auto-reload!
}
```

## Responsive Design

- Mobile: Full width with padding
- Desktop: Max width 28rem (448px)
- Smooth animations (animate-scale-in)
- Touch-friendly button sizes
- Clear visual hierarchy

## Accessibility

- Clear labels and descriptions
- Visual feedback on selection
- Disabled state for "Apply Changes" when no change
- Keyboard accessible (can be enhanced with focus states)
- Color contrast meets WCAG standards

## Error Handling

- Checks if user is authenticated
- Catches database errors
- Shows alert if update fails
- Prevents multiple submissions
- Validates pendingScope before saving
