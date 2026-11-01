package com.talk2;

import java.util.HashMap;
import java.util.Map;

/**
 * Script unification for IndicTrans2's indic-indic model, which was trained on Indic text
 * written in Devanagari (IndicProcessor transliterates source to Devanagari and the output
 * back to the target script). Brahmic Unicode blocks share one layout, so most letters map
 * by block offset; letters a target script lacks map to the closest one it has.
 */
final class IndicScript {
 private IndicScript(){}
 private static final int DEVANAGARI=0x0900;
 private static final Map<String,Integer> BLOCK=new HashMap<>();
 static{BLOCK.put("hi",0x0900);BLOCK.put("mr",0x0900);BLOCK.put("bn",0x0980);BLOCK.put("gu",0x0A80);BLOCK.put("or",0x0B00);BLOCK.put("ta",0x0B80);BLOCK.put("te",0x0C00);BLOCK.put("kn",0x0C80);BLOCK.put("ml",0x0D00);}
 static boolean supported(String lang){return BLOCK.containsKey(lang);}

 /** Text in the language's own script rewritten in Devanagari. */
 static String toDevanagari(String text,String lang){
  int base=BLOCK.get(lang);if(base==DEVANAGARI)return text;StringBuilder out=new StringBuilder();
  text.codePoints().forEach(cp->{
   if(cp>=base&&cp<base+0x80){
    if(lang.equals("ml")&&cp>=0x0D7A&&cp<=0x0D7F){out.append(ML_CHILLU[cp-0x0D7A]).append('्');return;}
    if(lang.equals("or")&&cp==0x0B5F){out.append('य');return;}
    if(lang.equals("or")&&cp==0x0B71){out.append('व');return;}
    out.appendCodePoint(cp-base+DEVANAGARI);
   }else out.appendCodePoint(cp);
  });
  return out.toString();
 }

 /** Devanagari model output rewritten in the target language's script. */
 static String fromDevanagari(String text,String lang){
  int base=BLOCK.get(lang);if(base==DEVANAGARI)return text;StringBuilder out=new StringBuilder();
  text.codePoints().forEach(cp->{
   if(cp>=DEVANAGARI&&cp<DEVANAGARI+0x80&&cp!=0x0964&&cp!=0x0965){
    int mapped=cp-DEVANAGARI+base;
    if(!Character.isDefined(mapped)||Character.getType(mapped)==Character.UNASSIGNED)mapped=nearest(cp,lang,base);
    out.appendCodePoint(mapped);
   }else out.appendCodePoint(cp);
  });
  return out.toString();
 }

 private static final char[] ML_CHILLU={'ण','न','र','ल','ळ','क'};
 /** Closest letter in scripts that lack a Devanagari letter (mainly Tamil's single stop per class). */
 private static int nearest(int dev,String lang,int base){
  int offset=dev-DEVANAGARI;
  if(lang.equals("ta")){
   int[][] classes={{0x15,0x16,0x17,0x18},{0x1A,0x1B,0x1C,0x1D},{0x1F,0x20,0x21,0x22},{0x24,0x25,0x26,0x27},{0x2A,0x2B,0x2C,0x2D}};
   for(int[] group:classes)for(int member:group)if(member==offset){int pick=group[0]==0x1A&&(offset==0x1C||offset==0x1D)?0x1C:group[0];return base+pick;}
   if(offset==0x0B)return base+0x30;   // vocalic R -> ra
   if(offset==0x45||offset==0x49)return base+offset+1;
  }
  if(lang.equals("bn")&&offset==0x35)return base+0x2C; // va -> ba
  return dev; // keep Devanagari rather than drop the letter
 }
}
