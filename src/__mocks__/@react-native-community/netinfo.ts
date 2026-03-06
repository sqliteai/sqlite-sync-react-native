type NetInfoCallback = (state: any) => void;
const listeners: NetInfoCallback[] = [];

const NetInfo = {
  addEventListener: jest.fn((callback: NetInfoCallback) => {
    listeners.push(callback);
    return jest.fn(() => {
      const idx = listeners.indexOf(callback);
      if (idx >= 0) listeners.splice(idx, 1);
    });
  }),
  fetch: jest.fn().mockResolvedValue({
    isConnected: true,
    isInternetReachable: true,
  }),
  __simulateChange: (state: any) => {
    listeners.forEach((cb) => cb(state));
  },
  __clearListeners: () => {
    listeners.length = 0;
  },
};

export default NetInfo;
