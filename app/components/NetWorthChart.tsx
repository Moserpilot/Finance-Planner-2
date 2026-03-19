'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { SeriesPoint } from '../lib/engine';
function safeCurrency(c: string) { const x = (c||'').trim().toUpperCase(); if(!/^[A-Z]{3}$/.test(x)) return 'USD'; try{new Intl.NumberFormat('en-US',{style:'currency',currency:x}).format(0);return x;}catch{return 'USD';} }
function fmt0(n:number,c:string){return new Intl.NumberFormat('en-US',{style:'currency',currency:safeCurrency(c),maximumFractionDigits:0}).format(n);}
function fmtK(n:number,c:string){return new Intl.NumberFormat('en-US',{style:'currency',currency:safeCurrency(c),notation:'compact',compactDisplay:'short',maximumFractionDigits:1}).format(n);}
function parseISO(iso:string){const s=(iso||'').trim();if(!/^\d{4}-\d{2}$/.test(s))return{y:2026,m:0};const y=Number(s.slice(0,4));const mo=Number(s.slice(5,7))-1;return{y,m:mo<0||mo>11?0:mo};}
const MON=['J','F','M','A','M','J','J','A','S','O','N','D'];
function addM(sy:number,sm:number,add:number){const t=sy*12+sm+add;return{y:Math.floor(t/12),m:t%12};}
function lbl(startISO:string,idx:number){const{y:sy,m:sm}=parseISO(startISO);const{y,m}=addM(sy,sm,idx);return MON[m]+String(y).slice(-2);}
function niceStep(range:number){const r=Math.max(1,range);const exp=Math.floor(Math.log10(r));const base=Math.pow(10,exp);const frac=r/base;let s=base;if(frac<=2)s=base/5;else if(frac<=5)s=base/2;return Math.max(1000,s);}
export function NetWorthChart({currency,series,startMonthISO,heightPx=700}:{currency:string;series:SeriesPoint[];startMonthISO:string;heightPx?:number;}){
  const wrapRef=useRef<HTMLDivElement|null>(null);
  const [mounted,setMounted]=useState(false);
  const [wrapWidth,setWrapWidth]=useState(0);
  const [hoverIdx,setHoverIdx]=useState<number|null>(null);
  useEffect(()=>{setMounted(true);},[]);
  useEffect(()=>{
    const el=wrapRef.current; if(!el)return;
    const update=()=>setWrapWidth(el.getBoundingClientRect().width||el.clientWidth||0);
    update();
    const ro=typeof ResizeObserver!=='undefined'?new ResizeObserver(update):null;
    if(ro)ro.observe(el); else window.addEventListener('resize',update);
    return()=>{if(ro)ro.disconnect();else window.removeEventListener('resize',update);};
  },[mounted]);
  const chart=useMemo(()=>{
    const w=Math.max(320,wrapWidth);
    const h=Math.max(300,heightPx-48);
    const narrow=w<520;
    const pad={l:narrow?72:120,r:narrow?16:32,t:20,b:narrow?64:80};
    const vals=series.map(p=>p.netWorth);
    const mn=vals.length?Math.min(...vals):0;
    const mx=vals.length?Math.max(...vals):1;
    const rng=Math.max(1,mx-mn);
    const yMin=Math.floor((mn-rng*0.08)/1)*1;
    const yMax=Math.ceil((mx+rng*0.1)/1)*1;
    const step=niceStep((yMax-yMin)/(narrow?5:6));
    const tickMin=Math.floor(yMin/step)*step;
    const tickMax=Math.ceil(yMax/step)*step;
    const yTVals:number[]=[];
    for(let v=tickMin;v<=tickMax+step*0.01;v+=step)yTVals.push(v);
    const x0=pad.l,x1=w-pad.r,y0=pad.t,y1=h-pad.b;
    const n=series.length;
    const toX=(i:number)=>n<=1?x0:x0+(i/(n-1))*(x1-x0);
    const toY=(v:number)=>{const t=(v-tickMin)/(tickMax-tickMin||1);return y1-t*(y1-y0);};
    const pts=series.map((p,i)=>({x:toX(i),y:toY(p.netWorth),mi:p.monthIndex,v:p.netWorth}));
    const smooth=()=>{
      if(!pts.length)return'';
      if(pts.length<3)return pts.map((p,i)=>(i?'L':'M')+' '+p.x.toFixed(1)+' '+p.y.toFixed(1)).join(' ');
      let d='M '+pts[0].x.toFixed(1)+' '+pts[0].y.toFixed(1);
      for(let i=1;i<pts.length-1;i++){
        const p0=pts[i],p1=pts[i+1];
        const mx2=(p0.x+p1.x)/2,my2=(p0.y+p1.y)/2;
        d+=' Q '+p0.x.toFixed(1)+' '+p0.y.toFixed(1)+' '+mx2.toFixed(1)+' '+my2.toFixed(1);
      }
      const L=pts[pts.length-1];
      d+=' T '+L.x.toFixed(1)+' '+L.y.toFixed(1);
      return d;
    };
    const lineD=smooth();
    const by=h-pad.b;
    const areaD=pts.length?lineD+' L '+pts[pts.length-1].x.toFixed(1)+' '+by.toFixed(1)+' L '+pts[0].x.toFixed(1)+' '+by.toFixed(1)+' Z':'';
    const lastM=series.length?series[series.length-1].monthIndex:0;
    const plotW=Math.max(1,x1-x0);
    const pxPer=lastM<=1?plotW:plotW/lastM;
    const evPx=Math.max(1,Math.ceil((narrow?48:60)/Math.max(1,pxPer)));
    const evM=lastM<=12?1:lastM<=24?2:lastM<=60?3:6;
    const every=Math.max(evPx,evM);
    const xTicks:{m:number;x:number}[]=[];
    for(let m=0;m<=lastM;m+=every)xTicks.push({m,x:toX(m)});
    if(lastM>0&&xTicks.length&&xTicks[xTicks.length-1].m!==lastM)xTicks.push({m:lastM,x:toX(lastM)});
    const yTicks=yTVals.map(v=>({v,y:toY(v)}));
    const bigNum=Math.max(Math.abs(tickMin),Math.abs(tickMax));
    const yFmt=bigNum>=1e7?fmtK:fmt0;
    return{w,h,pad,pts,lineD,areaD,xTicks,yTicks,yFmt,x0,x1};
  },[series,heightPx,wrapWidth]);
  function hoverAt(cx:number){
    if(!wrapRef.current||!chart.pts.length)return;
    const rect=wrapRef.current.getBoundingClientRect();
    const x=cx-rect.left;
    const clamped=Math.min(chart.x1,Math.max(chart.pad.l,x));
    const t=(clamped-chart.pad.l)/(chart.x1-chart.pad.l||1);
    setHoverIdx(Math.round(t*(chart.pts.length-1)));
  }
  const hover=hoverIdx!=null?chart.pts[hoverIdx]:null;
  const endVal=series[series.length-1]?.netWorth??0;
  const lastPt=chart.pts.length?chart.pts[chart.pts.length-1]:null;
  const ax='#0f172a',axd='#e2e8f0';
  if(!mounted){
    return <div ref={wrapRef} className='w-full rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-900/40' style={{height:heightPx}} />;
  }
  return(
    <div className='w-full' style={{height:heightPx}}>
      <div className='mb-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400'>
        <div>End value: <span className='font-semibold text-slate-900 dark:text-slate-100'>{fmt0(endVal,currency)}</span></div>
        {hover?(<div>{lbl(startMonthISO,hover.mi)} · <span className='font-semibold text-slate-900 dark:text-slate-100'>{fmt0(hover.v,currency)}</span></div>):(<div className='italic opacity-60'>Hover for details</div>)}
      </div>
      <div ref={wrapRef} className='h-[calc(100%-28px)] w-full overflow-hidden rounded-2xl border border-slate-200/60 dark:border-slate-800/60'>
        <svg width={chart.w} height={chart.h} className='block text-blue-500 dark:text-blue-400' onPointerMove={e=>hoverAt(e.clientX)} onPointerDown={e=>hoverAt(e.clientX)} onPointerLeave={()=>setHoverIdx(null)} style={{touchAction:'none'}}>
          <defs>
            <linearGradient id='grad' x1='0' x2='0' y1='0' y2='1'><stop offset='0%' stopColor='currentColor' stopOpacity='0.18'/><stop offset='100%' stopColor='currentColor' stopOpacity='0.02'/></linearGradient>
            <filter id='glow'><feDropShadow dx='0' dy='2' stdDeviation='3' floodColor='currentColor' floodOpacity='0.2'/></filter>
          </defs>
          {chart.yTicks.map((t,i)=>(<g key={i}>
            <line x1={chart.pad.l} x2={chart.w-chart.pad.r} y1={t.y} y2={t.y} stroke='currentColor' opacity={0.07}/>
            <text x={chart.pad.l-12} y={t.y+5} textAnchor='end' fontSize='12' fill={ax} className='dark:hidden' opacity={0.9}>{chart.yFmt(t.v,currency)}</text>
            <text x={chart.pad.l-12} y={t.y+5} textAnchor='end' fontSize='12' fill={axd} className='hidden dark:block' opacity={0.85}>{chart.yFmt(t.v,currency)}</text>
          </g>))}
          {chart.xTicks.map((t,i)=>(<g key={i}>
            <text x={t.x} y={chart.h-chart.pad.b+36} textAnchor='middle' fontSize='12' fill={ax} className='dark:hidden' opacity={t.m%12===0?0.95:0.7}>{lbl(startMonthISO,t.m)}</text>
            <text x={t.x} y={chart.h-chart.pad.b+36} textAnchor='middle' fontSize='12' fill={axd} className='hidden dark:block' opacity={t.m%12===0?0.9:0.65}>{lbl(startMonthISO,t.m)}</text>
          </g>))}
          <path d={chart.areaD} fill='url(#grad)'/>
          <path d={chart.lineD} fill='none' stroke='currentColor' opacity={0.5} strokeWidth={6} strokeLinecap='round' filter='url(#glow)'/>
          <path d={chart.lineD} fill='none' stroke='currentColor' opacity={0.95} strokeWidth={2.5} strokeLinecap='round'/>
          {lastPt&&(<g>
            <circle cx={lastPt.x} cy={lastPt.y} r={5} fill='currentColor' opacity={0.95}/>
            <text x={lastPt.x-10} y={lastPt.y-12} textAnchor='end' fontSize='12' fill={ax} className='dark:hidden' opacity={0.9}>{fmtK(lastPt.v,currency)}</text>
            <text x={lastPt.x-10} y={lastPt.y-12} textAnchor='end' fontSize='12' fill={axd} className='hidden dark:block' opacity={0.9}>{fmtK(lastPt.v,currency)}</text>
          </g>)}
          {hover&&(<g>
            <line x1={hover.x} x2={hover.x} y1={chart.pad.t} y2={chart.h-chart.pad.b} stroke='currentColor' opacity={0.15} strokeDasharray='4 3'/>
            <circle cx={hover.x} cy={hover.y} r={6} fill='currentColor' opacity={0.95}/>
          </g>)}
        </svg>
      </div>
    </div>
  );
}