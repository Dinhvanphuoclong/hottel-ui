
const LS_KEYS = {
  users: 'hm_users',
  current: 'hm_user',
  bookings: 'hm_bookings',
  customers: 'hm_customers',
  services: 'hm_services',
  invoices: 'hm_invoices',
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const fmtDate = (s) => new Date(s).toLocaleString('vi-VN');
const toVND = (n) => Number(n || 0).toLocaleString('vi-VN') + ' đ';

// localStorage helpers (an toàn JSON)
const read = (k, d = []) => { try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(d)); } catch { return structuredClone(d); } };
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

/****************** AUTH / USERS ******************/
function loadUsers(){ return read(LS_KEYS.users); }
function saveUsers(list){ write(LS_KEYS.users, list); }
function getCurrent(){ return localStorage.getItem(LS_KEYS.current); }
function setCurrent(u){ u ? localStorage.setItem(LS_KEYS.current, u) : localStorage.removeItem(LS_KEYS.current); }
function getRole(user){ const u = loadUsers().find(x => x.u === user); return u?.role || 'staff'; }
function setRole(user, role){ const list = loadUsers(); const i = list.findIndex(x=>x.u===user); if(i>=0){ list[i].role = role; saveUsers(list);} }

// seed admin/admin (idempotent)
(function seedAdmin(){
  const users = loadUsers();
  if(!users.find(x => x.u === 'admin')){
    users.push({ u:'admin', p:'admin', role:'admin' });
    saveUsers(users);
  }
})();

/****************** DATA LAYER ******************/
const loadBookings = () => read(LS_KEYS.bookings);
const saveBookings = (list) => write(LS_KEYS.bookings, list);
const loadCustomers = () => read(LS_KEYS.customers);
const saveCustomers = (list) => write(LS_KEYS.customers, list);
const loadServices  = () => read(LS_KEYS.services);
const saveServices  = (list) => write(LS_KEYS.services, list);
const loadInvoices  = () => read(LS_KEYS.invoices);
const saveInvoices  = (list) => write(LS_KEYS.invoices, list);

/****************** NAV ACTIVE ******************/
(function navActive(){
  const map = {
    'index.html':'nav-home',
    'history.html':'nav-history',
    'services.html':'nav-services',
    'customers.html':'nav-customers',
    'account.html':'nav-account',
    'stats.html':'nav-stats',
  };
  const file = location.pathname.split('/').pop() || 'index.html';
  document.getElementById(map[file] || 'nav-home')?.classList.add('active');
})();

/****************** AUTH UI ******************/
const helloUser = $('#helloUser');
const btnOpenLogin = $('#btnOpenLogin');
const btnOpenRegister = $('#btnOpenRegister');
const btnLogout = $('#btnLogout');
const loginModal = $('#loginModal');
const registerModal = $('#registerModal');

function refreshAuthUI(){
  const user = getCurrent();
  const adminToggleWrap = $('#adminToggleWrap');
  if(user){
    if(helloUser) helloUser.textContent = `👤 ${user} (${getRole(user)})`;
    btnLogout?.classList.remove('hidden');
    btnOpenLogin?.classList.add('hidden');
    btnOpenRegister?.classList.add('hidden');
    adminToggleWrap?.classList.toggle('hidden', getRole(user) !== 'admin');
    const accWho = $('#accWho'); if(accWho) accWho.textContent = `${user} (${getRole(user)})`;
  } else {
    if(helloUser) helloUser.textContent = 'Chưa đăng nhập';
    btnLogout?.classList.add('hidden');
    btnOpenLogin?.classList.remove('hidden');
    btnOpenRegister?.classList.remove('hidden');
    adminToggleWrap && adminToggleWrap.classList.add('hidden');
    const accWho = $('#accWho'); if(accWho) accWho.textContent = '—';
  }
}
refreshAuthUI();

// mở/đóng modal cơ bản (tối giản)
btnOpenLogin && (btnOpenLogin.onclick = ()=> loginModal?.classList.remove('hidden'));
btnOpenRegister && (btnOpenRegister.onclick = ()=> registerModal?.classList.remove('hidden'));
$('#closeLogin')?.addEventListener('click', ()=> loginModal?.classList.add('hidden'));
$('#closeRegister')?.addEventListener('click', ()=> registerModal?.classList.add('hidden'));
btnLogout && (btnLogout.onclick = ()=>{ setCurrent(null); refreshAll(); });

