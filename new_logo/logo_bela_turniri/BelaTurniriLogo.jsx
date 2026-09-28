// bela·turniri logo — K1b (lepeza od četiri karte)
// <BelaTurniriIcon theme="light|dark" size={40}/>  <BelaTurniriLogo theme="light|dark" tagline/>
import React, {useId} from "react";
const THEMES={light:{tile:"#2E6343",bd:null,face:"#FFFDF8",ink:"var(--ink,#2A211A)",dot:"var(--brand,#2E6343)",muted:"var(--muted,#6E6152)"},dark:{tile:"#0A3D1C",bd:"#2D2D31",face:"#F6F0E4",ink:"var(--ink,#FAFAFA)",dot:"var(--brand,#7FC496)",muted:"var(--muted,#A1A1AA)"}};
export function BelaTurniriIcon({theme="light",size=40,title="bela·turniri",...rest}){
  const t=THEMES[theme]; const id=useId().replace(/:/g,"");
  return (<svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={title} {...rest}>
    <defs><clipPath id={"bt"+id}><rect width="100" height="100" rx="22.5"/></clipPath></defs>
    <rect width="100" height="100" rx="22.5" fill={t.tile}/>
    {t.bd && <rect x=".75" y=".75" width="98.5" height="98.5" rx="21.8" fill="none" stroke={t.bd} strokeWidth="1.5"/>}
    <g clipPath={"url(#bt"+id+")"}><g transform="rotate(-36 50 88)"><rect x="34" y="24" width="32" height="48" rx="5" fill={t.face} stroke={t.tile} strokeWidth="3"/><path d="M50 8C32 26 12 40 12 58a20 20 0 0 0 33 15l-3 19h16l-3-19a20 20 0 0 0 33-15C88 40 68 26 50 8Z" fill="#4DA66A" transform="translate(37 27) scale(0.12)"/></g><g transform="rotate(-12 50 88)"><rect x="34" y="24" width="32" height="48" rx="5" fill={t.face} stroke={t.tile} strokeWidth="3"/><path d="M46 8h8v8h-8zM22 42c0-16 12-26 28-26s28 10 28 26v6H22zM27 54h46c0 20-11 34-23 38C38 88 27 74 27 54Z" fill="#B8823F" transform="translate(37 27) scale(0.12)"/></g><g transform="rotate(12 50 88)"><rect x="34" y="24" width="32" height="48" rx="5" fill={t.face} stroke={t.tile} strokeWidth="3"/><path d="M42 20a8 8 0 0 1 16 0v3c13 6 20 20 20 39v6h8v8H14v-8h8v-6c0-19 7-33 20-39zM42 86a8 8 0 1 0 16 0a8 8 0 1 0-16 0z" fill="#F2C14E" transform="translate(37 27) scale(0.12)"/></g><g transform="rotate(36 50 88)"><rect x="34" y="24" width="32" height="48" rx="5" fill={t.face} stroke={t.tile} strokeWidth="3"/><path d="M50 88C22 66 10 52 10 33a20 20 0 0 1 40-8a20 20 0 0 1 40 8c0 19-12 33-40 55Z" fill="#E24B4A" transform="translate(37 27) scale(0.12)"/><path d="M50 88C22 66 10 52 10 33a20 20 0 0 1 40-8a20 20 0 0 1 40 8c0 19-12 33-40 55Z" fill="#E24B4A" transform="translate(41 40) scale(0.18)"/></g></g>
  </svg>);
}
export function BelaTurniriLogo({theme="light",size=40,tagline=false,className,style}){
  const t=THEMES[theme];
  return (<span className={className} style={{display:"inline-flex",alignItems:"center",gap:size*.22,...style}}>
    <BelaTurniriIcon theme={theme} size={size}/>
    <span style={{display:"flex",flexDirection:"column",gap:size*.06}}>
      <span style={{fontFamily:"var(--font-display,'Bricolage Grotesque'),system-ui,sans-serif",fontWeight:700,fontSize:size*.55,letterSpacing:"-0.032em",lineHeight:1,color:t.ink,whiteSpace:"nowrap"}}>bela<span style={{color:t.dot}}>·</span>turniri</span>
      {tagline && <span style={{fontFamily:"var(--font-mono,'JetBrains Mono'),monospace",fontWeight:600,fontSize:Math.max(10,size*.12),letterSpacing:".16em",textTransform:"uppercase",color:t.muted}}>organizacija i rezultati</span>}
    </span>
  </span>);
}
export default BelaTurniriLogo;
