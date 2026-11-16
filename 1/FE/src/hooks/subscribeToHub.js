import { HttpTransportType, HubConnectionBuilder, LogLevel } from "@microsoft/signalr";

export function subscribeToHub(path, token, handlers, onReady, onDisconnect) {
  let disposed = false;
  let retry;
  const connection = new HubConnectionBuilder()
    .withUrl(path, { accessTokenFactory: () => token, transport: HttpTransportType.LongPolling })
    .withAutomaticReconnect()
    .configureLogging(LogLevel.None)
    .build();

  const ready = () => { if (!disposed) onReady?.(); };
  const disconnect = () => { if (!disposed) onDisconnect?.(); };
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

  for (const [event, handle] of Object.entries(handlers)) {
    connection.on(event, message => { if (!disposed) handle(message); });
  }
  connection.onreconnecting(disconnect);
  connection.onreconnected(ready);
  connection.onclose(() => {
    disconnect();
    retryStart();
  });
  void start();
  return () => {
    disposed = true;
    clearTimeout(retry);
    void connection.stop();
  };
}
