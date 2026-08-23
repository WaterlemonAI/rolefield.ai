"use client";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { Principal } from "@/lib/olv/session";
import { LogoutButton } from "../logout-button";

type CalendarEvent={id:string;title:string;description:string;location:string;startsAt:string;endsAt:string;allDay:boolean};
const dayKey=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const dateTimeValue=(date:Date)=>`${dayKey(date)}T${String(date.getHours()).padStart(2,"0")}:${String(date.getMinutes()).padStart(2,"0")}`;
const monthLabel=new Intl.DateTimeFormat(undefined,{month:"long",year:"numeric"});
const timeLabel=new Intl.DateTimeFormat(undefined,{hour:"numeric",minute:"2-digit"});

export function CalendarWorkspace({principal}:{principal:Principal}){
  const now=new Date();
  const [month,setMonth]=useState(()=>new Date(now.getFullYear(),now.getMonth(),1));
  const [selected,setSelected]=useState(()=>dayKey(now));
  const [events,setEvents]=useState<CalendarEvent[]>([]);
  const [editing,setEditing]=useState<CalendarEvent|null>(null);
  const [open,setOpen]=useState(false);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const range=useMemo(()=>{const start=new Date(month.getFullYear(),month.getMonth(),1);const end=new Date(month.getFullYear(),month.getMonth()+1,1);return {start:start.toISOString(),end:end.toISOString()};},[month]);
  const load=useCallback(async()=>{try{const response=await fetch(`/api/olv/calendar?start=${encodeURIComponent(range.start)}&end=${encodeURIComponent(range.end)}`,{cache:"no-store"});const body=await response.json();if(!response.ok)throw new Error(body.error||"Unable to load calendar.");setEvents(body.events);setError("");}catch(issue){setError(issue instanceof Error?issue.message:"Unable to load calendar.");}finally{setLoading(false);}},[range]);
  useEffect(()=>{let active=true;fetch(`/api/olv/calendar?start=${encodeURIComponent(range.start)}&end=${encodeURIComponent(range.end)}`,{cache:"no-store"}).then(async response=>{const body=await response.json();if(!response.ok)throw new Error(body.error||"Unable to load calendar.");return body.events as CalendarEvent[];}).then(next=>{if(active){setEvents(next);setError("");}}).catch(issue=>{if(active)setError(issue instanceof Error?issue.message:"Unable to load calendar.");}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[range]);
  const cells=useMemo(()=>{const first=new Date(month.getFullYear(),month.getMonth(),1);const start=new Date(first);start.setDate(1-first.getDay());return Array.from({length:42},(_,index)=>{const date=new Date(start);date.setDate(start.getDate()+index);return date;});},[month]);
  const byDay=useMemo(()=>events.reduce<Record<string,CalendarEvent[]>>((group,event)=>{const key=dayKey(new Date(event.startsAt));(group[key] ||= []).push(event);return group;},{}),[events]);
  const selectedEvents=byDay[selected]||[];
  function startCreate(dateKey=selected){const start=new Date(`${dateKey}T09:00`);if(dateKey===dayKey(new Date()))start.setHours(new Date().getHours()+1,0,0,0);const end=new Date(start.getTime()+3600000);setEditing({id:"",title:"",description:"",location:"",startsAt:start.toISOString(),endsAt:end.toISOString(),allDay:false});setOpen(true);}
  function edit(event:CalendarEvent){setEditing(event);setOpen(true);}
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!editing)return;setSaving(true);setError("");const form=new FormData(event.currentTarget);try{const response=await fetch("/api/olv/calendar",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:editing.id?"update":"create",...(editing.id?{id:editing.id}:{}),title:form.get("title"),description:form.get("description"),location:form.get("location"),startsAt:new Date(String(form.get("startsAt"))).toISOString(),endsAt:new Date(String(form.get("endsAt"))).toISOString(),allDay:form.get("allDay")==="on"})});const body=await response.json();if(!response.ok)throw new Error(body.error||"Unable to save event.");setOpen(false);setEditing(null);await load();}catch(issue){setError(issue instanceof Error?issue.message:"Unable to save event.");}finally{setSaving(false);}}
  async function remove(){if(!editing?.id||!confirm(`Delete “${editing.title}”?`))return;setSaving(true);try{const response=await fetch("/api/olv/calendar",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"delete",id:editing.id})});const body=await response.json();if(!response.ok)throw new Error(body.error||"Unable to delete event.");setOpen(false);setEditing(null);await load();}catch(issue){setError(issue instanceof Error?issue.message:"Unable to delete event.");}finally{setSaving(false);}}
  const moveMonth=(offset:number)=>setMonth(current=>new Date(current.getFullYear(),current.getMonth()+offset,1));
  const today=()=>{const date=new Date();setMonth(new Date(date.getFullYear(),date.getMonth(),1));setSelected(dayKey(date));};
  return <main className="olv-calendar">
    <header><Link href="/app" className="olv-wordmark">RoleField <i>CALENDAR</i></Link><nav><Link href="/app">Apps</Link><Link href="/app/mailbox">Mailbox</Link>{principal.orgRole==="ADMIN"&&<Link href="/app/admin">Admin</Link>}</nav><LogoutButton/></header>
    <section className="olv-calendar-title"><div><p>TIME OPERATIONS</p><h1>Calendar</h1><span>Your private schedule, visible only to you.</span></div><button className="button dark" onClick={()=>startCreate()}>+ New event</button></section>
    {error&&<div className="olv-calendar-alert" role="alert">{error}<button onClick={()=>setError("")}>×</button></div>}
    <section className="olv-calendar-shell">
      <div className="olv-calendar-main"><div className="olv-calendar-toolbar"><button onClick={()=>moveMonth(-1)} aria-label="Previous month">←</button><button onClick={today}>Today</button><h2>{monthLabel.format(month)}</h2><button onClick={()=>moveMonth(1)} aria-label="Next month">→</button></div>
        <div className="olv-calendar-weekdays">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(day=><b key={day}>{day}</b>)}</div>
        <div className="olv-calendar-grid">{cells.map(date=>{const key=dayKey(date);const dayEvents=byDay[key]||[];const outside=date.getMonth()!==month.getMonth();const isToday=key===dayKey(new Date());return <button key={key} className={`${outside?"outside ":""}${selected===key?"selected ":""}${isToday?"today":""}`} onClick={()=>setSelected(key)} onDoubleClick={()=>startCreate(key)}><time>{date.getDate()}</time><span>{dayEvents.slice(0,3).map(item=><i key={item.id}>{item.allDay?"All day":timeLabel.format(new Date(item.startsAt))} · {item.title}</i>)}{dayEvents.length>3&&<em>+{dayEvents.length-3} more</em>}</span></button>;})}</div>
      </div>
      <aside><small>SELECTED DAY</small><h2>{new Date(`${selected}T12:00`).toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"})}</h2><button className="olv-add-day" onClick={()=>startCreate(selected)}>+ Add event</button>{loading?<p>Loading schedule…</p>:selectedEvents.length?<div>{selectedEvents.map(item=><button key={item.id} onClick={()=>edit(item)}><time>{item.allDay?"All day":timeLabel.format(new Date(item.startsAt))}</time><b>{item.title}</b>{item.location&&<span>{item.location}</span>}</button>)}</div>:<p>No events yet. Select “Add event” to plan this day.</p>}</aside>
    </section>
    {open&&editing&&<div className="olv-calendar-modal" role="dialog" aria-modal="true" aria-labelledby="event-title"><form onSubmit={submit}><header><div><small>{editing.id?"EDIT EVENT":"NEW EVENT"}</small><h2 id="event-title">{editing.id?editing.title||"Edit event":"Plan your time"}</h2></div><button type="button" onClick={()=>setOpen(false)} aria-label="Close">×</button></header><label>Event title<input name="title" required maxLength={200} defaultValue={editing.title} /></label><div className="olv-calendar-form-grid"><label>Starts<input name="startsAt" type="datetime-local" required defaultValue={dateTimeValue(new Date(editing.startsAt))}/></label><label>Ends<input name="endsAt" type="datetime-local" required defaultValue={dateTimeValue(new Date(editing.endsAt))}/></label></div><label className="check"><input name="allDay" type="checkbox" defaultChecked={editing.allDay}/> All-day event</label><label>Location<input name="location" maxLength={300} defaultValue={editing.location} placeholder="Optional"/></label><label>Notes<textarea name="description" maxLength={5000} defaultValue={editing.description} placeholder="Optional details"/></label><footer>{editing.id?<button type="button" className="danger" onClick={()=>void remove()} disabled={saving}>Delete</button>:<span/>}<div><button type="button" onClick={()=>setOpen(false)}>Cancel</button><button className="button dark" disabled={saving}>{saving?"Saving…":"Save event"}</button></div></footer></form></div>}
  </main>;
}
