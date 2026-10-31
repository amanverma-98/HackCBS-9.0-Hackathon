package com.talk2;
import java.util.*;

/** Priority at packet boundaries: never interleave fragments of two packets. */
final class MeshSendQueue {
 private static final class Item {final String id;final int priority;final ArrayDeque<byte[]> frames;
  Item(String id,int priority,List<byte[]> frames){this.id=id;this.priority=priority;this.frames=new ArrayDeque<>(frames);}}
 private final List<Item> pending=new ArrayList<>();private Item active;
 synchronized boolean offer(String id,int priority,List<byte[]> frames){
  if(active!=null&&active.id.equals(id)||pending.stream().anyMatch(p->p.id.equals(id)))return true;
  if(pending.size()>=4){Item low=Collections.min(pending,Comparator.comparingInt(p->p.priority));if(priority<=low.priority)return false;pending.remove(low);}
  pending.add(new Item(id,priority,frames));return true;
 }
 synchronized byte[] peek(){if(active==null&&!pending.isEmpty()){pending.sort((a,b)->Integer.compare(b.priority,a.priority));active=pending.remove(0);}return active==null?null:active.frames.peek();}
 synchronized void sent(){if(active!=null){active.frames.poll();if(active.frames.isEmpty())active=null;}}
}
