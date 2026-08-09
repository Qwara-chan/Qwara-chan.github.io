---
title: "把心电图挂在脖子上：HeartLocket 开源硬件项目全记录"
description: "一个用 M5Stack Cardputer ADV + AD8232 打造的穿戴式 ECG 心率吊坠：1000 Hz 采样、板载 DSP（HR / HRV / PR-QRS-QT-QTc / 情绪识别）、屏幕 + 局域网 Web 仪表盘。这不是医疗设备，但方法论是认真的。"
pubDate: 2026-08-09
tags: ["嵌入式", "ESP32", "ECG", "开源硬件", "可穿戴"]
lang: "zh"
---

> 一个用 M5Stack Cardputer ADV + AD8232 打造的穿戴式 ECG 心率吊坠：1000 Hz 采样、板载 DSP（HR / HRV / PR-QRS-QT-QTc / 情绪识别）、屏幕 + 局域网 Web 仪表盘。这不是医疗设备，但方法论是认真的。

---

## 缘起：为什么想在脖子上挂一块心电图？

现代智能手环已经能把心率测得很准了，但几乎都不提供**原始 ECG 波形**——那种你在心电监护仪上看到的、一跳一跳的 P-QRS-T 波。ECG 才是心电活动的"真相"，心率只是它的副产品。

于是有了这个想法：做一个能真正采集心电图、还能戴在身上出门的小东西。

- **心率**（瞬时 + 平均 BPM）
- **实时 ECG 波形**（屏幕 + Web 双端）
- **心率变异性 HRV**：RMSSD / SDNN / pNN50
- **间期测量**：PR 间期、QRS 时限、QT / QTc（Bazett 校正）
- **情绪识别**：由 HR + RMSSD 映射，用颜文字显示 `(^_^)` 平静 / `(-_-)` 正常 / `(>_<)` 紧张
- **局域网 Web 仪表盘**：`http://heartlocket.local`，临床风格实时面板 + JSON API
- **模拟模式**：不需要任何传感器也能完整演示（合成 ECG 走的是和真实信号完全相同的 DSP 流水线）

硬件选型很"捡漏"：**M5Stack Cardputer ADV**（Stamp-S3A = ESP32-S3FN8，8 MB Flash，**没有 PSRAM**，内置 1200 mAh 电池）+ **AD8232** 单导联 ECG 前端模块 + 三片电极贴片。Cardputer 自带屏幕、键盘、电池和充电，天然就是一个完整的可穿戴终端。

## 系统架构：三任务 + 单写者

固件用 FreeRTOS 组织了三个任务，状态共享通过两个互斥锁保护的单例（`gMetrics` / `gWave`），并且坚持一个原则：**dspTask 是唯一的写者**。

```
┌─ dspTask（核0，优先级3）─────────────────────────────┐
│  adc_digi DMA 连续采样 @ 1000 Hz（硬件定时，无调度抖动）│
│  └─ 基线去除 → 双通道滤波 → Pan-Tompkins R 峰检测     │
│     → RR 伪迹过滤 → HRV → 逐拍形态学 → 情绪 → 质量门控 │
└────────────────────────────┬─────────────────────────┘
                             ▼
        gMetrics（MetricsSnapshot + mutex）◄── UI + Web 读取
        gWave（WaveRing int16 @ 250 Hz）   ◄── UI + Web 读取
```

- **loopTask** = `loop()` → `ui_loop()`：UI 渲染 + 键盘 + 背光自动调暗
- **netTask**（核1，优先级1，仅 `ENABLE_WIFI=1` 时创建）：WiFiManager 配网 + mDNS + HTTP 服务

dspTask 的节奏完全由 **DMA 硬件定时**驱动，`vTaskDelay(1)` 循环里不能有任何延迟相关的逻辑——RR 间期的时间精度来自硬件，而不是 RTOS 调度器。这是 1 ms RR 精度（HRV 测量的推荐精度）的根基。

## DSP：从裸 ADC 原始数据到临床级指标

### 采样与滤波

- **1000 Hz 有效采样**：ADC 在 2000 Hz 触发、两个通道分时（ECG + 电池电压），每通道实得 1000 Hz。RR 间期分辨率 1 ms。
- **基线去除**：1 s 移动平均。重点在于**瞬时 DC 阶跃吸附**——浮空引脚会注入电荷，单样本跳变可达数百计数，代码把这类阶跃瞬间拉平，而不是让它产生 1 s 的衰减伪影。阈值远高于真实 QRS 的最大斜率，所以真搏动永远不会被误伤。
- **双通道平滑**：检测通道用 10 ms 低通（~44 Hz，Pan-Tompkins 想要的窄带）；形态学通道用 4 ms 低通（~110 Hz），间期端点（QRS 起止、T 波终点）更贴近真实波形。