// Đăng nhập
$('#doLogin')?.addEventListener('click', ()=>{
  const u = $('#lgUser')?.value?.trim();
  const p = $('#lgPass')?.value || '';
  const ok = loadUsers().find(x => x.u === u && x.p === p);
  if(!ok) return alert('Sai tên đăng nhập hoặc mật khẩu');
  setCurrent(u); loginModal?.classList.add('hidden'); refreshAll();
});

// Đăng ký
$('#doRegister')?.addEventListener('click', ()=>{
  const u = $('#rgUser')?.value?.trim() || '';
  const p1 = $('#rgPass')?.value || '';
  const p2 = $('#rgPass2')?.value || '';
  if(u.length < 3) return alert('Tên đăng nhập phải ≥ 3 ký tự');
  if(p1.length < 4) return alert('Mật khẩu phải ≥ 4 ký tự');
  if(p1 !== p2) return alert('Mật khẩu nhập lại không khớp');
  const users = loadUsers();
  if(users.find(x=>x.u===u)) return alert('Tên đăng nhập đã tồn tại');
  users.push({ u, p:p1, role:'staff' });
  saveUsers(users);
  alert('Đăng ký thành công! Hãy đăng nhập.');
  registerModal?.classList.add('hidden');
});

/****************** INDEX (ĐẶT PHÒNG) ******************/
(function initHome(){
  if(!$('#btnBook')) return;
  let selected = null;

  // chọn phòng
  $$('.select-room').forEach(btn => {
    btn.addEventListener('click', (e)=>{
      $$('.room').forEach(r=> r.classList.remove('selected'));
      const card = e.currentTarget.closest('.room');
      card.classList.add('selected');
      selected = { id: card.dataset.roomId, price: parseInt(card.dataset.price, 10) || 0 };
    });
  });

  // render checkbox dịch vụ (nếu có dữ liệu)
  (function renderServiceChoices(){
    const host = $('#servicesWrapper') || $('#servicesList') || $('.form-box');
    if(!host) return;
    // tránh render trùng
    if($('#_svcRendered')) return;

    const svcs = loadServices();
    if(!svcs.length) return;

    const wrap = document.createElement('div');
    wrap.id = '_svcRendered';
    wrap.className = 'services-checkbox';

    const title = document.createElement('p');
    title.textContent = 'Chọn dịch vụ (tùy chọn):';
    wrap.appendChild(title);

    svcs.forEach(s => {
      const row = document.createElement('div');
      row.innerHTML = `<label><input type="checkbox" value="${s.name}" data-price="${s.price}"> ${s.name} (${toVND(s.price)})</label>`;
      wrap.appendChild(row);
    });

    host.appendChild(wrap);
  })();

  // ràng buộc thời gian
  const checkin = $('#checkin');
  const checkout = $('#checkout');
  if(checkin && checkout){
    checkin.addEventListener('change', ()=>{
      if(new Date(checkout.value) <= new Date(checkin.value)) checkout.value = '';
    });
  }

  // đặt phòng
  $('#btnBook').addEventListener('click', ()=>{
    const user = getCurrent();
    if(!user) return alert('Bạn cần đăng nhập để đặt phòng.');
    if(!selected) return alert('Vui lòng chọn 1 phòng.');

    const ci = new Date(checkin?.value);
    const co = new Date(checkout?.value);
    if(isNaN(ci) || isNaN(co) || co <= ci) return alert('Thời gian không hợp lệ.');

    const guests = $('#guests')?.value;
    const roomsCount = $('#roomsCount')?.value;

    const all = loadBookings();
    const overlap = (aStart,aEnd,bStart,bEnd)=> aStart < bEnd && aEnd > bStart;
    const conflict = all.some(b => b.room === selected.id && overlap(ci, co, new Date(b.checkin), new Date(b.checkout)));
    if(conflict) return alert('Phòng đã có người đặt trong khoảng thời gian này.');

    const nights = Math.max(1, Math.ceil((co-ci)/(1000*60*60*24)));

    let total = selected.price * nights * (roomsCount?.includes('2') ? 2 : 1);
    const svcChecked = $$('.services-checkbox input:checked');
    const totalServices = svcChecked.reduce((sum, cb)=> sum + (parseInt(cb.dataset.price||'0',10)), 0);
    total += totalServices;

    const id = Date.now().toString(36);
    all.push({
      id,
      user,
      room: selected.id,
      checkin: ci.toISOString(),
      checkout: co.toISOString(),
      guests,
      roomsCount,
      nights,
      total,
      services: svcChecked.map(cb=> cb.value),
    });
    saveBookings(all);
    alert('Đặt phòng thành công!');
  });
})();

