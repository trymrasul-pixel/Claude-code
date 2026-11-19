"""Procedural soundtrack + sound design for "What If the Moon Fell to Earth?".
Reads out/events.json (control curves sampled every 0.1 s by render.js) and writes out/soundtrack.wav.
"""
import json, sys, wave
import numpy as np

SR = 44100
ev = json.load(open(sys.argv[1] if len(sys.argv) > 1 else 'out/events.json'))
D = ev['D']
N = int(D * SR)
t = np.arange(N) / SR
rng = np.random.default_rng(7)
arr = ev['arr']
ct = np.array([a['t'] for a in arr])

def curve(key):
    return np.interp(t, ct, np.array([float(a[key] or 0) for a in arr])).astype(np.float32)

shots = ev['ev']['shots']
def shot_env(names, fade=1.0):
    e = np.zeros(N, np.float32)
    for s in shots:
        if s['name'] in names:
            a, b = s['t0'], s['t1']
            e = np.maximum(e, np.clip(np.minimum((t - a) / fade + 0.5, (b - t) / fade + 0.5), 0, 1).astype(np.float32))
    return e

def env_lin(points):
    """piecewise-linear envelope from [(time, value), ...]"""
    p = np.array(points, float)
    return np.interp(t, p[:, 0], p[:, 1]).astype(np.float32)

# ---------- DSP helpers ----------
def fftfilt(x, lo=None, hi=None, slope=1.0):
    n = len(x); X = np.fft.rfft(x); f = np.fft.rfftfreq(n, 1 / SR)
    m = np.ones_like(f)
    if lo: m *= 1 / (1 + (lo / np.maximum(f, 1e-3)) ** (2 * slope))
    if hi: m *= 1 / (1 + (f / hi) ** (2 * slope))
    return np.fft.irfft(X * m, n).astype(np.float32)

def noise(seed=None):
    r = np.random.default_rng(seed) if seed is not None else rng
    return r.standard_normal(N).astype(np.float32)

def brown(seed=None):
    x = np.cumsum(noise(seed)); x -= fftfilt(x, hi=8)  # remove drift
    return (x / (np.abs(x).max() + 1e-9)).astype(np.float32)

def reverb(x, secs=3.5, seed=1, wet=0.35, pre=0.02):
    L = int(secs * SR); r = np.random.default_rng(seed)
    ir = r.standard_normal(L) * np.exp(-np.arange(L) / (SR * secs / 6.5))
    ir = fftfilt_short(ir, hi=6000)
    ir[:int(pre * SR)] = 0; ir /= np.sqrt((ir ** 2).sum())
    n = 1 << int(np.ceil(np.log2(len(x) + L)))
    y = np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(ir, n), n)[:len(x)]
    return ((1 - wet) * x + wet * y * 0.9).astype(np.float32)

def fftfilt_short(x, lo=None, hi=None):
    n = len(x); X = np.fft.rfft(x); f = np.fft.rfftfreq(n, 1 / SR); m = np.ones_like(f)
    if lo: m *= 1 / (1 + (lo / np.maximum(f, 1e-3)) ** 2)
    if hi: m *= 1 / (1 + (f / hi) ** 2)
    return np.fft.irfft(X * m, n)

def place(buf, sig, at, gain=1.0):
    i = int(at * SR)
    if i >= N: return
    j = min(N, i + len(sig)); buf[i:j] += sig[:j - i] * gain

def adsr(n, a, r, sus=1.0):
    e = np.ones(n, np.float32) * sus
    A = min(n, int(a * SR)); R = min(n - A, int(r * SR))
    e[:A] = np.linspace(0, sus, A);
    if R > 0: e[n - R:] = np.linspace(sus, 0, R)
    return e

NOTE = {'C': -9, 'C#': -8, 'Db': -8, 'D': -7, 'D#': -6, 'Eb': -6, 'E': -5, 'F': -4, 'F#': -3, 'Gb': -3, 'G': -2, 'G#': -1, 'Ab': -1, 'A': 0, 'A#': 1, 'Bb': 1, 'B': 2}
def hz(name):
    n, o = name[:-1], int(name[-1]); return 440 * 2 ** ((NOTE[n] + (o - 4) * 12) / 12)

