// ── CONFIG ────────────────────────────────────────────────────
var API = 'api';   // path to api/ folder relative to index.html

// ── STATE ─────────────────────────────────────────────────────
var currentUser = null;
var bk = { roomId:0, room:'', price:0, amenities:[], checkin:'', checkout:'', nights:0, guests:1,
           fn:'', ln:'', email:'', phone:'', req:'', cn:'', cnum:'', exp:'', cvv:'' };

// ═════════════════════════════════════════════════════════════
//  INIT
// ═════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', function() {
  initDates();
  initBookingButtons();
  initContact();
  checkSession();

  document.getElementById('btnOpenAuth').addEventListener('click', function() { openAuth(); });
  document.getElementById('btnCloseAuth').addEventListener('click', closeAuth);
  document.getElementById('authOverlay').addEventListener('click', function(e){ if(e.target===this) closeAuth(); });
  document.getElementById('btnLogin').addEventListener('click', doLogin);
  document.getElementById('btnRegister').addEventListener('click', doRegister);
  document.getElementById('lPassword').addEventListener('keydown', function(e){ if(e.key==='Enter') doLogin(); });

  document.getElementById('btnBack').addEventListener('click', closeBookingPage);
  document.getElementById('btnDone').addEventListener('click', closeBookingPage);
  document.getElementById('btnS1').addEventListener('click', goStep2);
  document.getElementById('btnS2').addEventListener('click', goStep3);
  document.getElementById('btnS2Back').addEventListener('click', function(){ goStep(0); });
  document.getElementById('btnS3Back').addEventListener('click', function(){ goStep(1); });
  document.getElementById('btnConfirm').addEventListener('click', confirmBooking);
  document.getElementById('checkAvailBtn').addEventListener('click', checkAvailability);

  // Card formatting
  document.getElementById('g-cnum').addEventListener('input', function(){
    var v = this.value.replace(/\D/g,'').substring(0,16);
    this.value = v.replace(/(.{4})/g,'$1 ').trim();
  });
  document.getElementById('g-exp').addEventListener('input', function(){
    var v = this.value.replace(/\D/g,'').substring(0,4);
    if(v.length>=2) v = v.substring(0,2)+'/'+v.substring(2);
    this.value = v;
  });
  document.getElementById('bp-checkin').addEventListener('change', updatePreview);
  document.getElementById('bp-checkout').addEventListener('change', updatePreview);
});

// ═════════════════════════════════════════════════════════════
//  SESSION CHECK
// ═════════════════════════════════════════════════════════════
function checkSession() {
  fetch(API+'/auth.php?action=me', {credentials:'include'})
    .then(function(r){ return r.json(); })
    .then(function(d){ if(d.ok) setLoggedIn(d.user); else setLoggedOut(); })
    .catch(function(){ setLoggedOut(); });
}

function setLoggedIn(user) {
  currentUser = user;
  var area = document.getElementById('navAuthArea');
  area.innerHTML =
    '<div class="d-flex align-items-center gap-2">'+
    '<span class="btn-nav-user"><i class="bi bi-person-circle me-1"></i>'+user.username+'</span>'+
    '<button class="btn-nav-login" id="btnLogout">Logout</button></div>';
  document.getElementById('btnLogout').addEventListener('click', doLogout);
  // Show book buttons normally
  document.querySelectorAll('.btn-book').forEach(function(b){ b.disabled=false; b.title=''; });
  document.querySelectorAll('.lock-note').forEach(function(l){ l.style.display='none'; });
}

function setLoggedOut() {
  currentUser = null;
  var area = document.getElementById('navAuthArea');
  area.innerHTML = '<button class="btn-nav-login" id="btnOpenAuth"><i class="bi bi-person me-1"></i>Login / Register</button>';
  document.getElementById('btnOpenAuth').addEventListener('click', function(){ openAuth(); });
  // Visually indicate login required for booking
  document.querySelectorAll('.btn-book').forEach(function(b){ b.disabled=false; });
  document.querySelectorAll('.lock-note').forEach(function(l){ l.style.display='block'; });
}

