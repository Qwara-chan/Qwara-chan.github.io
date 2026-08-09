---
title: "Hanging an ECG Around Your Neck: The HeartLocket Open-Source Hardware Project"
description: "A wearable ECG heart-rate pendant built with an M5Stack Cardputer ADV + AD8232: 1000 Hz sampling, on-board DSP (HR / HRV / PR-QRS-QT-QTc / mood recognition), screen + LAN web dashboard. Not a medical device, but the methodology is serious."
pubDate: 2026-08-09
tags: ["Embedded", "ESP32", "ECG", "Open Source Hardware", "Wearable"]
lang: "en"
---

> A wearable ECG heart-rate pendant built with an M5Stack Cardputer ADV + AD8232: 1000 Hz sampling, on-board DSP (HR / HRV / PR-QRS-QT-QTc / mood recognition), screen + LAN web dashboard. Not a medical device, but the methodology is serious.

---

## Origin: Why Hang an ECG Around Your Neck?

Modern smart bands can measure heart rate quite accurately, but almost none of them give you the **raw ECG waveform** — the P-QRS-T waves bouncing along on a cardiac monitor. ECG is the "ground truth" of cardiac electrical activity; heart rate is just a byproduct of it.

So the idea was born: build something that truly records an electrocardiogram, yet is small enough to wear out the door.

- **Heart rate** (instantaneous + average BPM)
- **Real-time ECG waveform** (on-screen + web)
- **Heart rate variability (HRV)**: RMSSD / SDNN / pNN50
- **Interval measurements**: PR interval, QRS duration, QT / QTc (Bazett correction)
- **Mood recognition**: mapped from HR + RMSSD, displayed as kaomoji `(^_^)` calm / `(-_-)` normal / `(>_<)` stressed
- **LAN web dashboard**: `http://heartlocket.local`, a clinical-style real-time panel + JSON API
- **Simulation mode**: full demo with zero sensors (synthetic ECG runs through the exact same DSP pipeline as the real signal)

The hardware picks are a bargain-hunter's dream: **M5Stack Cardputer ADV** (Stamp-S3A = ESP32-S3FN8, 8 MB Flash, **no PSRAM**, built-in 1200 mAh battery) + **AD8232** single-lead ECG front-end module + three electrode pads. The Cardputer ships with a screen, keyboard, battery and charging — it's naturally a complete wearable terminal.

## System Architecture: Three Tasks + Single Writer

The firmware organizes three FreeRTOS tasks, with shared state living in two mutex-protected singletons (`gMetrics` / `gWave`), and follows one principle: **dspTask is the only writer**.

```
┌─ dspTask (core 0, priority 3)────────────────────────────┐
│  adc_digi DMA continuous sampling @ 1000 Hz (HW-timed,   │
│  zero scheduler jitter)                                  │
│  └─ baseline removal → dual-channel filtering →          │
│     Pan-Tompkins R-peak detection → RR artifact filter → │
│     HRV → per-beat morphology → mood → quality gating    │
└───────────────────────────┬──────────────────────────────┘
                            ▼
        gMetrics (MetricsSnapshot + mutex) ◄── read by UI + Web
        gWave (WaveRing int16 @ 250 Hz)    ◄── read by UI + Web
```

- **loopTask** = `loop()` → `ui_loop()`: UI rendering + keyboard + auto backlight dimming
- **netTask** (core 1, priority 1, created only when `ENABLE_WIFI=1`): WiFiManager provisioning + mDNS + HTTP server

dspTask's rhythm is driven entirely by **DMA hardware timing** — the `vTaskDelay(1)` loop must not contain any latency-dependent logic, because RR-interval timing accuracy comes from hardware, not the RTOS scheduler. That is the foundation of 1 ms RR precision (the recommended precision for HRV measurement).

## DSP: From Raw ADC Data to Clinical-Grade Metrics

### Sampling & Filtering

- **1000 Hz effective sampling**: the ADC triggers at 2000 Hz and time-multiplexes two channels (ECG + battery voltage), giving each channel a real 1000 Hz. RR-interval resolution is 1 ms.
- **Baseline removal**: a 1 s moving average. The key part is **instantaneous DC-step adsorption** — floating pins inject charge, causing single-sample jumps of hundreds of counts; the code flattens such steps instantly instead of letting them ring for a 1 s decay artifact. The threshold sits far above the steepest slope of a real QRS, so true beats are never collateral damage.
- **Dual-channel smoothing**: the detection channel uses a 10 ms low-pass (~44 Hz, the narrow band Pan-Tompkins wants); the morphology channel uses a 4 ms low-pass (~110 Hz), keeping interval endpoints (QRS onset/offset, T-wave end) closer to the true waveform.