# ---------- MUSIC ----------
music_L = np.zeros(N, np.float32); music_R = np.zeros(N, np.float32)

def pad_note(f, dur, a=2.5, r=3.0, bright=6, det=0.004, seed=0):
    n = int((dur + r) * SR); tt = np.arange(n) / SR; out = np.zeros(n, np.float32)
    for k, d in enumerate((-det, 0, det)):
        ph = np.random.default_rng(seed + k).random() * 6.28
        for h in range(1, bright + 1):
            out += (np.sin(2 * np.pi * f * (1 + d) * h * tt + ph * h) / h ** 1.4).astype(np.float32)
    out *= adsr(n, a, r)
    # slow shimmer
    out *= (1 + 0.15 * np.sin(2 * np.pi * 0.13 * tt + seed)).astype(np.float32)
    return out / 6

def chord(buf_l, buf_r, at, dur, notes, gain, **kw):
    for i, nm in enumerate(notes):
        f = hz(nm)
        s = pad_note(f, dur, seed=int(f) + i, **kw)
        pan = 0.5 + 0.35 * np.sin(i * 2.1)
        place(buf_l, s, at, gain * (1 - pan) * 1.4); place(buf_r, s, at, gain * pan * 1.4)

def pluck(f, dur=1.6):
    n = int(dur * SR); tt = np.arange(n) / SR
    s = (np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(4 * np.pi * f * tt) + 0.12 * np.sin(6 * np.pi * f * tt)) * np.exp(-tt * 3.2)
    s[:int(0.004 * SR)] *= np.linspace(0, 1, int(0.004 * SR))
    return s.astype(np.float32)

def arp(at, end, chords_, bpm, gain, octave_up=True):
    step = 60 / bpm / 2; k = 0; x = at
    while x < end:
        ci = int((x - at) / ((end - at) / len(chords_))); ci = min(ci, len(chords_) - 1)
        notes = chords_[ci]; nm = notes[[0, 1, 2, 1, 3 % len(notes), 2, 1, 2][k % 8] % len(notes)]
        f = hz(nm) * (2 if octave_up else 1)
        s = pluck(f); pan = 0.5 + 0.3 * np.sin(k * 0.9)
        place(music_L, s, x, gain * (1 - pan) * 1.2); place(music_R, s, x, gain * pan * 1.2)
        x += step; k += 1

def progression(at, chords_, each, gain, **kw):
    for i, c in enumerate(chords_):
        chord(music_L, music_R, at + i * each, each, c, gain, **kw)

Am = ['A2', 'E3', 'A3', 'C4', 'E4']; F = ['F2', 'C3', 'A3', 'C4', 'E4']; C = ['C3', 'G3', 'C4', 'E4', 'G4']; G = ['G2', 'D3', 'B3', 'D4', 'G4']
Em = ['E2', 'B2', 'G3', 'B3', 'E4']; Dm = ['D2', 'A2', 'F3', 'A3', 'D4']; Bb = ['Bb1', 'F2', 'D3', 'F3', 'Bb3']; A = ['A1', 'E2', 'C#3', 'E3', 'A3']
E = ['E2', 'B2', 'G#3', 'B3', 'E4']; Gb = ['G2', 'B2', 'D3', 'G3', 'B3']