// ═════════════════════════════════════════════════════════════
//  AUTH MODAL
// ═════════════════════════════════════════════════════════════
var _pendingBook = null;

function openAuth(pendingBook) {
  if(pendingBook) _pendingBook = pendingBook;
  document.getElementById('authOverlay').classList.add('active');
  document.getElementById('authErr').style.display='none';
  switchTab('login');
}
function closeAuth() { document.getElementById('authOverlay').classList.remove('active'); }

function switchTab(tab) {
  document.getElementById('tabLogin').classList.toggle('active', tab==='login');
  document.getElementById('tabRegister').classList.toggle('active', tab==='register');
  document.getElementById('loginForm').style.display = tab==='login' ? '' : 'none';
  document.getElementById('registerForm').style.display = tab==='register' ? '' : 'none';
  document.getElementById('authErr').style.display = 'none';
}

function showAuthErr(msg) {
  var el = document.getElementById('authErr');
  el.textContent = msg; el.style.display = 'block';
}

function doLogin() {
  var btn = document.getElementById('btnLogin');
  var u = document.getElementById('lUsername').value.trim();
  var p = document.getElementById('lPassword').value;
  if(!u||!p){ showAuthErr('Please enter username and password.'); return; }
  btn.disabled=true; btn.textContent='Logging in…';
  fetch(API+'/auth.php?action=login', {
    method:'POST', credentials:'include',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({username:u, password:p})
  }).then(function(r){ return r.json(); })
    .then(function(d){
      btn.disabled=false; btn.textContent='Login';
      if(d.ok){
        if(d.redirect){ window.location.href = d.redirect; return; }
        closeAuth(); setLoggedIn(d.user);
        toast('Welcome back, '+d.user.username+'!');
        if(_pendingBook){ var pb=_pendingBook; _pendingBook=null; openBookingPage(pb); }
      } else { showAuthErr(d.error || 'Login failed.'); }
    })
    .catch(function(){ btn.disabled=false; btn.textContent='Login'; showAuthErr('Connection error.'); });
}

function doRegister() {
  var btn = document.getElementById('btnRegister');
  var u = document.getElementById('rUsername').value.trim();
  var e = document.getElementById('rEmail').value.trim();
  var p = document.getElementById('rPassword').value;
  if(!u||!e||!p){ showAuthErr('All fields are required.'); return; }
  btn.disabled=true; btn.textContent='Creating account…';
  fetch(API+'/auth.php?action=register', {
    method:'POST', credentials:'include',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({username:u, email:e, password:p})
  }).then(function(r){ return r.json(); })
    .then(function(d){
      btn.disabled=false; btn.textContent='Create Account';
      if(d.ok){
        closeAuth(); setLoggedIn(d.user);
        toast('Account created! Welcome, '+d.user.username+'!');
        if(_pendingBook){ var pb=_pendingBook; _pendingBook=null; openBookingPage(pb); }
      } else { showAuthErr(d.error || 'Registration failed.'); }
    })
    .catch(function(){ btn.disabled=false; btn.textContent='Create Account'; showAuthErr('Connection error.'); });
}

function doLogout() {
  fetch(API+'/auth.php?action=logout', {method:'POST', credentials:'include'})
    .then(function(){ setLoggedOut(); toast('You have been logged out.'); });
}

// ═════════════════════════════════════════════════════════════
//  MAIN DATE PICKERS
// ═════════════════════════════════════════════════════════════
function initDates() {
  var today = new Date(), tmrw = new Date();
  tmrw.setDate(today.getDate()+1);
  var ci=document.getElementById('checkin'), co=document.getElementById('checkout');
  ci.min=co.min=iso(today); ci.value=iso(today); co.min=iso(tmrw); co.value=iso(tmrw);
  ci.addEventListener('change', function(){
    var n=new Date(this.value); n.setDate(n.getDate()+1);
    co.min=iso(n); if(co.value && new Date(co.value)<=new Date(this.value)) co.value=iso(n);
  });
}

