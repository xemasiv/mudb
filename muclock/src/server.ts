import { MuServer, MuServerProtocol, MuRemoteClientProtocol } from 'mudb/server';
import { MuClock } from './clock';
import { MuClockProtocol } from './schema';
import { MuPingStatistic } from './ping-statistic';

class MuClockClientPingHandler {
    public protocolClient:MuRemoteClientProtocol<typeof MuClockProtocol.client>;
    public server:MuClockServer;;
    public pingCount = 0;
    public connectTime:number = 0;
    public pingRate:number = 1000;
    public clock:MuClock;
    public statistic:MuPingStatistic;

    public lastPingStart:number = 0;
    public lastPingUUID:number = 0;

    constructor (clock:MuClock, client, server:MuClockServer, connectTime:number, pingRate:number, statistic:MuPingStatistic) {
        this.clock = clock;
        this.protocolClient = client;
        this.server = server;
        this.connectTime = connectTime;
        this.pingRate = pingRate;
        this.statistic = statistic;
    }

    public pollPing () {
        if (this.lastPingStart) {
            return;
        }
        const startClock = this.now();

        const targetPing = Math.floor(startClock / this.pingRate);
        if (this.pingCount >= targetPing) {
            return;
        }

        // do ping operation
        this.lastPingStart = startClock;
        this.lastPingUUID = Math.floor(Math.random() * 1e10);
        this.protocolClient.message.ping(this.lastPingUUID);
    }

    public now () {
        return this.clock.now() - this.connectTime;
    }

    public doPong (uuid:number) {
        if (uuid !== this.lastPingUUID || this.lastPingUUID === 0) {
            return;
        }

        const rtt = this.clock.now() - this.lastPingStart;
        this.lastPingUUID = 0;
        this.lastPingStart = 0;
        this.statistic.addSample(rtt);
        this.server.ping[this.protocolClient.sessionId] = this.statistic.median;
    }
}

export class MuClockServer {
    public tickRate:number = 30;

    public ping:{ [sessionId:string]:number } = {};

    private _clock:MuClock;
    private _tickCount:number = 0;
    private _protocol:MuServerProtocol<typeof MuClockProtocol>;

    private _pingRate:number = 1000;
    private _pingBufferSize:number = 256;

    private _pollInterval:any;
    private _onTick:(tick:number) => void = function () {};

    private _clientPingHandlers:{ [sessionId:string]:MuClockClientPingHandler } = {}

    constructor (spec:{
        server:MuServer,
        defaultPing?:number,
        pingRate?:number,
        tickRate?:number,
        tick?: (t:number) => void,
        pingBufferSize?:number,
    }) {
        this._protocol = spec.server.protocol(MuClockProtocol);
        this._pingBufferSize = spec.pingBufferSize || 256;

        if ('tickRate' in spec) {
            this.tickRate = spec.tickRate || 30;
        }
        if('tick' in spec) {
            this._onTick = spec.tick || function () {};
        }

        this._protocol.configure({
            ready: () => {
                this._clock = new MuClock();
                this._pollInterval = setInterval(() => this.poll(), Math.min(this.tickRate, this._pingRate) / 2);
            },
            message: {
                ping: (client) => {
                    client.message.pong(this._clock.now());
                },
                pong: (client, uuid) => {
                    const handler = this._clientPingHandlers[client.sessionId];
                    handler.doPong(uuid);
                },
            },
            connect: (client) => {
                client.message.init({
                    tickRate: this.tickRate,
                    serverClock: this._clock.now(),
                });

                const pingClient = new MuClockClientPingHandler(
                    this._clock,
                    client,
                    this,
                    this._clock.now(),
                    this._pingRate,
                    new MuPingStatistic(this._pingBufferSize));

                this.ping[client.sessionId] = spec.defaultPing || 200;
                this._clientPingHandlers[client.sessionId] = pingClient;
            },
            disconnect: (client) => {
                delete this.ping[client.sessionId];
                delete this._clientPingHandlers[client.sessionId];
            },
        });
    }

    public poll () {
        const targetTick = this.tick();

        while (this._tickCount < targetTick) {
            this._onTick(++this._tickCount);
        }

        Object.keys(this._clientPingHandlers).forEach((id) => {
            this._clientPingHandlers[id].pollPing();
        });
    }

    public tick () {
        return this._clock.now() / this.tickRate;
    }
}