### R-Peak Detection: Simplified Pan-Tompkins

1. Difference → rectification → **150 ms moving integration**
2. **1.5 s boot-time self-learning**: initialize the signal peak `SPK` and noise peak `NPK` from the integration maximum (the first two beats after learning are discarded — boundary artifacts)
3. Threshold `THR = NPK + 0.25·(SPK − NPK)`, continuously adaptive: detected peaks update SPK, non-peaks update NPK
4. A **250 ms refractory period** prevents T-wave false triggers; if nothing is detected beyond 1.5× the average RR, a **search fallback** (threshold halved) recovers missed beats

### RR Artifact Filtering

- Intervals outside 300–2000 ms (200–30 bpm) are dropped outright
- Intervals deviating **>12%** from the median of the last 8 are dropped — physiological HRV is usually <10% and ectopic beats >30%, so true variability is never falsely killed

### Per-Beat Morphology Measurements (PR / QRS / QT / QTc)

`analyze_beat()` analyzes the previous beat when the next R is detected (by then the T wave has fully entered the ring buffer):

1. Relocate the true R peak within a ±200 ms window (the integration peak lags the signal peak)
2. Local baseline = **median** of the [R−440, R−140] ms window (avoids the P wave)
3. Threshold `p_thr = 5% × R amplitude` — fully relative, self-adapting to every person
4. QRS onset (root of the R upstroke) → S trough → **J point** (QRS end) → P onset → T end
5. **QTc = QT / √RR** (Bazett formula)

All search windows are defined in **ms**, so they scale automatically with the sample rate.

### Hard Signal-Quality Gating: The Soul of This Project

This is the design I'm most proud of in the whole project. Most consumer HR devices just "display filtered data" over noise; HeartLocket instead uses **hard quality gating of NN records**:

- Every detected beat has its PR/QRS/QT measured; only when all three fall within physiological ranges (PR 80–300, QRS 50–180, QT 220–600 ms) is the beat counted as "trusted", and the morphology score `s_qual` moves accordingly
- **~3 consecutive trusted beats + a trusted beat within the last 4 s + RMS noise below threshold** → signal GOOD
- **Failing that within 2 s** → NO SIGNAL: the screen shows `CHECK LEADS`, and the NN ring buffer plus **all metrics are cleared and stop being written** (not hidden — actually stopped!). The detector keeps running as a probe, and recovery is judged solely on new beats
- Every quality-state transition calls `dsp_reset()` to re-learn the thresholds — stale noisy NN statistics never linger
- Without the AD8232 connected, floating-pin noise (mains interference, burst spikes, DC steps) produces pseudo-beats with fully random PR/QRS/QT; the score can never climb, and the quality machine correctly stays in NO SIGNAL — by design

In other words: **noise can never pollute the HRV**. On a resource-constrained embedded platform with no PSRAM, that's clinical-monitor-grade signal gatekeeping.

### Mood Recognition

| Mood | Condition |
|---|---|
| **CALM** | average HR < 65 and RMSSD ≥ 40 ms |
| **STRESS** | average HR ≥ 95, or (≥ 85 and RMSSD < 25 ms) |
| **NORMAL** | everything else |

All thresholds are `MOOD_*` macros in `config.h`, tunable at any time.

## Simulation Mode: Full Demo Without a Sensor

`ecg_sim.cpp` synthesizes ECG: Gaussian PQRST templates + RSA (respiratory sinus arrhythmia) + AR(1) RR noise, cycling through CALM → NORMAL → STRESS scenes every 40 s. The key point: **the synthetic signal runs through the exact same DSP path as the real one** (`gSimMode`, toggled with the `S` key), and scene switches trigger `dsp_reset()` so HRV rebuilds cleanly. It's a built-in "calibration signal source" for verifying the whole pipeline at any time.

## Web Dashboard: A Clinical-Style Panel With Zero Asset Dependencies

`web_server.cpp` is self-contained: an `INDEX_HTML` with inline CSS/JS, **no static resource files at all**. Provisioning goes through WiFiManager (on first boot it opens a `HeartLocket-AP` hotspot; connect with your phone, enter the WiFi password, done), and mDNS serves `heartlocket.local`.

