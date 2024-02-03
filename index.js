const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const dgram = require('node:dgram');
const crypto = require('node:crypto');

const hash = d => crypto.createHash('sha256').update(d).digest('base64');

const {input,choice,CancelChar} = require('./input');
const apps = require('./apps.json');

const discover = Symbol('discover');
const DISCOVER_PORT = 7545;

choice('Select an app',{
    values: ['\x1b[33mDiscover\x1b[39m'].concat(apps.map(a=>`\x1b[36m${a.name}\x1b[39m (${a.roomSize} users)`)),
    rv    : [discover].concat(apps),
    ln    : false,
    clear : true 
}).then(

    async appd => {

        if (appd == discover) {

            let appz = apps.map(a=>({name:a.name,version:hash(fs.readFileSync(path.join(__dirname,a.path))),path:a.path}));

            let sock = dgram.createSocket('udp4');

            let games = {};

            sock.on('listening',()=>{
                sock.setBroadcast(true);
            });

            sock.on('message',(msg,inf)=>{
                let dat = JSON.parse(msg.slice('LAN_GAMES'.length));
                let k = hash(JSON.stringify([inf.address,dat.host,dat.port]));
                games[k] = {
                    last: Date.now(),
                    addr: {
                        addr: inf.address,
                        name: dat.host,
                        port: dat.port,
                    },
                    appd: dat.appd
                };
            });

            sock.bind(DISCOVER_PORT);

            const sin  = process.stdin;
            const getch = () => new Promise(r=>sin.once('data',r));
            sin.setRawMode(true);
            process.on('exit',()=>{sin.setRawMode(false);});

            let oll = 0;

            let inp = '';
            let inpm = {m:'',t:-Infinity};

            let ri = setInterval(()=>{
                let w = '';
                w += `\x1b[A\x1b[K`.repeat(oll);
                oll = 0;
                let inps;
                if (inp.startsWith('#')) {
                    inps = `\x1b[90m#\x1b[39m\x1b[${Object.keys(games).map(k=>k.slice(0,4)).includes(inp.slice(1))?('35'+(Date.now()-Object.entries(games).find(([id,r])=>id.slice(0,4)==inp.slice(1))[1].last<5000?'':';3')):'31'}m${inp.slice(1)}\x1b[39;23m`;
                    if (Date.now()-inpm.t>5000) {
                        if (Object.keys(games).map(k=>k.slice(0,4)).includes(inp.slice(1))&&Date.now()-Object.entries(games).find(([id,r])=>id.slice(0,4)==inp.slice(1))[1].last>5000) {
                            inpm = {
                                t: Date.now(),
                                m: '(unreachable)',
                                ur: true
                            };   
                        } else {
                            inpm.ur = false;
                        }
                    }
                    if (Object.keys(games).map(k=>k.slice(0,4)).includes(inp.slice(1))&&Date.now()-Object.entries(games).find(([id,r])=>id.slice(0,4)==inp.slice(1))[1].last>5000) {}
                    else if (inpm.ur) {
                        inpm.t = -Infinity;
                    }
                } else {
                    inps = inp;
                }
                w += `Join game: ${inps} \x1b[90m${Date.now()-inpm.t<5000?inpm.m:''}\x1b[39m\n`;
                oll++;
                for (let [id,g] of Object.entries(games)) {
                    if (Date.now()-g.last < 5000) {
                        let app = appz.find(a=>a.name==g.appd.name);
                        let s,m;
                        if (!app) {
                            s = '\x1b[31mA\x1b[39m';
                            m = '\x1b[31m[Cannot find app]\x1b[39m';
                        } else if (app.version!=g.appd.version) {
                            s = '\x1b[33mV\x1b[39m';
                            m = `\x1b[33m[Version missmatch]\x1b[39m`;
                        } else {
                            s = '\x1b[32m◈\x1b[39m';
                            m = '';
                        }
                        w += `${s} \x1b[35m${id.slice(0,4)}\x1b[m \x1b[36;1m${g.appd.name}\x1b[39m (?/${g.appd.roomSize}) ${g.addr.addr}\x1b[90m:\x1b[39m${g.addr.port} (${g.addr.name}) ${m}\n`;
                        oll++;
                    }
                }
                process.stdout.write(w);
            },20);
            
            ;(async()=>{
                let join = null;
                while (true) {
                    let k = (await getch()).toString('utf-8');
                    if (k == '\x03') break;
                    else if (k == '\x7f' || k == '\x08') {
                        inp = inp.slice(0,inp.length-1);
                    }
                    else if (k == '\r' || k == '\n') {
                        if (inp.startsWith('#')) {
                            if (Object.keys(games).map(id=>id.slice(0,4)).includes(inp.slice(1))) {
                                let g = Object.entries(games).find(([id,g])=>id.slice(0,4)==inp.slice(1))[1];
                                let app = appz.find(a=>a.name==g.appd.name);
                                if (!app) {
                                    inpm = {t:Date.now(),m:'(Unknown game)'};
                                } else if (app.version!=g.appd.version) {
                                    inpm = {t:Date.now(),m:'(Version missmatch)'};
                                } else {
                                    join = {
                                        name: app.name,
                                        path: app.path,
                                        host: g.addr.addr,
                                        port: g.addr.port,
                                    };
                                }
                            } else {
                                inpm = {t:Date.now(),m:'(Invalid room ID)'};
                            }
                        }
                        if (join) {
                            break;
                        }
                    }
                    else if (!k.startsWith('\x1b')) {
                        inp += Array.from(k).map(c=>c.charCodeAt()).filter(c=>c>31).map(c=>String.fromCharCode(c)).join('');
                    }
                }
                clearInterval(ri);
                if (join) {
                    let appd = apps.find(a=>a.name==join.name);
                    let app = require(path.resolve(__dirname,join.path));
                    app.runClient({host:join.host,port:join.port},()=>{
                        console.log(`\x1b[A\x1b[K`.repeat(oll)+'Joined \x1b[36m'+appd.name+'\x1b[39m '+join.host+'\x1b[90m:\x1b[39m'+join.port);
                    });
                } else {
                    process.exit();
                }
            })();

        } else {

            let a = await choice(`\x1b[36m${appd.name}\x1b[39m`,{
                values: [
                    'Host',
                    'Join'
                ], 
                rv : [
                    'host',
                    'join'
                ],
                ln: false,
                clear: true
            });
            process.stdout.write({'host':'Hosting','join':'Joining'}[a]+` \x1b[36m${appd.name}\x1b[39m`);
    
            let app = require(path.resolve(__dirname,appd.path));
            let appver = hash(fs.readFileSync(path.resolve(__dirname,appd.path)));
    
            if (a == 'host') {
                app.runServer(
                    addr => {
                        console.log(` at ${addr.address} ${addr.port} (${os.hostname()})`);

                        for (let int of Object.values(os.networkInterfaces())) {

                            let bcst = (()=>{
                                let a = int.find(a=>a.family == 'IPv4');
                                let addr = a.address.split(/\./g);
                                let netm = a.address.split(/\./g);
                                return addr.map((p,i)=>(~netm[i]&255)|p).join('.');
                            })();

                            let sock = dgram.createSocket('udp4',(msg,inf)=>{
                                console.log(msg,inf); 
                            });
                
                            sock.bind(()=>{
                                sock.setBroadcast(true);
                                setInterval(()=>{
                                    let msg = JSON.stringify({
                                        address: addr.address,
                                        port: addr.port,
                                        host: os.hostname(),
                                        appd: {
                                            name: appd.name,
                                            roomSize: appd.roomSize,
                                            version: appver,
                                        },
                                    });
                                    let m = Buffer.concat([
                                        Buffer.from('LAN_GAMES'),
                                        Buffer.from(msg),
                                    ]);
                                    sock.send(m,0,m.length,DISCOVER_PORT,bcst);
                                },1000);
                            });

                        }
                    }
                );
            } else if (a == 'join') {
                console.log();
                let addr = await input('Address: '); if (addr == CancelChar) { process.stdout.write('\x1b[2K\x1b[A\x1b[2K\x1b[A'); process.exit(); }
                let port = await input('Port: ');    if (port == CancelChar) { process.stdout.write('\x1b[2K\x1b[A\x1b[2K\x1b[A\x1b[2K\x1b[A'); process.exit(); }
                app.runClient({host:addr,port},()=>{
                    console.log('\x1b[A\x1b[2K\x1b[A\x1b[2K\x1b[A\x1b[G\x1b[KJoined \x1b[36m'+appd.name+'\x1b[39m '+addr+'\x1b[90m:\x1b[39m'+port);
                });
            }

        }
    
    }

);