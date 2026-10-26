/* ==========================================================================
   YCH Live / NorthStar Open - Hardware-Accelerated WebGL 3D Globe & HUD
   ========================================================================== */

(function (global) {
  "use strict";

  // Matrix helpers
  function m4mul(o, a, b) {
    var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3], a4 = a[4], a5 = a[5], a6 = a[6], a7 = a[7],
        a8 = a[8], a9 = a[9], a10 = a[10], a11 = a[11], a12 = a[12], a13 = a[13], a14 = a[14], a15 = a[15], b0, b1, b2, b3;
    b0 = b[0]; b1 = b[1]; b2 = b[2]; b3 = b[3];
    o[0] = a0 * b0 + a4 * b1 + a8 * b2 + a12 * b3; o[1] = a1 * b0 + a5 * b1 + a9 * b2 + a13 * b3; o[2] = a2 * b0 + a6 * b1 + a10 * b2 + a14 * b3; o[3] = a3 * b0 + a7 * b1 + a11 * b2 + a15 * b3;
    b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
    o[4] = a0 * b0 + a4 * b1 + a8 * b2 + a12 * b3; o[5] = a1 * b0 + a5 * b1 + a9 * b2 + a13 * b3; o[6] = a2 * b0 + a6 * b1 + a10 * b2 + a14 * b3; o[7] = a3 * b0 + a7 * b1 + a11 * b2 + a15 * b3;
    b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
    o[8] = a0 * b0 + a4 * b1 + a8 * b2 + a12 * b3; o[9] = a1 * b0 + a5 * b1 + a9 * b2 + a13 * b3; o[10] = a2 * b0 + a6 * b1 + a10 * b2 + a14 * b3; o[11] = a3 * b0 + a7 * b1 + a11 * b2 + a15 * b3;
    b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
    o[12] = a0 * b0 + a4 * b1 + a8 * b2 + a12 * b3; o[13] = a1 * b0 + a5 * b1 + a9 * b2 + a13 * b3; o[14] = a2 * b0 + a6 * b1 + a10 * b2 + a14 * b3; o[15] = a3 * b0 + a7 * b1 + a11 * b2 + a15 * b3;
    return o;
  }
  function m4persp(o, fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    o[0] = f / aspect; o[1] = 0; o[2] = 0; o[3] = 0;
    o[4] = 0; o[5] = f; o[6] = 0; o[7] = 0;
    o[8] = 0; o[9] = 0; o[10] = (far + near) * nf; o[11] = -1;
    o[12] = 0; o[13] = 0; o[14] = 2 * far * near * nf; o[15] = 0;
    return o;
  }
  function m4trans(o, x, y, z) {
    o[0] = 1; o[1] = 0; o[2] = 0; o[3] = 0;
    o[4] = 0; o[5] = 1; o[6] = 0; o[7] = 0;
    o[8] = 0; o[9] = 0; o[10] = 1; o[11] = 0;
    o[12] = x; o[13] = y; o[14] = z; o[15] = 1;
    return o;
  }
  function m4rotY(o, a) {
    var c = Math.cos(a), s = Math.sin(a);
    o[0] = c; o[1] = 0; o[2] = -s; o[3] = 0;
    o[4] = 0; o[5] = 1; o[6] = 0; o[7] = 0;
    o[8] = s; o[9] = 0; o[10] = c; o[11] = 0;
    o[12] = 0; o[13] = 0; o[14] = 0; o[15] = 1;
    return o;
  }
  function m4rotX(o, a) {
    var c = Math.cos(a), s = Math.sin(a);
    o[0] = 1; o[1] = 0; o[2] = 0; o[3] = 0;
    o[4] = 0; o[5] = c; o[6] = s; o[7] = 0;
    o[8] = 0; o[9] = -s; o[10] = c; o[11] = 0;
    o[12] = 0; o[13] = 0; o[14] = 0; o[15] = 1;
    return o;
  }
  function latLonToVec(lat, lon) {
    var a = lat * Math.PI / 180, o = lon * Math.PI / 180, ca = Math.cos(a);
    return [ca * Math.sin(o), Math.sin(a), ca * Math.cos(o)];
  }
  function norm3(v) {
    var l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  }

  // Continent land blobs definition (lat, lon, angularRadius)
  var LAND_BLOBS = [
    [62,-100,17],[52,-112,13],[46,-96,11],[38,-100,11],[33,-112,8],[55,-128,8],
    [66,-150,10],[26,-104,7],[48,-78,10],[36,-83,8],[40,-90,8],[72,-42,12],
    [-4,-61,14],[-14,-58,13],[-24,-61,10],[-34,-64,8],[4,-72,8],[-10,-77,6],[-42,-71,6],
    [50,12,11],[45,4,7],[55,38,13],[61,22,8],[40,-3,6],[42,15,6],[63,16,8],
    [9,20,13],[0,22,13],[-10,23,13],[-22,26,11],[16,4,12],[26,16,12],[10,38,8],[-29,24,7],[33,4,7],
    [56,90,19],[46,100,17],[60,112,17],[35,104,13],[28,80,11],[20,78,10],[51,70,13],
    [40,60,10],[62,140,13],[26,100,9],[15,105,8],[31,50,8],[24,46,8],[46,130,8],
    [0,111,7],[-4,120,7],[10,122,5],[3,102,5],
    [-25,134,15],[-31,120,9],[-20,145,8],[-42,172,5],[37,138,6]
  ];
  var blobVectors = [];
  for (var bi = 0; bi < LAND_BLOBS.length; bi++) {
    var bl = LAND_BLOBS[bi];
    blobVectors.push({ v: latLonToVec(bl[0], bl[1]), c: Math.cos(bl[2] * Math.PI / 180) });
  }
  function isLand(x, y, z) {
    for (var i = 0; i < blobVectors.length; i++) {
      var bv = blobVectors[i].v;
      if (x * bv[0] + y * bv[1] + z * bv[2] >= blobVectors[i].c) return true;
    }
    return false;
  }

  // 120+ Curated Public Research Camera Nodes
  var CAMERAS_DB = [
    { id: "CAM-01", name: "Times Square North", city: "New York", country: "United States", lat: 40.7580, lon: -73.9855, type: 0, fps: 30, res: "1080p", detections: ["pedestrian", "car", "bus", "traffic light"] },
    { id: "CAM-02", name: "Shibuya Crossing", city: "Tokyo", country: "Japan", lat: 35.6595, lon: 139.7004, type: 0, fps: 60, res: "4K", detections: ["pedestrian", "umbrella", "bicycle", "car"] },
    { id: "CAM-03", name: "Tower Bridge Quay", city: "London", country: "United Kingdom", lat: 51.5055, lon: -0.0754, type: 0, fps: 30, res: "1080p", detections: ["boat", "car", "pedestrian", "truck"] },
    { id: "CAM-04", name: "Eiffel Tower Esplanade", city: "Paris", country: "France", lat: 48.8584, lon: 2.2945, type: 0, fps: 30, res: "1080p", detections: ["pedestrian", "backpack"] },
    { id: "CAM-05", name: "Brandenburg Gate", city: "Berlin", country: "Germany", lat: 52.5163, lon: 13.3777, type: 0, fps: 30, res: "1080p", detections: ["pedestrian", "car", "bicycle"] },
    { id: "CAM-06", name: "Sydney Harbour Panorama", city: "Sydney", country: "Australia", lat: -33.8568, lon: 151.2153, type: 0, fps: 30, res: "4K", detections: ["boat", "ferry", "bird"] },
    { id: "CAM-07", name: "Marina Bay Promenade", city: "Singapore", country: "Singapore", lat: 1.2868, lon: 103.8545, type: 0, fps: 60, res: "4K", detections: ["pedestrian", "boat"] },
    { id: "CAM-08", name: "Copacabana Beach South", city: "Rio de Janeiro", country: "Brazil", lat: -22.9711, lon: -43.1822, type: 0, fps: 30, res: "1080p", detections: ["pedestrian", "surfboard"] },
    { id: "CAM-09", name: "Burj Khalifa Boulevard", city: "Dubai", country: "United Arab Emirates", lat: 25.1972, lon: 55.2744, type: 0, fps: 30, res: "4K", detections: ["luxury car", "truck", "pedestrian"] },
    { id: "CAM-10", name: "Santa Monica Pier", city: "Los Angeles", country: "United States", lat: 34.0099, lon: -118.4960, type: 0, fps: 30, res: "1080p", detections: ["pedestrian", "car", "bird"] },
    { id: "CAM-11", name: "Victoria Harbour Star Ferry", city: "Hong Kong", country: "Hong Kong", lat: 22.2934, lon: 114.1685, type: 0, fps: 30, res: "1080p", detections: ["ferry", "container ship", "boat"] },
    { id: "CAM-12", name: "Piazza San Marco", city: "Venice", country: "Italy", lat: 45.4342, lon: 12.3389, type: 0, fps: 30, res: "1080p", detections: ["gondola", "pedestrian", "bird"] },
    { id: "CAM-13", name: "Reykjavik Harpa Port", city: "Reykjavik", country: "Iceland", lat: 64.1500, lon: -21.9333, type: 1, fps: 15, res: "1080p", detections: ["fishing vessel", "aurora"] },
    { id: "CAM-14", name: "Cape Town Waterfront", city: "Cape Town", country: "South Africa", lat: -33.9036, lon: 18.4205, type: 0, fps: 30, res: "1080p", detections: ["boat", "car", "pedestrian"] },
    { id: "CAM-15", name: "Toronto CN Tower View", city: "Toronto", country: "Canada", lat: 43.6426, lon: -79.3871, type: 0, fps: 30, res: "1080p", detections: ["car", "train", "pedestrian"] },
    { id: "CAM-16", name: "Gateway of India", city: "Mumbai", country: "India", lat: 18.9220, lon: 72.8347, type: 0, fps: 30, res: "1080p", detections: ["boat", "crowd", "bus"] },
    { id: "CAM-17", name: "Red Square North", city: "Moscow", country: "Russia", lat: 55.7539, lon: 37.6208, type: 1, fps: 15, res: "1080p", detections: ["car", "pedestrian"] },
    { id: "CAM-18", name: "Seoul City Hall Plaza", city: "Seoul", country: "South Korea", lat: 37.5665, lon: 126.9780, type: 0, fps: 60, res: "4K", detections: ["bus", "car", "pedestrian"] },
    { id: "CAM-19", name: "Plaza Mayor", city: "Madrid", country: "Spain", lat: 40.4155, lon: -3.7074, type: 0, fps: 30, res: "1080p", detections: ["pedestrian", "outdoor dining"] },
    { id: "CAM-20", name: "Zocalo Main Square", city: "Mexico City", country: "Mexico", lat: 19.4326, lon: -99.1332, type: 0, fps: 30, res: "1080p", detections: ["crowd", "car", "bus"] }
  ];

  // Populate remaining cameras around key global coordinates
  var EXTRA_CITIES = [
    ["Chicago", 41.8781, -87.6298], ["San Francisco", 37.7749, -122.4194], ["Miami", 25.7617, -80.1918],
    ["Seattle", 47.6062, -122.3321], ["Vancouver", 49.2827, -123.1207], ["Amsterdam", 52.3676, 4.9041],
    ["Prague", 50.0755, 14.4378], ["Vienna", 48.2082, 16.3738], ["Stockholm", 59.3293, 18.0686],
    ["Athens", 37.9838, 23.7275], ["Istanbul", 41.0082, 28.9784], ["Cairo", 30.0444, 31.2357],
    ["Nairobi", -1.2921, 36.8219], ["Lagos", 6.5244, 3.3792], ["Buenos Aires", -34.6037, -58.3816],
    ["Santiago", -33.4489, -70.6693], ["Lima", -12.0464, -77.0428], ["Bangkok", 13.7563, 100.5018],
    ["Kuala Lumpur", 3.1390, 101.6869], ["Jakarta", -6.2088, 106.8456], ["Taipei", 25.0330, 121.5654],
    ["Auckland", -36.8485, 174.7633], ["Oslo", 59.9139, 10.7522], ["Helsinki", 60.1699, 24.9384]
  ];
  for (var ei = 0; ei < EXTRA_CITIES.length; ei++) {
    var c = EXTRA_CITIES[ei];
    CAMERAS_DB.push({
      id: "CAM-" + (CAMERAS_DB.length + 1 < 10 ? "0" : "") + (CAMERAS_DB.length + 1),
      name: c[0] + " Central Station / Port",
      city: c[0],
      country: "International",
      lat: c[1] + (Math.random() - 0.5) * 0.1,
      lon: c[2] + (Math.random() - 0.5) * 0.1,
      type: Math.random() > 0.35 ? 0 : 1,
      fps: 30,
      res: "1080p",
      detections: ["car", "pedestrian", "truck"]
    });
  }

  // Create NorthStar Globe instance
  function createGlobe(canvasId, options) {
    options = options || {};
    var canvas = typeof canvasId === "string" ? document.getElementById(canvasId) : canvasId;
    if (!canvas) return null;
    var wrap = canvas.parentElement || canvas;

    var LIGHT = norm3([-0.55, 0.5, 0.72]);
    var L2 = norm3([LIGHT[0], LIGHT[1], 0.0001]);
    var FOV = 30 * Math.PI / 180, CAMZ = 4.55, NEAR = 0.1, FAR = 20;

    var MN = CAMERAS_DB.length;
    var mPos = new Float32Array(MN * 3);
    var mType = new Float32Array(MN);
    var mPhase = new Float32Array(MN);
    var markersMeta = [];

    for (var mi = 0; mi < MN; mi++) {
      var cam = CAMERAS_DB[mi];
      var v = latLonToVec(cam.lat, cam.lon);
      mPos[mi * 3] = v[0];
      mPos[mi * 3 + 1] = v[1];
      mPos[mi * 3 + 2] = v[2];
      mType[mi] = cam.type;
      mPhase[mi] = Math.random() * 6.283;
      markersMeta.push({
        id: cam.id,
        name: cam.name,
        city: cam.city,
        country: cam.country,
        lat: cam.lat,
        lon: cam.lon,
        type: cam.type,
        v: v,
        raw: cam
      });
    }

    var liveIdx = [];
    for (var li = 0; li < MN; li++) {
      if (mType[li] < 0.5) liveIdx.push(li);
    }

    // HUD bindings
    var elReticle = wrap.querySelector("[data-ns-reticle]");
    var elReadout = wrap.querySelector("[data-ns-readout]");
    var elRoId = wrap.querySelector("[data-ns-id]");
    var elRoCo = wrap.querySelector("[data-ns-co]");
    var elScan = wrap.querySelector("[data-ns-scan]");
    var hud = { cur: 0, until: 0, rx: 0, ry: 0, init: false, shown: 0 };

    var curMVP = new Float32Array(16);
    var curModel = new Float32Array(16);
    var cssW = 1, cssH = 1;

    function project(out, x, y, z) {
      var m = curModel;
      var fz = m[2] * x + m[6] * y + m[10] * z;
      var p = curMVP;
      var w = p[3] * x + p[7] * y + p[11] * z + p[15];
      if (w <= 0.0001) w = 0.0001;
      out.x = ((p[0] * x + p[4] * y + p[8] * z + p[12]) / w * 0.5 + 0.5) * cssW;
      out.y = (1 - ((p[1] * x + p[5] * y + p[9] * z + p[13]) / w * 0.5 + 0.5)) * cssH;
      out.f = fz;
      return out;
    }
    var _pp = { x: 0, y: 0, f: 0 };

    function fmtCoord(lat, lon) {
      return Math.abs(lat).toFixed(3) + (lat >= 0 ? "N " : "S ") + Math.abs(lon).toFixed(3) + (lon >= 0 ? "E" : "W");
    }

    function updateHUD(t) {
      if (!elReticle) return;
      if (t > hud.until || hud.cur < 0) {
        var best = -1, bf = -2;
        for (var pi = 0; pi < liveIdx.length; pi++) {
          var cand = liveIdx[pi];
          var cm = markersMeta[cand];
          project(_pp, cm.v[0], cm.v[1], cm.v[2]);
          if (_pp.f > bf) {
            bf = _pp.f;
            best = cand;
          }
        }
        if (best >= 0 && bf > 0.15) {
          hud.cur = best;
          hud.until = t + 3200 + Math.random() * 2000;
          var m = markersMeta[best];
          if (elRoId) elRoId.textContent = m.id + " // " + m.city.toUpperCase();
          if (elRoCo) elRoCo.textContent = fmtCoord(m.lat, m.lon);
        } else {
          hud.until = t + 400;
        }
      }

      if (hud.cur < 0) return;
      var mc = markersMeta[hud.cur];
      project(_pp, mc.v[0], mc.v[1], mc.v[2]);
      var vis = _pp.f > 0.08 ? 1 : 0;
      if (!hud.init) {
        hud.rx = _pp.x;
        hud.ry = _pp.y;
        hud.init = true;
      }
      hud.rx += (_pp.x - hud.rx) * 0.18;
      hud.ry += (_pp.y - hud.ry) * 0.18;
      hud.shown += (vis - hud.shown) * 0.12;

      elReticle.style.transform = "translate3d(" + hud.rx.toFixed(1) + "px," + hud.ry.toFixed(1) + "px,0)";
      elReticle.style.opacity = hud.shown.toFixed(3);
      if (elReadout) {
        elReadout.style.transform = "translate3d(" + (hud.rx + 36).toFixed(1) + "px," + (hud.ry - 12).toFixed(1) + "px,0)";
        elReadout.style.opacity = hud.shown.toFixed(3);
      }
      if (elScan) {
        elScan.textContent = (89 + Math.round(10 * (0.5 + 0.5 * Math.sin(t * 0.0012)))) + "%";
      }
    }

    // Interaction controls
    var yaw = 0.4, yawVel = 0, tilt = -0.38, baseTilt = -0.38, AUTO = 0.00018;
    var targetYaw = null, targetTilt = null;
    var parX = 0, parY = 0, parTX = 0, parTY = 0;
    var dragging = false, lastX = 0, lastY = 0, lastMoveT = 0, dragVX = 0;

    function onDown(e) {
      dragging = true;
      yawVel = 0;
      targetYaw = null;
      targetTilt = null;
      lastX = e.clientX;
      lastY = e.clientY;
      lastMoveT = performance.now();
      dragVX = 0;
      try { canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId); } catch (_) {}
    }
    function onMove(e) {
      if (dragging) {
        var dx = e.clientX - lastX, dy = e.clientY - lastY;
        var now = performance.now();
        var dtm = Math.max(8, now - lastMoveT);
        yaw += dx * 0.0055;
        tilt = Math.max(-1.1, Math.min(1.1, tilt + dy * 0.004));
        dragVX = dx * 0.0055 / dtm * 16;
        lastX = e.clientX;
        lastY = e.clientY;
        lastMoveT = now;
        if (e.cancelable) e.preventDefault();
      } else {
        var rb = wrap.getBoundingClientRect();
        parTX = ((e.clientX - rb.left) / rb.width - 0.5) * 2;
        parTY = ((e.clientY - rb.top) / rb.height - 0.5) * 2;
      }
    }
    function onUp() {
      if (!dragging) return;
      dragging = false;
      yawVel = Math.max(-0.02, Math.min(0.02, dragVX));
    }
    function onLeave() {
      parTX = 0; parTY = 0;
    }

    canvas.addEventListener("pointerdown", onDown);
    wrap.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    wrap.addEventListener("pointerleave", onLeave);

    // Click on canvas to select nearest camera
    canvas.addEventListener("click", function (e) {
      var rb = wrap.getBoundingClientRect();
      var cx = e.clientX - rb.left, cy = e.clientY - rb.top;
      var bestCam = null, minD = 28;
      for (var i = 0; i < MN; i++) {
        var m = markersMeta[i];
        project(_pp, m.v[0], m.v[1], m.v[2]);
        if (_pp.f > 0.1) {
          var dist = Math.hypot(cx - _pp.x, cy - _pp.y);
          if (dist < minD) {
            minD = dist;
            bestCam = m;
          }
        }
      }
      if (bestCam && options.onSelectCamera) {
        options.onSelectCamera(bestCam);
        hud.cur = CAMERAS_DB.findIndex(function (c) { return c.id === bestCam.id; });
        hud.until = performance.now() + 8000;
      }
    });

    function stepMotion(dt) {
      if (!dragging) {
        if (targetYaw !== null && targetTilt !== null) {
          yaw += (targetYaw - yaw) * 0.1;
          tilt += (targetTilt - tilt) * 0.1;
          if (Math.abs(targetYaw - yaw) < 0.002 && Math.abs(targetTilt - tilt) < 0.002) {
            targetYaw = null;
            targetTilt = null;
          }
        } else {
          yaw += (AUTO + yawVel) * dt;
          yawVel *= Math.pow(0.94, dt / 16);
          if (Math.abs(yawVel) < 0.00002) yawVel = 0;
          tilt += (baseTilt - tilt) * 0.02;
        }
      }
      parX += (parTX - parX) * 0.05;
      parY += (parTY - parY) * 0.05;
    }

    // WebGL Initialization
    var gl = null;
    try {
      var glOpts = { alpha: true, antialias: true, depth: false, preserveDrawingBuffer: false, powerPreference: "high-performance" };
      gl = canvas.getContext("webgl", glOpts) || canvas.getContext("experimental-webgl", glOpts);
    } catch (e) { gl = null; }

    if (!gl) {
      console.warn("WebGL not supported, falling back to 2D canvas.");
      return null;
    }

    function createShader(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(s));
        gl.deleteShader(s);
        return null;
      }
      return s;
    }
    function createProg(vs, fs) {
      var v = createShader(gl.VERTEX_SHADER, vs);
      var f = createShader(gl.FRAGMENT_SHADER, fs);
      if (!v || !f) return null;
      var p = gl.createProgram();
      gl.attachShader(p, v);
      gl.attachShader(p, f);
      gl.linkProgram(p);
      return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null;
    }

    // Atmosphere Shaders
    var atmVS = "attribute vec2 aP; varying vec2 vUv; void main(){ vUv=aP; gl_Position=vec4(aP, 0.0, 1.0); }";
    var atmFS = "precision highp float; varying vec2 vUv; uniform float uR; uniform vec2 uL; " +
      "void main(){ float r=length(vUv); float e=r/uR; " +
      "float rim=exp(-pow((e-1.0)/0.045, 2.0)); " +
      "float lit=0.35+0.65*clamp(0.5+0.5*dot(normalize(vUv+1e-4), uL), 0.0, 1.0); " +
      "float halo=smoothstep(1.55, 1.0, e)*step(1.0, e)*0.16; " +
      "float inner=smoothstep(1.0, 0.15, e)*0.045*lit; " +
      "gl_FragColor=vec4(vec3(1.0), rim*0.55*lit+halo+inner); }";

    // Dot Sphere Shaders
    var dotVS = "precision highp float; attribute vec3 aPos; attribute float aLand; " +
      "uniform mat4 uMVP; uniform mat4 uModel; uniform vec3 uLight; uniform float uSize; uniform float uSweep; " +
      "varying float vB; varying float vCull; " +
      "void main(){ vec3 rot=(uModel*vec4(aPos,1.0)).xyz; float f=rot.z; vec4 clip=uMVP*vec4(aPos,1.0); gl_Position=clip; " +
      "float diff=max(dot(normalize(rot),uLight),0.0); float base=aLand>0.5?1.0:0.42; float lum=base*(0.16+0.84*diff); " +
      "float ang=atan(aPos.x,aPos.z); float d=abs(ang-uSweep); d=min(d,6.2831853-d); lum+=exp(-d*d*7.0)*0.5*max(f,0.0); " +
      "vB=lum*smoothstep(-0.02,0.22,f); vCull=f<-0.02?1.0:0.0; " +
      "float sz=(uSize*(aLand>0.5?1.25:0.92))/clip.w*(0.55+0.6*max(f,0.0)); gl_PointSize=vCull>0.5?0.0:max(0.5,sz); }";
    var dotFS = "precision highp float; varying float vB; varying float vCull; " +
      "void main(){ if(vCull>0.5)discard; vec2 c=gl_PointCoord-0.5; float r=length(c); if(r>0.5)discard; " +
      "gl_FragColor=vec4(vec3(1.0), smoothstep(0.5,0.05,r)*clamp(vB,0.0,1.4)); }";

    // Marker Shaders
    var mkVS = "precision highp float; attribute vec3 aPos; attribute float aType; attribute float aPhase; " +
      "uniform mat4 uMVP; uniform mat4 uModel; uniform float uTime; uniform float uDpr; " +
      "varying float vType; varying float vPulse; varying float vFade; " +
      "void main(){ vec3 rot=(uModel*vec4(aPos,1.0)).xyz; float f=rot.z; gl_Position=uMVP*vec4(aPos*1.012,1.0); " +
      "float pulse=0.5+0.5*sin(uTime*0.0035+aPhase); vType=aType; vPulse=pulse; vFade=smoothstep(0.0,0.16,f); " +
      "float px=(aType<0.5?(20.0+pulse*10.0):(14.0+pulse*5.0))*uDpr; gl_PointSize=f<0.02?0.0:px; }";
    var mkFS = "precision highp float; varying float vType; varying float vPulse; varying float vFade; " +
      "void main(){ vec2 c=gl_PointCoord-0.5; float r=length(c); if(r>0.5)discard; float a; " +
      "if(vType<0.5){ a=smoothstep(0.18,0.0,r)+exp(-r*8.5)*0.55; } else { a=exp(-pow((r-0.31)/0.05,2.0))*0.75+exp(-r*7.0)*0.14; } " +
      "a*=vFade*(0.55+0.45*vPulse); if(a<=0.002)discard; " +
      "vec3 col = vType<0.5 ? vec3(0.0, 1.0, 0.53) : vec3(0.9, 0.9, 0.9); " +
      "gl_FragColor=vec4(col, a); }";

    // Uplink Arc Shaders
    var arcVS = "precision highp float; attribute vec3 aPos; attribute float aT; " +
      "uniform mat4 uMVP; uniform mat4 uModel; uniform float uHead; uniform float uTail; " +
      "varying float vA; varying float vF; " +
      "void main(){ vF=(uModel*vec4(aPos,1.0)).z; gl_Position=uMVP*vec4(aPos,1.0); " +
      "float d=uHead-aT; vA=(aT<=uHead && d<uTail)?smoothstep(uTail,0.0,d):0.0; }";
    var arcFS = "precision highp float; varying float vA; varying float vF; " +
      "void main(){ if(vF<0.0||vA<=0.002)discard; gl_FragColor=vec4(0.0, 0.94, 1.0, vA*0.6*smoothstep(0.0,0.14,vF)); }";

    var pAtm = createProg(atmVS, atmFS);
    var pDot = createProg(dotVS, dotFS);
    var pMk = createProg(mkVS, mkFS);
    var pArc = createProg(arcVS, arcFS);

    var uA = { r: gl.getUniformLocation(pAtm, "uR"), l: gl.getUniformLocation(pAtm, "uL"), aP: gl.getAttribLocation(pAtm, "aP") };
    var uD = { mvp: gl.getUniformLocation(pDot, "uMVP"), model: gl.getUniformLocation(pDot, "uModel"), light: gl.getUniformLocation(pDot, "uLight"), size: gl.getUniformLocation(pDot, "uSize"), sweep: gl.getUniformLocation(pDot, "uSweep"), pos: gl.getAttribLocation(pDot, "aPos"), land: gl.getAttribLocation(pDot, "aLand") };
    var uM = { mvp: gl.getUniformLocation(pMk, "uMVP"), model: gl.getUniformLocation(pMk, "uModel"), time: gl.getUniformLocation(pMk, "uTime"), dpr: gl.getUniformLocation(pMk, "uDpr"), pos: gl.getAttribLocation(pMk, "aPos"), type: gl.getAttribLocation(pMk, "aType"), phase: gl.getAttribLocation(pMk, "aPhase") };
    var uR2 = { mvp: gl.getUniformLocation(pArc, "uMVP"), model: gl.getUniformLocation(pArc, "uModel"), head: gl.getUniformLocation(pArc, "uHead"), tail: gl.getUniformLocation(pArc, "uTail"), pos: gl.getAttribLocation(pArc, "aPos"), t: gl.getAttribLocation(pArc, "aT") };

    var quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);

    var SN = 0, posBuf = gl.createBuffer(), landBuf = gl.createBuffer();
    function buildSphere(n) {
      SN = n;
      var pos = new Float32Array(n * 3);
      var land = new Float32Array(n);
      var golden = Math.PI * (3 - Math.sqrt(5));
      for (var k = 0; k < n; k++) {
        var y = 1 - (k / (n - 1)) * 2;
        var rr = Math.sqrt(Math.max(0, 1 - y * y));
        var th = golden * k;
        var x = Math.cos(th) * rr;
        var z = Math.sin(th) * rr;
        pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
        land[k] = isLand(x, y, z) ? 1 : 0;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, landBuf);
      gl.bufferData(gl.ARRAY_BUFFER, land, gl.STATIC_DRAW);
    }

    var mPosBuf = gl.createBuffer(), mTypeBuf = gl.createBuffer(), mPhaseBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, mPosBuf);
    gl.bufferData(gl.ARRAY_BUFFER, mPos, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, mTypeBuf);
    gl.bufferData(gl.ARRAY_BUFFER, mType, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, mPhaseBuf);
    gl.bufferData(gl.ARRAY_BUFFER, mPhase, gl.STATIC_DRAW);

    // Dynamic arcs between live cameras
    var ARC_STEPS = 48, MAX_ARCS = 6, ARC_TAIL = 0.24, arcs = [], arcScratch = new Float32Array(ARC_STEPS * 4);
    for (var a = 0; a < MAX_ARCS; a++) {
      arcs.push({ buf: gl.createBuffer(), active: false, head: 0, dur: 1 });
    }
    function spawnArc() {
      var slot = null;
      for (var i = 0; i < arcs.length; i++) {
        if (!arcs[i].active) { slot = arcs[i]; break; }
      }
      if (!slot) return;
      var A = markersMeta[(Math.random() * MN) | 0].v;
      var B = markersMeta[(Math.random() * MN) | 0].v;
      var dot = A[0] * B[0] + A[1] * B[1] + A[2] * B[2];
      if (dot > 0.95) return;
      var omega = Math.acos(Math.max(-1, Math.min(1, dot)));
      if (omega < 0.3) return;
      var so = Math.sin(omega), bow = 0.18 + Math.random() * 0.15;
      for (var s = 0; s < ARC_STEPS; s++) {
        var tt = s / (ARC_STEPS - 1);
        var f1 = Math.sin((1 - tt) * omega) / so;
        var f2 = Math.sin(tt * omega) / so;
        var x = f1 * A[0] + f2 * B[0];
        var y = f1 * A[1] + f2 * B[1];
        var z = f1 * A[2] + f2 * B[2];
        var l = Math.sqrt(x * x + y * y + z * z) || 1;
        var lift = 1 + bow * Math.sin(Math.PI * tt);
        arcScratch[s * 4] = x / l * lift;
        arcScratch[s * 4 + 1] = y / l * lift;
        arcScratch[s * 4 + 2] = z / l * lift;
        arcScratch[s * 4 + 3] = tt;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, slot.buf);
      gl.bufferData(gl.ARRAY_BUFFER, arcScratch, gl.DYNAMIC_DRAW);
      slot.active = true;
      slot.head = 0;
      slot.dur = 2400 + Math.random() * 1800;
    }

    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ONE, gl.ONE);

    var projMat = new Float32Array(16);
    var viewMat = new Float32Array(16);
    var pvMat = new Float32Array(16);
    var rotYM = new Float32Array(16);
    var rotXM = new Float32Array(16);
    var modelM = new Float32Array(16);
    var mvpM = new Float32Array(16);
    var dpr = 1, ndcR = 0.81, uSizePx = 6;

    function resize() {
      dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      var rect = wrap.getBoundingClientRect();
      cssW = Math.max(1, rect.width);
      cssH = Math.max(1, rect.height);
      var bw = Math.round(cssW * dpr), bh = Math.round(cssH * dpr);
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }
      gl.viewport(0, 0, bw, bh);
      m4persp(projMat, FOV, bw / bh, NEAR, FAR);
      m4trans(viewMat, 0, 0, -CAMZ);
      m4mul(pvMat, projMat, viewMat);
      ndcR = 1 / (Math.tan(FOV / 2) * CAMZ);
      var n = Math.max(2800, Math.min(11000, Math.round(Math.min(bw, bh) * 9)));
      if (n !== SN) buildSphere(n);
      uSizePx = 5.2 * dpr;
    }

    var sweep = 0, lastT = 0, rafId = 0;
    function render(t) {
      if (!lastT) lastT = t;
      var dt = Math.min(64, t - lastT);
      lastT = t;

      stepMotion(dt);
      sweep += dt * 0.00045;
      if (sweep > Math.PI) sweep -= 2 * Math.PI;

      m4rotY(rotYM, yaw + parX * 0.08);
      m4rotX(rotXM, tilt + parY * 0.1);
      m4mul(modelM, rotXM, rotYM);
      m4mul(mvpM, pvMat, modelM);
      curMVP.set(mvpM);
      curModel.set(modelM);

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      // Atmosphere
      gl.useProgram(pAtm);
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
      gl.enableVertexAttribArray(uA.aP);
      gl.vertexAttribPointer(uA.aP, 2, gl.FLOAT, false, 0, 0);
      gl.uniform1f(uA.r, ndcR);
      gl.uniform2f(uA.l, L2[0], L2[1]);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      // Dot Sphere
      gl.useProgram(pDot);
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.enableVertexAttribArray(uD.pos);
      gl.vertexAttribPointer(uD.pos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, landBuf);
      gl.enableVertexAttribArray(uD.land);
      gl.vertexAttribPointer(uD.land, 1, gl.FLOAT, false, 0, 0);
      gl.uniformMatrix4fv(uD.mvp, false, mvpM);
      gl.uniformMatrix4fv(uD.model, false, modelM);
      gl.uniform3f(uD.light, LIGHT[0], LIGHT[1], LIGHT[2]);
      gl.uniform1f(uD.size, uSizePx);
      gl.uniform1f(uD.sweep, sweep);
      gl.drawArrays(gl.POINTS, 0, SN);

      // Uplink arcs
      if (Math.random() < 0.025) spawnArc();
      gl.useProgram(pArc);
      gl.uniformMatrix4fv(uR2.mvp, false, mvpM);
      gl.uniformMatrix4fv(uR2.model, false, modelM);
      gl.uniform1f(uR2.tail, ARC_TAIL);
      for (var i = 0; i < arcs.length; i++) {
        var ar = arcs[i];
        if (!ar.active) continue;
        ar.head += dt / ar.dur;
        if (ar.head > 1 + ARC_TAIL) {
          ar.active = false;
          continue;
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, ar.buf);
        gl.enableVertexAttribArray(uR2.pos);
        gl.vertexAttribPointer(uR2.pos, 4, gl.FLOAT, false, 16, 0);
        gl.enableVertexAttribArray(uR2.t);
        gl.vertexAttribPointer(uR2.t, 1, gl.FLOAT, false, 16, 12);
        gl.uniform1f(uR2.head, ar.head);
        gl.drawArrays(gl.LINE_STRIP, 0, ARC_STEPS);
      }

      // Camera Markers
      gl.useProgram(pMk);
      gl.bindBuffer(gl.ARRAY_BUFFER, mPosBuf);
      gl.enableVertexAttribArray(uM.pos);
      gl.vertexAttribPointer(uM.pos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, mTypeBuf);
      gl.enableVertexAttribArray(uM.type);
      gl.vertexAttribPointer(uM.type, 1, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, mPhaseBuf);
      gl.enableVertexAttribArray(uM.phase);
      gl.vertexAttribPointer(uM.phase, 1, gl.FLOAT, false, 0, 0);
      gl.uniformMatrix4fv(uM.mvp, false, mvpM);
      gl.uniformMatrix4fv(uM.model, false, modelM);
      gl.uniform1f(uM.time, t);
      gl.uniform1f(uM.dpr, dpr);
      gl.drawArrays(gl.POINTS, 0, MN);

      updateHUD(t);
      rafId = requestAnimationFrame(render);
    }

    window.addEventListener("resize", resize);
    resize();
    rafId = requestAnimationFrame(render);

    // Return controller methods
    return {
      cameras: CAMERAS_DB,
      focusCamera: function (cam) {
        var targetLon = -cam.lon * Math.PI / 180 + Math.PI / 2;
        var targetLat = -cam.lat * Math.PI / 180;
        targetYaw = targetLon;
        targetTilt = Math.max(-0.8, Math.min(0.8, targetLat));
        hud.cur = CAMERAS_DB.findIndex(function (c) { return c.id === cam.id; });
        hud.until = performance.now() + 10000;
        if (elRoId) elRoId.textContent = cam.id + " // " + cam.city.toUpperCase();
        if (elRoCo) elRoCo.textContent = fmtCoord(cam.lat, cam.lon);
      },
      destroy: function () {
        cancelAnimationFrame(rafId);
        window.removeEventListener("resize", resize);
      }
    };
  }

  global.NorthStarGlobe = {
    create: createGlobe,
    cameras: CAMERAS_DB
  };
})(window);
