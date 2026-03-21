# Lumora — UX/UI Design Brief

**Prepared for:** UX/UI Designer
**Project:** Lumora — Event Photo Capture Platform
**Version:** 1.0

---

## 1. Product Overview

**Lumora** is an event photo capture platform. Hosts (event organizers) create events and share a QR code with their guests. Guests scan the code and immediately start capturing photos — no app install, no account required.

The product has two distinct user types with entirely separate experiences:

- **Host** — creates and manages events, moderates photos, exports content
- **Guest** — scans a QR code, enters a name, and immediately starts taking photos

---

## 2. Core Objectives

| Goal | Description |
|------|-------------|
| **Zero friction for guests** | A guest should go from scanning a QR code to capturing a photo in under 30 seconds |
| **Camera-first experience** | The camera is the primary interface for guests — all other actions are secondary |
| **Real-time control for hosts** | Hosts should be able to monitor, moderate, and manage photos live during an event |
| **Mobile-first** | The guest experience is almost exclusively on mobile. The host dashboard should work on both mobile and desktop |

---

## 3. User Roles

### Host
- Signs up with email and password
- Creates events and configures all settings
- Shares a QR code or link with guests
- Moderates photos (approve, reject, hide)
- Views stats and the full event gallery
- Exports approved photos as a ZIP archive
- May be on a free or paid plan (which affects feature limits)

### Guest
- No account — identified only by a generated device ID stored in the browser
- Enters a display name to participate
- Captures photos and optionally adds a title/description
- Can view their own uploads and (if enabled) the shared event gallery
- Cannot access the host dashboard

### Admin (super-user host)
- Has access to a back-office panel
- Manages all users, events, and storage configuration

---

## 4. Plans & Limits

Hosts are on one of five plans. Plans affect what they can configure per event.

| Plan | Max Events | Max Guests/Event | Max Photos/Guest | Storage |
|------|-----------|-----------------|-----------------|---------|
| Free | 1 | 10 | 5 | 100 MB |
| Starter | 1 | 250 | 25 | 2 GB |
| Pro | 3 | 500 | Unlimited | 10 GB |
| Business | 10 | Unlimited | Unlimited | 50 GB |
| Enterprise | Unlimited | Unlimited | Unlimited | 100 GB |

The UI should surface plan limits clearly, especially when a user is approaching or has reached them.

---

## 5. Key Concepts & Terminology

| Term | Meaning |
|------|---------|
| **Event** | A gathering created by a host (e.g., a wedding, party, conference) |
| **Event Code** | A short unique code identifying the event (e.g., `ABCD1234`). Used in the guest URL |
| **Guest Session** | One device's participation in an event. One session per device per event |
| **Moderation Mode** | How photos are handled after upload: *Auto-approve* (instant visibility) or *Approve First* (host review required) |
| **Reveal Delay** | Photos can be hidden from guests until a configured number of hours after the event starts (e.g., for a surprise reveal) |
| **Upload Cutoff** | Uploads can be disabled automatically X hours after the event starts |
| **Hidden** | A photo that the host has manually hidden from the guest gallery (separate from rejection) |
| **Quality Score** | An automatic 0–100 score calculated at upload time, based on blur, exposure, and other factors |

---

## 6. Photo Lifecycle

Understanding how a photo moves through the system is essential for designing the moderation and gallery screens.

```
Guest uploads photo
        ↓
Server processes image (resize, strip EXIF, score quality)
        ↓
    Auto-approve mode?
    ┌──── YES ────┐         ┌──── NO (Approve First) ────┐
    ↓             ↓         ↓                            ↓
Status: APPROVED       Status: PENDING         Host approves → APPROVED
                                                Host rejects → REJECTED
        ↓
    Reveal delay passed?
    ┌──── YES ────┐    ┌──── NO ────┐
    ↓                              ↓
Visible in guest gallery      Hidden until reveal time
        ↓
    Host hides photo?
    ┌──── YES ────┐
    ↓
Removed from guest gallery (hidden flag, not deleted)
```

