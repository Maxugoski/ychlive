/* ==========================================================================
   YCH Live / NorthStar Open - Landing Page Interaction Suite
   ========================================================================== */

(function () {
  "use strict";

  // Headline Scramble Decoder Animation
  function initDecodeHeadline() {
    var h = document.querySelector(".hero-copy h1");
    if (!h) return;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    var GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&/<>*@$";
    var chars = [];

    function walk(node) {
      for (var i = 0; i < node.childNodes.length; i++) {
        var c = node.childNodes[i];
        if (c.nodeType === 3) {
          var t = c.nodeValue;
          if (!t) continue;
          var frag = document.createDocumentFragment();
          for (var j = 0; j < t.length; j++) {
            var ch = t[j];
            if (ch === " " || ch === "\n") {
              frag.appendChild(document.createTextNode(ch));
              continue;
            }
            var s = document.createElement("span");
            s.style.display = "inline-block";
            s.style.transition = "color 0.2s";
            s.textContent = ch;
            s.__final = ch;
            frag.appendChild(s);
            chars.push(s);
          }
          node.replaceChild(frag, c);
        } else if (c.nodeType === 1) {
          walk(c);
        }
      }
    }
    walk(h);

    if (!chars.length) return;
    var start = null, DUR = 380, STAGGER = 12;
    function rnd() { return GLYPHS[(Math.random() * GLYPHS.length) | 0]; }

    function tick(ts) {
      if (start === null) start = ts;
      var elapsed = ts - start;
      var done = true;
      for (var i = 0; i < chars.length; i++) {
        var c = chars[i];
        if (c.__locked) continue;
        var lt = i * STAGGER;
        if (elapsed >= lt + DUR) {
          c.textContent = c.__final;
          c.__locked = true;
          c.style.color = "";
        } else if (elapsed >= lt) {
          done = false;
          c.textContent = rnd();
          c.style.color = "rgba(0, 255, 136, 0.8)";
        } else {
          done = false;
        }
      }
      if (!done) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // Marquee Telemetry Ticker
  function initTelemetryTicker() {
    var host = document.querySelector("[data-ns-ticker]");
    if (!host) return;

    var CITIES = [
      ["Tokyo", "+35.6762", "+139.6503"],
      ["New York", "+40.7128", "-74.0060"],
      ["London", "+51.5074", "-0.1278"],
      ["Reykjavik", "+64.1466", "-21.9426"],
      ["Singapore", "+1.3521", "+103.8198"],
      ["Sao Paulo", "-23.5505", "-46.6333"],
      ["Sydney", "-33.8688", "+151.2093"],
      ["Lagos", "+6.5244", "+3.3792"],
      ["Mumbai", "+19.0760", "+72.8777"],
      ["Berlin", "+52.5200", "+13.4050"],
      ["Cairo", "+30.0444", "+31.2357"],
      ["Vancouver", "+49.2827", "-123.1207"]
    ];

    function buildItem(d) {
      var it = document.createElement("span");
      it.className = "ns-tk-item";
      it.innerHTML = 
        '<span class="ns-tk-live"><span class="ns-tk-dot"></span>LIVE</span>' +
        '<span class="ns-tk-city">' + d[0] + '</span>' +
        '<span style="color:var(--text-2);">' + d[1] + ', ' + d[2] + '</span>' +
        '<span style="opacity:0.25;margin:0 12px;">/</span>';
      return it;
    }

    var track = document.createElement("div");
    track.className = "ns-ticker-track";
    var frag = document.createDocumentFragment();
    CITIES.forEach(function (c) { frag.appendChild(buildItem(c)); });
    var clone = frag.cloneNode(true);
    track.appendChild(frag);
    track.appendChild(clone);

    host.className = "ns-ticker";
    host.appendChild(track);
  }

  // Magnetic Button Effect
  function initMagneticButtons() {
    var mq = window.matchMedia;
    var fine = mq && mq("(hover:hover) and (pointer:fine)").matches;
    if (!fine) return;

    var btns = document.querySelectorAll(".btn-primary");
    btns.forEach(function (btn) {
      var raf = 0, tx = 0, ty = 0, cx = 0, cy = 0;
      function frame() {
        raf = 0;
        cx += (tx - cx) * 0.2;
        cy += (ty - cy) * 0.2;
        btn.style.transform = "translate(" + cx.toFixed(2) + "px," + cy.toFixed(2) + "px)";
        if (Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1) raf = requestAnimationFrame(frame);
      }
      btn.addEventListener("mousemove", function (e) {
        var r = btn.getBoundingClientRect();
        var dx = e.clientX - (r.left + r.width / 2);
        var dy = e.clientY - (r.top + r.height / 2);
        tx = Math.max(-10, Math.min(10, dx * 0.3));
        ty = Math.max(-10, Math.min(10, dy * 0.3));
        if (!raf) raf = requestAnimationFrame(frame);
      });
      btn.addEventListener("mouseleave", function () {
        tx = 0; ty = 0;
        if (!raf) raf = requestAnimationFrame(frame);
      });
    });
  }

  // Subtle 3D Card Tilt with Specular Glare
  function init3DTilt() {
    var mq = window.matchMedia;
    var fine = mq && mq("(hover:hover) and (pointer:fine)").matches;
    if (!fine) return;

    var cards = document.querySelectorAll(".step, .stats-card, .cam-card");
    cards.forEach(function (card) {
      card.style.transformStyle = "preserve-3d";
      card.style.transition = "transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)";

      card.addEventListener("mousemove", function (e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width;
        var py = (e.clientY - r.top) / r.height;
        var rotX = -(py - 0.5) * 8;
        var rotY = (px - 0.5) * 8;
        card.style.transform = "perspective(800px) rotateX(" + rotX.toFixed(2) + "deg) rotateY(" + rotY.toFixed(2) + "deg) translateY(-2px)";
      });
      card.addEventListener("mouseleave", function () {
        card.style.transform = "perspective(800px) rotateX(0deg) rotateY(0deg) translateY(0)";
      });
    });
  }

  // Interactive Preview Tabs inside Sandbox Preview Section
  function initPreviewTabs() {
    var tabs = document.querySelectorAll(".preview-tab-btn");
    var screen = document.getElementById("previewScreenView");
    if (!tabs.length || !screen) return;

    tabs.forEach(function (btn) {
      btn.addEventListener("click", function () {
        tabs.forEach(function (t) { t.classList.remove("active"); });
        btn.classList.add("active");
        var mode = btn.getAttribute("data-mode");

        if (mode === "camera") {
          screen.innerHTML = 
            '<div class="cam-screen-view">' +
              '<canvas id="landingPreviewCanvas" class="cam-feed-canvas"></canvas>' +
              '<div class="cam-overlay-hud">' +
                '<span class="cam-rec-badge">REC // CAM-01</span>' +
                '<span style="color:#00ff88;">FPS: 60 &middot; 4K ULTRA &middot; YOLOv8x ACTIVE</span>' +
              '</div>' +
            '</div>';
          startLandingPreviewFeed();
        } else if (mode === "crypto") {
          screen.innerHTML = 
            '<div style="padding:40px;background:#06080b;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:var(--font-mono);">' +
              '<div style="font-size:18px;color:#00ff88;margin-bottom:12px;">CRYPTO FLOW TRACE // 0x28c6c062...</div>' +
              '<div style="color:var(--text-2);font-size:13px;max-width:560px;text-align:center;line-height:1.7;">' +
                'Interactive multi-chain fund flow visualization across 22+ public blockchains. Automatic exchange off-ramp and mixer detection.' +
              '</div>' +
              '<a href="panel.html#sector-crypto" class="btn btn-primary" style="margin-top:24px;">Launch Crypto Tracing Tool &rarr;</a>' +
            '</div>';
        } else if (mode === "osint") {
          screen.innerHTML = 
            '<div style="padding:40px;background:#06080b;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:var(--font-mono);">' +
              '<div style="font-size:18px;color:#00f0ff;margin-bottom:12px;">USERNAME OSINT // MULTI-PLATFORM SCAN</div>' +
              '<div style="color:var(--text-2);font-size:13px;max-width:560px;text-align:center;line-height:1.7;">' +
                'Scan social networks, developer hubs, and public records for any handle. 100% free with direct evidence links.' +
              '</div>' +
              '<a href="panel.html#sector-username" class="btn btn-primary" style="margin-top:24px;">Launch Username Scanner &rarr;</a>' +
            '</div>';
        }
      });
    });

    startLandingPreviewFeed();
  }

  var landingPreviewAnim = 0;
  function startLandingPreviewFeed() {
    var canvas = document.getElementById("landingPreviewCanvas");
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    cancelAnimationFrame(landingPreviewAnim);

    var w = (canvas.width = canvas.parentElement.clientWidth || 800);
    var h = (canvas.height = 480);

    var carX = 80;
    function loop(t) {
      ctx.fillStyle = "#090d14";
      ctx.fillRect(0, 0, w, h);

      // Distant bridge wires and skyline
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 1;
      for (var l = 0; l < 10; l++) {
        ctx.beginPath();
        ctx.moveTo(l * (w / 10), 0);
        ctx.lineTo(w / 2, 260);
        ctx.stroke();
      }

      // Water reflection
      var wg = ctx.createLinearGradient(0, 260, 0, h);
      wg.addColorStop(0, "#0e1724");
      wg.addColorStop(1, "#03060a");
      ctx.fillStyle = wg;
      ctx.fillRect(0, 260, w, h - 260);

      // Boat
      carX += 0.8;
      if (carX > w + 100) carX = -120;
      ctx.fillStyle = "#334155";
      ctx.fillRect(carX, 280, 110, 34);

      // YOLO Box on Boat
      ctx.strokeStyle = "#00ff88";
      ctx.lineWidth = 1.8;
      ctx.strokeRect(carX - 5, 275, 120, 44);
      ctx.fillStyle = "#00ff88";
      ctx.fillRect(carX - 5, 258, 80, 16);
      ctx.fillStyle = "#000";
      ctx.font = "bold 10px 'JetBrains Mono', monospace";
      ctx.fillText("vessel 98%", carX, 270);

      // Scanline effect
      ctx.fillStyle = "rgba(255, 255, 255, 0.015)";
      for (var s = 0; s < h; s += 4) {
        ctx.fillRect(0, s, w, 1);
      }

      landingPreviewAnim = requestAnimationFrame(loop);
    }
    landingPreviewAnim = requestAnimationFrame(loop);
  }

  // Scroll Progress and Nav Transition
  function initScrollFx() {
    var nav = document.querySelector(".nav");
    var bar = document.querySelector(".ns-progress");

    window.addEventListener("scroll", function () {
      var y = window.scrollY || document.documentElement.scrollTop;
      if (nav) nav.classList.toggle("is-scrolled", y > 15);
      var max = document.documentElement.scrollHeight - window.innerHeight;
      if (bar) bar.style.transform = "scaleX(" + (max > 0 ? y / max : 0) + ")";
    }, { passive: true });
  }

  // Mobile Menu Toggle
  function initMobileMenu() {
    var toggle = document.getElementById("navToggle");
    var menu = document.getElementById("mobileMenu");
    if (!toggle || !menu) return;

    toggle.addEventListener("click", function () {
      var isOpen = menu.classList.toggle("open");
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
    menu.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () { menu.classList.remove("open"); });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initDecodeHeadline();
    initTelemetryTicker();
    initMagneticButtons();
    init3DTilt();
    initPreviewTabs();
    initScrollFx();
    initMobileMenu();
  });
})();