function checkAvailability() {
  var ci=document.getElementById('checkin').value;
  var co=document.getElementById('checkout').value;
  var res=document.getElementById('availResult');
  var today=new Date(); today.setHours(0,0,0,0);
  res.className='mt-3';

  if(!ci||!co){ res.className+=' alert alert-warning'; res.textContent='Please select both dates.'; res.classList.remove('d-none'); return; }
  if(new Date(ci)<today){ res.className+=' alert alert-warning'; res.textContent='Check-in cannot be in the past.'; res.classList.remove('d-none'); return; }
  if(new Date(co)<=new Date(ci)){ res.className+=' alert alert-warning'; res.textContent='Check-out must be after check-in.'; res.classList.remove('d-none'); return; }

  var nights=Math.round((new Date(co)-new Date(ci))/86400000);
  res.className='mt-3 alert alert-success';
  res.innerHTML='<i class="bi bi-check-circle me-1"></i>Dates available! '+nights+' night(s) from '+fmtDate(new Date(ci))+'. Scroll down to choose your room.';
  res.classList.remove('d-none');
  setTimeout(function(){ document.getElementById('rooms').scrollIntoView({behavior:'smooth'}); }, 400);
}

// ═════════════════════════════════════════════════════════════
//  BOOK BUTTONS
// ═════════════════════════════════════════════════════════════
function initBookingButtons() {
  document.querySelectorAll('.btn-book').forEach(function(btn){
    btn.addEventListener('click', function(){
      var data = {
        roomId: parseInt(this.dataset.roomId),
        room: this.dataset.room,
        price: parseInt(this.dataset.price),
        amenities: this.dataset.amenities.split(',')
      };
      if(!currentUser){
        openAuth(data);  // open login, then auto-open booking after
        toast('Please log in to make a reservation.');
      } else {
        openBookingPage(data);
      }
    });
  });
}

// ═════════════════════════════════════════════════════════════
//  BOOKING PAGE
// ═════════════════════════════════════════════════════════════
function openBookingPage(data) {
  bk.roomId = data.roomId; bk.room = data.room;
  bk.price = data.price; bk.amenities = data.amenities;

  var today=new Date(), tmrw=new Date(); tmrw.setDate(today.getDate()+1);
  var ci=document.getElementById('bp-checkin'), co=document.getElementById('bp-checkout');
  var mainIn=document.getElementById('checkin').value;
  var mainOut=document.getElementById('checkout').value;
  ci.min=iso(today); co.min=iso(tmrw);
  ci.value=mainIn||iso(today); co.value=mainOut||iso(tmrw);

  document.getElementById('bp-room').textContent = bk.room+' Room';
  document.getElementById('bp-price').textContent = '£'+bk.price+'/night';

  var amenEl = document.getElementById('bp-amenities');
  amenEl.innerHTML='';
  var icons={TV:'bi-tv',WiFi:'bi-wifi',Safe:'bi-safe',Radio:'bi-speaker'};
  bk.amenities.forEach(function(a){
    var c=document.createElement('span'); c.className='amenity-chip';
    c.innerHTML='<i class="bi '+(icons[a]||'bi-check')+'"></i>'+a;
    amenEl.appendChild(c);
  });

  updatePreview();
  goStep(0);
  document.getElementById('bookingPage').classList.add('active');
  document.body.style.overflow='hidden';
  document.getElementById('bookingPage').scrollTop=0;
}

function closeBookingPage() {
  document.getElementById('bookingPage').classList.remove('active');
  document.body.style.overflow='';
}

function goStep(n) {
  document.querySelectorAll('.step-panel').forEach(function(p,i){ p.classList.toggle('active',i===n); });
  for(var i=0;i<4;i++){
    var s=document.getElementById('si'+i);
    s.classList.remove('active','done');
    if(i<n) s.classList.add('done');
    if(i===n) s.classList.add('active');
  }
  document.getElementById('navStep').textContent='Step '+(n+1)+' of 4';
  document.getElementById('bookingPage').scrollTop=0;
}