**Statuses:** `PENDING` → `APPROVED` or `REJECTED`
**Visibility modifiers:** `hidden` flag, `revealAt` timestamp

---

## 7. Screens to Design

Below is the complete list of screens. Each screen description covers its purpose, the information it must communicate, and the actions available.

---

### HOST SCREENS

---

#### H-01 — Sign Up
**Route:** `/host/signup`
**Who sees it:** New hosts

**Purpose:** Register a new host account.

**Required fields:**
- Email address
- Password
- Display name

**Actions:**
- Submit form to create account
- Navigate to login

**Notes:**
- After successful signup, redirect to the event list (H-03)
- Show inline validation errors (empty fields, invalid email, weak password)

---

#### H-02 — Log In
**Route:** `/host/login`
**Who sees it:** Returning hosts

**Purpose:** Authenticate an existing host.

**Required fields:**
- Email
- Password

**Actions:**
- Submit to log in
- Navigate to sign up
- (Optional) Forgot password flow

**Notes:**
- On success, redirect to event list (H-03)
- Show error for invalid credentials

---

#### H-03 — Event List (Dashboard Home)
**Route:** `/host`
**Who sees it:** Authenticated hosts

**Purpose:** Overview of all events created by this host. The home screen after login.

**Information displayed per event:**
- Event title
- Event icon (if set)
- Date & time of event
- Total photo count
- Total guest count
- Status: Active / Inactive
- Moderation mode: Auto-approve / Approve first

**Actions:**
- Create a new event (navigates to H-04)
- Open an event (navigates to H-05)

**States:**
- Loading
- Empty (no events yet) — should have a clear call-to-action to create the first event
- Plan limit reached — create button disabled with explanation

---

#### H-04 — Create Event
**Route:** `/host/events/new`
**Who sees it:** Authenticated hosts

**Purpose:** Configure and launch a new event.

**Form sections and fields:**

**Event Identity**
- Event title (required)
- Event icon/image (optional, upload)
- Date & time (required)
- Timezone (auto-detected, editable)

**Theme**
- Choose from 4 visual themes that affect the guest camera screen
- Themes: Classic, Minimal, Vibrant, Dark

**Photo Settings**
- Reveal delay (hours, 0 = immediate)
- Upload cutoff (hours after event start, 0 = no cutoff)
- Max photos per guest (1–100, plan-capped)
- Max total photos for the event (10–10,000)
- Max storage for the event (50–10,000 MB, plan-capped)
- Moderation mode: Auto-approve / Approve first
- Guest gallery: Enabled / Disabled

**Actions:**
- Submit to create event → navigates to H-05 (Event Dashboard)
- Cancel / go back

**States:**
- Loading/saving state on submit
- Validation errors inline
- Success → redirect

---

#### H-05 — Event Dashboard
**Route:** `/host/events/:eventId`
**Who sees it:** Authenticated host (event owner)

**Purpose:** The command center for a single event. Real-time overview of what's happening.

**Information displayed:**

*Stats (live, auto-refreshes every 10 seconds):*
- Total photos uploaded
- Storage used vs. limit
- Total guests
- Approved photos count
- Pending photos count
- Hidden photos count
- Rejected photos count

*QR Code & Sharing:*
- QR code image
- Event code (short text, e.g., `ABCD1234`)
- Full guest URL (copyable)

*Event Summary:*
- Active / Inactive status
- Event date & time
- Reveal delay setting
- Max photos per guest
- Moderation mode
- Guest gallery status (enabled/disabled)
- Top contributors (top 5 guests by photo count with their names)

**Actions:**
- Navigate to Moderation (H-06)
- Navigate to Gallery (H-07)
- Navigate to Settings (H-08)
- Navigate to Export (H-09)
- Copy event URL
- (Optional) Share QR code

