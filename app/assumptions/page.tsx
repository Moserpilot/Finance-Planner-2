'use client';
import{useEffect,useMemo,useState}from'react';
import type{Plan}from'../lib/store';
import{loadPlan,savePlan}from'../lib/store';
import{netWorthAsOf,latestNetWorthSnapshotMonth}from'../lib/engine';
function safeCurrency(c:string){const x=(c||'').trim().toUpperCase();return/^[A-Z]{3}$/.test(x)?x:'USD';}
function money(n:number,c:string){return new Intl.NumberFormat('en-US',{style:'currency',currency:safeCurrency(c),maximumFractionDigits:0}).format(Number.isFinite(n)?n:0);}
function parseNum(v:string){const n=Number(String(v).replace(/[$,%\s,]+/g,''));return Number.isFinite(n)?n:0;}
export default function AssumptionsPage(){
  const[plan,setPlan]=useState<Plan|null>(null);
  const[goalDraft,setGoalDraft]=useState('');
  const[retDraft,setRetDraft]=useState('');
  useEffect(()=>{const p=loadPlan();setPlan(p);setGoalDraft(String(p.goalNetWorth??0));setRetDraft(String(p.expectedReturnPct??5));},[]);
  function save(p:Plan){setPlan(p);savePlan(p);}
  function update(patch:Partial<Plan>){if(!plan)return;save({...plan,...patch});}
  const cur=useMemo(()=>safeCurrency(plan?.currency||'USD'),[plan?.currency]);
  if(!plan)return<div className='text-sm text-slate-500'>Loading...</div>;
  const startMonth=plan.startMonthISO||'2026-01';
  const latestSnap=latestNetWorthSnapshotMonth(plan);
  const anchorMonth=plan.netWorthMode==='projection'?startMonth:(latestSnap??startMonth);
  const anchorNW=netWorthAsOf(plan,anchorMonth)?.netWorth??0;
  const inp='mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100';
  const sel='mt-1 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100';
  const modeHelp=plan.netWorthMode==='snapshot'?'Uses only balances you enter. No projections.':plan.netWorthMode==='projection'?'What-if model using expected return + cash flow. Ignores real balances.':'Projects forward but snaps to real balance updates when entered.';
  return(
    <div className='space-y-6'>
      <div><div className='text-2xl font-semibold text-slate-900 dark:text-slate-100'>Assumptions</div><div className='text-sm text-slate-500'>Configure currency, goal, return, and projection mode.</div></div>
      <div className='rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900'>
        <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
          <label><div className='text-xs font-medium text-slate-500'>Currency</div><input className={inp} value={plan.currency} onChange={e=>update({currency:e.target.value})} placeholder='USD'/></label>
          <label><div className='text-xs font-medium text-slate-500'>Start month (YYYY-MM)</div><input className={inp} value={plan.startMonthISO} onChange={e=>update({startMonthISO:e.target.value})} placeholder='2026-01'/></label>
          <label><div className='text-xs font-medium text-slate-500'>Goal net worth ({cur})</div><input className={inp} value={goalDraft} onChange={e=>setGoalDraft(e.target.value)} onBlur={()=>{const v=parseNum(goalDraft);update({goalNetWorth:v});setGoalDraft(String(v));}}/></label>
          <label><div className='text-xs font-medium text-slate-500'>Expected return (annual)</div><div className='mt-1 flex items-center rounded-xl border border-slate-200 bg-white shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-200 dark:border-slate-800 dark:bg-slate-900'><input className='w-full bg-transparent px-3 py-2 text-sm text-slate-900 outline-none dark:text-slate-100' value={retDraft} onChange={e=>setRetDraft(e.target.value)} onBlur={()=>{const v=parseNum(retDraft);update({expectedReturnPct:v});setRetDraft(String(v));}}/><span className='pr-3 text-sm text-slate-500'>%</span></div></label>
        </div>
        <div className='mt-5 grid gap-4 md:grid-cols-2'>
          <div>
            <div className='text-xs font-medium text-slate-500'>Net worth mode</div>
            <select className={sel} value={plan.netWorthMode} onChange={e=>{const v=e.target.value;update({netWorthMode:v==='snapshot'||v==='projection'||v==='hybrid'?v:'hybrid'});}}>
              <option value='snapshot'>Track actual balances</option>
              <option value='projection'>Hypothetical projection</option>
              <option value='hybrid'>Reality-anchored projection</option>
            </select>
            <div className='mt-2 text-xs text-slate-500'>{modeHelp}</div>
            <div className='mt-1 text-xs text-slate-400'>Tip: Most people should use Reality-anchored projection.</div>
          </div>
          <div className='rounded-2xl border border-slate-200 p-4 dark:border-slate-800'>
            <div className='text-sm font-medium text-slate-900 dark:text-slate-100'>Net worth summary</div>
            <div className='mt-2 text-sm text-slate-500'>Anchor: <span className='font-medium text-slate-900 dark:text-slate-100'>{anchorMonth}</span> · <span className='font-medium text-slate-900 dark:text-slate-100'>{money(anchorNW,cur)}</span></div>
          </div>
        </div>
      </div>
      <div className='rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900'>
        <div className='text-sm font-medium text-slate-900 dark:text-slate-100'>Net worth accounts</div>
        <div className='mt-1 text-sm text-slate-500'>Manage accounts on the <span className='font-medium text-slate-700 dark:text-slate-300'>Net Worth</span> page.</div>
      </div>
    </div>
  );
}