| Endpoint | Description |
|---|---|
| `GET /` | Clinical-style panel: KPI cards (HR/PR/QRS/QT/QTc/RMSSD) + live ECG waveform + status badge, auto-refreshing |
| `GET /api/data` | JSON: bpm, pr, qrs, qt, qtc, rmssd, sdnn, pnn50, mood, battery, memory, uptime… |
| `GET /api/wave?points=N` | Last N waveform samples (int16, ≤1000, bounded by the no-PSRAM heap) |
| `GET /api/rr` | Last 50 NN intervals (ms) |
| `GET/POST /api/settings` | Read/modify backlight settings, applied immediately and persisted |

One honest detail: `axis` (cardiac axis) is hardcoded to `"N/A"` — a single lead can't measure electrical axis, so we don't fake the number.

![Web dashboard screenshot](/heartlocket/web_screenshot.png)

## Power: A Pendant That Lasts All Day

Since it's a "pendant", battery life is the first priority. Optimizations follow the "Power saving" scheme in `config.h`:

| Optimization | How | Gain |
|---|---|---|
| WiFi modem sleep | Enters modem sleep when idle; HTTP still reachable (~1 s wake-up delay on first request) | WiFi ~130mA → ~40mA |
| Auto backlight dimming | Dims after 20 s idle (40); faint glow after 60 s (10/255 ≈ 4%, not fully black); **no redraw** while glowing (saves CPU/SPI); any key wakes it | Backlight ~20-50mA → ~0 |
| CPU down to 160 MHz | Sampling is DMA-hardware-timed, so downclocking doesn't hurt precision | Lower CPU draw |
| ADC halved | `ADC_SAMPLE_HZ` 2000→1000 (500 Hz per channel, RR precision 2 ms) | Half the ADC draw |
| `ENABLE_WIFI 0` | Disables WiFi entirely (most power-efficient, but no LAN services) | Another ~12mA saved |

One limitation: **Light Sleep is unavailable** — it stops the ADC DMA, and continuous HRV sampling can't live without it. That's the price of hardware-timed sampling.

Battery management has two more lines of defense: **two-stage low-voltage protection** (<3.5V warns; <3.4V force-dims the backlight and shuts off the WiFi radio, with hysteresis to avoid flapping) + a **task watchdog** (auto-reboot if the DSP task ever hangs).

## Offline Validation: A Line-by-Line Python Mirror of the Firmware

The most painful part of embedded projects is "you can't test it". HeartLocket's answer is `tools/dsp_check.py` — a **line-by-line Python mirror of the firmware DSP** (quality machine, baseline adsorption, morphology measurements all included), covering 13 scenarios: clean synthetic ECG (3 levels), the floating-pin noise family (mains interference / DC step / burst spike / white noise / short circuit), and mixed interference.

```bash
python3 tools/dsp_check.py
```

Core assertions: clean signals must stay GOOD with accurate heart rate; every noise type must stay NO_SIGNAL with NN = 0.

Device vs offline (SIM mode, STRESS scene) @ 1000 Hz:

| Metric | On-device | Python offline |
|---|---|---|
| bpm | 108.9–109.3 | 109.2 |
| rmssd | 2.9–3.6 ms | 3.2 ms |
| PR / QRS | 104–106 / 66–67 ms | 104 / 66 ms |
| QT / QTc | 265–267 / 357–360 ms | 264 / 357 ms |

An interesting finding: at the old 500 Hz sample rate, residual RMSSD in the STRESS scene was ~13 ms; after moving to 1 kHz / 1 ms RR timing it dropped to ~3 ms — the residual was mostly **detector quantization jitter**, and it's now essentially eliminated. That validates that hardware-timed sampling isn't mysticism; it's a measurable metric improvement.

## Pitfalls We Hit (Hardware + Firmware)

