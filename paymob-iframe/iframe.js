(function () {
  var $ = function (id) { return document.getElementById(id); };
  var form = $('ppForm'), card = $('ppCard'), err = $('ppError'), pay = $('ppPay');
  var fNum = $('fNum'), fName = $('fName'), fExp = $('fExp'), fCvv = $('fCvv');
  var token = new URLSearchParams(window.location.search).get('payment_token');

  function digits(v) { return String(v || '').replace(/\D/g, ''); }

  function brandOf(n) {
    if (/^4/.test(n)) return 'VISA';
    if (/^(5[1-5]|2[2-7])/.test(n)) return 'Mastercard';
    if (/^507803|^507808|^507809|^507810/.test(n)) return 'Meeza';
    if (/^3[47]/.test(n)) return 'AMEX';
    return '';
  }

  function luhn(n) {
    var sum = 0, alt = false;
    for (var i = n.length - 1; i >= 0; i--) {
      var d = +n[i];
      if (alt) { d *= 2; if (d > 9) d -= 9; }
      sum += d; alt = !alt;
    }
    return n.length >= 13 && sum % 10 === 0;
  }

  function showError(msg) {
    err.textContent = msg || '';
    if (msg) { form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake'); }
  }

  function setBusy(on) {
    pay.disabled = on;
    pay.classList.toggle('busy', on);
    [fNum, fName, fExp, fCvv].forEach(function (el) { el.disabled = on; });
  }

  // ---- live formatting + card preview ----
  fNum.addEventListener('input', function () {
    var n = digits(fNum.value).slice(0, 19);
    fNum.value = n.replace(/(.{4})/g, '$1 ').trim();
    var shown = (n + '################').slice(0, 16).replace(/#/g, '•');
    $('ppNum').textContent = shown.replace(/(.{4})/g, '$1 ').trim();
    $('ppBrand').textContent = brandOf(n);
    fNum.classList.remove('bad');
  });
  fName.addEventListener('input', function () {
    $('ppName').textContent = fName.value.trim() || 'YOUR NAME';
    fName.classList.remove('bad');
  });
  fExp.addEventListener('input', function (e) {
    var d = digits(fExp.value).slice(0, 4);
    if (d.length === 1 && +d > 1) d = '0' + d;
    var deleting = e.inputType && e.inputType.indexOf('delete') === 0;
    fExp.value = d.length > 2 || (d.length === 2 && !deleting) ? d.slice(0, 2) + ' / ' + d.slice(2) : d;
    $('ppExp').textContent = d.length ? (d.slice(0, 2) + '/' + (d.slice(2) || 'YY')) : 'MM/YY';
    fExp.classList.remove('bad');
  });
  fCvv.addEventListener('input', function () {
    fCvv.value = digits(fCvv.value).slice(0, 4);
    $('ppCvv').textContent = fCvv.value ? fCvv.value.replace(/./g, '•') : '•••';
    fCvv.classList.remove('bad');
  });
  fCvv.addEventListener('focus', function () { card.classList.add('flip'); });
  fCvv.addEventListener('blur', function () { card.classList.remove('flip'); });

  function done() {
    form.hidden = true;
    card.hidden = true;
    $('ppDone').hidden = false;
    try { window.parent.postMessage({ source: 'prime-paymob', status: 'paid' }, '*'); } catch (e) {}
  }

  // ---- submit straight to Paymob ----
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    showError('');
    var n = digits(fNum.value), exp = digits(fExp.value), cvv = digits(fCvv.value), name = fName.value.trim();
    var mm = exp.slice(0, 2), yy = exp.slice(2, 4);
    var now = new Date(), curYY = now.getFullYear() % 100, curMM = now.getMonth() + 1;

    if (!luhn(n)) { fNum.classList.add('bad'); return showError('Please check the card number.'); }
    if (name.length < 2) { fName.classList.add('bad'); return showError('Please enter the name on the card.'); }
    if (exp.length !== 4 || +mm < 1 || +mm > 12 || +yy < curYY || (+yy === curYY && +mm < curMM)) {
      fExp.classList.add('bad'); return showError('Please check the expiry date.');
    }
    if (cvv.length < 3) { fCvv.classList.add('bad'); return showError('Please enter the 3 or 4 digit CVV.'); }
    if (!token) return showError('This payment link has expired. Please close this window and try again.');

    setBusy(true);
    var host = location.hostname.indexOf('paymob.com') > -1 ? '' : 'https://accept.paymob.com';
    fetch(host + '/api/acceptance/payments/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: {
          identifier: n,
          sourceholder_name: name,
          subtype: 'CARD',
          expiry_month: mm,
          expiry_year: yy,
          cvn: cvv
        },
        payment_token: token
      })
    })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (res) {
        // 3-D Secure: continue to the bank's check page inside this same window.
        var next = res.redirection_url || res.redirect_url || res.iframe_redirection_url ||
          (res.data && (res.data.redirection_url || res.data.redirect_url));
        if (next) { window.location.href = next; return; }

        if (res.success === true || res.success === 'true') return done();

        setBusy(false);
        var msg = (res.data && (res.data.message || res.data.txn_response_code)) ||
          res.detail || res.message || '';
        if (msg && msg !== 'Approved') {
          showError('Payment was declined: ' + msg);
        } else {
          showError('Payment was not completed. Please check your card details or try another card.');
        }
      })
      .catch(function () {
        setBusy(false);
        showError('We could not reach the payment server. Please check your connection and try again.');
      });
  });
})();
