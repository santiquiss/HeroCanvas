# Lab: the iPhone Duo in 3D

An experiment, not part of the tool (not built, not shipped): the iPhone Duo as a 3D model that opens and closes,
with a live app on its displays.

- **Model**: `public/devices/iphone-duo.glb`, "iPhone Duo" by PikkmeStudios (Sketchfab, CC BY 4.0: the credit is on
  the page). Prepared from the original: the open pose only, without the bones, simplified and compressed (meshopt).
- **The fold**: the halves turn about the hinge and come together closed; the hinge's cover sinks into the spine; the
  inner display is one sheet that bends at the hinge.
- **Live app**: the app in an iframe per display (the designer's real mode, `?real=1&launch=off`), laid on its glass
  with one perspective transform a frame. Live only open (inner) or closed (outer); while it folds, the sheet shows a
  picture of the inner app, kept current in the background (`picture.ts`, run inside the iframe).
- **Run it** from the app's dev server (same origin, for the picture):
  `LAB_OUT=<app>/shots/lab-duo npx vite build --config lab/vite.config.ts`, copy `public/devices/` into it, open
  `http://localhost:5173/shots/lab-duo/duo3d.html`. From HeroCanvas's own server (`/lab/duo3d.html`) it runs too,
  without the picture.

Tried and set aside: CSS3DRenderer (the screen couldn't be clicked at the model's scale), HTML-in-Canvas (live and
interactive while folded, but behind a Chrome flag or an origin trial).

Next, if picked up: the outer and inner displays as one app; Capture mode with the model (DuoScene); the render loop
idle when nothing moves.