1. **IDF 4.4 has no `adc_continuous` API** — only the `adc_digi_*` calls are available; the S3's DMA frames are fixed 32-bit type2 (`data[11:0] ch[15:13] unit[17]`), and the `format` field is ignored by the HAL. Raw ECG values must be centered by subtracting 2048.
2. **The AD8232 must be powered at 3.3V** — on an assembled Cardputer, every reachable port (EXT header / Grove) only carries 5V; the 3V3 rail is buried inside the plastic shell. The fix: 5V → **low-dropout LDO** (ME6211 / XC6206-3.3, ~0.2V dropout, regulates cleanly on battery too) → 3.3V. The AMS1117's 1.1V dropout sags below 3.0V on battery, so it's only fit for USB testing. **Never feed it 5V directly** — the output midpoint drifts to ~2.5V and R waves clip against the ADC's range.
3. **Optional GPIO power is an emergency fallback only** — driving a Grove GPIO high for 3.3V can bail you out (the S3's 3.3V rail survives on battery), but there's no regulation or overcurrent protection; a 100Ω series resistor is mandatory. The default config is `ECG_PWR_PIN = -1` (external power).
4. **Memory discipline without PSRAM** — the waveform ring buffer is bounded by the heap ceiling (`/api/wave` capped at 1000 points), and every allocation must be budgeted carefully.
5. **Transitive dependency `arduino-irremote` fails to compile** — uncomment `lib_ignore = IRremote` in `platformio.ini`.
6. **LO+/LO− hardware lead-off detection** — wire up G4/G5 and enable `USE_LOD=1`, and electrode detachment is confirmed instantly by hardware (no software debounce): the screen shows CHECK LEADS and the waveform flattens — a hardware-endorsed flat line, just like a clinical monitor.

## Getting It Running

```bash
git clone https://github.com/Qwara-chan/HeartLocket.git
cd HeartLocket
pio run              # first run auto-downloads the toolchain and M5Cardputer/M5GFX libraries
pio run -t upload    # flash (download mode: power off → hold G0 → plug USB → release)
pio device monitor -p /dev/ttyACM0 -b 115200
```

Current resource usage: RAM ~71 KB / 320 KB (22.2%), Flash ~1.13 MB / 3.3 MB (34.7%).

Keyboard shortcuts: `M`/`W`/`D`/`I` cycle four views (mood kaomoji / ECG waveform / detailed data / info), `S` toggles sim/real mode, `B` toggles the backlight, `[`/`]` adjust brightness, `-`/`=` cycle the screen-off presets.

## Configuration System: Three-Tier Priority

**SD card `config.txt` > NVS (written via Web/API) > defaults**. Web/API changes write back to both NVS and the SD card. Every tunable parameter (pins, sample rate, RR/HRV thresholds, mood thresholds, ECG scaling) lives in `src/config.h`, with the tuning rationale documented in the comments — my "why" left for myself and future maintainers.

## Project Structure

```
├── platformio.ini          # PlatformIO build configuration
├── src/
│   ├── config.h            # all tunables (pins/rates/thresholds/mood/backlight)
│   ├── main.cpp            # 3 FreeRTOS tasks: dspTask / loopTask(UI) / netTask
│   ├── adc_driver.cpp      # adc_digi DMA sampling (IDF 4.4 lacks adc_continuous)
│   ├── dsp.cpp             # core DSP: baseline/dual filter/Pan-Tompkins/HRV/morphology/quality gate
│   ├── ecg_sim.cpp         # synthetic ECG (Gaussian PQRST + RSA + AR(1) RR noise)
│   ├── display_ui.cpp      # 4 views + keyboard + backlight
│   ├── web_server.cpp      # self-contained web panel + JSON API + WiFiManager + mDNS
│   ├── settings.cpp        # SD config.txt > NVS > defaults (three-tier config)
│   ├── metrics.h/.cpp      # MetricsSnapshot (mutex-protected)
│   └── waveform.h/.cpp     # WaveRing (250 Hz waveform ring buffer)
└── tools/
    └── dsp_check.py        # offline DSP regression (line-by-line Python mirror)
```

## Conclusion & Next Steps

HeartLocket is a project with "serious methodology, casual positioning": it doesn't try to be a medical device, but it uses medical-monitor-grade signal processing ideas — hardware-timed 1 ms RR timing, per-beat morphology validation, a hard-gated NN quality system, offline line-by-line mirror regression. You won't necessarily find these engineering practices even on consumer wristbands.

Possible next steps: multi-lead (real electrical-axis measurement), long-duration SD-card ECG recording, BLE phone integration, fatigue reminders based on QTc trends…

If you're also interested in "stuffing clinical-grade signal processing into a tiny pendant", the code is on [GitHub](https://github.com/Qwara-chan/HeartLocket) (MIT license) — feel free to check it out, fork it, or send a PR.

> ⚠️ **Disclaimer**: this project is for learning and fun only, and is **not a medical device**. Heart rate, HRV and interval measurements must not be used for any medical diagnosis; please do not make any medical decisions based on this project's data.

---

*HeartLocket · MIT License © 2026 HeartLocket Contributors · More details in [README.md](https://github.com/Qwara-chan/HeartLocket#readme) (English) and [README.zh-CN.md](https://github.com/Qwara-chan/HeartLocket/blob/main/README.zh-CN.md) (Chinese)*
