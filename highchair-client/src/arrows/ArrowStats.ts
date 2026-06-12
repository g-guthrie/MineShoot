export default class ArrowStats {
  public static count: number = 0;
  public static visibleCount: number = 0;

  public static reset(): void {
    ArrowStats.visibleCount = 0;
  }
}