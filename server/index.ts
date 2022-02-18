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

const sessions: Session[] = [];
const requestHandler = async (req: IncomingMessage, res: ServerResponse) => {

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Request-Method', '*');
    res.setHeader('Access-Control-Allow-Methods', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');

    log(req.url);
    const url = parse(req.url!);

    const buffer = await readBuffer(req);
    const data = buffer.toString("utf8");
    const query = qsParse(url.query!);

    switch (url.pathname) {
        case '/start': {
            if (!isMethod(req, res, 'post')) break;
            const requestBody = JSON.parse(data);
            const id = requestBody.id;
            let session = sessions.find(s => s.id === id);
            if (!session) {
                session = new Session(requestBody.name, id);
                sessions.push(session);
                res.writeHead(200, { 'content-type': 'application/json' });
                res.end(data);
            } else {
                res.writeHead(204);
                res.end();
            }
            break;
        }
        case '/join': {
            if (!isMethod(req, res, 'post')) break;
            const session = findSession(query.id as string, res);
            if (session === null) break;
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify({
                id: session.id,
                name: session.name,
                players: session.players.map(p => ({ id: p.id, name: p.name }))
            }));
            break;
        }
        // start SSE
        case '/join-player': {
            const session = findSession(query.session_id as string, res);
            if (session === null) break;
            const playerId = query.player_id as string;
            const players = session.players;
            let player = players.find(p => p.id === playerId);
            if (player != null) {
                player.res = res;
            } else {
                player = new Player(playerId, query.player_name as string, res);
                players.push(player);
            }
            // req.socket.setNoDelay(true);
            res.connection.setTimeout(0);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.write('');

            req.on("close", () => {
                log(`closing connection for playerId: ${playerId}`);
                const index = players.findIndex((c) => c.id === playerId);
                if (index > -1) {
                    players.splice(index, 1);
                }
            });
            log(`Players# ${players.length}`);
            break;
        }
        // case '/broadcast':
        //     for (const client of clients) {
        //         client.res.write(`event: awesome-possum\nclientId: ${client.id}\ndata: ${data}\n\n`);
        //     }
        //     res.end();
        //     break;
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

function findSession(id: string, res: ServerResponse): Session | null {
    const session = sessions.find(s => s.id === id);
    if (session != null) return session;
    res.writeHead(404);
    res.end();
    return null;
}

function isMethod(req: IncomingMessage, res: ServerResponse, expected: 'post' | 'get') {
    if (req.method?.toLowerCase() === expected) return true;
    res.writeHead(405);
    res.end();
    return false;
}
class Session {
    public readonly players: Player[] = [];
    public constructor(
        public readonly name: string,
        public readonly id: string,
    ) { }
}

class Player {
    public constructor(
        public readonly id: string,
        public readonly name: string,
        public res: ServerResponse,
        public estimate?: number,
    ) { }
}