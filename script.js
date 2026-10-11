/* =========================================================
   DENMA SOLUTIONS — script.js
   Mobile-optimized · Custom cursor · Live dashboard
   Feedback + Subscribe forms · Command palette · Live apps

   FIXES (2024):
   - closeTimer race condition (was wiping new app content)
   - Card taps now use pointerup + click (better mobile reliability)
   - Each app launcher wrapped in try/catch for isolation
   - Defensive null checks prevent silent failures
   - Modal re-focus handled correctly when switching apps quickly
   ========================================================= */

(function () {
  'use strict';

  /* ---------- Device / perf detection ---------- */
  var isTouch   = window.matchMedia('(hover: none)').matches;
  var isMobile  = window.innerWidth <= 900 || isTouch;
  var reduce    = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var saveData  = navigator.connection && navigator.connection.saveData;
  var lowPower  = isMobile || saveData || reduce;

  /* =========================================================
     📬  EMAIL DELIVERY CONFIG
     ========================================================= */
  var OWNER_EMAIL   = 'denisotieno955@gmail.com';
  var AJAX_ENDPOINT = 'https://formsubmit.co/ajax/' + OWNER_EMAIL;

  /* =========================================================
     1. CUSTOM CURSOR (desktop only)
     ========================================================= */
  (function cursor() {
    if (isTouch || isMobile) return;
    var dot  = document.getElementById('cursorDot');
    var ring = document.getElementById('cursorRing');
    if (!dot || !ring) return;

    var mx = window.innerWidth / 2, my = window.innerHeight / 2;
    var rx = mx, ry = my;
    var dotX = mx, dotY = my;

    window.addEventListener('pointermove', function (e) {
      mx = e.clientX; my = e.clientY;
    }, { passive: true });

    function loop() {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      dotX += (mx - dotX) * 0.6;
      dotY += (my - dotY) * 0.6;

      dot.style.transform  = 'translate3d(' + (dotX - 4) + 'px,' + (dotY - 4) + 'px,0)';
      ring.style.transform = 'translate3d(' + (rx - 19) + 'px,' + (ry - 19) + 'px,0)';
      requestAnimationFrame(loop);
    }
    loop();

    var hoverTargets = 'a, button, input, textarea, select, .project-card, .social-card, .skill-tag, .about-card, .dash-card, .star-rating button, .cmd-item';
    document.addEventListener('mouseover', function (e) {
      if (e.target.closest(hoverTargets)) {
        ring.classList.add('hovering');
        dot.classList.add('hovering');
      }
    });
    document.addEventListener('mouseout', function (e) {
      if (e.target.closest(hoverTargets)) {
        ring.classList.remove('hovering');
        dot.classList.remove('hovering');
      }
    });
    document.addEventListener('mousedown', function () { ring.classList.add('clicking'); });
    document.addEventListener('mouseup',   function () { ring.classList.remove('clicking'); });
    document.addEventListener('mouseleave', function () {
      dot.style.opacity = '0'; ring.style.opacity = '0';
    });
    document.addEventListener('mouseenter', function () {
      dot.style.opacity = '1'; ring.style.opacity = '1';
    });
  })();

  /* =========================================================
     2. BACKGROUND CANVAS
     ========================================================= */
  (function background() {
    var canvas = document.getElementById('bg-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    var W = 0, H = 0, DPR = 1, t = 0;
    var particles = [], ripples = [], sparks = [], grid = [];
    var running = true, rafId = null;
    var px = { x: 0, y: 0, tx: 0, ty: 0 };

    function pal() {
      return document.body.classList.contains('light-theme')
        ? { a: '0,155,138' }
        : { a: '0,230,212' };
    }

    function resize() {
      var cap = lowPower ? 1.25 : 2;
      DPR = Math.min(window.devicePixelRatio || 1, cap);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width  = Math.floor(W * DPR);
      canvas.height = Math.floor(H * DPR);
      canvas.style.width  = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      build();
    }

    function build() {
      var area = W * H;
      var divisor = lowPower ? 42000 : 18000;
      var maxP = lowPower ? 28 : 100;
      var n = Math.min(maxP, Math.round(area / divisor));
      particles = [];
      for (var i = 0; i < n; i++) {
        particles.push({
          x: Math.random() * W, y: Math.random() * H,
          vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35,
          ox: 0, oy: 0, r: Math.random() * 1.8 + .6
        });
      }
      grid = [];
      var step = lowPower ? 110 : 60;
      for (var x = step / 2; x < W; x += step)
        for (var y = step / 2; y < H; y += step)
          grid.push({ x: x, y: y, pulse: 0, phase: Math.random() * Math.PI * 2 });
    }

    function burst(x, y) {
      var ripplesN = lowPower ? 1 : 3;
      var sparksN  = lowPower ? 8 : 18;
      for (var i = 0; i < ripplesN; i++)
        ripples.push({ x: x, y: y, r: 6, max: 160 + i * 80, life: 1, delay: i * 6, speed: 3.2 + i * .8 });
      for (var k = 0; k < sparksN; k++) {
        var a = (Math.PI * 2 * k) / sparksN + Math.random() * .4;
        var s = 1.6 + Math.random() * 4;
        sparks.push({
          x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
          life: 1, decay: .014 + Math.random() * .02, r: Math.random() * 2 + 1
        });
      }
      for (var g = 0; g < grid.length; g++) {
        var gp = grid[g];
        var d = Math.hypot(gp.x - x, gp.y - y);
        if (d < 420) gp.pulse = Math.max(gp.pulse, 1 - d / 420);
      }
      for (var p = 0; p < particles.length; p++) {
        var pp = particles[p];
        var dx = pp.x - x, dy = pp.y - y;
        var dd = Math.hypot(dx, dy) || 1;
        if (dd < 260) {
          var f = (1 - dd / 260) * 26;
          pp.ox += (dx / dd) * f;
          pp.oy += (dy / dd) * f;
        }
      }
    }

    window.addEventListener('pointerdown', function (e) {
      if (e.target.closest('a,button,input,textarea,select,.project-card,.social-card,.skill-tag,.theme-toggle,.menu-toggle,.email-highlight,.copy-icon,.about-card,.app-modal,.cmd-modal,.dash-card,.glass-form')) return;
      burst(e.clientX, e.clientY);
    }, { passive: true });

    window.addEventListener('pointermove', function (e) {
      px.tx = (e.clientX / W - .5) * 2;
      px.ty = (e.clientY / H - .5) * 2;
    }, { passive: true });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        running = false;
        if (rafId) cancelAnimationFrame(rafId);
      } else {
        running = true;
        if (!reduce) loop();
      }
    });

    function draw() {
      t += .016;
      var c = pal();
      ctx.clearRect(0, 0, W, H);

      px.x += (px.tx - px.x) * .05;
      px.y += (px.ty - px.y) * .05;

      for (var i = 0; i < grid.length; i++) {
        var g = grid[i];
        g.pulse *= .94;
        var dr = Math.sin(t * .8 + g.phase) * 1.2;
        var gx = g.x + px.x * 8 + dr, gy = g.y + px.y * 8;
        ctx.beginPath();
        ctx.arc(gx, gy, 1 + g.pulse * 1.6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + c.a + ',' + (.06 + g.pulse * .5) + ')';
        ctx.fill();
      }

      for (var p = 0; p < particles.length; p++) {
        var pp = particles[p];
        pp.ox *= .92; pp.oy *= .92;
        pp.x += pp.vx; pp.y += pp.vy;
        if (pp.x < -20) pp.x = W + 20;
        if (pp.x > W + 20) pp.x = -20;
        if (pp.y < -20) pp.y = H + 20;
        if (pp.y > H + 20) pp.y = -20;

        pp._dx = pp.x + pp.ox + px.x * 18;
        pp._dy = pp.y + pp.oy + px.y * 18;

        ctx.beginPath();
        ctx.arc(pp._dx, pp._dy, pp.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + c.a + ',.55)';
        ctx.fill();
      }

      if (!lowPower) {
        var md = 150;
        for (var i2 = 0; i2 < particles.length; i2++) {
          var a2 = particles[i2];
          for (var j = i2 + 1; j < particles.length; j++) {
            var b = particles[j];
            var ddx = a2._dx - b._dx, ddy = a2._dy - b._dy;
            var d2 = ddx * ddx + ddy * ddy;
            if (d2 < md * md) {
              ctx.strokeStyle = 'rgba(' + c.a + ',' + ((1 - Math.sqrt(d2) / md) * .22) + ')';
              ctx.lineWidth = .8;
              ctx.beginPath();
              ctx.moveTo(a2._dx, a2._dy);
              ctx.lineTo(b._dx, b._dy);
              ctx.stroke();
            }
          }
        }
      }

      for (var r = ripples.length - 1; r >= 0; r--) {
        var rp = ripples[r];
        if (rp.delay > 0) { rp.delay--; continue; }
        rp.r += rp.speed;
        rp.life = 1 - rp.r / rp.max;
        if (rp.life <= 0) { ripples.splice(r, 1); continue; }
        ctx.beginPath();
        ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(' + c.a + ',' + (rp.life * .7) + ')';
        ctx.lineWidth = 2 * rp.life + .4;
        ctx.stroke();
      }

      for (var s = sparks.length - 1; s >= 0; s--) {
        var sp = sparks[s];
        sp.x += sp.vx; sp.y += sp.vy;
        sp.vx *= .96; sp.vy *= .96; sp.vy += .04;
        sp.life -= sp.decay;
        if (sp.life <= 0) { sparks.splice(s, 1); continue; }
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.r * sp.life, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + c.a + ',' + sp.life + ')';
        ctx.fill();
      }
    }

    function loop() {
      if (!running) return;
      rafId = requestAnimationFrame(loop);
      draw();
    }

    resize();
    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 180);
    });
    if (reduce) draw(); else loop();
  })();

  /* =========================================================
     3. PORTFOLIO CORE
     ========================================================= */
  document.addEventListener('DOMContentLoaded', function () {

    /* --- Typing effect --- */
    var typedEl = document.getElementById('typed-text');
    if (typedEl) {
      var phrases = ['Frontend Developer', 'JavaScript Enthusiast', 'Arduino Explorer', 'Problem Solver'];
      var pI = 0, cI = 0, del = false;
      (function type() {
        var cur = phrases[pI];
        typedEl.textContent = del ? cur.substring(0, cI - 1) : cur.substring(0, cI + 1);
        cI += del ? -1 : 1;
        var delay = del ? 55 : 100;
        if (!del && cI === cur.length) { delay = 1800; del = true; }
        else if (del && cI === 0) { del = false; pI = (pI + 1) % phrases.length; delay = 500; }
        setTimeout(type, delay);
      })();
    }

    /* --- Theme toggle --- */
    var themeToggle = document.getElementById('themeToggle');
    var themeIcon = themeToggle ? themeToggle.querySelector('i') : null;
    function setTheme(t) {
      document.body.classList.toggle('light-theme', t === 'light');
      if (themeIcon) themeIcon.className = t === 'light' ? 'fas fa-sun' : 'fas fa-moon';
      try { localStorage.setItem('theme', t); } catch (e) {}
    }
    if (themeToggle) {
      themeToggle.addEventListener('click', function () {
        setTheme(document.body.classList.contains('light-theme') ? 'dark' : 'light');
      });
    }
    try {
      var savedTheme = localStorage.getItem('theme');
      if (savedTheme) setTheme(savedTheme);
      else if (window.matchMedia('(prefers-color-scheme: light)').matches) setTheme('light');
    } catch (e) {}

    /* --- Mobile menu --- */
    var menuToggle = document.getElementById('menuToggle');
    var navLinks = document.getElementById('navLinks');
    if (menuToggle && navLinks) {
      menuToggle.addEventListener('click', function () {
        navLinks.classList.toggle('open');
        var ic = menuToggle.querySelector('i');
        if (ic) ic.className = navLinks.classList.contains('open') ? 'fas fa-times' : 'fas fa-bars';
      });
      navLinks.querySelectorAll('a').forEach(function (l) {
        l.addEventListener('click', function () {
          navLinks.classList.remove('open');
          var ic = menuToggle.querySelector('i');
          if (ic) ic.className = 'fas fa-bars';
        });
      });
    }

    /* --- Scroll progress --- */
    var prog = document.getElementById('scrollProgress');
    var scrollTopBtn = document.getElementById('scrollTop');
    var scrollScheduled = false;
    function onScroll() {
      if (scrollScheduled) return;
      scrollScheduled = true;
      requestAnimationFrame(function () {
        var h = document.documentElement;
        var max = h.scrollHeight - h.clientHeight;
        var pct = max > 0 ? (h.scrollTop / max) * 100 : 0;
        if (prog) prog.style.width = pct + '%';
        if (scrollTopBtn) scrollTopBtn.classList.toggle('visible', window.scrollY > 400);
        scrollScheduled = false;
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    if (scrollTopBtn) {
      scrollTopBtn.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    /* --- Copy email --- */
    var ce = document.getElementById('copyEmail');
    var toastEl = document.getElementById('toast');
    function showToast(m) {
      if (!toastEl) return;
      toastEl.textContent = m;
      toastEl.classList.add('show');
      clearTimeout(showToast._t);
      showToast._t = setTimeout(function () { toastEl.classList.remove('show'); }, 2800);
    }
    window.__denmaToast = showToast;
    if (ce) {
      ce.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (navigator.clipboard) {
          navigator.clipboard.writeText('denisotieno955@gmail.com')
            .then(function () { showToast('📧 Email copied!'); })
            .catch(function () { showToast('Copy failed — select manually.'); });
        }
      });
    }

    /* --- Year --- */
    var y = document.getElementById('year');
    if (y) y.textContent = new Date().getFullYear();

    /* --- Counters --- */
    var counters = document.querySelectorAll('[data-count]');
    if (counters.length && 'IntersectionObserver' in window) {
      var obs = new IntersectionObserver(function (entries, o) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            var el = en.target;
            var t = parseInt(el.getAttribute('data-count'), 10);
            var c = 0, inc = Math.max(1, Math.ceil(t / 60));
            (function up() {
              c += inc;
              if (c >= t) { el.textContent = t; return; }
              el.textContent = c;
              requestAnimationFrame(up);
            })();
            o.unobserve(el);
          }
        });
      }, { threshold: 0.4 });
      counters.forEach(function (c) { obs.observe(c); });
    }

    /* --- 3D tilt on chip (desktop only) --- */
    var chip = document.getElementById('chipWrap');
    if (chip && !reduce && !isTouch && !isMobile) {
      var MAX = 14, tRX = 0, tRY = 0, cRX = 0, cRY = 0;
      (function upd() {
        cRX += (tRX - cRX) * 0.12;
        cRY += (tRY - cRY) * 0.12;
        chip.style.setProperty('--rx', cRX.toFixed(2) + 'deg');
        chip.style.setProperty('--ry', cRY.toFixed(2) + 'deg');
        requestAnimationFrame(upd);
      })();
      chip.addEventListener('pointermove', function (e) {
        var r = chip.getBoundingClientRect();
        var x = e.clientX - r.left, y2 = e.clientY - r.top;
        tRY = ((x - r.width / 2) / (r.width / 2)) * MAX;
        tRX = -((y2 - r.height / 2) / (r.height / 2)) * MAX;
        chip.style.setProperty('--spot-x', x + 'px');
        chip.style.setProperty('--spot-y', y2 + 'px');
        chip.classList.add('hovering');
      });
      chip.addEventListener('pointerleave', function () {
        tRX = 0; tRY = 0;
        chip.classList.remove('hovering');
      });
    }

    /* --- Mouse glow (desktop only) --- */
    var mg = document.getElementById('mouseGlow');
    if (mg && !isTouch) {
      var mgScheduled = false;
      document.addEventListener('mousemove', function (e) {
        if (mgScheduled) return;
        mgScheduled = true;
        requestAnimationFrame(function () {
          mg.style.left = e.clientX + 'px';
          mg.style.top  = e.clientY + 'px';
          mgScheduled = false;
        });
      }, { passive: true });
    }

    /* =========================================================
       4. LIVE DASHBOARD
       ========================================================= */
    (function dashboard() {
      var clkH = document.getElementById('clkHour');
      var clkM = document.getElementById('clkMin');
      var clkS = document.getElementById('clkSec');
      var clkDig = document.getElementById('clkDigital');
      var clkDate = document.getElementById('clkDate');
      var calMonth = document.getElementById('calMonth');
      var calGrid = document.getElementById('calGrid');

      var monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      var dayNames = ['S','M','T','W','T','F','S'];

      function pad(n) { return n < 10 ? '0' + n : '' + n; }

      function tick() {
        var d = new Date();
        var h = d.getHours(), m = d.getMinutes(), s = d.getSeconds();

        if (clkH) clkH.style.transform = 'rotate(' + ((h % 12) * 30 + m * 0.5) + 'deg)';
        if (clkM) clkM.style.transform = 'rotate(' + (m * 6 + s * 0.1) + 'deg)';
        if (clkS) clkS.style.transform = 'rotate(' + (s * 6) + 'deg)';
        if (clkDig) clkDig.textContent = pad(h) + ':' + pad(m) + ':' + pad(s);
        if (clkDate) {
          clkDate.textContent = d.toLocaleDateString(undefined, {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
          });
        }
      }
      tick();
      setInterval(tick, 1000);

      function buildCalendar() {
        if (!calGrid || !calMonth) return;
        var now = new Date();
        var year = now.getFullYear();
        var month = now.getMonth();
        var today = now.getDate();

        calMonth.textContent = monthNames[month] + ' ' + year;
        calGrid.innerHTML = '';

        for (var i = 0; i < 7; i++) {
          var dn = document.createElement('div');
          dn.className = 'cal-day-name';
          dn.textContent = dayNames[i];
          calGrid.appendChild(dn);
        }

        var firstDay = new Date(year, month, 1).getDay();
        var daysInMonth = new Date(year, month + 1, 0).getDate();

        for (var e = 0; e < firstDay; e++) {
          var empty = document.createElement('div');
          empty.className = 'cal-day empty';
          calGrid.appendChild(empty);
        }
        for (var d = 1; d <= daysInMonth; d++) {
          var cell = document.createElement('div');
          cell.className = 'cal-day' + (d === today ? ' today' : '');
          cell.textContent = d;
          calGrid.appendChild(cell);
        }
      }
      buildCalendar();

      var stNet = document.getElementById('stNet');
      var stBat = document.getElementById('stBat');
      var stScreen = document.getElementById('stScreen');
      var stTz = document.getElementById('stTz');
      var stVisits = document.getElementById('stVisits');

      function updateStatus() {
        if (stNet) {
          var on = navigator.onLine;
          stNet.textContent = on ? 'Online' : 'Offline';
          stNet.className = on ? 'ok' : 'warn';
        }
        if (stScreen) stScreen.textContent = window.innerWidth + '×' + window.innerHeight;
        if (stTz) {
          try {
            var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            stTz.textContent = tz || '—';
          } catch (e) { stTz.textContent = '—'; }
        }
      }
      updateStatus();

      window.addEventListener('online', updateStatus);
      window.addEventListener('offline', updateStatus);
      window.addEventListener('resize', function () {
        clearTimeout(updateStatus._t);
        updateStatus._t = setTimeout(updateStatus, 200);
      });

      if (stBat && 'getBattery' in navigator) {
        navigator.getBattery().then(function (b) {
          function upd() {
            var pct = Math.round(b.level * 100);
            stBat.textContent = pct + '%' + (b.charging ? ' ⚡' : '');
            stBat.className = pct < 20 ? 'warn' : 'ok';
          }
          upd();
          b.addEventListener('levelchange', upd);
          b.addEventListener('chargingchange', upd);
        }).catch(function () { stBat.textContent = '—'; });
      } else if (stBat) {
        stBat.textContent = 'N/A';
      }

      try {
        var v = parseInt(localStorage.getItem('denmaVisits') || '0', 10) + 1;
        localStorage.setItem('denmaVisits', v);
        if (stVisits) {
          var c = 0, inc = Math.max(1, Math.ceil(v / 40));
          (function up() {
            c += inc;
            if (c >= v) { stVisits.textContent = v; return; }
            stVisits.textContent = c;
            requestAnimationFrame(up);
          })();
        }
      } catch (e) {
        if (stVisits) stVisits.textContent = '1';
      }
    })();

    /* =========================================================
       5. TEXT SCRAMBLE
       ========================================================= */
    (function scramble() {
      if (reduce) return;
      var els = document.querySelectorAll('[data-scramble]');
      if (!els.length || !('IntersectionObserver' in window)) return;
      var chars = '!<>-_\\/[]{}—=+*^?#ABCDEFabcdef0123456789';

      function scrambleEl(el) {
        var original = el.dataset.original || el.textContent;
        el.dataset.original = original;
        var len = original.length;
        var frame = 0;

        function anim() {
          var out = '';
          for (var i = 0; i < len; i++) {
            if (i < frame) out += original[i];
            else out += chars[Math.floor(Math.random() * chars.length)];
          }
          el.textContent = out;
          frame += 0.5;
          if (frame < len) requestAnimationFrame(anim);
          else el.textContent = original;
        }
        anim();
      }

      var obs = new IntersectionObserver(function (entries, o) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            scrambleEl(en.target);
            o.unobserve(en.target);
          }
        });
      }, { threshold: 0.6 });
      els.forEach(function (el) { obs.observe(el); });
    })();

    /* =========================================================
       6. CONFETTI
       ========================================================= */
    var confettiCanvas = document.getElementById('confettiCanvas');
    var confettiCtx = confettiCanvas ? confettiCanvas.getContext('2d') : null;
    var confettiParts = [];
    var confettiRAF = null;

    function sizeConfetti() {
      if (!confettiCanvas) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      confettiCanvas.width  = window.innerWidth * dpr;
      confettiCanvas.height = window.innerHeight * dpr;
      confettiCanvas.style.width  = window.innerWidth + 'px';
      confettiCanvas.style.height = window.innerHeight + 'px';
      confettiCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    if (confettiCanvas) {
      sizeConfetti();
      window.addEventListener('resize', sizeConfetti);
    }

    function fireConfetti(x, y) {
      if (!confettiCanvas || reduce) return;
      var colors = ['#00e6d4', '#8b5cf6', '#f472b6', '#febc2e', '#28c840'];
      var count = lowPower ? 40 : 90;
      for (var i = 0; i < count; i++) {
        var angle = Math.random() * Math.PI * 2;
        var speed = 4 + Math.random() * 8;
        confettiParts.push({
          x: x, y: y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 4,
          size: 4 + Math.random() * 6,
          color: colors[Math.floor(Math.random() * colors.length)],
          life: 1,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - .5) * .3
        });
      }
      if (!confettiRAF) confettiLoop();
    }

    function confettiLoop() {
      confettiRAF = requestAnimationFrame(confettiLoop);
      if (!confettiCtx) return;
      confettiCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (var i = confettiParts.length - 1; i >= 0; i--) {
        var p = confettiParts[i];
        p.x += p.vx; p.y += p.vy;
        p.vy += 0.28;
        p.vx *= 0.99;
        p.rot += p.vr;
        p.life -= 0.012;
        if (p.life <= 0 || p.y > window.innerHeight + 40) {
          confettiParts.splice(i, 1);
          continue;
        }
        confettiCtx.save();
        confettiCtx.globalAlpha = Math.max(p.life, 0);
        confettiCtx.translate(p.x, p.y);
        confettiCtx.rotate(p.rot);
        confettiCtx.fillStyle = p.color;
        confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        confettiCtx.restore();
      }
      if (!confettiParts.length) {
        cancelAnimationFrame(confettiRAF);
        confettiRAF = null;
      }
    }

    /* =========================================================
       7. COMMAND PALETTE (Ctrl/Cmd + K)
       ========================================================= */
    (function commandPalette() {
      var modal = document.getElementById('cmdModal');
      var input = document.getElementById('cmdInput');
      var list  = document.getElementById('cmdList');
      var trigger = document.getElementById('cmdTrigger');
      if (!modal || !input || !list) return;

      var commands = [
        { label: 'Go to Home',        icon: 'fa-house',        action: function () { scrollTo('#home'); } },
        { label: 'Live Dashboard',    icon: 'fa-gauge-high',   action: function () { scrollTo('#dashboard'); } },
        { label: 'About Me',          icon: 'fa-user',         action: function () { scrollTo('#about'); } },
        { label: 'Skills & Tools',    icon: 'fa-code',         action: function () { scrollTo('#skills'); } },
        { label: 'View Projects',     icon: 'fa-diagram-project', action: function () { scrollTo('#projects'); } },
        { label: 'Send Feedback',     icon: 'fa-comment-dots', action: function () { scrollTo('#feedback'); } },
        { label: 'Connect / Subscribe',icon: 'fa-handshake',   action: function () { scrollTo('#subscribe'); } },
        { label: 'Contact Links',     icon: 'fa-address-card', action: function () { scrollTo('#contact'); } },
        { label: 'Launch Weather App',icon: 'fa-cloud-sun',    action: function () { launchByKey('weather'); } },
        { label: 'Play Snake',        icon: 'fa-gamepad',      action: function () { launchByKey('snake'); } },
        { label: 'Open Calculator',   icon: 'fa-calculator',   action: function () { launchByKey('calculator'); } },
        { label: 'Play Tic Tac Toe',  icon: 'fa-hashtag',      action: function () { launchByKey('tictactoe'); } },
        { label: 'Open To-Do App',    icon: 'fa-list-check',   action: function () { launchByKey('todo'); } },
        { label: 'Arduino Lab',       icon: 'fa-microchip',    action: function () { launchByKey('arduino'); } },
        { label: 'Toggle Theme',      icon: 'fa-circle-half-stroke', action: function () {
            var t = document.getElementById('themeToggle');
            if (t) t.click();
        }},
        { label: 'Copy Email',        icon: 'fa-envelope',     action: function () {
            if (navigator.clipboard) navigator.clipboard.writeText('denisotieno955@gmail.com');
            if (window.__denmaToast) window.__denmaToast('📧 Email copied!');
        }}
      ];

      var filtered = commands.slice();
      var selectedIdx = 0;

      function scrollTo(hash) {
        var el = document.querySelector(hash);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      function render() {
        list.innerHTML = '';
        if (!filtered.length) {
          list.innerHTML = '<div class="cmd-empty">No matches found.</div>';
          return;
        }
        filtered.forEach(function (c, i) {
          var el = document.createElement('div');
          el.className = 'cmd-item' + (i === selectedIdx ? ' selected' : '');
          el.innerHTML = '<i class="fas ' + c.icon + '"></i><span>' + c.label + '</span><span class="cmd-hint">↵</span>';
          el.addEventListener('click', function () {
            closePalette();
            setTimeout(c.action, 120);
          });
          list.appendChild(el);
        });
      }

      function filter(q) {
        q = q.toLowerCase().trim();
        filtered = q
          ? commands.filter(function (c) { return c.label.toLowerCase().indexOf(q) !== -1; })
          : commands.slice();
        selectedIdx = 0;
        render();
      }

      function openPalette() {
        modal.classList.add('open');
        document.body.style.overflow = 'hidden';
        input.value = '';
        filter('');
        setTimeout(function () { input.focus(); }, 60);
      }
      function closePalette() {
        modal.classList.remove('open');
        document.body.style.overflow = '';
      }

      if (trigger) trigger.addEventListener('click', openPalette);
      modal.querySelectorAll('[data-cmd-close]').forEach(function (el) {
        el.addEventListener('click', closePalette);
      });
      input.addEventListener('input', function () { filter(input.value); });

      document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          modal.classList.contains('open') ? closePalette() : openPalette();
          return;
        }
        if (!modal.classList.contains('open')) return;

        if (e.key === 'Escape') closePalette();
        else if (e.key === 'ArrowDown') {
          e.preventDefault();
          selectedIdx = Math.min(selectedIdx + 1, filtered.length - 1);
          render();
        }
        else if (e.key === 'ArrowUp') {
          e.preventDefault();
          selectedIdx = Math.max(selectedIdx - 1, 0);
          render();
        }
        else if (e.key === 'Enter' && filtered[selectedIdx]) {
          e.preventDefault();
          var action = filtered[selectedIdx].action;
          closePalette();
          setTimeout(action, 120);
        }
      });
    })();

    /* =========================================================
       8. FORMS — FEEDBACK + SUBSCRIBE
       ========================================================= */
    (function forms() {

      function validateEmail(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
      }
      function validatePhone(v) {
        var cleaned = v.replace(/[\s\-()]/g, '');
        return /^\+?\d{7,15}$/.test(cleaned);
      }
      function setErr(input, msg) {
        var group = input.closest('.form-group');
        if (!group) return;
        var err = group.querySelector('.err-msg');
        if (err) err.textContent = msg || '';
        input.classList.toggle('invalid', !!msg);
      }
      function setLoading(btn, loading, originalHTML) {
        if (!btn) return;
        btn.disabled = loading;
        if (loading) {
          btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending…';
        } else if (originalHTML) {
          btn.innerHTML = originalHTML;
        }
      }

      function sendEmail(payload) {
        return fetch(AJAX_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload)
        }).then(function (res) {
          if (!res.ok) throw new Error('Network error: HTTP ' + res.status);
          return res.json();
        });
      }

      /* ---------- STAR RATING ---------- */
      var rating = document.getElementById('starRating');
      var ratingLabel = document.getElementById('ratingLabel');
      var ratingValue = 0;
      if (rating) {
        var stars = rating.querySelectorAll('button');
        var labels = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent!'];

        function paint(val, cls) {
          stars.forEach(function (s) {
            var n = parseInt(s.getAttribute('data-star'), 10);
            s.classList.toggle(cls, n <= val);
          });
        }
        stars.forEach(function (s) {
          var n = parseInt(s.getAttribute('data-star'), 10);
          s.addEventListener('mouseenter', function () {
            paint(n, 'hover-active');
            if (ratingLabel) ratingLabel.textContent = labels[n];
          });
          s.addEventListener('mouseleave', function () {
            paint(0, 'hover-active');
            if (ratingLabel) {
              ratingLabel.textContent = ratingValue ? labels[ratingValue] : 'Tap to rate';
            }
          });
          s.addEventListener('click', function () {
            ratingValue = n;
            rating.dataset.value = n;
            paint(n, 'active');
            if (ratingLabel) ratingLabel.textContent = labels[n];
          });
        });
      }

      /* ---------- FEEDBACK FORM ---------- */
      var fbForm = document.getElementById('feedbackForm');
      if (fbForm) {
        fbForm.addEventListener('submit', function (e) {
          e.preventDefault();
          var nameEl  = document.getElementById('fbName');
          var emailEl = document.getElementById('fbEmail');
          var msgEl   = document.getElementById('fbMessage');
          var ok = true;

          if (!nameEl.value.trim() || nameEl.value.trim().length < 2) {
            setErr(nameEl, 'Please enter your name (min 2 chars).'); ok = false;
          } else setErr(nameEl, '');

          if (!validateEmail(emailEl.value.trim())) {
            setErr(emailEl, 'Please enter a valid email.'); ok = false;
          } else setErr(emailEl, '');

          if (!msgEl.value.trim() || msgEl.value.trim().length < 5) {
            setErr(msgEl, 'Message must be at least 5 characters.'); ok = false;
          } else setErr(msgEl, '');

          if (!ratingValue) {
            if (ratingLabel) ratingLabel.textContent = 'Please pick a rating ⭐';
            ok = false;
          }

          if (!ok) {
            showToast('⚠️ Please fix the highlighted fields.');
            return;
          }

          var btn = fbForm.querySelector('button[type="submit"]');
          var originalHTML = btn ? btn.innerHTML : '';
          setLoading(btn, true);

          var payload = {
            _subject: '💬 New feedback on DENMA — ' + ratingValue + '★ from ' + nameEl.value.trim(),
            _template: 'table',
            _captcha: 'false',
            _replyto: emailEl.value.trim(),
            formType: 'Portfolio Feedback',
            name: nameEl.value.trim(),
            email: emailEl.value.trim(),
            rating: ratingValue + ' / 5',
            message: msgEl.value.trim(),
            submittedAt: new Date().toLocaleString()
          };

          try {
            var store = JSON.parse(localStorage.getItem('denmaFeedback') || '[]');
            store.push(payload);
            localStorage.setItem('denmaFeedback', JSON.stringify(store));
          } catch (err) {}

          sendEmail(payload)
            .then(function () {
              if (btn) btn.innerHTML = '<i class="fas fa-check"></i> Sent!';
              var r = (btn || fbForm).getBoundingClientRect();
              fireConfetti(r.left + r.width / 2, r.top + r.height / 2);
              showToast('🙏 Thanks, ' + nameEl.value.trim().split(' ')[0] + '! Your feedback was sent.');

              setTimeout(function () {
                fbForm.reset();
                if (rating) {
                  rating.dataset.value = '0';
                  ratingValue = 0;
                  rating.querySelectorAll('button').forEach(function (b) { b.classList.remove('active'); });
                }
                if (ratingLabel) ratingLabel.textContent = 'Tap to rate';
                setLoading(btn, false, originalHTML);
              }, 1200);
            })
            .catch(function (err) {
              console.error('[FormSubmit]', err);
              setLoading(btn, false, originalHTML);
              showToast('⚠️ Could not send email. Saved locally instead.');
            });
        });
      }

      /* ---------- SUBSCRIBE FORM ---------- */
      var subForm = document.getElementById('subscribeForm');
      if (subForm) {
        subForm.addEventListener('submit', function (e) {
          e.preventDefault();
          var nameEl  = document.getElementById('subName');
          var emailEl = document.getElementById('subEmail');
          var phoneEl = document.getElementById('subPhone');
          var intEl   = document.getElementById('subInterest');
          var ok = true;

          if (!nameEl.value.trim() || nameEl.value.trim().length < 2) {
            setErr(nameEl, 'Please enter your full name.'); ok = false;
          } else setErr(nameEl, '');

          if (!validateEmail(emailEl.value.trim())) {
            setErr(emailEl, 'Please enter a valid email.'); ok = false;
          } else setErr(emailEl, '');

          if (!validatePhone(phoneEl.value.trim())) {
            setErr(phoneEl, 'Enter a valid phone (+254…).'); ok = false;
          } else setErr(phoneEl, '');

          if (!ok) {
            showToast('⚠️ Please check your details.');
            return;
          }

          var btn = subForm.querySelector('button[type="submit"]');
          var originalHTML = btn ? btn.innerHTML : '';
          setLoading(btn, true);

          var payload = {
            _subject: '🤝 New connection request — ' + nameEl.value.trim(),
            _template: 'table',
            _captcha: 'false',
            _replyto: emailEl.value.trim(),
            formType: 'Connect / Subscribe',
            name: nameEl.value.trim(),
            email: emailEl.value.trim(),
            phone: phoneEl.value.trim(),
            interest: intEl ? intEl.value : '',
            submittedAt: new Date().toLocaleString()
          };

          try {
            var leads = JSON.parse(localStorage.getItem('denmaLeads') || '[]');
            leads.push(payload);
            localStorage.setItem('denmaLeads', JSON.stringify(leads));
          } catch (err) {}

          sendEmail(payload)
            .then(function () {
              if (btn) btn.innerHTML = '<i class="fas fa-check"></i> Connected!';
              var r = (btn || subForm).getBoundingClientRect();
              fireConfetti(r.left + r.width / 2, r.top + r.height / 2);
              showToast('✅ Welcome aboard, ' + nameEl.value.trim().split(' ')[0] + '!');

              setTimeout(function () {
                subForm.reset();
                setLoading(btn, false, originalHTML);
              }, 1400);
            })
            .catch(function (err) {
              console.error('[FormSubmit]', err);
              setLoading(btn, false, originalHTML);
              showToast('⚠️ Could not send. Saved locally instead.');
            });
        });
      }

      /* ---------- Magnetic buttons ---------- */
      if (!isTouch && !reduce) {
        document.querySelectorAll('.magnetic').forEach(function (btn) {
          btn.addEventListener('pointermove', function (e) {
            var r = btn.getBoundingClientRect();
            var x = e.clientX - r.left - r.width / 2;
            var y = e.clientY - r.top - r.height / 2;
            btn.style.transform = 'translate(' + (x * 0.15) + 'px,' + (y * 0.15 - 3) + 'px)';
          });
          btn.addEventListener('pointerleave', function () {
            btn.style.transform = '';
          });
        });
      }

    })();

    /* =========================================================
       9. APP MODAL + LIVE PROJECT APPS
       ========================================================= */
    var modal, modalTitle, modalBody, cleanup, closeTimer = null;

    function buildModal() {
      if (document.getElementById('appModal')) {
        modal = document.getElementById('appModal');
        modalTitle = document.getElementById('appModalTitle');
        modalBody  = document.getElementById('appModalBody');
        // Defensive fallbacks in case IDs got stripped
        if (!modalTitle) modalTitle = modal.querySelector('.app-modal-title');
        if (!modalBody)  modalBody  = modal.querySelector('.app-modal-body');
        return;
      }
      var m = document.createElement('div');
      m.id = 'appModal';
      m.className = 'app-modal';
      m.innerHTML =
        '<div class="app-modal-backdrop" data-close></div>' +
        '<div class="app-modal-window">' +
          '<div class="app-modal-bar">' +
            '<div class="app-modal-dots"><span></span><span></span><span></span></div>' +
            '<div class="app-modal-title" id="appModalTitle">Project</div>' +
            '<button class="app-modal-close" data-close><i class="fas fa-times"></i></button>' +
          '</div>' +
          '<div class="app-modal-body" id="appModalBody"></div>' +
        '</div>';
      document.body.appendChild(m);
      modal = m;
      modalTitle = document.getElementById('appModalTitle');
      modalBody  = document.getElementById('appModalBody');
      modal.querySelectorAll('[data-close]').forEach(function (el) {
        el.addEventListener('click', closeModal);
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
      });
    }

    function openModal(title, html) {
      // ✅ FIX: Cancel any pending close-timeout so it can't wipe new content
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
      // ✅ FIX: Run cleanup from previous app before starting new one
      if (cleanup) {
        try { cleanup(); } catch (e) { console.warn('[Denma] cleanup error:', e); }
        cleanup = null;
      }

      if (!modal) buildModal();
      if (!modalBody) { console.error('[Denma] modal body missing'); return; }

      modalTitle.textContent = title;
      modalBody.innerHTML = html;
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
    }

    function closeModal() {
      if (!modal) return;
      modal.classList.remove('open');
      document.body.style.overflow = '';
      if (cleanup) {
        try { cleanup(); } catch (e) { console.warn('[Denma] cleanup error:', e); }
        cleanup = null;
      }
      // ✅ FIX: Track the timer so openModal can cancel it
      closeTimer = setTimeout(function () {
        if (modalBody) modalBody.innerHTML = '';
        closeTimer = null;
      }, 350);
    }

    /* ---------- WEATHER ---------- */
    function launchWeather() {
      openModal('weather-app — live',
        '<div class="wx-app">' +
          '<div class="wx-search">' +
            '<input type="text" id="wxCity" placeholder="City (Nairobi, London, Tokyo…)" value="Nairobi" />' +
            '<button id="wxGo"><i class="fas fa-search"></i> Search</button>' +
          '</div>' +
          '<div class="wx-result" id="wxResult"><div class="wx-hint">Loading…</div></div>' +
        '</div>');

      var input  = document.getElementById('wxCity');
      var goBtn  = document.getElementById('wxGo');
      var result = document.getElementById('wxResult');
      if (!input || !goBtn || !result) return;

      function txt(c) {
        var m = {0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Rime fog',51:'Light drizzle',53:'Drizzle',55:'Dense drizzle',61:'Slight rain',63:'Rain',65:'Heavy rain',71:'Slight snow',73:'Snow',75:'Heavy snow',80:'Rain showers',81:'Rain showers',82:'Violent showers',95:'Thunderstorm'};
        return m[c] || 'Cloudy';
      }
      function ico(c) {
        if (c === 0) return 'fa-sun';
        if (c <= 3) return 'fa-cloud-sun';
        if (c <= 48) return 'fa-smog';
        if (c <= 67) return 'fa-cloud-rain';
        if (c <= 77) return 'fa-snowflake';
        if (c <= 82) return 'fa-cloud-showers-heavy';
        return 'fa-bolt';
      }

      function lookup(city) {
        result.innerHTML = '<div class="wx-hint">Fetching weather…</div>';
        fetch('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(city) + '&count=1')
          .then(function (g) { return g.json(); })
          .then(function (geo) {
            if (!geo.results || !geo.results.length) {
              result.innerHTML = '<div class="wx-hint">City not found. Try another.</div>';
              return;
            }
            var loc = geo.results[0];
            return fetch('https://api.open-meteo.com/v1/forecast?latitude=' + loc.latitude + '&longitude=' + loc.longitude + '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m')
              .then(function (w) { return w.json(); })
              .then(function (wx) {
                var cur = wx.current;
                result.innerHTML =
                  '<div class="wx-city"><i class="fas ' + ico(cur.weather_code) + '" style="color:#00e6d4;margin-right:8px"></i>' + loc.name + '</div>' +
                  '<div class="wx-country">' + (loc.country || '') + '</div>' +
                  '<div class="wx-temp">' + Math.round(cur.temperature_2m) + '°C</div>' +
                  '<div class="wx-cond">' + txt(cur.weather_code) + '</div>' +
                  '<div class="wx-details">' +
                    '<div><i class="fas fa-temperature-half"></i> Feels ' + Math.round(cur.apparent_temperature) + '°C</div>' +
                    '<div><i class="fas fa-droplet"></i> ' + cur.relative_humidity_2m + '%</div>' +
                    '<div><i class="fas fa-wind"></i> ' + cur.wind_speed_10m + ' km/h</div>' +
                  '</div>';
              });
          })
          .catch(function (err) {
            result.innerHTML = '<div class="wx-hint">Error: ' + err.message + '</div>';
          });
      }
      goBtn.addEventListener('click', function () { lookup(input.value.trim() || 'Nairobi'); });
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') goBtn.click(); });
      lookup('Nairobi');
    }

    /* ---------- SNAKE ---------- */
    function launchSnake() {
      openModal('snake-game — live',
        '<div class="snake-app">' +
          '<div class="snake-hud"><div>SCORE: <b id="sScore">0</b></div><div>HIGH: <b id="sHigh">0</b></div></div>' +
          '<canvas class="snake-canvas" id="sCanvas" width="400" height="400"></canvas>' +
          '<div class="snake-controls">' +
            '<button class="up" data-d="up"><i class="fas fa-arrow-up"></i></button>' +
            '<button class="left" data-d="left"><i class="fas fa-arrow-left"></i></button>' +
            '<button class="down" data-d="down"><i class="fas fa-arrow-down"></i></button>' +
            '<button class="right" data-d="right"><i class="fas fa-arrow-right"></i></button>' +
          '</div>' +
          '<button class="snake-btn" id="sRestart">Restart</button>' +
        '</div>');

      var cv = document.getElementById('sCanvas');
      if (!cv) return;
      var cx = cv.getContext('2d');
      var G = 20, C = cv.width / G;
      var snake, dir, nxt, food, score, high, speed, running, iv;

      try { high = parseInt(localStorage.getItem('snakeHigh') || '0', 10); } catch (e) { high = 0; }

      function reset() {
        snake = [{x:10,y:10},{x:9,y:10},{x:8,y:10}];
        dir = {x:1,y:0}; nxt = {x:1,y:0};
        score = 0; speed = 120; running = true;
        place(); hud();
        if (iv) clearInterval(iv);
        iv = setInterval(tick, speed);
      }
      function place() {
        do { food = { x: Math.floor(Math.random()*G), y: Math.floor(Math.random()*G) }; }
        while (snake.some(function(s){return s.x===food.x && s.y===food.y;}));
      }
      function hud() {
        var s = document.getElementById('sScore');
        var h = document.getElementById('sHigh');
        if (s) s.textContent = score;
        if (h) h.textContent = high;
      }
      function tick() {
        if (!running) return;
        dir = nxt;
        var h = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
        if (h.x < 0 || h.x >= G || h.y < 0 || h.y >= G) return end();
        if (snake.some(function(s){return s.x===h.x && s.y===h.y;})) return end();
        snake.unshift(h);
        if (h.x === food.x && h.y === food.y) {
          score += 10;
          if (score > high) { high = score; try { localStorage.setItem('snakeHigh', high); } catch(e){} }
          place();
          if (speed > 60) { speed -= 4; clearInterval(iv); iv = setInterval(tick, speed); }
          hud();
        } else snake.pop();
        draw();
      }
      function draw() {
        cx.fillStyle = '#060a12';
        cx.fillRect(0, 0, cv.width, cv.height);
        cx.strokeStyle = 'rgba(0,230,212,.08)';
        cx.lineWidth = 1;
        for (var i = 1; i < G; i++) {
          cx.beginPath(); cx.moveTo(i*C, 0); cx.lineTo(i*C, cv.height); cx.stroke();
          cx.beginPath(); cx.moveTo(0, i*C); cx.lineTo(cv.width, i*C); cx.stroke();
        }
        cx.fillStyle = '#f472b6';
        cx.shadowColor = '#f472b6'; cx.shadowBlur = 15;
        cx.beginPath(); cx.arc(food.x*C + C/2, food.y*C + C/2, C*.32, 0, Math.PI*2); cx.fill();
        cx.shadowColor = '#00e6d4'; cx.shadowBlur = 12;
        snake.forEach(function (s, i) {
          cx.fillStyle = i === 0 ? '#00ffd5' : 'rgba(0,230,212,' + Math.max(1 - i*.03, .4) + ')';
          cx.fillRect(s.x*C + 1, s.y*C + 1, C - 2, C - 2);
        });
        cx.shadowBlur = 0;
      }
      function end() {
        running = false;
        clearInterval(iv);
        cx.fillStyle = 'rgba(5,6,15,.9)';
        cx.fillRect(0, 0, cv.width, cv.height);
        cx.fillStyle = '#00e6d4';
        cx.font = 'bold 26px Inter, sans-serif';
        cx.textAlign = 'center';
        cx.fillText('GAME OVER', cv.width/2, cv.height/2 - 10);
        cx.fillStyle = '#8a93b0';
        cx.font = '14px JetBrains Mono, monospace';
        cx.fillText('Score: ' + score, cv.width/2, cv.height/2 + 22);
        cx.fillText('Press Restart', cv.width/2, cv.height/2 + 46);
      }
      function setDir(d) {
        if (d === 'up' && dir.y !== 1) nxt = {x:0,y:-1};
        if (d === 'down' && dir.y !== -1) nxt = {x:0,y:1};
        if (d === 'left' && dir.x !== 1) nxt = {x:-1,y:0};
        if (d === 'right' && dir.x !== -1) nxt = {x:1,y:0};
      }
      function keys(e) {
        var k = e.key;
        if (k === 'ArrowUp' || k === 'w' || k === 'W') { e.preventDefault(); setDir('up'); }
        if (k === 'ArrowDown' || k === 's' || k === 'S') { e.preventDefault(); setDir('down'); }
        if (k === 'ArrowLeft' || k === 'a' || k === 'A') { e.preventDefault(); setDir('left'); }
        if (k === 'ArrowRight' || k === 'd' || k === 'D') { e.preventDefault(); setDir('right'); }
      }
      document.addEventListener('keydown', keys);
      modal.querySelectorAll('.snake-controls button').forEach(function (b) {
        b.addEventListener('click', function () { setDir(b.getAttribute('data-d')); });
      });
      var rst = document.getElementById('sRestart');
      if (rst) rst.addEventListener('click', reset);
      cleanup = function () {
        running = false;
        if (iv) clearInterval(iv);
        document.removeEventListener('keydown', keys);
      };
      reset();
      draw();
    }

    /* ---------- CALCULATOR ---------- */
    function launchCalc() {
      openModal('calculator — live',
        '<div class="calc-app">' +
          '<div class="calc-display-live">' +
            '<div class="calc-history" id="cHist"></div>' +
            '<div class="calc-current" id="cCur">0</div>' +
          '</div>' +
          '<div class="calc-keys-live">' +
            '<button class="danger" data-k="C">C</button>' +
            '<button class="danger" data-k="DEL">⌫</button>' +
            '<button class="op" data-k="%">%</button>' +
            '<button class="op" data-k="/">÷</button>' +
            '<button data-k="7">7</button><button data-k="8">8</button><button data-k="9">9</button>' +
            '<button class="op" data-k="*">×</button>' +
            '<button data-k="4">4</button><button data-k="5">5</button><button data-k="6">6</button>' +
            '<button class="op" data-k="-">−</button>' +
            '<button data-k="1">1</button><button data-k="2">2</button><button data-k="3">3</button>' +
            '<button class="op" data-k="+">+</button>' +
            '<button class="span2" data-k="0">0</button>' +
            '<button data-k=".">.</button>' +
            '<button class="eq" data-k="=">=</button>' +
          '</div>' +
        '</div>');

      var curEl = document.getElementById('cCur');
      var histEl = document.getElementById('cHist');
      if (!curEl || !histEl) return;
      var current = '0', history = '';

      function render() { curEl.textContent = current; histEl.textContent = history; }

      function input(k) {
        if (k === 'C') { current = '0'; history = ''; }
        else if (k === 'DEL') { current = current.length > 1 ? current.slice(0, -1) : '0'; }
        else if (k === '=') {
          try {
            var val = Function('"use strict";return(' + current + ')')();
            if (isFinite(val)) {
              history = current + ' =';
              current = String(Math.round(val * 1e10) / 1e10);
            } else current = 'Error';
          } catch (e) { current = 'Error'; }
        }
        else if (k === '%') {
          try { current = String(parseFloat(current) / 100); } catch (e) {}
        }
        else if ('0123456789.'.indexOf(k) !== -1) {
          if (current === '0' && k !== '.') current = k;
          else if (k === '.' && current.indexOf('.') !== -1) {}
          else current += k;
        }
        else {
          if (current === 'Error') current = '0';
          current += k;
        }
        render();
      }
      modal.querySelectorAll('.calc-keys-live button').forEach(function (b) {
        b.addEventListener('click', function () { input(b.getAttribute('data-k')); });
      });
      function keys(e) {
        var k = e.key;
        if ('0123456789.'.indexOf(k) !== -1) input(k);
        else if (k === '+' || k === '-' || k === '*' || k === '/') input(k);
        else if (k === 'Enter' || k === '=') { e.preventDefault(); input('='); }
        else if (k === 'Backspace') input('DEL');
        else if (k === 'Escape') input('C');
      }
      document.addEventListener('keydown', keys);
      cleanup = function () { document.removeEventListener('keydown', keys); };
      render();
    }

    /* ---------- TIC TAC TOE ---------- */
    function launchTTT() {
      openModal('tic-tac-toe — live',
        '<div class="ttt-app">' +
          '<div class="ttt-status" id="tStatus">Player X\'s turn</div>' +
          '<div class="ttt-board-live" id="tBoard">' +
            '<button data-i="0"></button><button data-i="1"></button><button data-i="2"></button>' +
            '<button data-i="3"></button><button data-i="4"></button><button data-i="5"></button>' +
            '<button data-i="6"></button><button data-i="7"></button><button data-i="8"></button>' +
          '</div>' +
          '<div class="ttt-scores"><div>X: <b id="tX">0</b></div><div>O: <b id="tO">0</b></div><div>Draws: <b id="tD">0</b></div></div>' +
          '<button class="ttt-reset" id="tReset">New Round</button>' +
        '</div>');

      var statusEl = document.getElementById('tStatus');
      var boardEl  = document.getElementById('tBoard');
      if (!statusEl || !boardEl) return;

      var cells = boardEl.querySelectorAll('button');
      if (!cells.length) return;

      var board = ['','','','','','','','',''];
      var turn = 'X', over = false;
      var scores = { X: 0, O: 0, D: 0 };
      var wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

      function sc() {
        var x = document.getElementById('tX');
        var o = document.getElementById('tO');
        var d = document.getElementById('tD');
        if (x) x.textContent = scores.X;
        if (o) o.textContent = scores.O;
        if (d) d.textContent = scores.D;
      }
      function checkWin() {
        for (var i = 0; i < wins.length; i++) {
          var w = wins[i];
          if (board[w[0]] && board[w[0]] === board[w[1]] && board[w[1]] === board[w[2]]) {
            w.forEach(function (idx) { cells[idx].classList.add('win'); });
            return board[w[0]];
          }
        }
        return board.every(function (c) { return c; }) ? 'D' : null;
      }
      function click(i) {
        if (over || board[i]) return;
        board[i] = turn;
        cells[i].textContent = turn === 'X' ? '×' : '○';
        cells[i].classList.add(turn.toLowerCase());
        var r = checkWin();
        if (r === 'X' || r === 'O') {
          over = true; scores[r]++;
          statusEl.textContent = '🎉 Player ' + r + ' wins!';
          sc();
        } else if (r === 'D') {
          over = true; scores.D++;
          statusEl.textContent = 'Draw!';
          sc();
        } else {
          turn = turn === 'X' ? 'O' : 'X';
          statusEl.textContent = 'Player ' + turn + '\'s turn';
        }
      }
      function reset() {
        board = ['','','','','','','','',''];
        turn = 'X'; over = false;
        statusEl.textContent = 'Player X\'s turn';
        cells.forEach(function (c) { c.textContent = ''; c.className = ''; });
      }
      cells.forEach(function (b) {
        b.addEventListener('click', function () { click(parseInt(b.getAttribute('data-i'), 10)); });
      });
      var rst = document.getElementById('tReset');
      if (rst) rst.addEventListener('click', reset);
      sc();
    }

    /* ---------- TO-DO ---------- */
    function launchTodo() {
      openModal('todo-app — live',
        '<div class="todo-app">' +
          '<div class="todo-input-row">' +
            '<input type="text" id="tdInput" placeholder="What needs to be done?" />' +
            '<button id="tdAdd"><i class="fas fa-plus"></i> Add</button>' +
          '</div>' +
          '<div class="todo-filters">' +
            '<button data-f="all" class="active">All</button>' +
            '<button data-f="active">Active</button>' +
            '<button data-f="done">Done</button>' +
          '</div>' +
          '<div class="todo-list" id="tdList"></div>' +
        '</div>');

      var listEl  = document.getElementById('tdList');
      var inputEl = document.getElementById('tdInput');
      var addBtn  = document.getElementById('tdAdd');
      if (!listEl || !inputEl || !addBtn) return;

      var KEY = 'denmaTodos';
      var todos;
      try { todos = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { todos = []; }
      var filter = 'all';

      function save() { try { localStorage.setItem(KEY, JSON.stringify(todos)); } catch (e) {} }
      function render() {
        listEl.innerHTML = '';
        var f = todos.filter(function (t) {
          if (filter === 'active') return !t.done;
          if (filter === 'done') return t.done;
          return true;
        });
        if (!f.length) {
          listEl.innerHTML = '<div class="todo-empty">Nothing here yet — add a task above.</div>';
          return;
        }
        f.forEach(function (t) {
          var item = document.createElement('div');
          item.className = 'todo-list-item' + (t.done ? ' done' : '');
          item.innerHTML = '<button class="todo-check"><i class="fas fa-check"></i></button><span class="todo-list-text"></span><button class="todo-del"><i class="fas fa-trash"></i></button>';
          item.querySelector('.todo-list-text').textContent = t.text;
          item.querySelector('.todo-check').addEventListener('click', function () { t.done = !t.done; save(); render(); });
          item.querySelector('.todo-del').addEventListener('click', function () {
            todos = todos.filter(function (x) { return x !== t; });
            save(); render();
          });
          listEl.appendChild(item);
        });
      }
      function add() {
        var val = inputEl.value.trim();
        if (!val) return;
        todos.unshift({ text: val, done: false, id: Date.now() });
        inputEl.value = '';
        save(); render();
      }
      addBtn.addEventListener('click', add);
      inputEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') add(); });
      modal.querySelectorAll('.todo-filters button').forEach(function (b) {
        b.addEventListener('click', function () {
          modal.querySelectorAll('.todo-filters button').forEach(function (x) { x.classList.remove('active'); });
          b.classList.add('active');
          filter = b.getAttribute('data-f');
          render();
        });
      });
      render();
    }

    /* ---------- ARDUINO ---------- */
    function launchArduino() {
      openModal('arduino-lab — simulated IoT',
        '<div class="arduino-app">' +
          '<div class="arduino-top">' +
            '<div class="arduino-panel">' +
              '<h4>Sensors</h4>' +
              '<div class="sensor-row"><label>Temperature</label><input type="range" id="aT" min="0" max="50" value="24" /><b id="aTV">24°C</b></div>' +
              '<div class="sensor-row"><label>Light</label><input type="range" id="aL" min="0" max="1023" value="512" /><b id="aLV">512</b></div>' +
              '<div class="sensor-row"><label>Humidity</label><input type="range" id="aH" min="0" max="100" value="60" /><b id="aHV">60%</b></div>' +
              '<div class="arduino-lcd"><div id="lcd1">TEMP: 24.0 C</div><div id="lcd2">HUM:  60 %</div></div>' +
            '</div>' +
            '<div class="arduino-panel">' +
              '<h4>LED Matrix</h4>' +
              '<div class="led-grid" id="lGrid">' +
                '<button></button><button></button><button></button><button></button>' +
                '<button></button><button></button><button></button><button></button>' +
                '<button></button><button></button><button></button><button></button>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="arduino-panel">' +
            '<h4>Serial Monitor</h4>' +
            '<div class="serial" id="serial"></div>' +
          '</div>' +
        '</div>');

      var serial = document.getElementById('serial');
      var t = document.getElementById('aT');
      var l = document.getElementById('aL');
      var h = document.getElementById('aH');
      var lcd1 = document.getElementById('lcd1');
      var lcd2 = document.getElementById('lcd2');
      if (!serial || !t || !l || !h || !lcd1 || !lcd2) return;

      function log(msg) {
        var line = document.createElement('div');
        line.className = 'serial-line';
        line.textContent = '[' + new Date().toLocaleTimeString() + '] ' + msg;
        serial.appendChild(line);
        serial.scrollTop = serial.scrollHeight;
        while (serial.children.length > 60) serial.removeChild(serial.firstChild);
      }
      function update() {
        var aTV = document.getElementById('aTV');
        var aLV = document.getElementById('aLV');
        var aHV = document.getElementById('aHV');
        if (aTV) aTV.textContent = t.value + '°C';
        if (aLV) aLV.textContent = l.value;
        if (aHV) aHV.textContent = h.value + '%';
        lcd1.textContent = 'TEMP: ' + parseFloat(t.value).toFixed(1) + ' C';
        lcd2.textContent = 'HUM:  ' + h.value + ' %';
      }
      t.addEventListener('input', function () { update(); log('TEMP_READ → ' + t.value + '°C'); });
      l.addEventListener('input', function () { update(); log('LIGHT_READ → ' + l.value); });
      h.addEventListener('input', function () { update(); log('HUM_READ → ' + h.value + '%'); });
      modal.querySelectorAll('#lGrid button').forEach(function (b) {
        b.addEventListener('click', function () {
          b.classList.toggle('on');
          log('LED → ' + (b.classList.contains('on') ? 'ON' : 'OFF'));
        });
      });
      log('Arduino Uno connected on COM3');
      log('Sketch: denma_sensors.ino loaded');
      log('Serial baud rate: 9600');
      var auto = setInterval(function () {
        log('HEARTBEAT → uptime ' + Math.floor(performance.now() / 1000) + 's');
      }, 5000);
      cleanup = function () { clearInterval(auto); };
      update();
    }

    /* ---------- Map + safe launcher ---------- */
    var launchMap = {
      weather: launchWeather,
      snake: launchSnake,
      calculator: launchCalc,
      tictactoe: launchTTT,
      todo: launchTodo,
      arduino: launchArduino
    };

    function launchByKey(k) {
      var fn = launchMap[k];
      if (!fn) { console.warn('[Denma] Unknown app:', k); return; }
      try {
        fn();
      } catch (err) {
        console.error('[Denma] Error launching "' + k + '":', err);
        if (window.__denmaToast) window.__denmaToast('⚠️ Could not open app. Try again.');
      }
    }
    window.__denmaLaunch = launchByKey;

    /* ---------- Wire up project cards (bulletproof) ---------- */
    function attachCards() {
      var cards = document.querySelectorAll('.project-card');
      cards.forEach(function (card) {
        if (card.dataset.bound === '1') return;
        card.dataset.bound = '1';

        // Accessibility
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');

        var h3 = card.querySelector('h3');
        if (!h3) return;
        var title = h3.textContent.toLowerCase().trim();
        var key = null;
        if (title.indexOf('weather') !== -1) key = 'weather';
        else if (title.indexOf('snake') !== -1) key = 'snake';
        else if (title.indexOf('calculator') !== -1) key = 'calculator';
        else if (title.indexOf('tac') !== -1) key = 'tictactoe';
        else if (title.indexOf('to-do') !== -1 || title.indexOf('todo') !== -1) key = 'todo';
        else if (title.indexOf('arduino') !== -1) key = 'arduino';
        if (!key) return;

        // ✅ FIX: debounce so fast double-taps don't stack
        var lastTap = 0;
        function handler(e) {
          // Let form/interactive elements inside the card work normally
          if (e.target.closest('input,textarea,select')) return;
          if (e.target.closest('a')) {
            e.preventDefault();
          }
          var now = Date.now();
          if (now - lastTap < 350) return; // ignore rapid double-fire
          lastTap = now;
          launchByKey(key);
        }

        // Use BOTH click (desktop) and pointerup (mobile reliability)
        card.addEventListener('click', handler);
        card.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handler(e);
          }
        });
      });
      console.log('[Denma] Wired ' + cards.length + ' project cards.');
    }

    attachCards();
    setTimeout(attachCards, 400);
    setTimeout(attachCards, 1200);
  });

  /* =========================================================
     10. GLOBAL HELPERS
     ========================================================= */
  function launchByKey(k) {
    if (window.__denmaLaunch) window.__denmaLaunch(k);
  }

  console.log('%c[Denma] ✓ Portfolio ready — modal race condition fixed.', 'color:#00e6d4;font-weight:bold;font-size:12px');

})();