/****************** ROOM DETAILS MODAL ******************/
(function initRoomModal(){
  const modal = $('#roomModal'); if(!modal) return;
  const roomName = $('#roomName');
  const roomDesc = $('#roomDesc');
  const roomBeds = $('#roomBeds');
  const roomFeatures = $('#roomFeatures');
  const roomPrice = $('#roomPrice');
  const closeBtn = $('#closeRoomModal');

  $$('.room img, .room b').forEach(el=>{
    el.addEventListener('click', (e)=>{
      const card = e.currentTarget.closest('.room');
      roomName.textContent = card.querySelector('b').textContent;
      roomPrice.textContent = card.dataset.price;
      roomDesc.textContent = 'Phòng tiện nghi, sạch sẽ';
      roomBeds.textContent = '2 giường';
      roomFeatures.textContent = 'Wifi, TV, minibar';
      modal.classList.remove('hidden');
    });
  });

  closeBtn && (closeBtn.onclick = ()=> modal.classList.add('hidden'));
})();

/****************** HISTORY ******************/
(function initHistory(){
  const historyBody = $('#historyBody');
  if(!historyBody) return;

  const showAll = $('#showAll');
  const historyHint = $('#historyHint');

  function render(){
    const user = getCurrent();
    const all = loadBookings();
    const rows = (user === 'admin' && showAll && showAll.checked) ? all : (user ? all.filter(b=> b.user === user) : []);

    historyBody.innerHTML = '';
    if(!rows.length){
      historyHint && (historyHint.style.display = 'block');
      return;
    }
    historyHint && (historyHint.style.display = 'none');

    rows.sort((a,b)=> new Date(b.checkin) - new Date(a.checkin));

    for(const b of rows){
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${b.user}</td>
        <td>${b.room}</td>
        <td>${fmtDate(b.checkin)}</td>
        <td>${fmtDate(b.checkout)}</td>
        <td>${b.guests||''}</td>
        <td>${b.roomsCount||''}</td>
        <td>${(b.services||[]).join(', ')}</td>
        <td>${toVND(b.total)}</td>
        <td>
          <button class="btn link" data-inv="${b.id}">Xuất HĐ</button>
          <button class="btn link danger" data-cancel="${b.id}">Hủy</button>
          <button class="btn link warn" data-checkout="${b.id}">Trả sớm</button>
        </td>`;
      historyBody.appendChild(tr);
    }

    // hủy
    $$('[data-cancel]', historyBody).forEach(btn =>{
      btn.onclick = (e)=>{
        const id = e.currentTarget.getAttribute('data-cancel');
        const list = loadBookings();
        const i = list.findIndex(x=> x.id === id);
        if(i<0) return;
        const curr = getCurrent();
        if(curr !== 'admin' && list[i].user !== curr) return alert('Bạn không có quyền hủy');
        if(confirm('Hủy đặt phòng này?')){
          list.splice(i,1); saveBookings(list); render(); renderStats();
        }
      };
    });

    // xuất hóa đơn
    $$('[data-inv]', historyBody).forEach(btn =>{
      btn.onclick = (e)=>{
        const id = e.currentTarget.getAttribute('data-inv');
        const list = loadBookings();
        const bk = list.find(x=> x.id === id); if(!bk) return;
        createInvoiceFromBooking(bk);
        alert('Đã tạo hoá đơn!');
        renderStats();
      };
    });
    
  }
  // trả sớm
// ===== Trả sớm (dùng event delegation, không sợ mất listener) =====
historyBody.addEventListener('click', function(e){
  const btn = e.target.closest('[data-checkout]');
  if (!btn) return; // click không phải nút trả sớm

  const id = btn.getAttribute('data-checkout');
  const list = loadBookings();
  const i = list.findIndex(x => x.id === id);
  if (i < 0) return;

  const curr = getCurrent();
  if (curr !== 'admin' && list[i].user !== curr) {
    alert('Bạn không có quyền chỉnh booking này');
    return;
  }

  const today = new Date();
  const bk = list[i];
  const oldCo = new Date(bk.checkout);

  if (today >= oldCo) {
    alert('Đã quá hạn, không thể trả sớm.');
    return;
  }

  if (confirm(`Trả phòng sớm ngay hôm nay (${fmtDate(today)})?`)) {
    // cập nhật checkout về hôm nay
    bk.checkout = today.toISOString();

    // tính lại số đêm và tiền
    const ci = new Date(bk.checkin);
    const nights = Math.max(1, Math.ceil((today - ci) / (1000 * 60 * 60 * 24)));
    bk.nights = nights;

    // dùng unitPrice và servicesTotal nếu có, fallback sang total cũ
    const unitPrice = bk.unitPrice || 0;
    const servicesTotal = bk.servicesTotal || 0;
    bk.total = unitPrice * nights + servicesTotal;

    saveBookings(list);
    render();        // refresh lại bảng lịch sử
    renderStats();   // refresh thống kê
    alert('Trả phòng sớm thành công!');
  }
});




  showAll && showAll.addEventListener('change', render);

  $('#exportCSV')?.addEventListener('click', ()=>{
    const user = getCurrent(); if(!user) return alert('Hãy đăng nhập trước.');
    const all = loadBookings();
    const rows = (user === 'admin' && showAll && showAll.checked) ? all : all.filter(b=> b.user === user);
    if(!rows.length) return alert('Không có dữ liệu để xuất.');

    const header = ['Người dùng','Phòng','Nhận','Trả','Số khách','Số phòng','Dịch vụ','Thành tiền'];
    const data = rows.map(b => [b.user, b.room, fmtDate(b.checkin), fmtDate(b.checkout), b.guests, b.roomsCount, (b.services||[]).join(', '), b.total]);
    const csv = [header, ...data].map(r => r.map(v => `"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'lich_su_dat_phong.csv'; a.click(); URL.revokeObjectURL(url);
  });

  render();
})();

