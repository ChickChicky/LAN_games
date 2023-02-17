const appNetwork = require('../appNetwork');

const crypto = require('node:crypto');

const hash = d => crypto.createHash('sha1').update(d).digest('hex');

// Enum containing all cell types
const CellType = {
    EMPTY : 0,
    WALL  : 1,
    PLAYER: 2
}

// Enum containing all object types
const ObjType = {
    BOMB: 0,
    FIRE: 1
}

// list of attributes not to send for objects when sending a sync event
const ObjPrivateAttr = {
    [ObjType.BOMB]: [ ],
    [ObjType.FIRE]: [ 'damaged' ]
}

const InitObj = {
    [ObjType.FIRE] : o => { o.dat.damaged = [] }
}

// Enum containing various tags for cell types
const CellTags = {
    BLOCKING : [
        CellType.WALL
    ]
}

// Enum containing all 4 directions
const Direction = {
    UP    : 0,
    RIGHT : 1,
    DOWN  : 2,
    LEFT  : 3
}

// A class representing an object Server-side
class SV_Object {
    constructor (type,pos,dat) {
        this.type = type;
        this.pos  = pos;
        this.dat  = dat;
        let initfn = InitObj[this.type];
        if (typeof initfn == 'function') initfn(this);
    }
    serialize_CL() {
        return {type:this.type,pos:this.pos,dat:Object.fromEntries(Object.entries(this.dat).filter(d=>!(ObjPrivateAttr[this.type]??[]).includes(d[0])))};
    }
    ipos(level) {
        return this.pos[0] + this.pos[1] * level.mapSize[0];
    }
}

// A class representing an object Client-side
class CL_Object {
    constructor (d) {
        this.type = d.type;
        this.pos = d.pos;
        this.dat = d.dat;
    }
    ipos(level) {
        return this.pos[0] + this.pos[1] * level.mapSize[0];
    }
}

// A class representing a player Server-side
class SV_Player {
    constructor (position,color) {
        // player's position [x,y]
        this.pos = position;
        // player's items
        this.inventory = Array(4);
        // player's color
        this.color = color;

        // player's lives
        this.lives = 3;
        this.maxLives = 3;

        // last movement timestamp
        this.lm = -Infinity;
        // last bomb drop timestamp
        this.ld = -Infinity;
    }

    /**
     * Attempts to move the player
     * @param {number} dir the direction to move towards (refer to {@link Direction})
     * @param {*} level
     * @returns {boolean} whether the player has successfully been moved
     */
    move(dir,level) { if (!this.lives) return false;
        if (Date.now() - this.lm < this.moveCooldown()) return false; this.lm = Date.now();
        let {map,mapSize} = level;
        let np = [...this.pos];
        if (dir == Direction.UP)    np[1]--;
        if (dir == Direction.DOWN)  np[1]++;
        if (dir == Direction.LEFT)  np[0]--;
        if (dir == Direction.RIGHT) np[0]++;
        if (
            np[0] < 0 || np[0] >= mapSize[0] ||
            np[1] < 0 || np[1] >= mapSize[1] ||
            CellTags.BLOCKING.includes(map[np[0]+np[1]*mapSize[0]])
        ) return false;
        this.pos = np;
        return true;
    }
    moveCooldown() {
        return 200;
    }

    /**
     * Attempts to drop a bomb
     * @param {*} level
     * @returns {boolean} whether the bomb has sucessfully been dropped
     */
    drop(level) { if (!this.lives) return false;
        if (Date.now() - this.ld < this.dropCooldown()) return false; this.ld = Date.now();
        level.objects.push(new SV_Object(ObjType.BOMB,[...this.pos],{size:2,explodesAt:Date.now()+2000}));
        return true;
    }
    dropCooldown() {
        return 1000;
    }

    /**
     * Serializes the information of this player as JSON 
     * @param {string} id the ID of the player
     * @param {boolean} currentPlayer whether to include player-specific info
     * @returns {Object} the serialized data of the player
     */
    serialize_CL(id,currentPlayer) {
        return {
            color: this.color,
            pos  : this.pos,
            id,
            ...(currentPlayer?{inventory:this.inventory,lives:this.lives,maxLives:this.maxLives}:{})
        }
    }
    /**
     * Resolves the position of the player on an index-based system (i) instead of a cooardinate-based system ([x,y])
     * @param {*} level
     * @returns {number}
     */
    ipos(level) {
        return this.pos[0] + this.pos[1] * level.mapSize[0];
    }
}

// A class representing a player Client-side
class CL_Player {
    constructor (d) {
        this.pos = d.pos;
        this.inventory = d.inventory;
        this.color = d.color;
        this.id = d.id;
        this.maxLives = d.maxLives;
        this.lives = d.lives;
    }
    ipos(level) {
        return this.pos[0] + this.pos[1] * level.mapSize[0];
    }
}

