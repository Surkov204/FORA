import { HttpTransportType, HubConnectionBuilder, LogLevel } from "@microsoft/signalr";
import { useEffect, useState } from "react";

export function voteTotal(options) {
  return options.reduce((total, option) => total + option.voteCount, 0);
}

export function useLivePolls(token) {
  const [results, setResults] = useState(() => new Map());
  const [connected, setConnected] = useState(false);
  const [connectionVersion, setConnectionVersion] = useState(0);

  useEffect(() => {
    if (!token) return;
    let disposed = false;
    let retry;
    const connection = new HubConnectionBuilder()
      .withUrl("/api/hubs/polls", { accessTokenFactory: () => token, transport: HttpTransportType.LongPolling })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.None)
      .build();

    const ready = () => {
      if (disposed) return;
      setConnected(true);
      setConnectionVersion(version => version + 1);
    };
    const retryStart = () => {
      if (disposed) return;
      clearTimeout(retry);
      retry = setTimeout(start, 5000);
    };
    async function start() {
      try {
        await connection.start();
        ready();
      } catch {
        retryStart();
      }
    }

    connection.on("PollUpdated", result => {
      if (disposed) return;
      setResults(previous => {
        const current = previous.get(result.postId);
        if (current && voteTotal(current.options) >= voteTotal(result.options)) return previous;
        return new Map(previous).set(result.postId, result);
      });
    });
    connection.onreconnecting(() => { if (!disposed) setConnected(false); });
    connection.onreconnected(ready);
    connection.onclose(() => {
      if (disposed) return;
      setConnected(false);
      retryStart();
    });
    void start();
    return () => {
      disposed = true;
      clearTimeout(retry);
      void connection.stop();
    };
  }, [token]);

  return { results, connected, connectionVersion };
}
