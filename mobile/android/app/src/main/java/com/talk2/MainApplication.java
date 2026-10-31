package com.talk2;
import android.app.Application;
import com.facebook.react.*;
import com.facebook.react.defaults.DefaultReactNativeHost;
import com.facebook.soloader.SoLoader;
import com.facebook.react.soloader.OpenSourceMergedSoMapping;
import java.util.*;
public class MainApplication extends Application implements ReactApplication {
 private final ReactNativeHost host=new DefaultReactNativeHost(this){
  @Override public boolean getUseDeveloperSupport(){return BuildConfig.DEBUG;}
  @Override protected List<ReactPackage> getPackages(){List<ReactPackage> p=new PackageList(this).getPackages();p.add(new Talk2Package());return p;}
  @Override protected String getJSMainModuleName(){return "index";}
  @Override protected boolean isNewArchEnabled(){return false;}
  @Override protected Boolean isHermesEnabled(){return true;}
 };
 @Override public ReactNativeHost getReactNativeHost(){return host;}
 @Override public void onCreate(){super.onCreate();try{SoLoader.init(this,OpenSourceMergedSoMapping.INSTANCE);}catch(java.io.IOException e){throw new RuntimeException("Unable to load Talk2 native runtime",e);}}
}
