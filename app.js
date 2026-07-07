const STORAGE_KEY='dues-manager-v1';
const won=new Intl.NumberFormat('ko-KR',{style:'currency',currency:'KRW',maximumFractionDigits:0});
const today=new Date().toISOString().slice(0,10);
const $=(id)=>document.getElementById(id);
const MEMBER_NAMES=['함형주','이진아','윤지원','나효진','이해진','홍석일','이재훈','길한','권오근','고현정'];
const TRIP_START='2026-07-25';
const TRIP_END='2026-07-26';
const DEFAULT_DUE=150000;
let state=loadState();
function uid(){return crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random());}
function defaultState(){return{meetingName:'Eat,Play,Cheers',defaultDue:DEFAULT_DUE,tripStart:TRIP_START,tripEnd:TRIP_END,members:MEMBER_NAMES.map((name,index)=>({id:'member-'+(index+1),name,contact:'',due:DEFAULT_DUE,status:'active'})),transactions:[]};}
function normalizeState(data){
  data.meetingName='Eat,Play,Cheers';
  data.defaultDue=DEFAULT_DUE;
  data.tripStart=TRIP_START;
  data.tripEnd=TRIP_END;
  const names=(data.members||[]).map(m=>m.name);
  if(names.join('|')!==MEMBER_NAMES.join('|')) data.members=MEMBER_NAMES.map((name,index)=>({id:'member-'+(index+1),name,contact:'',due:DEFAULT_DUE,status:'active'}));
  data.members=data.members.map((member,index)=>({id:member.id||'member-'+(index+1),name:member.name,contact:member.contact||'',due:DEFAULT_DUE,status:member.status||'active'}));
  data.transactions=data.transactions||[];
  return data;
}
function loadState(){try{const saved=localStorage.getItem(STORAGE_KEY);return normalizeState(saved?JSON.parse(saved):defaultState());}catch{return defaultState();}}
function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}
function fmt(v){return won.format(Number(v||0));}
function comma(v){return new Intl.NumberFormat('ko-KR').format(Number(v||0));}
function parseMoney(v){return Number(String(v||'').replace(/[^0-9]/g,''));}
function bindMoneyInput(el){el.addEventListener('input',()=>{const raw=parseMoney(el.value);el.value=raw?comma(raw):'';});}
function activeMembers(){return state.members.filter(m=>m.status==='active');}
function due(m){return Number(m.due||state.defaultDue||0);}
function mname(id){return (state.members.find(m=>m.id===id)||{}).name||'여행 공금';}
function inTrip(tx){const d=tx.date||'';return d>=state.tripStart&&d<=state.tripEnd;}
function splitAmount(amount,count){if(!count||amount<=0)return{perPerson:0,remainder:0};return{perPerson:Math.floor(amount/count),remainder:amount%count};}
function init(){
$('meetingNameDisplay').textContent=state.meetingName;$('tripDateDisplay').textContent='7/25 ~ 26';$('defaultDueDisplay').textContent=comma(state.defaultDue)+'원';$('paymentDate').value=state.tripStart;$('expenseDate').value=state.tripStart;$('paymentAmount').value=comma(state.defaultDue);bindMoneyInput($('paymentAmount'));bindMoneyInput($('expenseAmount'));bindMoneyInput($('memberDue'));
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.tab)));
$('paymentMember').addEventListener('change',fillPaymentAmount);$('paymentForm').addEventListener('submit',addPayment);$('expenseForm').addEventListener('submit',addExpense);$('memberForm').addEventListener('submit',addMember);
$('searchInput').addEventListener('input',renderLedger);$('typeFilter').addEventListener('change',renderLedger);$('markMonthPaid').addEventListener('click',markAllPaid);$('copySummary').addEventListener('click',copySummary);$('exportBtn').addEventListener('click',exportData);$('importFile').addEventListener('change',importData);$('resetBtn').addEventListener('click',resetAll);render();}
function switchTab(name){document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('is-active',b.dataset.tab===name));document.querySelectorAll('.entry-form').forEach(f=>f.classList.toggle('is-hidden',f.dataset.panel!==name));}
function addPayment(e){e.preventDefault();const memberId=$('paymentMember').value;if(!memberId)return;state.transactions.unshift({id:uid(),type:'payment',memberId,title:'여행 회비 납부',amount:parseMoney($('paymentAmount').value),date:$('paymentDate').value||state.tripStart,memo:$('paymentMemo').value.trim()});$('paymentMemo').value='';save();render();}
function addExpense(e){e.preventDefault();state.transactions.unshift({id:uid(),type:'expense',memberId:$('expensePayer').value,title:$('expenseTitle').value.trim(),amount:parseMoney($('expenseAmount').value),date:$('expenseDate').value||state.tripStart,memo:'지출'});e.target.reset();$('expenseDate').value=state.tripStart;save();render();}
function addMember(e){e.preventDefault();state.members.push({id:uid(),name:$('memberName').value.trim(),contact:$('memberContact').value.trim(),due:parseMoney($('memberDue').value)||state.defaultDue,status:$('memberStatus').value});e.target.reset();$('memberStatus').value='active';save();render();}
function markAllPaid(){const paid=new Set(state.transactions.filter(tx=>tx.type==='payment'&&inTrip(tx)).map(tx=>tx.memberId));activeMembers().forEach(m=>{if(!paid.has(m.id))state.transactions.unshift({id:uid(),type:'payment',memberId:m.id,title:'여행 회비 납부',amount:due(m),date:state.tripStart,memo:'전체 납부 처리'});});save();render();}
function totals(){const tripTx=state.transactions.filter(inTrip);const income=tripTx.filter(tx=>tx.type==='payment').reduce((s,tx)=>s+Number(tx.amount),0);const expense=tripTx.filter(tx=>tx.type==='expense').reduce((s,tx)=>s+Number(tx.amount),0);const balance=income-expense;const count=activeMembers().length;const shortage=balance<0?Math.abs(balance):0;const surplus=balance>0?balance:0;return{tripTx,income,expense,balance,count,shortage,surplus,shortSplit:splitAmount(shortage,count),surplusSplit:splitAmount(surplus,count)};}
function render(){ $('pageTitle').textContent=state.meetingName||'Eat,Play,Cheers'; $('tripRange').textContent='7/25 ~ 26'; $('meetingNameDisplay').textContent=state.meetingName; $('tripDateDisplay').textContent='7/25 ~ 26'; $('defaultDueDisplay').textContent=comma(state.defaultDue)+'원'; renderSelects(); renderMetrics(); renderLedger(); renderMembers(); renderSettlement(); }
function renderSelects(){const options=state.members.map(m=>'<option value="'+m.id+'">'+esc(m.name)+'</option>').join('');$('paymentMember').innerHTML=options;$('expensePayer').innerHTML='<option value="">여행 공금</option>'+options;fillPaymentAmount();}
function fillPaymentAmount(){const m=state.members.find(x=>x.id===$('paymentMember').value);if(m)$('paymentAmount').value=comma(due(m));}
function renderMetrics(){const t=totals();const paid=new Set(t.tripTx.filter(tx=>tx.type==='payment').map(tx=>tx.memberId));const unpaid=activeMembers().filter(m=>!paid.has(m.id)).reduce((s,m)=>s+due(m),0);$('balanceMetric').textContent=fmt(t.balance);$('incomeMetric').textContent=fmt(t.income);$('expenseMetric').textContent=fmt(t.expense);$('unpaidMetric').textContent=fmt(unpaid);$('adjustMetric').textContent=t.shortage?('추가 '+fmt(t.shortSplit.perPerson)+'/인'):t.surplus?('환급 '+fmt(t.surplusSplit.perPerson)+'/인'):'정산 없음';}
function renderLedger(){const query=$('searchInput').value.trim().toLowerCase();const filter=$('typeFilter').value;const list=state.transactions.filter(tx=>{const hay=[tx.title,tx.memo,mname(tx.memberId),tx.date].join(' ').toLowerCase();return(filter==='all'||tx.type===filter)&&hay.includes(query);});$('ledgerList').innerHTML=list.length?list.map(tx=>'<article class="ledger-item"><div class="ledger-main"><div><div class="ledger-title">'+esc(tx.title)+'</div><div class="meta">'+tx.date+' · '+esc(mname(tx.memberId))+(tx.memo?' · '+esc(tx.memo):'')+'</div></div><div class="amount '+(tx.type==='payment'?'income':'expense')+'">'+(tx.type==='payment'?'+':'-')+fmt(tx.amount)+'</div></div><div class="row-actions"><button class="small-btn" type="button" onclick="deleteTransaction(\''+tx.id+'\')">삭제</button></div></article>').join(''):'<div class="empty-state">아직 기록이 없습니다.</div>';}
function renderMembers(){const tripPayments=state.transactions.filter(tx=>tx.type==='payment'&&inTrip(tx));const paidMap=new Map();tripPayments.forEach(tx=>paidMap.set(tx.memberId,(paidMap.get(tx.memberId)||0)+Number(tx.amount)));$('memberList').innerHTML=state.members.length?state.members.map(m=>{const need=due(m);const paid=paidMap.get(m.id)||0;const ratio=need?Math.min(100,Math.round(paid/need*100)):100;const ok=m.status!=='active'||paid>=need;return '<article class="member-item"><div class="member-main"><div><div class="member-name">'+esc(m.name)+'</div><div class="meta">'+(m.contact?esc(m.contact)+' · ':'')+(m.status==='active'?'참가':'불참')+' · 참가 회비 '+fmt(need)+'</div></div><span class="status-pill '+(ok?'paid':'unpaid')+'">'+(ok?'완료':'미납')+'</span></div><div class="progress-track"><div class="progress-fill" style="width:'+ratio+'%"></div></div><div class="row-actions"><button class="small-btn" type="button" onclick="toggleMember(\''+m.id+'\')">상태 변경</button><button class="small-btn" type="button" onclick="deleteMember(\''+m.id+'\')">삭제</button></div></article>';}).join(''):'<div class="empty-state">아직 회원이 없습니다.</div>';}
function renderSettlement(){const t=totals();const paid=new Set(t.tripTx.filter(tx=>tx.type==='payment').map(tx=>tx.memberId));const unpaid=activeMembers().filter(m=>!paid.has(m.id));let adjust='정산 없음';if(t.shortage)adjust='지출이 수입보다 '+fmt(t.shortage)+' 많습니다. 참가자 '+t.count+'명 기준 1인당 추가 '+fmt(t.shortSplit.perPerson)+' 납부'+(t.shortSplit.remainder?' + 자투리 '+fmt(t.shortSplit.remainder):'');if(t.surplus)adjust='수입이 지출보다 '+fmt(t.surplus)+' 많습니다. 참가자 '+t.count+'명 기준 1인당 '+fmt(t.surplusSplit.perPerson)+' 환급'+(t.surplusSplit.remainder?' + 남는 자투리 '+fmt(t.surplusSplit.remainder):'');$('settlementText').value='['+state.meetingName+' 여행 회비 정산]\n여행일자: '+state.tripStart+' ~ '+state.tripEnd+'\n참가 회비: 1인 '+fmt(state.defaultDue)+'\n회비 수입: '+fmt(t.income)+'\n여행 지출: '+fmt(t.expense)+'\n현재 잔액: '+fmt(t.balance)+'\n미납: '+(unpaid.length?unpaid.map(m=>m.name+' '+fmt(due(m))).join(', '):'없음')+'\n정산 제안: '+adjust;}
window.deleteTransaction=function(id){state.transactions=state.transactions.filter(tx=>tx.id!==id);save();render();};
window.toggleMember=function(id){const m=state.members.find(x=>x.id===id);if(!m)return;m.status=m.status==='active'?'paused':'active';save();render();};
window.deleteMember=function(id){if(!confirm('이 회원을 삭제할까요? 관련 거래 내역은 남아 있습니다.'))return;state.members=state.members.filter(m=>m.id!==id);save();render();};
async function copySummary(){await navigator.clipboard.writeText($('settlementText').value);$('copySummary').textContent='복사됨';setTimeout(()=>$('copySummary').textContent='복사',1200);}
function exportData(){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=(state.meetingName||'trip')+'-dues.json';a.click();URL.revokeObjectURL(url);}
function importData(e){const file=e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{state=normalizeState(JSON.parse(reader.result));save();render();}catch{alert('가져올 수 없는 파일입니다.');}};reader.readAsText(file);e.target.value='';}
function resetAll(){if(!confirm('모든 회비 데이터를 초기화할까요?'))return;state=defaultState();save();render();}
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
init();