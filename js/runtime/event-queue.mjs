export function createEventQueue(options = {}) {
  const items = [];
  const rawCapacity = Number(options.capacity);
  const capacity = Number.isFinite(rawCapacity) && rawCapacity > 0
    ? Math.max(1, Math.floor(rawCapacity))
    : Infinity;

  function trim() {
    if (items.length <= capacity) return;
    items.splice(0, items.length - capacity);
  }

  return {
    push(value) {
      if (value == null) return items.length;
      items.push(value);
      trim();
      return items.length;
    },
    shift() {
      return items.length ? items.shift() : null;
    },
    peek() {
      return items.length ? items[0] : null;
    },
    clear() {
      items.length = 0;
    },
    size() {
      return items.length;
    },
    toArray() {
      return items.slice();
    }
  };
}
