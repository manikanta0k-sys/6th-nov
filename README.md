# Binomo Windows Screen Signal Monitor

Rebuilt from the uploaded 2021 project's RSI/Stochastic rule. Signals only; no mouse controller, order placement, account access, balance reading, random strategy or Martingale. This is a rule-based screen reader, not a trained AI model. No verified win rate.

## Windows setup
1. Extract the entire ZIP into a folder (do not run inside the ZIP).
2. Install Python 3 with tkinter and the Python launcher: https://www.python.org/downloads/windows/
3. Double-click INSTALL.bat. Internet is required to install dependencies.
4. Install the separate Tesseract OCR engine. Official installation guidance: https://tesseract-ocr.github.io/tessdoc/Installation.html
   The program checks PATH and C:\Program Files\Tesseract-OCR\tesseract.exe.
5. Open a Binomo demo chart in Chrome/Brave. Set chart candles to 30 seconds, RSI period 2, Stochastic 4/3/3, levels 20/80. Expiry is not configured by this monitor.
6. Open START.bat. Keep this window away from the indicator values.
7. Select RSI value: drag a tight box around its current numeric value only. Select Stochastic value in the same way. Use the same Stochastic line consistently. If the current platform does not show numeric values, this reader cannot use its lines alone.
8. Click Test OCR. Compare both numbers with the chart. Re-select boxes if incorrect. Plausible but wrong OCR can still pass the 0–100 check.
9. Start. Stop ends monitoring. Closing the window also ends monitoring.

## Sampling and rules
Uses your laptop's local clock: takes a screen reading near :30 and another near the following :00. If the laptop clock and chart candle boundaries differ, the samples are misaligned. It does not access an official market API, extract OHLC, verify completed candles or predict a guaranteed next candle.

UP: both first values below 20, then both second values strictly between 20 and 50.
DOWN: both first values above 80, then both second values strictly between 50 and 80.
Otherwise WAIT. This follows strategies.py's actual checks, which are stricter than the original README wording.

After UP/DOWN, four-minute cooldown; the signal is then cleared to WAIT. Results are saved locally in signals.csv. These are rule events, not verified wins/losses. Screenshot OCR errors stop monitoring. Browser movement, zoom, display scaling changes and obscured regions require recalibration. Use the primary monitor for calibration.

## GitHub
You can upload these source files to a GitHub repository for storage/download. GitHub Pages cannot run this Python desktop monitor. Run START.bat locally on Windows. Never upload .venv, config.json or signals.csv.

## Verification
Python syntax and the pure signal rule have been checked. Live Windows GUI, screen capture, current Binomo compatibility and OCR accuracy have NOT been tested on your computer. No profit or accuracy claim is made.
