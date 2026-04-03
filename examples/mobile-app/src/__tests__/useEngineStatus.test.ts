import { renderHook } from '@testing-library/react-native';
import { useEngineStatus } from '../hooks/useEngineStatus';
import { engineManager } from '../services/engineManager';

jest.mock('../services/engineManager', () => ({
  engineManager: {
    getEngine: jest.fn(),
  },
}));

const mockGetEngine = engineManager.getEngine as jest.Mock;

describe('useEngineStatus', () => {
  it('returns null status when no engine is initialised', () => {
    mockGetEngine.mockImplementation(() => {
      throw new Error('no engine');
    });
    const { result } = renderHook(() => useEngineStatus());
    expect(result.current.status).toBeNull();
    expect(result.current.stabilityScore).toBe(0);
  });

  it('returns stability score from engine', () => {
    mockGetEngine.mockReturnValue({
      status: () => ({ stability: 0.85, canStop: false }),
    });
    const { result } = renderHook(() => useEngineStatus());
    expect(result.current.stabilityScore).toBe(85);
  });

  it('shows Stable label when canStop is true', () => {
    mockGetEngine.mockReturnValue({
      status: () => ({ stability: 0.95, canStop: true }),
    });
    const { result } = renderHook(() => useEngineStatus());
    expect(result.current.label).toMatch(/Stable/);
  });
});