**Notifications:**
- Toast/alert when new photos arrive since last refresh

**States:**
- Loading
- Event not found / error

---

#### H-06 — Photo Moderation
**Route:** `/host/events/:eventId/moderation`
**Who sees it:** Authenticated host

**Purpose:** Review, approve, reject, and manage individual photos. This is the primary work screen during a live event.

**Filter bar (tabs or pills):**
- All
- Pending
- Approved
- Low Quality (quality score < 50)
- Hidden
- Rejected

**Photo grid:**
Each photo card shows:
- Thumbnail image
- Guest name & upload timestamp
- Status badge (Pending / Approved / Rejected / Hidden)
- Quality score badge (color-coded: green ≥70, yellow 40–69, red <40)
- Quality issue tags if any (e.g., "Blurry", "Too dark", "Overexposed")
- Photo title / description (if the guest provided one)
- Individual action buttons (vary by status):
  - **If Pending:** Approve + Reject
  - **Always available:** Hide / Show (toggle)

**Bulk selection mode:**
- Toggle to enter selection mode
- Select individual photos or select all
- Bulk actions: Approve, Reject, Hide, Delete
- Show count of selected items
- Exit selection mode

**Lightbox (click any photo to open):**
- Large image view
- Guest name, status, timestamp
- Same action buttons as the card
- Navigate between photos with arrows

**Auto-refresh:** Every 10 seconds; pauses in selection mode
**New photo notification:** Alert/toast showing count of new arrivals

**States:**
- Loading
- Empty (no photos match current filter)

---

#### H-07 — Host Gallery View
**Route:** `/host/events/:eventId/gallery`
**Who sees it:** Authenticated host

**Purpose:** Browse all photos from an event in a clean gallery layout. Less action-oriented than moderation — more for review and enjoyment.

**Controls:**
- Toggle to show/hide hidden photos

**Photo grid:**
- All photos (filtered by toggle)
- Click to open lightbox
- Status badges visible

**States:**
- Loading
- Empty

---

#### H-08 — Event Settings
**Route:** `/host/events/:eventId/settings`
**Who sees it:** Authenticated host

**Purpose:** Edit all event configuration after creation.

**Same fields as H-04 (Create Event), plus:**
- **Event Active toggle** — when turned off, guests cannot join or upload
- **Delete Event** — destructive action, requires confirmation
  - Confirmation text: deleting permanently removes all photos, guest sessions, and exports

**Feedback:**
- Success message on save
- Inline errors on validation failure
- Confirmation dialog before delete

---

#### H-09 — Export
**Route:** `/host/events/:eventId/export`
**Who sees it:** Authenticated host

**Purpose:** Generate and download a ZIP file of all approved photos.

**Actions:**
- Create new export (triggers background ZIP generation)
- Download completed export

**Export list:**
Each export entry shows:
- Creation timestamp
- Photo count included
- Status: Pending / Processing / Completed / Failed
- Download button (only when Completed)

**States:**
- No exports yet (empty)
- Processing (disable create button, show progress)
- Completed (show download link)
- Failed (show error, allow retry)

**Polling:** Status refreshes every 3 seconds while exports are processing.

---

#### H-10 — Pricing Page
**Route:** `/host/pricing`
**Who sees it:** Authenticated hosts

**Purpose:** Display available plans and their feature limits.

**Information per plan:**
- Plan name
- Price
- Billing type (free / per-event / monthly)
- Max events
- Max guests per event
- Max photos per guest
- Storage limit

**Actions:**
- Upgrade or select a plan (links to payment/contact flow)

---

#### H-11 — Admin Panel
**Route:** `/host/admin`
**Who sees it:** Admin users only

**Purpose:** Back-office management of the entire platform.

**Three sections (tabs):**

**Users Tab**
- Search by email or name
- Filter by plan
- Table: email, name, plan, account creation date, actions
- Actions per user: grant/revoke create-events permission, change plan, delete account

