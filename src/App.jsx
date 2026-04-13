import { useState, useRef, useEffect, createContext, useContext } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function useIsMobile(){
  const[mob,setMob]=useState(typeof window!=="undefined"&&window.innerWidth<768);
  useEffect(()=>{const h=()=>setMob(window.innerWidth<768);window.addEventListener("resize",h);return()=>window.removeEventListener("resize",h);},[]);
  return mob;
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const PILLARS = [
  { name:"Transformation",  color:"#3B6D11", bg:"#EEF3C7" },
  { name:"Education",       color:"#0F6E56", bg:"#99F6E4" },
  { name:"BTS & Culture",   color:"#712B13", bg:"#FF9B9B" },
  { name:"Client Stories",  color:"#534AB7", bg:"#C4B5FD" },
  { name:"Founder's Voice", color:"#534AB7", bg:"#C4B5FD" },
];
const PILLAR_TARGETS = { "Transformation":30,"Education":25,"BTS & Culture":20,"Client Stories":15,"Founder's Voice":10 };
const DAYS      = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const DAY_IDX   = { Mon:0,Tue:1,Wed:2,Thu:3,Fri:4,Sat:5,Sun:6 };
const FORMATS   = ["Reel","Carousel","Static","Testimonial","Story Reel"];
// Returns ["1","2",...] for however many Mon-started weeks the month contains
function getWeeksForMonth(m,yr){
  const idx=MONTHS.indexOf(m); if(idx===-1) return["1","2","3","4"];
  const first=new Date(yr,idx,1), last=new Date(yr,idx+1,0);
  let n=1; const d=new Date(first); d.setDate(2);
  while(d<=last){if(d.getDay()===1)n++; d.setDate(d.getDate()+1);}
  return Array.from({length:n},(_,i)=>String(i+1));
}
// Returns "1–5" style date range string for a given week within a month
function getWeekDateRange(m,wk,yr){
  const idx=MONTHS.indexOf(m); if(idx===-1) return"";
  const first=new Date(yr,idx,1), last=new Date(yr,idx+1,0);
  let cur=1,ws=1;
  for(let d=new Date(first);d<=last;d.setDate(d.getDate()+1)){
    const dt=d.getDate(),dow=d.getDay();
    if(dow===1&&dt!==1){if(cur===Number(wk)) return`${ws}–${dt-1}`; cur++;ws=dt;}
  }
  if(cur===Number(wk)) return`${ws}–${last.getDate()}`;
  return"";
}
const STATUSES  = ["Draft","For Review","Approved","For Revision","Uploaded"];
const STORY_TYPES = ["Unique — BTS moment","Unique — Poll / Quiz","Unique — Behind the chair","Unique — Team feature","Unique — Offer / Giveaway","Unique — Client reaction","Unique — Education","Repost from feed"];
// zoom=0 → smallest grid (zoom out, more rows visible); zoom=4 → full-width grid (zoom in, fewer rows visible)
const GRID_ZOOM_WIDTHS = [42, 58, 74, 87, 100];
const NAV_ITEMS = ["Feed Calendar","Stories","Analytics"];
const RoleCtx=createContext("team");
const useRole=()=>useContext(RoleCtx);
// Set VITE_ADMIN_CODE / VITE_CLIENT_CODE / VITE_TEAM_CODE in Netlify env vars to change passcodes
const ROLE_CODES={
  [import.meta.env.VITE_ADMIN_CODE||"trs-admin"]:"admin",
  [import.meta.env.VITE_CLIENT_CODE||"trs-client"]:"client",
  [import.meta.env.VITE_TEAM_CODE||"trs-team"]:"team",
};

const PF="'Playfair Display',Georgia,serif";
const IN="'Inter',-apple-system,BlinkMacSystemFont,sans-serif";
const TEAL="#99F6E4",GREEN="#EEF3C7",PURPLE="#C4B5FD",CORAL="#FF9B9B";
const BG="#141414",SURF="#1E1E1E",SURF2="#252525",SURF3="#2E2E2E";
const BORDER="#333333",BORDER2="#2A2A2A";
const TX1="#F0EDE6",TX2="#B8B5AE",TX3="#6B6966",TX4="#3E3C3A";
const SS={
  "Draft":       {bg:"#252520",color:"#A8A89A",border:"#3A3A30"},
  "For Review":  {bg:"#0A2420",color:TEAL,    border:"#0F6E56"},
  "Approved":    {bg:"#1A2408",color:GREEN,   border:"#3B6D11"},
  "For Revision":{bg:"#2A0C08",color:CORAL,   border:"#712B13"},
  "Uploaded":    {bg:"#1A1830",color:PURPLE,  border:"#534AB7"},
};

function getPillar(n){ return PILLARS.find(p=>p.name===n)||PILLARS[0]; }
function getSS(s){ return SS[s]||SS["Draft"]; }

function checkIsVideo(f){
  if(!f||!f.url) return false;
  return f.url.startsWith("data:video")||!!(f.name||"").match(/\.(mp4|mov|webm)$/i)||!!f.url.match(/\.(mp4|mov|webm)(\?|$)/i);
}

function sortOldestFirst(arr){
  return [...arr].sort((a,b)=>{
    const w=Number(a.week)-Number(b.week);
    if(w!==0) return w;
    return (DAY_IDX[a.day]||0)-(DAY_IDX[b.day]||0);
  });
}
function sortNewestFirst(arr){
  return [...arr].sort((a,b)=>{
    const w=Number(b.week)-Number(a.week);
    if(w!==0) return w;
    return (DAY_IDX[b.day]||0)-(DAY_IDX[a.day]||0);
  });
}

// Safely extract URL string from whatever Supabase returns
function toFileObj(item){
  if(!item) return null;
  if(typeof item==="string") return {url:item,name:""};
  if(typeof item==="object"&&item.url) return {url:item.url,name:item.name||""};
  return null;
}

function normalise(row,type){
  const imgs=(row.image_urls||[]).map(toFileObj).filter(Boolean);
  if(type==="feed"){
    return{
      ...row,
      images:imgs,
      video:row.video_url?[{url:row.video_url,name:""}]:[],
      comments:row.comments||[],
    };
  }
  return{...row,images:imgs,comments:row.comments||[]};
}

async function uploadToStorage(file){
  const ext=(file.name||"upload").split(".").pop();
  const path=`${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const{error}=await supabase.storage.from("media").upload(path,file);
  if(error){console.error("Upload error:",error);return null;}
  const{data}=supabase.storage.from("media").getPublicUrl(path);
  return{url:data.publicUrl,name:file.name||path};
}

async function uploadFiles(fileObjs){
  const results=[];
  for(const f of fileObjs){
    if(f.url&&f.url.startsWith("http")) results.push(f);
    else if(f.url&&f.url.startsWith("data:")){
      const blob=await fetch(f.url).then(r=>r.blob());
      const file=new File([blob],f.name||"upload",{type:blob.type});
      const up=await uploadToStorage(file);
      if(up) results.push(up);
    }
  }
  return results;
}

// ── Micro UI ──────────────────────────────────────────────────────

function Label({children}){return<div style={{fontFamily:IN,fontSize:10,fontWeight:600,color:TX3,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:6}}>{children}</div>;}
function SectionRule({color=CORAL}){return<div style={{width:40,height:2,background:color,borderRadius:1,marginBottom:14}}/>;}
function HL({children,size=26}){return<div style={{fontFamily:PF,fontWeight:700,fontStyle:"italic",fontSize:size,color:TX1,lineHeight:1.15}}>{children}</div>;}
function Tag({label,bg,color}){return<span style={{display:"inline-block",fontFamily:IN,fontSize:10,fontWeight:600,padding:"3px 10px",borderRadius:20,background:bg,color:color,letterSpacing:"0.04em"}}>{label}</span>;}
function StatusPill({status}){const s=getSS(status);return<span style={{display:"inline-block",fontFamily:IN,fontSize:10,fontWeight:600,padding:"3px 10px",borderRadius:20,background:s.bg,color:s.color,border:`1px solid ${s.border}`,letterSpacing:"0.04em"}}>{status}</span>;}
function StatusDrop({value,onChange}){const s=getSS(value);return<div style={{position:"relative",display:"inline-block"}}><select value={value} onChange={e=>onChange(e.target.value)} style={{fontFamily:IN,fontSize:11,fontWeight:600,padding:"5px 26px 5px 10px",borderRadius:20,border:`1px solid ${s.border}`,background:s.bg,color:s.color,cursor:"pointer",appearance:"none"}}>{STATUSES.map(x=><option key={x}>{x}</option>)}</select><span style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",fontSize:8,color:s.color,pointerEvents:"none"}}>▼</span></div>;}
function Inp({value,onChange,placeholder}){return<input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder||""} style={{width:"100%",fontFamily:IN,fontWeight:600,fontSize:13,padding:"9px 12px",borderRadius:8,border:`1px solid ${BORDER}`,background:SURF2,color:TX1,boxSizing:"border-box"}}/>;}
function Sel({value,onChange,children}){return<select value={value} onChange={e=>onChange(e.target.value)} style={{width:"100%",fontFamily:IN,fontWeight:600,fontSize:13,padding:"9px 10px",borderRadius:8,border:`1px solid ${BORDER}`,background:SURF2,color:TX1,boxSizing:"border-box"}}>{children}</select>;}
function Txt({value,onChange,rows,placeholder}){return<textarea value={value} onChange={e=>onChange(e.target.value)} rows={rows||4} placeholder={placeholder||""} style={{width:"100%",fontFamily:IN,fontWeight:600,fontSize:13,padding:"9px 12px",borderRadius:8,border:`1px solid ${BORDER}`,background:SURF2,color:TX1,resize:"vertical",lineHeight:1.7,boxSizing:"border-box"}}/>;}
function FRow({label,children}){return<div style={{marginBottom:14}}><Label>{label}</Label>{children}</div>;}

// ── Upload ────────────────────────────────────────────────────────

function UploadZone({files,onChange,multiple,accept,hint}){
  const ref=useRef();
  const handle=async raw=>{
    const results=await Promise.all(Array.from(raw).map(f=>new Promise(res=>{const r=new FileReader();r.onload=e=>res({url:e.target.result,name:f.name});r.readAsDataURL(f);})));
    onChange(multiple?[...files,...results]:[results[0]]);
  };
  const rm=i=>onChange(files.filter((_,idx)=>idx!==i));
  return(
    <div>
      <div onClick={()=>ref.current.click()} style={{border:`1.5px dashed ${BORDER}`,borderRadius:8,padding:"14px 12px",textAlign:"center",cursor:"pointer",background:SURF2}}>
        <div style={{fontFamily:IN,fontSize:12,fontWeight:600,color:TX3}}>Click to upload{multiple?" — multiple allowed":""}</div>
        {hint&&<div style={{fontFamily:IN,fontSize:11,color:TX4,marginTop:2}}>{hint}</div>}
      </div>
      <input ref={ref} type="file" accept={accept||"image/*,video/*"} multiple={!!multiple} style={{display:"none"}} onChange={e=>handle(e.target.files)}/>
      {files.length>0&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>
        {files.map((f,i)=>(
          <div key={i} style={{position:"relative",width:58,height:58}}>
            {checkIsVideo(f)?<div style={{width:58,height:58,borderRadius:6,border:`1px solid ${BORDER}`,background:"#111",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontFamily:IN,fontWeight:600,color:TX2}}>VIDEO</div>
              :<img src={f.url} alt="" style={{width:58,height:58,objectFit:"cover",borderRadius:6,border:`1px solid ${BORDER}`}}/>}
            <button onClick={()=>rm(i)} style={{position:"absolute",top:-5,right:-5,width:16,height:16,borderRadius:"50%",background:CORAL,border:"none",color:"#4A1B0C",fontSize:9,cursor:"pointer",fontWeight:700,padding:0,lineHeight:1}}>×</button>
          </div>
        ))}
      </div>}
    </div>
  );
}

// ── Media Preview ─────────────────────────────────────────────────

function MediaPreview({files,format,thumbnail,clickToPlay,style={}}){
  const[playing,setPlaying]=useState(false);
  const[cidx,setCidx]=useState(0);
  if(!files||!files.length) return null;
  const f=files[0];
  const vid=checkIsVideo(f);
  if(vid){
    const thumb=thumbnail&&thumbnail.length>0?thumbnail[0]:null;
    if(clickToPlay&&!playing){
      return(
        <div onClick={()=>setPlaying(true)} style={{width:"100%",height:"100%",position:"relative",cursor:"pointer",background:"#000",...style}}>
          {thumb?<img src={thumb.url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<div style={{width:"100%",height:"100%",background:"#111"}}/>}
          <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{width:52,height:52,borderRadius:"50%",background:"rgba(0,0,0,0.6)",border:"2px solid rgba(255,255,255,0.6)",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M4 2l16 10L4 22V2z"/></svg>
            </div>
          </div>
        </div>
      );
    }
    return<video src={f.url} style={{width:"100%",height:"100%",objectFit:"cover",...style}} controls autoPlay playsInline poster={thumbnail?.[0]?.url}/>;
  }
  if(format==="Carousel"&&files.length>1){
    const cf=files[Math.min(cidx,files.length-1)];
    return(
      <div style={{...style,position:"relative",width:"100%",height:"100%"}}>
        <img src={cf.url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
        <div style={{position:"absolute",top:6,left:0,right:0,display:"flex",gap:2,padding:"0 8px",pointerEvents:"none"}}>
          {files.map((_,i)=><div key={i} style={{flex:1,height:2,borderRadius:1,background:i===cidx?"rgba(255,255,255,0.95)":"rgba(255,255,255,0.35)"}}/>)}
        </div>
        {cidx>0&&<button onClick={e=>{e.stopPropagation();setCidx(i=>Math.max(0,i-1));}} style={{position:"absolute",left:6,top:"50%",transform:"translateY(-50%)",width:28,height:28,borderRadius:"50%",background:"rgba(0,0,0,0.5)",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M15 18l-6-6 6-6"/></svg>
        </button>}
        {cidx<files.length-1&&<button onClick={e=>{e.stopPropagation();setCidx(i=>Math.min(files.length-1,i+1));}} style={{position:"absolute",right:6,top:"50%",transform:"translateY(-50%)",width:28,height:28,borderRadius:"50%",background:"rgba(0,0,0,0.5)",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M9 18l6-6-6-6"/></svg>
        </button>}
        <div style={{position:"absolute",bottom:8,right:10,background:"rgba(0,0,0,0.55)",borderRadius:4,padding:"2px 7px",fontSize:9,fontFamily:IN,fontWeight:700,color:"#fff"}}>{cidx+1}/{files.length}</div>
      </div>
    );
  }
  return<img src={f.url} alt="" style={{width:"100%",height:"100%",objectFit:"cover",...style}}/>;
}

function MediaFields({draft,setDraft}){
  const fmt=draft.format;
  if(fmt==="Static"||fmt==="Testimonial"||fmt==="Story Reel") return<FRow label="Photo / image"><UploadZone files={draft.images||[]} onChange={f=>setDraft(d=>({...d,images:f}))} accept="image/*" hint="One image"/></FRow>;
  if(fmt==="Carousel") return<FRow label="Carousel images"><UploadZone multiple files={draft.images||[]} onChange={f=>setDraft(d=>({...d,images:f}))} accept="image/*" hint="Upload all slides"/></FRow>;
  if(fmt==="Reel") return(<><FRow label="Reel video"><UploadZone files={draft.video||[]} onChange={f=>setDraft(d=>({...d,video:f}))} accept="video/*" hint="MP4 or MOV"/></FRow><FRow label="Thumbnail image"><UploadZone files={draft.images||[]} onChange={f=>setDraft(d=>({...d,images:f}))} accept="image/*" hint="One thumbnail"/></FRow></>);
  return null;
}

// ── Story Frame Viewer ────────────────────────────────────────────

function StoryFrameViewer({images}){
  const[idx,setIdx]=useState(0);
  if(!images||!images.length) return<div style={{width:"100%",height:"100%",background:SURF3,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{fontFamily:IN,fontSize:12,color:TX4,fontStyle:"italic"}}>No images uploaded</div></div>;
  const total=images.length;
  const cur=images[idx];
  return(
    <div style={{position:"relative",width:"100%",height:"100%"}}>
      <img src={cur.url} alt="" style={{width:"100%",height:"100%",objectFit:"cover",position:"absolute",inset:0}}/>
      {total>1&&(
        <>
          <div style={{position:"absolute",top:8,left:0,right:0,display:"flex",gap:3,padding:"0 10px"}}>
            {images.map((_,i)=><div key={i} style={{flex:1,height:2,borderRadius:1,background:i===idx?"rgba(255,255,255,0.95)":"rgba(255,255,255,0.35)"}}/>)}
          </div>
          {idx>0&&<button onClick={e=>{e.stopPropagation();setIdx(i=>i-1);}} style={{position:"absolute",left:6,top:"50%",transform:"translateY(-50%)",width:28,height:28,borderRadius:"50%",background:"rgba(0,0,0,0.5)",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M15 18l-6-6 6-6"/></svg>
          </button>}
          {idx<total-1&&<button onClick={e=>{e.stopPropagation();setIdx(i=>i+1);}} style={{position:"absolute",right:6,top:"50%",transform:"translateY(-50%)",width:28,height:28,borderRadius:"50%",background:"rgba(0,0,0,0.5)",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M9 18l6-6-6-6"/></svg>
          </button>}
          <div style={{position:"absolute",bottom:8,right:10,background:"rgba(0,0,0,0.55)",borderRadius:4,padding:"2px 7px",fontSize:9,fontFamily:IN,fontWeight:700,color:"#fff"}}>{idx+1}/{total}</div>
        </>
      )}
    </div>
  );
}

// ── Approval ──────────────────────────────────────────────────────

function ApprovalPanel({status,onChange}){
  const role=useRole();
  const msgs={"Draft":"Not yet submitted.","For Review":"Waiting on client.","Approved":"Client approved — ready to schedule.","For Revision":"Changes requested — see comments.","Uploaded":"Live."};
  const s=getSS(status);
  const allActions=[{label:"For Review",s:"For Review"},{label:"Approve",s:"Approved"},{label:"For Revision",s:"For Revision"}];
  const actions=role==="admin"?allActions:role==="client"?allActions.filter(a=>a.s==="Approved"||a.s==="For Revision"):[];
  return(
    <div style={{border:`1px solid ${s.border}`,borderRadius:10,overflow:"hidden",marginBottom:16}}>
      <div style={{padding:"10px 14px",background:s.bg,borderBottom:actions.length>0?`1px solid ${s.border}`:"none",display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:7,height:7,borderRadius:"50%",background:s.color,flexShrink:0}}/>
        <div><Label>{status}</Label><div style={{fontFamily:IN,fontSize:12,fontWeight:600,color:s.color,marginTop:1}}>{msgs[status]}</div></div>
      </div>
      {actions.length>0&&<div style={{display:"grid",gridTemplateColumns:`repeat(${actions.length},1fr)`,background:SURF}}>
        {actions.map((a,i)=>{const as=getSS(a.s);const active=status===a.s;
          return<button key={a.s} onClick={()=>onChange(a.s)} style={{padding:"10px 6px",fontFamily:IN,fontSize:12,fontWeight:600,border:"none",borderRight:i<actions.length-1?`1px solid ${BORDER}`:"none",cursor:"pointer",background:active?as.bg:SURF,color:active?as.color:TX3}}>{a.label}</button>;
        })}
      </div>}
    </div>
  );
}

function Comments({comments,val,setVal,onAdd,onEdit,onDelete}){
  const[editIdx,setEditIdx]=useState(null);
  const[editVal,setEditVal]=useState("");
  const startEdit=(i)=>{setEditIdx(i);setEditVal(comments[i]);};
  const saveEdit=()=>{if(editVal.trim()&&onEdit){onEdit(editIdx,editVal.trim());}setEditIdx(null);setEditVal("");};
  const cancelEdit=()=>{setEditIdx(null);setEditVal("");};
  return(
    <div style={{borderTop:`1px solid ${BORDER2}`,paddingTop:14}}>
      <Label>Comments {comments.length>0&&`(${comments.length})`}</Label>
      {comments.length===0&&<div style={{fontFamily:IN,fontSize:12,fontWeight:600,color:TX4,marginBottom:10}}>No comments yet</div>}
      {comments.map((c,i)=>(
        <div key={i} style={{display:"flex",gap:8,marginBottom:10}}>
          <div style={{width:26,height:26,borderRadius:"50%",background:SURF3,border:`1px solid ${BORDER}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontFamily:IN,fontWeight:700,color:TEAL,flexShrink:0}}>SM</div>
          <div style={{flex:1}}>
            {editIdx===i?(
              <div>
                <input value={editVal} onChange={e=>setEditVal(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")saveEdit();if(e.key==="Escape")cancelEdit();}} autoFocus style={{width:"100%",fontFamily:IN,fontWeight:600,fontSize:12,padding:"6px 10px",borderRadius:8,border:`1px solid ${TEAL}`,background:SURF2,color:TX1,boxSizing:"border-box",marginBottom:6}}/>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={saveEdit} style={{padding:"4px 12px",fontFamily:IN,fontSize:11,fontWeight:700,borderRadius:6,border:`1px solid ${TEAL}`,background:`${TEAL}18`,color:TEAL,cursor:"pointer"}}>Save</button>
                  <button onClick={cancelEdit} style={{padding:"4px 12px",fontFamily:IN,fontSize:11,fontWeight:600,borderRadius:6,border:`1px solid ${BORDER}`,background:SURF3,color:TX3,cursor:"pointer"}}>Cancel</button>
                </div>
              </div>
            ):(
              <div style={{fontSize:13,fontFamily:IN,fontWeight:600,color:TX2,background:SURF2,borderRadius:8,padding:"8px 12px",border:`1px solid ${BORDER}`,lineHeight:1.6}}>
                <div>{c}</div>
                {(onEdit||onDelete)&&<div style={{display:"flex",gap:10,marginTop:5,borderTop:`1px solid ${BORDER2}`,paddingTop:5}}>
                  {onEdit&&<button onClick={()=>startEdit(i)} style={{border:"none",background:"none",cursor:"pointer",color:TX4,fontFamily:IN,fontSize:10,fontWeight:700,padding:0,letterSpacing:"0.04em"}}>EDIT</button>}
                  {onDelete&&<button onClick={()=>onDelete(i)} style={{border:"none",background:"none",cursor:"pointer",color:CORAL,fontFamily:IN,fontSize:10,fontWeight:700,padding:0,letterSpacing:"0.04em"}}>DELETE</button>}
                </div>}
              </div>
            )}
          </div>
        </div>
      ))}
      {onAdd&&<div style={{display:"flex",gap:8,marginTop:8}}>
        <input value={val} onChange={e=>setVal(e.target.value)} onKeyDown={e=>e.key==="Enter"&&onAdd()} placeholder="Leave a comment..." style={{flex:1,fontFamily:IN,fontWeight:600,fontSize:13,padding:"8px 12px",borderRadius:8,border:`1px solid ${BORDER}`,background:SURF2,color:TX1}}/>
        <button onClick={onAdd} style={{padding:"8px 16px",fontFamily:IN,fontSize:12,fontWeight:700,borderRadius:8,border:`1px solid ${BORDER}`,cursor:"pointer",background:SURF3,color:TX2}}>Post</button>
      </div>}
    </div>
  );
}

