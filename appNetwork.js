const net = require('node:net');
const crypto = require('node:crypto');
const {inspect} = require('node:util');

const hash = d => crypto.createHash('sha1').update(d).digest('hex');

class App {

    constructor (addr) {
        this.requests = [];
        this.events = [];
        this.responses = {};
        this.client = net.createConnection(addr);
        this.client.on('data',async rd=>{rd=rd.toString('utf-8');
            for (let d of rd.split('\x17')) if (d) {
                let jd = JSON.parse(d);
                if (jd.type == 'connect_response') {
                    throw Error((jd.message??'')+'\n'+inspect(jd,{colors:true,depth:5}));
                }
                if (jd.type == 'request_response') {
                    this.responses[jd.id] = jd.data;
                }
                if (jd.type == 'event') {
                    let h = this.events.find(e=>e.name==jd.name);
                    h.callback(jd.data);
                }
            }
        });
    }

    /**
     * Registers a request type
     * @param {string} name the name of the request
     * @param {boolean} requiresResponse whether the client should be expecting a response
     * @param {(payload:object,rawData:object)=>undefined|object} callback the function to be called when the request has been received
     * @returns 
     */
    addRequest(name,requiresResponse) {
        this.requests.push({name,requiresResponse});
        return this;
    }

    /**
     * Registers a callback for an event
     * @param {string} name the name of the event
     * @param {(object)=>void} callback the function to be called when the server fires this event
     * @returns 
     */
    addEvent(name,callback) {
        this.events.push({name,callback});
        return this;
    }

    /**
     * Sends a request
     * @param {string} name the name of the request to be sent
     * @param {object} data the payload to be sent alongside with the request
     * @param {(object)=>void} callback a function to be called when the server responds (if it has to)
     */
    sendRequest(name,data,callback=()=>{}) {
        let d = JSON.stringify({
            type: 'request',
            name,
            data
        });
        let dh = hash(d);
        this.client.write(d+'\x17');
        if (this.requests.find(r=>r.name==name).requiresResponse) {
            return new Promise(r=>{
                let i = setInterval(()=>{
                    if (this.responses[dh]) {
                        clearInterval(i);
                        r(this.responses[dh]);
                        callback(this.responses[dh]);
                        delete this.responses[dh];
                    }
                });
            });
        }
    }

}

class Server {

    constructor (creationCb) {
        this.requests = [];
        /** @type {net.Socket[]} */
        this.clients = [];
        this.connectionListener = null;
        this.disconnectionListener = null;
        this.server = net.createServer(
            async s => {
                this.clients.push(s);
                let r = await (this.connectionListener??(()=>undefined)).call(this,s);
                if (!r) {
                    s.on('data',async rd => { rd = rd.toString('utf-8');
                        for (let d of rd.split('\x17')) if (d.length) {
                            let dh = hash(d);
                            let jd = JSON.parse(d);
                            if (jd.type == 'request') {
                                let h = this.requests.find(r=>r.name==jd.name);
                                if (h) {
                                    let r = await h.callback(jd.data,s);
                                    if (h.requiresResponse) {
                                        s.write(JSON.stringify({
                                            type : 'request_response',
                                            data : r,
                                            id : dh
                                        })+'\x17');
                                    }
                                }
                            }
                        }
                    });
                    s.on('error',()=>{
                        this.clients = this.clients.filter(c=>c!=s);
                    });
                    s.on('close',()=>{
                        this.clients = this.clients.filter(c=>c!=s);
                        if (typeof this.disconnectionListener == 'function') this.disconnectionListener(s);
                    });
                } else {
                    s.write(JSON.stringify({
                        type    : 'connect_response',
                        error   : 'Could not connect',
                        message : r
                    })+'\x17');
                    this.clients = this.clients.filter(c=>c!=s);
                    s.end();
                }
            }
        ).listen(()=>{
            creationCb(this.server.address());
        });
    }

    /**
     * Registers the callback for accepting users
     * the function should return undeifned if the user was accepted
     * and a string indicating why otherwise
     * @param {(s:net.Socket)=>object|undefined} l 
     * @returns {Server}
     */
    onConnection(l) {
        this.connectionListener = l;
        return this;
    }

    /**
     * Registers a callback for when a user is disconnected
     * @param {(s:net.Socekt)=>void} l
     * @returns {Server}
     */
    onDisconnect(l) {
        this.disconnectionListener = l;
        return this;
    }

    /**
     * Registers a callback for a request
     * @param {string} name the name of the request
     * @param {boolean} requiresResponse whether the client should be expecting a response
     * @param {(payload:any,emmitter:net.Socket)=>undefined|object} callback the function to be called when the request has been received
     * @returns 
     */
    addRequest(name,requiresResponse,callback) {
        this.requests.push({name,requiresResponse,callback});
        return this;
    }

    /**
     * Dispatches an event to all clients
     * @param {string} name the name of the event to be dispatched
     * @param {object} data the payload associated with the event
     * @param {net.Socket[]} clients allows overriding the clients to send the event to
     */
    dispatchEvent(name,data,clients=this.clients) {
        let d = JSON.stringify({
            type: 'event',
            name, data
        })+'\x17';
        for (let c of clients) {
            c.write(d);
        }
    }

}

module.exports = {
    App, Server
}