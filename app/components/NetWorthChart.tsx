'use client';
import{useEffect,useMemo,useRef,useState}from'react';
import type{SeriesPoint}from'../lib/engine';
function safeCurrency(c:string){const x=(c||'').trim().toUpperCase();if(!/^[A-Z]{3}$/.test(x))return'USD';try{new Intl.NumberFormat('en-US',{style:'currency',currency:x}).format(0);return x;}catch{return'USD';}}
function fmtK(n:number,c:string){return new Intl.NumberFormat('en-US',{style:'currency',currency:safeCurrency(c),notation:'compact',compactDisplay:'short',maximumFractionDigits:1}).format(n);}
function fmt0(n:number,c:string){return new Intl.NumberFormat('en-US',{style:'currency',currency:safeCurrency(c),maximumFractionDigits:0}).format(n);}
function parseISO(iso:string){const s=(iso||'').trim();if(!/^\d{4}-\d{2}$/.test(s))return{y:2026,m:0};const y=Number(s.slice(0,4));const mo=Number(s.slice(5,7))-1;return{y,m:mo<0||mo>11?0:mo};}
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function addM(sy:number,sm:number,add:number){const t=sy*12+sm+add;return{y:Math.floor(t/12),m:t%12};}
function lbl(startISO:string,idx:number){const{y:sy,m:sm}=parseISO(startISO);const{y,m}=addM(sy,sm,idx);return MON[m]+' '+String(y).slice(-2);}
function niceStep(range:number,maxTicks:number){const r=Math.max(1,range);const rough=r/maxTicks;const exp=Math.floor(Math.log10(rough));const base=Math.pow(10,exp);const frac=rough/base;let s=frac<=1.5?base:frac<=3?base*2:frac<=7?base*5:base*10;return Math.max(s,1);}
export function NetWorthChart({currency,series,startMonthISO,heightPx=500}:{currency:string;series:SeriesPoint[];startMonthISO:string;heightPx?:number;}){
  const containerRef=useRef<HTMLDivElement|null>(null);
  const[mounted,setMounted]=useState(false);
  const[svgW,setSvgW]=useState(600);
  const[hoverPct,setHoverPct]=useState<number|null>(null);
  useEffect(()=>{
    setMounted(true);
    if(containerRef.current){
      const w=containerRef.current.getBoundingClientRect().width;
      if(w>100)setSvgW(Math.floor(w));
    }
    const onResize=()=>{
      if(containerRef.current){
        const w=containerRef.current.getBoundingClientRect().width;
        if(w>100)setSvgW(Math.floor(w));
      }
    };
    window.addEventListener('resize',onResize);
    return()=>window.removeEventListener('resize',onResize);
  },[]);
  const VH=Math.max(300,heightPx-48);
  const pad={l:80,r:12,t:18,b:56};
  const chart=useMemo(()=>{
    const VW=svgW;
    const vals=series.map(p=>p.netWorth);
    const mn=vals.length?Math.min(...vals):0;
    const mx=vals.length?Math.max(...vals):1;
    const rng=Math.max(1,mx-mn);
    const step=niceStep(rng*1.3,5);
    const tickMin=Math.floor((mn-rng*0.05)/step)*step;
    const tickMax=Math.ceil((mx+rng*0.05)/step)*step;
    const yTVals:number[]=[];
    for(let v=tickMin;v<=tickMax+step*0.01;v+=step)yTVals.push(v);
    const x0=pad.l,x1=VW-pad.r,y0=pad.t,y1=VH-pad.b;
    const n=series.length;
    const toX=(i:number)=>n<=1?x0:x0+(i/(n-1))*(x1-x0);
    const toY=(v:number)=>{const t=(v-tickMin)/(tickMax-tickMin||1);return y1-t*(y1-y0);};
    const pts=series.map((p,i)=>({x:toX(i),y:toY(p.netWorth),mi:p.monthIndex,v:p.netWorth}));
    const smooth=()=>{if(!pts.length)return'';if(pts.length<3)return pts.map((p,i)=>(i?'L':'M')+' '+p.x.toFixed(1)+' '+p.y.toFixed(1)).join(' ');let d='M '+pts[0].x.toFixed(1)+' '+pts[0].y.toFixed(1);for(let i=1;i<pts.length-1;i++){const p0=pts[i],p1=pts[i+1];const mx2=(p0.x+p1.x)/2,my2=(p0.y+p1.y)/2;d+=' Q '+p0.x.toFixed(1)+' '+p0.y.toFixed(1)+' '+mx2.toFixed(1)+' '+my2.toFixed(1);}const L=pts[pts.length-1];d+=' T '+L.x.toFixed(1)+' '+L.y.toFixed(1);return d;};
    const lineD=smooth();
    const by=VH-pad.b;
    const areaD=pts.length?lineD+' L '+pts[pts.length-1].x.toFixed(1)+' '+by.toFixed(1)+' L '+pts[0].x.toFixed(1)+' '+by.toFixed(1)+' Z':'';
    const lastM=series.length?series[series.length-1].monthIndex:0;
    const plotW=Math.max(1,x1-x0);
    const pxPer=lastM<=1?plotW:plotW/lastM;
    const evPx=Math.max(1,Math.ceil(55/Math.max(1,pxPer)));
    const evM=lastM<=12?1:lastM<=24?2:lastM<=60?3:6;
    const every=Math.max(evPx,evM);
    const xTicks:{m:number;x:number}[]=[];
    for(let m=0;m<=lastM;m+=every)xTicks.push({m,x:toX(m)});
    if(lastM>0&&xTicks.length&&xTicks[xTicks.length-1].m!==lastM)xTicks.push({m:lastM,x:toX(lastM)});
    const yTicks=yTVals.map(v=>({v,y:toY(v)}));
    return{VW,pts,lineD,areaD,xTicks,yTicks,x0,x1};
  },[series,svgW]);
  const hoverIdx=useMemo(()=>{if(hoverPct===null||!chart.pts.length)return null;return Math.round(hoverPct*(chart.pts.length-1));},[hoverPct,chart.pts.length]);
  const hover=hoverIdx!=null?chart.pts[hoverIdx]:null;
  const endVal=series[series.length-1]?.netWorth??0;
  const lastPt=chart.pts.length?chart.pts[chart.pts.length-1]:null;
  const ax='currentColor';
  function onPointer(e:React.PointerEvent<SVGSVGElement>){const svg=e.currentTarget;const rect=svg.getBoundingClientRect();const xPx=e.clientX-rect.left;const clamped=Math.min(chart.x1,Math.max(chart.x0||pad.l,xPx));setHoverPct((clamped-(chart.x0||pad.l))/((chart.x1-(chart.x0||pad.l))||1));}
  if(!mounted)return<div ref={containerRef} className='w-full rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-900/40' style={{height:heightPx}}/>;
  return(
    <div className='w-full' style={{height:heightPx}}>
      <div className='mb-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1'>
        <div>End value: <span className='font-semibold text-slate-900 dark:text-slate-100'>{fmt0(endVal,currency)}</span></div>
        {hover?<div>{lbl(startMonthISO,hover.mi)} · <span className='font-semibold text-slate-900 dark:text-slate-100'>{fmt0(hover.v,currency)}</span></div>:<div className='opacity-50 italic'>Hover for details</div>}
      </div>
      <div ref={containerRef} className='w-full overflow-hidden rounded-2xl border border-slate-200/60 dark:border-slate-800/60' style={{height:heightPx-24}}>
        <svg width={chart.VW} height={VH} className='block text-blue-500 dark:text-blue-400' onPointerMove={onPointer} onPointerDown={onPointer} onPointerLeave={()=>setHoverPct(null)} style={{touchAction:'none',width:'100%',height:'100%'}}>
          <defs><linearGradient id='grad' x1='0' x2='0' y1='0' y2='1'><stop offset='0%' stopColor='currentColor' stopOpacity='0.2'/><stop offset='100%' stopColor='currentColor' stopOpacity='0.02'/></linearGradient><filter id='glow'><feDropShadow dx='0' dy='2' stdDeviation='3' floodColor='currentColor' floodOpacity='0.2'/></filter></defs>
          {chart.yTicks.map((t,i)=>(<g key={i}><line x1={pad.l} x2={chart.VW-pad.r} y1={t.y} y2={t.y} stroke={ax} opacity={0.1}/><text x={pad.l-5} y={t.y+4} textAnchor='end' fontSize='16' fill={ax} className='text-slate-900 dark:text-slate-100' opacity={0.9}>{fmtK(t.v,currency)}</text></g>))}
          {chart.xTicks.map((t,i)=>(<g key={i}><text x={t.x} y={VH-pad.b+16} textAnchor='middle' fontSize='16' fill={ax} className='text-slate-900 dark:text-slate-100' opacity={t.m%12===0?0.9:0.65}>{lbl(startMonthISO,t.m)}</text></g>))}
          <path d={chart.areaD} fill='url(#grad)'/>
          <path d={chart.lineD} fill='none' stroke='currentColor' opacity={0.4} strokeWidth={8} strokeLinecap='round' filter='url(#glow)'/>
          <path d={chart.lineD} fill='none' stroke='currentColor' opacity={0.95} strokeWidth={3} strokeLinecap='round'/>
          {lastPt&&<g><circle cx={lastPt.x} cy={lastPt.y} r={5} fill='currentColor' opacity={0.95}/><text x={lastPt.x-8} y={lastPt.y-10} textAnchor='end' fontSize='16' fill={ax} className='text-slate-900 dark:text-slate-100' opacity={0.9}>{fmtK(lastPt.v,currency)}</text></g>}
          {hover&&<g><line x1={hover.x} x2={hover.x} y1={pad.t} y2={VH-pad.b} stroke='currentColor' opacity={0.2} strokeDasharray='4 3'/><circle cx={hover.x} cy={hover.y} r={5} fill='currentColor' opacity={0.95}/></g>}
        </svg>
      </div>
    </div>
  );
}
