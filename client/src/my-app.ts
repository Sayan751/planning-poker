export class MyApp {
  private source: EventSource;
  private eventLog: string[] = [];
  public message = 'Hello World!';

  public initiateSse() {
    if (!this.source) {
      const source = this.source = new EventSource(`http://localhost:3000/sse?clientId=${Math.random()}`);
      source.addEventListener("message", (event) => {
        console.log("message rcvd", event);
        this.eventLog.push(event.data);
      });
      source.addEventListener("awesome-possum", (event: MessageEvent) => {
        console.log("awesome-possum rcvd", event);
        this.eventLog.push(event.data);
      });
      source.addEventListener("open", (event) => {
        console.log("connection opened");
        console.log(event);
      });
    }
  }

  public broadcast() {
    fetch("http://localhost:3000/broadcast", {
      method: "POST",
      body: JSON.stringify({ x: Math.random() })
    });
  }
}
