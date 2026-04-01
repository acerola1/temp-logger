# Agent Notes

## Collaboration Rule

For this project, every working session must explicitly state the user's next required action.

When the user needs to do something, the response should include a clearly separated instruction that says what they need to do next.

Rules:

- always state when the user needs to run a terminal command
- always state when the user needs to do a physical action on the ESP32, sensor, cable, or board
- if there is no user action required, say that explicitly
- keep the instruction concrete and immediate

Examples:

- `Neked most ezt kell futtatnod: cd /home/pambruzs/projects/esp32/dashboard && npm run dev`
- `Neked most ezt kell fizikailag megcsinálnod: dugd vissza az ESP32-t USB-re`
- `Most nincs tőled teendő, megyek tovább a kódoldali résszel.`
