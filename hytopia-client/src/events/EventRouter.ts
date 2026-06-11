type EventListener<TPayload> = (payload: TPayload) => void;

export default class EventRouter {
  public static readonly instance = new EventRouter();

  private _eventListeners: Map<string, Set<EventListener<any>>> = new Map();

  public on<TPayload>(eventType: string, listener: EventListener<TPayload>): void {
    let listeners = this._eventListeners.get(eventType);

    if (!listeners) {
      listeners = new Set();
      this._eventListeners.set(eventType, listeners);
    }

    listeners.add(listener);
  }

  public off<TPayload>(eventType: string, listener: EventListener<TPayload>): void {
    this._eventListeners.get(eventType)?.delete(listener);
  }

  public offAll(eventType: string): void {
    this._eventListeners.delete(eventType);
  }

  public emit<TPayload>(type: string, payload: TPayload): boolean {
    const listeners = this._eventListeners.get(type);

    if (!listeners || !listeners.size) {
      return false;
    }

    for (const listener of listeners) {
      try {
        listener(payload);
      } catch (error) {
        console.error(`EventRouter: Error in listener for "${type}":`, error);
      }
    }

    return true;
  }
}