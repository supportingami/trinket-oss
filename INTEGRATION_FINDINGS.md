# Trinket OSS: Complete Language, Runtime & Architecture Reference

This document serves as the permanent technical reference for all language environments, frontend technologies, and containerized backend architectures in **Trinket OSS**.

---

## 1. Architectural Overview

Trinket operates on a **hybrid execution architecture**:

```
                                  ┌───────────────────────────────────────────────────────────────────┐
                                  │                            Trinket OSS                            │
                                  └─────────────────────────────────┬─────────────────────────────────┘
                                                                    │
                                    ┌───────────────────────────────┴───────────────────────────────┐
                                    │                                                               │
                    ┌───────────────▼───────────────┐                               ┌───────────────▼───────────────┐
                    │     Client-Side (In-Browser)  │                               │    Server-Side (Containers)  │
                    ├───────────────────────────────┤                               ├───────────────────────────────┤
                    │ • Zero server overhead        │                               │ • Real OS / CPython runtimes  │
                    │ • 100% JavaScript-driven      │                               │ • Communicates via WebSockets │
                    │ • Instant live execution      │                               │ • Supports full pip/apt tools │
                    └───────────────────────────────┘                               └───────────────────────────────┘
```

### Core Stack Technologies
- **Frontend**: AngularJS 1.x, Foundation 5, Ace Code Editor, JQConsole, Socket.IO / SockJS client.
- **Backend Application (`app`)**: Node.js 16/18 with Hapi 20+ framework, Nunjucks template engine, Vite (for SCSS assets).
- **Databases**: MongoDB (Mongoose ODM for users, courses, trinkets, assignments) + Redis (optional caching, session store, Bull queues).

---

## 2. Client-Side Languages (Zero Server Overhead)

Client-side trinkets run entirely inside the user's web browser without touching server compute resources.

| Language / Environment | Route / Embed URL | Underlying Technologies | Features & Built-in Libraries |
|---|---|---|---|
| **Python (Standard)** | `/embed/python` | **Skulpt** (Python-in-JS compiler) | • **`pygal`**: In-browser SVG charting (`Line`, `Bar`, `XY`, `Pie`, `Radar`) via Highcharts.<br>• **`turtle`**: HTML5 Canvas vector graphics.<br>• **`matplotlib.pyplot`**: D3.js-based 2D plotting.<br>• **`numpy`**: Partial array/matrix math operations.<br>• **`processing`**: Processing.js visual canvas animations.<br>• **`image`**: HTML5 Canvas image pixel manipulation.<br>• **`json` / `xml.etree.ElementTree`**: Data parsing.<br>• **Standard Python**: `math`, `random`, `datetime`, `time`, `re`, `urllib`. |
| **HTML / CSS / JS** | `/embed/html` | Browser Sandboxed `<iframe>` | Live, side-by-side web development preview with instant DOM reload. |
| **GlowScript (VPython)** | `/embed/glowscript` | **WebGL** + GlowScript 3.2 Engine | Real-time 3D physics simulations, gravitational orbits, 3D spheres, vectors, visual rotation. |
| **Blocks (Blockly)** | `/embed/blocks` | **Google Blockly** | Visual drag-and-drop block coding that translates blocks into executable Python code. |
| **GlowScript Blocks** | `/embed/glowscript-blocks` | **Google Blockly** + GlowScript | Visual drag-and-drop block coding for 3D WebGL physics simulations. |
| **Music** | `/embed/music` | **`music21j`** + **`VexFlow`** + **`MIDI.js`** | Interactive sheet music notation typesetting, chord analysis, and in-browser synthesizer audio playback. |

---

## 3. Server-Side Languages (Containerized Runners)

Server-side trinkets execute real language interpreters in isolated Docker containers and stream terminal output and generated media back to the browser over WebSockets.

### Summary Table

| Language | Backend Service | Internal Port | Runtime & Libraries | Output Mechanism |
|---|---|---|---|---|
| **Python 3** | `serverside/python-runner` | `8080` | **CPython 3.10** + CairoSVG + NumPy + Pandas + Matplotlib + SciPy + SymPy + Seaborn + Pygal | WebSocket console output + direct static HTTP serving for generated SVG/PNG plots (`/python3-generated/*`). |
| **Java** | `serverside/java/` | `8080` / `8200` | **OpenJDK 8** (`javac` compiler + JVM runtime) | WebSocket streaming for terminal `stdout`, `stderr`, and compilation errors. |
| **R** | `serverside/r/` | `8080` / `8300` | **GNU R 3.x** statistics environment | WebSocket interactive REPL + R base graphics streaming. |
| **Pygame** | `serverside/pygame/` | `8080` / `5900` | **Python Pygame** + X11 Virtual Framebuffer (Xvfb) | Real-time graphical desktop display streamed via WebSockets into an in-browser **NoVNC** canvas. |

