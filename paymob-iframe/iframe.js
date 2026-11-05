/* jshint browser: true */
(function () {
  'use strict';

  var DOT = String.fromCharCode(8226);

  function $(id) {
    return document.getElementById(id);
  }

  var form = $('ppForm');
  var card = $('ppCard');
  var err = $('ppError');
  var pay = $('ppPay');
  var fNum = $('fNum');
  var fName = $('fName');
  var fExp = $('fExp');
  var fCvv = $('fCvv');

  function getToken() {
    var match = /[?&]payment_token=([^&#]+)/.exec(window.location.search);
    return match ? decodeURIComponent(match[1]) : '';
  }

  var token = getToken();

  function digits(v) {
    return String(v || '').replace(/\D/g, '');
  }

  function repeat(ch, count) {
    var out = '';
    for (var i = 0; i < count; i++) {
      out += ch;
    }
    return out;
  }

  function groupsOfFour(s) {
    return s.replace(/(.{4})/g, '$1 ').replace(/\s+$/, '');
  }

  function brandOf(n) {
    if (/^4/.test(n)) {
      return 'VISA';
    }
    if (/^(5[1-5]|2[2-7])/.test(n)) {
      return 'Mastercard';
    }
    if (/^50780[389]|^507810/.test(n)) {
      return 'Meeza';
    }
    if (/^3[47]/.test(n)) {
      return 'AMEX';
    }
    return '';
  }

  function luhn(n) {
    var sum = 0;
    var alt = false;
    for (var i = n.length - 1; i >= 0; i--) {
      var d = parseInt(n.charAt(i), 10);
      if (alt) {
        d = d * 2;
        if (d > 9) {
          d = d - 9;
        }
      }
      sum = sum + d;
      alt = !alt;
    }
    return n.length >= 13 && sum % 10 === 0;
  }

  function addClass(el, name) {
    if (el.className.indexOf(name) === -1) {
      el.className = (el.className + ' ' + name).replace(/^\s+/, '');
    }
  }

  function removeClass(el, name) {
    el.className = (' ' + el.className + ' ').replace(' ' + name + ' ', ' ').replace(/^\s+|\s+$/g, '');
  }

  function showError(msg) {
    err.textContent = msg || '';
    if (msg) {
      removeClass(form, 'shake');
      window.setTimeout(function () {
        addClass(form, 'shake');
      }, 10);
    }
  }

  function setBusy(on) {
    pay.disabled = on;
    if (on) {
      addClass(pay, 'busy');
    } else {
      removeClass(pay, 'busy');
    }
    fNum.disabled = on;
    fName.disabled = on;
    fExp.disabled = on;
    fCvv.disabled = on;
  }

  /* Live formatting and the card preview */
  fNum.addEventListener('input', function () {
    var n = digits(fNum.value).slice(0, 19);
    fNum.value = groupsOfFour(n);
    var shown = (n + repeat(DOT, 16)).slice(0, 16);
    $('ppNum').textContent = groupsOfFour(shown);
    $('ppBrand').textContent = brandOf(n);
    removeClass(fNum, 'bad');
  });

  fName.addEventListener('input', function () {
    var name = fName.value.replace(/^\s+|\s+$/g, '');
    $('ppName').textContent = name || 'YOUR NAME';
    removeClass(fName, 'bad');
  });

  fExp.addEventListener('input', function (e) {
    var d = digits(fExp.value).slice(0, 4);
    if (d.length === 1 && parseInt(d, 10) > 1) {
      d = '0' + d;
    }
    var deleting = Boolean(e.inputType) && e.inputType.indexOf('delete') === 0;
    if (d.length > 2 || (d.length === 2 && !deleting)) {
      fExp.value = d.slice(0, 2) + ' / ' + d.slice(2);
    } else {
      fExp.value = d;
    }
    if (d.length) {
      $('ppExp').textContent = d.slice(0, 2) + '/' + (d.slice(2) || 'YY');
    } else {
      $('ppExp').textContent = 'MM/YY';
    }
    removeClass(fExp, 'bad');
  });

  fCvv.addEventListener('input', function () {
    fCvv.value = digits(fCvv.value).slice(0, 4);
    $('ppCvv').textContent = fCvv.value ? repeat(DOT, fCvv.value.length) : repeat(DOT, 3);
    removeClass(fCvv, 'bad');
  });

  fCvv.addEventListener('focus', function () {
    addClass(card, 'flip');
  });

  fCvv.addEventListener('blur', function () {
    removeClass(card, 'flip');
  });

  function done() {
    form.style.display = 'none';
    card.style.display = 'none';
    $('ppDone').hidden = false;
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ source: 'prime-paymob', status: 'paid' }, '*');
    }
  }

  function fail(msg) {
    setBusy(false);
    showError(msg);
  }

  function handleResult(res) {
    var data = res.data || {};
    /* 3-D Secure: continue to the bank check page inside this same window. */
    var next = res.redirection_url || res.redirect_url || res.iframe_redirection_url ||
      data.redirection_url || data.redirect_url;
    if (next) {
      window.location.href = next;
      return;
    }
    if (res.success === true || res.success === 'true') {
      done();
      return;
    }
    var msg = data.message || data.txn_response_code || res.detail || res.message || '';
    if (msg && msg !== 'Approved') {
      fail('Payment was declined: ' + msg);
    } else {
      fail('Payment was not completed. Please check your card details or try another card.');
    }
  }

  function sendPayment(body) {
    var host = window.location.hostname.indexOf('paymob.com') > -1 ? '' : 'https://accept.paymob.com';
    var xhr = new XMLHttpRequest();
    xhr.open('POST', host + '/api/acceptance/payments/pay', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onload = function () {
      var res = {};
      try {
        res = window.JSON.parse(xhr.responseText || '{}');
      } catch (parseError) {
        res = { message: 'Unexpected reply from the payment server.' };
      }
      handleResult(res);
    };
    xhr.onerror = function () {
      fail('We could not reach the payment server. Please check your connection and try again.');
    };
    xhr.send(window.JSON.stringify(body));
  }

  /* Submit straight to Paymob */
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    showError('');

    var n = digits(fNum.value);
    var exp = digits(fExp.value);
    var cvv = digits(fCvv.value);
    var name = fName.value.replace(/^\s+|\s+$/g, '');
    var mm = exp.slice(0, 2);
    var yy = exp.slice(2, 4);
    var now = new Date();
    var curYY = now.getFullYear() % 100;
    var curMM = now.getMonth() + 1;
    var month = parseInt(mm, 10);
    var year = parseInt(yy, 10);

    if (!luhn(n)) {
      addClass(fNum, 'bad');
      showError('Please check the card number.');
      return;
    }
    if (name.length < 2) {
      addClass(fName, 'bad');
      showError('Please enter the name on the card.');
      return;
    }
    if (exp.length !== 4 || month < 1 || month > 12 || year < curYY || (year === curYY && month < curMM)) {
      addClass(fExp, 'bad');
      showError('Please check the expiry date.');
      return;
    }
    if (cvv.length < 3) {
      addClass(fCvv, 'bad');
      showError('Please enter the 3 or 4 digit CVV.');
      return;
    }
    if (!token) {
      showError('This payment link has expired. Please close this window and try again.');
      return;
    }

    setBusy(true);
    sendPayment({
      source: {
        identifier: n,
        sourceholder_name: name,
        subtype: 'CARD',
        expiry_month: mm,
        expiry_year: yy,
        cvn: cvv
      },
      payment_token: token
    });
  });
}());
