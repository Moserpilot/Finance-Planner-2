'use client';
import{useEffect,useMemo,useState}from'react';
import{amountForMonth}from'../lib/engine';
import type{DatedAmount,Plan,RecurringItem}from'../lib/store';
import{loadPlan,newOneTimeItem,newRecurringItem,savePlan}from'../lib/store';
function safeCurrency(c:string){const x=(c||'').trim().toUpperCase();return/^[A-Z]{3}$/.test(x)?x:'USD';}
function money(n:number,c:string){return new Intl.NumberFormat('en-US',{style:'currency',currency:safeCurrency(c),maximumFractionDigits:0}).format(Number.isFinite(n)?n:0);}
function addMonthsISO(s:string,add:number){const ok=/^\d{4}-\d{2}$/.test(s);const y0=ok?Number(s.slice(0,4)):2026;const m0=ok?Number(s.slice(5,7))-1:0;const t=y0*12+m0+add;return Math.floor(t/12)+'-'+String(t%12+1).padStart(2,'0');}
function asNum(v:string){const n=Number(String(v).replace(/[$,%\s,]+/g,''));return Number.isFinite(n)?n:0;}
function upsert(arr:DatedAmount[],monthISO:string,amount:number){const next=[...arr];const i=next.findIndex(x=>x.monthISO===monthISO);if(i>=0)next[i]={monthISO,amount};else next.push({monthISO,amount});next.sort((a,b)=>a.monthISO<b.monthISO?-1:1);return next;}
export default function ExpensesPage(){
  const[plan,setPlan]=useState<Plan|null>(null);
  const[editMonth,setEditMonth]=useState('2026-01');
  useEffect(()=>{const p=loadPlan();setPlan(p);setEditMonth(p.startMonthISO||'2026-01');},[]);
  function save(p:Plan){setPlan(p);savePlan(p);}
  const cur=safeCurrency(plan?.currency||'USD');
  const monthOptions=useMemo(()=>Array.from({length:120},(_,i)=>addMonthsISO(plan?.startMonthISO||'2026-01',i)),[plan?.startMonthISO]);
  if(!plan)return<div className='text-sm text-slate-500'>Loading...</div>;
  const re=plan.expenses||[];
  const oe=plan.oneTimeExpenses||[];
  const updRec=(id:string,patch:Partial<RecurringItem>)=>save({...plan,expenses:re.map(x=>x.id===id?{...x,...patch}:x)});
  const setAmt=(item:RecurringItem,amount:number)=>{if(item.behavior==='carryForward')updRec(item.id,{changes:upsert(item.changes||[],editMonth,amount)});else updRec(item.id,{overrides:upsert(item.overrides||[],editMonth,amount)});};
  const recTotal=re.reduce((s,it)=>s+amountForMonth(it,editMonth),0);
  const otTotal=oe.filter(x=>x.monthISO===editMonth).reduce((s,x)=>s+x.amount,0);
  const inp='mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
  return(
    <div className='space-y-5'>
      <div><h1 className='text-2xl font-semibold text-slate-900 dark:text-slate-100'>Expenses</h1><p className='text-sm text-slate-500'>Recurring and one-time expenses.</p></div>
      <div className='grid gap-3 sm:grid-cols-3'>
        <label className='rounded-2xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900'>
          <div className='text-xs uppercase tracking-wide text-slate-500'>Editing month</div>
          <select value={editMonth} onChange={e=>setEditMonth(e.target.value)} className={inp}>{monthOptions.map(m=><option key={m} value={m}>{m}</option>)}</select>
        </label>
        <div className='rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900'><div className='text-xs uppercase tracking-wide text-slate-500'>Recurring</div><div className='mt-1 text-xl font-semibold text-rose-600'>{money(recTotal,cur)}</div></div>
        <div className='rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900'><div className='text-xs uppercase tracking-wide text-slate-500'>One-time</div><div className='mt-1 text-xl font-semibold text-rose-600'>{money(otTotal,cur)}</div></div>
      </div>
      <div className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900'>
        <div className='mb-3 flex flex-wrap gap-2'>
          <button className='rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white' onClick={()=>save({...plan,expenses:[...re,newRecurringItem('expense')]})}>+ Recurring</button>
          <button className='rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700' onClick={()=>save({...plan,oneTimeExpenses:[...oe,newOneTimeItem('expense',editMonth)]})}>+ One-time</button>
        </div>
        <div className='space-y-3'>
          {re.map(item=>{const ma=amountForMonth(item,editMonth);return(<div key={item.id} className='rounded-xl border border-slate-200 p-3 dark:border-slate-800'><div className='grid gap-2 md:grid-cols-6'>
            <input className={inp} value={item.name} onChange={e=>updRec(item.id,{name:e.target.value})}/>
            <input className={inp} type='text' defaultValue={money(item.defaultAmount,cur)} key={'d'+item.id+item.defaultAmount} onBlur={e=>updRec(item.id,{defaultAmount:asNum(e.target.value)})}/>
            <select className={inp} value={item.behavior} onChange={e=>updRec(item.id,{behavior:e.target.value==='monthOnly'?'monthOnly':'carryForward'})}><option value='carryForward'>Carry-forward</option><option value='monthOnly'>Month-only</option></select>
            <select className={inp} value={item.endMonthISO||''} onChange={e=>updRec(item.id,{endMonthISO:e.target.value||null})}><option value=''>No end</option>{monthOptions.map(m=><option key={m} value={m}>{m}</option>)}</select>
            <input className={inp} type='text' defaultValue={money(ma,cur)} key={'m'+item.id+editMonth+ma} onBlur={e=>setAmt(item,asNum(e.target.value))}/>
            <button className='rounded-xl border border-rose-200 px-2 py-2 text-sm text-rose-600' onClick={()=>save({...plan,expenses:re.filter(x=>x.id!==item.id)})}>Remove</button>
          </div></div>);})}
          {!re.length&&<div className='text-sm text-slate-500'>No recurring expenses yet.</div>}
        </div>
      </div>
      <div className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900'>
        <div className='text-sm font-medium text-slate-900 dark:text-slate-100 mb-3'>One-time expenses</div>
        <div className='space-y-2'>
          {oe.map(item=>(<div key={item.id} className='grid gap-2 md:grid-cols-4'>
            <input className={inp} value={item.name} onChange={e=>save({...plan,oneTimeExpenses:oe.map(x=>x.id===item.id?{...x,name:e.target.value}:x)})}/>
            <select className={inp} value={item.monthISO} onChange={e=>save({...plan,oneTimeExpenses:oe.map(x=>x.id===item.id?{...x,monthISO:e.target.value}:x)})}>{monthOptions.map(m=><option key={m} value={m}>{m}</option>)}</select>
            <input className={inp} type='text' defaultValue={money(item.amount,cur)} key={'ot'+item.id+item.amount} onBlur={e=>save({...plan,oneTimeExpenses:oe.map(x=>x.id===item.id?{...x,amount:asNum(e.target.value)}:x)})}/>
            <button className='rounded-xl border border-rose-200 px-2 py-2 text-sm text-rose-600' onClick={()=>save({...plan,oneTimeExpenses:oe.filter(x=>x.id!==item.id)})}>Remove</button>
          </div>))}
          {!oe.length&&<div className='text-sm text-slate-500'>No one-time expenses yet.</div>}
        </div>
      </div>
    </div>
  );
}