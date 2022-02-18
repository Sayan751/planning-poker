import { createServer, IncomingMessage, ServerResponse } from "http";
import { AddressInfo } from "net";
import { parse } from "url";
import { parse as qsParse } from "querystring";

function log(msg: any) {
    console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function readBuffer(req: IncomingMessage): Promise<Buffer> {
    let totalLength: number = 0;
    const chunks: Buffer[] = [];

    req.on('data', function (chunk: Buffer) {
        chunks.push(chunk);
        totalLength += chunk.length;
    });

    return new Promise(function (resolve, reject) {
        req.on('end', function () {
            const buffer = Buffer.concat(chunks, totalLength);

            resolve(buffer);
        });

        req.on('error', reject);
    });
}

const clients: { id: string, req: IncomingMessage, res: ServerResponse }[] = [];
const requestHandler = async (req: IncomingMessage, res: ServerResponse) => {

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Request-Method', '*');
    res.setHeader('Access-Control-Allow-Methods', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');

    log(req.url);
    const url = parse(req.url!);

    const buffer = await readBuffer(req);
    const data = buffer.toString("utf8");

    switch (url.pathname) {
        // here we can look at the path to decide the exact event name and group the clients accordingly
        case '/sse':
            const id = qsParse(url.query!).clientId as string;
            if (!clients.find((c) => c.id === id)) {
                // req.socket.setNoDelay(true);
                res.connection.setTimeout(0);
                res.statusCode = 200;
                res.setHeader('Content-Type', 'text/event-stream');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Connection', 'keep-alive');
                res.write('');
                clients.push({ id, res, req });

                req.on("close", () => {
                    log(`closing connection for clientId: ${id}`);
                    const index = clients.findIndex((c) => c.id === id);
                    if (index > -1) {
                        clients.splice(index, 1)[0];
                    }
                });
            }
            log(`Clients# ${clients.length}`);
            break;
        case '/broadcast':
            for (const client of clients) {
                client.res.write(`event: awesome-possum\nclientId: ${client.id}\ndata: ${data}\n\n`);
            }
            res.end();
            break;
        default:
            res.end(`Hello from node http-server, url: ${req.url}, data: ${data}`);
            break;
    }
}

const server = createServer(requestHandler);
server.listen(3000, () => {
    const address = server.address() as AddressInfo;
    log(`server is running on http://localhost:${address.port}`)
});