function runServer(cb) {

    /**
     * @param {SV_Object} obj
     */
    function explode(obj) {
        objects.push(new SV_Object(ObjType.FIRE,obj.pos,{exhaustsAt:Date.now()+200}));
        for (let i = 0; i < obj.dat.size; i++) {
            setTimeout(
                () => {
                    let p = [
                        [obj.pos[0],obj.pos[1]+(i+1)],
                        [obj.pos[0],obj.pos[1]-(i+1)],
                        [obj.pos[0]+(i+1),obj.pos[1]],
                        [obj.pos[0]-(i+1),obj.pos[1]]
                    ];
                    for (let pp of p) if (!CellTags.BLOCKING.includes(map[pp[0]+pp[1]*mapSize[0]])&&pp[0]>=0&&pp[0]<mapSize[0]&&pp[1]>=0&&pp[1]<mapSize[1]) {
                        objects.push(new SV_Object(ObjType.FIRE,pp,{exhaustsAt:Date.now()+200+50*(i+1)}));
                    }
                },
                50*(i+1)
            )
        }
    }

    let baseMap = [
        0,0,0,0,0,0,0,0,0,0,0,
        0,1,0,1,0,0,0,1,0,1,0,
        0,0,0,0,0,0,0,0,0,0,0,
        0,1,0,1,0,0,0,1,0,1,0,
        0,0,0,0,0,0,0,0,0,0,0,
        0,0,1,0,0,1,0,0,1,0,0,
        0,0,0,0,0,0,0,0,0,0,0,
        0,1,0,1,0,0,0,1,0,1,0,
        0,0,0,0,0,0,0,0,0,0,0,
        0,1,0,1,0,0,0,1,0,1,0,
        0,0,0,0,0,0,0,0,0,0,0
    ];

    // the width and height of the map
    let mapSize = [11,11];
    // all the cells in the map
    let map = [...baseMap];
    // metadata for some cells in the map
    let mapMeta = {};
    /** @type {Object<string,SV_Player>} all the players, associated with their ID */
    let players = {};
    /** @type {SV_Object[]} all the objects present on the map */
    let objects = [];

    // A function returning all information about the level
    let level = () => ({ map,mapSize,mapMeta,players,objects });

    // An object telling whether each color is available or not
    let availColors = Object.fromEntries(Array(5).fill().map((_,i)=>[i,true]));

    // Synchronizes the client and the server
    function sync() {
        for (let s of server.clients) if (!s.closed) {
            let id = hash(`${s.remoteAddress}${s.remotePort}`);
            server.dispatchEvent('sync',{objects:objects.map(o=>o.serialize_CL(id)),map:map.map((c,i)=>Object.values(players).some(p=>p.ipos(level())==i)?CellType.PLAYER:c),mapMeta:mapMeta,mapSize,players:Object.entries(players).filter(p=>p[1].lives).map((pl)=>pl[1].serialize_CL(pl[0],pl[0]==id))},[s]);
        }
    }

    const server = new appNetwork.Server((...a)=>{cb(...a)})
        .onConnection(
            s => {
                let id = hash(`${s.remoteAddress}${s.remotePort}`);
                if (server.clients.length > 5) {
                    return 'Room full';
                } else {
                    let cl = +Object.entries(availColors).find(c=>c[1])[0];
                    availColors[cl] = false;
                    players[id] = new SV_Player([0,0],cl);
                    console.log(`\x1b[${31+cl}mConnected\x1b[m ${s.remoteAddress} ${s.remotePort} ${id}`)
                    //console.log(`\x1b[${server.clients.length+1}AOnline:\n${server.clients.map(s=>`\x1b[K  \x1b[${31+players[hash(`${s.remoteAddress}${s.remotePort}`)].color}m#\x1b[39m ${s.remoteAddress} ${s.remotePort} ${hash(`${s.remoteAddress}${s.remotePort}`)}`).join('\n')}\n`);
                }
            }
        )
        .onDisconnect(
            s => {
                let id = hash(`${s.remoteAddress}${s.remotePort}`);
                let p = players[id];
                if (p) {
                    availColors[p.color] = true;
                    delete players[id];
                }
                //console.log(`\x1b[${server.clients.length+3}AOnline:\n${server.clients.map(s=>`\x1b[K  \x1b[${31+players[hash(`${s.remoteAddress}${s.remotePort}`)].color}m#\x1b[39m ${s.remoteAddress} ${s.remotePort} ${hash(`${s.remoteAddress}${s.remotePort}`)}`).join('\n')}\x1b[K\n\x1b[K\n`);

            }
        )
        .addRequest( 'move', true, (d,s) => {
            let id = hash(`${s.remoteAddress}${s.remotePort}`);
            let player = players[id];
            if (!player) return;
            if (player.move(d,level())) sync();
        })
        .addRequest( 'drop', true, (d,s) => {
            let id = hash(`${s.remoteAddress}${s.remotePort}`);
            let player = players[id];
            if (!player) return;
            if (player.drop(level())) sync();
        })
        .addRequest( 'use', true, (d,s) => {
            let id = hash(`${s.remoteAddress}${s.remotePort}`);
            let player = players[id];
            if (!player) return;
        });

    setInterval(
        () => {
            for (let obj of objects) {
                if (obj.type == ObjType.BOMB) {
                    if (obj.dat.explodesAt <= Date.now()) {
                        explode(obj,level());
                        objects = objects.filter(o=>o!=obj);
                    }
                }
                if (obj.type == ObjType.FIRE) {
                    if (obj.dat.exhaustsAt <= Date.now()) objects = objects.filter(o=>o!=obj);
                    for (let p of Object.values(players).filter(p=>p.ipos(level())==obj.ipos(level()))) if (!obj.dat.damaged.includes(p)) {
                        obj.dat.damaged.push(p);
                        if (p.lives > 0) p.lives--;
                    }
                }
            }
            sync();
        },
        10
    );
}

