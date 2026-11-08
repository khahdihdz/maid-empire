(()=> {
  const $=id=>document.getElementById(id);
  const fmt=n=>new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(Number(n)||0);
  const packages=[
    {amount:50000,bonus:5,label:'Khởi đầu'},
    {amount:100000,bonus:8,label:'Phổ biến'},
    {amount:200000,bonus:12,label:'Tiết kiệm'},
    {amount:500000,bonus:18,label:'Cao cấp'},
    {amount:1000000,bonus:25,label:'Đại gia'}
  ];
  const rate=1000;
  let activeOrder=null,pollTimer=0,history=[];
  const api=()=>window.maidEmpireCloud;
  const status=t=>{const el=$('topupStatus');if(el)el.textContent=t};
  function renderPackages(){
    const host=$('topupPackages');if(!host)return;
    host.innerHTML=packages.map(p=>{
      const base=p.amount*rate,bonus=Math.floor(base*p.bonus/100);
      return '<article class="card topup-package"><span class="tag">'+p.label.toUpperCase()+'</span><h3>'+fmt(p.amount)+'</h3><div class="topup-base">Tiền game cơ bản <b>'+fmt(base)+'</b></div><div class="topup-bonus">+'+p.bonus+'% · Thưởng <b>'+fmt(bonus)+'</b></div><div class="price">Tổng nhận '+fmt(base+bonus)+'</div><small>Tỷ lệ cơ bản 1 : 1.000</small><button class="primary" type="button" data-topup="'+p.amount+'">CHỌN GÓI NẠP</button></article>';
    }).join('');
  }
  function renderHistory(){
    const host=$('topupHistory');if(!host)return;
    host.innerHTML=history.length?history.map(x=>{
      const paid=x.status==='PAID',bonus=Number(x.bonusAmount)||0,total=Number(x.totalCredit)||((Number(x.creditAmount)||Number(x.amount)*rate)+bonus);
      return '<div class="topup-history-item"><div><b>'+fmt(x.amount)+'</b><small>'+new Date(x.createdAt).toLocaleString('vi-VN')+' · '+x.code+'</small><small>Thưởng: +'+fmt(bonus)+' · Tổng nhận: '+fmt(total)+'</small></div><b class="topup-state '+(paid?'paid':'')+'">'+(paid?'Đã thanh toán':x.status==='EXPIRED'?'Hết hạn':'Đang chờ')+'</b></div>';
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
        $('topupMessage').textContent='Thanh toán thành công. Số dư đã được cập nhật, bao gồm tiền thưởng ưu đãi.';
        status('Đã thanh toán');clearInterval(pollTimer);activeOrder=null;
        const loaded=await api().request('/api/load');if(loaded.save)window.maidEmpire.load(loaded.save);
        await refresh();window.dispatchEvent(new CustomEvent('maid-empire-refresh'));
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
      const base=Number(r.creditAmount)||amount*rate,bonus=Number(r.bonusAmount)||0,total=Number(r.totalCredit)||base+bonus;
      $('topupAmount').innerHTML='Thanh toán: <b>'+fmt(r.amount)+'</b><br>Tiền game: '+fmt(base)+'<br><span class="topup-bonus">Thưởng '+(r.bonusPercent||0)+'%: +'+fmt(bonus)+'</span><br><strong>Tổng nhận: '+fmt(total)+'</strong>';
      $('topupCode').textContent=r.code;$('topupExpiry').textContent='Hết hạn lúc '+new Date(r.expiresAt).toLocaleString('vi-VN');
      $('topupMessage').textContent='Ưu đãi được cộng tự động sau khi hệ thống xác nhận thanh toán.';
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