function PillarTracker({items}){
  const isMob=useIsMobile();
  const total=items.length||1;
  return(
    <div style={{display:"grid",gridTemplateColumns:isMob?"repeat(2,1fr)":"repeat(5,1fr)",gap:10,marginBottom:16}}>
      {PILLARS.map(p=>{
        const count=items.filter(x=>x.pillar===p.name).length;
        const actual=Math.round((count/total)*100);
        const target=PILLAR_TARGETS[p.name];
        const ok=Math.abs(actual-target)<=6;
        return(
          <div key={p.name} style={{background:SURF,borderRadius:10,padding:14,border:`1px solid ${BORDER}`}}>
            <Tag label={p.name} bg={p.bg} color={p.color}/>
            <div style={{fontFamily:PF,fontWeight:700,fontStyle:"italic",fontSize:28,color:TX1,lineHeight:1,marginTop:10,marginBottom:8}}>{actual}%</div>
            <div style={{height:2,background:SURF3,borderRadius:1}}><div style={{height:"100%",width:Math.min(actual,100)+"%",background:ok?p.bg:"#E24B4A",borderRadius:1}}/></div>
            <div style={{fontFamily:IN,fontSize:10,fontWeight:600,color:ok?TX3:"#E24B4A",marginTop:5,letterSpacing:"0.04em"}}>target {target}%</div>
          </div>
        );
      })}
    </div>
  );
}

