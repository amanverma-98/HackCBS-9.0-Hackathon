package android.content;
/** Minimal file-system binding for desktop ModelStore integrity tests only. */
public final class Context {
 private final java.io.File directory;
 public Context(java.io.File directory){this.directory=directory;}
 public java.io.File getFilesDir(){return directory;}
}
