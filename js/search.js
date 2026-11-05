/* ==========================================================================
   YCH Live - Reverse Face Search frontend logic (search.html)
   Talks to the FastAPI backend: /api/health, /api/seed, /api/search.
   ========================================================================== */
(function () {
  "use strict";

  var DEFAULT_API = "http://127.0.0.1:8400";
  var apiBase = localStorage.getItem("fsApiBase") || DEFAULT_API;

  var $ = function (id) { return document.getElementById(id); };

  var els = {
    dot: $("fsStatusDot"), statusText: $("fsStatusText"),
    backend: $("fsBackend"), indexKind: $("fsIndexKind"), count: $("fsProfileCount"),
    apiEditBtn: $("fsApiEditBtn"), apiBase: $("fsApiBase"),
    apiPanel: $("fsApiPanel"), apiInput: $("fsApiInput"), apiSave: $("fsApiSave"),
    tabSearch: $("tabSearch"), tabSeed: $("tabSeed"),
    panelSearch: $("panelSearch"), panelSeed: $("panelSeed"),
    // search tab
    drop: $("fsDrop"), file: $("fsFile"), dropInner: $("fsDropInner"),
    preview: $("fsPreview"), previewImg: $("fsPreviewImg"), faceBox: $("fsFaceBox"),
    clear: $("fsClear"),
    limit: $("fsLimit"), limitVal: $("fsLimitVal"),
    thresh: $("fsThreshold"), threshVal: $("fsThreshVal"),
    searchBtn: $("fsSearchBtn"), searchLabel: $("fsSearchLabel"),
    searchError: $("fsSearchError"),
    results: $("fsResults"), resultsMsg: $("fsResultsMsg"),
    // seed tab
    sdDrop: $("sdDrop"), sdFile: $("sdFile"), sdDropInner: $("sdDropInner"),
    sdPreview: $("sdPreview"), sdPreviewImg: $("sdPreviewImg"), sdClear: $("sdClear"),
    sdForm: $("sdForm"), sdName: $("sdName"), sdHandle: $("sdHandle"), sdUrl: $("sdUrl"),
    sdSubmit: $("sdSubmit"), sdError: $("sdError"), sdSuccess: $("sdSuccess"),
    sdList: $("sdList"), sdRefresh: $("sdRefresh")
  };

  var queryFile = null;
  var seedFile = null;
  var busy = false;

  /* ---------------------------------------------------------------- utils */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function showError(el, msg) {
    if (!msg) { el.hidden = true; return; }
    el.textContent = msg;
    el.hidden = false;
  }

  function friendlyError(detail) {
    var map = {
      "NO_FACE_DETECTED": "No facial biometric markers found in image.",
      "UNREADABLE_IMAGE": "The uploaded file could not be read as an image.",
      "EMPTY_UPLOAD": "No image was uploaded."
    };
    return map[detail] || detail || "Backend request failed. Is the API server running?";
  }

  function postForm(path, fields) {
    var fd = new FormData();
    Object.keys(fields).forEach(function (k) { fd.append(k, fields[k]); });
    return fetch(apiBase + path, { method: "POST", body: fd }).then(function (resp) {
      return resp.json().then(function (body) {
        if (!resp.ok) {
          throw new Error(friendlyError(typeof body.detail === "string" ? body.detail : (body.detail && body.detail.message) || resp.statusText));
        }
        return body;
      });
    });
  }

  function getJson(path) {
    return fetch(apiBase + path).then(function (r) {
      if (!r.ok) throw new Error(r.statusText);
      return r.json();
    });
  }

  /* --------------------------------------------------------- status strip */
  function refreshHealth() {
    els.statusText.textContent = "Connecting\u2026";
    els.dot.className = "fs-status-dot";
    getJson("/api/health").then(function (h) {
      els.dot.className = "fs-status-dot online";
      els.statusText.textContent = "Engine online";
      els.backend.textContent = h.backend;
      els.indexKind.textContent = h.vector_index;
      els.count.textContent = h.indexed_profiles;
    }).catch(function () {
      els.dot.className = "fs-status-dot offline";
      els.statusText.textContent = "Backend unreachable \u2014 start it with: uvicorn main:app --port 8400 (in backend/)";
      els.backend.textContent = "\u2014";
      els.indexKind.textContent = "\u2014";
      els.count.textContent = "0";
    });
  }

  els.apiEditBtn.addEventListener("click", function () {
    els.apiPanel.hidden = !els.apiPanel.hidden;
    if (!els.apiPanel.hidden) els.apiInput.value = apiBase;
  });
  els.apiSave.addEventListener("click", function () {
    var v = els.apiInput.value.trim().replace(/\/+$/, "");
    if (!v) return;
    apiBase = v;
    localStorage.setItem("fsApiBase", apiBase);
    els.apiBase.textContent = apiBase;
    els.apiPanel.hidden = true;
    refreshHealth();
    loadSeedList();
  });

  /* -------------------------------------------------------------- tabs */
  function setTab(search) {
    els.tabSearch.classList.toggle("active", search);
    els.tabSeed.classList.toggle("active", !search);
    els.tabSearch.setAttribute("aria-selected", search);
    els.tabSeed.setAttribute("aria-selected", !search);
    els.panelSearch.hidden = !search;
    els.panelSeed.hidden = search;
    if (!search) loadSeedList();
  }
  els.tabSearch.addEventListener("click", function () { setTab(true); });
  els.tabSeed.addEventListener("click", function () { setTab(false); });

  /* ----------------------------------------------------- dropzone factory */
  function wireDropzone(dropEl, inputEl, onFile) {
    dropEl.addEventListener("click", function (e) {
      if (e.target.closest(".fs-clear")) return;
      inputEl.click();
    });
    dropEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputEl.click(); }
    });
    inputEl.addEventListener("change", function () {
      if (inputEl.files && inputEl.files[0]) onFile(inputEl.files[0]);
    });
    ["dragenter", "dragover"].forEach(function (ev) {
      dropEl.addEventListener(ev, function (e) { e.preventDefault(); dropEl.classList.add("dragover"); });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      dropEl.addEventListener(ev, function (e) { e.preventDefault(); dropEl.classList.remove("dragover"); });
    });
    dropEl.addEventListener("drop", function (e) {
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) onFile(f);
    });
  }

  function loadImagePreview(file, cb) {
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () { cb(url, img.naturalWidth, img.naturalHeight); };
    img.onerror = function () { URL.revokeObjectURL(url); };
    img.src = url;
  }

  /* --------------------------------------------------------- search flow */
  wireDropzone(els.drop, els.file, function (file) {
    if (!/image\/(jpeg|png)/.test(file.type) && !/\.(jpe?g|png)$/i.test(file.name)) {
      showError(els.searchError, "Only .jpg and .png images are supported.");
      return;
    }
    showError(els.searchError, "");
    queryFile = file;
    loadImagePreview(file, function (url) {
      els.previewImg.src = url;
      els.dropInner.hidden = true;
      els.preview.hidden = false;
      els.faceBox.hidden = true;
    });
    els.searchBtn.disabled = false;
  });

  els.clear.addEventListener("click", function (e) {
    e.stopPropagation();
    resetQuery();
  });

  function resetQuery() {
    queryFile = null;
    els.file.value = "";
    els.preview.hidden = true;
    els.dropInner.hidden = false;
    els.faceBox.hidden = true;
    els.searchBtn.disabled = true;
    els.resultsMsg.textContent = "Index a few profiles in Seed Mode, then upload a query face.";
  }

  function drawFaceBox(box, natW, natH) {
    // box = [top, right, bottom, left] in source pixels → % of natural size
    var imgW = els.previewImg.clientWidth, imgH = els.previewImg.clientHeight;
    if (!imgW || !imgH || !natW || !natH) return;
    // object-fit: contain scaling factor
    var s = Math.min(imgW / natW, imgH / natH);
    var offX = (imgW - natW * s) / 2, offY = (imgH - natH * s) / 2;
    var top = box[0], right = box[1], bottom = box[2], left = box[3];
    els.faceBox.style.left = (offX + left * s) + "px";
    els.faceBox.style.top = (offY + top * s) + "px";
    els.faceBox.style.width = Math.max(0, (right - left) * s) + "px";
    els.faceBox.style.height = Math.max(0, (bottom - top) * s) + "px";
    els.faceBox.hidden = false;
  }

  els.limit.addEventListener("input", function () { els.limitVal.textContent = els.limit.value; });
  els.thresh.addEventListener("input", function () { els.threshVal.textContent = Number(els.thresh.value).toFixed(2); });

  function scoreCard(m) {
    var pct = Math.round(m.score * 100);
    var mid = m.score < 0.85;
    var thumb = m.thumbnail
      ? '<img class="match-thumb" src="data:image/jpeg;base64,' + esc(m.thumbnail) + '" alt="Matched profile thumbnail" />'
      : '<div class="match-thumb-ph"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg></div>';
    var links = "";
    if (m.social_handle) links += '<span class="mm-handle">' + esc(m.social_handle) + "</span>";
    if (m.profile_url) {
      var u = /^https?:\/\//i.test(m.profile_url) ? m.profile_url : "https://" + m.profile_url;
      links += '<a href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">' + esc(m.profile_url) + "</a>";
    }
    links += '<span class="mm-id">ID ' + esc(m.matched_image_id).slice(0, 8) + "</span>";
    return '<div class="match-card">' + thumb +
      '<div class="match-main">' +
      '<div class="match-top"><span class="match-name">' + esc(m.name) + "</span>" +
      '<span class="match-score' + (mid ? " mid" : "") + '">' + pct + "% match</span></div>" +
      '<div class="score-bar"><i class="' + (mid ? "mid" : "") + '" style="width:' + pct + '%"></i></div>' +
      '<div class="match-meta">' + links + "</div>" +
      "</div></div>";
  }

  els.searchBtn.addEventListener("click", function () {
    if (!queryFile || busy) return;
    busy = true;
    showError(els.searchError, "");
    els.searchBtn.disabled = true;
    els.searchLabel.innerHTML = '<span class="fs-spin"></span> Extracting vector\u2026';
    els.resultsMsg.textContent = "Querying index\u2026";

    var natW = els.previewImg.naturalWidth, natH = els.previewImg.naturalHeight;

    postForm("/api/search", {
      file: queryFile,
      limit: els.limit.value,
      threshold: els.thresh.value
    }).then(function (res) {
      drawFaceBox(res.face_box, natW, natH);
      els.resultsMsg.textContent = res.message;
      if (!res.results.length) {
        els.results.innerHTML = '<div class="fs-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M8.5 15.5l7-7"/><path d="M15.5 15.5l-7-7"/></svg><p>' + esc(res.message) + "</p></div>";
      } else {
        els.results.innerHTML = res.results.map(scoreCard).join("");
      }
    }).catch(function (err) {
      showError(els.searchError, err.message);
      els.resultsMsg.textContent = "Search not completed.";
    }).finally(function () {
      busy = false;
      els.searchBtn.disabled = false;
      els.searchLabel.textContent = "Run Face Search";
    });
  });

  /* ----------------------------------------------------------- seed flow */
  wireDropzone(els.sdDrop, els.sdFile, function (file) {
    showError(els.sdError, "");
    hide(els.sdSuccess);
    seedFile = file;
    loadImagePreview(file, function (url) {
      els.sdPreviewImg.src = url;
      els.sdDropInner.hidden = true;
      els.sdPreview.hidden = false;
    });
  });

  function hide(el) { el.hidden = true; }

  els.sdClear.addEventListener("click", function (e) {
    e.stopPropagation();
    seedFile = null;
    els.sdFile.value = "";
    els.sdPreview.hidden = true;
    els.sdDropInner.hidden = false;
  });

  els.sdForm.addEventListener("submit", function (e) {
    e.preventDefault();
    if (busy) return;
    if (!seedFile) { showError(els.sdError, "Attach a portrait image first."); return; }
    showError(els.sdError, "");
    hide(els.sdSuccess);
    busy = true;
    els.sdSubmit.disabled = true;
    els.sdSubmit.innerHTML = '<span class="fs-spin"></span> Indexing\u2026';

    postForm("/api/seed", {
      file: seedFile,
      name: els.sdName.value.trim(),
      social_handle: els.sdHandle.value.trim(),
      profile_url: els.sdUrl.value.trim()
    }).then(function (res) {
      els.sdSuccess.textContent = res.message + " vector_id: " + res.vector_id;
      els.sdSuccess.hidden = false;
      els.sdForm.reset();
      seedFile = null;
      els.sdFile.value = "";
      els.sdPreview.hidden = true;
      els.sdDropInner.hidden = false;
      refreshHealth();
      loadSeedList();
    }).catch(function (err) {
      showError(els.sdError, err.message);
    }).finally(function () {
      busy = false;
      els.sdSubmit.disabled = false;
      els.sdSubmit.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg> Index This Face';
    });
  });

  function loadSeedList() {
    getJson("/api/profiles").then(function (data) {
      var ps = data.profiles || [];
      els.count.textContent = ps.length;
      if (!ps.length) {
        els.sdList.innerHTML = '<div class="fs-empty"><p>Index is empty.</p></div>';
        return;
      }
      els.sdList.innerHTML = ps.map(function (p) {
        var sub = [p.social_handle, p.profile_url].filter(Boolean).join(" \u00b7 ") || "no links";
        return '<div class="sd-row">' +
          '<div class="match-thumb-ph"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg></div>' +
          '<div class="sd-info"><div class="sd-name">' + esc(p.name) + "</div>" +
          '<div class="sd-sub">' + esc(sub) + "</div></div>" +
          '<span class="mm-id">' + esc(p.vector_id).slice(0, 8) + "</span>" +
          "</div>";
      }).join("");
    }).catch(function () {
      els.sdList.innerHTML = '<div class="fs-empty"><p>Backend unreachable.</p></div>';
    });
  }

  els.sdRefresh.addEventListener("click", function () { refreshHealth(); loadSeedList(); });

  /* ------------------------------------------------------------- boot */
  els.apiBase.textContent = apiBase;
  resetQuery();
  refreshHealth();
  window.setInterval(refreshHealth, 30000);
})();