function Shell({title,rule,onCancel,onSave,saveLabel,saving,children}){
  const isMob=useIsMobile();
  return(
    <div style={{background:SURF,border:`1px solid ${BORDER}`,borderRadius:12,padding:isMob?"16px 14px":"22px 24px",marginBottom:18}}>
      <SectionRule color={rule||TEAL}/><HL size={18}>{title}</HL>
      <div style={{height:1,background:BORDER2,margin:"16px 0"}}/>
      {children}
      <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:14,borderTop:`1px solid ${BORDER2}`,marginTop:4}}>
        <button onClick={onCancel} style={{padding:"9px 20px",fontFamily:IN,fontSize:13,fontWeight:600,borderRadius:8,border:`1px solid ${BORDER}`,cursor:"pointer",background:"transparent",color:TX3}}>Cancel</button>
        <button onClick={onSave} disabled={!!saving} style={{padding:"9px 22px",fontFamily:IN,fontSize:13,fontWeight:700,borderRadius:8,border:`1px solid ${TEAL}`,cursor:"pointer",background:`${TEAL}22`,color:TEAL,opacity:saving?0.6:1}}>{saving?"Saving...":saveLabel}</button>
      </div>
    </div>
  );
}

function ContentStats({items,label}){
  const total=items.length;
  const isMob=useIsMobile();
  const pillarAnalysis=PILLARS.map(p=>{
    const count=items.filter(x=>x.pillar===p.name).length;
    const actual=total>0?Math.round((count/total)*100):0;
    const target=PILLAR_TARGETS[p.name];
    const targetCount=total>0?Math.round(total*target/100):0;
    const diff=count-targetCount; // positive = too many, negative = need more
    return{...p,count,actual,target,targetCount,diff};
  });
  return(
    <div style={{marginBottom:14,border:`1px solid ${BORDER}`,borderLeft:`3px solid ${TEAL}`,borderRadius:10,padding:"14px 16px",background:SURF2}}>
      {/* Status counts row */}
      <div style={{display:"flex",alignItems:"center",flexWrap:"wrap",gap:6,marginBottom:12}}>
        <span style={{fontFamily:IN,fontSize:10,fontWeight:700,color:TEAL,letterSpacing:"0.1em",textTransform:"uppercase",marginRight:2}}>{label}</span>
        <span style={{fontFamily:IN,fontSize:13,fontWeight:700,color:TX1,background:SURF3,borderRadius:20,padding:"4px 14px",border:`1px solid ${BORDER}`}}>{total} total</span>
        {STATUSES.map(s=>{
          const count=items.filter(x=>x.status===s).length;
          if(!count) return null;
          const ss=getSS(s);
          return<span key={s} style={{fontFamily:IN,fontSize:13,fontWeight:700,color:ss.color,background:ss.bg,borderRadius:20,padding:"4px 14px",border:`1px solid ${ss.border}`}}>{count} {s}</span>;
        })}
      </div>
      {/* Pillar gap analysis */}
      {total>0?(
        <div style={{display:"grid",gridTemplateColumns:isMob?"1fr 1fr":"repeat(5,1fr)",gap:6}}>
          {pillarAnalysis.map(p=>{
            const needMore=p.diff<-1;
            const tooMany=p.diff>1;
            return(
              <div key={p.name} style={{borderRadius:8,padding:"8px 10px",background:p.bg,border:`1.5px solid ${p.color}44`}}>
                <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:6}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:p.color,flexShrink:0}}/>
                  <span style={{fontFamily:IN,fontSize:10,fontWeight:700,color:p.color,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{p.name}</span>
                </div>
                <div style={{fontFamily:IN,fontSize:20,fontWeight:700,color:p.color,lineHeight:1,marginBottom:2}}>{p.count}</div>
                <div style={{fontFamily:IN,fontSize:10,fontWeight:600,color:p.color,opacity:0.65,marginBottom:4}}>of {p.targetCount} target · {p.actual}% / {p.target}%</div>
                {needMore&&<div style={{fontFamily:IN,fontSize:11,fontWeight:700,color:p.color}}>↑ need {Math.abs(p.diff)} more</div>}
                {tooMany&&<div style={{fontFamily:IN,fontSize:11,fontWeight:700,color:p.color}}>↓ {p.diff} over target</div>}
                {!needMore&&!tooMany&&<div style={{fontFamily:IN,fontSize:10,fontWeight:600,color:p.color,opacity:0.8}}>✓ on target</div>}
              </div>
            );
          })}
        </div>
      ):(
        <div style={{fontFamily:IN,fontSize:12,color:TX4,fontStyle:"italic"}}>Add your first {label.toLowerCase()} to see pillar stats.</div>
      )}
    </div>
  );
}

function PostForm({onAdd,onCancel,type,month,year}){
  const blank=type==="feed"
    ?{week:"1",day:"Mon",pillar:"Transformation",format:"Reel",subject:"",caption:"",hashtags:"",status:"Draft",comments:[],images:[],video:[]}
    :{week:"1",day:"Mon",type:"Unique — BTS moment",pillar:"BTS & Culture",frames:"",caption:"",status:"Draft",comments:[],images:[]};
  const[d,setD]=useState(blank);
  const[saving,setSaving]=useState(false);
  const u=(k,v)=>setD(x=>({...x,[k]:v}));
  const isMob=useIsMobile();
  const ss=getSS(d.status);
  const save=async()=>{
    if(type==="feed"&&!d.subject.trim()){alert("Please add a subject.");return;}
    setSaving(true);
    try{
      const imgs=await uploadFiles(d.images||[]);
      const vids=await uploadFiles(d.video||[]);
      const table=type==="feed"?"feed_posts":"story_sequences";
      const payload=type==="feed"
        ?{month,year,week:d.week,day:d.day,pillar:d.pillar,format:d.format,subject:d.subject,caption:d.caption,hashtags:d.hashtags,status:d.status,comments:[],image_urls:imgs,video_url:vids[0]?.url||null}
        :{month,year,week:d.week,day:d.day,type:d.type,pillar:d.pillar,frames:d.frames,caption:d.caption,status:d.status,comments:[],image_urls:imgs};
      const{data,error}=await supabase.from(table).insert([payload]).select();
      if(error) throw error;
      onAdd(normalise(data[0],type));
    }catch(e){alert("Save failed: "+e.message);}
    finally{setSaving(false);}
  };
  return(
    <Shell title={type==="feed"?"New feed post":"New story sequence"} onCancel={onCancel} onSave={save} saveLabel="Save post" saving={saving}>
      <div style={{display:"grid",gridTemplateColumns:isMob?"1fr":"1fr 1fr 1fr",gap:10,marginBottom:4}}>
        <FRow label="Week"><Sel value={d.week} onChange={v=>u("week",v)}>{getWeeksForMonth(month,year).map(w=><option key={w} value={w}>Week {w} · {getWeekDateRange(month,w,year)}</option>)}</Sel></FRow>
        <FRow label="Day"><Sel value={d.day} onChange={v=>u("day",v)}>{DAYS.map(x=><option key={x}>{x}</option>)}</Sel></FRow>
        {type==="feed"?<FRow label="Format"><Sel value={d.format} onChange={v=>u("format",v)}>{FORMATS.map(x=><option key={x}>{x}</option>)}</Sel></FRow>
          :<FRow label="Story type"><Sel value={d.type} onChange={v=>u("type",v)}>{STORY_TYPES.map(x=><option key={x}>{x}</option>)}</Sel></FRow>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:isMob?"1fr":"1fr 1fr",gap:10,marginBottom:4}}>
        <FRow label="Pillar"><Sel value={d.pillar} onChange={v=>u("pillar",v)}>{PILLARS.map(p=><option key={p.name}>{p.name}</option>)}</Sel></FRow>
        <FRow label="Status"><select value={d.status} onChange={e=>u("status",e.target.value)} style={{width:"100%",fontFamily:IN,fontWeight:700,fontSize:13,padding:"9px 10px",borderRadius:8,border:`1px solid ${ss.border}`,background:ss.bg,color:ss.color,boxSizing:"border-box"}}>{STATUSES.map(x=><option key={x}>{x}</option>)}</select></FRow>
      </div>
      {type==="feed"?(
        <><FRow label="Subject *"><Inp value={d.subject} onChange={v=>u("subject",v)} placeholder="e.g. Blonde reveal — mineral detox"/></FRow>
        <FRow label="Caption"><Txt value={d.caption} onChange={v=>u("caption",v)} rows={5} placeholder="Write the caption here..."/></FRow>
        <FRow label="Hashtags"><Txt value={d.hashtags} onChange={v=>u("hashtags",v)} rows={2} placeholder="#TaraRoseSalon #DubaiHair ..."/></FRow>
        <MediaFields draft={d} setDraft={setD}/></>
      ):(
        <><FRow label="Frame descriptions (one per line)"><Txt value={d.frames} onChange={v=>u("frames",v)} rows={4} placeholder={"Frame 1: hook\nFrame 2: content\nFrame 3: CTA"}/></FRow>
        <FRow label="Notes / caption"><Txt value={d.caption} onChange={v=>u("caption",v)} rows={3} placeholder="Any copy or context..."/></FRow>
        <FRow label="Story images (one per frame)"><UploadZone multiple files={d.images||[]} onChange={f=>setD(x=>({...x,images:f}))} accept="image/*" hint="Upload one image per frame — swipe through in preview"/></FRow></>
      )}
    </Shell>
  );
}