# Cold open: calm, then hollow
progression(0.5, [Am, F, C], 9.5, 0.10, bright=5)
chord(music_L, music_R, 29, 16, ['A1', 'E2', 'A2'], 0.11, a=4, r=2, bright=8)
chord(music_L, music_R, 33, 12, ['Bb4', 'A5'], 0.035, a=6, r=1.5, bright=2)
# Title
chord(music_L, music_R, 46.2, 7, ['A1', 'E2', 'A2', 'C3', 'E3'], 0.14, a=0.3, r=2.5, bright=8)
# Chapter 1 + graph: explainer
progression(54.5, [Am, Em, F, C, Am, Em, F, G], 11.4, 0.075, bright=4)
arp(66, 99, [Am, Em, F, C], 84, 0.05)
arp(104, 139, [Am, F, C, G], 84, 0.055)
# Chapter 2: lighter
progression(140.5, [C, G, Am, F, C, G, Am], 10.6, 0.07, bright=4)
arp(145, 177, [C, G, Am, F], 92, 0.05)
arp(179, 214, [Am, F, C, G], 72, 0.035, octave_up=False)
# Chapter 3: tension
progression(215.5, [Dm, Am, Bb, A, Dm, Am, Bb, A, Dm, Bb], 10.4, 0.085, bright=6)
arp(220, 262, [Dm, Am, Bb, A], 96, 0.035)
# Chapter 4: dark drone
chord(music_L, music_R, 320.5, 44, ['D1', 'A1', 'D2', 'A2'], 0.13, a=3, r=3, bright=9)
chord(music_L, music_R, 340, 25, ['Eb4', 'D5'], 0.03, a=8, r=3, bright=2)
progression(365, [Dm, Bb, Gb, A, Dm, Bb], 10.8, 0.09, bright=7)
# Chapter 5: big
progression(430.5, [Dm, Bb, F, A, Dm, Bb, A], 10.6, 0.12, bright=9, a=1.5)
chord(music_L, music_R, 468, 37, ['D1', 'A1', 'D2'], 0.12, a=2, r=2, bright=10)
# Chapter 6: impact (full)
progression(505.5, [Dm, Bb, A], 12, 0.14, bright=10, a=1.0, r=0.6)
# Aftermath: mournful
progression(551, [Am, F, C, E, Am, F], 10, 0.07, bright=4, a=3.5, r=4)
# Ending: hopeful
progression(612.5, [C, G, Am, F, C], 11, 0.075, bright=4, a=3, r=5)
arp(617, 660, [C, G, Am, F], 76, 0.04)
chord(music_L, music_R, 639, 10, ['C3', 'G3', 'E4', 'G4', 'C5'], 0.06, a=2, r=6, bright=3)

# pulses (heartbeat / ostinato) in tense chapters
pulse = np.zeros(N, np.float32)
def thump(f0=55, dur=0.5, drop=0.6):
    n = int(dur * SR); tt = np.arange(n) / SR
    f = f0 * (1 + drop * np.exp(-tt * 18)); ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) * np.exp(-tt * 7)).astype(np.float32)
for (a, b, bpm, g) in [(262, 320, 60, 0.28), (320.5, 430, 76, 0.33), (430.5, 505, 92, 0.38), (505.5, 540.5, 120, 0.42)]:
    x = a; k = 0
    while x < b:
        place(pulse, thump(), x, g * (1 if k % 2 == 0 else 0.6)); x += 60 / bpm; k += 1
music_L += pulse; music_R += pulse

# chapter hits + risers
hits = np.zeros(N, np.float32)
def boom(dur=4.0, f0=48):
    n = int(dur * SR); tt = np.arange(n) / SR
    f = f0 * (1 + 1.2 * np.exp(-tt * 9)); s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 1.4)
    nz = np.random.default_rng(3).standard_normal(n) * np.exp(-tt * 5)
    nz = fftfilt_short(nz, hi=900)
    return (s * 0.9 + nz * 0.5).astype(np.float32)
def riser(dur=3.0):
    n = int(dur * SR); tt = np.arange(n) / SR
    nz = np.random.default_rng(5).standard_normal(n)
    hi = fftfilt_short(nz, lo=2000) ; lo = fftfilt_short(nz, lo=300, hi=2000)
    e = (tt / dur) ** 2.5
    return ((hi * e + lo * e * 0.5) * 0.5).astype(np.float32)
for c in ev['ev']['chapters']:
    place(hits, riser(2.6), c['t'] - 2.6, 0.18); place(hits, boom(), c['t'], 0.55)
place(hits, riser(3.5), 42.8, 0.2); place(hits, boom(6, 40), 46.2, 0.8)
music_L += hits; music_R += hits

# end music before the whiteout and duck during it
mus_env = env_lin([(0, 1), (540.0, 1), (540.6, 0), (550, 0), (552, 1), (668, 1)])
music_L *= mus_env; music_R *= mus_env
music_L = fftfilt(music_L, hi=7000); music_R = fftfilt(music_R, hi=7000)
music_L = reverb(music_L, 4.0, seed=11, wet=0.45); music_R = reverb(music_R, 4.0, seed=12, wet=0.45)
print('music done', flush=True)

