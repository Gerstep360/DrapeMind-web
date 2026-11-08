import {encodeVoiceWav} from './voice-input.service';
describe('Entrada de voz',()=>{
  it('produces mono PCM WAV at 16kHz from the browser sample rate',()=>{
    const audio=new Float32Array(48000);audio.fill(.5);
    const bytes=encodeVoiceWav([audio.subarray(0,12000),audio.subarray(12000)],48000);
    const view=new DataView(bytes.buffer);
    expect(bytes.length).toBe(32044);expect(view.getUint16(22,true)).toBe(1);
    expect(view.getUint32(24,true)).toBe(16000);expect(view.getUint16(34,true)).toBe(16);
    expect(view.getUint32(40,true)).toBe(32000);expect(view.getInt16(44,true)).toBe(16383);
  });
});