/****************** INVOICES + STATS ******************/
function createInvoiceFromBooking(bk){
  const invs = loadInvoices();
  const code = 'INV' + Date.now().toString(36).toUpperCase();
  invs.push({ id: code, guest: bk.user, room: bk.room, nights: bk.nights, amount: bk.total, issuedAt: new Date().toISOString() });
  saveInvoices(invs);
}

function renderStats(){
  const invs = loadInvoices();
  const revenue = invs.reduce((s,v)=> s + (v.amount||0), 0);
  const bks = loadBookings();
  const now = new Date();
  const occ = bks.filter(b => new Date(b.checkin) <= now && now < new Date(b.checkout)).length;

  const elR = $('#statRevenue'); if(elR) elR.textContent = toVND(revenue);
  const elB = $('#statBookings'); if(elB) elB.textContent = bks.length;
  const elO = $('#statOccupied'); if(elO) elO.textContent = occ;
}
renderStats();

/****************** SERVICES ******************/
(function initServices(){
  const tbl = $('#tblServices'); if(!tbl) return;
  function render(){
    const list = loadServices(); tbl.innerHTML = '';
    list.forEach(s =>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${s.name}</td><td>${toVND(s.price)}</td><td><button class="btn link danger" data-del="${s.name}">Xoá</button></td>`;
      tbl.appendChild(tr);
    });
    $$('[data-del]', tbl).forEach(btn =>{
      btn.onclick = (e)=>{
        const id = e.currentTarget.getAttribute('data-del');
        const list = loadServices();
        const i = list.findIndex(x=> x.name === id);
        if(i<0) return; if(confirm('Xoá dịch vụ này?')){ list.splice(i,1); saveServices(list); render(); }
      };
    });
  }

  $('#btnAddSvc')?.addEventListener('click', ()=>{
    const name = $('#svcName')?.value?.trim();
    const price = parseInt($('#svcPrice')?.value || '0', 10);
    if(!name || price <= 0) return alert('Nhập tên dịch vụ và giá > 0');
    const list = loadServices();
    const i = list.findIndex(s => s.name.toLowerCase() === name.toLowerCase());
    if(i>=0) list[i].price = price; else list.push({ name, price });
    saveServices(list); render(); $('#svcName').value=''; $('#svcPrice').value='';
  });

  render();
})();

/****************** CUSTOMERS ******************/
(function initCustomers(){
  const tbl = $('#tblCustomers'); if(!tbl) return;
  const cName = $('#cName');
  const cPhone = $('#cPhone');
  const cEmail = $('#cEmail');
  const cNote = $('#cNote');

  function render(){
    const list = loadCustomers(); tbl.innerHTML = '';
    list.forEach(c =>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${c.name}</td><td>${c.phone}</td><td>${c.email||''}</td><td>${c.note||''}</td>`;
      tr.onclick = ()=>{ cName.value=c.name; cPhone.value=c.phone; cEmail.value=c.email||''; cNote.value=c.note||''; };
      tbl.appendChild(tr);
    });
  }

  $('#btnSaveCustomer')?.addEventListener('click', ()=>{
    const c = { name: cName.value.trim(), phone: cPhone.value.trim(), email: cEmail.value.trim(), note: cNote.value.trim() };
    if(!c.name || !c.phone) return alert('Cần họ tên & điện thoại');
    const list = loadCustomers();
    const i = list.findIndex(x => x.phone === c.phone);
    if(i>=0) list[i] = c; else list.push(c);
    saveCustomers(list); render();
  });

  $('#btnClearCustomer')?.addEventListener('click', ()=>{ [cName,cPhone,cEmail,cNote].forEach(el => el.value = ''); });

  $('#btnDeleteCustomer')?.addEventListener('click', ()=>{
    const phone = cPhone.value.trim(); if(!phone) return alert('Nhập SĐT để xoá');
    const list = loadCustomers();
    const i = list.findIndex(x => x.phone === phone);
    if(i<0) return alert('Không tìm thấy');
    if(confirm('Xoá khách hàng này?')){ list.splice(i,1); saveCustomers(list); render(); [cName,cPhone,cEmail,cNote].forEach(el => el.value = ''); }
  });

  render();
})();