function runClient( addr, cb=()=>null ) {

    let map = [];
    let mapSize = [0,0];
    let mapMeta = {};
    /** @type {CL_Player[]} */
    let players = [];
    /** @type {CL_Object[]} */
    let objects = [];

    const sout = process.stdout;
    const sin  = process.stdin;

    let level = () => ({map,mapSize,mapMeta,players,objects});

    const getch = () => new Promise(r=>sin.once('data',r));

    let orm = sin.rawMode;
    sin.setRawMode(true);
    process.on('exit',()=>{sin.setRawMode(orm);render(true)});

    function render(final=false) { if (!mapSize[0] || !mapSize[1]) return;
        let renderCell = i => {
            let s = '';
            if (objects.some(o=>o.ipos(level())==i&&o.type==ObjType.BOMB)) s += '\x1b[41m';
            if (objects.some(o=>o.ipos(level())==i&&o.type==ObjType.FIRE)) return s + '\x1b[91m▒\x1b[m';
            let ct = map[i];
            let c = {[CellType.WALL]:'█',[CellType.EMPTY]:' '}[ct];
            if (c != undefined) return s+c+'\x1b[m';
            if (ct == CellType.PLAYER) {
                let p  = players.find(p=>p.ipos(level())==i);
                if (p)
                    return s+`\x1b[${p.inventory?'36;1':(31+p.color)}mX\x1b[m`;
                else
                    return s+`\x1b[90mX\x1b[m`;
            }
            return '?';
        }
        let thisPlayer = players.find(p=>p.inventory);
        sout.write(
            `╔` + '═'.repeat(mapSize[0]) + '╗\n' + Array(mapSize[1]).fill().map((_,y)=>'║'+Array(mapSize[0]).fill().map((_,x)=>renderCell(x+y*mapSize[0])).join('')+'║').join('\n') +  '\n╚' + '═'.repeat(mapSize[0]) + `╝\n` + `${thisPlayer?`\x1b[31m${'♥'.repeat(thisPlayer.lives)}\x1b[90m${'♥'.repeat(thisPlayer.maxLives-thisPlayer.lives)}`:'\x1b[91mDEAD'}\x1b[m\n^  \n$  \nù  \n*  \n` +(final?'':`\x1b[${mapSize[1]+7}A\x1b[G`)
        );
    }

    //\\

    const app = new appNetwork.App(addr)
        .addRequest( 'move' )
        .addRequest( 'drop' )
        .addRequest( 'use' )
        .addEvent( 'sync', d =>{
            ({map,mapSize,mapMeta,players,objects} = d);
            players = players.map(p=>new CL_Player(p));
            objects = objects.map(o=>new CL_Object(o));
            render();
        });
    
    cb();

    //\\

    function move(d) {
        app.sendRequest('move',d);
    }

    function dropBomb() {
        app.sendRequest('drop');
    }

    //\\

    {(async()=>{
        
        while (true) {
            let k = await getch();
            if (k == '\x1b[A') move(Direction.UP)
            if (k == '\x1b[B') move(Direction.DOWN);
            if (k == '\x1b[C') move(Direction.RIGHT);
            if (k == '\x1b[D') move(Direction.LEFT);
            if (k == '\r')     dropBomb();
            if (k == '\x03') break;
        }
    
        process.exit();

    })()}

}

module.exports = { runClient, runServer };