package android.util;
import java.io.*;
/** JVM test stand-in; Android supplies the production crash-safe implementation. */
public final class AtomicFile {
 private final File base,backup;
 public AtomicFile(File f){base=f;backup=new File(f.getPath()+".bak");}
 public File getBaseFile(){return base;}
 public FileInputStream openRead()throws IOException{if(backup.exists()){base.delete();if(!backup.renameTo(base))throw new IOException("restore");}return new FileInputStream(base);}
 public FileOutputStream startWrite()throws IOException{if(base.exists()){if(backup.exists())base.delete();else if(!base.renameTo(backup))throw new IOException("backup");}return new FileOutputStream(base);}
 public void finishWrite(FileOutputStream out)throws IOException{out.getFD().sync();out.close();backup.delete();}
 public void failWrite(FileOutputStream out)throws IOException{out.close();base.delete();backup.renameTo(base);}
}
