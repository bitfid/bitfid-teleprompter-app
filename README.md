# Bitfid Teleprompter App

A lightweight local test version of a teleprompter for Mac and iPhone.

The app is written in Python and plain browser code. It runs a local web server on your Mac, then you can open the same address on an iPhone connected to the same Wi-Fi network.

## Features

- Paste or write a script and turn it into a teleprompter.
- Minimal black, gray, and white interface.
- Manual auto-scroll with speed, text size, and line gap controls.
- Voice Follow mode using the browser microphone where supported.
- Current-line highlighting and centering.
- Mirror mode for physical teleprompter glass.
- Fullscreen prompt view.

## Requirements

- Python 3.10 or newer.
- Safari or Chrome for microphone-based Voice Follow.
- iPhone and Mac on the same Wi-Fi network for phone testing.

No Python packages are required for this test version.

## Run

```bash
python3 -m bitfid_teleprompter.server
```

Open the Mac URL printed in the terminal. To test on iPhone, open the iPhone URL printed in the terminal.

## Test

```bash
python3 -m unittest
```

## Notes

Browsers do not let a web app use the laptop speaker as an input sensor. Voice Follow uses the built-in microphone to estimate which line the user is reading and keeps that line centered. This is the open-source, lightweight path that works across normal laptops and phones without native app-store packaging.