/****************** ACCOUNT ******************/
(function initAccount(){
  const accWho = $('#accWho'); if(!accWho) return;
  const me = getCurrent();
  accWho.textContent = me ? `${me} (${getRole(me)})` : '—';

  $('#btnChangePw')?.addEventListener('click', ()=>{
    const me = getCurrent(); if(!me) return alert('Bạn cần đăng nhập');
    const old = $('#pwOld')?.value || '';
    const p1  = $('#pwNew')?.value || '';
    const p2  = $('#pwNew2')?.value || '';
    const users = loadUsers(); const i = users.findIndex(u => u.u === me);
    if(i<0) return alert('Lỗi tài khoản');
    if(users[i].p !== old) return alert('Mật khẩu hiện tại không đúng');
    if(p1.length < 4) return alert('Mật khẩu mới ≥ 4 ký tự');
    if(p1 !== p2) return alert('Nhập lại mật khẩu không khớp');
    users[i].p = p1; saveUsers(users);
    $('#pwOld').value = $('#pwNew').value = $('#pwNew2').value = '';
    alert('Đổi mật khẩu thành công');
  });

  const tblRoles = $('#tblRoles');
  function renderRoles(){
    const users = loadUsers(); tblRoles.innerHTML='';
    users.forEach(u =>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${u.u}</td><td>${u.role||'staff'}</td>`;
      tblRoles.appendChild(tr);
    });
  }

  $('#btnSetRole')?.addEventListener('click', ()=>{
    const me = getCurrent(); if(getRole(me) !== 'admin') return alert('Chỉ admin mới gán quyền');
    const user = $('#accUser')?.value?.trim();
    const role = $('#accRole')?.value;
    if(!user) return alert('Nhập username');
    const users = loadUsers(); const i = users.findIndex(x=> x.u === user);
    if(i<0) return alert('Không tìm thấy user');
    users[i].role = role; saveUsers(users); renderRoles(); refreshAuthUI();
  });

  renderRoles();
})();

/****************** STATS PAGE BOOTSTRAP ******************/
(function initStats(){ if($('#statRevenue')) renderStats(); })();

/****************** REFRESH ALL ******************/
function refreshAll(){
  refreshAuthUI();
  if($('#historyBody')){ const ev = new Event('change'); $('#showAll')?.dispatchEvent(ev); }
  renderStats();
  
}

