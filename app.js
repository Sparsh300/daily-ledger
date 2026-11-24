(function () {
  'use strict';
  const KEY='daily-ledger-data-v1';
  const $=id=>document.getElementById(id);
  const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const makeId=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2);
  const moneyRound=x=>Math.round((Number(x)+Number.EPSILON)*100)/100;
  const sum=(records,amountOf=x=>x.amount)=>moneyRound(records.reduce((total,row)=>total+(Number(amountOf(row))||0),0));
  const validDate=d=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(String(d)))return false;const [y,m,day]=d.split('-').map(Number);const constructed=new Date(y,m-1,day);return constructed.getFullYear()===y&&constructed.getMonth()===m-1&&constructed.getDate()===day;};
  const escaped=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const blankStore=()=>({version:1,transactions:[],credits:[],settings:{currency:'INR'}});
  let storageProblem=false;
  function load(){try{const raw=localStorage.getItem(KEY);if(!raw)return blankStore();const read=JSON.parse(raw);if(!read||!Array.isArray(read.transactions)||!Array.isArray(read.credits))return blankStore();return {version:1,transactions:read.transactions,credits:read.credits,settings:{currency:['INR','AUD','USD'].includes(read.settings?.currency)?read.settings.currency:'INR'}};}catch(e){storageProblem=true;return blankStore();}}
  let db=load();
  let page='overview';let month=today().slice(0,7);let entryType='expense';let editingId=null;let creditFilter='open';let payingCreditId=null;let toastTimer;
  const months=DailyLedgerXLSX.MONTHS;
  const currencySymbol=()=>({INR:'₹',AUD:'A$',USD:'$'})[db.settings.currency];
  const money=amount=>new Intl.NumberFormat(db.settings.currency==='INR'?'en-IN':'en-AU',{style:'currency',currency:db.settings.currency,maximumFractionDigits:2}).format(Number(amount)||0);
  const dateLabel=d=>{if(!validDate(d))return d||'';const[y,m,day]=d.split('-').map(Number);return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric'}).format(new Date(y,m-1,day));};
  const monthLabel=value=>{const[y,m]=value.split('-').map(Number);return `${months[m-1]} ${y}`;};
  const outstanding=c=>Math.max(0,moneyRound(Number(c.amount)-sum(c.payments||[])));
  const openCredits=()=>db.credits.filter(c=>outstanding(c)>.005);
  const totalOwed=direction=>sum(db.credits.filter(c=>c.direction===direction),outstanding);
  const entriesThisMonth=()=>db.transactions.filter(t=>t.date.slice(0,7)===month);
  const sorted=(items)=>[...items].sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  function save(){try{localStorage.setItem(KEY,JSON.stringify(db));storageProblem=false;return true;}catch(e){storageProblem=true;toast('Could not save to this browser. Download a backup now.',true);return false;}}
  function toast(message,error=false){const el=$('toast');el.textContent=message;el.classList.toggle('error',error);el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),3500);}
  function empty(title,body){return `<div class="empty-state"><span class="empty-symbol">＋</span><strong>${escaped(title)}</strong><p>${escaped(body)}</p></div>`;}
  function navigate(next){page=next;const descriptions={overview:['YOUR MONTH AT A GLANCE','Overview','See what came in, what went out, and what is still owed.'],add:['QUICK & SIMPLE','Add entry','Record an expense or any money you received.'],history:['YOUR RECORDS','History','Find, edit, or remove a transaction.'],credits:['MONEY TO RECEIVE & REPAY','Credits','Track loans and partial repayments separately.'],export:['KEEP YOUR RECORDS','Excel & backup','Download yearly spreadsheets or move data between devices.']};
    for(const p of Object.keys(descriptions))$('view-'+p).hidden=(p!==page);
    document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
    $('pageEyebrow').textContent=descriptions[page][0];$('pageTitle').textContent=descriptions[page][1];$('pageDescription').textContent=descriptions[page][2];$('breadcrumbPage').textContent=page.toUpperCase();$('periodPicker').hidden=!['overview','history'].includes(page);
    closeMenu();render();window.scrollTo({top:0,behavior:'instant'});
  }
  function closeMenu(){$('sidebar').classList.remove('open');$('sidebarScrim').hidden=true;$('menuButton').setAttribute('aria-expanded','false');}
  function changeMonth(direction){const [y,m]=month.split('-').map(Number),date=new Date(y,m-1+direction,1);month=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;render();}
  function makeRow(t,withActions=false){const isIncome=t.type==='income';return `<div class="activity-row"><span class="activity-icon ${isIncome?'income':''}">${isIncome?'↙':'↗'}</span><div class="activity-description"><span class="activity-name">${escaped(t.place)}</span><span class="activity-meta">${escaped(dateLabel(t.date))} · ${escaped(t.method)} · ${escaped(isIncome?'Money received':t.category||'Other')}</span></div><div class="activity-tail"><span class="activity-amount ${isIncome?'income-text':'expense-text'}">${isIncome?'+':'−'}${escaped(money(t.amount))}</span>${withActions?`<div class="activity-actions"><button type="button" class="mini-action" data-edit-id="${escaped(t.id)}">Edit</button><button type="button" class="mini-action danger" data-delete-id="${escaped(t.id)}">Delete</button></div>`:''}</div></div>`;}
  function renderOverview(){const tx=entriesThisMonth();const spent=sum(tx.filter(t=>t.type==='expense'));const received=sum(tx.filter(t=>t.type==='income'));$('statSpent').textContent=money(spent);$('statIncome').textContent=money(received);$('statNet').textContent=money(moneyRound(received-spent));
    $('overviewToReceive').textContent=money(totalOwed('lent'));
    $('overviewToRepay').textContent=money(totalOwed('borrowed'));
    const recent=sorted(tx).slice(0,5);$('recentActivity').innerHTML=recent.length?recent.map(t=>makeRow(t)).join(''):empty('No entries yet','Tap Add entry to log your first expense or income.');
    const expenses=tx.filter(t=>t.type==='expense');const categories={};for(const t of expenses)categories[t.category||'Other']=(categories[t.category||'Other']||0)+Number(t.amount);
    const ranked=Object.entries(categories).sort((a,b)=>b[1]-a[1]).slice(0,5);
    $('breakdown').innerHTML=ranked.length?`<div class="breakdown-list">${ranked.map(([category,amount])=>`<div class="breakdown-group"><div class="bar-labels"><span>${escaped(category)}</span><strong>${escaped(money(amount))}</strong></div><div class="progress-track"><div class="progress-fill" style="width:${Math.min(100,amount/spent*100)}%"></div></div></div>`).join('')}</div>`:`<div class="breakdown-empty">Your spending categories will appear here.</div>`;
  }
  function renderHistory(){const query=$('historySearch').value.trim().toLowerCase(),type=$('historyType').value;const tx=sorted(entriesThisMonth()).filter(t=>(type==='all'||t.type===type)&&(!query||[t.place,t.note,t.category,t.method].some(v=>String(v||'').toLowerCase().includes(query))));$('historyCount').textContent=`${tx.length} ${tx.length===1?'entry':'entries'} · ${monthLabel(month)}`;$('historyList').innerHTML=tx.length?tx.map(t=>makeRow(t,true)).join(''):empty('Nothing found','Try another month or a different search.');}
  function renderCredits(){const recv=totalOwed('lent'),repay=totalOwed('borrowed');$('creditToReceive').textContent=money(recv);$('creditToRepay').textContent=money(repay);$('creditNavCount').textContent=openCredits().length||'';
    document.querySelectorAll('[data-credit-filter]').forEach(b=>b.classList.toggle('active',b.dataset.creditFilter===creditFilter));
    const chosen=sorted(db.credits).filter(c=>creditFilter==='all'||(creditFilter==='open'?outstanding(c)>.005:outstanding(c)<=.005));
    $('creditsList').innerHTML=chosen.length?chosen.map(c=>{const out=outstanding(c),paid=sum(c.payments||[]),settled=out<=.005;const paymentList=(c.payments||[]).length?`<div class="payment-details">${sorted(c.payments).map(p=>`<div class="payment-detail"><span>${escaped(dateLabel(p.date))} · ${escaped(p.method)}</span><span>${escaped(money(p.amount))} <button type="button" title="Delete this repayment" aria-label="Delete repayment" data-payment-remove="${escaped(c.id)}" data-payment-id="${escaped(p.id)}">×</button></span></div>`).join('')}</div>`:'';
      return `<article class="credit-record"><div class="credit-record-top"><div><div class="credit-person">${escaped(c.name)}</div><div class="credit-subtitle">${c.direction==='lent'?'Owed to you':'You owe'} · ${escaped(dateLabel(c.date))}</div></div><div class="credit-outstanding">${escaped(money(out))}<small>of ${escaped(money(c.amount))}</small></div></div><div class="credit-progress"><span style="width:${Math.min(100,paid/c.amount*100)}%"></span></div><div class="credit-bottom"><span class="credit-status ${settled?'settled':''}">${settled?'Fully settled':'Open · '+escaped(money(paid))+' paid'}</span><div class="credit-actions">${settled?'':`<button type="button" data-credit-pay="${escaped(c.id)}">Record repayment</button>`}<button type="button" class="delete-credit" data-credit-delete="${escaped(c.id)}">Delete</button></div></div>${c.note?`<div class="credit-subtitle">${escaped(c.note)}</div>`:''}${paymentList}</article>`;}).join(''):empty('No credits here','Add a credit or try a different status filter.');}
  function refreshYears(){const list=new Set([new Date().getFullYear()]);db.transactions.forEach(t=>list.add(Number(t.date.slice(0,4))));db.credits.forEach(c=>{list.add(Number(c.date.slice(0,4)));(c.payments||[]).forEach(p=>list.add(Number(p.date.slice(0,4))));});const years=[...list].filter(y=>y>=1900&&y<=9999).sort((a,b)=>b-a);const picker=$('exportYear'),value=picker.value;picker.innerHTML=years.map(y=>`<option value="${y}">${y}</option>`).join('');picker.value=years.includes(Number(value))?value:String(years[0]);refreshFilename();}
  function refreshFilename(){$('exportFileName').textContent=`Daily_Ledger_${$('exportYear').value}.xlsx`;}
  function render(){const activeMonth=monthLabel(month);$('periodName').textContent=activeMonth;$('currencySign').textContent=currencySymbol();$('currencyPicker').value=db.settings.currency;renderOverview();renderHistory();renderCredits();refreshYears();}
  function setEntryType(type){entryType=type;document.querySelectorAll('[data-entry-type]').forEach(btn=>btn.classList.toggle('selected',btn.dataset.entryType===type));const incoming=type==='income';$('entryPlaceLabel').innerHTML=incoming?'Received from <span class="required">*</span>':'Where did you spend it? <span class="required">*</span>';$('entryPlace').placeholder=incoming?'e.g. Salary, Family, Gift':'e.g. Grocery shop, Rahul, Petrol';$('categoryField').hidden=incoming;}
  function resetEntry(){$('entryForm').reset();$('entryDate').value=today();$('entryMethod').value='Cash';$('entryCategory').value='Food & drinks';editingId=null;setEntryType('expense');$('formHeading').textContent='New money entry';$('saveEntryButton').textContent='Save entry →';$('resetEntryButton').hidden=false;$('cancelEditButton').hidden=true;}
  function handleEntrySubmit(event){event.preventDefault();const amount=Number($('entryAmount').value),place=$('entryPlace').value.trim(),date=$('entryDate').value;
    if(!Number.isFinite(amount)||amount<=0||amount>1e12){toast('Enter a valid amount greater than zero.',true);$('entryAmount').focus();return;}
    if(!place){toast('Enter where you spent or received the money.',true);$('entryPlace').focus();return;}
    if(!validDate(date)){toast('Choose a valid date.',true);$('entryDate').focus();return;}
    const old=db.transactions.find(t=>t.id===editingId);const obj={id:old?.id||makeId(),date,type:entryType,place,amount:moneyRound(amount),method:$('entryMethod').value,category:entryType==='income'?'Income':$('entryCategory').value,note:$('entryNote').value.trim(),createdAt:old?.createdAt||new Date().toISOString()};
    if(old)Object.assign(old,obj);else db.transactions.push(obj);
    save();month=date.slice(0,7);const edited=Boolean(old);resetEntry();navigate('overview');toast(edited?'Entry updated.':'Entry saved.');}
  function beginEdit(id){const t=db.transactions.find(x=>x.id===id);if(!t)return;editingId=id;setEntryType(t.type);$('entryAmount').value=t.amount;$('entryPlace').value=t.place;$('entryDate').value=t.date;$('entryMethod').value=t.method;$('entryCategory').value=t.category||'Other';$('entryNote').value=t.note||'';$('formHeading').textContent='Edit money entry';$('saveEntryButton').textContent='Save changes →';$('resetEntryButton').hidden=true;$('cancelEditButton').hidden=false;navigate('add');}
  function deleteEntry(id){const t=db.transactions.find(x=>x.id===id);if(!t)return;if(!confirm(`Delete ${t.place} (${money(t.amount)})? This cannot be undone.`))return;db.transactions=db.transactions.filter(x=>x.id!==id);save();render();toast('Entry deleted.');}
  function addCredit(event){event.preventDefault();const name=$('creditPerson').value.trim(),amount=Number($('creditAmount').value),date=$('creditDate').value;if(!name){toast('Enter the person’s name.',true);return;}if(!Number.isFinite(amount)||amount<=0||amount>1e12){toast('Enter a valid credit amount.',true);return;}if(!validDate(date)){toast('Choose a valid credit date.',true);return;}
    db.credits.push({id:makeId(),direction:$('creditDirection').value,name,amount:moneyRound(amount),date,note:$('creditNote').value.trim(),payments:[],createdAt:new Date().toISOString()});save();$('creditForm').reset();$('creditDate').value=today();creditFilter='open';render();toast('Credit added.');}
  function deleteCredit(id){const c=db.credits.find(x=>x.id===id);if(!c)return;if(!confirm(`Delete the credit for ${c.name} and its repayments? This cannot be undone.`))return;db.credits=db.credits.filter(x=>x.id!==id);save();render();toast('Credit deleted.');}
  function openPayment(id){const c=db.credits.find(x=>x.id===id);if(!c||outstanding(c)<=.005)return;payingCreditId=id;$('paymentDialogDescription').textContent=`${c.name} · ${money(outstanding(c))} remaining`;$('paymentAmount').value='';$('paymentAmount').max=outstanding(c).toFixed(2);$('paymentDate').value=today();$('paymentDate').min=c.date;$('paymentMethod').value='Cash';$('paymentDialog').showModal();$('paymentAmount').focus();}
  function closePayment(){$('paymentDialog').close();payingCreditId=null;}
  function recordPayment(event){event.preventDefault();const c=db.credits.find(x=>x.id===payingCreditId);if(!c)return;const amount=Number($('paymentAmount').value),date=$('paymentDate').value,max=outstanding(c);if(!Number.isFinite(amount)||amount<=0||moneyRound(amount)>max){toast(`Repayment must be between 0.01 and ${money(max)}.`,true);return;}if(!validDate(date)||date<c.date){toast('Repayment date must be on or after the credit date.',true);return;}
    c.payments.push({id:makeId(),amount:moneyRound(amount),date,method:$('paymentMethod').value});save();closePayment();render();toast('Repayment recorded.');}
  function removePayment(creditId,paymentId){const c=db.credits.find(x=>x.id===creditId);if(!c)return;const p=(c.payments||[]).find(x=>x.id===paymentId);if(!p)return;if(!confirm(`Delete the repayment of ${money(p.amount)} for ${c.name}?`))return;c.payments=c.payments.filter(x=>x.id!==paymentId);save();render();toast('Repayment removed.');}
  function download(blob,filename){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
  function exportExcel(){const year=Number($('exportYear').value);try{const bytes=DailyLedgerXLSX.buildWorkbook(year,db.transactions,db.credits,db.settings.currency);download(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),`Daily_Ledger_${year}.xlsx`);toast(`Excel workbook for ${year} downloaded.`);}catch(error){console.error(error);toast('Unable to create the Excel file.',true);}}
  function downloadBackup(){const data={...db,exportedAt:new Date().toISOString()};download(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),`Daily_Ledger_Backup_${today()}.json`);toast('Backup downloaded.');}
  function normalizeBackup(json){if(!json||!Array.isArray(json.transactions)||!Array.isArray(json.credits))throw Error('This is not a valid Daily Ledger backup.');
    if(json.transactions.length>50000||json.credits.length>50000)throw Error('Too many records for this browser.');
    const text=(v,max)=>String(v??'').slice(0,max);
    const transactions=json.transactions.map(t=>{if(!validDate(t.date)||!['expense','income'].includes(t.type)||!Number.isFinite(Number(t.amount))||Number(t.amount)<=0)throw Error('An entry in the backup is invalid.');return{id:text(t.id||makeId(),100),date:t.date,type:t.type,amount:moneyRound(t.amount),place:text(t.place,100),method:['Cash','GPay'].includes(t.method)?t.method:'Cash',category:text(t.category||'Other',80),note:text(t.note,400),createdAt:text(t.createdAt,50)};});
    const credits=json.credits.map(c=>{if(!validDate(c.date)||!['lent','borrowed'].includes(c.direction)||!Number.isFinite(Number(c.amount))||Number(c.amount)<=0||!Array.isArray(c.payments))throw Error('A credit in the backup is invalid.');const payments=c.payments.map(p=>{if(!validDate(p.date)||p.date<c.date||!Number.isFinite(Number(p.amount))||Number(p.amount)<=0)throw Error('A repayment in the backup is invalid.');return{id:text(p.id||makeId(),100),date:p.date,amount:moneyRound(p.amount),method:['Cash','GPay'].includes(p.method)?p.method:'Cash'};});if(sum(payments)>Number(c.amount)+.005)throw Error('A credit has repayments larger than the original amount.');return{id:text(c.id||makeId(),100),date:c.date,direction:c.direction,name:text(c.name,100),amount:moneyRound(c.amount),note:text(c.note,250),createdAt:text(c.createdAt,50),payments};});
    return{version:1,transactions,credits,settings:{currency:['INR','AUD','USD'].includes(json.settings?.currency)?json.settings.currency:'INR'}};
  }
  async function restoreBackup(event){const file=event.target.files?.[0];if(!file)return;try{if(file.size>5*1024*1024)throw Error('The backup file is larger than 5 MB.');const restored=normalizeBackup(JSON.parse(await file.text()));if(!confirm(`Restore ${restored.transactions.length} entries and ${restored.credits.length} credits? This replaces all records currently saved in this browser.`))return;db=restored;save();resetEntry();month=today().slice(0,7);navigate('overview');toast('Backup restored successfully.');}catch(e){toast(e.message||'Could not read this backup file.',true);}finally{event.target.value='';}}
  function setup(){
    $('todayLabel').textContent=dateLabel(today());$('entryDate').value=today();$('creditDate').value=today();$('paymentDate').value=today();
    document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.page)));
    document.querySelectorAll('[data-entry-type]').forEach(b=>b.addEventListener('click',()=>setEntryType(b.dataset.entryType)));
    $('menuButton').addEventListener('click',()=>{const next=!$('sidebar').classList.contains('open');$('sidebar').classList.toggle('open',next);$('sidebarScrim').hidden=!next;$('menuButton').setAttribute('aria-expanded',String(next));});
    $('sidebarScrim').addEventListener('click',closeMenu);
    window.addEventListener('keydown',event=>{if(event.key==='Escape')closeMenu();});
    $('prevMonth').addEventListener('click',()=>changeMonth(-1));$('nextMonth').addEventListener('click',()=>changeMonth(1));
    $('entryForm').addEventListener('submit',handleEntrySubmit);$('resetEntryButton').addEventListener('click',resetEntry);$('cancelEditButton').addEventListener('click',()=>{resetEntry();navigate('history');});
    $('historySearch').addEventListener('input',renderHistory);$('historyType').addEventListener('change',renderHistory);
    $('creditForm').addEventListener('submit',addCredit);
    document.querySelectorAll('[data-credit-filter]').forEach(b=>b.addEventListener('click',()=>{creditFilter=b.dataset.creditFilter;renderCredits();}));
    document.addEventListener('click',event=>{const btn=event.target.closest('button');if(!btn)return;
      if(btn.dataset.editId)beginEdit(btn.dataset.editId);
      else if(btn.dataset.deleteId)deleteEntry(btn.dataset.deleteId);
      else if(btn.dataset.creditPay)openPayment(btn.dataset.creditPay);
      else if(btn.dataset.creditDelete)deleteCredit(btn.dataset.creditDelete);
      else if(btn.dataset.paymentRemove)removePayment(btn.dataset.paymentRemove,btn.dataset.paymentId);
    });
    $('paymentForm').addEventListener('submit',recordPayment);$('cancelPaymentButton').addEventListener('click',closePayment);$('closePaymentDialog').addEventListener('click',closePayment);$('paymentDialog').addEventListener('close',()=>{payingCreditId=null;});
    $('exportYear').addEventListener('change',refreshFilename);$('exportExcelButton').addEventListener('click',exportExcel);$('downloadBackupButton').addEventListener('click',downloadBackup);$('restoreFile').addEventListener('change',restoreBackup);
    $('currencyPicker').addEventListener('change',event=>{db.settings.currency=event.target.value;save();render();toast('Currency display updated (amounts not converted).');});
    setEntryType('expense');render();if(storageProblem)toast('Local browser storage is not available. Please use backup downloads.',true);
  }
  setup();
})();
