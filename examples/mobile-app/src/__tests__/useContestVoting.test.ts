import { renderHook, waitFor } from '@testing-library/react-native';
import { useContestVoting } from '../hooks/useContestVoting';
import { socialApi } from '../services/socialApi';

jest.mock('../services/socialApi', () => ({
  socialApi: {
    getNextPair: jest.fn(),
    voteInContest: jest.fn(),
  },
}));

jest.mock('../services/voteQueue', () => ({
  voteQueue: {
    getQueue: jest.fn().mockReturnValue([]),
    remove: jest.fn(),
    enqueue: jest.fn().mockReturnValue('mock-id'),
    incrementRetry: jest.fn(),
    getPendingCount: jest.fn().mockReturnValue(0),
  },
}));

jest.mock('../services/retryBackoff', () => ({
  retryWithBackoff: jest.fn((fn: () => unknown) => fn()),
}));

const mockGetNextPair = socialApi.getNextPair as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useContestVoting', () => {
  it('fetches initial pair on mount', async () => {
    mockGetNextPair.mockResolvedValueOnce({
      nextPair: { a: 'track-a', b: 'track-b' },
      pairMeta: null,
    });
    const { result } = renderHook(() => useContestVoting('contest-1', 'user-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.currentPair).toEqual(['track-a', 'track-b']);
  });

  it('sets done=true when server returns null nextPair', async () => {
    mockGetNextPair.mockResolvedValueOnce({ nextPair: null });
    const { result } = renderHook(() => useContestVoting('contest-1', 'user-1'));
    await waitFor(() => expect(result.current.done).toBe(true));
  });

  it('does not fetch if contestId is empty or userId is null', () => {
    renderHook(() => useContestVoting('', null));
    expect(mockGetNextPair).not.toHaveBeenCalled();
  });
});
