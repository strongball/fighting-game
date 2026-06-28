#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
程序化音效合成器（取代 public/assets/sfx 下的純振盪器佔位音）。

設計目標：擬真厚重、且**每個角色的四個技能各有專屬音色**。
靠的是「真 SFX」做法而非單一正弦：
  - transient 起音（噪音爆點 / 點擊）讓出手有咬勁，不再呆呆的。
  - 掃頻空氣聲（STFT time-varying bandpass of noise）做揮空 / 火球 / 衝刺的 whoosh。
  - 加法金屬泛音（inharmonic partials）做刀劍、鐘鳴、冰晶。
  - pitch envelope（下滑=撞擊、上揚=蓄力）、軟削波（厚度/侵略性）、短殘響（空間）。

近戰重量：金屬泛音用「低基頻 + 近諧波比 + 短衰減 + 強低頻 body」，避免像玻璃杯的高泛音。
非刀兵：坦克盾擊 / 聖騎聖槌走鈍器/大地家族（低頻砰＋悶金屬），不帶刀刃鏜鏗。

純 numpy（無 scipy）；濾波用 FFT 頻域、掃頻用 STFT。輸出 16-bit mono 44.1k WAV。
檔名 = renderer 期望的鍵：泛型 swing/cast/...，每角色每招 <charId>_<slot>（slot ∈ basic/skill1/skill2/ultimate）。
確定性（依名 seed），可重跑。不帶參數＝全部重生並清掉孤兒檔。

用法：  python3 tools/gen_sfx.py                  # 產生全部（並清孤兒）
       python3 tools/gen_sfx.py warrior_basic cast    # 只產生指定幾個