**Events Tab**
- Search by event title
- Filter by plan, date range
- Table: title, host email, plan, guest count, photo count, creation date, status
- Actions: view, delete

**Storage Tab**
- Storage type configuration: Filesystem vs. S3-compatible
- S3 fields: Bucket, Region, Endpoint, Access Key, Secret Key, Public URL, Force Path Style
- Save configuration
- Storage browser: Browse stored files by prefix, view file sizes and dates, delete individual files

---

### GUEST SCREENS

---

#### G-01 — Event Landing / Join
**Route:** `/e/:eventCode`
**Who sees it:** Guests arriving via QR code or shared link

**Purpose:** The entry point for guests. Collect a display name and start the session.

**Two states:**

**New guest (first visit on this device):**
- Event name and icon prominently displayed
- Name input (required)
- Phone number input (optional)
- Primary CTA button: "Open Camera" (disabled until name is entered)

**Returning guest (device has an existing session):**
- Welcome back message
- Existing name displayed
- Photo count ("You've taken 5 photos")
- Continue button (uses existing name)
- Option to change name

**Error state:**
- "This event is not found or is no longer active" — shown if the event code is invalid or the event is inactive

---

#### G-02 — Camera
**Route:** `/e/:eventCode/camera`
**Who sees it:** Guests after joining the event

**Purpose:** The primary guest experience. A full-screen camera interface for capturing photos and short videos.

**Layout:**
- Full-screen camera viewfinder
- Minimal UI overlaid on top
- Large, tap-friendly capture button

**Top bar:**
- Guest's own display name
- Photo/video mode toggle
- Guest's remaining photo count (or count taken vs. limit)

**Bottom controls (Photo mode):**
- Switch between front and rear camera
- Flash toggle (on/off)
- Capture button (center, large)
- "My Photos" button — opens a bottom sheet of the guest's uploads

**Bottom controls (Video mode):**
- Record button (starts/stops, auto-stops at 10 seconds)
- Duration countdown while recording

**Touch interactions:**
- Tap on viewfinder to focus (show focus ring at tap point)

**After capture — Photo Preview screen:**
- Full-screen preview of the captured image
- Optional text fields: Title, Description
- Filter selector (if filters are enabled for this event)
- Action buttons: Retake (back to camera) / Upload
- Upload loading state

**After capture — Video Preview screen:**
- Full-screen video preview with playback
- Optional: Title, Description
- Upload / Retake

**After upload — Success state:**
- Clear success confirmation
- Status message: "Your photo is live!" (auto-approve) or "Your photo is pending review" (approve-first mode)
- Auto-returns to camera after ~3 seconds

**My Photos (bottom sheet):**
- Grid of all photos the guest has uploaded in this session
- Status indicator per photo: Approved (green), Pending (yellow clock), Rejected (red)
- Tap to view full preview

**Closed / Upload cutoff state:**
- Camera is disabled
- Message explaining that uploads have closed
- Guest can still navigate to gallery (if enabled)

**Error states:**
- Camera permission denied → explain and offer retry
- Photo limit reached → message explaining the limit, camera disabled
- Event storage full → upload fails with clear message
- Upload failed → retry option

---

#### G-03 — Guest Gallery
**Route:** `/e/:eventCode/gallery`
**Who sees it:** Guests, only if the host has enabled the guest gallery

**Purpose:** Let guests browse all approved photos from the event.

**Controls:**
- Back to camera button
- Sort: Latest / Oldest
- Photo count in header

**Photo grid:**
- Shows only approved, visible photos (respects reveal delay)
- Responsive grid layout
- Tap to open fullscreen

**Lightbox:**
- Full-screen photo view
- Left/right navigation between photos
- Guest name and timestamp
- Close / swipe-down to dismiss

**Disabled state:**
- If guest gallery is turned off: "The gallery is not available for this event"