# ---------- AMBIENCE / SFX ----------
shake, wind, amp, level = curve('shake'), curve('wind'), curve('amp'), curve('level')
meteors, flashes, fire, white, chaos = curve('meteors'), curve('flashes'), curve('fire'), curve('white'), curve('chaos')
collapse = curve('collapse')
is_city = np.interp(t, ct, np.array([1.0 if a['shot'] not in ('title', 'scale', 'graph', 'white', 'aftermath', 'origin', 'roche-space') else 0.0 for a in arr])).astype(np.float32)
is_space = np.interp(t, ct, np.array([1.0 if a['shot'] in ('title', 'scale', 'aftermath', 'origin', 'roche-space') else 0.0 for a in arr])).astype(np.float32)
watch = np.interp(t, ct, np.array([1.0 if a['crowd'] == 'watch' else 0.0 for a in arr])).astype(np.float32)
walk = np.interp(t, ct, np.array([1.0 if a['crowd'] == 'walk' else 0.0 for a in arr])).astype(np.float32)
run = np.interp(t, ct, np.array([1.0 if a['crowd'] == 'run' else 0.0 for a in arr])).astype(np.float32)
traffic = curve('traffic')
day = shot_env(['day1a', 'day1b', 'tide', 'quake'])
night = shot_env(['open', 'night2', 'night2b', 'calm'])

amb = [np.zeros(N, np.float32), np.zeros(N, np.float32)]
for ch in (0, 1):
    s = 100 + ch
    # city room tone / distant traffic
    hum = fftfilt(noise(s), lo=40, hi=400) * 0.05
    amb[ch] += hum * is_city * (0.4 + 0.6 * np.clip(traffic, 0, 1)) * (night * 0.7 + day * 1.0 + 0.3)
    # ocean waves (slow swell)
    sw = 0.55 + 0.45 * np.sin(2 * np.pi * t / (7.5 + ch) + ch)
    sea = fftfilt(noise(s + 10), lo=150, hi=1800) * 0.09 * sw
    amb[ch] += sea * is_city * np.clip(0.35 + amp * 0.6, 0, 1.8)
    # rushing flood water
    rush = fftfilt(noise(s + 20), lo=500, hi=6000) * 0.05
    amb[ch] += rush * is_city * np.clip((level - 2.0) / 3, 0, 1)
    # wind: two bands with swirling gains
    w1 = fftfilt(noise(s + 30), lo=200, hi=700); w2 = fftfilt(noise(s + 40), lo=700, hi=2500)
    m1 = 0.5 + 0.5 * np.sin(2 * np.pi * 0.21 * t + ch); m2 = 0.5 + 0.5 * np.sin(2 * np.pi * 0.33 * t + 2 + ch)
    amb[ch] += (w1 * m1 * 0.16 + w2 * m2 * 0.08) * (wind ** 1.3) * is_city
    # night insects / breeze
    amb[ch] += fftfilt(noise(s + 50), lo=3000, hi=7000) * 0.006 * night * (0.6 + 0.4 * np.sin(2 * np.pi * 3.1 * t))
    # crowd murmur
    mur = fftfilt(noise(s + 60), lo=300, hi=2500)
    am = np.clip(fftfilt(noise(s + 70), hi=5) * 6 + 0.6, 0.1, 1.5)
    amb[ch] += mur * am * 0.045 * (watch * 1.0 + walk * 0.5 * day) * is_city
    # panic crowd (louder, higher)
    scream = fftfilt(noise(s + 80), lo=700, hi=3500) * np.clip(fftfilt(noise(s + 90), hi=3) * 8 + 0.3, 0, 2)
    amb[ch] += scream * 0.035 * run
    # quake rumble
    rum = brown(s + 100) * 0.9
    amb[ch] += fftfilt(rum, hi=110) * 3.0 * np.clip(shake, 0, 2) ** 1.2
    # fire roar / atmospheric heating
    roar = fftfilt(noise(s + 110), lo=60, hi=900) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.7 * t))
    amb[ch] += roar * 0.22 * fire + fftfilt(noise(s + 115), lo=40, hi=200) * 0.25 * meteors
    # space hum
    amb[ch] += fftfilt(noise(s + 120), lo=30, hi=160) * 0.08 * is_space
