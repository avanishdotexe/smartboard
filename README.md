# SmartBoard - Live Digital Teaching Board (PWA)

The teacher writes, students watch **live** on their phone or laptop.
No install, no login. Just a 6-letter room code.

**Tech stack:** Node.js, Express, Socket.io (WebSocket), HTML5 Canvas, vanilla JavaScript, Progressive Web App (manifest + service worker)

## Features

**New in 2.0**
- **3 themes**: Ink (dark + amber), Paper (warm light + green), Ocean (deep blue + coral). One tap to switch, remembered per browser
- **Smart shapes**: turn on the wand, draw a rough circle, box or line, and it becomes perfect
- **Select tool**: click to select, drag to move, corner handle to resize, duplicate, delete, double-click text to edit
- **11 extra shapes** (triangle, right triangle, diamond, pentagon, hexagon, trapezoid, parallelogram, star, plus, block arrow, heart), **double arrow**, **dashed lines**, **snap to grid**
- **Symbol palettes** (Maths, Science, Marks, Arrows; 90+ symbols), arrow tool and a **handwriting font** (Hindi works too)
- Change **colour and fill** of a selected object
- **9 pen styles** (pen, pencil, marker, brush, calligraphy, neon glow, rainbow, dotted, dashed): click the pen tool again to choose
- **27 wallpapers** in a visual gallery: paper, kraft, mm graph paper, hexagons, isometric dots, polar grid, music staff, English 4-line, blueprint, chess, sunrise, sunset, ocean, forest, aurora, night sky, pastel, wood and more (dark ones switch the ink to white)
- **Present mode** (`F`): hides all menus, full-size board with a small page/pen/laser bar
- **Spotlight** (`J`): dims the board except one circle that follows the teacher; **sticky notes** (`N`)
- **Emoji reactions** from students (float up on everyone's screen), **page sorter** with thumbnails
- **Random group maker** (can post the groups onto a new page) and a **shortcuts** help (`?`)
- **Live poll**: teacher asks, students vote on their phones, live counts for the teacher, correct answer revealed on close
- **Class timer** that everyone sees, with a beep at zero
- **Student names, raise hand (hand-up alert) and random student picker**
- **13 templates**: table, Venn (2 and 3 sets), mind map, number line, Cornell notes, KWL, flowchart, quiz, 2x2 matrix, right triangle, timetable, fraction bars
- **Graph-axes background** (x/y with numbers) for maths
- **Invite dialog with QR code** and editable join link
- **Board names**, recent boards on the home screen, boards survive a server restart (saved to disk)

**Core**
- Pen, highlighter, eraser, line, rectangle, circle and text (English and Hindi), 10 colours + custom, brush size, shape fill
- Live sync, laser pointer, "students can draw" toggle, undo/redo/clear, multi-page boards
- Image upload, PDF import, PNG/PDF save, 27 wallpapers
- Installable PWA with offline app shell

## How to run

```bash
npm install
npm start
```

Open http://localhost:3000 in your browser.

1. **Teacher:** click "Create New Board". The code appears at the top (for example `K7MQ2X`).
2. **Student:** open the site on another device or tab, enter the room code, or open the teacher's link.
3. To join from a phone on the same WiFi, open `http://<your-laptop-IP>:3000`.

Shortcuts: `V` select, `S` shapes, `A` arrow, `Del` delete, `Ctrl+D` duplicate, `P` pen, `H` highlighter, `E` eraser, `L` line, `R` rectangle, `O` circle, `T` text, `K` laser, `Ctrl+Z` undo, `Ctrl+Y` redo, arrow keys to change page.

## Install as an app (PWA)

A PWA needs **HTTPS** (only `localhost` is exempt), so deploy first (see below).

- **Android / Chrome / Edge (desktop):** open the live link and tap **Install App** on the home page (or the install icon in the address bar).
- **iPhone / iPad (Safari):** tap **Share**, then **Add to Home Screen**.
- After installing, SmartBoard opens in its own window with the SmartBoard icon, like a normal app.

Note: opening `http://<laptop-IP>:3000` on a phone works as a normal website, but it cannot be installed because it is not HTTPS.

**Updating the app:** the service worker caches the app files. After you change any file in `public/`, bump `VERSION` in `public/sw.js` (for example `smartboard-v6`) so users receive the new version.

## Deploy for free (to get a live link)

**Render.com:** push the project to GitHub, then New > Web Service, build command `npm install`, start command `npm start`.
(Railway or Fly.io work the same way.) Put the live link on your resume.

## Project structure

```
smartboard/
  server.js            Express + Socket.io transport, saves boards to data/boards.json
  public/
    index.html         Landing page, board layout, modals
    css/style.css      Theme tokens (Ink / Paper / Ocean) + responsive UI
    js/core.js         Room engine: rooms, roles, polls, timer, hands (shared by server and browser demo)
    js/app.js          Canvas, tools, selection, smart shapes, networking
    js/features.js     Poll, timer, people, QR invite, templates, stamps, recent boards
    sw.js, manifest.webmanifest, icons/, screenshots/   PWA
```

## How it works (useful for interviews)

- **Shared coordinate system:** the board is always 1600x900 logical units. Each device scales it to its own screen, so everyone sees the same board.
- **Object model:** every item (stroke, shape, text, image) is an object with a unique `id`. The server keeps the list of objects for each page.
- **Live strokes:** while drawing, points are sent in 40 ms batches (`obj:pts`), which keeps network traffic low.
- **Late joiners:** when a new student joins, the server sends the full state (`pages`).
- **Permissions:** the server checks on every event whether the sender is the teacher. The client is never trusted on its own.
- **Undo / redo:** the server keeps a per-page `redo` stack and broadcasts `obj:remove` / `obj:add` to everyone.
- **PWA caching:** the service worker pre-caches the app shell and answers from cache first (stale-while-revalidate). Socket.io traffic is never intercepted, so live sync is unaffected.
- **Teacher identity:** when a room is created, the server returns a random secret key. The browser that holds this key is treated as the teacher.

## Ideas to extend it

- Move boards from a JSON file to MongoDB or PostgreSQL
- Redis adapter (`@socket.io/redis-adapter`) to scale across servers
- Class recording (stroke replay), student answer export to CSV
- Offline drawing with sync (IndexedDB + background sync)

## Resume bullets

- Built **SmartBoard**, an installable PWA for live classroom teaching (Node.js, Express, Socket.io, HTML5 Canvas) with real-time sync of strokes, shapes, polls and a shared class timer.
- Designed a transport-independent room engine with server-side role checks (teacher/student), private poll results until close, and a geometry whitelist for move/resize; unit-tested and reused in a browser-only demo.
- Implemented a smart-shape recogniser (rough stroke to line/circle/rectangle), a select/move/resize tool, templates, raise-hand and random picker.
- Added a 3-theme design system, offline app shell with service worker, and board persistence across server restarts.
- Deployed with a live demo; used by **X teachers** across **Y classes** (replace with real numbers).

- **Colour studio**: own colour picker (colour square, hue slider, hex box, shades, 70-colour palette, recent colours, eyedropper where the browser supports it) instead of the phone's default picker. Works for pen colour and for recolouring selected objects.
- **Circle to select (lasso)**: draw a loop around many objects, then move, resize, recolour, duplicate or delete them together (shortcut Q). Syncs live to students.
- **Colourful tool tiles**: every tool has its own gradient icon tile with a glowing active state.
- **Video class (WebRTC)**: teacher and students join a video call from the camera button on the top bar. Star layout (each student connects to the teacher), mic and camera toggles, speaking highlight, teacher screen share, **Mute all / Cams off**, and per-student buttons so the host can switch off one student's mic or camera. Students join with mic and camera off. Media goes browser to browser; the server only relays signalling (`rtc:*` events in core.js). Needs HTTPS (or localhost) for camera access, and works best for classes of about 10-15 video participants. For networks behind strict firewalls add a TURN server in `public/js/call.js` (`ICE`).
- Circle select now also supports Ctrl+A (select everything on the page).


## 2.11
- **Database**: MongoDB (set `MONGODB_URI`) or local files if unset. Boards survive restarts.
- **Teacher accounts**: sign up / log in, **My boards** (open from any device, delete). Students still need no login.
- Deploy guide: see DEPLOY.md.

## 2.10
- **Quiz leaderboard**: a poll with a correct answer awards 500-1000 points (faster = more). Podium shows on every screen; Teach menu has Leaderboard and Reset scores.
- **Yes / No poll** in one click.
- **Replay this page**: the drawing plays back like a video.
- **All pages overview** with thumbnails (click the page counter), **Cheer the class** confetti, **board grid** toggle, **auto-save + restore** (this device).

## 2.9.1
- Present mode: **New page** button with page counter.
- Pencil and marker popover: **Shade** row (light to dark of the chosen colour).
- Present mode: **Pen style** grid (Pencil, Marker, Brush, Calligraphy, Neon, Rainbow, Dotted, Dashed).
- Join box example name is now Avanish.

## What's new in 2.9 (ten teaching features)

1. **Zoom and pan** (buttons, mouse wheel, two-finger pinch, Space + drag).
2. **Ruler, protractor, set squares** (Geometry button). Pen lines snap to their edges. Students see them live.
3. **Graph plotter**: type `x^2 - 4`, `sin(x)`, `2x+1`... and axes plus curves land on the board.
4. **Ask the class**: short answers or a word cloud, answers can be sent to the board as sticky notes.
5. **Class recording** (screen + mic) saved as a .webm file.
6. **Handwriting to text** (select strokes, then T-arrow button). Uses tesseract.js loaded on demand, needs internet.
7. **Save / open a board file** (.smartboard.json) so a lesson can be continued another day.
8. **Breakout groups**: random groups, each with its own page; students can only draw on their own group page.
9. **Attendance** list with join/leave time and CSV export.
10. **Class chat** (teacher can switch it off) and the **Not clear** button with a live counter for the teacher.

## What's new in 2.8
- **Auto shape rewritten**: compares the stroke with circle, oval, box, diamond, triangle and free 3 or 4 sided shapes, so slanted boxes and scalene triangles work too. Tested on 540 messy strokes (100% right) with no false conversions on scribbles, hearts or stars.
- **Present mode**: Undo and Redo, brush thickness, separate eraser size, "Whole stroke" eraser, Curtain button.
- **Curtain**: cover the board for students and reveal it slowly by dragging the orange bar (synced live).
- **Copy page** button next to "New page".
- **12 new wallpapers**: Cornell notes, number lines, table, month calendar, K-W-L chart, storyboard, Venn diagram, blue sky, lavender, slate, sand, galaxy.

### 2.12 Mobile, warm-up and new class features
- Server warm-up bar on the landing page, student name is compulsory, mobile "More" menu and layouts for 320px to tablets and landscape phones.
- Chat icon shows a red unread count; the teacher sees the names of students who tapped "Not clear" (click the chip).
- QR: Share (WhatsApp etc.) and Save QR picture in the invite box; students can Scan the QR from the landing page.
- Every page keeps its own wallpaper (new pages inherit the current one; "Apply to all pages" option).
- Images and PDFs ask "Full screen or Normal"; a Fill-board button appears when an image is selected. PDF pages render at about 2x board width (JPEG 94%) for sharp text.

### 2.13 More teaching controls
- Marker and Eraser open a popover (type + size) when clicked. Marker types: Classic, Round tip, Soft, Bold, Fine. Eraser: Rub out or Whole stroke.
- Image / PDF upload: Full screen, Stretch or Normal; select a picture to get Full screen and Stretch buttons.
- One-tap 👍 / 👎 poll (Teach menu, or the 👍 button in Present mode). No question needed.
- Attendance can be saved as a PDF report.
- Present mode now has Select, Lasso and Text. Four new themes: Forest, Sunset, Mint, Blackboard.

### 2.14 Chat photos & teacher name
- Teacher and students can send photos in chat (auto-shrunk to ≤ ~400 KB, tap to open full screen). Only the newest ~3 MB of photos are kept per room.
- Teacher can set a display name (landing page or "Shown as" box in chat). Students see it with an orange **TEACHER** badge and a highlighted bubble, so it never looks like a student.
