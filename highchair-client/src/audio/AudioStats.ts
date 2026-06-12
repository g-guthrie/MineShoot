export default class AudioStats {
  public static count: number = 0;
  public static matrixUpdateCount: number = 0;
  public static matrixUpdateSkipCount: number = 0;

  public static reset(): void {
    AudioStats.count = 0;
    AudioStats.matrixUpdateCount = 0;
    AudioStats.matrixUpdateSkipCount = 0;
  }
}