print('ambience done', flush=True)

sfx = np.zeros(N, np.float32)
def crash(dur=2.5, seed=0):
    n = int(dur * SR); tt = np.arange(n) / SR; r = np.random.default_rng(seed)
    nz = r.standard_normal(n) * (np.exp(-tt * 2.5) + 0.3 * np.exp(-tt * 0.8))
    crackle = (r.random(n) < 0.004 * np.exp(-tt * 1.5)) * r.standard_normal(n) * 4
    return (fftfilt_short(nz, lo=60, hi=3000) * 0.8 + fftfilt_short(crackle, lo=800) * 0.4 + boom(dur, 38)[:n] * 0.6).astype(np.float32)
def whoosh(dur=1.2, seed=0):
    n = int(dur * SR); tt = np.arange(n) / SR; r = np.random.default_rng(seed)
    nz = r.standard_normal(n); e = np.sin(np.pi * np.clip(tt / dur, 0, 1)) ** 2
    hi = fftfilt_short(nz, lo=1500, hi=6000) * np.exp(-tt * 2.0); lo = fftfilt_short(nz, lo=150, hi=1500) * (tt / dur)
    return ((hi + lo) * e * 0.6).astype(np.float32)
# building collapses: whenever collapse increases by a step
r = np.random.default_rng(42)
last = 0.0
for a in arr:
    if a['collapse'] - last > 0.06: place(sfx, crash(3.0, int(a['t'] * 10)), a['t'], 0.55); last = a['collapse']
# meteors whooshes & distant booms
tt0 = 0.0
while tt0 < D:
    i = int(tt0 * 10)
    if i < len(arr):
        m = arr[i]['meteors']; fl = arr[i]['flashes']
        if m > 0.02 and r.random() < m * 0.5: place(sfx, whoosh(0.8 + r.random(), int(tt0 * 100)), tt0, 0.25 + 0.3 * r.random())
        if fl > 0.02 and r.random() < fl * 0.35: place(sfx, boom(3.0, 30 + 20 * r.random()), tt0, 0.35 * fl)
    tt0 += 0.12
# power cut thunk in the flood shot
for s in shots:
    if s['name'] == 'flood': place(sfx, boom(1.2, 70), s['t0'] + 44, 0.35)
    if s['name'] == 'open': place(sfx, boom(5, 32), s['t0'] + 30.5, 0.35)  # the Moon "stops"
# final impact: huge boom just before white, tinnitus during white
place(sfx, boom(7.5, 30), 539.6, 1.3)
place(sfx, crash(5, 999), 539.8, 0.9)
n = int(8.5 * SR); tt = np.arange(n) / SR
place(sfx, (np.sin(2 * np.pi * 6200 * tt) * 0.02 * np.exp(-tt / 3)).astype(np.float32), 541, 1.0)
# aftermath: deep magma rumble
amb[0] += fftfilt(brown(901), hi=90) * 1.6 * shot_env(['aftermath', 'origin'], 3)
amb[1] += fftfilt(brown(902), hi=90) * 1.6 * shot_env(['aftermath', 'origin'], 3)

sil = env_lin([(0, 1), (540.4, 1), (541.0, 0.0), (547, 0.0), (550, 1), (668, 1)])
L = (music_L * 0.9 + (amb[0] + sfx) * sil)
R = (music_R * 0.9 + (amb[1] + sfx) * sil)
# global fades
fade = env_lin([(0, 0), (1.5, 1), (D - 4, 1), (D, 0)])
L *= fade; R *= fade
pk = max(np.abs(L).max(), np.abs(R).max())
L /= pk / 0.89; R /= pk / 0.89
st = np.stack([L, R], 1)
st = (np.clip(st, -1, 1) * 32767).astype(np.int16)
with wave.open('out/soundtrack.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(st.tobytes())
print('wrote out/soundtrack.wav', D, 's')
