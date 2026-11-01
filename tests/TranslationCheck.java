package com.talk2;

import android.content.Context;
import org.json.JSONObject;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

/**
 * Dev-only check (scripts/validate-translation.ps1): runs the app's real TranslationEngine on
 * the release translation pack. A language is enabled only if translating to and from Hindi
 * and Marathi produces target-script text containing the key words of both sentences.
 */
public final class TranslationCheck {
 static final String[] LANGS={"hi","mr","bn","gu","or","ta","te","kn","ml"};
 // "I need water and medicine." / "Where is the nearest hospital?"
 static final Map<String,String[]> SENTENCES=new LinkedHashMap<>();
 // Any of these stems must appear: [0] water, [1] hospital.
 static final Map<String,String[][]> KEYWORDS=new HashMap<>();
 static final Map<String,Integer> BLOCK=Map.of("hi",0x0900,"mr",0x0900,"bn",0x0980,"gu",0x0A80,"or",0x0B00,"ta",0x0B80,"te",0x0C00,"kn",0x0C80,"ml",0x0D00);
 static{
  SENTENCES.put("en",new String[]{"I need water and medicine.","Where is the nearest hospital?"});
  SENTENCES.put("hi",new String[]{"मुझे पानी और दवा चाहिए।","सबसे नज़दीकी अस्पताल कहाँ है?"});
  SENTENCES.put("mr",new String[]{"मला पाणी आणि औषध हवे आहे.","सर्वात जवळचे रुग्णालय कुठे आहे?"});
  SENTENCES.put("bn",new String[]{"আমার জল এবং ওষুধ দরকার।","সবচেয়ে কাছের হাসপাতাল কোথায়?"});
  SENTENCES.put("gu",new String[]{"મને પાણી અને દવા જોઈએ છે.","સૌથી નજીકની હોસ્પિટલ ક્યાં છે?"});
  SENTENCES.put("or",new String[]{"ମୋତେ ପାଣି ଏବଂ ଔଷଧ ଦରକାର।","ସବୁଠାରୁ ନିକଟତମ ଡାକ୍ତରଖାନା କେଉଁଠି?"});
  SENTENCES.put("ta",new String[]{"எனக்கு தண்ணீர் மற்றும் மருந்து வேண்டும்.","அருகிலுள்ள மருத்துவமனை எங்கே?"});
  SENTENCES.put("te",new String[]{"నాకు నీరు మరియు మందు కావాలి.","దగ్గరలోని ఆసుపత్రి ఎక్కడ ఉంది?"});
  SENTENCES.put("kn",new String[]{"ನನಗೆ ನೀರು ಮತ್ತು ಔಷಧಿ ಬೇಕು.","ಹತ್ತಿರದ ಆಸ್ಪತ್ರೆ ಎಲ್ಲಿದೆ?"});
  SENTENCES.put("ml",new String[]{"എനിക്ക് വെള്ളവും മരുന്നും വേണം.","ഏറ്റവും അടുത്തുള്ള ആശുപത്രി എവിടെയാണ്?"});
  KEYWORDS.put("en",new String[][]{{"water"},{"hospital"}});
  KEYWORDS.put("hi",new String[][]{{"पानी","जल"},{"अस्पताल","हॉस्पिटल","चिकित्सालय"}});
  KEYWORDS.put("mr",new String[][]{{"पाणी","जल"},{"रुग्णालय","हॉस्पिटल","दवाखान","इस्पितळ"}});
  KEYWORDS.put("bn",new String[][]{{"জল","পানি"},{"হাসপাতাল"}});
  KEYWORDS.put("gu",new String[][]{{"પાણી","જળ"},{"હોસ્પિટલ","દવાખાન","ઇસ્પિતાલ"}});
  KEYWORDS.put("or",new String[][]{{"ପାଣି","ଜଳ"},{"ଡାକ୍ତରଖାନା","ହସ୍ପିଟାଲ","ଚିକିତ୍ସାଳୟ"}});
  KEYWORDS.put("ta",new String[][]{{"நீர்","தண்ணீ"},{"மருத்துவ","ஆஸ்பத்திரி","ஹாஸ்பிட"}});
  KEYWORDS.put("te",new String[][]{{"నీరు","నీళ్","నీటి"},{"ఆసుపత్రి","ఆస్పత్రి","హాస్పిటల్","వైద్యశాల"}});
  KEYWORDS.put("kn",new String[][]{{"ನೀರ"},{"ಆಸ್ಪತ್ರೆ","ಹಾಸ್ಪಿಟಲ್"}});
  KEYWORDS.put("ml",new String[][]{{"വെള്ള","ജല"},{"ആശുപത്രി","ഹോസ്പിറ്റ"}});
 }
 static boolean inScript(String text,String lang){if(lang.equals("en")){long letters=text.codePoints().filter(Character::isLetter).count(),latin=text.codePoints().filter(cp->Character.isLetter(cp)&&cp<0x0250).count();return letters>0&&latin>=letters*0.9;}int base=BLOCK.get(lang);long letters=text.codePoints().filter(Character::isLetter).count(),own=text.codePoints().filter(cp->cp>=base&&cp<base+0x80).count();return letters>0&&own>=letters*0.9;}
 static boolean mentions(String text,String[] stems){for(String s:stems)if(text.contains(s))return true;return false;}