### R 峰检测：简化版 Pan-Tompkins

1. 差分 → 整流 → **150 ms 移动积分**
2. **1.5 s 开机自学习**：从积分最大值初始化信号峰 `SPK` 和噪声峰 `NPK`（学习后的前两拍丢弃，这是边界伪影）
3. 阈值 `THR = NPK + 0.25·(SPK − NPK)`，持续自适应：检出的峰更新 SPK，非峰更新 NPK
4. **250 ms 不应期**防止 T 波误触发；超过 1.5× 平均 RR 未检出时，**搜索回退**（阈值减半）补检漏跳

### RR 伪迹过滤

- 300–2000 ms（200–30 bpm）之外的间期直接丢弃
- 与最近 8 个间期中位数偏差 **>12%** 的丢弃——生理性 HRV 通常 <10%，异位搏动 >30%，真实变异永远不会被误杀

### 逐拍形态学测量（PR / QRS / QT / QTc）

`analyze_beat()` 在检测到下一个 R 时分析前一个搏动（此时 T 波已完整进入环形缓冲）：

1. 在 ±200 ms 窗口内重定位真实 R 峰（积分峰滞后于信号峰）
2. 局部基线 = [R−440, R−140] ms 窗口的**中位数**（避开 P 波）
3. 阈值 `p_thr = 5% × R 幅值`——完全相对化，自适应每个人
4. QRS 起点（R 上升支根部）→ S 谷 → **J 点**（QRS 终点）→ P 起点 → T 终点
5. **QTc = QT / √RR**（Bazett 公式）

所有搜索窗口都以 **ms** 定义，因此自动随采样率缩放。

### 信号质量硬门控：这个项目的灵魂

这是整个项目最让我骄傲的设计。市面上的心率设备对噪声通常只是"显示滤波后数据"，而 HeartLocket 的做法是**质量硬门控 NN 记录**：

- 每个检出的搏动都会测量 PR/QRS/QT，只有三者都落在生理范围（PR 80–300、QRS 50–180、QT 220–600 ms）才计为"可信"，形态学评分 `s_qual` 随之升降
- **连续 ~3 拍可信 + 4 s 内有可信拍 + RMS 噪声低于阈值** → 信号 GOOD
- **2 s 达不到** → NO SIGNAL：屏幕显示 `CHECK LEADS`，NN 环形缓冲和**全部指标被清空并停止写入**（不是隐藏，是真的停写！）。检测器继续作为探针运行，恢复状态只依据新搏动评判
- 每次质量状态切换都调用 `dsp_reset()` 重新学习阈值——陈旧的噪声 NN 永远不会残留
- 不接 AD8232 时，浮空引脚的噪声（工频干扰、突发尖峰、DC 阶跃）会产生 PR/QRS/QT 完全随机的伪搏动，评分永远爬不上去，质量机正确保持 NO SIGNAL——这是设计使然

换句话说：**噪声永远污染不了 HRV**。这在无 PSRAM、资源紧张的嵌入式平台上，实现的是临床监护仪级别的信号把关逻辑。

### 情绪识别

| 情绪 | 条件 |
|---|---|
| **CALM 平静** | 平均 HR < 65 且 RMSSD ≥ 40 ms |
| **STRESS 紧张** | 平均 HR ≥ 95，或（≥ 85 且 RMSSD < 25 ms） |
| **NORMAL 正常** | 其余 |

所有阈值都是 `config.h` 里的 `MOOD_*` 宏，随时可调。

## 模拟模式：没有传感器也能全流程演示

`ecg_sim.cpp` 合成 ECG：PQRST 高斯模板 + RSA 呼吸性窦性心律不齐 + AR(1) RR 噪声，每 40 s 在 CALM → NORMAL → STRESS 场景间切换。关键点：**合成信号走的是与真实信号完全相同的 DSP 路径**（`gSimMode`，按键 `S` 切换），场景切换会触发 `dsp_reset()` 让 HRV 干净重建。这相当于内置了一个"校准信号源"，可以随时验证整条流水线是否正常。

## Web 仪表盘：零资源依赖的临床风格面板

`web_server.cpp` 是自包含的：内联 CSS/JS 的 `INDEX_HTML`，**没有任何静态资源文件**。配网走 WiFiManager（首次开机开 `HeartLocket-AP` 热点，手机连上填 WiFi 密码即完成配网），mDNS 提供 `heartlocket.local`。