function goStep2() {
  var ci=document.getElementById('bp-checkin').value;
  var co=document.getElementById('bp-checkout').value;
  var err=document.getElementById('dateErr');
  var today=new Date(); today.setHours(0,0,0,0);
  if(!ci||!co){ showEl(err,'Select both dates.'); return; }
  if(new Date(ci)<today){ showEl(err,'Check-in cannot be in the past.'); return; }
  if(new Date(co)<=new Date(ci)){ showEl(err,'Check-out must be after check-in.'); return; }
  var n=Math.round((new Date(co)-new Date(ci))/86400000);
  if(n<1){ showEl(err,'Minimum 1 night.'); return; }
  err.classList.add('d-none');
  bk.checkin=ci; bk.checkout=co; bk.nights=n;
  bk.guests=document.getElementById('bp-guests').selectedIndex+1;
  goStep(1);
}

function goStep3() {
  var ok=true;
  function req(id, test){
    var el=document.getElementById(id), v=el.value.trim();
    var pass=test?test(v):v.length>0;
    el.classList.toggle('is-invalid',!pass); if(!pass) ok=false; return v;
  }
  bk.fn   = req('g-fn');
  bk.ln   = req('g-ln');
  bk.email= req('g-email',function(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);});
  bk.phone= req('g-phone',function(v){return /^[0-9\s\-\+]{7,15}$/.test(v);});
  bk.cn   = req('g-cn');
  bk.cnum = req('g-cnum',function(v){return v.replace(/\s/g,'').length===16;});
  bk.exp  = req('g-exp',function(v){return /^\d{2}\/\d{2}$/.test(v);});
  bk.cvv  = req('g-cvv',function(v){return /^\d{3,4}$/.test(v);});
  bk.req  = document.getElementById('g-req').value.trim();

  var payErr=document.getElementById('payErr');
  if(!ok){ showEl(payErr,'Please fix the errors above.'); return; }
  payErr.classList.add('d-none');

  var sub=bk.price*bk.nights, tax=Math.round(sub*.1), total=sub+tax;
  document.getElementById('cs-room').textContent  = bk.room+' Room';
  document.getElementById('cs-guest').textContent = bk.fn+' '+bk.ln;
  document.getElementById('cs-in').textContent    = fmtDate(new Date(bk.checkin));
  document.getElementById('cs-out').textContent   = fmtDate(new Date(bk.checkout));
  document.getElementById('cs-guests').textContent= bk.guests+' guest'+(bk.guests>1?'s':'');
  document.getElementById('cs-req').textContent   = bk.req||'None';
  document.getElementById('cs-nl').textContent    = bk.nights+' night'+(bk.nights>1?'s':'')+' × £'+bk.price+'/night';
  document.getElementById('cs-sub').textContent   = '£'+sub;
  document.getElementById('cs-tax').textContent   = '£'+tax;
  document.getElementById('cs-total').textContent = '£'+total;
  goStep(2);
}

function confirmBooking() {
  var btn=document.getElementById('btnConfirm');
  var err=document.getElementById('confirmErr');
  btn.disabled=true;
  btn.innerHTML='<span class="spinner-border spinner-border-sm me-2"></span>Processing…';

  fetch(API+'/bookings.php', {
    method:'POST', credentials:'include',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
      room_id: bk.roomId, checkin: bk.checkin, checkout: bk.checkout,
      guests: bk.guests, firstname: bk.fn, lastname: bk.ln,
      email: bk.email, phone: bk.phone, requests: bk.req
    })
  }).then(function(r){ return r.json(); })
    .then(function(d){
      btn.disabled=false;
      btn.innerHTML='<i class="bi bi-lock-fill me-1"></i>Confirm Booking';
      if(d.ok){
        var b=d.booking;
        document.getElementById('successRef').textContent = b.reference;
        document.getElementById('ss-room').textContent    = b.room;
        document.getElementById('ss-in').textContent      = fmtDateShort(new Date(b.checkin));
        document.getElementById('ss-total').textContent   = '£'+Math.round(b.total);
        goStep(3);
      } else {
        showEl(err, d.error||'Booking failed. Please try again.');
      }
    })
    .catch(function(){
      btn.disabled=false;
      btn.innerHTML='<i class="bi bi-lock-fill me-1"></i>Confirm Booking';
      showEl(err,'Connection error. Please try again.');
    });
}

