package com.talk2;
import ai.onnxruntime.*;
import org.json.*;
import java.util.*;
import java.nio.*;
import java.io.*;
/** Dual-vocabulary IndicTrans2. Script-safe pairs are gated until preprocessing is validated. */
public final class TranslationEngine {
 private final ModelStore store;TranslationEngine(ModelStore s){store=s;}
 static final class Tokenizer{
  final JSONObject vocab,special,tags;final Map<String,Integer> ranks=new HashMap<>();final Map<Integer,String> reverse=new HashMap<>();
  Tokenizer(JSONObject root,String side)throws Exception{JSONObject o=root.getJSONObject(side);vocab=o.getJSONObject("vocab");special=o.getJSONObject("special_tokens");tags=o.getJSONObject("lang_tags");JSONArray merges=root.getJSONArray("merges");for(int i=0;i<merges.length();i++)ranks.put(merges.getString(i),i);for(JSONObject obj:new JSONObject[]{vocab,special,tags}){Iterator<String> keys=obj.keys();while(keys.hasNext()){String k=keys.next();reverse.put(obj.getInt(k),k);}}}
  List<Long> encode(String text)throws Exception{List<Long> out=new ArrayList<>();for(String word:text.trim().split("\\s+")){List<String> parts=new ArrayList<>();("▁"+word).codePoints().forEach(cp->parts.add(new String(Character.toChars(cp))));while(parts.size()>1){int best=-1,rank=Integer.MAX_VALUE;for(int i=0;i<parts.size()-1;i++){int r=ranks.getOrDefault(parts.get(i)+" "+parts.get(i+1),Integer.MAX_VALUE);if(r<rank){rank=r;best=i;}}if(best<0)break;parts.set(best,parts.get(best)+parts.remove(best+1));}for(String p:parts)out.add((long)vocab.optInt(p,special.getInt("<unk>")));}return out;}
 }
 synchronized String translate(String text,String source,String target)throws Exception{
  if(source.equals(target))return text;
  if(!(source.equals("hi")&&target.equals("mr")||source.equals("mr")&&target.equals("hi")))throw new IOException("General offline translation for this pair is not validated. Original text is preserved. Quick alerts work across all ten languages.");
  if(!store.file("translation","ready.json").exists())throw new IOException("Download the shared translation pack first");
  JSONObject root=new JSONObject(ModelStore.read(store.file("translation","indictrans2-vocab.json")));Tokenizer src=new Tokenizer(root,"src"),tgt=new Tokenizer(root,"tgt");List<Long> tokens=new ArrayList<>();tokens.add(src.tags.getLong(source.equals("hi")?"hin_Deva":"mar_Deva"));tokens.add(src.tags.getLong(target.equals("hi")?"hin_Deva":"mar_Deva"));tokens.addAll(src.encode(text));tokens.add(src.special.getLong("</s>"));if(tokens.size()>256)throw new IOException("Translation input too long");
  long[] ids=tokens.stream().mapToLong(Long::longValue).toArray(),mask=new long[ids.length];Arrays.fill(mask,1);OrtEnvironment env=OrtEnvironment.getEnvironment();
  try(OrtSession.SessionOptions opts=new OrtSession.SessionOptions()){
   opts.setIntraOpNumThreads(2);opts.setInterOpNumThreads(1);
   try(OrtSession enc=env.createSession(store.file("translation","indictrans2-encoder-int8.onnx").getAbsolutePath(),opts);OrtSession dec=env.createSession(store.file("translation","indictrans2-decoder-int8.onnx").getAbsolutePath(),opts);OnnxTensor input=OnnxTensor.createTensor(env,LongBuffer.wrap(ids),new long[]{1,ids.length});OnnxTensor att=OnnxTensor.createTensor(env,LongBuffer.wrap(mask),new long[]{1,ids.length})){
    Map<String,OnnxTensor> feeds=new HashMap<>();feeds.put("input_ids",input);feeds.put("attention_mask",att);
    try(OrtSession.Result encoded=enc.run(feeds)){
     OnnxTensor hidden=(OnnxTensor)encoded.get(0);List<Long> generated=new ArrayList<>();long eos=tgt.special.getLong("</s>"),pad=tgt.special.getLong("<pad>");generated.add(eos);StringBuilder result=new StringBuilder();boolean ended=false;
     for(int step=0;step<128;step++){
      long[] gen=generated.stream().mapToLong(Long::longValue).toArray();try(OnnxTensor d=OnnxTensor.createTensor(env,LongBuffer.wrap(gen),new long[]{1,gen.length})){
       Map<String,OnnxTensor> df=new HashMap<>();df.put("decoder_input_ids",d);df.put("encoder_hidden_states",hidden);df.put("encoder_attention_mask",att);
       try(OrtSession.Result decoded=dec.run(df)){OnnxTensor logits=(OnnxTensor)decoded.get(0);long[] shape=logits.getInfo().getShape();int width=(int)shape[shape.length-1];FloatBuffer b=logits.getFloatBuffer();int offset=b.limit()-width,best=0;for(int j=1;j<width;j++)if(b.get(offset+j)>b.get(offset+best))best=j;if(best==eos||best==pad){ended=true;break;}generated.add((long)best);result.append(tgt.reverse.getOrDefault(best,""));}
      }
     }
     String resultText=result.toString().replace('▁',' ').trim();if(!ended||resultText.isEmpty())throw new IOException("Incomplete translation; original preserved");return resultText;
    }
   }
  }
 }
}