"""

import os
import sys
import wave
import hashlib
import numpy as np

SR = 44100
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'sfx')
KEEP_ALWAYS = {'README'}  # 非 .wav，不掃

# ───────────────────────── DSP 基礎工具 ─────────────────────────

def n_samp(dur):
    return max(1, int(round(dur * SR)))

def t_axis(dur):
    return np.arange(n_samp(dur)) / SR

def seed_for(name):
    return int(hashlib.md5(name.encode()).hexdigest()[:8], 16)

def rng(name, salt=''):
    return np.random.default_rng(seed_for(name + salt))

def to_len(x, n):
    if len(x) >= n:
        return x[:n]
    return np.concatenate([x, np.zeros(n - len(x))])

def mix(*layers):
    n = max(len(l) for l in layers)
    out = np.zeros(n)
    for l in layers:
        out += to_len(l, n)
    return out

def place(layer, at, total=None):
    off = n_samp(at)
    n = (n_samp(total) if total else off + len(layer))
    out = np.zeros(max(n, off + len(layer)))
    out[off:off + len(layer)] += layer
    return out

def glide(f0, f1, dur, curve='exp'):
    x = np.linspace(0, 1, n_samp(dur))
    if curve == 'exp':
        return f0 * (f1 / f0) ** x
    return f0 + (f1 - f0) * x

def osc(freq, dur, kind='sine', phase0=0.0):
    n = n_samp(dur)
    f = np.asarray(freq, dtype=float)
    if f.ndim == 0:
        ph = 2 * np.pi * float(f) * (np.arange(n) / SR) + phase0
    else:
        f = np.interp(np.linspace(0, 1, n), np.linspace(0, 1, len(f)), f)
        ph = 2 * np.pi * np.cumsum(f) / SR + phase0
    if kind == 'sine':
        return np.sin(ph)
    if kind == 'tri':
        return 2 / np.pi * np.arcsin(np.sin(ph))
    if kind == 'saw':
        return 2 * (ph / (2 * np.pi) - np.floor(0.5 + ph / (2 * np.pi)))
    if kind == 'square':
        return np.sign(np.sin(ph))
    raise ValueError(kind)

def noise(dur, name='n', salt=''):
    return rng(name, salt).uniform(-1, 1, n_samp(dur))

# ── 包絡 ──

def perc(dur, atk=0.002, tau=0.08, curve=1.0):
    t = t_axis(dur)
    na = n_samp(atk)
    env = np.exp(-t / max(tau, 1e-4)) ** curve
    if na > 1:
        env[:na] *= np.linspace(0, 1, na)
    return env

def swell(dur, atk=0.4, rel=0.6, shape=1.5):
    n = n_samp(dur)
    na = max(1, int(n * atk / (atk + rel)))
    nr = max(1, n - na)
    a = np.linspace(0, 1, na) ** shape
    r = np.linspace(1, 0, nr) ** shape
    return np.concatenate([a, r])[:n]

def adsr(dur, a=0.01, d=0.1, s=0.6, r=0.2):
    n = n_samp(dur)
    na, nd, nr = n_samp(a), n_samp(d), n_samp(r)
    ns = max(0, n - na - nd - nr)
    seg = np.concatenate([
        np.linspace(0, 1, max(1, na)),
        np.linspace(1, s, max(1, nd)),
        np.full(ns, s),
        np.linspace(s, 0, max(1, nr)),
    ])
    return to_len(seg, n)

# ── 濾波（FFT 頻域，零相位）──

def spec_filter(x, hp=None, lp=None, slope=4):
    N = len(x)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(N, 1 / SR)
    g = np.ones_like(f)
    if hp:
        g *= 1.0 / (1.0 + (hp / np.maximum(f, 1e-6)) ** slope)
    if lp:
        g *= 1.0 / (1.0 + (f / lp) ** slope)
    return np.fft.irfft(X * g, n=N)

def tv_bandpass(x, fc_env, q=2.5):
    frame, hop = 1024, 256
    win = np.hanning(frame)
    N = len(x)
    pad = np.concatenate([np.zeros(frame), x, np.zeros(frame)])
    out = np.zeros(len(pad))
    wsum = np.zeros(len(pad))
    freqs = np.fft.rfftfreq(frame, 1 / SR)
    fc_arr = np.atleast_1d(np.asarray(fc_env, float))
    n_frames = 1 + (len(pad) - frame) // hop
    for i in range(n_frames):
        s = i * hop
        seg = pad[s:s + frame] * win
        pos = min(1.0, max(0.0, (s + frame / 2 - frame) / max(1, N)))
        fc = float(np.interp(pos, np.linspace(0, 1, len(fc_arr)), fc_arr)) if len(fc_arr) > 1 else float(fc_arr[0])
        bw = max(60.0, fc / q)
        g = np.exp(-0.5 * ((freqs - fc) / bw) ** 2)
        spec = np.fft.rfft(seg) * g
        out[s:s + frame] += np.fft.irfft(spec, n=frame) * win
        wsum[s:s + frame] += win ** 2
    out = out / np.maximum(wsum, 1e-6)
    return out[frame:frame + N]

# ── 非線性 / 空間 / 收尾 ──

def softclip(x, drive=2.0):
    return np.tanh(drive * x) / np.tanh(drive)

def hishelf(x, freq=3000, gain=0.4, width=1.0):
    # 高頻 shelf 衰減：freq 以上的能量乘以 gain（<1 = 減量），平滑過渡。
    # 用來「去刺耳」——只壓高頻、不動低中頻，暗的音幾乎不受影響。
    N = len(x)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(N, 1 / SR)
    t = 1.0 / (1.0 + (freq / np.maximum(f, 1e-6)) ** (2 * width))  # 0(低)→1(高)
    g = 1.0 - (1.0 - gain) * t
    return np.fft.irfft(X * g, n=N)

def fftconv(x, h):
    N = len(x) + len(h) - 1
    nf = 1 << (N - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, nf) * np.fft.rfft(h, nf), nf)[:N]

def reverb(x, decay=0.2, mix_amt=0.16, name='r', hp=300):
    ir = noise(decay, name, 'ir') * np.exp(-t_axis(decay) / (decay * 0.4))
    ir = spec_filter(ir, hp=hp, lp=7000)
    wet = to_len(fftconv(x, ir), len(x))
    return x * (1 - mix_amt) + wet * mix_amt

def metallic(dur, base, partials, name='m'):
    t = t_axis(dur)
    out = np.zeros(n_samp(dur))
    for ratio, amp, tau in partials:
        out += amp * np.sin(2 * np.pi * base * ratio * t) * np.exp(-t / tau)
    return out

def karplus(freq, dur, damp=0.5, name='k'):
    n = n_samp(dur)
    N = max(2, int(SR / freq))
    buf = rng(name, 'kp').uniform(-1, 1, N).astype(float)
    out = np.zeros(n)
    idx = 0
    for i in range(n):
        out[i] = buf[idx]
        nxt = (idx + 1) % N
        buf[idx] = damp * 0.5 * (buf[idx] + buf[nxt])
        idx = nxt
    return out

def fade(x, ms_in=2.0, ms_out=8.0):
    ni, no = n_samp(ms_in / 1000), n_samp(ms_out / 1000)
    x = x.copy()
    if ni > 1:
        x[:ni] *= np.linspace(0, 1, ni)
    if no > 1:
        x[-no:] *= np.linspace(1, 0, no)
    return x

def normalize(x, peak=0.9):
    m = np.max(np.abs(x))
    if m < 1e-9:
        return x
    return x / m * peak

# 感知響度正規化：以「中頻(350Hz–6kHz)能量」為準，而非峰值。
# 原因：戰士/衝擊類能量多在 <300Hz sub-bass，筆電/手機喇叭放不出來、耳朵也較不敏感，
# 用 peak 正規化會「峰高但聽起來很小聲」。改用中頻 RMS 對齊 → 每個音聽起來一樣響。
TARGET_MID_RMS = 0.16  # 中頻目標響度（提高＝整體更大聲）

def mid_rms(x):
    return float(np.sqrt(np.mean(spec_filter(x, hp=350, lp=6000) ** 2)))

def soft_limit(x, ceiling=0.97, drive=1.12):
    # tanh 軟限幅：把峰壓進 ceiling，同時增加密度與諧波（含 sub 的諧波→小喇叭也聽得到低頻衝擊）。
    return np.tanh(x / ceiling * drive) * ceiling

def finalize(x, fade_out=12.0, loud=1.0, max_gain=6.0):
    x = fade(np.asarray(x, dtype=float), 2.0, fade_out)
    m = mid_rms(x)
    if m > 1e-6:
        x = x * min(max_gain, TARGET_MID_RMS * loud / m)
    x = soft_limit(x, 0.97)
    peak = np.max(np.abs(x))
    if peak > 0.985:
        x *= 0.985 / peak
    return x

# ── 常用組件（重量導向）──

def body_thump(name, dur, f0=128, f1=56, amp=1.0, tau_frac=0.34):
    return osc(glide(f0, f1, dur), dur, 'sine') * perc(dur, 0.003, dur * tau_frac) * amp

def lowmid_impact(name, dur, lo=180, hi=600, amp=0.5, tau=0.06):
    return spec_filter(noise(dur, name, 'lm'), hp=lo, lp=hi) * perc(dur, 0.001, tau) * amp

def metal_ring(name, dur, base, ratios, amp, tau):
    parts = [(r, 1.0 / (i + 1), tau * (1 - 0.12 * i)) for i, r in enumerate(ratios)]
    return metallic(dur, base, parts, name) * perc(dur, 0.001, tau * 0.9) * amp

def whoosh(name, dur=0.34, f_lo=180, f_hi=1500, down=True, q=2.2, body=0.0, gain=1.0):
    nz = noise(dur, name, 'wh')
    if down:
        fc = np.concatenate([glide(f_lo, f_hi, dur * 0.45), glide(f_hi, f_lo * 0.7, dur * 0.55)])
    else:
        fc = glide(f_lo, f_hi, dur)
    air = tv_bandpass(nz, fc, q=q) * swell(dur, 0.45, 0.55, 1.6) * gain
    if body > 0:
        air = mix(air, body_thump(name, dur, 150, 70, body, 0.4))
    return air

# ───────────────────────── 音色家族（重做：重 / 分刀鈍） ─────────────────────────

# 近戰：刀刃（低基頻近諧波金屬 + 強 body，不再玻璃感）
def swing_blade(name, dur=0.34, weight=1.2, bright=1.0, edge=0.3, ring_base=440,
                ratios=(1, 2.0, 2.96), hiss=0.0):
    cut = whoosh(name, dur, 140 * bright, 1500 * bright, q=2.2)
    body = body_thump(name, dur * 0.85, 126, 54, 0.85 * weight, 0.36)
    meat = lowmid_impact(name, dur * 0.7, 170, 560, 0.5 * weight, 0.07)
    ring = place(metal_ring(name, dur * 0.9, ring_base * bright, ratios, edge, dur * 0.5), dur * 0.1, dur)
    layers = [cut, body, meat, ring]
    if hiss > 0:
        layers.append(spec_filter(noise(dur, name, 'hs'), hp=4000, lp=11000) * swell(dur, 0.3, 0.7) * hiss)
    return reverb(softclip(mix(*layers), 2.2), 0.15, 0.1, name)

# 近戰：鈍器/盾（無刀刃高泛音；低悶金屬 clang + 重 body）
def swing_blunt(name, dur=0.34, weight=1.5, clang_base=240, clang_amt=0.4,
                clang_ratios=(1, 1.5, 2.2, 3.0), dull=0.0):
    cut = whoosh(name, dur, 110, 820, q=1.8)
    body = body_thump(name, dur, 96, 44, 1.0 * weight, 0.42)
    whump = lowmid_impact(name, dur, 130, 470, 0.6 * weight, 0.08)
    clang = place(metal_ring(name, dur, clang_base, clang_ratios, clang_amt, dur * 0.45), dur * 0.09, dur)
    layers = [cut, body, whump, clang]
    if dull > 0:  # 沉悶大鎚 "dong"
        layers.append(osc(glide(175, 150, dur), dur, 'sine') * perc(dur, 0.002, dur * 0.4) * dull)
    return reverb(softclip(mix(*layers), 2.4), 0.18, 0.13, name)

def swing_axe(name, dur=0.36, weight=1.4, double=False):
    a = mix(whoosh(name, dur, 150, 1300, q=2.0),
            body_thump(name, dur * 0.85, 120, 50, 0.9 * weight, 0.34),
            lowmid_impact(name, dur, 160, 560, 0.55 * weight, 0.07),
            place(metal_ring(name, dur * 0.7, 380, (1, 2.05, 3.0), 0.25, dur * 0.35), dur * 0.1, dur))
    if double:
        a = mix(a, place(whoosh(name + '2', dur * 0.7, 130, 1100, q=2.0) * 0.85, dur * 0.26),
                place(body_thump(name + '2', dur * 0.6, 110, 48, 0.7 * weight, 0.3), dur * 0.28, dur))
    return reverb(softclip(a, 2.3), 0.15, 0.11, name)

def thrust(name, dur=0.3):
    air = whoosh(name, dur, 200, 1700, down=False, q=3.0)
    tip = place(metal_ring(name, 0.18, 560, (1, 2.0, 3.0), 0.3, 0.12), dur * 0.48, dur)
    body = body_thump(name, dur * 0.6, 130, 62, 0.5, 0.3)
    return reverb(softclip(mix(air, tip, body), 2.0), 0.13, 0.1, name)

def chain(name, dur=0.5):
    # 鎖鏈鉤爪：甩鏈 whoosh → 大量「鏈環互撞」高頻嘩啦聲（密集、不規則、短促）→ 鉤爪咬合 clank。
    r = rng(name, 'chain')
    throw = whoosh(name, dur * 0.7, 180, 1400, q=2.0) * 0.45  # 甩出去的風聲
    rattle = np.zeros(n_samp(dur))
    for i in range(24):  # 24 個鏈環各自一聲極短金屬碰撞，疊出「嘩啦啦」
        at = r.random() * dur * 0.78
        f = 1700 + r.random() * 2800
        click = spec_filter(noise(0.028, name + str(i), 'k'), hp=f * 0.6, lp=min(15000, f * 2.6)) * perc(0.028, 0.0004, 0.011)
        ring = metallic(0.045, f, [(1, 0.6, 0.028), (2.7, 0.3, 0.018)], name + str(i)) * perc(0.045, 0.0004, 0.018)
        link = mix(click * 0.6, ring * 0.4) * (0.45 + 0.55 * r.random())
        rattle = mix(rattle, place(link, at, dur))
    rattle *= 0.55
    weight = body_thump(name, dur * 0.5, 125, 68, 0.3, 0.3)  # 鐵鏈本身的重量
    clank = metal_ring(name, 0.18, 500, (1, 1.8, 2.6), 0.5, 0.12) * 0.6  # 鉤爪咬合
    out = mix(throw, rattle, weight, place(clank, dur * 0.6, dur))
    return reverb(softclip(out, 1.7), 0.18, 0.16, name)

def punch(name, dur=0.2, low=0.9):
    air = whoosh(name, dur, 170, 1200, q=2.0) * 0.7
    snap = spec_filter(noise(dur * 0.5, name, 'sn'), hp=1200, lp=6000) * perc(dur * 0.5, 0.001, 0.03) * 0.8
    thud = body_thump(name, dur, 170, 80, low, 0.45)
    return reverb(softclip(mix(air, snap, thud), 2.0), 0.12, 0.1, name)

def multipunch(name, dur=0.42, hits=4, low=0.85):
    out = np.zeros(n_samp(dur))
    for i in range(hits):
        out = mix(out, place(punch(name + str(i), 0.14, low) * (0.92 ** i), i * (dur * 0.82 / hits), dur))
    return out

# 投射 / 遠程
def bowshot(name, dur=0.3, twang=440, rapid=False, heavy=False):
    string = karplus(twang, dur * 0.5, damp=0.45, name=name) * perc(dur * 0.5, 0.001, dur * 0.18) * (0.85 if heavy else 0.7)
    air = whoosh(name, dur, 600 if not heavy else 400, 3200, down=False, q=3.0) * (0.5 if rapid else 0.7)
    creak = spec_filter(noise(dur * 0.3, name, 'cr'), hp=1800, lp=7000) * perc(dur * 0.3, 0.001, 0.04) * 0.3
    out = mix(place(string, 0.0, dur), place(air, dur * 0.12, dur), place(creak, 0.0, dur))
    return reverb(out, 0.12, 0.08, name)

def gunshot(name, dur=0.32, caliber=1.0):
    crack = spec_filter(noise(dur * 0.4, name, 'gc'), hp=1500, lp=14000) * perc(dur * 0.4, 0.0005, 0.012) * 1.0
    boom = osc(glide(220 * caliber, 60, dur), dur, 'sine') * perc(dur, 0.001, dur * 0.4) * 0.9
    mid = spec_filter(noise(dur * 0.6, name, 'gm'), hp=300, lp=2500) * perc(dur * 0.6, 0.001, dur * 0.25) * 0.5
    return reverb(softclip(mix(crack, boom * caliber, mid), 2.2), 0.2, 0.16, name)

def multigun(name, dur, shots, caliber=0.9):
    out = np.zeros(n_samp(dur))
    r = rng(name, 'mg')
    for i in range(shots):
        out = mix(out, place(gunshot(name + str(i), 0.24, caliber) * (0.9 + 0.1 * r.random()),
                             i * (dur * 0.9 / shots) + r.random() * 0.006, dur))
    return out

def incendiary(name, dur=0.4):
    shot = spec_filter(gunshot(name, 0.3, 1.0), lp=3000) * 0.85
    fire = fire_breath(name + 'f', dur) * 0.4
    return mix(shot, place(fire, 0.05, dur))

def shuriken(name, dur=0.26):
    # 壓低旋轉嘯聲與金屬基頻，加一點低頻 body，不再尖。
    spin = whoosh(name, dur, 500, 2400, down=False, q=3.2)
    metal = metal_ring(name, 0.2, 1500, (1, 2.0, 3.0), 0.3, 0.1)
    body = body_thump(name, dur * 0.5, 140, 80, 0.25, 0.3)
    return reverb(mix(spin, place(metal, 0.02, dur), body), 0.12, 0.1, name)

# 施法（元素質感）
def cast(name, dur=0.4, element='arcane', pitch=1.0, gain=1.0):
    base = 320 * pitch
    layers = []
    if element in ('arcane', 'cosmic'):
        tone = (osc(glide(base, base * 1.6, dur), dur, 'sine')
                + 0.5 * osc(glide(base * 2.01, base * 3.2, dur), dur, 'sine')
                + 0.3 * osc(glide(base * 3.0, base * 4.8, dur), dur, 'tri'))
        layers.append(tone * swell(dur, 0.55, 0.45, 1.4) * 0.5)
        layers.append(spec_filter(noise(dur, name, 'sh'), hp=2500, lp=9000) * swell(dur, 0.6, 0.4) * 0.25)
    if element == 'fire':
        layers.append(whoosh(name, dur, 200, 1800, q=1.8) * 0.7)
        crackle = spec_filter(noise(dur, name, 'fc'), hp=1500, lp=8000)
        crackle *= (rng(name, 'fk').random(n_samp(dur)) > 0.985).astype(float)
        layers.append(crackle * 0.6)
        layers.append(body_thump(name, dur, 120, 60, 0.5, 0.4))
    if element == 'ice':
        layers.append(metal_ring(name, dur, 1000 * pitch, (1, 2.4, 3.8, 6.1), 0.5, dur * 0.5))
        layers.append(spec_filter(noise(dur, name, 'ic'), hp=5000, lp=13000) * swell(dur, 0.3, 0.7) * 0.2)
    if element == 'dark':
        g = (osc(glide(base * 0.5, base * 0.42, dur), dur, 'saw')
             + osc(glide(base * 0.505, base * 0.43, dur), dur, 'saw'))
        layers.append(spec_filter(g, lp=1400) * swell(dur, 0.4, 0.6) * 0.4)
        layers.append(spec_filter(noise(dur, name, 'dk'), hp=600, lp=3000) * swell(dur, 0.5, 0.5) * 0.35)
        layers.append(osc(glide(70, 48, dur), dur, 'sine') * swell(dur, 0.3, 0.7) * 0.5)
    out = mix(*layers) * gain
    return reverb(softclip(out, 1.4), 0.2, 0.16, name)

def magic_bolt(name, dur=0.34, element='arcane', pitch=1.0):
    c = cast(name, dur * 0.75, element, pitch)
    zip_ = whoosh(name + 'z', dur, 600 * pitch, 2600 * pitch, down=False, q=3.5) * 0.4
    return mix(c, place(zip_, dur * 0.4, dur))

def fire_breath(name, dur=0.5):
    roar = tv_bandpass(noise(dur, name, 'fb'), glide(300, 900, dur), q=1.2) * swell(dur, 0.3, 0.7) * 0.7
    crackle = spec_filter(noise(dur, name, 'fc'), hp=1500, lp=8000) * (rng(name, 'fk').random(n_samp(dur)) > 0.95) * 0.5
    low = osc(glide(110, 70, dur), dur, 'sine') * swell(dur, 0.3, 0.7) * 0.5
    return reverb(softclip(mix(roar, crackle, low), 1.8), 0.22, 0.18, name)

def ice_spear(name, dur=0.4):
    form = metal_ring(name, dur, 900, (1, 2.3, 3.7, 5.2), 0.45, dur * 0.5)  # 冰本來就脆，允許玻璃感
    shoot = whoosh(name, dur, 600, 2800, down=False, q=3.5) * 0.4
    crackle = spec_filter(noise(dur, name, 'ic'), hp=4000, lp=12000) * perc(dur, 0.001, 0.1) * 0.2
    return reverb(softclip(mix(form, place(shoot, dur * 0.4, dur), crackle), 1.5), 0.18, 0.16, name)

def lightning(name, dur=0.5):
    zap = spec_filter(noise(dur, name, 'lz'), hp=2000, lp=12000)
    zap *= (0.4 + 0.6 * (rng(name, 'lk').random(n_samp(dur)) > 0.7))
    crack = lowmid_impact(name, dur, 200, 2000, 0.5, 0.03)
    thunder = osc(glide(120, 50, dur), dur, 'sine') * swell(dur, 0.2, 0.8) * 0.4
    return reverb(softclip(mix(zap * swell(dur, 0.15, 0.85) * 0.55, crack, thunder), 1.8), 0.25, 0.2, name)

# 聖光 / 增益 / 音樂
def holy(name, dur=0.6, bright=1.0, pitch=1.0, choir=0.0,
         shimmer=0.15, shimmer_hp=4000, top=0.18, warm=0.0, lp=None):
    # 柔化旋鈕（預設＝原本音色，聖騎/吟遊不受影響）：
    #   top      最高泛音(5.4×)的量 → 調低=不刺耳    shimmer/shimmer_hp 高頻噪音閃光量與起點
    #   warm     疊一個低八度暖音墊 → 厚而不尖        lp 整體低通(柔化頂端)
    base = 520 * pitch
    bell = metallic(dur, base, [(1, .7, dur * .9), (2, .5, dur * .7), (3, .35, dur * .5),
           (4.2, .25, dur * .4), (5.4 * bright, top, dur * .3)], name) * swell(dur, 0.05, 0.95, 1.2)
    sh = spec_filter(noise(dur, name, 'hs'), hp=shimmer_hp * bright, lp=14000) * swell(dur, 0.2, 0.8) * shimmer
    layers = [bell * 0.6, sh]
    if choir > 0:
        pad = (osc(base, dur, 'sine') + 0.6 * osc(base * 1.5, dur, 'sine') + 0.5 * osc(base * 2.0, dur, 'sine'))
        layers.append(spec_filter(pad * adsr(dur, 0.15, 0.2, 0.7, 0.3), lp=4000) * 0.25 * choir)
    if warm > 0:
        warmpad = (osc(base * 0.5, dur, 'sine') + 0.5 * osc(base * 0.75, dur, 'sine')) * adsr(dur, 0.1, 0.25, 0.75, 0.35)
        layers.append(warmpad * 0.4 * warm)
    out = mix(*layers)
    if lp:
        out = spec_filter(out, lp=lp)
    return reverb(out, 0.4, 0.3, name, hp=600)

def buff_swell(name, dur=0.55, element='arcane', pitch=1.0, rising=True):
    base = 200 * pitch
    f = glide(base, base * 2.2, dur) if rising else glide(base * 1.6, base, dur)
    pad = osc(f, dur, 'saw') + 0.5 * osc(np.asarray(f) * 1.5, dur, 'saw')
    cut = glide(400, 4500, dur) if rising else glide(3000, 700, dur)
    pad = tv_bandpass(pad, cut, q=1.4) * swell(dur, 0.4, 0.6, 1.3)
    spark = spec_filter(noise(dur, name, 'bs'), hp=3000, lp=11000) * swell(dur, 0.6, 0.4) * 0.2
    layers = [pad * 0.55, spark]
    if element == 'fire':
        layers.append(osc(glide(80, 130, dur), dur, 'sine') * swell(dur, 0.5, 0.5) * 0.4)
    if element == 'holy':
        layers.append(metal_ring(name, dur, 660 * pitch, (1, 2, 3), 0.3, dur * 0.6) * swell(dur, 0.3, 0.7))
    if element == 'dark':
        layers.append(osc(glide(55, 70, dur), dur, 'sine') * swell(dur, 0.4, 0.6) * 0.5)
    return reverb(softclip(mix(*layers), 1.5), 0.25, 0.2, name)

def chord_swell(name, dur=0.6, root=220, bright=1.0):
    pad = np.zeros(n_samp(dur))
    for r in (1, 1.26, 1.5, 2.0):  # 大三和弦 + 八度
        pad = mix(pad, osc(root * r, dur, 'saw') * 0.25)
    pad = tv_bandpass(pad, glide(400, 3500 * bright, dur), q=1.3) * swell(dur, 0.4, 0.6, 1.3)
    spark = spec_filter(noise(dur, name, 'an'), hp=4000, lp=12000) * swell(dur, 0.6, 0.4) * 0.15
    return reverb(softclip(mix(pad * 0.5, spark), 1.5), 0.3, 0.26, name)

def harp_chord(name, dur=0.5, freqs=(330, 415, 494, 659)):
    out = np.zeros(n_samp(dur))
    for i, f in enumerate(freqs):
        out = mix(out, place(karplus(f, dur * 0.8, 0.46, name + str(i)) * perc(dur * 0.8, 0.001, 0.3) * 0.5 * (0.9 ** i), i * 0.025, dur))
    return reverb(mix(out, holy(name + 'h', dur, 1.0, 1.2) * 0.15), 0.35, 0.3, name)

def sonic_pulse(name, dur=0.4):
    pluck = karplus(294, dur * 0.6, 0.42, name) * perc(dur * 0.6, 0.001, 0.25) * 0.6
    ring = (osc(294, dur, 'sine') + 0.5 * osc(588, dur, 'sine')) * perc(dur, 0.005, dur * 0.4) * 0.3
    pulse = osc(glide(220, 110, dur), dur, 'sine') * swell(dur, 0.05, 0.95) * 0.3
    return reverb(mix(place(pluck, 0, dur), ring, pulse), 0.2, 0.18, name)

# 召喚 / 暗系
def summon(name, dur=0.7, dark=True):
    rumble = osc(glide(45, 70, dur), dur, 'sine') * swell(dur, 0.3, 0.7) * 0.8
    rumble += osc(glide(46, 71, dur), dur, 'tri') * swell(dur, 0.3, 0.7) * 0.3
    sweep = tv_bandpass(noise(dur, name, 'su'), glide(200, 2400, dur), q=1.8) * swell(dur, 0.5, 0.5) * 0.4
    ether = (osc(glide(300, 500, dur), dur, 'sine') + 0.5 * osc(glide(450, 760, dur), dur, 'sine')) * swell(dur, 0.4, 0.6) * 0.25
    if dark:
        ether = spec_filter(ether, lp=2500)
    return reverb(softclip(mix(rumble, sweep, ether), 1.4), 0.45, 0.32, name, hp=200)

def soul_burst(name, dur=0.5):
    burst = mix(body_thump(name, dur, 110, 45, 0.7, 0.35),
                spec_filter(noise(dur, name, 'sb'), hp=300, lp=3000) * perc(dur, 0.001, dur * 0.25) * 0.5)
    ether = (osc(glide(500, 300, dur), dur, 'sine') + 0.5 * osc(glide(750, 450, dur), dur, 'sine')) * perc(dur, 0.005, dur * 0.4) * 0.3
    return reverb(softclip(mix(burst, ether), 1.6), 0.3, 0.26, name, hp=150)

def life_drain(name, dur=0.6):
    suck = tv_bandpass(noise(dur, name, 'ld'), glide(400, 1800, dur), q=2.5) * swell(dur, 0.5, 0.5) * 0.4
    wail = spec_filter(osc(glide(180, 260, dur), dur, 'saw'), lp=2200) * swell(dur, 0.4, 0.6) * 0.3
    low = osc(glide(60, 75, dur), dur, 'sine') * swell(dur, 0.3, 0.7) * 0.4
    return reverb(softclip(mix(suck, wail, low), 1.5), 0.3, 0.26, name, hp=120)

def corrosion(name, dur=0.5):
    burst = spec_filter(noise(dur, name, 'co'), hp=400, lp=4000) * perc(dur, 0.001, dur * 0.3) * 0.5
    bubble = np.zeros(n_samp(dur))
    r = rng(name, 'cb')
    for i in range(10):
        bubble = mix(bubble, place(osc(glide(300 + r.random() * 400, 150, 0.06), 0.06, 'sine') * perc(0.06, 0.003, 0.03) * 0.3, r.random() * dur, dur))
    low = osc(glide(100, 55, dur), dur, 'sine') * perc(dur, 0.005, dur * 0.4) * 0.5
    return reverb(softclip(mix(burst, bubble, low), 1.6), 0.22, 0.2, name)

def gas_hiss(name, dur=0.45):
    hiss = spec_filter(noise(dur, name, 'gs'), hp=1500, lp=7000) * swell(dur, 0.3, 0.7) * 0.5
    bubble = np.zeros(n_samp(dur))
    r = rng(name, 'bb')
    for i in range(8):
        bubble = mix(bubble, place(osc(glide(200 + r.random() * 300, 120, 0.08), 0.08, 'sine') * perc(0.08, 0.005, 0.04) * 0.3, r.random() * dur, dur))
    low = osc(glide(90, 70, dur), dur, 'sine') * swell(dur, 0.3, 0.7) * 0.3
    return reverb(softclip(mix(hiss, bubble, low), 1.5), 0.2, 0.18, name)

# 元素 / 時間 / 雷射
def laser(name, dur=0.3, pitch=1.0, heavy=False):
    f = glide(1800 * pitch, 400 * pitch, dur)
    car = osc(f, dur, 'saw')
    rmod = osc(np.asarray(f) * 1.5, dur, 'sine')
    body = (car * 0.6 + car * rmod * 0.4) * perc(dur, 0.001, dur * 0.35)
    zap = spec_filter(noise(dur, name, 'la'), hp=2000, lp=12000) * perc(dur, 0.001, 0.03) * 0.5
    layers = [body * 0.7, zap]
    if heavy:
        layers.append(body_thump(name, dur, 160, 55, 0.7, 0.4))
    return reverb(softclip(mix(*layers), 1.8), 0.2, 0.16, name)

def stasis(name, dur=0.55):
    drone = osc(glide(220, 180, dur), dur, 'sine') * swell(dur, 0.2, 0.8) * 0.4
    rev = whoosh(name, dur, 400, 1800, q=2)[::-1] * 0.3
    tick = place(osc(1800, 0.02, 'square') * perc(0.02, 0.001, 0.01) * 0.4, dur * 0.2, dur)
    freeze = metal_ring(name, dur, 1400, (1, 2.4, 3.8), 0.2, dur * 0.6)
    return reverb(softclip(mix(drone, rev, tick, freeze), 1.4), 0.3, 0.26, name)

# 各種閃避 / 衝刺 / 通用
def teleport(name, dur=0.28):
    up = whoosh(name, dur * 0.5, 400, 4000, down=False, q=3) * 0.5
    zap = osc(glide(1200, 200, dur), dur, 'sine') * perc(dur, 0.001, dur * 0.3) * 0.4
    shimmer = spec_filter(noise(dur, name, 'tp'), hp=4000, lp=13000) * swell(dur, 0.3, 0.7) * 0.3
    return reverb(softclip(mix(place(up, 0.0, dur), zap, shimmer), 1.5), 0.18, 0.16, name)

def roll(name, dur=0.3):
    body = tv_bandpass(noise(dur, name, 'ro'), glide(180, 90, dur), q=1.5) * swell(dur, 0.3, 0.7) * 0.7
    cloth = spec_filter(noise(dur, name, 'cl'), hp=1500, lp=7000) * swell(dur, 0.2, 0.8) * 0.3
    return reverb(softclip(mix(body, cloth), 1.4), 0.1, 0.08, name)

def stomp(name, dur=0.4):
    thud = body_thump(name, dur, 90, 38, 1.0, 0.42)
    rumble = spec_filter(noise(dur, name, 'st'), hp=30, lp=180) * swell(dur, 0.1, 0.9) * 0.6
    debris = spec_filter(noise(dur, name, 'db'), hp=400, lp=3000) * perc(dur, 0.001, 0.1) * 0.3
    crack = lowmid_impact(name, dur, 150, 600, 0.5, 0.06)
    return reverb(softclip(mix(thud, rumble, debris, crack), 2.2), 0.25, 0.2, name, hp=40)

def bulwark(name, dur=0.5):
    raise_ = tv_bandpass(noise(dur, name, 'bw'), glide(300, 1400, dur), q=2.0) * swell(dur, 0.5, 0.5) * 0.4
    metal = metal_ring(name, dur, 280, (1, 1.6, 2.4), 0.35, dur * 0.5)
    hum = osc(glide(80, 110, dur), dur, 'sine') * swell(dur, 0.4, 0.6) * 0.4
    return reverb(softclip(mix(raise_, place(metal, 0.05, dur), hum), 1.8), 0.22, 0.18, name)

def qi_charge(name, dur=0.6):
    f = glide(110, 330, dur)
    tone = osc(f, dur, 'sine') + 0.5 * osc(np.asarray(f) * 2, dur, 'sine') + 0.3 * osc(np.asarray(f) * 3, dur, 'tri')
    tone *= swell(dur, 0.7, 0.3, 1.6) * 0.5
    air = tv_bandpass(noise(dur, name, 'qi'), glide(300, 2500, dur), q=1.6) * swell(dur, 0.7, 0.3) * 0.3
    return reverb(softclip(mix(tone, air), 1.5), 0.25, 0.2, name)

def om_stance(name, dur=0.55):
    om = (osc(98, dur, 'sine') + 0.6 * osc(196, dur, 'sine') + 0.4 * osc(294, dur, 'tri')) * adsr(dur, 0.08, 0.2, 0.7, 0.3) * 0.5
    thud = body_thump(name, 0.25, 120, 55, 0.6, 0.3)
    return reverb(mix(spec_filter(om, lp=2000), place(thud, 0.02, dur)), 0.3, 0.24, name)

def rage_growl(name, dur=0.55):
    growl = spec_filter(osc(glide(70, 90, dur), dur, 'saw') + osc(glide(71, 91, dur), dur, 'saw'), lp=1200) * swell(dur, 0.3, 0.7) * 0.5
    growl = softclip(growl, 3.0)
    beat = mix(place(body_thump(name, 0.2, 90, 50, 0.6, 0.3), 0.1, dur), place(body_thump(name + 'b', 0.2, 90, 50, 0.6, 0.3), 0.38, dur))
    breath = spec_filter(noise(dur, name, 'br'), hp=300, lp=2000) * swell(dur, 0.4, 0.6) * 0.25
    return reverb(mix(growl, beat, breath), 0.2, 0.16, name)

def holy_charge(name, dur=0.45):
    air = whoosh(name, dur, 180, 1600, down=False, q=2.4) * 0.6
    glow = holy(name + 'g', dur, bright=0.9, pitch=1.0, shimmer=0.05, shimmer_hp=2500, top=0.07, warm=0.4, lp=6500) * 0.3
    g = np.zeros(n_samp(dur))
    for i in range(4):
        g = mix(g, place(body_thump(name + str(i), 0.1, 150, 85, 0.35, 0.18), 0.04 + i * 0.1, dur))
    return reverb(softclip(mix(air, glow, g), 1.8), 0.18, 0.16, name)

def screech(name, dur=0.4, rise=True):
    f = glide(900, 2200, dur) if rise else glide(1800, 1200, dur)
    s = osc(np.asarray(f) * (1 + 0.04 * osc(35, dur, 'sine')), dur, 'saw')
    s = spec_filter(s, hp=800, lp=6000) * swell(dur, 0.2, 0.8) * 0.5
    air = spec_filter(noise(dur, name, 'sc'), hp=2000, lp=9000) * swell(dur, 0.3, 0.7) * 0.2
    return reverb(softclip(mix(s, air), 1.6), 0.2, 0.18, name)

def talisman(name, dur=0.32):
    # 紙符的高頻摩擦壓低、量減半，主體放在低沉的暗能。
    paper = spec_filter(noise(dur * 0.5, name, 'pa'), hp=1200, lp=5500) * perc(dur * 0.5, 0.001, 0.05) * 0.28
    snap = osc(glide(360, 110, dur), dur, 'sine') * perc(dur, 0.001, dur * 0.3) * 0.4
    dark = spec_filter(osc(glide(110, 90, dur), dur, 'saw'), lp=900) * swell(dur, 0.2, 0.8) * 0.35
    return reverb(softclip(mix(place(paper, 0, dur), snap, dark), 1.6), 0.16, 0.14, name)

def shadow_strike(name, dur=0.3):
    # 瞬移閃光與刀刃亮度降低，整體再過一道低通去掉刺耳頂端。
    tp = spec_filter(teleport(name + 't', 0.18), lp=7000) * 0.5
    cut = swing_blade(name + 'c', 0.26, weight=0.8, bright=1.0, edge=0.26, ring_base=460)
    return spec_filter(mix(place(tp, 0.0, dur), place(cut, 0.08, dur)), lp=8500)

# ── 大招 / 多段（合成式） ──

# 電影感組件：張力鋪陳(riser) 與 巨型衝擊(boom)，讓大招「蓄勢 → 砸下」更浮誇。
def riser(name, dur, f0=150, f1=3000, gain=1.0):
    """上升張力：噪音掃頻 up + 鋸齒上揚；尾段最強（自然帶入衝擊）。"""
    nz = tv_bandpass(noise(dur, name, 'ri'), glide(f0, f1, dur), q=1.3) * swell(dur, 0.88, 0.12, 2.4)
    tone = spec_filter(osc(glide(f0 * 0.7, f1 * 0.45, dur), dur, 'saw'), lp=f1) * swell(dur, 0.9, 0.1) * 0.3
    return mix(nz * 0.5, tone) * gain

def boom(name, dur=0.7, sub=1.0, crack=0.7, flavor=None):
    """巨型衝擊：深 sub-drop + 中頻捶擊(胸口頻段，小喇叭也聽得到) + body + 高頻 crack + flavor。"""
    sd = (osc(glide(170, 32, dur), dur, 'sine') * perc(dur, 0.002, dur * 0.45)
          + osc(glide(85, 26, dur), dur, 'sine') * perc(dur, 0.004, dur * 0.55) * 0.7) * sub
    body = body_thump(name, dur * 0.6, 150, 44, 0.8, 0.4)
    knock = spec_filter(noise(dur * 0.45, name, 'bk'), hp=180, lp=1200) * perc(dur * 0.45, 0.001, 0.06) * 0.7  # 中頻捶擊感
    knock = mix(knock, osc(glide(320, 110, dur * 0.4), dur * 0.4, 'tri') * perc(dur * 0.4, 0.001, dur * 0.18) * 0.5)
    cr = spec_filter(noise(dur * 0.5, name, 'bc'), hp=700, lp=12000) * perc(dur * 0.5, 0.0006, 0.05) * crack
    layers = [sd, body, knock, cr]
    if flavor is not None:
        layers.append(to_len(flavor, n_samp(dur)))
    return softclip(mix(*layers), 1.7)

def ult_release(name, dur, flavor_layer, charge_pitch=1.0, charge_frac=0.4, hp=60, sub=1.0, crack=0.7):
    """通用大招外殼：riser 蓄勢 → boom 砸下（flavor 落在衝擊瞬間）。"""
    cd = dur * charge_frac
    rest = dur - cd
    pre = riser(name, cd, 140, 2600 * charge_pitch) * 0.55
    hd = min(0.85, rest)
    hit = boom(name, hd, sub=sub, crack=crack, flavor=to_len(np.asarray(flavor_layer, float), n_samp(hd)))
    full = mix(place(pre, 0, dur), place(hit, cd, dur))
    return reverb(softclip(full, 1.6), 0.6, 0.32, name, hp=hp)

def rising_dragon(name, dur=1.2):
    # 真·昇龍霸：蓄力上掃 → 騰空巨型上勾拳衝擊 + 龍吟。
    cd = dur * 0.4
    rest = dur - cd
    rise = mix(riser(name, cd, 150, 2600) * 0.5, osc(glide(120, 520, cd), cd, 'saw') * swell(cd, 0.8, 0.2) * 0.3)
    roar = spec_filter(osc(glide(200, 130, rest), rest, 'saw'), lp=1600) * swell(rest, 0.1, 0.9) * 0.35
    hd = min(0.8, rest)
    flav = to_len(mix(roar, lowmid_impact(name, rest, 180, 1200, 0.6, 0.1)), n_samp(hd))
    hit = boom(name, hd, sub=1.1, crack=0.7, flavor=flav)
    return reverb(softclip(mix(place(rise, 0, dur), place(hit, cd, dur)), 1.7), 0.55, 0.3, name, hp=50)

def meteor(name, dur=1.6, windup=0.8):
    # 天降流星：降落前(由遠而近的火焰尖嘯+低沉預兆) → 砸地(巨響+火焰炸開+碎石+餘震)。
    # windup 對齊視覺 z.delay(法師/元素 ≈ 0.8s)，砸地巨響剛好落在隕石撞地那一刻。
    rest = dur - windup
    nw = n_samp(windup)
    omen = osc(glide(70, 92, windup), windup, 'sine') * swell(windup, 0.2, 0.8) * 0.35
    scream = tv_bandpass(noise(windup, name, 'mt'), glide(300, 1700, windup), q=1.4) * (np.linspace(0, 1, nw) ** 2) * 0.6
    whistle = spec_filter(osc(glide(500, 1500, windup), windup, 'saw'), lp=3000) * (np.linspace(0, 1, nw) ** 3) * 0.2
    pre = mix(omen, scream, whistle)
    hd = min(0.95, rest)
    fire = mix(tv_bandpass(noise(hd, name, 'mf'), glide(900, 200, hd), q=1.1) * swell(hd, 0.05, 0.95) * 0.6,
               spec_filter(noise(hd, name, 'mk'), hp=1200, lp=9000) * (rng(name, 'mx').random(n_samp(hd)) > 0.96) * 0.5)
    hit = boom(name, hd, sub=1.2, crack=0.8, flavor=fire)
    debris = np.zeros(n_samp(rest))
    r = rng(name, 'md')
    for i in range(6):
        debris = mix(debris, place(lowmid_impact(name + str(i), 0.15, 150, 800, 0.3, 0.05), r.random() * rest * 0.7, rest))
    rumble = spec_filter(noise(rest, name, 'mr'), hp=25, lp=130) * swell(rest, 0.05, 0.95) * 0.5
    post = mix(place(hit, 0, rest), debris, rumble)
    return reverb(softclip(mix(place(pre, 0, dur), place(post, windup, dur)), 1.6), 0.6, 0.34, name, hp=30)

def meteor_storm(name, dur=1.8):
    # 隕石風暴：多顆隕石錯落砸下（各自短下墜 + 砸地）+ 持續地鳴。
    out = np.zeros(n_samp(dur))
    r = rng(name, 'ms')
    for i, t0 in enumerate((0.0, 0.45, 0.85, 1.25)):
        out = mix(out, place(meteor(name + str(i), 0.65, windup=0.35) * 0.7, t0 + r.random() * 0.06, dur))
    rumble = spec_filter(noise(dur, name, 'msr'), hp=25, lp=150) * swell(dur, 0.2, 0.8) * 0.4
    return reverb(mix(out, rumble), 0.5, 0.32, name, hp=30)

def earth_quake(name, dur=1.5):
    # 大地崩裂：地面隆起(riser) → 主裂巨響 + 持續低頻地鳴 + 連串裂縫崩塌。
    heave = riser(name, 0.35, 40, 400) * 0.4
    rumble = spec_filter(noise(dur, name, 'eq'), hp=22, lp=130) * swell(dur, 0.25, 0.75) * 1.0
    sub = (osc(glide(48, 26, dur), dur, 'sine') + 0.5 * osc(glide(70, 34, dur), dur, 'tri')) * swell(dur, 0.2, 0.8) * 0.7
    cracks = np.zeros(n_samp(dur))
    r = rng(name, 'cr')
    for i in range(7):
        cracks = mix(cracks, place(boom(name + str(i), 0.3, sub=0.5, crack=0.5), 0.3 + r.random() * 0.9, dur))
    main = place(boom(name, 0.5, sub=1.3, crack=0.6), 0.3, dur)
    return reverb(softclip(mix(place(heave, 0, dur), rumble, sub, cracks, main), 1.9), 0.6, 0.32, name, hp=20)

def plague_nova(name, dur=1.25):
    # 瘟疫爆發：毒氣嘶嘶蓄積 → 濕黏炸裂 + 瘟疫向外擴散。
    cd = dur * 0.4
    rest = dur - cd
    charge = mix(gas_hiss(name + 'c', cd) * 0.6, riser(name, cd, 200, 1800) * 0.3)
    hd = min(0.8, rest)
    spread = tv_bandpass(noise(hd, name, 'ps'), glide(1600, 300, hd), q=1.4) * swell(hd, 0.1, 0.9) * 0.5
    wet = spec_filter(noise(hd, name, 'pw'), hp=200, lp=2500) * perc(hd, 0.001, hd * 0.4) * 0.5
    hit = boom(name, hd, sub=0.9, crack=0.5, flavor=mix(spread, wet))
    return reverb(softclip(mix(place(charge, 0, dur), place(hit, cd, dur)), 1.6), 0.55, 0.32, name, hp=60)

def arrow_barrage(name, dur=1.4):
    # 天羽箭暴：拉弓蓄勢 → 漫天箭雨呼嘯而下 + 落地連串撞擊。
    r = rng(name, 'ab')
    draw = mix(karplus(180, 0.4, 0.4, name + 'd') * perc(0.4, 0.002, 0.25) * 0.5, riser(name, 0.4, 300, 2000) * 0.3)
    out = place(draw, 0, dur)
    for i in range(14):
        out = mix(out, place(bowshot(name + str(i), 0.22, 420 + r.random() * 140, rapid=True) * 0.6, 0.35 + r.random() * 0.8, dur))
    impacts = np.zeros(n_samp(dur))
    for i in range(8):
        impacts = mix(impacts, place(lowmid_impact(name + 'i' + str(i), 0.12, 200, 1400, 0.3, 0.04), 0.5 + r.random() * 0.8, dur))
    rain = spec_filter(noise(dur, name, 'rn'), hp=2500, lp=9000) * swell(dur, 0.4, 0.6) * 0.2
    return reverb(mix(out, impacts, rain), 0.35, 0.26, name)

def falcon_storm(name, dur=1.4):
    # 鷹擊風暴：群鷹尖嘯盤旋 + 接連俯衝撞擊 + 狂風。
    out = np.zeros(n_samp(dur))
    r = rng(name, 'fst')
    for i in range(6):
        out = mix(out, place(screech(name + str(i), 0.4, rise=(i % 2 == 0)) * 0.6, r.random() * dur * 0.75, dur))
    for i in range(5):
        dive = mix(whoosh(name + 'w' + str(i), 0.2, 300, 2400, down=False, q=2.5) * 0.5,
                   lowmid_impact(name + 'h' + str(i), 0.12, 250, 1600, 0.4, 0.04))
        out = mix(out, place(dive, 0.3 + r.random() * 0.8, dur))
    wind = tv_bandpass(noise(dur, name, 'wd'), glide(400, 1600, dur), q=1.2) * swell(dur, 0.3, 0.7) * 0.4
    return reverb(mix(out, wind), 0.4, 0.3, name)

def bullet_storm(name, dur=1.3):
    # 彈幕風暴：密集連發漸強 + 彈殼叮噹 + 收尾大口徑一響。
    out = place(multigun(name, dur * 0.85, shots=18, caliber=0.8), 0, dur)
    shells = np.zeros(n_samp(dur))
    r = rng(name, 'sh')
    for i in range(10):
        shells = mix(shells, place(metal_ring(name + str(i), 0.06, 1400 + r.random() * 800, (1, 2.1), 0.12, 0.03), r.random() * dur * 0.85, dur))
    finale = place(gunshot(name + 'fin', 0.4, caliber=1.4), dur * 0.8, dur)
    return reverb(mix(out, shells * 0.4, finale), 0.3, 0.24, name)

def rewind(name, dur=1.4):
    # 時空逆轉：反轉掃頻吸入 → 時間扣下的「鏘」 + 倒灌鐘聲級聯 + 扭曲顫音。
    sweep = (tv_bandpass(noise(dur, name, 'rw'), glide(2500, 200, dur), q=1.6) * swell(dur, 0.5, 0.5) * 0.5)[::-1]
    chimes = np.zeros(n_samp(dur))
    for i, p in enumerate((1, 1.5, 2, 2.5, 3)):
        chimes = mix(chimes, place(metal_ring(name + str(i), 0.4, 600 * p, (1, 2, 3), 0.2, 0.3), 0.1 + i * 0.16, dur))
    snap = place(boom(name, 0.5, sub=0.9, crack=0.6), dur * 0.62, dur)
    warble = osc(np.asarray(glide(300, 200, dur)) * (1 + 0.04 * osc(6, dur, 'sine')), dur, 'sine') * swell(dur, 0.3, 0.7) * 0.2
    return reverb(softclip(mix(sweep, chimes, snap, warble), 1.5), 0.55, 0.34, name)

def whisper_swarm(name, dur=1.4):
    # 萬咒齊發：大量詛咒低語匯聚 → 暗能炸開。
    swarm = np.zeros(n_samp(dur))
    r = rng(name, 'ws')
    for i in range(16):
        f = glide(180 + r.random() * 220, 140 + r.random() * 160, dur)
        swarm = mix(swarm, spec_filter(osc(f, dur, 'saw'), lp=1600) * swell(dur, 0.3 + r.random() * 0.35, 0.5) * 0.1)
    burst = place(boom(name, 0.7, sub=0.9, crack=0.5,
                       flavor=spec_filter(noise(0.7, name, 'wb'), hp=300, lp=2800) * perc(0.7, 0.001, 0.25) * 0.5),
                  dur * 0.55, dur)
    return reverb(softclip(mix(swarm, burst), 1.5), 0.5, 0.36, name, hp=60)

def undead_army(name, dur=1.5):
    # 亡靈大軍：暗黑傳送門開啟(riser) → 巨響 + 亡者哀嚎 + 白骨喀喀 + 地底轟鳴。
    portal = mix(summon(name, dur * 0.7, dark=True) * 0.8, riser(name, 0.4, 60, 800) * 0.3)
    moans = np.zeros(n_samp(dur))
    r = rng(name, 'um')
    for i in range(8):
        f = glide(110 + r.random() * 90, 80 + r.random() * 60, dur)
        moans = mix(moans, spec_filter(osc(f, dur, 'saw'), lp=950) * swell(dur, 0.3 + r.random() * 0.35, 0.5) * 0.15)
    bones = np.zeros(n_samp(dur))
    for i in range(10):
        bones = mix(bones, place(metal_ring(name + 'b' + str(i), 0.05, 900 + r.random() * 500, (1, 1.7), 0.1, 0.025), 0.2 + r.random() * 1.1, dur))
    quake = place(boom(name, 0.6, sub=1.1, crack=0.4), dur * 0.45, dur)
    rumble = spec_filter(noise(dur, name, 'ur'), hp=28, lp=150) * swell(dur, 0.2, 0.8) * 0.5
    return reverb(softclip(mix(portal, moans, bones * 0.4, quake, rumble), 1.5), 0.6, 0.36, name, hp=30)

def grand_summon(name, dur=1.5):
    # 大召喚術：傳送門充能(riser) → 巨響 + 空靈合唱 + 上升光柱。
    base = mix(summon(name, dur * 0.75, dark=False), riser(name, 0.45, 100, 2000) * 0.3)
    chorus = np.zeros(n_samp(dur))
    for f in (220, 330, 440, 550):
        chorus = mix(chorus, osc(glide(f, f * 1.08, dur), dur, 'sine') * adsr(dur, 0.2, 0.2, 0.7, 0.45) * 0.18)
    slam = place(boom(name, 0.6, sub=1.0, crack=0.5), dur * 0.45, dur)
    return reverb(softclip(mix(base, spec_filter(chorus, lp=3200), slam), 1.5), 0.6, 0.36, name, hp=120)

def life_confluence(name, dur=1.5):
    # 生命匯流：溫暖聖光漸強匯聚 → 飽滿的治癒爆發（保持柔和、不刺耳）+ 暖低頻撐底。
    swellp = tv_bandpass(noise(dur, name, 'lc'), glide(300, 2000, dur), q=1.5) * swell(dur, 0.6, 0.4) * 0.18
    bell = holy(name, dur, bright=0.92, pitch=0.92, choir=1.0, shimmer=0.05, shimmer_hp=2400, top=0.07, warm=0.7, lp=6000)
    burst = place(holy(name + 'b', 0.8, bright=0.95, pitch=1.0, choir=1.0, shimmer=0.05, shimmer_hp=2500, top=0.07, warm=0.5, lp=6500) * 0.7, dur * 0.4, dur)
    sub = osc(glide(70, 55, dur), dur, 'sine') * swell(dur, 0.3, 0.7) * 0.3
    return reverb(mix(bell, burst, swellp, sub), 0.6, 0.36, name, hp=120)

def symphony(name, dur=1.5):
    # 狂想交響樂：管弦漸強 → 和弦高潮 + 漸強鈸 + 豎琴級聯 + 定音鼓。
    ch = chord_swell(name, dur, root=196, bright=1.1)
    harp = place(harp_chord(name + 'h', 0.6, (392, 494, 587, 784)) * 0.6, dur * 0.45, dur)
    bell = holy(name + 'b', dur, bright=0.95, pitch=1.1, shimmer=0.06, shimmer_hp=3000, top=0.1, lp=8000) * 0.3
    cym = spec_filter(noise(dur, name, 'cy'), hp=3000, lp=12000) * swell(dur, 0.55, 0.45) * 0.18
    timp = place(boom(name, 0.5, sub=0.7, crack=0.3), dur * 0.42, dur)
    return reverb(mix(ch, harp, bell, cym, timp), 0.55, 0.36, name)

def shadow_flurry(name, dur=1.2):
    # 千影分身：殘影連斬層層加速 → 最後致命一擊 + 衝擊。
    out = np.zeros(n_samp(dur))
    r = rng(name, 'sf')
    for i in range(10):
        cut = swing_blade(name + str(i), 0.2, weight=0.7, bright=1.0, edge=0.26, ring_base=480)
        out = mix(out, place(cut * (0.96 ** i), i * (dur * 0.62 / 10) + r.random() * 0.02, dur))
    fin = place(mix(swing_blade(name + 'fin', 0.32, 1.1, 1.0, 0.34, 440), boom(name, 0.45, sub=0.8, crack=0.5)), dur * 0.66, dur)
    return spec_filter(reverb(mix(out, fin), 0.4, 0.3, name), lp=8500)

def cosmic_burst(name, dur=1.5):
    # 星環終焉砲：星能充能(riser) → 巨型雷射 + 深 sub 衝擊 + 宇宙微光尾。
    cd = dur * 0.42
    rest = dur - cd
    charge = mix(osc(glide(180, 1300, cd), cd, 'saw') * swell(cd, 0.75, 0.25) * 0.3,
                 tv_bandpass(noise(cd, name, 'cb'), glide(400, 3200, cd), q=1.6) * swell(cd, 0.8, 0.2) * 0.3,
                 riser(name, cd, 200, 3000) * 0.3)
    hd = min(0.9, rest)
    beam = to_len(laser(name, hd, pitch=0.6, heavy=True), n_samp(hd))
    shimmer = spec_filter(noise(hd, name, 'cs'), hp=4000, lp=12000) * swell(hd, 0.2, 0.8) * 0.2
    hit = boom(name, hd, sub=1.2, crack=0.7, flavor=mix(beam, shimmer))
    return reverb(softclip(mix(place(charge, 0, dur), place(hit, cd, dur)), 1.7), 0.6, 0.34, name, hp=40)

def mountain_root(name, dur=1.5):
    # 不動如山：紮根巨踏(boom) + 上升地脈光柱 + 持續低頻地鳴 + 碎石（沉穩如山）。
    stomp_ = boom(name, 0.5, sub=1.2, crack=0.4)
    pillar = mix(whoosh(name + 'p', 0.6, 80, 900, down=False, q=2.0) * 0.4, osc(glide(60, 140, 0.6), 0.6, 'saw') * swell(0.6, 0.7, 0.3) * 0.3)
    drone = (osc(glide(54, 51, dur), dur, 'sine') + 0.5 * osc(glide(82, 80, dur), dur, 'tri')) * adsr(dur, 0.1, 0.3, 0.7, 0.45) * 0.5
    grind = spec_filter(noise(dur, name, 'gr'), hp=50, lp=400) * swell(dur, 0.1, 0.9) * 0.45
    stones = np.zeros(n_samp(dur))
    r = rng(name, 'mr')
    for i in range(5):
        stones = mix(stones, place(lowmid_impact(name + str(i), 0.2, 120, 600, 0.35, 0.06), 0.05 + r.random() * 0.7, dur))
    return reverb(softclip(mix(place(stomp_, 0, dur), place(pillar, 0.05, dur), spec_filter(drone, lp=2000), grind, stones), 1.8), 0.55, 0.34, name, hp=25)

def clock_haste(name, dur=0.55):
    # 時間加速：上揚能量 swell + 越來越快的時鐘滴答（間隔遞減）。
    swellp = buff_swell(name, dur, 'arcane', 1.3, rising=True) * 0.7
    ticks = np.zeros(n_samp(dur))
    t, gap = 0.0, 0.095
    while t < dur * 0.95:
        ticks = mix(ticks, place(osc(2200, 0.012, 'square') * perc(0.012, 0.0005, 0.005) * 0.5, t, dur))
        t += gap
        gap *= 0.82
    return mix(swellp, ticks * 0.5)

def rift(name, dur=0.4):
    # 時空裂隙：空間撕裂的高頻嘶聲 + 扭曲顫音 + 反轉殘響。
    tear = tv_bandpass(noise(dur, name, 'rf'), glide(800, 2500, dur), q=2.0) * swell(dur, 0.3, 0.7) * 0.4
    warp = osc(np.asarray(glide(300, 420, dur)) * (1 + 0.05 * osc(9, dur, 'sine')), dur, 'sine') * swell(dur, 0.4, 0.6) * 0.4
    rev = whoosh(name, dur, 400, 2000, q=2)[::-1] * 0.25
    return reverb(softclip(mix(tear, warp, rev), 1.5), 0.2, 0.18, name)

def nightmare_bind(name, dur=0.45):
    # 噩夢束縛：低語陰風 + 暗鏈收緊（漸密金屬扣環）+ 收束 snap + 低沉壓迫。
    whisper = spec_filter(osc(glide(180, 150, dur), dur, 'saw'), lp=1400) * swell(dur, 0.3, 0.7) * 0.35
    bind = np.zeros(n_samp(dur))
    r = rng(name, 'nb')
    for i in range(4):
        bind = mix(bind, place(metal_ring(name + str(i), 0.08, 900 + r.random() * 600, (1, 2.3), 0.2, 0.04) * 0.5, 0.04 + i * 0.065, dur))
    snap = osc(glide(500, 90, dur * 0.5), dur * 0.5, 'sine') * perc(dur * 0.5, 0.001, 0.08) * 0.4
    low = osc(glide(70, 50, dur), dur, 'sine') * swell(dur, 0.3, 0.7) * 0.4
    return reverb(softclip(mix(whisper, bind, place(snap, dur * 0.4, dur), low), 1.5), 0.25, 0.22, name)

def star_gather(name, dur=0.55):
    # 群星歸位：多顆星光鈴音由高到低「匯聚」+ 上揚能量 + 溫暖嗡鳴。
    chimes = np.zeros(n_samp(dur))
    for i, p in enumerate((2.0, 1.6, 1.3, 1.0)):
        chimes = mix(chimes, place(metal_ring(name + str(i), 0.4, 700 * p, (1, 2, 3), 0.25, 0.3), i * 0.07, dur))
    swellp = tv_bandpass(noise(dur, name, 'sg'), glide(800, 3500, dur), q=1.8) * swell(dur, 0.5, 0.5) * 0.3
    hum = osc(glide(160, 240, dur), dur, 'sine') * swell(dur, 0.4, 0.6) * 0.3
    return reverb(softclip(mix(chimes * 0.6, swellp, hum), 1.4), 0.3, 0.28, name)

# 通用 hit / hurt / death / footstep
def impact_hit(name, dur=0.18):
    thud = body_thump(name, dur, 200, 80, 1.0, 0.4)
    slap = spec_filter(noise(dur * 0.5, name, 'ih'), hp=800, lp=6000) * perc(dur * 0.5, 0.0008, 0.03) * 1.0
    crunch = spec_filter(noise(dur, name, 'ic'), hp=250, lp=2400) * perc(dur, 0.001, dur * 0.25) * 0.6  # 中頻捶擊
    return reverb(softclip(mix(thud, slap, crunch), 2.0), 0.12, 0.1, name)

def hurt_body(name, dur=0.2):
    grunt = osc(glide(160, 90, dur), dur, 'tri') * perc(dur, 0.002, dur * 0.35) * 0.6
    impact = spec_filter(noise(dur * 0.6, name, 'hb'), hp=300, lp=3500) * perc(dur * 0.6, 0.001, 0.05) * 0.6
    return reverb(softclip(mix(grunt, impact), 1.6), 0.1, 0.08, name)

def death_fall(name, dur=0.9):
    drop = osc(glide(200, 50, dur * 0.7), dur * 0.7, 'tri') * perc(dur * 0.7, 0.005, dur * 0.3) * 0.7
    body = spec_filter(noise(dur, name, 'df'), hp=120, lp=1800) * swell(dur, 0.1, 0.9) * 0.4
    thud = place(body_thump(name, 0.3, 120, 45, 0.8, 0.4), dur * 0.55, dur)
    return reverb(softclip(mix(drop, body, thud), 1.5), 0.3, 0.22, name, hp=80)

def footstep(name, dur=0.13, heavy=0.5):
    body = body_thump(name, dur, 120, 55, heavy, 0.3)
    dirt = spec_filter(noise(dur, name, 'fs'), hp=600 + 800 * heavy, lp=5000) * perc(dur, 0.001, 0.05) * 0.5
    return reverb(softclip(mix(body, dirt), 1.3), 0.08, 0.06, name)

# ───────────────────────── 音效登錄表 ─────────────────────────

R = {}

def reg(name, fn, loud=1.0, fo=12.0):
    R[name] = (fn, loud, fo)

def reg_char(cid, basic, skill1, skill2, ult):
    # 普攻最常觸發，統一過一道高頻 shelf 去刺耳（暗的普攻無高頻、幾乎不受影響）。
    reg(f'{cid}_basic', lambda: hishelf(np.asarray(basic(), dtype=float), 2800, 0.38))
    reg(f'{cid}_skill1', skill1)
    reg(f'{cid}_skill2', skill2)
    reg(f'{cid}_ultimate', ult, loud=1.12)  # 大招稍微更響更有存在感

# ── 泛型（魔王/召喚物 等回退用；整體升級）──
reg('footstep1', lambda: footstep('footstep1', 0.12, 0.4))
reg('footstep2', lambda: footstep('footstep2', 0.13, 0.55))
reg('footstep3', lambda: footstep('footstep3', 0.11, 0.5))
reg('swing', lambda: swing_blade('swing', 0.32, weight=1.0, bright=0.95, edge=0.28))
reg('cast', lambda: cast('cast', 0.4, 'arcane', 1.0))
reg('hit', lambda: impact_hit('hit'))
reg('hurt', lambda: hurt_body('hurt'))
reg('death', lambda: death_fall('death'))
reg('ultimate', lambda: ult_release('ultimate', 1.1, cast('ultg', 0.6, 'arcane', 1.0) * 0.6))
reg('dash', lambda: whoosh('dash', 0.3, 160, 1400, q=2.0, body=0.6))
reg('blink', lambda: teleport('blink'))
reg('buff', lambda: buff_swell('buff', 0.55, 'arcane'))
reg('evade_blink', lambda: teleport('evade_blink', 0.24))
reg('evade_roll', lambda: roll('evade_roll', 0.3))

# ── 各角色 × 四技能（basic / skill1 / skill2 / ultimate）──

# warrior：厚重鋼鐵 — 橫掃 / 戰矛突刺 / 鎖鏈鉤爪 / 不動如山
reg_char('warrior',
    lambda: swing_blade('warrior_basic', 0.36, weight=1.4, bright=0.82, edge=0.3, ring_base=420),
    lambda: thrust('warrior_skill1'),
    lambda: chain('warrior_skill2'),
    lambda: mountain_root('warrior_ultimate'))

# samurai：乾淨利落居合 — 一文字 / 縮地斬 / 納刀架勢 / 斬業一閃
reg_char('samurai',
    lambda: swing_blade('samurai_basic', 0.3, weight=0.8, bright=1.35, edge=0.42, ring_base=620, hiss=0.2),
    lambda: mix(teleport('samurai_skill1t', 0.16) * 0.5, place(swing_blade('samurai_skill1c', 0.28, 0.9, 1.4, 0.45, 640), 0.08, 0.32)),
    lambda: mix(spec_filter(noise(0.34, 'sam_sheath', 's'), hp=2500, lp=8000) * perc(0.34, 0.002, 0.06) * 0.5,
                osc(glide(140, 120, 0.34), 0.34, 'sine') * swell(0.34, 0.3, 0.7) * 0.3),
    lambda: ult_release('samurai_ultimate', 1.3, swing_blade('sam_ult_cut', 0.6, 1.3, 1.3, 0.6, 560) * 0.9, charge_pitch=1.2, charge_frac=0.5, crack=0.8))

# magic-swordsman：鋼鐵 + 魔法 — 魔刃連斬 / 劍氣波 / 魔能護體 / 極限解放
reg_char('magic-swordsman',
    lambda: mix(swing_blade('mss_basic', 0.34, 1.0, 1.2, 0.35, 500), cast('mss_glow', 0.34, 'arcane', 1.6) * 0.3),
    lambda: magic_bolt('mss_wave', 0.34, 'arcane', 1.2),
    lambda: buff_swell('mss_guard', 0.5, 'arcane', 1.1),
    lambda: ult_release('mss_ult', 1.4, swing_blade('mss_ult_c', 0.6, 1.2, 1.3, 0.5, 520) * 0.9, charge_pitch=1.3, sub=1.1))

# berserker：雙斧血腥 — 雙斧 / 嗜血躍斬 / 血怒 / 血祭處決
reg_char('berserker',
    lambda: swing_axe('berserker_basic', 0.36, weight=1.5, double=True),
    lambda: mix(whoosh('bsk_leap', 0.3, 150, 1400, down=False, q=2.0) * 0.6, place(swing_axe('bsk_leap_c', 0.34, 1.5), 0.18, 0.4)),
    lambda: rage_growl('berserker_skill2'),
    lambda: ult_release('berserker_ultimate', 1.3, swing_axe('bsk_ult_c', 0.6, 1.6) * 0.95, charge_pitch=0.85, sub=1.15, crack=0.8))

# fighter：聚氣爆發武僧 — 連環拳 / 聚氣 / 不動明王 / 真·昇龍霸
reg_char('fighter',
    lambda: multipunch('fighter_basic', 0.42, hits=4),
    lambda: qi_charge('fighter_skill1'),
    lambda: om_stance('fighter_skill2'),
    lambda: rising_dragon('fighter_ultimate'))

# tank：盾與大地（鈍器，無刀刃）— 盾擊 / 守護壁壘 / 巨力踏陣 / 大地崩裂
reg_char('tank',
    lambda: swing_blunt('tank_basic', 0.32, weight=1.5, clang_base=230, clang_amt=0.45),
    lambda: bulwark('tank_skill1'),
    lambda: stomp('tank_skill2', 0.42),
    lambda: earth_quake('tank_ultimate'))

# paladin：聖騎（聖槌鈍器 + 聖光；聖光部分比照治療師柔化，去刺耳）— 聖槌 / 神聖衝鋒 / 制裁之光 / 天堂審判
reg_char('paladin',
    lambda: mix(swing_blunt('paladin_basic', 0.36, weight=1.4, clang_base=300, clang_amt=0.2, dull=0.45),
                holy('pal_glow', 0.36, bright=0.9, pitch=1.0, shimmer=0.05, shimmer_hp=2600, top=0.07, warm=0.4, lp=6500) * 0.22),
    lambda: holy_charge('paladin_skill1'),
    lambda: holy('paladin_skill2', 0.6, bright=0.88, pitch=0.85, choir=0.7, shimmer=0.05, shimmer_hp=2400, top=0.06, warm=0.55, lp=5800),
    lambda: ult_release('paladin_ultimate', 1.5,
                        holy('pal_ult', 0.9, bright=0.95, pitch=0.9, choir=1.0, shimmer=0.05, shimmer_hp=2500, top=0.07, warm=0.7, lp=6200) * 0.9,
                        charge_pitch=1.0, charge_frac=0.32, hp=200, sub=1.1, crack=0.35))

# assassin：毒匕首 — 毒牙連刺 / 毒霧步 / 淬毒之刃 / 瘟疫爆發
reg_char('assassin',
    lambda: mix(swing_blade('assassin_basic', 0.24, weight=0.5, bright=1.4, edge=0.22, ring_base=720, hiss=0.35),
                place(swing_blade('assassin_basic2', 0.2, 0.45, 1.4, 0.2, 760), 0.1, 0.28)),
    lambda: mix(gas_hiss('assassin_skill1', 0.4) * 0.7, place(teleport('ass_step', 0.18) * 0.5, 0.02, 0.4)),
    lambda: mix(swing_blade('assassin_skill2', 0.26, 0.6, 1.3, 0.28, 680), gas_hiss('ass_venom', 0.26) * 0.4),
    lambda: plague_nova('assassin_ultimate'))

# archer：弓 — 射箭 / 貫穿箭 / 寄生箭 / 天羽箭暴
reg_char('archer',
    lambda: spec_filter(bowshot('archer_basic', 0.3, twang=420), lp=6200),
    lambda: bowshot('archer_skill1', 0.34, twang=330, heavy=True),
    lambda: mix(bowshot('archer_skill2', 0.32, twang=380) * 0.8, place(corrosion('arch_para', 0.24) * 0.4, 0.1, 0.34)),
    lambda: arrow_barrage('archer_ultimate'))

# falconer：快矢與鷹 — 連珠快矢 / 鷹擊震退 / 鷹眼凝視 / 鷹擊風暴
reg_char('falconer',
    lambda: spec_filter(mix(bowshot('falconer_basic', 0.24, twang=430, rapid=True), place(bowshot('falconer_basic2', 0.22, 450, rapid=True) * 0.7, 0.09, 0.26)), lp=5800),
    lambda: mix(screech('falconer_skill1', 0.32) * 0.6, place(whoosh('fal_gust', 0.3, 200, 1600, q=1.8) * 0.5, 0.1, 0.4)),
    lambda: screech('falconer_skill2', 0.5, rise=True),
    lambda: falcon_storm('falconer_ultimate'))

# gunner：雙槍 — 雙槍射擊 / 翻滾閃避 / 燃燒彈 / 彈幕風暴
reg_char('gunner',
    lambda: spec_filter(multigun('gunner_basic', 0.34, shots=2, caliber=0.8), lp=6800),
    lambda: roll('gunner_skill1', 0.3),
    lambda: incendiary('gunner_skill2'),
    lambda: bullet_storm('gunner_ultimate', 1.3))

# mage：法系（cast 允許相似）— 奧術飛彈 / 烈焰吐息 / 寒冰矛 / 天降流星
reg_char('mage',
    lambda: magic_bolt('mage_basic', 0.36, 'arcane', 1.1),
    lambda: fire_breath('mage_skill1', 0.5),
    lambda: ice_spear('mage_skill2', 0.4),
    lambda: meteor('mage_ultimate', 1.7, windup=0.8))

# elementalist：多元素 — 火焰扇 / 雷霆風暴 / 寒霜足跡 / 隕石風暴
reg_char('elementalist',
    lambda: mix(whoosh('elem_fan', 0.3, 250, 1800, q=1.8) * 0.7, cast('elem_fan_c', 0.3, 'fire', 1.1) * 0.5),
    lambda: lightning('elementalist_skill1', 0.5),
    lambda: cast('elementalist_skill2', 0.5, 'ice', 1.0),
    lambda: meteor_storm('elementalist_ultimate'))

# chronomancer：時間 — 時空裂隙 / 時間加速 / 時間停滯 / 時空逆轉
reg_char('chronomancer',
    lambda: rift('chronomancer_basic', 0.4),
    lambda: clock_haste('chronomancer_skill1', 0.55),
    lambda: stasis('chronomancer_skill2', 0.55),
    lambda: rewind('chronomancer_ultimate'))

# hexer：詛咒 — 詛咒彈 / 噩夢束縛 / 衰弱領域 / 萬咒齊發
reg_char('hexer',
    lambda: magic_bolt('hexer_basic', 0.36, 'dark', 0.95),
    lambda: nightmare_bind('hexer_skill1', 0.45),
    lambda: cast('hexer_skill2', 0.5, 'dark', 0.7),
    lambda: whisper_swarm('hexer_ultimate'))

# necromancer：死靈 — 死亡射線 / 生命汲取 / 腐蝕爆發 / 亡靈大軍
reg_char('necromancer',
    lambda: mix(cast('necro_basic', 0.34, 'dark', 0.9), place(laser('necro_ray', 0.3, pitch=0.6) * 0.4, 0.05, 0.4)),
    lambda: life_drain('necromancer_skill1', 0.6),
    lambda: corrosion('necromancer_skill2', 0.5),
    lambda: undead_army('necromancer_ultimate'))

# summoner：靈魂召喚 — 靈魂碎片 / 召喚戰靈 / 靈魂爆破 / 大召喚術
reg_char('summoner',
    lambda: magic_bolt('summoner_basic', 0.32, 'arcane', 1.1),
    lambda: summon('summoner_skill1', 0.6, dark=False),
    lambda: soul_burst('summoner_skill2', 0.5),
    lambda: grand_summon('summoner_ultimate'))

# healer：治療聖光（壓低刺耳頂端，走溫暖飽滿的聖光）— 聖光彈 / 治癒之觸 / 神聖光環 / 生命匯流
reg_char('healer',
    lambda: mix(holy('healer_basic', 0.4, bright=0.92, pitch=1.0, shimmer=0.06, shimmer_hp=2800, top=0.08, warm=0.4, lp=6800) * 0.75,
                place(whoosh('hb_z', 0.3, 400, 1700, down=False, q=3) * 0.28, 0.1, 0.4)),
    lambda: holy('healer_skill1', 0.55, bright=0.9, pitch=1.05, choir=0.6, shimmer=0.05, shimmer_hp=2500, top=0.07, warm=0.5, lp=6200),
    lambda: holy('healer_skill2', 0.6, bright=0.82, pitch=0.82, choir=0.9, shimmer=0.05, shimmer_hp=2400, top=0.06, warm=0.6, lp=5600),
    lambda: life_confluence('healer_ultimate'))

# bard：吟遊 — 音波衝擊 / 激昂戰歌 / 療癒和弦 / 狂想交響樂
reg_char('bard',
    lambda: spec_filter(sonic_pulse('bard_basic', 0.4), lp=5800),
    lambda: chord_swell('bard_skill1', 0.6, root=220, bright=1.1),
    lambda: harp_chord('bard_skill2', 0.5, (294, 370, 440, 587)),
    lambda: symphony('bard_ultimate'))

# ninja：影 — 飛鏢 / 影縛符 / 影襲處決 / 千影分身
reg_char('ninja',
    lambda: shuriken('ninja_basic', 0.26),
    lambda: talisman('ninja_skill1', 0.32),
    lambda: shadow_strike('ninja_skill2', 0.3),
    lambda: shadow_flurry('ninja_ultimate'))

# star-orbit：星軌科幻 — 星火連彈 / 星軌砲 / 群星歸位 / 星環終焉砲
reg_char('star-orbit',
    lambda: spec_filter(laser('star-orbit_basic', 0.28, pitch=1.0), lp=6500),
    lambda: laser('star-orbit_skill1', 0.4, pitch=0.8, heavy=True),
    lambda: star_gather('star-orbit_skill2', 0.55),
    lambda: cosmic_burst('star-orbit_ultimate'))

# ───────────────────────── 寫檔 ─────────────────────────

def write_wav(path, x):
    x = np.clip(x, -1.0, 1.0)
    pcm = (x * 32767.0).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())

def clean_orphans(produced):
    removed = []
    for fn in os.listdir(OUT_DIR):
        if not fn.endswith('.wav'):
            continue
        stem = fn[:-4]
        if stem not in R:
            os.remove(os.path.join(OUT_DIR, fn))
            removed.append(stem)
    return removed

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    args = sys.argv[1:]
    full = not args
    targets = args if args else sorted(R.keys())
    missing = [t for t in targets if t not in R]
    if missing:
        print('未知音效名：', ', '.join(missing))
        print('可用：', ', '.join(sorted(R.keys())))
        return 1
    for name in targets:
        fn, loud, fo = R[name]
        wav = finalize(np.asarray(fn(), dtype=float), fade_out=fo, loud=loud)
        write_wav(os.path.join(OUT_DIR, name + '.wav'), wav)
        print(f'  {name:28s} {len(wav)/SR:5.2f}s')
    if full:
        gone = clean_orphans(set(targets))
        if gone:
            print('清掉孤兒檔：', ', '.join(sorted(gone)))
    print(f'完成：{len(targets)} 個音效')
    return 0

if __name__ == '__main__':
    sys.exit(main())