| 端点 | 说明 |
|---|---|
| `GET /` | 临床风格面板：KPI 卡片（HR/PR/QRS/QT/QTc/RMSSD）+ 实时 ECG 波形 + 状态徽章，自动刷新 |
| `GET /api/data` | JSON：bpm、pr、qrs、qt、qtc、rmssd、sdnn、pnn50、mood、电池、内存、运行时间…… |
| `GET /api/wave?points=N` | 最近 N 个波形采样（int16，≤1000，受无 PSRAM 堆限制） |
| `GET /api/rr` | 最近 50 个 NN 间期（ms） |
| `GET/POST /api/settings` | 读取/修改背光设置，即时生效并持久化 |

有个诚实的细节：`axis`（心电轴）被硬编码为 `"N/A"`——单导联测不出电轴，不装这个数。

![Web 仪表盘截图](/heartlocket/web_screenshot.png)

## 功耗：一个能戴一天的吊坠

既然是"吊坠"，续航就是第一诉求。按 `config.h` 里的"Power saving"方案逐项优化：

| 优化 | 做法 | 收益 |
|---|---|---|
| WiFi modem sleep | 空闲时进入调制解调器睡眠，HTTP 仍可达（首次请求 ~1 s 唤醒延迟） | WiFi ~130mA → ~40mA |
| 背光自动微光 | 20 s 无按键调暗（40）；60 s 微光（10/255 ≈ 4%，不彻底黑屏）；微光阶段**不重绘**（省 CPU/SPI）；任意键唤醒 | 背光 ~20-50mA → ~0 |
| CPU 降到 160 MHz | 采样是 DMA 硬件定时的，降频不影响精度 | CPU 功耗下降 |
| ADC 减半 | `ADC_SAMPLE_HZ` 2000→1000（每通道 500 Hz，RR 精度 2 ms） | ADC 功耗减半 |
| `ENABLE_WIFI 0` | 完全禁用 WiFi（最省电，但没有局域网服务） | 再省 ~12mA |

一个限制：**Light Sleep 不可用**——它会停掉 ADC DMA，而连续 HRV 采样离不开它。这是硬件实时采样的代价。

电池管理还有两道防线：**两级低压保护**（<3.5V 报警，<3.4V 强制调暗背光 + 关闭 WiFi 射频，带迟滞避免反复横跳）+ **任务看门狗**（DSP 任务一旦卡死自动重启）。

## 离线验证：一行行镜像固件的 Python 回归

嵌入式项目最痛苦的是"没法测"。HeartLocket 的做法是 `tools/dsp_check.py`——**固件 DSP 的逐行 Python 镜像**（质量机、基线吸附、形态学测量全部包含），覆盖 13 个场景：干净合成 ECG（3 档）、浮空引脚噪声族（工频干扰 / DC 阶跃 / 突发尖峰 / 白噪声 / 短路）、混合干扰。

```bash
python3 tools/dsp_check.py
```

核心断言：干净信号必须保持 GOOD 且心率精确；每一类噪声必须保持 NO_SIGNAL 且 NN = 0。

设备端 vs 离线（SIM 模式 STRESS 场景）@ 1000 Hz：

| 指标 | 设备端 | Python 离线 |
|---|---|---|
| bpm | 108.9–109.3 | 109.2 |
| rmssd | 2.9–3.6 ms | 3.2 ms |
| PR / QRS | 104–106 / 66–67 ms | 104 / 66 ms |
| QT / QTc | 265–267 / 357–360 ms | 264 / 357 ms |

一个有意思的发现：旧版 500 Hz 采样时 STRESS 场景的残余 RMSSD 约 13 ms；升到 1 kHz / 1 ms RR 计时后降到 ~3 ms——残余量主要来自**检测器量化抖动**，现在基本被消灭了。这验证了"硬件定时采样"不是玄学，是实打实的指标提升。

## 踩过的坑（硬件 + 固件）

