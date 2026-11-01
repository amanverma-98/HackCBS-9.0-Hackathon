package com.talk2;

public final class IndicScriptTest {
 static void check(boolean v,String m){if(!v)throw new AssertionError(m);}
 public static void main(String[] args){
  String[][] samples={
   {"bn","আমার জল এবং ওষুধ দরকার।"},{"gu","મને પાણી અને દવા જોઈએ છે."},{"or","ମୋତେ ପାଣି ଏବଂ ଔଷଧ ଦରକାର।"},
   {"ta","எனக்கு தண்ணீர் மற்றும் மருந்து வேண்டும்."},{"te","నాకు నీరు మరియు మందు కావాలి."},
   {"kn","ನನಗೆ ನೀರು ಮತ್ತು ಔಷಧಿ ಬೇಕು."},{"ml","എനിക്ക് വെള്ളവും മരുന്നും വേണം."}};
  for(String[] s:samples){
   String dev=IndicScript.toDevanagari(s[1],s[0]);
   check(dev.codePoints().filter(cp->cp>=0x0980&&cp<0x0D80).count()==0,s[0]+" leaves no source-script letters: "+dev);
   check(IndicScript.fromDevanagari(dev,s[0]).equals(s[1]),s[0]+" round trip: "+IndicScript.fromDevanagari(dev,s[0]));
  }
  check(IndicScript.toDevanagari("मुझे पानी चाहिए।","hi").equals("मुझे पानी चाहिए।"),"Devanagari unchanged");
  check(IndicScript.fromDevanagari("भाई","ta").equals("பாஈ"),"Tamil lacks aspirates: nearest stop used");
  check(IndicScript.toDevanagari("ൻ","ml").equals("न्"),"Malayalam chillu becomes consonant + virama");
  check(IndicScript.fromDevanagari("पानी।","gu").equals("પાની।"),"danda kept");
  check(!IndicScript.supported("en"),"English is not an Indic script");
  System.out.println("IndicScriptTest PASS: 7 scripts round-trip, Devanagari passthrough, Tamil nearest letters, Malayalam chillu, danda");
 }
}
