package com.talk2;
import ai.onnxruntime.*;
import org.json.*;
import java.util.*;
import java.nio.*;
import java.io.*;
/**
 * Dual-vocabulary IndicTrans2. Indian languages to each other use the indic-indic model (pack
 * "translation"); English to and from Indian languages uses the en-indic / indic-en models (pack
 * "translation-en"). Only one model set is loaded at a time to bound memory.
 */
public final class TranslationEngine {
 private final ModelStore store;TranslationEngine(ModelStore s){store=s;}
 /**
  * The released Indian pack's vocab.json predates SentencePiece scores, so its exact
  * segmentation ships with the app ("score<TAB>piece" lines; the same Indic tokenizer as
  * indic-en's source side). Set by Talk2Module from assets, by the validation harness from a file.
  */
 java.util.concurrent.Callable<InputStream> indicScores;
 private Map<String,Double> indicScoreCache;
 private Map<String,Double> indicScores()throws Exception{
  if(indicScoreCache!=null||indicScores==null)return indicScoreCache;Map<String,Double> m=new HashMap<>(180000);
  try(BufferedReader r=new BufferedReader(new InputStreamReader(indicScores.call(),"UTF-8"))){String line;while((line=r.readLine())!=null){int tab=line.indexOf('\t');if(tab>0)m.put(line.substring(tab+1),Double.parseDouble(line.substring(0,tab)));}}
  return indicScoreCache=m;
 }
 /** Encoder, decoder and tokenizers stay loaded between messages; reloading them took seconds per call. */
 private Tokenizer src,tgt;private OrtSession enc,dec;private String loadedKey;
 private void load(String pack,String prefix)throws Exception{
  File e=store.file(pack,prefix+"encoder-int8.onnx"),d=store.file(pack,prefix+"decoder-int8.onnx"),v=store.file(pack,prefix+"vocab.json");
  String key=prefix+e.length()+":"+e.lastModified()+":"+d.length()+":"+d.lastModified()+":"+v.length()+":"+v.lastModified();if(key.equals(loadedKey))return;release();
  JSONObject root=new JSONObject(ModelStore.read(v));src=new Tokenizer(root,"src");tgt=new Tokenizer(root,"tgt");
  if(src.scores.isEmpty()&&pack.equals("translation")){Map<String,Double> bundled=indicScores();if(bundled!=null)src.scores.putAll(bundled);}OrtEnvironment env=OrtEnvironment.getEnvironment();
  try(OrtSession.SessionOptions opts=new OrtSession.SessionOptions()){opts.setIntraOpNumThreads(Math.max(2,Math.min(4,Runtime.getRuntime().availableProcessors()/2)));opts.setInterOpNumThreads(1);enc=env.createSession(e.getAbsolutePath(),opts);dec=env.createSession(d.getAbsolutePath(),opts);}
  loadedKey=key;
 }
 synchronized void release(){for(OrtSession x:new OrtSession[]{enc,dec})if(x!=null)try{x.close();}catch(Exception ignored){}enc=dec=null;src=tgt=null;loadedKey=null;}
 /** Loads the models ahead of the first message so the receiver does not wait for it. */
 synchronized boolean warm()throws Exception{if(!store.readyCached("translation"))return false;load("translation","indictrans2-");return true;}
 static final class Tokenizer{
  final JSONObject vocab,special,tags;final Map<String,Integer> ranks=new HashMap<>();final Map<String,Double> scores=new HashMap<>();final Map<Integer,String> reverse=new HashMap<>();
  Tokenizer(JSONObject root,String side)throws Exception{JSONObject o=root.getJSONObject(side);vocab=o.getJSONObject("vocab");special=o.getJSONObject("special_tokens");tags=o.getJSONObject("lang_tags");JSONArray merges=root.getJSONArray("merges");for(int i=0;i<merges.length();i++)ranks.put(merges.getString(i),i);
   // Newer packs carry SentencePiece piece scores, which give the exact segmentation; older ones only inferred merges.
   JSONObject sp=o.optJSONObject("spm_scores");if(sp!=null){Iterator<String> keys=sp.keys();while(keys.hasNext()){String k=keys.next();scores.put(k,sp.getDouble(k));}}
   for(JSONObject obj:new JSONObject[]{vocab,special,tags}){Iterator<String> keys=obj.keys();while(keys.hasNext()){String k=keys.next();reverse.put(obj.getInt(k),k);}}}
  List<Long> encode(String text)throws Exception{List<Long> out=new ArrayList<>();for(String word:text.trim().split("\\s+")){List<String> parts=new ArrayList<>();("▁"+word).codePoints().forEach(cp->parts.add(new String(Character.toChars(cp))));while(parts.size()>1){int best=-1;if(!scores.isEmpty()){double top=Double.NEGATIVE_INFINITY;for(int i=0;i<parts.size()-1;i++){Double s=scores.get(parts.get(i)+parts.get(i+1));if(s!=null&&s>top){top=s;best=i;}}}else{int rank=Integer.MAX_VALUE;for(int i=0;i<parts.size()-1;i++){int r=ranks.getOrDefault(parts.get(i)+" "+parts.get(i+1),Integer.MAX_VALUE);if(r<rank){rank=r;best=i;}}}if(best<0)break;parts.set(best,parts.get(best)+parts.remove(best+1));}for(String p:parts)out.add((long)vocab.optInt(p,special.getInt("<unk>")));}return out;}
 }
 /** IndicTrans2 language tags. English pairs use the en-indic / indic-en models. */
 static final Map<String,String> TAGS=new HashMap<>();
 static{TAGS.put("en","eng_Latn");TAGS.put("hi","hin_Deva");TAGS.put("mr","mar_Deva");TAGS.put("bn","ben_Beng");TAGS.put("gu","guj_Gujr");TAGS.put("or","ory_Orya");TAGS.put("ta","tam_Taml");TAGS.put("te","tel_Telu");TAGS.put("kn","kan_Knda");TAGS.put("ml","mal_Mlym");}
 /** Languages whose pairs passed scripts/validate-translation.ps1. Keep in sync with shared/translation-pairs.cjs. */
 // 2026-11-01 reports, with SentencePiece-score tokenization: all 23 Indian pairs (incl. Odia and
 // mr->hi, which failed with the old inferred merges) and all 18 English pairs pass, plus the
 // multi-sentence, 200-word run-on and cache checks. Packs installed with an older vocab keep the
 // old tokenizer until updated (Settings offers the update); Odia is weaker there.
 static final Set<String> ENABLED=new HashSet<>(Arrays.asList("hi","mr","bn","gu","or","ta","te","kn","ml"));
 // English pack (en-indic + indic-en).
 static final Set<String> ENGLISH=new HashSet<>(Arrays.asList("hi","mr","bn","gu","or","ta","te","kn","ml"));
 static boolean supports(String source,String target){
  if(source.equals("en"))return ENGLISH.contains(target);
  if(target.equals("en"))return ENGLISH.contains(source);
  return ENABLED.contains(source)&&ENABLED.contains(target);
 }
 /** English speech recognition returns capitals; the model was trained on normally cased text. */
 static String englishInput(String text){
  String t=text.trim();if(t.isEmpty()||!t.equals(t.toUpperCase(Locale.ROOT)))return t;
  String lower=t.toLowerCase(Locale.ROOT).replaceAll("\\bi\\b","I");return Character.toUpperCase(lower.charAt(0))+lower.substring(1);
 }
 /** IndicTrans2 was trained on Moses-style tokens: punctuation split from words ("hospital ?"), decimals kept. */
 static String splitPunctuation(String text){
  return text.replaceAll("([?!,;:\"()\\[\\]।॥])"," $1 ").replaceAll("\\.(?!\\d)|(?<!\\d)\\."," . ").replaceAll("\\s+"," ").trim();
 }
 /** Undoes the model's spaced punctuation in its output ("medicine ." -> "medicine."). */
 static String joinPunctuation(String text){
  return text.replaceAll("\\s+([?!,;:.।॥)\\]])","$1").replaceAll("([(\\[])\\s+","$1").trim();
 }
 synchronized String translate(String text,String source,String target)throws Exception{
  if(source.equals(target))return text;
  if(!supports(source,target))throw new IOException("UNSUPPORTED_PAIR: Offline translation from "+source+" to "+target+" is not available. The original is kept.");
  return translateRaw(text,source,target);
 }
 /** Recent results, so playing a message after it was translated on arrival costs nothing. */
 private final LinkedHashMap<String,String> cache=new LinkedHashMap<String,String>(16,0.75f,true){protected boolean removeEldestEntry(Map.Entry<String,String> e){return size()>64;}};
 /** Splits after sentence-ending punctuation; IndicTrans2 is a sentence-level model. */
 static List<String> sentences(String text){
  List<String> out=new ArrayList<>();for(String s:text.trim().split("(?<=[.?!।॥])\\s+|\\n+"))if(!s.trim().isEmpty())out.add(s.trim());return out;
 }
 /**
  * Ungated translation used by the validation harness. Translates sentence by sentence (long
  * messages no longer fail), with the source unified to Devanagari as IndicTrans2 expects.
  */
 synchronized String translateRaw(String text,String source,String target)throws Exception{
  if(!TAGS.containsKey(source)||!TAGS.containsKey(target))throw new IOException("UNSUPPORTED_PAIR: "+source+" to "+target);
  boolean english=source.equals("en")||target.equals("en");String pack=english?"translation-en":"translation";
  String prefix=!english?"indictrans2-":source.equals("en")?"indictrans2-en-indic-":"indictrans2-indic-en-";
  if(!store.readyCached(pack))throw new IOException(english?"Download the English translation pack first":"Download the shared translation pack first");
  String key=source+"|"+target+"|"+text;String hit=cache.get(key);if(hit!=null)return hit;
  load(pack,prefix);StringBuilder out=new StringBuilder();
  for(String sentence:sentences(text)){
   String prepared=splitPunctuation(source.equals("en")?englishInput(sentence):IndicScript.toDevanagari(sentence,source));
   // A run-on sentence (speech has no full stops) is cut into word groups the model can take.
   String[] words=prepared.split(" ");List<String> parts=new ArrayList<>();
   if(src.encode(prepared).size()<=120)parts.add(prepared);else for(int i=0;i<words.length;i+=30)parts.add(String.join(" ",Arrays.copyOfRange(words,i,Math.min(words.length,i+30))));
   for(String part:parts){String done=translatePiece(part,source,target);if(out.length()>0)out.append(' ');out.append(done);}
  }
  String result=out.toString().trim();if(result.isEmpty())throw new IOException("Incomplete translation; original preserved");
  cache.put(key,result);return result;
 }
 /** A piece the model does not finish (it can loop on unusual input) is halved and retried, down to 8 words. */
 private String translatePiece(String piece,String source,String target)throws Exception{
  try{return translateSentence(piece,source,target);}
  catch(IOException unfinished){
   String[] words=piece.split(" ");if(words.length<=8)throw unfinished;int mid=words.length/2;
   return translatePiece(String.join(" ",Arrays.copyOfRange(words,0,mid)),source,target)+" "+translatePiece(String.join(" ",Arrays.copyOfRange(words,mid,words.length)),source,target);
  }
 }
 /** One sentence through the encoder and a greedy decoder (no KV cache). */
 private String translateSentence(String sourceText,String source,String target)throws Exception{
  List<Long> tokens=new ArrayList<>();tokens.add(src.tags.getLong(TAGS.get(source)));tokens.add(src.tags.getLong(TAGS.get(target)));tokens.addAll(src.encode(sourceText));tokens.add(src.special.getLong("</s>"));if(tokens.size()>256)throw new IOException("Translation input too long");
  long[] ids=tokens.stream().mapToLong(Long::longValue).toArray(),mask=new long[ids.length];Arrays.fill(mask,1);OrtEnvironment env=OrtEnvironment.getEnvironment();
  {
   try(OnnxTensor input=OnnxTensor.createTensor(env,LongBuffer.wrap(ids),new long[]{1,ids.length});OnnxTensor att=OnnxTensor.createTensor(env,LongBuffer.wrap(mask),new long[]{1,ids.length})){
    Map<String,OnnxTensor> feeds=new HashMap<>();feeds.put("input_ids",input);feeds.put("attention_mask",att);
    try(OrtSession.Result encoded=enc.run(feeds)){
     OnnxTensor hidden=(OnnxTensor)encoded.get(0);List<Long> generated=new ArrayList<>();long eos=tgt.special.getLong("</s>"),pad=tgt.special.getLong("<pad>");generated.add(eos);StringBuilder result=new StringBuilder();boolean ended=false;
     int maxSteps=Math.min(256,16+3*ids.length);
     for(int step=0;step<maxSteps;step++){
      long[] gen=generated.stream().mapToLong(Long::longValue).toArray();try(OnnxTensor d=OnnxTensor.createTensor(env,LongBuffer.wrap(gen),new long[]{1,gen.length})){
       Map<String,OnnxTensor> df=new HashMap<>();df.put("decoder_input_ids",d);df.put("encoder_hidden_states",hidden);df.put("encoder_attention_mask",att);
       try(OrtSession.Result decoded=dec.run(df)){OnnxTensor logits=(OnnxTensor)decoded.get(0);long[] shape=logits.getInfo().getShape();int width=(int)shape[shape.length-1];FloatBuffer b=logits.getFloatBuffer();int offset=b.limit()-width,best=0;for(int j=1;j<width;j++)if(b.get(offset+j)>b.get(offset+best))best=j;if(best==eos||best==pad){ended=true;break;}generated.add((long)best);result.append(tgt.reverse.getOrDefault(best,""));}
      }
     }
     String resultText=joinPunctuation(result.toString().replace('▁',' '));if(!ended||resultText.isEmpty())throw new IOException("Incomplete translation; original preserved");return target.equals("en")?resultText:IndicScript.fromDevanagari(resultText,target);
    }
   }
  }
 }
}
