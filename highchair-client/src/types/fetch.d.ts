// Augment fetch RequestInit with Chrome 142+ targetAddressSpace option
declare global {
  interface RequestInit {
    targetAddressSpace?: 'local' | 'private' | 'public' | 'loopback' | 'unknown';
  }
}

export {};


