"use client";
export function LogoutButton(){return <button type="button" onClick={async()=>{await fetch("/api/olv/logout",{method:"POST"});window.location.assign("/login");}}>Sign out</button>;}