function EditForm({post,onSave,onCancel,type}){
  const[d,setD]=useState({...post,images:post.images||[],video:post.video||[]});
  const[saving,setSaving]=useState(false);
  const u=(k,v)=>setD(x=>({...x,[k]:v}));
  const isMob=useIsMobile();
  const ss=getSS(d.status);
  const month=post.month||"January";
  const year=post.year||new Date().getFullYear();
  const save=async()=>{
    setSaving(true);
    try{
      const imgs=await uploadFiles(d.images||[]);
      const vids=await uploadFiles(d.video||[]);
      const table=type==="feed"?"feed_posts":"story_sequences";
      const payload=type==="feed"
        ?{week:d.week,day:d.day,pillar:d.pillar,format:d.format,subject:d.subject,caption:d.caption,hashtags:d.hashtags,status:d.status,comments:d.comments,image_urls:imgs,video_url:vids[0]?.url||null}
        :{week:d.week,day:d.day,type:d.type,pillar:d.pillar,frames:d.frames,caption:d.caption,status:d.status,comments:d.comments,image_urls:imgs};
      const{error}=await supabase.from(table).update(payload).eq("id",d.id);
      if(error) throw error;
      onSave(normalise({...d,...payload,image_urls:imgs},type));
    }catch(e){alert("Save failed: "+e.message);}
    finally{setSaving(false);}
  };
  return(
    <Shell title="Edit post" rule={GREEN} onCancel={onCancel} onSave={save} saveLabel="Save changes" saving={saving}>
      <div style={{display:"grid",gridTemplateColumns:isMob?"1fr":"1fr 1fr 1fr",gap:10,marginBottom:4}}>
        <FRow label="Week"><Sel value={d.week} onChange={v=>u("week",v)}>{getWeeksForMonth(month,year).map(w=><option key={w} value={w}>Week {w} · {getWeekDateRange(month,w,year)}</option>)}</Sel></FRow>
        <FRow label="Day"><Sel value={d.day} onChange={v=>u("day",v)}>{DAYS.map(x=><option key={x}>{x}</option>)}</Sel></FRow>
        {type==="feed"?<FRow label="Format"><Sel value={d.format} onChange={v=>u("format",v)}>{FORMATS.map(x=><option key={x}>{x}</option>)}</Sel></FRow>
          :<FRow label="Story type"><Sel value={d.type} onChange={v=>u("type",v)}>{STORY_TYPES.map(x=><option key={x}>{x}</option>)}</Sel></FRow>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:isMob?"1fr":"1fr 1fr",gap:10,marginBottom:4}}>
        <FRow label="Pillar"><Sel value={d.pillar} onChange={v=>u("pillar",v)}>{PILLARS.map(p=><option key={p.name}>{p.name}</option>)}</Sel></FRow>
        <FRow label="Status"><select value={d.status} onChange={e=>u("status",e.target.value)} style={{width:"100%",fontFamily:IN,fontWeight:700,fontSize:13,padding:"9px 10px",borderRadius:8,border:`1px solid ${ss.border}`,background:ss.bg,color:ss.color,boxSizing:"border-box"}}>{STATUSES.map(x=><option key={x}>{x}</option>)}</select></FRow>
      </div>
      {type==="feed"?(
        <><FRow label="Subject"><Inp value={d.subject||""} onChange={v=>u("subject",v)}/></FRow>
        <FRow label="Caption"><Txt value={d.caption||""} onChange={v=>u("caption",v)} rows={5}/></FRow>
        <FRow label="Hashtags"><Txt value={d.hashtags||""} onChange={v=>u("hashtags",v)} rows={2}/></FRow>
        <MediaFields draft={d} setDraft={setD}/></>
      ):(
        <><FRow label="Frames (one per line)"><Txt value={d.frames||""} onChange={v=>u("frames",v)} rows={4}/></FRow>
        <FRow label="Notes / caption"><Txt value={d.caption||""} onChange={v=>u("caption",v)} rows={3}/></FRow>
        <FRow label="Story images (one per frame)"><UploadZone multiple files={d.images||[]} onChange={f=>setD(x=>({...x,images:f}))} accept="image/*" hint="Upload one image per frame"/></FRow></>
      )}
    </Shell>
  );
}

// ── Post Detail ───────────────────────────────────────────────────

function PostDetail({post,onClose,onStatus,onApproval,comment,setComment,onAddComment,onEdit,onDelete,onEditComment,onDeleteComment}){
  const role=useRole();
  const isAdmin=role==="admin";
  const canComment=role==="admin"||role==="client";
  const pl=getPillar(post.pillar);
  const videoFiles=post.video||[];
  const imgFiles=post.images||[];
  const hasVideo=videoFiles.length>0;
  const hasImage=imgFiles.length>0;
  const hasMedia=hasVideo||hasImage;
  const mediaFiles=hasVideo?videoFiles:imgFiles;
  return(
    <div style={{background:SURF,border:`1px solid ${BORDER}`,borderRadius:12,overflow:"hidden"}}>
      <div style={{padding:"14px 18px",borderBottom:`1px solid ${BORDER2}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:SURF2}}>
        <div><SectionRule color={TEAL}/><HL size={15}>Post detail</HL></div>
        <button onClick={onClose} style={{fontSize:20,border:"none",background:"none",cursor:"pointer",color:TX3,lineHeight:1,fontFamily:IN}}>×</button>
      </div>
      <div style={{margin:"14px 14px 0",border:`1px solid ${BORDER}`,borderRadius:10,overflow:"hidden"}}>
        <div style={{padding:"10px 12px",display:"flex",alignItems:"center",gap:8,borderBottom:`1px solid ${BORDER2}`,background:SURF2}}>
          <div style={{width:28,height:28,borderRadius:"50%",background:SURF3,border:`1px solid ${BORDER}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontFamily:IN,fontWeight:700,color:TEAL}}>TR</div>
          <div style={{fontSize:13,fontFamily:IN,fontWeight:700,color:TX1}}>tararosesalon</div>
          {post.format==="Reel"&&<span style={{marginLeft:"auto",fontSize:9,fontFamily:IN,fontWeight:700,background:"#111",color:"#fff",padding:"2px 7px",borderRadius:4,letterSpacing:"0.06em"}}>REEL</span>}
          {post.format==="Carousel"&&imgFiles.length>1&&<span style={{marginLeft:"auto",fontSize:9,fontFamily:IN,fontWeight:700,background:"#111",color:"#fff",padding:"2px 7px",borderRadius:4}}>{imgFiles.length} slides</span>}
        </div>
        <div style={{aspectRatio:"4/5",background:hasMedia?"#000":pl.bg,position:"relative",overflow:"hidden"}}>
          {hasMedia
            ?<MediaPreview files={mediaFiles} format={post.format} thumbnail={hasVideo?imgFiles:[]} clickToPlay={hasVideo} style={{position:"absolute",inset:0}}/>
            :<div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10,padding:20,background:pl.bg}}>
              <Tag label={post.format||"No format"} bg="rgba(0,0,0,0.1)" color={pl.color}/>
              <div style={{fontFamily:PF,fontWeight:700,fontStyle:"italic",fontSize:18,color:pl.color,textAlign:"center",lineHeight:1.4}}>{post.subject||<span style={{opacity:.5,fontStyle:"italic"}}>No subject set</span>}</div>
              <div style={{fontFamily:IN,fontSize:11,fontWeight:600,color:pl.color,opacity:.7,textAlign:"center"}}>{post.day} · Week {post.week}</div>
            </div>
          }
        </div>
        <div style={{padding:"12px 14px",borderTop:`1px solid ${BORDER2}`,background:SURF}}>
          <span style={{fontFamily:IN,fontSize:12,fontWeight:700,color:TX1}}>tararosesalon </span>
          <span style={{fontFamily:IN,fontSize:12,fontWeight:600,color:TX2,lineHeight:1.8}}>{post.caption||<span style={{color:TX4,fontStyle:"italic"}}>No caption yet</span>}</span>
        </div>
        {post.hashtags&&<div style={{padding:"0 14px 12px",fontFamily:IN,fontSize:11,fontWeight:600,color:"#378ADD",lineHeight:1.7,background:SURF}}>{post.hashtags}</div>}
      </div>
      <div style={{padding:"14px 14px 0"}}>
        <ApprovalPanel status={post.status} onChange={onApproval}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
          {[["Pillar",null],["Status",null],["Format",post.format||"—"],["Scheduled",`${post.day} · W${post.week}`]].map(([l,v],i)=>(
            <div key={l} style={{background:SURF2,borderRadius:8,padding:"10px 12px",border:`1px solid ${BORDER}`}}>
              <Label>{l}</Label>
              {i===0&&<Tag label={post.pillar} bg={getPillar(post.pillar).bg} color={getPillar(post.pillar).color}/>}
              {i===1&&(isAdmin?<StatusDrop value={post.status} onChange={onStatus}/>:<StatusPill status={post.status}/>)}
              {i>1&&<div style={{fontFamily:IN,fontSize:13,fontWeight:700,color:TX1}}>{v}</div>}
            </div>
          ))}
        </div>
        {isAdmin&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
          <button onClick={onEdit} style={{padding:"10px",fontFamily:IN,fontSize:13,fontWeight:700,borderRadius:8,border:`1px solid ${BORDER}`,cursor:"pointer",background:SURF2,color:TX2}}>Edit post</button>
          <button onClick={onDelete} style={{padding:"10px",fontFamily:IN,fontSize:13,fontWeight:700,borderRadius:8,border:`1px solid ${CORAL}55`,cursor:"pointer",background:`${CORAL}15`,color:CORAL}}>Delete</button>
        </div>}
        <Comments comments={post.comments} val={comment} setVal={setComment} onAdd={canComment?onAddComment:null} onEdit={canComment?onEditComment:null} onDelete={canComment?onDeleteComment:null}/>
      </div>
      <div style={{height:18}}/>
    </div>
  );
}

// ── Story Detail ──────────────────────────────────────────────────

