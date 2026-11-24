/* Minimal dependency-free XLSX writer. Produces ordinary Office Open XML (.xlsx)
   ZIP packages with uncompressed entries. No network request, no third-party CDN. */
(function (root) {
  'use strict';
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const XMLNS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const encoder = new TextEncoder();
  const enc = s => encoder.encode(s);
  const xml = s => String(s == null ? '' : s).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
  const round = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  const sum = (arr, get) => round(arr.reduce((acc, item) => acc + (get ? Number(get(item)) : Number(item)) || 0, 0));
  function colName(index){let result='';while(index>0){index--;result=String.fromCharCode(65+(index%26))+result;index=Math.floor(index/26);}return result;}
  function sheetXml(sheet) {
    let rows = '';
    const headerRows = new Set(sheet.headerRows || []);
    const moneyCols = new Set(sheet.moneyCols || []);
    const titleRows = new Set(sheet.titleRows || []);
    for(let i=0;i<sheet.rows.length;i++){
      const row=sheet.rows[i], n=i+1;let cells='';
      for(let j=0;j<row.length;j++) {
        let value=row[j];if(value===undefined||value===null||value==='')continue;
        const reference=colName(j+1)+n;
        const style=titleRows.has(n)?' s="4"':headerRows.has(n)?' s="1"':(typeof value==='number'&&moneyCols.has(j+1))?' s="2"':'';
        if(typeof value==='number'&&Number.isFinite(value)) cells+=`<c r="${reference}"${style}><v>${value}</v></c>`;
        else cells+=`<c r="${reference}"${style} t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
      }
      rows+=`<row r="${n}">${cells}</row>`;
    }
    const widths=sheet.widths||[];
    const cols=widths.length?'<cols>'+widths.map((width,i)=>`<col min="${i+1}" max="${i+1}" width="${width}" customWidth="1"/>`).join('')+'</cols>':'';
    const dimension=`A1:${colName(Math.max(...sheet.rows.map(r=>r.length),1))}${Math.max(sheet.rows.length,1)}`;
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${XMLNS}"><dimension ref="${dimension}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="${sheet.freeze||0}" topLeftCell="A${(sheet.freeze||0)+1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${cols}<sheetFormatPr defaultRowHeight="17"/><sheetData>${rows}</sheetData></worksheet>`;
  }
  function stylesXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="${XMLNS}"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00;[Red](#,##0.00)"/></numFmts><fonts count="3"><font><sz val="11"/><name val="Aptos"/><color rgb="FF24343C"/></font><font><b/><sz val="11"/><name val="Aptos"/><color rgb="FFFFFFFF"/></font><font><b/><sz val="15"/><name val="Aptos Display"/><color rgb="FF076D67"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF124A4C"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  }
  const crcTable = (()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xEDB88320^(c>>>1):(c>>>1);t[n]=c>>>0;}return t;})();
  function crc32(bytes){let crc=0xFFFFFFFF;for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);return(crc^0xFFFFFFFF)>>>0;}
  function zipFiles(files) {
    const local=[],central=[];let localSize=0,centralSize=0;
    for(const file of files){
      const name=enc(file.name),data=enc(file.text),checksum=crc32(data);
      const loc=new Uint8Array(30+name.length+data.length),lv=new DataView(loc.buffer);
      lv.setUint32(0,0x04034B50,true);lv.setUint16(4,20,true);lv.setUint16(6,0x0800,true);lv.setUint16(8,0,true);
      lv.setUint32(14,checksum,true);lv.setUint32(18,data.length,true);lv.setUint32(22,data.length,true);lv.setUint16(26,name.length,true);
      loc.set(name,30);loc.set(data,30+name.length);local.push(loc);
      const cen=new Uint8Array(46+name.length),cv=new DataView(cen.buffer);
      cv.setUint32(0,0x02014B50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x0800,true);
      cv.setUint32(16,checksum,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,name.length,true);
      cv.setUint32(42,localSize,true);cen.set(name,46);central.push(cen);
      localSize+=loc.length;centralSize+=cen.length;
    }
    const result=new Uint8Array(localSize+centralSize+22),end=new DataView(result.buffer);let offset=0;
    for(const b of local){result.set(b,offset);offset+=b.length;}
    for(const b of central){result.set(b,offset);offset+=b.length;}
    end.setUint32(offset,0x06054B50,true);end.setUint16(offset+8,files.length,true);end.setUint16(offset+10,files.length,true);end.setUint32(offset+12,centralSize,true);end.setUint32(offset+16,localSize,true);
    return result;
  }
  function buildWorkbook(year, transactions, credits, currency='INR') {
    const y=String(year);const sheets=[];const overview=[[`DAILY LEDGER — ${y}`],['Currency',currency],['Month','Money received','Money spent','Net movement','Cash spent','GPay spent']];
    const yearlyTx=transactions.filter(t=>String(t.date).slice(0,4)===y);
    for(let m=0;m<12;m++){
      const prefix=y+'-'+String(m+1).padStart(2,'0');const all=yearlyTx.filter(t=>t.date.slice(0,7)===prefix);
      const income=sum(all.filter(t=>t.type==='income'),t=>t.amount);const spending=sum(all.filter(t=>t.type==='expense'),t=>t.amount);
      const cash=sum(all.filter(t=>t.type==='expense'&&t.method==='Cash'),t=>t.amount);
      const gpay=sum(all.filter(t=>t.type==='expense'&&t.method==='GPay'),t=>t.amount);
      overview.push([MONTHS[m],income,spending,round(income-spending),cash,gpay]);
      const rows=[[`${MONTHS[m].toUpperCase()} ${y}`],['Received',income,'Spent',spending,'Net',round(income-spending)],[],['Date','Type','Where / from','Category','Payment method','Amount','Notes']];
      const sorted=[...all].sort((a,b)=>a.date.localeCompare(b.date)||String(a.createdAt||'').localeCompare(String(b.createdAt||'')));
      for(const t of sorted) rows.push([t.date,t.type==='income'?'Money received':'Money spent',t.place,t.type==='income'?'Income':(t.category||'Other'),t.method,round(t.amount),t.note||'']);
      if(!sorted.length)rows.push(['No entries this month']);
      sheets.push({name:MONTHS[m],rows,headerRows:[4],titleRows:[1],moneyCols:[2,4,6],widths:[15,20,28,20,18,17,40],freeze:4});
    }
    const totalIncome=sum(yearlyTx.filter(t=>t.type==='income'),t=>t.amount);
    const totalExpense=sum(yearlyTx.filter(t=>t.type==='expense'),t=>t.amount);
    const totalCash=sum(yearlyTx.filter(t=>t.type==='expense'&&t.method==='Cash'),t=>t.amount);
    const totalGpay=sum(yearlyTx.filter(t=>t.type==='expense'&&t.method==='GPay'),t=>t.amount);
    overview.push(['YEAR TOTAL',totalIncome,totalExpense,round(totalIncome-totalExpense),totalCash,totalGpay],[],['CREDITS OPENED IN THIS YEAR'],['Direction','Original amount','Repaid','Outstanding']);
    const chosenCredits=credits.filter(c=>String(c.date).slice(0,4)===y);
    const totals=direction=>{const chosen=chosenCredits.filter(c=>c.direction===direction);return [direction==='lent'?'Others owe me':'I owe others',sum(chosen,c=>c.amount),sum(chosen,c=>(c.payments||[]).reduce((a,p)=>a+Number(p.amount||0),0)),sum(chosen,c=>Math.max(0,round(Number(c.amount)-sum(c.payments||[],p=>p.amount))))]};
    overview.push(totals('lent'),totals('borrowed'));
    sheets.unshift({name:'Overview',rows:overview,headerRows:[3,19],titleRows:[1,18],moneyCols:[2,3,4,5,6],widths:[30,21,21,21,21,21],freeze:3});
    const creditRows=[[`CREDITS OPENED IN ${y}`],[],['Date','Direction','Person','Original amount','Total repaid','Still outstanding','Status','Notes']];
    for(const c of chosenCredits.sort((a,b)=>a.date.localeCompare(b.date))){const repaid=sum(c.payments||[],p=>p.amount),outstanding=Math.max(0,round(c.amount-repaid));creditRows.push([c.date,c.direction==='lent'?'Owed to me':'I owe',c.name,round(c.amount),repaid,outstanding,outstanding<=0?'Settled':'Open',c.note||'']);}
    if(chosenCredits.length===0)creditRows.push(['No credits opened in this year']);
    sheets.push({name:'Credits',rows:creditRows,headerRows:[3],titleRows:[1],moneyCols:[4,5,6],widths:[16,20,28,21,20,22,15,38],freeze:3});
    const paymentRows=[[`CREDIT REPAYMENTS RECORDED IN ${y}`],[],['Repayment date','Person','Credit direction','Original credit date','Method','Amount']];
    for(const c of credits){for(const p of c.payments||[]){if(String(p.date).slice(0,4)===y)paymentRows.push([p.date,c.name,c.direction==='lent'?'Received back':'Paid back',c.date,p.method,round(p.amount)]);}}
    if(paymentRows.length===3)paymentRows.push(['No repayments recorded in this year']);
    else paymentRows.splice(3,paymentRows.length-3,...paymentRows.slice(3).sort((a,b)=>a[0].localeCompare(b[0])));
    sheets.push({name:'Repayments',rows:paymentRows,headerRows:[3],titleRows:[1],moneyCols:[6],widths:[18,27,22,22,16,19],freeze:3});
    const files=[];
    files.push({name:'[Content_Types].xml',text:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((s,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`});
    files.push({name:'_rels/.rels',text:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'});
    files.push({name:'xl/workbook.xml',text:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${XMLNS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s,i)=>`<sheet name="${xml(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets><calcPr fullCalcOnLoad="1"/></workbook>`});
    files.push({name:'xl/_rels/workbook.xml.rels',text:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((s,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`});
    files.push({name:'xl/styles.xml',text:stylesXml()});
    for(let i=0;i<sheets.length;i++)files.push({name:`xl/worksheets/sheet${i+1}.xml`,text:sheetXml(sheets[i])});
    return zipFiles(files);
  }
  root.DailyLedgerXLSX={buildWorkbook,MONTHS};
  if(typeof module!=='undefined'&&module.exports)module.exports=root.DailyLedgerXLSX;
})(typeof window!=='undefined'?window:globalThis);
