window.addEventListener("DOMContentLoaded",()=>{const t=document.createElement("script");t.src="https://www.googletagmanager.com/gtag/js?id=G-W5GKHM0893",t.async=!0,document.head.appendChild(t);const n=document.createElement("script");n.textContent="window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', 'G-W5GKHM0893');",document.body.appendChild(n)});/*
 * dsh-auth-guard.js
 * Pake --inject 守卫脚本，配合 DSH (DeepSeek Harness) Web UI 使用。
 *
 * 背景：dsh web 首次访问需 ?token=xxx，服务端 303 并种下 30 天 HttpOnly cookie。
 *       cookie 是持久自签 JWT，DSH 重启后依然有效；但 Pake 的 WebView2 有独立
 *       cookie 存储，与浏览器不共享，且 cookie 过期 / profile 被清时会重新 401。
 *
 * 作用：
 *   1. 页面本身返回 "dsh web authentication required" 时，弹出输入框重新握手；
 *   2. 运行中同源请求返回 401 时，弹出输入框重新握手；
 *   3. Ctrl+Shift+D（或 Ctrl+Shift+Alt+D）或 window.__dshReauth() 手动触发重新认证。
 *      注意：F8 在 PakePlus 中被占用为刷新，不要用。
 *
 * 重新握手：粘贴 dsh web 启动时打印的完整 URL（也可只粘贴 token），
 *           location.replace 跳转 -> DSH 303 -> 重新种 cookie -> 回到干净根地址。
 */
(function () {
  'use strict';

  var ORIGIN = 'http://127.0.0.1:3080/';
  var TOKEN_URL_RE = /^https?:\/\/127\.0\.0\.1:3080\/\?token=[A-Za-z0-9_-]+$/;
  var TOKEN_RE = /^[A-Za-z0-9_-]{20,}$/;
  var AUTH_HINT = 'dsh web authentication required';
  var OVERLAY_ID = '__dsh_reauth_overlay';

  function normalize(input) {
    var s = (input || '').trim();
    // 复制时常见的包裹字符
    s = s.replace(/^["'<(\[]+/, '').replace(/["'>) \]]+$/, '');
    if (!s) return null;
    if (TOKEN_RE.test(s)) return ORIGIN + '?token=' + s; // 只粘贴了 token
    return TOKEN_URL_RE.test(s) ? s : null;
  }

  function reauth(url) {
    if (url) window.location.replace(url);
  }

  function promptReauth() {
    if (document.getElementById(OVERLAY_ID)) return;

    var host = document.body || document.documentElement;
    if (!host) return;

    var box = document.createElement('div');
    box.id = OVERLAY_ID;
    box.setAttribute('style',
      'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.55);' +
      'display:flex;align-items:center;justify-content:center;' +
      'font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;');

    var panel = document.createElement('div');
    panel.setAttribute('style',
      'background:#fff;color:#222;padding:22px 26px;border-radius:10px;' +
      'width:min(560px,90vw);box-shadow:0 8px 40px rgba(0,0,0,.3);');

    var title = document.createElement('div');
    title.textContent = 'DSH 认证已失效';
    title.setAttribute('style', 'font-weight:600;font-size:16px;margin-bottom:8px;');

    var hint = document.createElement('div');
    hint.textContent = '在 WSL 中查看 dsh web 的启动输出（或重启 dsh-web.service），' +
      '复制打印的完整带 token URL 粘贴到下面。完成后 cookie 有效 30 天，DSH 重启无需再管。';
    hint.setAttribute('style', 'color:#555;margin-bottom:12px;');

    var input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'http://127.0.0.1:3080/?token=...   （也可只粘贴 token）';
    input.setAttribute('style',
      'width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid #ccc;' +
      'border-radius:6px;font:13px monospace;');

    var err = document.createElement('div');
    err.setAttribute('style', 'color:#c0392b;min-height:18px;margin-top:6px;font-size:12px;');

    var actions = document.createElement('div');
    actions.setAttribute('style', 'display:flex;gap:8px;justify-content:flex-end;margin-top:8px;');
    var btnCancel = document.createElement('button');
    btnCancel.textContent = '取消';
    btnCancel.setAttribute('style',
      'padding:6px 14px;border:1px solid #ccc;background:#f5f5f5;border-radius:6px;cursor:pointer;');
    var btnOk = document.createElement('button');
    btnOk.textContent = '打开';
    btnOk.setAttribute('style',
      'padding:6px 14px;border:0;background:#1a73e8;color:#fff;border-radius:6px;cursor:pointer;');

    function submit() {
      var url = normalize(input.value);
      if (!url) {
        err.textContent = '格式不对：请粘贴完整的 http://127.0.0.1:3080/?token=... 或只粘贴 token';
        return;
      }
      reauth(url);
    }

    btnOk.addEventListener('click', submit);
    btnCancel.addEventListener('click', function () { box.remove(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') submit();
      else if (e.key === 'Escape') box.remove();
    });

    actions.appendChild(btnCancel);
    actions.appendChild(btnOk);
    panel.appendChild(title);
    panel.appendChild(hint);
    panel.appendChild(input);
    panel.appendChild(err);
    panel.appendChild(actions);
    box.appendChild(panel);
    host.appendChild(box);
    input.focus();
  }

  // 1) 页面级 401：DSH 返回的是 text/plain，浏览器会包成带 <pre> 的文档
  function checkPage() {
    var body = document.body;
    var text = body ? (body.innerText || body.textContent || '') : '';
    if (text.indexOf(AUTH_HINT) !== -1) promptReauth();
  }

  checkPage();
  document.addEventListener('DOMContentLoaded', checkPage);
  window.addEventListener('load', checkPage);
  // DOM 尚未生成 body 时（initialization_script 在 document-created 阶段执行）兜底：
  // 只在 body 首次出现时检查一次就断开，避免常驻监听拖慢 DSH 的 SPA。
  if (typeof MutationObserver !== 'undefined' && !document.body) {
    var observer = new MutationObserver(function () {
      if (!document.body) return;
      observer.disconnect();
      checkPage();
    });
    observer.observe(document, { childList: true, subtree: true });
  }

  // 2) 运行中同源请求 401（cookie 过期 / 服务重启后密钥轮换）
  if (typeof window.fetch === 'function') {
    var originalFetch = window.fetch;
    window.fetch = function () {
      return originalFetch.apply(this, arguments).then(function (res) {
        try {
          if (res && res.status === 401 &&
              (!res.url || res.url.indexOf('127.0.0.1:3080') !== -1)) {
            promptReauth();
          }
        } catch (_) { /* ignore */ }
        return res;
      });
    };
  }

  // 3) 手动入口：F8 在 PakePlus 里被占用为刷新，改用 Ctrl+Shift+D（带不带 Alt 都行）
  window.__dshReauth = promptReauth;
  window.__dshReauthVersion = '2';
  document.addEventListener('keydown', function (e) {
    var key = (e.key || '').toLowerCase();
    if (key === 'd' && e.ctrlKey && e.shiftKey) {
      e.preventDefault();
      promptReauth();
    }
  }, true);

  // 自检标记：勾选「开发调试」后，控制台应出现这一行
  try { console.log('[dsh-auth-guard] injected, version 2'); } catch (_) { /* ignore */ }
})();
