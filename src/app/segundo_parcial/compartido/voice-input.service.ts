import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { RuntimeConfigService } from '../../core/runtime-config.service';

export function encodeVoiceWav(chunks: Float32Array[], rate: number): Uint8Array {
  const length=chunks.reduce((n,c)=>n+c.length,0), input=new Float32Array(length);
  let offset=0;for(const c of chunks){input.set(c,offset);offset+=c.length;}
  const size=Math.floor(length*16000/rate), bytes=new Uint8Array(44+size*2), view=new DataView(bytes.buffer);
  const text=(at:number,s:string)=>{for(let i=0;i<s.length;i++)view.setUint8(at+i,s.charCodeAt(i));};
  text(0,'RIFF');view.setUint32(4,36+size*2,true);text(8,'WAVE');text(12,'fmt ');
  view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
  view.setUint32(24,16000,true);view.setUint32(28,32000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);
  text(36,'data');view.setUint32(40,size*2,true);
  for(let i=0;i<size;i++){const from=Math.floor(i*rate/16000),to=Math.max(from+1,Math.floor((i+1)*rate/16000));let sample=0;for(let j=from;j<to&&j<length;j++)sample+=input[j];sample=Math.max(-1,Math.min(1,sample/(to-from)));view.setInt16(44+i*2,sample*(sample<0?32768:32767),true);}
  return bytes;
}

/** A component-scoped microphone session shared by Altair and business reports. */
@Injectable()
export class VoiceInputService {
  private http=inject(HttpClient);private runtime=inject(RuntimeConfigService);
  readonly listening=signal(false);readonly processing=signal(false);readonly seconds=signal(0);
  private stream?:MediaStream;private audio?:AudioContext;private processor?:ScriptProcessorNode;
  private chunks:Float32Array[]=[];private timer?:ReturnType<typeof setInterval>;private session=0;
  private accept?:(text:string)=>void;private reject?:(error:Error)=>void;private purpose:'ALTAIR'|'REPORTE'='ALTAIR';
  async start(purpose:'ALTAIR'|'REPORTE',accept:(text:string)=>void,reject:(error:Error)=>void):Promise<void>{
    if(this.listening()||this.processing())return;
    if(!navigator.onLine){reject(new Error('Necesitas conexión para transcribir tu voz. Puedes seguir escribiendo.'));return;}
    if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){reject(new Error('Abre la tienda mediante HTTPS y permite el acceso al micrófono.'));return;}
    this.accept=accept;this.reject=reject;this.purpose=purpose;const session=++this.session;
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true}});
      if(session!==this.session){stream.getTracks().forEach(t=>t.stop());return;}
      this.stream=stream;this.audio=new AudioContext({sampleRate:16000});await this.audio.resume();
      this.chunks=[];this.seconds.set(0);this.processor=this.audio.createScriptProcessor(4096,1,1);
      const source=this.audio.createMediaStreamSource(stream);source.connect(this.processor);this.processor.connect(this.audio.destination);
      this.processor.onaudioprocess=e=>{if(this.listening())this.chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));};
      this.listening.set(true);this.timer=setInterval(()=>{this.seconds.update(n=>n+1);if(this.seconds()>=60)void this.stop();},1000);
    }catch(e:any){this.release();this.listening.set(false);reject(new Error(e?.name==='NotAllowedError'?'Permite el micrófono en la configuración de este sitio y vuelve a intentarlo.':e?.name==='NotFoundError'?'No encontramos un micrófono conectado.':'No pudimos abrir el micrófono. Revisa el dispositivo y sus permisos.'));}
  }
  async stop():Promise<void>{
    if(!this.listening())return;this.listening.set(false);this.processing.set(true);
    const session=this.session, rate=this.audio?.sampleRate||16000, chunks=this.chunks;this.release();
    try{
      const bytes=encodeVoiceWav(chunks,rate);
      if(bytes.length<6444)throw new Error('La grabación fue muy corta. Habla unos segundos y vuelve a intentarlo.');
      let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
      const result=await firstValueFrom(this.http.post<{texto:string}>(this.runtime.apiUrl+'/voice/transcribe',{audio_wav:btoa(binary),proposito:this.purpose}).pipe(timeout(45000)));
      if(session===this.session)this.accept?.(result.texto);
    }catch(e:any){if(session===this.session){const detail=e?.error?.detail;this.reject?.(new Error(typeof detail==='string'?detail:e?.message||'No pudimos transcribir la voz. Reintenta o escribe tu consulta.'));}}
    finally{if(session===this.session)this.processing.set(false);this.chunks=[];}
  }
  private release(){if(this.timer)clearInterval(this.timer);this.processor?.disconnect();if(this.processor)this.processor.onaudioprocess=null;this.stream?.getTracks().forEach(t=>t.stop());void this.audio?.close().catch(()=>{});this.processor=undefined;this.stream=undefined;this.audio=undefined;}
  cancel(){this.session++;this.release();this.chunks=[];this.listening.set(false);this.processing.set(false);}
}
