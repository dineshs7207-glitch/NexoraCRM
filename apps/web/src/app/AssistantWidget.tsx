import { useRef, useState } from 'react';
import { Alert, Avatar, Box, Button, IconButton, Paper, Stack, TextField, Typography } from '@mui/material';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import CloseIcon from '@mui/icons-material/Close';

// A movable launcher and honest integration placeholder; no model is called until a provider is configured.
export function AssistantWidget(){
  const [position,setPosition]=useState({right:24,bottom:88});
  const [open,setOpen]=useState(false);
  const pointer=useRef<{x:number;y:number;right:number;bottom:number;moved:boolean}|null>(null);
  const down=(event:React.PointerEvent<HTMLButtonElement>)=>{pointer.current={x:event.clientX,y:event.clientY,right:position.right,bottom:position.bottom,moved:false};event.currentTarget.setPointerCapture(event.pointerId);};
  const move=(event:React.PointerEvent<HTMLButtonElement>)=>{const origin=pointer.current;if(!origin)return;const dx=event.clientX-origin.x,dy=event.clientY-origin.y;if(Math.abs(dx)+Math.abs(dy)>6)origin.moved=true;setPosition({right:Math.max(8,Math.min(window.innerWidth-64,origin.right-dx)),bottom:Math.max(8,Math.min(window.innerHeight-64,origin.bottom-dy))});};
  const up=()=>{if(pointer.current&&!pointer.current.moved)setOpen(value=>!value);pointer.current=null;};
  return <>
    {open&&<Paper elevation={12} sx={{position:'fixed',right:position.right,bottom:position.bottom+68,width:{xs:'calc(100vw - 24px)',sm:360},maxWidth:360,zIndex:1300,p:2,border:'1px solid',borderColor:'divider'}}><Stack direction="row" alignItems="center" justifyContent="space-between"><Stack direction="row" gap={1} alignItems="center"><Avatar sx={{width:36,height:36,color:'#fff',background:'linear-gradient(135deg,#2563EB,#7C3AED)'}}><SmartToyOutlinedIcon/></Avatar><Box><Typography fontWeight={700}>Nexora Assistant</Typography><Typography variant="caption" color="text.secondary">Workspace helper</Typography></Box></Stack><IconButton aria-label="Close assistant" size="small" onClick={()=>setOpen(false)}><CloseIcon fontSize="small"/></IconButton></Stack><Alert severity="info" sx={{my:1.5}}>The chat is ready for your chosen AI provider. No messages are sent until an API is configured.</Alert><TextField fullWidth size="small" placeholder="Connect an AI provider to start chatting" disabled/><Button fullWidth variant="contained" disabled sx={{mt:1}}>Send</Button></Paper>}
    <Box sx={{position:'fixed',right:position.right,bottom:position.bottom,zIndex:1301,touchAction:'none'}}><IconButton aria-label="Move or open Nexora assistant" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={()=>{pointer.current=null;}} sx={{width:60,height:60,bgcolor:'transparent',color:'#fff',background:'linear-gradient(145deg,#2563EB 0%,#6D5DFB 55%,#06B6D4 100%)',border:'2px solid rgba(255,255,255,.85)',boxShadow:'0 8px 26px rgba(37,99,235,.38)',animation:'nexora-bot-pulse 2.8s ease-in-out infinite','&:hover':{filter:'brightness(1.08)',transform:'translateY(-2px)'},'@keyframes nexora-bot-pulse':{'0%,100%':{boxShadow:'0 8px 26px rgba(37,99,235,.32)'},'50%':{boxShadow:'0 8px 32px rgba(109,93,251,.6)'}}}}><SmartToyOutlinedIcon sx={{fontSize:28,filter:'drop-shadow(0 1px 2px rgba(0,0,0,.2))'}}/></IconButton></Box>
  </>;
}