function updatePreview() {
  var ci=document.getElementById('bp-checkin').value;
  var co=document.getElementById('bp-checkout').value;
  if(ci && co){
    var n=Math.round((new Date(co)-new Date(ci))/86400000);
    if(n>0){
      document.getElementById('pc-in').textContent    = fmtDateShort(new Date(ci));
      document.getElementById('pc-nights').textContent= n;
      document.getElementById('pc-total').textContent = '£'+(bk.price*n);
      return;
    }
  }
  document.getElementById('pc-in').textContent='—';
  document.getElementById('pc-nights').textContent='—';
  document.getElementById('pc-total').textContent='—';
}

// ═════════════════════════════════════════════════════════════
//  CONTACT FORM
// ═════════════════════════════════════════════════════════════
function initContact() {
  document.getElementById('btnContact').addEventListener('click', function(){
    var n=document.getElementById('cName').value.trim();
    var e=document.getElementById('cEmail').value.trim();
    var p=document.getElementById('cPhone').value.trim();
    var s=document.getElementById('cSubject').value.trim();
    var m=document.getElementById('cMessage').value.trim();
    var errEl=document.getElementById('cFormErr');
    var okEl=document.getElementById('cFormOk');

    if(n.length<3){     showAlert(errEl,'Name must be at least 3 characters.'); return; }
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)){ showAlert(errEl,'Invalid email.'); return; }
    if(!/^[0-9\s\-\+]{7,15}$/.test(p)){ showAlert(errEl,'Invalid phone.'); return; }
    if(s.length<5){     showAlert(errEl,'Subject must be at least 5 characters.'); return; }
    if(m.length<20){    showAlert(errEl,'Message must be at least 20 characters.'); return; }

    errEl.classList.add('d-none');
    this.disabled=true; this.textContent='Sending…';
    var self=this;
    fetch(API+'/contact.php', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({name:n, email:e, phone:p, subject:s, message:m})
    }).then(function(r){ return r.json(); })
      .then(function(d){
        self.disabled=false; self.textContent='Send Message';
        if(d.ok){
          showAlert(okEl,'✅ Message sent! We will reply within 24 hours.');
          errEl.classList.add('d-none');
          ['cName','cEmail','cPhone','cSubject','cMessage'].forEach(function(id){ document.getElementById(id).value=''; });
        } else { showAlert(errEl, d.error||'Send failed.'); }
      })
      .catch(function(){ self.disabled=false; self.textContent='Send Message'; showAlert(errEl,'Connection error.'); });
  });
}

// ═════════════════════════════════════════════════════════════
//  HELPERS
// ═════════════════════════════════════════════════════════════
function iso(d){ return d.toISOString().split('T')[0]; }
function fmtDate(d){ return d.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}); }
function fmtDateShort(d){ return d.toLocaleDateString('en-GB',{day:'numeric',month:'short'}); }
function showEl(el,msg){ el.textContent=msg; el.classList.remove('d-none'); }
function showAlert(el,msg){ el.textContent=msg; el.classList.remove('d-none'); }

function toast(msg, dur) {
  var wrap=document.getElementById('toastWrap');
  var t=document.createElement('div'); t.className='toast-msg'; t.textContent=msg;
  wrap.appendChild(t);
  setTimeout(function(){ t.remove(); }, dur||3500);
}