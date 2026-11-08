(()=> {
  const $=id=>document.getElementById(id);
  const fmt=n=>new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(Number(n)||0);
  const packages=[
    {amount:50000,label:'Khởi đầu'},
    {amount:100000,label:'Phổ biến'},
    {amount:200000,label:'Tiết kiệm'},
    {amount:500000,label:'Cao cấp'},
    {amount:1000000,label:'Đại gia'}
  ];
  const rate=1000;
  let activeOrder=null,pollTimer=0,history=[];
  const api=()=>window.maidEmpireCloud;
  const status=t=>{const el=$('topupStatus');if(el)el.textContent=t};
  function installSuccessStyles(){
    if($('paymentSuccessStyles'))return;
    const style=document.createElement('style');style.id='paymentSuccessStyles';
    style.textContent=`
      .payment-success-overlay{position:fixed;inset:0;z-index:10050;display:grid;place-items:center;padding:20px;background:rgba(8,5,12,.78);backdrop-filter:blur(8px);animation:payFadeIn .25s ease both}
      .payment-success-card{position:relative;isolation:isolate;overflow:hidden;width:min(100%,390px);padding:30px 24px 24px;text-align:center;color:#f8f2e8;background:linear-gradient(145deg,#25172a,#15101c 70%);border:1px solid rgba(224,190,117,.65);border-radius:22px;box-shadow:0 24px 90px #0009,0 0 45px #d9aa5030;animation:payPop .48s cubic-bezier(.18,.9,.25,1.2) both}
      .payment-success-card:before{content:"";position:absolute;inset:-60% -30% auto;height:210px;background:radial-gradient(ellipse,rgba(221,177,91,.2),transparent 68%);z-index:-1}
      .payment-success-icon{display:grid;place-items:center;width:82px;height:82px;margin:0 auto 16px;border-radius:50%;font-size:42px;color:#172016;background:linear-gradient(145deg,#c9f6b5,#72d99a);box-shadow:0 0 0 8px #85e5a522,0 0 40px #6de69a66;animation:payCheck .65s .15s both}
      .payment-success-card h2{margin:8px 0;color:#f2d18c;font-size:25px;letter-spacing:.02em}
      .payment-success-card p{margin:8px 0;color:#d4c7d4;line-height:1.6}
      .payment-success-amount{margin:18px 0 14px;padding:13px;border:1px solid #caa45b55;border-radius:12px;background:#caa45b12}
      .payment-success-amount strong{display:block;color:#f6d58d;font-size:26px}
      .payment-success-bonuses{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:12px 0 20px}
      .payment-success-bonuses div{padding:11px 7px;border-radius:10px;background:#ffffff0a;border:1px solid #ffffff12}
      .payment-success-bonuses b{display:block;color:#e8c078;font-size:18px;margin-top:3px}
      .payment-success-close{width:100%;min-height:46px;border:0;border-radius:10px;background:linear-gradient(110deg,#d9b36d,#a77b39);color:#21170e;font-weight:900;letter-spacing:.08em;cursor:pointer}
      .payment-confetti{position:absolute;inset:0;overflow:hidden;pointer-events:none}
      .payment-confetti i{position:absolute;top:-14px;left:var(--x);width:7px;height:12px;border-radius:2px;background:var(--c);animation:payConfetti var(--d) var(--delay) ease-in forwards;transform:rotate(var(--r))}
      @keyframes payFadeIn{from{opacity:0}to{opacity:1}}
      @keyframes payPop{from{opacity:0;transform:translateY(18px) scale(.88)}to{opacity:1;transform:translateY(0) scale(1)}}
      @keyframes payCheck{0%{transform:scale(.3) rotate(-25deg);opacity:0}70%{transform:scale(1.13) rotate(5deg)}100%{transform:scale(1) rotate(0);opacity:1}}
      @keyframes payConfetti{to{transform:translate3d(var(--drift),110vh,0) rotate(720deg);opacity:.15}}
      @media(prefers-reduced-motion:reduce){.payment-success-overlay,.payment-success-card,.payment-success-icon,.payment-confetti i{animation:none!important}}
      body.reduced-motion .payment-success-overlay,body.reduced-motion .payment-success-card,body.reduced-motion .payment-success-icon,body.reduced-motion .payment-confetti i{animation:none!important}
    `;
    document.head.appendChild(style);
  }
  function showPaymentSuccess(order){
    installSuccessStyles();
    $('paymentSuccessOverlay')?.remove();
    const amount=Number(order.amount)||0,credit=Number(order.creditAmount)||amount*rate;
    const reputation=Number(order.reputationGain??Math.floor(amount/100000))||0;
    const influence=Number(order.influenceGain??Math.floor(amount/500000))||0;
    const overlay=document.createElement('div');overlay.id='paymentSuccessOverlay';overlay.className='payment-success-overlay';
    overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','paymentSuccessTitle');
    const pieces=Array.from({length:34},(_,i)=>'<i style="--x:'+((i*37)%100)+'%;--c:'+['#f5d78b','#8ee0ad','#d9a6ed','#f18b9a'][i%4]+';--d:'+(2.2+(i%7)*.22)+'s;--delay:'+(i%9)*.07+'s;--r:'+(i*41)+'deg;--drift:'+(((i*19)%140)-70)+'px"></i>').join('');
    overlay.innerHTML='<div class="payment-success-card"><div class="payment-confetti" aria-hidden="true">'+pieces+'</div><div class="payment-success-icon" aria-hidden="true">✓</div><span class="tag">GIAO DỊCH ĐÃ ĐỐI SOÁT</span><h2 id="paymentSuccessTitle">Thanh toán thành công!</h2><p>SePay đã xác nhận giao dịch. Quyền lợi đã được cập nhật vào đế chế của bạn.</p><div class="payment-success-amount"><small>TIỀN ĐÃ THANH TOÁN</small><strong>'+fmt(amount)+'</strong><small>TIỀN GAME ĐÃ CỘNG: '+fmt(credit)+'</small></div><div class="payment-success-bonuses"><div>Danh tiếng<b>+'+reputation+'</b></div><div>Ảnh hưởng<b>+'+influence+'</b></div></div><button type="button" class="payment-success-close">TIẾP TỤC ĐIỀU HÀNH</button></div>';
    document.body.appendChild(overlay);
    const close=()=>overlay.remove();
    overlay.querySelector('.payment-success-close').addEventListener('click',close);
    overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
    document.addEventListener('keydown',function onKey(e){if(e.key==='Escape'&&!$('paymentSuccessOverlay'))document.removeEventListener('keydown',onKey);else if(e.key==='Escape'){close();document.removeEventListener('keydown',onKey)}});
    overlay.querySelector('.payment-success-close').focus();
    setTimeout(()=>{if(overlay.isConnected)close()},9000);
  }

  function renderPackages(){
    const host=$('topupPackages');if(!host)return;
    host.innerHTML=packages.map(p=>{
      const base=p.amount*rate,rep=Math.floor(p.amount/100000),inf=Math.floor(p.amount/500000);
      return '<article class="card topup-package"><span class="tag">'+p.label.toUpperCase()+'</span><h3>'+fmt(p.amount)+'</h3><div class="topup-base">Tiền game nhận <b>'+fmt(base)+'</b></div><div class="topup-bonus">Danh tiếng dự kiến <b>+'+rep+'</b> · Ảnh hưởng <b>+'+inf+'</b></div><div class="price">Tỷ lệ 1 : 1.000</div><small>Không cộng thêm tiền game</small><button class="primary" type="button" data-topup="'+p.amount+'">CHỌN GÓI NẠP</button></article>';
    }).join('');
  }
  function renderHistory(){
    const host=$('topupHistory');if(!host)return;
    host.innerHTML=history.length?history.map(x=>{
      const paid=x.status==='PAID',total=Number(x.creditAmount)||Number(x.amount)*rate;
      return '<div class="topup-history-item"><div><b>'+fmt(x.amount)+'</b><small>'+new Date(x.createdAt).toLocaleString('vi-VN')+' · '+x.code+'</small><small>Nhận: '+fmt(total)+' · Danh tiếng +'+Math.floor(Number(x.amount)/100000)+' · Ảnh hưởng +'+Math.floor(Number(x.amount)/500000)+'</small></div><b class="topup-state '+(paid?'paid':'')+'">'+(paid?'Đã thanh toán':x.status==='EXPIRED'?'Hết hạn':'Đang chờ')+'</b></div>';
    }).join(''):'<p class="muted">Chưa có giao dịch.</p>';
  }
  async function refresh(){
    if(!api()?.ready)return;
    try{const r=await api().request('/api/topup/history');history=r.orders||[];renderHistory();$('topupBalance').textContent=fmt(r.cashBalance??0)}
    catch(e){status('Chưa tải được lịch sử nạp tiền')}
  }
  async function check(){
    if(!activeOrder||!api()?.ready)return;
    try{
      const r=await api().request('/api/topup/status?orderId='+encodeURIComponent(activeOrder.orderId));
      if(r.status==='PAID'){
        const paidOrder={...activeOrder,...r,amount:r.amount??activeOrder.amount,creditAmount:r.creditAmount??activeOrder.creditAmount};
        status('Đã thanh toán');clearInterval(pollTimer);activeOrder=null;
        $('topupMessage').textContent='Thanh toán thành công. Tiền game, danh tiếng và ảnh hưởng đã được cập nhật.';
        try{const loaded=await api().request('/api/load');if(loaded.save)window.maidEmpire.load(loaded.save)}catch(loadError){console.warn('Không tải lại được tiến trình sau thanh toán:',loadError)}
        await refresh();window.dispatchEvent(new CustomEvent('maid-empire-refresh'));
        showPaymentSuccess(paidOrder);
      }else if(r.status==='EXPIRED'){
        status('Đã hết hạn');$('topupMessage').textContent='Mã thanh toán đã hết hạn. Vui lòng tạo giao dịch mới.';clearInterval(pollTimer);
      }else{$('topupMessage').textContent='Chưa nhận được thanh toán. Hệ thống sẽ tự kiểm tra lại.';status('Đang chờ thanh toán')}
    }catch(e){$('topupMessage').textContent='Chưa kiểm tra được: '+e.message}
  }
  async function create(amount){
    if(!api()?.ready){alert('Vui lòng đăng nhập và tải tiến trình trước khi nạp tiền.');return}
    try{
      status('Đang tạo giao dịch…');
      const r=await api().request('/api/topup/create','POST',{amount});
      activeOrder=r;$('topupCheckout').hidden=false;$('topupQr').src=r.qrUrl;
      const base=Number(r.creditAmount)||amount*rate;
      $('topupAmount').innerHTML='Thanh toán: <b>'+fmt(r.amount)+'</b><br>Tiền game nhận: <b>'+fmt(base)+'</b><br>Danh tiếng dự kiến: +'+(r.reputationGain??Math.floor(amount/100000))+'<br>Ảnh hưởng dự kiến: +'+(r.influenceGain??Math.floor(amount/500000))+'<br><strong>Không có thưởng tiền game</strong>';
      $('topupCode').textContent=r.code;$('topupExpiry').textContent='Hết hạn lúc '+new Date(r.expiresAt).toLocaleString('vi-VN');
      $('topupMessage').textContent='SePay sẽ tự động xác nhận chuyển khoản. Danh tiếng và ảnh hưởng chỉ được cộng sau khi webhook hợp lệ.';
      status('Đang chờ thanh toán');clearInterval(pollTimer);pollTimer=setInterval(check,5000);await refresh();
    }catch(e){status('Không thể tạo giao dịch');alert(e.message)}
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-topup]');if(b)create(Number(b.dataset.topup));
    if(e.target.closest('#topupCheck'))check();
    if(e.target.closest('#topupCancel')){$('topupCheckout').hidden=true;clearInterval(pollTimer)}
    if(e.target.closest('[data-tab="topup"]')){renderPackages();refresh()}
  });
  window.addEventListener('maid-empire-refresh',()=>{if($('topup')?.classList.contains('show'))refresh()});
  renderPackages();setInterval(()=>{if(api()?.ready&&$('topup')?.classList.contains('show'))refresh()},15000);
})();