import { useEffect, useState } from 'react';
import { Add, DeleteOutline } from '@mui/icons-material';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, TextField, Typography } from '@mui/material';
import type { Invoice, InvoiceLine, Lead } from './types';
import { formatMoney } from './ui';

const emptyLine=():InvoiceLine=>({description:'',quantity:1,unitPrice:0});
const escapeHtml=(value:string)=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');

export function InvoiceBuilderDialog({open,lead,companyName,nextNumber,onClose,onSave}:{open:boolean;lead:Lead|null;companyName:string;nextNumber:number;onClose:()=>void;onSave:(invoice:Invoice)=>void}) {
  const [seller,setSeller]=useState(companyName);
  const [taxRate,setTaxRate]=useState(18);
  const [lines,setLines]=useState<InvoiceLine[]>([{description:'',quantity:1,unitPrice:0}]);
  const [error,setError]=useState('');
  useEffect(()=>{if(open){setSeller(companyName);setTaxRate(18);setLines([emptyLine()]);setError('');}},[open,companyName,lead?.id]);
  const subtotal=lines.reduce((sum,line)=>sum+line.quantity*line.unitPrice,0);
  const tax=subtotal*taxRate/100;
  const updateLine=(index:number,key:keyof InvoiceLine,value:string)=>setLines(current=>current.map((line,i)=>i===index?{...line,[key]:key==='description'?value:Number(value)||0}:line));
  const save=()=>{
    if(!lead)return;
    if(!seller.trim()){setError('Enter your company name.');return;}
    if(lines.some(line=>!line.description.trim()||line.quantity<=0||line.unitPrice<0)){setError('Add a description and valid quantity and unit price for each line.');return;}
    onSave({id:crypto.randomUUID(),leadId:lead.id,number:`NX-${new Date().getFullYear()}-${String(nextNumber).padStart(4,'0')}`,companyName:seller.trim(),customerName:lead.name,customerCompany:lead.company,date:new Date().toISOString().slice(0,10),taxRate,lines:lines.map(line=>({...line,description:line.description.trim()}))});
  };
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="md"><DialogTitle>Create invoice · {lead?.company}</DialogTitle><DialogContent dividers><Stack spacing={2} sx={{pt:1}}>
    <Stack direction={{xs:'column',sm:'row'}} gap={1.5}><TextField label="Your company name" value={seller} onChange={event=>setSeller(event.target.value)} fullWidth/><TextField label="Bill to" value={lead?`${lead.name} · ${lead.company}`:''} fullWidth InputProps={{readOnly:true}}/><TextField label="Tax (%)" type="number" inputProps={{min:0,max:100,step:0.1}} value={taxRate} onChange={event=>setTaxRate(Math.max(0,Number(event.target.value)||0))} sx={{width:{sm:130}}}/></Stack>
    <Typography variant="caption" color="text.secondary">Invoice NX-{new Date().getFullYear()}-{String(nextNumber).padStart(4,'0')} · 18% tax is the default; change it for this invoice as needed.</Typography>
    {lines.map((line,index)=><Stack key={index} direction={{xs:'column',sm:'row'}} gap={1} alignItems="center"><TextField label="Product / service" value={line.description} onChange={event=>updateLine(index,'description',event.target.value)} fullWidth/><TextField label="Quantity" type="number" inputProps={{min:1,step:1}} value={line.quantity} onChange={event=>updateLine(index,'quantity',event.target.value)} sx={{width:{sm:115}}}/><TextField label="Unit price" type="number" inputProps={{min:0,step:0.01}} value={line.unitPrice} onChange={event=>updateLine(index,'unitPrice',event.target.value)} sx={{width:{sm:150}}}/><Typography sx={{minWidth:100,textAlign:'right',fontWeight:600}}>{formatMoney(line.quantity*line.unitPrice)}</Typography><IconButton aria-label="Remove invoice line" disabled={lines.length===1} onClick={()=>setLines(current=>current.filter((_,i)=>i!==index))}><DeleteOutline/></IconButton></Stack>)}
    <Button startIcon={<Add/>} onClick={()=>setLines(current=>[...current,emptyLine()])} sx={{alignSelf:'start'}}>Add product</Button>
    {error&&<Typography color="error.main" role="alert">{error}</Typography>}
    <Stack sx={{alignSelf:'flex-end',minWidth:230}} spacing={.5}><Typography>Subtotal: <b>{formatMoney(subtotal)}</b></Typography><Typography>Tax ({taxRate}%): <b>{formatMoney(tax)}</b></Typography><Typography variant="h3">Total: {formatMoney(subtotal+tax)}</Typography></Stack>
  </Stack></DialogContent><DialogActions sx={{p:2}}><Button onClick={onClose}>Cancel</Button><Button variant="contained" onClick={save}>Save Invoice</Button></DialogActions></Dialog>;
}

export function invoiceHtml(invoice:Invoice) {
  const subtotal=invoice.lines.reduce((sum,line)=>sum+line.quantity*line.unitPrice,0);
  const rows=invoice.lines.map(line=>`<tr><td>${escapeHtml(line.description)}</td><td>${line.quantity}</td><td>${formatMoney(line.unitPrice)}</td><td>${formatMoney(line.quantity*line.unitPrice)}</td></tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${escapeHtml(invoice.number)}</title><style>body{font:14px Arial,sans-serif;color:#172033;margin:40px}header{display:flex;justify-content:space-between;border-bottom:2px solid #2563eb;padding-bottom:20px}h1{color:#1d4ed8}table{width:100%;border-collapse:collapse;margin-top:30px}th,td{text-align:left;padding:12px;border-bottom:1px solid #dbe2eb}th{background:#f1f5f9}.totals{margin:24px 0 0 auto;width:280px}.totals p{display:flex;justify-content:space-between}.total{font-size:20px;font-weight:bold;border-top:2px solid #172033;padding-top:12px}@media print{body{margin:15mm}}</style></head><body><header><div><h1>${escapeHtml(invoice.companyName)}</h1><p>Invoice ${escapeHtml(invoice.number)}</p></div><div><b>Bill to</b><p>${escapeHtml(invoice.customerName)}<br>${escapeHtml(invoice.customerCompany)}</p><p>Date: ${escapeHtml(invoice.date)}</p></div></header><table><thead><tr><th>Product / service</th><th>Quantity</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table><div class="totals"><p><span>Subtotal</span><b>${formatMoney(subtotal)}</b></p><p><span>Tax (${invoice.taxRate}%)</span><b>${formatMoney(subtotal*invoice.taxRate/100)}</b></p><p class="total"><span>Total</span><span>${formatMoney(subtotal*(1+invoice.taxRate/100))}</span></p></div></body></html>`;
}

export function downloadInvoiceWord(invoice:Invoice) {
  const blob=new Blob(['\ufeff',invoiceHtml(invoice)],{type:'application/msword'});
  const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`${invoice.number}.doc`;link.click();URL.revokeObjectURL(url);
}

export function printInvoicePdf(invoice:Invoice) {
  const preview=window.open('','_blank');
  if(!preview)return false;
  preview.document.open();preview.document.write(invoiceHtml(invoice));preview.document.close();
  preview.onload=()=>preview.print();
  return true;
}
