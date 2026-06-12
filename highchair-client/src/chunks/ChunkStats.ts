export default class ChunkStats {
  public static count: number = 0;
  public static visibleCount: number = 0;
  public static blockCount: number = 0;
  public static opaqueFaceCount: number = 0;
  public static transparentFaceCount: number = 0;
  public static liquidFaceCount: number = 0;
  public static blockTextureCount: number = 0;

  public static reset(): void {
    ChunkStats.visibleCount = 0;
  }
}