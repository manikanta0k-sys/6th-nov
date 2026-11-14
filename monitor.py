"""Screen OCR monitor. Never sends mouse clicks or places orders."""
import json
import re
import shutil
import csv
from pathlib import Path
from datetime import datetime
import tkinter as tk
from tkinter import messagebox

BASE = Path(__file__).resolve().parent

def decide(previous, current):
    r0, s0 = previous
    r1, s1 = current
    if r0 < 20 and s0 < 20 and 20 < r1 < 50 and 20 < s1 < 50:
        return 'UP'
    if r0 > 80 and s0 > 80 and 50 < r1 < 80 and 50 < s1 < 80:
        return 'DOWN'
    return 'WAIT'

class Monitor:
    def __init__(self, root):
        self.root = root
        root.title('Binomo Screen Signal Monitor — No Auto Trading')
        root.geometry('560x510')
        self.config_path = BASE / 'config.json'
        self.config = json.loads(self.config_path.read_text()) if self.config_path.exists() else {}
        self.running = False
        self.previous = None
        self.last_half = None
        self.last_minute = None
        self.cooldown_until = 0
        tk.Label(root, text='SCREEN SIGNAL MONITOR', font=('Segoe UI', 19, 'bold')).pack(pady=12)
        tk.Label(root, text='Screen OCR • RSI(2) + Stochastic(4,3,3) • 30-second chart').pack()
        tk.Label(root, text='Signals only. No order buttons, login access or auto trades.').pack(pady=6)
        row = tk.Frame(root); row.pack(pady=12)
        tk.Button(row, text='1. Select RSI value', command=lambda: self.select('rsi')).pack(side='left', padx=6)
        tk.Button(row, text='2. Select Stochastic value', command=lambda: self.select('stochastic')).pack(side='left', padx=6)
        self.label = tk.Label(root, text='STOPPED', font=('Segoe UI', 36, 'bold'), fg='#666666'); self.label.pack(pady=14)
        self.values = tk.Label(root, text='RSI: —     Stochastic: —', font=('Segoe UI', 14)); self.values.pack()
        self.status = tk.Label(root, text='Select the numeric indicator values, then Test OCR.', wraplength=510); self.status.pack(pady=16)
        buttons = tk.Frame(root); buttons.pack()
        tk.Button(buttons, text='Test OCR', command=self.test).pack(side='left', padx=8)
        tk.Button(buttons, text='Start', command=self.start).pack(side='left', padx=8)
        tk.Button(buttons, text='Stop', command=self.stop).pack(side='left', padx=8)
        tk.Label(root, text='Keep browser position, zoom and indicators unchanged.\nKeep this window outside the selected indicator areas.\nNo verified win rate. Uses live screen values, not OHLC candles.', fg='#666666').pack(pady=22)
        root.after(1000, self.tick)

    def select(self, key):
        if self.running: self.stop()
        self.root.withdraw()
        self.root.after(400, lambda: self.overlay(key))

    def overlay(self, key):
        top = tk.Toplevel(self.root)
        top.attributes('-fullscreen', True); top.attributes('-topmost', True); top.attributes('-alpha', 0.35)
        top.configure(bg='black')
        canvas = tk.Canvas(top, bg='black', cursor='crosshair', highlightthickness=0); canvas.pack(fill='both', expand=True)
        canvas.create_text(30, 35, anchor='w', text=f'Drag a tight box around the {key.upper()} NUMBER only. Esc cancels.', fill='white', font=('Segoe UI', 20))
        start = []; rect = []
        def down(e):
            start[:] = [e.x_root, e.y_root]
            rect[:] = [canvas.create_rectangle(e.x, e.y, e.x, e.y, outline='yellow', width=3)]
        def move(e):
            if start: canvas.coords(rect[0], start[0], start[1], e.x_root, e.y_root)
        def close(): top.destroy(); self.root.deiconify()
        def up(e):
            if not start: return
            x, y = min(start[0], e.x_root), min(start[1], e.y_root)
            w, h = abs(start[0]-e.x_root), abs(start[1]-e.y_root)
            if w >= 5 and h >= 5:
                self.config[key] = [x, y, w, h]
                self.config_path.write_text(json.dumps(self.config, indent=2))
            close()
        canvas.bind('<ButtonPress-1>', down); canvas.bind('<B1-Motion>', move); canvas.bind('<ButtonRelease-1>', up)
        top.bind('<Escape>', lambda e: close())

    def read(self):
        import pyautogui
        import pytesseract
        from PIL import ImageOps, ImageEnhance
        exe = shutil.which('tesseract')
        if not exe:
            for p in [Path('C:/Program Files/Tesseract-OCR/tesseract.exe'), Path('C:/Program Files (x86)/Tesseract-OCR/tesseract.exe')]:
                if p.exists(): exe = str(p); break
        if not exe: raise ValueError('Tesseract OCR not found. Install it, then reopen this monitor.')
        pytesseract.pytesseract.tesseract_cmd = exe
        result = []
        for key in ['rsi', 'stochastic']:
            if key not in self.config: raise ValueError('Select both indicator number regions first.')
            im = pyautogui.screenshot(region=tuple(self.config[key]))
            im = ImageOps.grayscale(im.resize((im.width * 4, im.height * 4)))
            im = ImageEnhance.Contrast(im).enhance(2)
            raw = pytesseract.image_to_string(im, config='--psm 7 -c tessedit_char_whitelist=0123456789.,', timeout=3).strip().replace(',', '.')
            if not re.fullmatch(r'\d{1,3}(?:\.\d+)?', raw): raise ValueError(f'{key}: unreadable OCR; select only one numeric value.')
            value = float(raw)
            if not 0 <= value <= 100: raise ValueError(f'{key}: OCR outside 0–100; recalibrate.')
            result.append(value)
        self.values.config(text=f'RSI: {result[0]:.2f}     Stochastic: {result[1]:.2f}')
        return tuple(result)

    def test(self):
        try:
            self.read(); self.status.config(text='Compare these values with the chart. Correct OCR is required.')
        except Exception as e: self.status.config(text=str(e))

    def start(self):
        try: self.read()
        except Exception as e: messagebox.showerror('Setup needed', str(e)); return
        self.previous = None; self.last_half = None; self.last_minute = None
        self.running = True; self.show('WAIT'); self.status.config(text='Waiting for local clock :30 sample, then next :00 confirmation.')

    def stop(self):
        self.running = False; self.previous = None; self.show('STOPPED'); self.status.config(text='Stopped. No trades were placed.')

    def show(self, value):
        self.label.config(text=value, fg={'UP':'#059669','DOWN':'#e11d48','WAIT':'#6b7280'}.get(value, '#666666'))

    def tick(self):
        try:
            if self.running:
                now = datetime.now(); stamp = now.strftime('%Y-%m-%d %H:%M')
                if now.timestamp() < self.cooldown_until:
                    self.show('WAIT'); self.status.config(text=f'Cooldown: {int(self.cooldown_until-now.timestamp())} seconds remaining.')
                elif 30 <= now.second <= 33 and self.last_half != stamp:
                    self.last_half = stamp
                    values = self.read()
                    self.previous = (stamp, values)
                    self.show('WAIT'); self.status.config(text=':30 sample captured. Waiting for next :00 confirmation.')
                elif now.second <= 3 and self.last_minute != stamp:
                    self.last_minute = stamp
                    current = self.read(); signal = 'WAIT'
                    if self.previous:
                        t = datetime.strptime(self.previous[0], '%Y-%m-%d %H:%M')
                        age = (now - t).total_seconds()
                        if 60 <= age <= 64: signal = decide(self.previous[1], current)
                    self.previous = None
                    self.show(signal)
                    self.status.config(text=f'{now:%H:%M:%S} — rule result {signal}. Screen sample; no next-candle guarantee.')
                    path = BASE / 'signals.csv'; new = not path.exists()
                    with path.open('a', newline='') as f:
                        writer = csv.writer(f)
                        if new: writer.writerow(['local_time', 'rsi', 'stochastic', 'signal'])
                        writer.writerow([now.isoformat(timespec='seconds'), *current, signal])
                    if signal != 'WAIT':
                        self.cooldown_until = datetime.now().timestamp() + 240
                        self.root.bell()
        except Exception as e:
            self.previous = None; self.running = False; self.show('ERROR'); self.status.config(text=f'{e} Stopped; fix setup and press Start.')
        finally: self.root.after(1000, self.tick)

if __name__ == '__main__':
    import ctypes
    try: ctypes.windll.shcore.SetProcessDpiAwareness(2)
    except (AttributeError, OSError): pass
    root = tk.Tk(); Monitor(root); root.mainloop()
