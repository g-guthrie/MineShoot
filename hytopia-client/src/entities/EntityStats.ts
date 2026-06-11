// The Stats class prioritizes simplicity and is intended to be inserted
// into existing code without breaking maintainability. Extensibility
// is not specifically considered. Other Stats classes follow the same
// design principle.

export default class EntityStats {
  public static count: number = 0;
  public static staticEnvironmentCount: number = 0;
  public static inViewDistanceCount: number = 0;
  public static updateSkipCount: number = 0;
  public static localMatrixUpdateCount: number = 0;
  public static worldMatrixUpdateCount: number = 0;
  public static lightLevelUpdateCount: number = 0;
  public static animationPlayCount: number = 0;
  public static customTextureCount: number = 0;
  public static frustumCulledCount: number = 0;

  public static reset(): void {
    EntityStats.count = 0;
    EntityStats.inViewDistanceCount = 0;
    EntityStats.frustumCulledCount = 0;
    EntityStats.updateSkipCount = 0;
    EntityStats.localMatrixUpdateCount = 0;
    EntityStats.worldMatrixUpdateCount = 0;
    EntityStats.lightLevelUpdateCount = 0;
    EntityStats.animationPlayCount = 0;
    EntityStats.frustumCulledCount = 0;
  }
}