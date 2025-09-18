document.addEventListener('DOMContentLoaded', function(){
  const grid = document.getElementById('roomGrid');

  const allRooms = [
    {id:'101', price:100000, img:'images/p1.jpg'},
    {id:'102', price:100000, img:'images/p2.jpg'},
    {id:'103', price:120000, img:'images/p3.jpg'},
    {id:'104', price:150000, img:'images/p4.jpg'},
    {id:'105', price:170000, img:'images/p5.jpg'},
    {id:'106', price:180000, img:'images/p6.jpg'},
    {id:'107', price:190000, img:'images/p7.jpg'}
  ];

  const bookings = read('hm_bookings', []); // dùng read trong app.js
  const now = new Date();

  grid.innerHTML = '';
  allRooms.forEach(r => {
    const occupied = bookings.some(b =>
      b.room === r.id &&
      new Date(b.checkin) <= now &&
      now < new Date(b.checkout)
    );

    const card = document.createElement('div');
    card.className = 'room-card';
    card.innerHTML = `
      <img src="${r.img}" alt="Phòng ${r.id}">
      <h3>Phòng ${r.id}</h3>
      <div class="price">${toVND(r.price)}</div>
      <div class="status ${occupied ? 'busy' : 'free'}">
        ${occupied ? 'Đang có khách' : 'Trống'}
      </div>
    `;
    grid.appendChild(card);
  });
});
