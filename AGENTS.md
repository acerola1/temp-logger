# Agent Notes

## Collaboration Rule

For this project, every working session must explicitly state the user's next required action.

When the user needs to do something, the response should include a clearly separated instruction that says what they need to do next.

Rules:

- always state when the user needs to run a terminal command
- always state when the user needs to do a physical action on the ESP32, sensor, cable, or board
- if there is no user action required, say that explicitly
- keep the instruction concrete, immediate, and short

Examples:

- `Futtasd: cd dashboard && npm run dev`
- `Csináld meg: dugd vissza az ESP32-t USB-re`
- `Nincs teendőd. Megyek tovább.`

## UI Debug Rule

When adjusting UI layout, spacing, alignment, visibility, or interaction states:

- do not keep iterating blindly on pixel values without reproducing the exact visible state first
- if the issue depends on auth state, admin state, viewport, or data presence, reproduce that same state before changing code
- prefer checking the DOM and taking screenshots after each meaningful change
- change one thing at a time when possible, instead of mixing multiple hypotheses in one edit
- if repeated small tweaks do not converge, stop tweaking and re-check the actual rendered structure before continuing

## Completion Rule

- do not stop at “almost done” if the requested result is still visibly wrong
- keep iterating until the task is actually finished, or until there is a real external blocker
- if a verification step shows the result is still wrong, continue immediately instead of handing the unfinished state back to the user
- before stopping, explicitly ask yourself: “Did I actually solve the user’s task?”
- if the honest answer is “not yet”, continue working instead of closing the loop
- the required “next action” line must not be treated as permission to stop early; it is only a communication requirement