---

## 4. Deep Dive: Consolidated Python 3 Architecture (`python-runner`)

To simplify deployment for Portainer and self-hosted instances, the legacy 3-container setup (`serverside-nginx`, `python3-manager`, `python3-shell`) has been consolidated into a **single standalone container**:

```
                         trinket-python-runner (Port 8080)
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. manager.js (Listening on 0.0.0.0:8080)                                   │
│    • Intercepts WebSocket requests at /python3/socket.io and /socket.io     │
│    • Directly serves generated SVG/PNG plots at /python3-generated/*        │
│    • Performs automated hourly disk cleanup for old sessions                │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. server.js (Listening on 127.0.0.1:8010)                                  │
│    • Spawns sandboxed CPython processes: `python3 -u -B /tmp/sessions/...`  │
│    • Chokidar file watcher monitors for newly created chart files           │
│    • Dispatches real-time `stdout`, `stderr`, and `file added` events       │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. PM2 Process Supervisor                                                   │
│    • Supervised by ecosystem.config.cjs                                     │
│    • Resource limits: mem_limit: 500m, cpus: 1.0, pids_limit: 50            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Production Portainer Stack Reference (`docker-compose.prod.yml`)

Your entire production stack consists of just **2 container images**:

```yaml
services:
  # 1. Main Web Application
  app:
    image: ghcr.io/supportingami/trinket-oss/app:latest
    container_name: trinket
    ports:
      - 3000:3000
    environment:
      - NODE_ENV=production
      - SESSION_COOKIE_PASSWORD=${SESSION_COOKIE_PASSWORD}
      - APP_URL_PROTOCOL=${APP_URL_PROTOCOL:-https}
      - APP_URL_HOSTNAME=${APP_URL_HOSTNAME:-trinket.samicharity.co.uk}
      - APP_URL_PORT=${APP_URL_PORT}
      - MONGO_HOST=${MONGO_HOST:-mongodb}
      - MONGO_PORT=${MONGO_PORT:-27017}
      - MONGO_DATABASE=${MONGO_DATABASE:-trinket}
      - REDIS_HOST=${REDIS_HOST:-redis}
      - REDIS_PORT=${REDIS_PORT:-6379}
      - ENABLE_PYTHON3=true
      - PYTHON3_API_URL=https://${APP_URL_HOSTNAME:-trinket.samicharity.co.uk}/python3
    networks:
      - trinket
    restart: unless-stopped

  # 2. Consolidated Python 3 Execution Runner
  python-runner:
    image: ghcr.io/supportingami/trinket-oss/python-runner:latest
    container_name: trinket-python-runner
    ports:
      - "8080:8080"
    environment:
      - PORT=8080
      - NODE_ENV=production
    mem_limit: 500m
    cpus: 1.0
    pids_limit: 50
    networks:
      - trinket
    restart: unless-stopped

networks:
  trinket:
    driver: bridge
```

---

## 6. Reverse Proxy Rules (Nginx / Traefik / Nginx Proxy Manager)

When serving behind an SSL reverse proxy (e.g. `https://trinket.samicharity.co.uk`):

| URL Path | Target Destination | Notes |
|---|---|---|
| **`/`** | `http://trinket:3000/` | Main web application |
| **`/python3/`** | `http://trinket-python-runner:8080/python3/` | **WebSocket Support / Upgrade** must be enabled |
| **`/python3-generated/`** | `http://trinket-python-runner:8080/python3-generated/` | Static chart file serving |

---

## 7. Pygal Usage Reference

### In-Browser Python (`/embed/python`)
```python
import pygal

xy_chart = pygal.XY()
xy_chart.title = 'Cross stitching'
xy_chart.add('', [(0, 9), (9, 0)])

# Renders directly to the browser DOM via Highcharts
xy_chart.render()
```

### Server-Side Python 3 (`/embed/python3`)
```python
import pygal

xy_chart = pygal.XY()
xy_chart.title = 'Cross stitching'
xy_chart.add('', [(0, 9), (9, 0)])

# Renders to SVG/PNG file via CairoSVG vector graphics
xy_chart.render_to_file('chart.svg')
```
