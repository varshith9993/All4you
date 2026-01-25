# Signup Page - New Layout

## Visual Structure

```
┌─────────────────────────────────────────────┐
│  📧 Email Signup Form                       │
├─────────────────────────────────────────────┤
│                                             │
│  👤 Username                                │
│  📧 Email                                   │
│  🔒 Password                                │
│                                             │
│  [Get Location] [Pin on Map]               │
│                                             │
│  📍 Area / Place                            │
│  📍 Landmark (Optional)                     │
│  📍 City                                    │
│  📍 Pincode                                 │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ 📍 Country (Auto-detected)          │   │ ← READ-ONLY
│  │ India                               │   │   (Gray, Disabled)
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ Show posts from:                    │   │ ← NEW!
│  │                                     │   │
│  │ ● India Only                        │   │ ← Radio Button
│  │   See posts only from your country  │   │   (Green when selected)
│  │                                     │   │
│  │ ○ Around the World                  │   │ ← Radio Button
│  │   See posts from all countries      │   │   (Indigo when selected)
│  └─────────────────────────────────────┘   │
│                                             │
│  Latitude        Longitude                 │
│  [12.9716]       [77.5946]                 │
│                                             │
│  💡 Tip: For better location accuracy...   │
│                                             │
│  ☑ I accept Terms and Privacy Policy       │
│                                             │
│  [Sign Up]                                 │
│                                             │
└─────────────────────────────────────────────┘
```

## Field Order (Top to Bottom)

1. **Username** - Text input
2. **Email** - Email input
3. **Password** - Password input with show/hide
4. **Location Buttons** - Get Location / Pin on Map
5. **Area/Place** - Text input
6. **Landmark** - Text input (optional)
7. **City** - Text input
8. **Pincode** - Text input
9. **Country** - READ-ONLY input (auto-detected) ⭐ MOVED HERE
10. **Content Scope** - Radio buttons (NEW!) ⭐
11. **Latitude** - Text input
12. **Longitude** - Text input
13. **Location Tip** - Info box
14. **Terms Checkbox** - Checkbox with links
15. **Sign Up Button** - Submit button

## Key Changes

### ✅ Country Field
- **Position**: Between Pincode and Content Scope
- **Style**: Gray background, disabled cursor
- **Value**: Auto-detected (e.g., "India")
- **Editable**: NO (read-only)

### ✅ Content Scope Radio Buttons (NEW!)
- **Position**: Between Country and Lat/Long
- **Style**: Gradient box (indigo-purple)
- **Options**:
  1. **Local** (default)
     - Label: "{Country} Only"
     - Description: "See posts only from your country"
     - Color: Green when selected
  2. **Global**
     - Label: "Around the World"
     - Description: "See posts from all countries"
     - Color: Indigo when selected

### ✅ Latitude/Longitude
- **Position**: After Content Scope
- **Style**: Two columns, gray background
- **Editable**: YES (can be manually adjusted)

## Radio Button Behavior

### When "Local" is Selected:
```
┌─────────────────────────────────────────┐
│ ● India Only                    ✓       │ ← Green border & background
│   See posts only from your country      │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ ○ Around the World                      │ ← Gray border, white background
│   See posts from all countries          │
└─────────────────────────────────────────┘
```

### When "Global" is Selected:
```
┌─────────────────────────────────────────┐
│ ○ India Only                            │ ← Gray border, white background
│   See posts only from your country      │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ ● Around the World              ✓       │ ← Indigo border & background
│   See posts from all countries          │
└─────────────────────────────────────────┘
```

## Data Flow

1. **User opens signup page**
   - Country auto-detects via IP (ipapi.co)
   - Country field shows detected country (read-only)
   - Content scope defaults to "local"

2. **User fills form**
   - Can click "Get Location" or "Pin on Map"
   - Can choose content scope (local or global)
   - Cannot change country

3. **User submits**
   - Profile created with:
     - `country`: Auto-detected value (FIXED)
     - `countryScope`: Selected value ("local" or "global")

4. **After signup**
   - User's country is UNCHANGEABLE
   - User can change contentScope in Settings
   - User sees posts based on contentScope

## CSS Classes

### Country Field (Read-only):
```css
bg-gray-100          /* Gray background */
cursor-not-allowed   /* Not-allowed cursor */
text-gray-600        /* Gray text */
font-medium          /* Medium font weight */
```

### Content Scope Box:
```css
bg-gradient-to-br from-indigo-50 to-purple-50  /* Gradient */
border border-indigo-100                        /* Border */
p-4 rounded-xl                                  /* Padding & radius */
```

### Radio Option (Selected):
```css
/* Local */
border-green-500 bg-green-50

/* Global */
border-indigo-500 bg-indigo-50
```

### Radio Option (Not Selected):
```css
border-gray-200 bg-white hover:border-{color}-300
```

## Responsive Design

- Mobile: Full width, stacked layout
- Desktop: Same layout (max-width container)
- Radio buttons: Full width on all screens
- Touch-friendly tap targets (p-3)

## Accessibility

- Clear labels for all fields
- Radio buttons with proper name attribute
- Disabled state for read-only country
- Visual feedback on selection
- Descriptive text for each option
