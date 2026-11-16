import { createContext, useContext, useEffect, useState } from "react";
import { subscribeToHub } from "./subscribeToHub";

export function voteTotal(options) {
  return options.reduce((total, option) => total + option.voteCount, 0);
}

export const PollResultsContext = createContext(null);

export function useLivePolls() {
  return useContext(PollResultsContext);
}

export function useLiveCommunity(token) {
  const [results, setResults] = useState(() => new Map());
  const [connected, setConnected] = useState(false);
  const [connectionVersion, setConnectionVersion] = useState(0);
  const [inboxVersion, setInboxVersion] = useState(0);

  useEffect(() => {
    if (!token) return;
    const ready = () => {
      setConnected(true);
      setConnectionVersion(version => version + 1);
      setInboxVersion(version => version + 1);
    };
    const updatePoll = result => {
      setResults(previous => {
        const current = previous.get(result.postId);
        if (current && voteTotal(current.options) >= voteTotal(result.options)) return previous;
        return new Map(previous).set(result.postId, result);
      });
    };
    return subscribeToHub("/api/hubs/polls", token, {
      PollUpdated: updatePoll,
      NotificationsChanged: () => setInboxVersion(version => version + 1),
    }, ready, () => setConnected(false));
  }, [token]);

  return { pollResults: { results, connected, connectionVersion }, inboxVersion };
}