function StoryDetail({seq,onClose,onStatus,onApproval,comment,setComment,onAddComment,onEdit,onDelete,onEditComment,onDeleteComment}){
  const role=useRole();
  const isAdmin=role==="admin";
  const canComment=role==="admin"||role==="client";
  const pl=getPillar(seq.pillar);
  const imgs=seq.images||[];
  return(
    <div style={{background:SURF,border:`1px solid ${BORDER}`,borderRadius:12,overflow:"hidden"}}>
      <div style={{padding:"14px 18px",borderBottom:`1px solid ${BORDER2}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:SURF2}}>
        <div><SectionRule color={PURPLE}/><HL size={15}>Story sequence</HL></div>
        <button onClick={onClose} style={{fontSize:20,border:"none",background:"none",cursor:"pointer",color:TX3,fontFamily:IN}}>×</button>
      </div>
      <div style={{padding:14}}>
        <div style={{borderRadius:12,overflow:"hidden",marginBottom:14,border:`1px solid ${BORDER2}`,aspectRatio:"9/16",position:"relative",background:imgs.length>0?"#000":pl.bg}}>
          {imgs.length>0
            ?<StoryFrameViewer images={imgs}/>
            :<div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,padding:20,background:pl.bg}}>
              <div style={{fontFamily:IN,fontSize:11,fontWeight:600,color:pl.color,letterSpacing:"0.06em",textTransform:"uppercase"}}>{seq.type}</div>
              <div style={{fontFamily:PF,fontWeight:700,fontStyle:"italic",fontSize:14,color:pl.color,textAlign:"center",lineHeight:1.4,opacity:.7}}>No images uploaded yet</div>
            </div>
          }
          <div style={{position:"absolute",top:0,left:0,right:0,padding:"12px 12px 0",pointerEvents:"none"}}>
            <div style={{display:"flex",alignItems:"center",gap:7,marginTop:imgs.length>1?24:0}}>
              <div style={{width:24,height:24,borderRadius:"50%",background:"rgba(0,0,0,0.4)",border:"1px solid rgba(255,255,255,0.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontFamily:IN,fontWeight:700,color:"#fff"}}>TR</div>
              <div style={{fontFamily:IN,fontSize:11,fontWeight:700,color:"#fff",textShadow:"0 1px 3px rgba(0,0,0,0.8)"}}>tararosesalon</div>
            </div>
          </div>
          <div style={{position:"absolute",bottom:16,left:14,right:14,display:"flex",flexDirection:"column",gap:6,pointerEvents:"none"}}>
            {(seq.frames||"").split("\n").filter(f=>f.trim()).map((f,i)=>(
              <div key={i} style={{fontFamily:IN,fontSize:12,fontWeight:600,color:"#fff",textAlign:"center",lineHeight:1.5,background:"rgba(0,0,0,0.55)",borderRadius:8,padding:"7px 12px"}}>{f}</div>
            ))}
            {!(seq.frames||"").trim()&&<div style={{fontFamily:IN,fontSize:12,color:"rgba(255,255,255,0.3)",textAlign:"center",fontStyle:"italic"}}>No frames set yet</div>}
          </div>
        </div>
        <ApprovalPanel status={seq.status} onChange={onApproval}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
          {[["Type",seq.type],["Pillar",seq.pillar],["Frames",String((seq.frames||"").split("\n").filter(f=>f.trim()).length)],["Scheduled",`${seq.day} · W${seq.week}`]].map(([l,v])=>(
            <div key={l} style={{background:SURF2,borderRadius:8,padding:"10px 12px",border:`1px solid ${BORDER}`}}>
              <Label>{l}</Label>
              <div style={{fontFamily:IN,fontSize:12,fontWeight:700,color:TX1}}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{background:SURF2,borderRadius:8,padding:"10px 12px",border:`1px solid ${BORDER}`,marginBottom:14}}>
          <Label>Status</Label>
          {isAdmin?<StatusDrop value={seq.status} onChange={onStatus}/>:<StatusPill status={seq.status}/>}
        </div>
        {isAdmin&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
          <button onClick={onEdit} style={{padding:"10px",fontFamily:IN,fontSize:13,fontWeight:700,borderRadius:8,border:`1px solid ${BORDER}`,cursor:"pointer",background:SURF2,color:TX2}}>Edit</button>
          <button onClick={onDelete} style={{padding:"10px",fontFamily:IN,fontSize:13,fontWeight:700,borderRadius:8,border:`1px solid ${CORAL}55`,cursor:"pointer",background:`${CORAL}15`,color:CORAL}}>Delete</button>
        </div>}
        <Comments comments={seq.comments} val={comment} setVal={setComment} onAdd={canComment?onAddComment:null} onEdit={canComment?onEditComment:null} onDelete={canComment?onDeleteComment:null}/>
      </div>
    </div>
  );
}

// ── IG Grid ───────────────────────────────────────────────────────

function IgGrid({posts,selected,onSelect}){
  const[zoom,setZoom]=useState(4);
  const gridPct=GRID_ZOOM_WIDTHS[zoom];
  const ordered=sortNewestFirst(posts);
  return(
    <div style={{background:SURF,borderRadius:12,padding:14,border:`1px solid ${BORDER}`}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,paddingBottom:12,borderBottom:`1px solid ${BORDER2}`}}>
        <div style={{width:36,height:36,borderRadius:"50%",background:SURF3,border:`1px solid ${BORDER}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontFamily:IN,fontWeight:700,color:TEAL}}>TR</div>
        <div><div style={{fontFamily:IN,fontSize:13,fontWeight:700,color:TX1}}>tararosesalon</div><div style={{fontFamily:IN,fontSize:11,fontWeight:600,color:TX3}}>Premium hair · UAE</div></div>
        <div style={{marginLeft:"auto",display:"flex",gap:4,alignItems:"center"}}>
          <span style={{fontFamily:IN,fontSize:10,fontWeight:600,color:TX4,marginRight:2}}>zoom</span>
          <button onClick={()=>setZoom(z=>Math.max(0,z-1))} disabled={zoom===0} title="Zoom out — smaller cells, see more" style={{width:26,height:26,borderRadius:6,border:`1px solid ${BORDER}`,background:zoom===0?SURF:SURF2,color:zoom===0?TX4:TX2,fontFamily:IN,fontSize:14,fontWeight:700,cursor:zoom===0?"default":"pointer",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>−</button>
          <span style={{fontFamily:IN,fontSize:10,fontWeight:600,color:TX4,minWidth:18,textAlign:"center"}}>{zoom+1}</span>
          <button onClick={()=>setZoom(z=>Math.min(4,z+1))} disabled={zoom===4} title="Zoom in — larger cells, see less" style={{width:26,height:26,borderRadius:6,border:`1px solid ${BORDER}`,background:zoom===4?SURF:SURF2,color:zoom===4?TX4:TX2,fontFamily:IN,fontSize:14,fontWeight:700,cursor:zoom===4?"default":"pointer",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>+</button>
        </div>
      </div>
      <div style={{width:`${gridPct}%`,margin:"0 auto",transition:"width 0.2s"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:2}}>
        {ordered.map(p=>{
          const pl=getPillar(p.pillar);
          const isDraft=p.status==="Draft";
          const thumb=(p.images||[])[0];
          const isVid=(p.video||[]).length>0;
          const hasThumb=!!thumb;
          return(
            <div key={p.id} onClick={()=>onSelect(p.id)}
              style={{aspectRatio:"4/5",background:pl.bg,cursor:"pointer",overflow:"hidden",position:"relative",outline:selected===p.id?`2px solid ${TEAL}`:"2px solid transparent"}}>
              {hasThumb&&<img src={thumb.url} alt="" style={{width:"100%",height:"100%",objectFit:"cover",position:"absolute",inset:0}}/>}
              {!hasThumb&&(
                <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",padding:"4px 6px",gap:2}}>
                  <div style={{fontFamily:IN,fontSize:9,fontWeight:700,color:pl.color,letterSpacing:"0.04em",textTransform:"uppercase",lineHeight:1.2}}>{p.format||"Post"}</div>
                  {p.subject?<div style={{fontFamily:IN,fontSize:8,fontWeight:600,color:pl.color,opacity:.85,lineHeight:1.3,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{p.subject}</div>:null}
                  <div style={{fontFamily:IN,fontSize:8,fontWeight:600,color:pl.color,opacity:.55,lineHeight:1.2}}>{p.day} · W{p.week}</div>
                </div>
              )}
              {isVid&&<div style={{position:"absolute",top:4,right:4,pointerEvents:"none"}}><svg width="11" height="11" viewBox="0 0 24 24" fill="white" opacity=".85"><path d="M4 2l16 10L4 22V2z"/></svg></div>}
              {p.format==="Carousel"&&(p.images||[]).length>1&&<div style={{position:"absolute",top:4,right:4,background:"rgba(0,0,0,0.7)",borderRadius:3,padding:"1px 5px",fontSize:8,fontFamily:IN,fontWeight:700,color:"#fff",pointerEvents:"none"}}>+{(p.images||[]).length-1}</div>}
              {isDraft&&<div style={{position:"absolute",bottom:0,left:0,right:0,textAlign:"center",background:"rgba(0,0,0,0.28)",padding:"3px 0"}}><span style={{fontFamily:IN,fontSize:8,fontWeight:600,color:"rgba(255,255,255,0.75)",letterSpacing:"0.06em",textTransform:"uppercase"}}>draft</span></div>}
            </div>
          );
        })}
        {ordered.length===0&&<div style={{gridColumn:"1/-1",textAlign:"center",padding:"40px 20px",fontFamily:IN,fontSize:12,fontWeight:600,color:TX4}}>No posts yet</div>}
      </div>
      </div>
      <div style={{fontFamily:IN,fontSize:10,fontWeight:600,color:TX4,textAlign:"center",marginTop:10,letterSpacing:"0.06em",textTransform:"uppercase"}}>{ordered.length} posts · newest first · pillar colours</div>
    </div>
  );
}

// ── Filter Bar ────────────────────────────────────────────────────

function FilterBar({filter,setFilter,view,setView,onAdd}){
  const isMob=useIsMobile();
  return(
    <div style={{display:"flex",justifyContent:"space-between",alignItems:isMob?"flex-start":"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
      {view==="calendar"?(
        <div style={{display:"flex",gap:5,flexWrap:"wrap",overflowX:isMob?"auto":"unset"}}>
          {["All",...STATUSES].map(s=>{
            const ss=s==="All"?{bg:SURF2,color:TX3,border:BORDER}:getSS(s);
            const active=filter===s;
            return<button key={s} onClick={()=>setFilter(s)} style={{padding:"5px 12px",fontFamily:IN,fontSize:11,fontWeight:600,borderRadius:20,border:`1px solid ${active?ss.border:BORDER}`,cursor:"pointer",background:active?ss.bg:SURF,color:active?ss.color:TX3,letterSpacing:"0.03em"}}>{s}</button>;
          })}
        </div>
      ):<div/>}
      <div style={{display:"flex",gap:8}}>
        {["calendar","grid"].map(v=>(
          <button key={v} onClick={()=>setView(v)} style={{padding:"5px 14px",fontFamily:IN,fontSize:11,fontWeight:600,borderRadius:20,border:`1px solid ${view===v?TEAL:BORDER}`,cursor:"pointer",background:view===v?`${TEAL}18`:SURF,color:view===v?TEAL:TX3,textTransform:"capitalize"}}>{v}</button>
        ))}
        {onAdd&&<button onClick={onAdd} style={{padding:"5px 16px",fontFamily:IN,fontSize:11,fontWeight:700,borderRadius:20,border:`1px solid ${TEAL}`,cursor:"pointer",background:`${TEAL}18`,color:TEAL,letterSpacing:"0.03em"}}>+ Add post</button>}
      </div>
    </div>
  );
}

function CalRow({p,selected,onSelect,onDelete,onDup}){
  const isMob=useIsMobile();
  const isAdmin=useRole()==="admin";
  const pl=getPillar(p.pillar);
  const thumb=(p.images||[])[0]||(p.video||[])[0]||null;
  if(isMob) return(
    <div onClick={()=>onSelect(p.id)} style={{display:"flex",gap:10,alignItems:"center",padding:"10px 12px",borderRadius:10,border:`1px solid ${selected===p.id?TEAL:BORDER}`,background:selected===p.id?`${TEAL}0D`:SURF,cursor:"pointer"}}>
      <div style={{width:38,height:38,borderRadius:7,overflow:"hidden",background:pl.bg,border:`1px solid ${BORDER}`,flexShrink:0}}>
        {thumb?(checkIsVideo(thumb)
          ?<div style={{width:"100%",height:"100%",background:"#111",display:"flex",alignItems:"center",justifyContent:"center"}}><svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M4 2l16 10L4 22V2z"/></svg></div>
          :<img src={thumb.url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>)
          :<div style={{width:"100%",height:"100%",background:pl.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:IN,fontSize:9,fontWeight:700,color:pl.color}}>{p.format?p.format[0]:""}</div>}
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontFamily:IN,fontSize:12,fontWeight:600,color:TX2,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{p.subject||<span style={{color:TX4,fontStyle:"italic"}}>No subject</span>}</div>
        <div style={{display:"flex",gap:6,marginTop:4,flexWrap:"wrap"}}>
          <StatusPill status={p.status}/>
          <span style={{fontFamily:IN,fontSize:10,fontWeight:600,color:TX3}}>{p.day} · W{p.week} · {p.format}</span>
        </div>
      </div>
      {isAdmin&&<div style={{display:"flex",gap:6,flexShrink:0}}>
        <button onClick={e=>{e.stopPropagation();onDup(p.id);}} title="Duplicate" style={{border:"none",background:"none",cursor:"pointer",color:TX4,padding:4,lineHeight:1,display:"flex",alignItems:"center"}}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        </button>
        <button onClick={e=>{e.stopPropagation();onDelete(p.id);}} style={{fontFamily:IN,fontSize:15,border:"none",background:"none",cursor:"pointer",color:TX4,padding:"0 2px",lineHeight:1}}>×</button>
      </div>}
    </div>
  );
  return(
    <div onClick={()=>onSelect(p.id)} style={{display:"grid",gridTemplateColumns:"44px 44px 100px 100px 1fr 70px 22px 22px",gap:8,alignItems:"center",padding:"10px 14px",borderRadius:10,border:`1px solid ${selected===p.id?TEAL:BORDER}`,background:selected===p.id?`${TEAL}0D`:SURF,cursor:"pointer"}}>
      <div style={{fontFamily:IN,fontSize:12,fontWeight:700,color:TX1}}>{p.day}</div>
      <div style={{width:38,height:38,borderRadius:7,overflow:"hidden",background:pl.bg,border:`1px solid ${BORDER}`,flexShrink:0}}>
        {thumb?(checkIsVideo(thumb)
          ?<div style={{width:"100%",height:"100%",background:"#111",display:"flex",alignItems:"center",justifyContent:"center"}}><svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M4 2l16 10L4 22V2z"/></svg></div>
          :<img src={thumb.url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>)
          :<div style={{width:"100%",height:"100%",background:pl.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:IN,fontSize:9,fontWeight:700,color:pl.color}}>{p.format?p.format[0]:""}</div>
        }
      </div>
      <StatusPill status={p.status}/>
      <Tag label={p.pillar} bg={pl.bg} color={pl.color}/>
      <div style={{fontFamily:IN,fontSize:12,fontWeight:600,color:TX2,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{p.subject||<span style={{color:TX4,fontStyle:"italic"}}>No subject</span>}</div>
      <div style={{fontFamily:IN,fontSize:11,fontWeight:600,color:TX3}}>{p.format}</div>
      {isAdmin?<button onClick={e=>{e.stopPropagation();onDup(p.id);}} title="Duplicate" style={{border:"none",background:"none",cursor:"pointer",color:TX4,padding:0,lineHeight:1,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
      </button>:<div/>}
      {isAdmin?<button onClick={e=>{e.stopPropagation();onDelete(p.id);}} style={{fontFamily:IN,fontSize:15,border:"none",background:"none",cursor:"pointer",color:TX4,padding:0,lineHeight:1}}>×</button>:<div/>}
    </div>
  );
}

// ── Feed Tab ──────────────────────────────────────────────────────

function FeedTab({month,year}){
  const isAdmin=useRole()==="admin";
  const[posts,setPosts]=useState([]);
  const[loading,setLoading]=useState(true);
  const[adding,setAdding]=useState(false);
  const[selected,setSelected]=useState(null);
  const[editing,setEditing]=useState(null);
  const[filter,setFilter]=useState("All");
  const[comment,setComment]=useState("");
  const[view,setView]=useState("calendar");
  const[collapsedWeeks,setCollapsedWeeks]=useState({});

  useEffect(()=>{
    setLoading(true);setSelected(null);setCollapsedWeeks({});
    supabase.from("feed_posts").select("*").eq("month",month).eq("year",year).order("created_at",{ascending:true})
      .then(({data})=>{setPosts(data?data.map(r=>normalise(r,"feed")):[]);setLoading(false);});
  },[month,year]);

  const sel=posts.find(p=>p.id===selected)||null;
  const edP=posts.find(p=>p.id===editing)||null;
  const sorted=sortOldestFirst(posts);
  const filt=filter==="All"?sorted:sorted.filter(p=>p.status===filter);

  const add=p=>{setPosts(v=>[...v,p]);setAdding(false);setSelected(p.id);};
  const del=async id=>{await supabase.from("feed_posts").delete().eq("id",id);setPosts(v=>v.filter(p=>p.id!==id));setSelected(null);};
  const upd=p=>{setPosts(v=>v.map(x=>x.id===p.id?p:x));setEditing(null);setSelected(p.id);};
  const setSt=async(id,s)=>{await supabase.from("feed_posts").update({status:s}).eq("id",id);setPosts(v=>v.map(p=>p.id===id?{...p,status:s}:p));};
  const addC=async id=>{if(!comment.trim()) return;const post=posts.find(p=>p.id===id);const nc=[...(post.comments||[]),comment.trim()];await supabase.from("feed_posts").update({comments:nc}).eq("id",id);setPosts(v=>v.map(p=>p.id===id?{...p,comments:nc}:p));setComment("");};
  const editComment=async(id,idx,text)=>{const post=posts.find(p=>p.id===id);const nc=(post.comments||[]).map((c,i)=>i===idx?text:c);await supabase.from("feed_posts").update({comments:nc}).eq("id",id);setPosts(v=>v.map(p=>p.id===id?{...p,comments:nc}:p));};
  const delComment=async(id,idx)=>{const post=posts.find(p=>p.id===id);const nc=(post.comments||[]).filter((_,i)=>i!==idx);await supabase.from("feed_posts").update({comments:nc}).eq("id",id);setPosts(v=>v.map(p=>p.id===id?{...p,comments:nc}:p));};
  const dup=async id=>{
    const orig=posts.find(p=>p.id===id);if(!orig) return;
    const payload={month,year,week:orig.week,day:orig.day,pillar:orig.pillar,format:orig.format,subject:(orig.subject||"")+" (copy)",caption:orig.caption||"",hashtags:orig.hashtags||"",status:"Draft",comments:[],image_urls:orig.images||[],video_url:orig.video?.[0]?.url||null};
    const{data,error}=await supabase.from("feed_posts").insert([payload]).select();
    if(error){alert("Duplicate failed: "+error.message);return;}
    setPosts(v=>[...v,normalise(data[0],"feed")]);
  };
  const isMob=useIsMobile();
  const toggleWeek=w=>setCollapsedWeeks(c=>({...c,[w]:!c[w]}));
  const detailRef=useRef(null);
  useEffect(()=>{
    if(selected&&detailRef.current&&!isMob){
      detailRef.current.scrollIntoView({behavior:"smooth",block:"start"});
    }
  },[selected]);

  return(
    <div>
      <PillarTracker items={posts}/>
      <ContentStats items={posts} label="Feed posts"/>
      <FilterBar filter={filter} setFilter={setFilter} view={view} setView={setView} onAdd={isAdmin?()=>{setAdding(true);setSelected(null);setEditing(null);}:null}/>
      {adding&&<PostForm type="feed" onAdd={add} onCancel={()=>setAdding(false)} month={month} year={year}/>}
      {editing&&edP&&<EditForm post={edP} type="feed" onSave={upd} onCancel={()=>setEditing(null)}/>}
      {loading&&<div style={{textAlign:"center",padding:"60px 20px",fontFamily:IN,fontSize:13,fontWeight:600,color:TX3}}>Loading...</div>}
      {!loading&&posts.length===0&&!adding&&(
        <div style={{textAlign:"center",padding:"70px 20px",border:`1px dashed ${BORDER}`,borderRadius:12}}>
          <SectionRule color={TX4}/>
          <div style={{fontFamily:PF,fontWeight:700,fontStyle:"italic",fontSize:22,color:TX3,marginBottom:8}}>Nothing here yet</div>
          <div style={{fontFamily:IN,fontSize:13,fontWeight:600,color:TX4}}>No posts for {month}. Click + Add post to begin.</div>
        </div>
      )}
      {isMob&&sel&&!editing&&(
        <div style={{position:"fixed",inset:0,zIndex:50,background:BG,overflowY:"auto"}}>
          <div style={{padding:"12px 16px",borderBottom:`1px solid ${BORDER2}`,display:"flex",alignItems:"center",gap:10,background:SURF,position:"sticky",top:0,zIndex:1}}>
            <button onClick={()=>setSelected(null)} style={{border:"none",background:"none",cursor:"pointer",color:TEAL,fontFamily:IN,fontSize:13,fontWeight:700,padding:0,display:"flex",alignItems:"center",gap:6}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
              Back
            </button>
          </div>
          <div style={{padding:16}}>
            <PostDetail post={sel} onClose={()=>setSelected(null)} onStatus={s=>setSt(sel.id,s)} onApproval={s=>setSt(sel.id,s)} comment={comment} setComment={setComment} onAddComment={()=>addC(sel.id)} onEdit={()=>{setEditing(sel.id);setSelected(null);}} onDelete={()=>del(sel.id)} onEditComment={(idx,text)=>editComment(sel.id,idx,text)} onDeleteComment={idx=>delComment(sel.id,idx)}/>
          </div>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:!isMob&&sel&&!editing?"1fr 360px":"1fr",gap:16,alignItems:"start"}}>
        <div>
          {view==="calendar"?(
            getWeeksForMonth(month,year).map(w=>{
              const wp=filt.filter(p=>p.week===w);
              if(!wp.length) return null;
              const collapsed=!!collapsedWeeks[w];
              return(
                <div key={w} style={{marginBottom:20}}>
                  <div onClick={()=>toggleWeek(w)} style={{display:"flex",alignItems:"center",gap:10,marginBottom:collapsed?0:10,paddingBottom:8,borderBottom:`1px solid ${BORDER2}`,cursor:"pointer",userSelect:"none"}}>
                    <div style={{width:3,height:14,background:TEAL,borderRadius:2,flexShrink:0}}/>
                    <div style={{fontFamily:PF,fontWeight:700,fontStyle:"italic",fontSize:16,color:TX2}}>Week {w}</div>
                    <div style={{fontFamily:IN,fontSize:10,fontWeight:600,color:TX3}}>{month.slice(0,3)} {getWeekDateRange(month,w,year)}</div>
                    <div style={{fontFamily:IN,fontSize:10,fontWeight:600,color:TX4}}>{wp.length} post{wp.length!==1?"s":""}</div>
                    <div style={{marginLeft:"auto",fontFamily:IN,fontSize:11,color:TX4}}>{collapsed?"▶":"▼"}</div>
                  </div>
                  {!collapsed&&<div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {wp.map(p=><CalRow key={p.id} p={p} selected={selected} onSelect={id=>{setSelected(selected===id?null:id);setEditing(null);}} onDelete={del} onDup={dup}/>)}
                  </div>}
                </div>
              );
            })
          ):<IgGrid posts={posts} selected={selected} onSelect={id=>{setSelected(selected===id?null:id);setEditing(null);}}/>}
        </div>
        {sel&&!editing&&<div ref={detailRef} style={{alignSelf:"stretch"}}><div style={{position:"sticky",top:16,borderRadius:12}}><PostDetail post={sel} onClose={()=>setSelected(null)} onStatus={s=>setSt(sel.id,s)} onApproval={s=>setSt(sel.id,s)} comment={comment} setComment={setComment} onAddComment={()=>addC(sel.id)} onEdit={()=>{setEditing(sel.id);setSelected(null);}} onDelete={()=>del(sel.id)} onEditComment={(idx,text)=>editComment(sel.id,idx,text)} onDeleteComment={idx=>delComment(sel.id,idx)}/></div></div>}
      </div>
    </div>
  );
}

// ── Stories Tab ───────────────────────────────────────────────────

function StoriesTab({month,year}){
  const isAdmin=useRole()==="admin";
  const[seqs,setSeqs]=useState([]);
  const[loading,setLoading]=useState(true);
  const[adding,setAdding]=useState(false);
  const[selected,setSelected]=useState(null);
  const[editing,setEditing]=useState(null);
  const[filter,setFilter]=useState("All");
  const[comment,setComment]=useState("");
  const[collapsedWeeks,setCollapsedWeeks]=useState({});

  useEffect(()=>{
    setLoading(true);setSelected(null);setCollapsedWeeks({});
    supabase.from("story_sequences").select("*").eq("month",month).eq("year",year).order("created_at",{ascending:true})
      .then(({data})=>{setSeqs(data?data.map(r=>normalise(r,"story")):[]);setLoading(false);});
  },[month,year]);

  const sel=seqs.find(s=>s.id===selected)||null;
  const edS=seqs.find(s=>s.id===editing)||null;
  const sorted=sortOldestFirst(seqs);
  const filt=filter==="All"?sorted:sorted.filter(s=>s.status===filter);

  const add=s=>{setSeqs(v=>[...v,s]);setAdding(false);setSelected(s.id);};
  const del=async id=>{await supabase.from("story_sequences").delete().eq("id",id);setSeqs(v=>v.filter(s=>s.id!==id));setSelected(null);};
  const upd=s=>{setSeqs(v=>v.map(x=>x.id===s.id?s:x));setEditing(null);setSelected(s.id);};
  const setSt=async(id,st)=>{await supabase.from("story_sequences").update({status:st}).eq("id",id);setSeqs(v=>v.map(s=>s.id===id?{...s,status:st}:s));};
  const addC=async id=>{if(!comment.trim()) return;const seq=seqs.find(s=>s.id===id);const nc=[...(seq.comments||[]),comment.trim()];await supabase.from("story_sequences").update({comments:nc}).eq("id",id);setSeqs(v=>v.map(s=>s.id===id?{...s,comments:nc}:s));setComment("");};
  const editComment=async(id,idx,text)=>{const seq=seqs.find(s=>s.id===id);const nc=(seq.comments||[]).map((c,i)=>i===idx?text:c);await supabase.from("story_sequences").update({comments:nc}).eq("id",id);setSeqs(v=>v.map(s=>s.id===id?{...s,comments:nc}:s));};
  const delComment=async(id,idx)=>{const seq=seqs.find(s=>s.id===id);const nc=(seq.comments||[]).filter((_,i)=>i!==idx);await supabase.from("story_sequences").update({comments:nc}).eq("id",id);setSeqs(v=>v.map(s=>s.id===id?{...s,comments:nc}:s));};
  const dup=async id=>{
    const orig=seqs.find(s=>s.id===id);if(!orig) return;
    const payload={month,year,week:orig.week,day:orig.day,type:orig.type,pillar:orig.pillar,frames:orig.frames||"",caption:orig.caption||"",status:"Draft",comments:[],image_urls:orig.images||[]};
    const{data,error}=await supabase.from("story_sequences").insert([payload]).select();
    if(error){alert("Duplicate failed: "+error.message);return;}
    setSeqs(v=>[...v,normalise(data[0],"story")]);
  };
  const isMob=useIsMobile();
  const toggleWeek=w=>setCollapsedWeeks(c=>({...c,[w]:!c[w]}));
  const detailRef=useRef(null);
  useEffect(()=>{
    if(selected&&detailRef.current&&!isMob){
      detailRef.current.scrollIntoView({behavior:"smooth",block:"start"});
    }
  },[selected]);

  return(
    <div>
      <PillarTracker items={seqs}/>
      <ContentStats items={seqs} label="Stories"/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
          {["All",...STATUSES].map(s=>{
            const ss=s==="All"?{bg:SURF2,color:TX3,border:BORDER}:getSS(s);
            const active=filter===s;
            return<button key={s} onClick={()=>setFilter(s)} style={{padding:"5px 12px",fontFamily:IN,fontSize:11,fontWeight:600,borderRadius:20,border:`1px solid ${active?ss.border:BORDER}`,cursor:"pointer",background:active?ss.bg:SURF,color:active?ss.color:TX3,letterSpacing:"0.03em"}}>{s}</button>;
          })}
        </div>
        {isAdmin&&<button onClick={()=>{setAdding(true);setSelected(null);setEditing(null);}} style={{padding:"5px 16px",fontFamily:IN,fontSize:11,fontWeight:700,borderRadius:20,border:`1px solid ${TEAL}`,cursor:"pointer",background:`${TEAL}18`,color:TEAL,letterSpacing:"0.03em"}}>+ Add sequence</button>}
      </div>
      {adding&&<PostForm type="story" onAdd={add} onCancel={()=>setAdding(false)} month={month} year={year}/>}
      {editing&&edS&&<EditForm post={edS} type="story" onSave={upd} onCancel={()=>setEditing(null)}/>}
      {loading&&<div style={{textAlign:"center",padding:"60px 20px",fontFamily:IN,fontSize:13,fontWeight:600,color:TX3}}>Loading...</div>}
      {!loading&&seqs.length===0&&!adding&&(
        <div style={{textAlign:"center",padding:"70px 20px",border:`1px dashed ${BORDER}`,borderRadius:12}}>
          <SectionRule color={TX4}/>
          <div style={{fontFamily:PF,fontWeight:700,fontStyle:"italic",fontSize:22,color:TX3,marginBottom:8}}>Nothing here yet</div>
          <div style={{fontFamily:IN,fontSize:13,fontWeight:600,color:TX4}}>No sequences for {month}. Click + Add sequence to begin.</div>
        </div>
      )}
      {isMob&&sel&&!editing&&(
        <div style={{position:"fixed",inset:0,zIndex:50,background:BG,overflowY:"auto"}}>
          <div style={{padding:"12px 16px",borderBottom:`1px solid ${BORDER2}`,display:"flex",alignItems:"center",gap:10,background:SURF,position:"sticky",top:0,zIndex:1}}>
            <button onClick={()=>setSelected(null)} style={{border:"none",background:"none",cursor:"pointer",color:TEAL,fontFamily:IN,fontSize:13,fontWeight:700,padding:0,display:"flex",alignItems:"center",gap:6}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
              Back
            </button>
          </div>
          <div style={{padding:16}}>
            <StoryDetail seq={sel} onClose={()=>setSelected(null)} onStatus={s=>setSt(sel.id,s)} onApproval={s=>setSt(sel.id,s)} comment={comment} setComment={setComment} onAddComment={()=>addC(sel.id)} onEdit={()=>{setEditing(sel.id);setSelected(null);}} onDelete={()=>del(sel.id)} onEditComment={(idx,text)=>editComment(sel.id,idx,text)} onDeleteComment={idx=>delComment(sel.id,idx)}/>
          </div>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:!isMob&&sel&&!editing?"1fr 360px":"1fr",gap:16,alignItems:"start"}}>
        <div>
          {getWeeksForMonth(month,year).map(w=>{
            const wp=filt.filter(s=>s.week===w);
            if(!wp.length) return null;
            const collapsed=!!collapsedWeeks[w];
            return(
              <div key={w} style={{marginBottom:20}}>
                <div onClick={()=>toggleWeek(w)} style={{display:"flex",alignItems:"center",gap:10,marginBottom:collapsed?0:10,paddingBottom:8,borderBottom:`1px solid ${BORDER2}`,cursor:"pointer",userSelect:"none"}}>
                  <div style={{width:3,height:14,background:PURPLE,borderRadius:2,flexShrink:0}}/>
                  <div style={{fontFamily:PF,fontWeight:700,fontStyle:"italic",fontSize:16,color:TX2}}>Week {w}</div>
                  <div style={{fontFamily:IN,fontSize:10,fontWeight:600,color:TX3}}>{month.slice(0,3)} {getWeekDateRange(month,w,year)}</div>
                  <div style={{fontFamily:IN,fontSize:10,fontWeight:600,color:TX4}}>{wp.length} sequence{wp.length!==1?"s":""}</div>
                  <div style={{marginLeft:"auto",fontFamily:IN,fontSize:11,color:TX4}}>{collapsed?"▶":"▼"}</div>
                </div>
                {!collapsed&&<div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {wp.map(s=>{
                    const pl=getPillar(s.pillar);
                    const thumb=(s.images||[])[0]||null;
                    const isRepost=s.type==="Repost from feed";
                    if(isMob) return(
                      <div key={s.id} onClick={()=>{setSelected(selected===s.id?null:s.id);setEditing(null);}}
                        style={{display:"flex",gap:10,alignItems:"center",padding:"10px 12px",borderRadius:10,border:`1px solid ${selected===s.id?TEAL:BORDER}`,background:selected===s.id?`${TEAL}0D`:SURF,cursor:"pointer"}}>
                        <div style={{width:38,height:38,borderRadius:7,overflow:"hidden",background:pl.bg,border:`1px solid ${BORDER}`,flexShrink:0}}>
                          {thumb?<img src={thumb.url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                            :<div style={{width:"100%",height:"100%",background:pl.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:IN,fontSize:9,fontWeight:700,color:pl.color}}>S</div>}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontFamily:IN,fontSize:12,fontWeight:600,color:TX2,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{(s.frames||"").split("\n")[0]||<span style={{color:TX4,fontStyle:"italic"}}>No frames</span>}</div>
                          <div style={{display:"flex",gap:6,marginTop:4,flexWrap:"wrap"}}>
                            <StatusPill status={s.status}/>
                            <span style={{fontFamily:IN,fontSize:10,fontWeight:600,color:TX3}}>{s.day} · W{s.week} · {isRepost?"repost":"unique"}</span>
                          </div>
                        </div>
                        {isAdmin&&<div style={{display:"flex",gap:6,flexShrink:0}}>
                          <button onClick={e=>{e.stopPropagation();dup(s.id);}} title="Duplicate" style={{border:"none",background:"none",cursor:"pointer",color:TX4,padding:4,lineHeight:1,display:"flex",alignItems:"center"}}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                          </button>
                          <button onClick={e=>{e.stopPropagation();del(s.id);}} style={{fontFamily:IN,fontSize:15,border:"none",background:"none",cursor:"pointer",color:TX4,padding:"0 2px",lineHeight:1}}>×</button>
                        </div>}
                      </div>
                    );
                    return(
                      <div key={s.id} onClick={()=>{setSelected(selected===s.id?null:s.id);setEditing(null);}}
                        style={{display:"grid",gridTemplateColumns:"44px 44px 100px 100px 1fr 62px 22px 22px",gap:8,alignItems:"center",padding:"10px 14px",borderRadius:10,border:`1px solid ${selected===s.id?TEAL:BORDER}`,background:selected===s.id?`${TEAL}0D`:SURF,cursor:"pointer"}}>
                        <div style={{fontFamily:IN,fontSize:12,fontWeight:700,color:TX1}}>{s.day}</div>
                        <div style={{width:38,height:38,borderRadius:7,overflow:"hidden",background:pl.bg,border:`1px solid ${BORDER}`,flexShrink:0}}>
                          {thumb?<img src={thumb.url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                            :<div style={{width:"100%",height:"100%",background:pl.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:IN,fontSize:9,fontWeight:700,color:pl.color}}>S</div>}
                        </div>
                        <StatusPill status={s.status}/>
                        <Tag label={s.pillar} bg={pl.bg} color={pl.color}/>
                        <div style={{fontFamily:IN,fontSize:12,fontWeight:600,color:TX2,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{(s.frames||"").split("\n")[0]||<span style={{color:TX4,fontStyle:"italic"}}>No frames</span>}</div>
                        <span style={{fontFamily:IN,fontSize:10,fontWeight:600,padding:"3px 8px",borderRadius:20,background:isRepost?SURF3:`${GREEN}22`,color:isRepost?TX3:"#A8D672",border:`1px solid ${isRepost?BORDER:"#639922"}`}}>{isRepost?"repost":"unique"}</span>
                        {isAdmin?<button onClick={e=>{e.stopPropagation();dup(s.id);}} title="Duplicate" style={{border:"none",background:"none",cursor:"pointer",color:TX4,padding:0,lineHeight:1,display:"flex",alignItems:"center",justifyContent:"center"}}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                        </button>:<div/>}
                        {isAdmin?<button onClick={e=>{e.stopPropagation();del(s.id);}} style={{fontFamily:IN,fontSize:15,border:"none",background:"none",cursor:"pointer",color:TX4,padding:0,lineHeight:1}}>×</button>:<div/>}
                      </div>
                    );
                  })}
                </div>}
              </div>
            );
          })}
        </div>
        {sel&&!editing&&<div ref={detailRef} style={{alignSelf:"stretch"}}><div style={{position:"sticky",top:16,borderRadius:12}}><StoryDetail seq={sel} onClose={()=>setSelected(null)} onStatus={s=>setSt(sel.id,s)} onApproval={s=>setSt(sel.id,s)} comment={comment} setComment={setComment} onAddComment={()=>addC(sel.id)} onEdit={()=>{setEditing(sel.id);setSelected(null);}} onDelete={()=>del(sel.id)} onEditComment={(idx,text)=>editComment(sel.id,idx,text)} onDeleteComment={idx=>delComment(sel.id,idx)}/></div></div>}
      </div>
    </div>
  );
}

// ── Login ─────────────────────────────────────────────────────────

function Login({onLogin}){
  const[code,setCode]=useState("");
  const[err,setErr]=useState(false);
  const submit=()=>{const r=ROLE_CODES[code.trim()];if(r){onLogin(r);}else{setErr(true);setTimeout(()=>setErr(false),2500);}};
  return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:BG}}>
      <div style={{background:SURF,border:`1px solid ${BORDER}`,borderRadius:16,padding:"36px 32px",width:"90%",maxWidth:340}}>
        <div style={{width:32,height:2,background:TEAL,borderRadius:1,marginBottom:14}}/>
        <div style={{fontFamily:PF,fontWeight:700,fontStyle:"italic",fontSize:26,color:TX1,marginBottom:4}}>Tara Rose</div>
        <div style={{fontFamily:IN,fontSize:11,fontWeight:600,color:TEAL,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:28}}>Content System</div>
        <div style={{fontFamily:IN,fontSize:10,fontWeight:700,color:TX3,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:6}}>Access code</div>
        <input type="password" value={code} onChange={e=>{setCode(e.target.value);setErr(false);}} onKeyDown={e=>e.key==="Enter"&&submit()}
          placeholder="Enter your access code" autoFocus
          style={{width:"100%",fontFamily:IN,fontWeight:600,fontSize:14,padding:"10px 14px",borderRadius:10,
            border:`1px solid ${err?CORAL:BORDER}`,background:SURF2,color:TX1,boxSizing:"border-box",marginBottom:err?6:16,outline:"none"}}/>
        {err&&<div style={{fontFamily:IN,fontSize:11,fontWeight:600,color:CORAL,marginBottom:12}}>Incorrect access code.</div>}
        <button onClick={submit} style={{width:"100%",padding:"12px",fontFamily:IN,fontSize:13,fontWeight:700,borderRadius:10,
          border:`1px solid ${TEAL}`,cursor:"pointer",background:`${TEAL}22`,color:TEAL}}>Enter</button>
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────

export default function App(){
  const[month,setMonth]=useState(()=>MONTHS[new Date().getMonth()]);
  const[year,setYear]=useState(()=>new Date().getFullYear());
  const[tab,setTab]=useState("Feed Calendar");
  const[sideOpen,setSideOpen]=useState(false);
  const isMob=useIsMobile();
  const[role,setRole]=useState(()=>{const r=localStorage.getItem("cms_role");return["admin","client","team"].includes(r)?r:"team";});
  const[signingIn,setSigningIn]=useState(false);
  const[code,setCode]=useState("");
  const[codeErr,setCodeErr]=useState(false);
  const signOut=()=>{localStorage.removeItem("cms_role");setRole("team");setSigningIn(false);setCode("");};
  const trySignIn=()=>{const r=ROLE_CODES[code.trim()];if(r){localStorage.setItem("cms_role",r);setRole(r);setCode("");setSigningIn(false);setCodeErr(false);}else{setCodeErr(true);setTimeout(()=>setCodeErr(false),2500);}};

  const sidebarContent=(
    <>
      <div style={{padding:"0 20px 24px",borderBottom:`1px solid ${BORDER2}`}}>
        <div style={{width:32,height:2,background:TEAL,borderRadius:1,marginBottom:12}}/>
        <div style={{fontFamily:IN,fontSize:11,fontWeight:700,color:TX1,letterSpacing:"0.12em",textTransform:"uppercase"}}>Tara Rose</div>
        <div style={{fontFamily:IN,fontSize:9,fontWeight:600,color:TEAL,letterSpacing:"0.12em",textTransform:"uppercase",marginTop:3}}>Content System</div>
        {signingIn?(
          <div style={{marginTop:12}}>
            <input type="password" value={code} onChange={e=>{setCode(e.target.value);setCodeErr(false);}} onKeyDown={e=>e.key==="Enter"&&trySignIn()} autoFocus placeholder="Access code"
              style={{width:"100%",fontFamily:IN,fontWeight:600,fontSize:12,padding:"7px 10px",borderRadius:8,border:`1px solid ${codeErr?CORAL:BORDER}`,background:SURF2,color:TX1,boxSizing:"border-box",outline:"none"}}/>
            {codeErr&&<div style={{fontFamily:IN,fontSize:10,fontWeight:600,color:CORAL,marginTop:4}}>Incorrect code.</div>}
            <div style={{display:"flex",gap:6,marginTop:8}}>
              <button onClick={trySignIn} style={{flex:1,fontFamily:IN,fontSize:11,fontWeight:700,padding:"6px 0",borderRadius:8,border:`1px solid ${TEAL}`,background:`${TEAL}18`,color:TEAL,cursor:"pointer"}}>Enter</button>
              <button onClick={()=>{setSigningIn(false);setCode("");setCodeErr(false);}} style={{fontFamily:IN,fontSize:11,fontWeight:700,padding:"6px 10px",borderRadius:8,border:`1px solid ${BORDER}`,background:"none",color:TX3,cursor:"pointer"}}>Cancel</button>
            </div>
          </div>
        ):role!=="team"?(
          <div style={{marginTop:12,display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
            <span style={{fontFamily:IN,fontSize:10,fontWeight:700,background:`${TEAL}22`,color:TEAL,border:`1px solid ${TEAL}55`,borderRadius:20,padding:"3px 10px",letterSpacing:"0.06em",textTransform:"uppercase"}}>{role}</span>
            <button onClick={signOut} style={{fontFamily:IN,fontSize:10,fontWeight:700,color:TX2,border:`1px solid ${BORDER}`,background:SURF3,borderRadius:6,cursor:"pointer",padding:"3px 10px",letterSpacing:"0.04em"}}>Sign out</button>
          </div>
        ):(
          <div style={{marginTop:12,display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
            <span style={{fontFamily:IN,fontSize:10,fontWeight:600,color:TX3,letterSpacing:"0.06em",textTransform:"uppercase"}}>Team view</span>
            <button onClick={()=>setSigningIn(true)} style={{fontFamily:IN,fontSize:10,fontWeight:700,color:TEAL,border:`1px solid ${TEAL}55`,background:`${TEAL}18`,borderRadius:6,cursor:"pointer",padding:"3px 10px",letterSpacing:"0.04em"}}>Sign in</button>
          </div>
        )}
      </div>
      <div style={{padding:"20px 12px 12px"}}>
        <div style={{fontFamily:IN,fontSize:9,fontWeight:600,color:TX3,letterSpacing:"0.1em",textTransform:"uppercase",padding:"0 8px",marginBottom:8}}>Views</div>
        {NAV_ITEMS.map(item=>{const active=tab===item;return<button key={item} onClick={()=>{setTab(item);setSideOpen(false);}} style={{width:"100%",display:"block",textAlign:"left",padding:"9px 12px",borderRadius:8,border:"none",cursor:"pointer",background:active?`${TEAL}18`:"transparent",color:active?TEAL:TX2,fontFamily:IN,fontSize:13,fontWeight:active?700:600,marginBottom:2}}>{item}</button>;})}
      </div>
      <div style={{padding:"8px 12px"}}>
        <div style={{fontFamily:IN,fontSize:9,fontWeight:600,color:TX3,letterSpacing:"0.1em",textTransform:"uppercase",padding:"0 8px",marginBottom:8}}>Year</div>
        <div style={{display:"flex",alignItems:"center",gap:6,padding:"0 8px",marginBottom:12}}>
          <button onClick={()=>setYear(y=>y-1)} style={{border:`1px solid ${BORDER}`,background:SURF3,color:TX2,borderRadius:6,cursor:"pointer",fontFamily:IN,fontSize:14,fontWeight:700,width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center"}}>←</button>
          <span style={{fontFamily:IN,fontSize:13,fontWeight:700,color:TX1,flex:1,textAlign:"center"}}>{year}</span>
          <button onClick={()=>setYear(y=>y+1)} style={{border:`1px solid ${BORDER}`,background:SURF3,color:TX2,borderRadius:6,cursor:"pointer",fontFamily:IN,fontSize:14,fontWeight:700,width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center"}}>→</button>
        </div>
        <div style={{fontFamily:IN,fontSize:9,fontWeight:600,color:TX3,letterSpacing:"0.1em",textTransform:"uppercase",padding:"0 8px",marginBottom:8}}>Month</div>
        {MONTHS.map(m=>{const active=month===m;return<button key={m} onClick={()=>{setMonth(m);setSideOpen(false);}} style={{width:"100%",display:"block",textAlign:"left",padding:"7px 12px",borderRadius:8,border:"none",cursor:"pointer",background:active?SURF3:"transparent",color:active?TX1:TX3,fontFamily:IN,fontSize:12,fontWeight:active?700:600,marginBottom:1}}>{m}</button>;})}
      </div>
    </>
  );

  return(
    <RoleCtx.Provider value={role}>
    <div style={{display:"flex",height:"100vh",overflow:"hidden",background:BG,fontFamily:IN}}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,700&family=Inter:wght@600&display=swap" rel="stylesheet"/>

      {/* Desktop sidebar */}
      {!isMob&&<div style={{width:220,flexShrink:0,background:SURF,borderRight:`1px solid ${BORDER}`,display:"flex",flexDirection:"column",padding:"24px 0",overflowY:"auto"}}>{sidebarContent}</div>}

      {/* Mobile: overlay drawer */}
      {isMob&&sideOpen&&<div style={{position:"fixed",inset:0,zIndex:100,display:"flex"}}>
        <div style={{width:240,background:SURF,borderRight:`1px solid ${BORDER}`,display:"flex",flexDirection:"column",padding:"24px 0",overflowY:"auto"}}>
          <div style={{padding:"0 20px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontFamily:IN,fontSize:11,fontWeight:700,color:TX1,letterSpacing:"0.12em",textTransform:"uppercase"}}>Tara Rose</div>
            <button onClick={()=>setSideOpen(false)} style={{border:"none",background:"none",cursor:"pointer",color:TX3,fontSize:20,lineHeight:1,padding:0}}>×</button>
          </div>
          {sidebarContent}
        </div>
        <div style={{flex:1,background:"rgba(0,0,0,0.5)"}} onClick={()=>setSideOpen(false)}/>
      </div>}

      <div style={{flex:1,overflow:"auto",paddingBottom:isMob?80:0}}>
        {/* Mobile top bar */}
        {isMob&&<div style={{position:"sticky",top:0,zIndex:40,background:SURF,borderBottom:`1px solid ${BORDER2}`,padding:"12px 16px",display:"flex",alignItems:"center",gap:12}}>
          <button onClick={()=>setSideOpen(true)} style={{border:"none",background:"none",cursor:"pointer",color:TX2,padding:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <div style={{flex:1}}>
            <div style={{fontFamily:IN,fontSize:13,fontWeight:700,color:TX1}}>{tab}</div>
            <div style={{fontFamily:IN,fontSize:10,fontWeight:600,color:TX3}}>{month} {year}</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
            {role!=="team"?(
              <>
                <span style={{fontFamily:IN,fontSize:10,fontWeight:700,background:`${TEAL}22`,color:TEAL,border:`1px solid ${TEAL}55`,borderRadius:20,padding:"3px 9px",letterSpacing:"0.06em",textTransform:"uppercase"}}>{role}</span>
                <button onClick={signOut} style={{fontFamily:IN,fontSize:11,fontWeight:700,color:TX2,border:`1px solid ${BORDER}`,background:SURF3,borderRadius:6,cursor:"pointer",padding:"4px 10px"}}>Sign out</button>
              </>
            ):(
              <button onClick={()=>{setSideOpen(true);setSigningIn(true);}} style={{fontFamily:IN,fontSize:11,fontWeight:700,color:TEAL,border:`1px solid ${TEAL}55`,background:`${TEAL}18`,borderRadius:6,cursor:"pointer",padding:"4px 10px"}}>Sign in</button>
            )}
          </div>
        </div>}

        <div style={{padding:isMob?"16px 14px":"32px 28px"}}>
          {!isMob&&<div style={{marginBottom:28}}>
            <Label>Content System · {year}</Label>
            <SectionRule color={TEAL}/>
            <HL size={32}>{tab}</HL>
            <div style={{fontFamily:IN,fontSize:12,fontWeight:600,color:TX3,marginTop:6}}>{month} {year} · Four locations · Dubai and Abu Dhabi</div>
          </div>}
          <div key={month+year+tab}>
            {tab==="Feed Calendar"&&<FeedTab month={month} year={year}/>}
            {tab==="Stories"&&<StoriesTab month={month} year={year}/>}
            {tab==="Analytics"&&(
              <div style={{textAlign:"center",padding:"80px 20px",border:`1px dashed ${BORDER}`,borderRadius:12}}>
                <SectionRule color={PURPLE}/>
                <div style={{fontFamily:PF,fontWeight:700,fontStyle:"italic",fontSize:22,color:TX3,marginBottom:8}}>Analytics</div>
                <div style={{fontFamily:IN,fontSize:13,fontWeight:600,color:TX4}}>Coming soon.</div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile bottom nav */}
        {isMob&&<div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:40,background:SURF,borderTop:`1px solid ${BORDER2}`,display:"flex",padding:"8px 0 max(8px,env(safe-area-inset-bottom))"}}>
          {NAV_ITEMS.map(item=>{const active=tab===item;return(
            <button key={item} onClick={()=>setTab(item)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,border:"none",background:"none",cursor:"pointer",padding:"6px 4px",color:active?TEAL:TX4}}>
              <div style={{fontFamily:IN,fontSize:10,fontWeight:active?700:600,letterSpacing:"0.03em"}}>{item}</div>
            </button>
          );})}
        </div>}
      </div>
    </div>
    </RoleCtx.Provider>
  );
}