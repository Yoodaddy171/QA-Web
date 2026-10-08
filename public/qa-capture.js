(function () {
  var params = new URLSearchParams(window.location.search);
  var enabled = params.get('qaCapture') === '1';
  var testCaseId = params.get('qaTestCaseId') || params.get('caseId') || '';
  var sessionId = params.get('qaSessionId') || '';
  var relay = params.get('qaRelay') || 'http://127.0.0.1:3001';
  var relayToken = params.get('qaToken') || '';
  var showSensitive = params.get('qaRaw') === '1';
  var maxTextLength = 4000;

  if (!enabled || !testCaseId || !sessionId || window.__qaManualCaptureInstalled) return;
  window.__qaManualCaptureInstalled = true;

  var originalFetch = window.fetch ? window.fetch.bind(window) : null;
  var originalXhrOpen = window.XMLHttpRequest && window.XMLHttpRequest.prototype.open;
  var originalXhrSend = window.XMLHttpRequest && window.XMLHttpRequest.prototype.send;
  var originalConsole = {};
  ['log', 'info', 'warn', 'error'].forEach(function (level) {
    originalConsole[level] = console[level] ? console[level].bind(console) : function () {};
  });

  function truncate(value) {
    if (value == null) return value;
    var text = typeof value === 'string' ? value : safeStringify(value);
    if (text.length <= maxTextLength) return text;
    return text.slice(0, maxTextLength) + '... [truncated]';
  }

  function safeStringify(value) {
    try {
      return JSON.stringify(value);
    } catch (_) {
      return String(value);
    }
  }

  function redactValue(key, value) {
    var sensitive = /authorization|cookie|token|password|secret|apikey|api-key|access_token|refresh_token/i;
    if (showSensitive) {
      if (value && typeof value === 'object') return redactObject(value);
      return value;
    }
    if (sensitive.test(String(key))) return '[REDACTED]';
    if (value && typeof value === 'object') return redactObject(value);
    return value;
  }

  function redactObject(input) {
    if (!input || typeof input !== 'object') return input;
    if (Array.isArray(input)) return input.slice(0, 20).map(function (item) { return redactObject(item); });
    var output = {};
    Object.keys(input).slice(0, 80).forEach(function (key) {
      output[key] = redactValue(key, input[key]);
    });
    return output;
  }

  function headersToObject(headers) {
    var output = {};
    if (!headers) return output;
    try {
      if (typeof Headers !== 'undefined' && headers instanceof Headers) {
        headers.forEach(function (value, key) {
          output[key] = redactValue(key, value);
        });
      } else if (Array.isArray(headers)) {
        headers.forEach(function (pair) {
          if (pair && pair.length >= 2) output[pair[0]] = redactValue(pair[0], pair[1]);
        });
      } else if (typeof headers === 'object') {
        Object.keys(headers).forEach(function (key) {
          output[key] = redactValue(key, headers[key]);
        });
      }
    } catch (_) {}
    return output;
  }

  function sendLog(payload) {
    var logPayload = Object.assign({
      type: 'log',
      source: 'manual-capture',
      testCaseId: testCaseId,
      sessionId: sessionId,
      timestamp: new Date().toISOString(),
    }, payload);

    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([JSON.stringify(logPayload)], { type: 'application/json' });
        if (navigator.sendBeacon(relay.replace(/\/$/, '') + '/log?access_token=' + encodeURIComponent(relayToken), blob)) return;
      }
    } catch (_) {}

    try {
      if (originalFetch) {
        originalFetch(relay.replace(/\/$/, '') + '/log?access_token=' + encodeURIComponent(relayToken), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(logPayload),
          keepalive: true,
        }).catch(function () {});
      }
    } catch (_) {}
  }

  function serializeConsoleArgs(args) {
    return Array.prototype.slice.call(args).map(function (arg) {
      if (arg instanceof Error) {
        return { name: arg.name, message: arg.message, stack: truncate(arg.stack) };
      }
      if (arg && typeof arg === 'object') return truncate(redactObject(arg));
      return truncate(String(arg));
    }).join(' ');
  }

  function cleanLabel(value, fallback) {
    var text = String(value || '').replace(/\s+/g, ' ').trim();
    return truncate(text || fallback || 'elemen');
  }

  function getAriaLabelledBy(element) {
    var ids = element && element.getAttribute && element.getAttribute('aria-labelledby');
    if (!ids) return '';
    return ids.split(/\s+/).map(function (id) {
      var label = document.getElementById(id);
      return label ? label.textContent : '';
    }).filter(Boolean).join(' ');
  }

  function getFieldLabel(element) {
    if (!element) return 'field';
    var label = '';
    try {
      label = element.getAttribute('aria-label') || getAriaLabelledBy(element);
      if (!label && element.labels && element.labels.length) label = element.labels[0].textContent;
      if (!label) {
        var wrappingLabel = element.closest && element.closest('label');
        if (wrappingLabel) label = wrappingLabel.textContent;
      }
      label = label || element.getAttribute('placeholder') || element.getAttribute('name') || element.id;
    } catch (_) {}
    return cleanLabel(label, 'field');
  }

  function getControlLabel(element) {
    if (!element) return 'elemen';
    var label = '';
    try {
      label = element.getAttribute('aria-label') || getAriaLabelledBy(element) || element.getAttribute('title');
      label = label || element.textContent || element.getAttribute('value') || element.getAttribute('name') || element.id;
    } catch (_) {}
    return cleanLabel(label, String(element.tagName || 'elemen').toLowerCase());
  }

  function getPageEndpoint() {
    return window.location.pathname + window.location.search + window.location.hash;
  }

  function getInputValue(element) {
    var value = element && 'value' in element ? String(element.value || '') : '';
    if (!showSensitive && element && element.type === 'password') return '[REDACTED]';
    return cleanLabel(value, '(kosong)');
  }

  function sendInteraction(interactionType, message, details) {
    var interaction = Object.assign({ type: interactionType, message: message }, details || {});
    sendLog({
      eventType: 'step',
      stepName: message,
      message: message,
      log: message,
      interaction: interaction,
      metadata: { interaction: interaction },
    });
  }

  ['log', 'info', 'warn', 'error'].forEach(function (level) {
    console[level] = function () {
      var normalizedLevel = level === 'error' ? 'SEVERE' : level === 'warn' ? 'WARNING' : 'INFO';
      sendLog({ level: normalizedLevel, console: true, log: serializeConsoleArgs(arguments) });
      return originalConsole[level].apply(console, arguments);
    };
  });

  window.addEventListener('error', function (event) {
    sendLog({
      level: 'SEVERE',
      console: true,
      log: {
        message: event.message,
        source: event.filename,
        line: event.lineno,
        column: event.colno,
        stack: truncate(event.error && event.error.stack),
      },
    });
  });

  window.addEventListener('unhandledrejection', function (event) {
    sendLog({
      level: 'SEVERE',
      console: true,
      log: {
        message: 'Unhandled promise rejection',
        reason: truncate(event.reason),
      },
    });
  });

  if (originalFetch) {
    window.fetch = function (input, init) {
      var startedAt = Date.now();
      var requestUrl = typeof input === 'string' ? input : input && input.url;
      var method = (init && init.method) || (input && input.method) || 'GET';
      var headers = headersToObject((init && init.headers) || (input && input.headers));
      var requestBody = init && init.body ? truncate(init.body) : undefined;

      return originalFetch(input, init).then(function (response) {
        var duration = Date.now() - startedAt;
        try {
          response.clone().text().then(function (text) {
            sendLog({
              log: 'Network Trace',
              network: {
                event: 'Response',
                method: method,
                url: requestUrl || response.url,
                status: response.status,
                success: response.ok,
                duration: duration,
                headers: headersToObject(response.headers),
                data: {
                  requestHeaders: headers,
                  requestBody: requestBody,
                  responseBody: truncate(text),
                },
              },
            });
          }).catch(function () {});
        } catch (_) {}
        return response;
      }).catch(function (error) {
        sendLog({
          log: 'Network Trace',
          network: {
            event: 'Error',
            method: method,
            url: requestUrl || '',
            status: 0,
            success: false,
            duration: Date.now() - startedAt,
            headers: headers,
            data: { error: error && error.message ? error.message : String(error) },
          },
        });
        throw error;
      });
    };
  }

  if (originalXhrOpen && originalXhrSend) {
    XMLHttpRequest.prototype.open = function (method, url) {
      this.__qaCapture = { method: method || 'GET', url: String(url || ''), startedAt: 0 };
      return originalXhrOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function (body) {
      var xhr = this;
      var meta = xhr.__qaCapture || { method: 'GET', url: '', startedAt: 0 };
      meta.startedAt = Date.now();
      xhr.addEventListener('loadend', function () {
        sendLog({
          log: 'Network Trace',
          network: {
            event: 'Response',
            method: meta.method,
            url: meta.url,
            status: xhr.status,
            success: xhr.status >= 200 && xhr.status < 400,
            duration: Date.now() - meta.startedAt,
            headers: {},
            data: {
              requestBody: truncate(body),
              responseBody: truncate(xhr.responseText),
            },
          },
        });
      });
      return originalXhrSend.apply(this, arguments);
    };
  }

  var inputTimers = new WeakMap();
  var lastInputValues = new WeakMap();

  function recordTextInput(element) {
    var value = getInputValue(element);
    if (lastInputValues.get(element) === value) return;
    lastInputValues.set(element, value);
    var field = getFieldLabel(element);
    sendInteraction('input', 'Memasukkan "' + value + '" ke field "' + field + '"', {
      target: field,
      value: value,
    });
  }

  window.addEventListener('input', function (event) {
    var element = event.target;
    if (!element || !element.matches || !element.matches('input:not([type="checkbox"]):not([type="radio"]), textarea')) return;
    var activeTimer = inputTimers.get(element);
    if (activeTimer) window.clearTimeout(activeTimer);
    inputTimers.set(element, window.setTimeout(function () {
      inputTimers.delete(element);
      recordTextInput(element);
    }, 600));
  }, true);

  window.addEventListener('change', function (event) {
    var element = event.target;
    if (!element || !element.matches) return;

    if (element.matches('select')) {
      var selectField = getFieldLabel(element);
      var selectedText = Array.prototype.map.call(element.selectedOptions || [], function (option) {
        return option.textContent || option.value;
      }).join(', ');
      selectedText = cleanLabel(selectedText || element.value, '(kosong)');
      sendInteraction('select', 'Memilih "' + selectedText + '" untuk field "' + selectField + '"', {
        target: selectField,
        value: selectedText,
      });
      return;
    }

    if (element.matches('input[type="checkbox"]')) {
      var checkboxField = getFieldLabel(element);
      sendInteraction('checkbox', (element.checked ? 'Mencentang' : 'Menghapus centang pada') + ' field "' + checkboxField + '"', {
        target: checkboxField,
        value: Boolean(element.checked),
      });
      return;
    }

    if (element.matches('input[type="radio"]')) {
      var radioField = getFieldLabel(element);
      var radioValue = cleanLabel(element.value, getControlLabel(element));
      sendInteraction('radio', 'Memilih opsi "' + radioValue + '" untuk field "' + radioField + '"', {
        target: radioField,
        value: radioValue,
      });
      return;
    }

    if (element.matches('input, textarea')) {
      var timer = inputTimers.get(element);
      if (timer) window.clearTimeout(timer);
      inputTimers.delete(element);
      recordTextInput(element);
    }
  }, true);

  window.addEventListener('click', function (event) {
    var target = event.target;
    var element = target && target.closest
      ? target.closest('button,a,[role="button"],[role="option"],[role="menuitem"],[role="tab"],input[type="button"],input[type="submit"],[data-testid],[aria-label]') || target
      : target;
    if (!element || !element.matches || element.matches('select,textarea,input:not([type="button"]):not([type="submit"])')) return;

    var targetLabel = getControlLabel(element);
    var isLink = element.matches('a[href]');
    var role = element.getAttribute && element.getAttribute('role');
    var interactionType = isLink ? 'link' : role === 'option' ? 'select' : role === 'menuitem' ? 'menu' : role === 'tab' ? 'tab' : 'click';
    var message = isLink ? 'Membuka tautan "' + targetLabel + '"'
      : role === 'option' ? 'Memilih opsi "' + targetLabel + '"'
      : role === 'menuitem' ? 'Memilih menu "' + targetLabel + '"'
      : role === 'tab' ? 'Membuka tab "' + targetLabel + '"'
      : 'Menekan tombol "' + targetLabel + '"';
    var interaction = {
      target: targetLabel,
      x: event.clientX,
      y: event.clientY,
      viewportWidth: window.innerWidth || document.documentElement.clientWidth || 0,
      viewportHeight: window.innerHeight || document.documentElement.clientHeight || 0,
    };
    if (isLink) interaction.href = element.href;
    sendInteraction(interactionType, message, interaction);
  }, true);

  window.addEventListener('submit', function (event) {
    var form = event.target;
    var formLabel = getControlLabel(form);
    sendInteraction('submit', 'Mengirim form "' + formLabel + '"', { target: formLabel });
  }, true);

  var lastPageEndpoint = '';
  function recordNavigation() {
    var endpoint = getPageEndpoint();
    if (!endpoint || endpoint === lastPageEndpoint) return;
    lastPageEndpoint = endpoint;
    sendInteraction('navigation', 'Menuju halaman "' + endpoint + '"', {
      target: endpoint,
      url: window.location.href,
    });
  }

  ['pushState', 'replaceState'].forEach(function (method) {
    var original = window.history && window.history[method];
    if (!original) return;
    window.history[method] = function () {
      var result = original.apply(this, arguments);
      window.setTimeout(recordNavigation, 0);
      return result;
    };
  });
  window.addEventListener('popstate', recordNavigation);
  window.addEventListener('hashchange', recordNavigation);
  recordNavigation();

  sendLog({
    level: 'INFO',
    console: true,
    log: 'Manual capture logger active',
  });
})();
