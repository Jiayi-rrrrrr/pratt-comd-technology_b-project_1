# MAKE IT A DATE — v4

This version keeps the v3 decision logic but changes the visual composition.

## Main change
The interaction now sits in the center of the screen.

The calendar becomes the full-screen background:
- blurred and faint at the beginning
- gradually sharper as the system narrows the experience
- visibly marked as the logic progresses

## Calendar behavior
- PERIOD OF TIME → the whole calendar receives a repeated purple field
- EXACT DATE → one cell turns pink
- SELECTED DATE → one cell turns purple
- CANNOT BE REPRESENTED → the calendar receives red X marks

The background therefore becomes part of the system's reasoning rather than a separate panel.

## Legibility
The v3 question/answer trace is preserved in the lower-left corner.
Each step stores:
- the question
- the user's answer

## Run
Open this folder in Visual Studio Code.
Right-click `index.html` → Open with Live Server.

Or open `index.html` directly in a browser.

No API is required.
