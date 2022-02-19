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

    if (req.method?.toLowerCase() === 'options') { res.end(); return; }

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
                players: session.players.map(p => p.toJSON())
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
            res.connection.setTimeout(0);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.write('');

            const broadcastData = JSON.stringify(player);
            for (const $player of players) {
                if ($player === player) continue;
                $player.res.write(`event: player-joined\ndata: ${broadcastData}\n\n`);
            }

            res.socket.on("close", () => {
                log(`closing connection for playerId: ${playerId}`);
                const index = players.findIndex((c) => c.id === playerId);
                if (index > -1) {
                    const broadcastData = JSON.stringify(players.splice(index, 1)[0]);
                    for (const player of players) {
                        player.res.write(`event: player-left\ndata: ${broadcastData}\n\n`);
                    }
                }
                res.end();
            });
            log(`Players# ${players.length}`);
            break;
        }
        case '/put-estimate': {
            if (!isMethod(req, res, 'put')) break;
            const $request: PutEstimationContract = JSON.parse(data);
            const session = findSession($request.sessionId, res);
            if (session === null) break;
            const players = session.players;
            const player = players.find(p => p.id === $request.playerId);
            if (!player) {
                res.writeHead(404, 'player not found');
                res.end();
                break;
            }
            player.estimate = $request.estimate;
            res.end();
            const broadcastData = JSON.stringify(player);
            for (const $player of players) {
                if ($player === player) continue;
                $player.res.write(`event: set-estimate\ndata: ${broadcastData}\n\n`);
            }
            break;
        }
        case '/reveal': {
            if (!isMethod(req, res, 'post')) break;
            res.end();
            const session = findSession(query.id as string, res);
            if (session === null) break;
            for (const player of session.players) {
                player.res.write(`event: reveal\ndata: null\n\n`);
            }
            break;
        }
        case '/clear': {
            if (!isMethod(req, res, 'delete')) break;
            res.end();
            const session = findSession(query.id as string, res);
            if (session === null) break;
            for (const player of session.players) {
                player.res.write(`event: clear\ndata: null\n\n`);
            }
            break;
        }
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

function isMethod(req: IncomingMessage, res: ServerResponse, expected: 'post' | 'get' | 'put' | 'delete') {
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
        public estimate: number | null = null,
    ) { }

    public toJSON() {
        return { id: this.id, name: this.name, estimate: this.estimate };
    }
}

interface PutEstimationContract {
    readonly sessionId: string;
    readonly playerId: string;
    readonly estimate: number;
}