 static String[] robustness(TranslationEngine engine,boolean englishMode){
  StringBuilder log=new StringBuilder();boolean pass=true;
  try{
   pass&=TranslationEngine.sentences("Help! Where is water? It is 3.5 km away.").size()==3;
   pass&=TranslationEngine.splitPunctuation("hospital? 3.5 km.").equals("hospital ? 3.5 km .");
   pass&=TranslationEngine.joinPunctuation("कहाँ है ? 3.5 किमी .").equals("कहाँ है? 3.5 किमी.");
   log.append("helpers ").append(pass?"ok":"FAIL").append(" | ");
   String from=englishMode?"en":"hi",to=englishMode?"hi":"mr";
   String two=SENTENCES.get(from)[0]+" "+SENTENCES.get(from)[1];String out=engine.translateRaw(two,from,to);
   boolean both=mentions(out,KEYWORDS.get(to)[0])&&mentions(out,KEYWORDS.get(to)[1]);pass&=both;log.append(both?"ok":"FAIL").append(" two sentences: ").append(out).append(" | ");
   StringBuilder runOn=new StringBuilder();for(int i=0;i<40;i++)runOn.append(SENTENCES.get(from)[0].replaceAll("[.।]","")).append(' ');
   long start=System.nanoTime();String longOut=engine.translateRaw(runOn.toString(),from,to);boolean longOk=!longOut.isEmpty()&&mentions(longOut,KEYWORDS.get(to)[0]);pass&=longOk;
   log.append(longOk?"ok":"FAIL").append(String.format(" run-on %d words in %d ms",runOn.toString().split(" ").length,(System.nanoTime()-start)/1000000));
   long cached=System.nanoTime();engine.translateRaw(two,from,to);boolean fast=(System.nanoTime()-cached)/1000000<20;pass&=fast;log.append(fast?" | ok":" | FAIL").append(" cached repeat");
  }catch(Exception e){pass=false;log.append("ERROR ").append(e);}
  return new String[]{pass?"PASS":"FAIL",log.toString()};
 }

 public static void main(String[] args)throws Exception{
  File cache=new File(args[0]);JSONObject manifest=new JSONObject(new String(Files.readAllBytes(Paths.get(args[1])),StandardCharsets.UTF_8));
  // English mode (args[3] == "en") checks the translation-en pack; otherwise the indic-indic pack.
  boolean englishMode=args.length>3&&args[3].equals("en");String packName=englishMode?"translation-en":"translation";
  Files.write(new File(cache,"packs/"+packName+"/ready.json").toPath(),manifest.getJSONObject("packs").getJSONObject(packName).toString().getBytes(StandardCharsets.UTF_8));
  TranslationEngine engine=new TranslationEngine(new ModelStore(new Context(cache)));
  // Same bundled Indic tokenizer scores the app loads from its assets.
  engine.indicScores=()->new FileInputStream("mobile/android/app/src/main/assets/translation/indic-spm-scores.tsv");
  List<String[]> pairs=new ArrayList<>();
  if(englishMode)for(String l:LANGS){pairs.add(new String[]{"en",l});pairs.add(new String[]{l,"en"});}
  else{pairs.add(new String[]{"hi","mr"});pairs.add(new String[]{"mr","hi"});
   for(String l:LANGS)if(!l.equals("hi")&&!l.equals("mr")){pairs.add(new String[]{l,"hi"});pairs.add(new String[]{l,"mr"});pairs.add(new String[]{"hi",l});}}
  Map<String,Boolean> ok=new LinkedHashMap<>();for(String l:LANGS)ok.put(l,true);
  try(PrintWriter report=new PrintWriter(new OutputStreamWriter(new FileOutputStream(args[2]),StandardCharsets.UTF_8))){
   for(String[] pair:pairs){
    boolean pass=true;StringBuilder line=new StringBuilder(pair[0]+" -> "+pair[1]+":");
    for(int i=0;i<2;i++){
     long start=System.nanoTime();String out;try{out=engine.translateRaw(SENTENCES.get(pair[0])[i],pair[0],pair[1]);}catch(Exception e){out="ERROR "+e.getMessage();}
     long ms=(System.nanoTime()-start)/1000000;boolean good=inScript(out,pair[1])&&mentions(out,KEYWORDS.get(pair[1])[i]);pass&=good;
     line.append(String.format(" [%s %d ms] %s |",good?"ok":"FAIL",ms,out));
    }
    report.println((pass?"PASS ":"FAIL ")+line);System.out.println((pass?"PASS ":"FAIL ")+pair[0]+" -> "+pair[1]);
    if(!pass&&englishMode){ok.put(pair[0].equals("en")?pair[1]:pair[0],false);}
    else if(!pass){String other=pair[0].equals("hi")||pair[0].equals("mr")?pair[1]:pair[0];ok.put(other,false);if(pair[0].equals("hi")&&pair[1].equals("mr")||pair[0].equals("mr")&&pair[1].equals("hi")){ok.put("hi",false);ok.put("mr",false);}}
   }
   // Robustness: helpers, a multi-sentence message and a long run-on message (speech has no full stops).
   String[] r=robustness(engine,englishMode);report.println(r[0]+" robustness: "+r[1]);System.out.println(r[0]+" robustness");
   StringBuilder enabled=new StringBuilder();for(Map.Entry<String,Boolean> e:ok.entrySet())if(e.getValue())enabled.append(e.getKey()).append(' ');
   report.println("ENABLE: "+enabled.toString().trim());System.out.println("ENABLE: "+enabled.toString().trim());
  }
 }
}
