package android.security.keystore;
public final class KeyGenParameterSpec implements java.security.spec.AlgorithmParameterSpec {
 public static final class Builder {
  public Builder(String alias,int purpose){}
  public Builder setAlgorithmParameterSpec(java.security.spec.AlgorithmParameterSpec spec){return this;}
  public Builder setDigests(String... digests){return this;}
  public KeyGenParameterSpec build(){throw new UnsupportedOperationException("JVM tests inject keys, never Android Keystore");}
 }
}