**Empty state:**
- "No photos yet" (or "Check back later" if reveal delay is active)

---

## 8. Navigation Structure

### Host Navigation
```
/host/login  ──────────────────────────────────────┐
/host/signup ──────────────────────────────────────┤
                                                   ↓
                                        /host  (Event List)
                                           ↓
                               /host/events/new  (Create)
                                           ↓
                           /host/events/:id  (Dashboard)
                          ├── /host/events/:id/moderation
                          ├── /host/events/:id/gallery
                          ├── /host/events/:id/settings
                          └── /host/events/:id/export
```

### Guest Navigation
```
QR Code / Link
       ↓
/e/:code  (Landing / Join)
       ↓
/e/:code/camera  ◄──────────────────────┐
       │                                │
       └── /e/:code/gallery  ───────────┘
```

---

## 9. Key Interaction Patterns

### Real-Time Updates
The host moderation and dashboard screens refresh automatically every 10 seconds. When new photos arrive, the UI should notify the host non-intrusively (e.g., a badge or toast: "3 new photos"). Designing for live, changing data is important.

### Bulk Actions
The moderation screen needs to support selecting multiple photos at once. The selection mode should feel clear and distinct from the default browsing mode — the user should always know whether they're in "viewing" or "selecting" mode.

### Destructive Actions
Deleting events, deleting photos, and rejecting photos are irreversible (or high-impact). These actions must always require an explicit confirmation step.

### Loading & Empty States
Every data screen has three distinct states that need design attention:
1. **Loading** — data is being fetched
2. **Empty** — no data exists yet
3. **Populated** — the normal state

### Quota & Limit Feedback
Both hosts and guests can hit limits (storage full, photo limit reached, plan limit). These states need clear, specific error messaging — not generic errors — so the user understands exactly what happened and what to do next.

### Offline / Network Errors
Uploads can fail on poor mobile connections (common at events). The camera screen needs graceful error handling with a clear retry option.

---

## 10. Mobile Considerations

- The entire guest experience is mobile-only by design
- The camera screen must be **full-screen** on mobile (no browser chrome if possible)
- All tap targets should be a minimum of 48×48px
- The capture button should be large and easy to press with one thumb
- The gallery lightbox should support swipe-to-navigate and swipe-down-to-close
- Bottom sheets are preferred over modals for secondary content on mobile
- The host dashboard should be fully usable on a tablet/mobile (host may be on-site)

---

## 11. Accessibility Requirements

- All interactive elements must have visible focus indicators
- Color must not be the only way to communicate status (add icons or text labels alongside color)
- Minimum contrast ratio of 4.5:1 for normal text (WCAG AA)
- All images and icon buttons need descriptive alt text / aria-labels
- Forms must have proper label associations

---

## 12. Screen Inventory Summary

| ID | Screen | User | Auth Required |
|----|--------|------|---------------|
| H-01 | Sign Up | Host | No |
| H-02 | Log In | Host | No |
| H-03 | Event List | Host | Yes |
| H-04 | Create Event | Host | Yes |
| H-05 | Event Dashboard | Host | Yes |
| H-06 | Photo Moderation | Host | Yes |
| H-07 | Host Gallery View | Host | Yes |
| H-08 | Event Settings | Host | Yes |
| H-09 | Export | Host | Yes |
| H-10 | Pricing Page | Host | Yes |
| H-11 | Admin Panel | Host (admin only) | Yes |
| G-01 | Event Landing / Join | Guest | No |
| G-02 | Camera | Guest | Session token |
| G-03 | Guest Gallery | Guest | Session token |

**Total: 14 screens**

---

## 13. Out of Scope

The following are handled by third-party services or backend infrastructure and do not require screen design:

- Payment processing / billing (handled externally)
- Email notifications
- SSL / server configuration
- QR code generation (generated server-side, displayed as an image)