1. **IDF 4.4 没有 `adc_continuous` API** —— 只能用 `adc_digi_*`；S3 的 DMA 帧是固定的 32 位 type2（`data[11:0] ch[15:13] unit[17]`），`format` 字段被 HAL 忽略。ECG 原始值要减 2048 居中。
2. **AD8232 必须用 3.3V 供电** —— 装配好的 Cardputer 上所有可触及端口（EXT 排针 / Grove）都只有 5V，3V3 藏在塑料壳里够不着。方案：5V → **低压差 LDO**（ME6211 / XC6206-3.3，dropout ~0.2V，电池供电时也能稳压）→ 3.3V。AMS1117 的 1.1V dropout 在电池下会掉到 3.0V 以下，只适合 USB 测试。**千万别直喂 5V**——输出中点会偏到 ~2.5V，R 波会超 ADC 量程削顶。
3. **可选 GPIO 供电只作应急** —— 用 Grove GPIO 拉高供 3.3V 能应急（S3 的 3.3V 轨在电池下仍存活），但没有稳压和过流保护，必须串 100Ω 电阻。默认配置 `ECG_PWR_PIN = -1`（外部供电）。
4. **无 PSRAM 的内存纪律** —— 波形环形缓冲按堆上限约束（`/api/wave` 最多 1000 点），所有分配都要精打细算。
5. **传递依赖 `arduino-irremote` 编译失败** —— `platformio.ini` 里取消注释 `lib_ignore = IRremote` 即可。
6. **LO+/LO− 硬件导联脱落检测** —— 接上 G4/G5 并打开 `USE_LOD=1` 后，电极脱落由硬件瞬时确认（无软件去抖），屏幕显示 CHECK LEADS、波形拉平（硬件背书的平线，和临床监护仪一样）。

## 怎么跑起来

```bash
git clone https://github.com/Qwara-chan/HeartLocket.git
cd HeartLocket
pio run              # 首次会自动下载工具链和 M5Cardputer/M5GFX 库
pio run -t upload    # 烧录（下载模式：关机 → 按住 G0 → 插 USB → 松开）
pio device monitor -p /dev/ttyACM0 -b 115200
```

当前资源占用：RAM ~71 KB / 320 KB（22.2%），Flash ~1.13 MB / 3.3 MB（34.7%）。

键盘快捷键：`M`/`W`/`D`/`I` 切换四个视图（情绪颜文字 / ECG 波形 / 详细数据 / 信息），`S` 切换模拟/真实模式，`B` 开关背光，`[`/`]` 调亮度，`-`/`=` 循环息屏预设。

## 配置体系：三级优先级

**SD 卡 `config.txt` > NVS（Web/API 写入）> 默认值**。Web/API 修改会同时写回 NVS 和 SD。所有可调参数（引脚、采样率、RR/HRV 阈值、情绪阈值、ECG 缩放）集中在 `src/config.h`，注释里写明了每个参数的调优理由——这是我给自己和未来维护者留的"为什么"。

## 项目结构

```
├── platformio.ini          # PlatformIO 构建配置
├── src/
│   ├── config.h            # 所有可调参数（引脚/速率/阈值/情绪/背光）
│   ├── main.cpp            # 3 个 FreeRTOS 任务：dspTask / loopTask(UI) / netTask
│   ├── adc_driver.cpp      # adc_digi DMA 采样（IDF 4.4 没有 adc_continuous）
│   ├── dsp.cpp             # 核心 DSP：基线/双通道滤波/Pan-Tompkins/HRV/形态学/质量门
│   ├── ecg_sim.cpp         # 合成 ECG（PQRST 高斯 + RSA + AR(1) RR 噪声）
│   ├── display_ui.cpp      # 4 个视图 + 键盘 + 背光
│   ├── web_server.cpp      # 自包含 Web 面板 + JSON API + WiFiManager + mDNS
│   ├── settings.cpp        # SD config.txt > NVS > 默认值（三级配置）
│   ├── metrics.h/.cpp      # MetricsSnapshot（互斥锁保护）
│   └── waveform.h/.cpp     # WaveRing（250 Hz 波形环形缓冲）
└── tools/
    └── dsp_check.py        # 离线 DSP 回归（固件的逐行 Python 镜像）
```

## 结语与未来

HeartLocket 是一个"方法论认真、定位轻松"的项目：它不试图成为医疗设备，但用了医疗监护级别的信号处理思路——硬件定时的 1 ms RR 计时、逐拍形态学验证、硬门控的 NN 质量体系、离线逐行镜像回归。这些工程实践在消费级手环上都不一定见得到。

可能的下一步：多导联（真正的电轴测量）、SD 卡长时 ECG 记录、BLE 手机联动、基于 QTc 变化趋势的疲劳提醒……

如果你也对"把临床级信号处理塞进一个小挂坠"感兴趣，代码在 [GitHub](https://github.com/Qwara-chan/HeartLocket)（MIT 协议），欢迎围观、fork、提 PR。

> ⚠️ **免责声明**：本项目仅用于学习和娱乐，**不是医疗设备**。心率、HRV 和间期测量结果不得用于任何医疗诊断，请勿基于本项目数据做任何医疗决策。

---

*HeartLocket · MIT License © 2026 HeartLocket Contributors · 更多细节见 [README.md](https://github.com/Qwara-chan/HeartLocket#readme)（英文）与 [README.zh-CN.md](https://github.com/Qwara-chan/HeartLocket/blob/main/README.zh-CN.md)（中文）*
